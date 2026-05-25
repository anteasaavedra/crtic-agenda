/**
 * GET /api/availability
 *
 * Devuelve los slots libres para una herramienta en una fecha concreta.
 * Usado por la vista de reserva del participante (Stage 4).
 *
 * Query params:
 *  - toolId    (string, requerido)
 *  - date      (YYYY-MM-DD, requerido — se interpreta como UTC)
 *
 * Respuesta:
 *  {
 *    toolId: string,
 *    date: string,
 *    slotMinutes: number,
 *    slots: Array<{ startsAt: string, endsAt: string, availableLicenses: number }>
 *  }
 *
 * Seguridad:
 *  - En Stage 3 el endpoint es abierto para facilitar pruebas.
 *  - En Stage 4 se añadirá validación de sesión de participante.
 *  - NO expone qué licencia específica se asignará; solo la cantidad disponible.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFreeSlots } from "@/lib/availability";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(request: Request) {
  // Rate limit por IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const { allowed, retryAfterSeconds } = rateLimit(
    `availability:${ip}`,
    RATE_LIMITS.AVAILABILITY.max,
    RATE_LIMITS.AVAILABILITY.windowMs
  );

  if (!allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo en un momento." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds) },
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const toolId = searchParams.get("toolId");
  const dateStr = searchParams.get("date");

  if (!toolId || !dateStr) {
    return NextResponse.json(
      { error: "Los parámetros 'toolId' y 'date' son requeridos" },
      { status: 400 }
    );
  }

  // Validar formato de fecha
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json(
      { error: "El parámetro 'date' debe tener formato YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const date = new Date(`${dateStr}T00:00:00Z`);
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const tool = await prisma.tool.findUnique({
    where: { id: toolId },
    select: { id: true, name: true, defaultSlotMinutes: true, isActive: true },
  });

  if (!tool) {
    return NextResponse.json({ error: "Herramienta no encontrada" }, { status: 404 });
  }
  if (!tool.isActive) {
    return NextResponse.json({ error: "Herramienta inactiva" }, { status: 404 });
  }

  const slots = await getFreeSlots(toolId, date, tool.defaultSlotMinutes);

  return NextResponse.json({
    toolId: tool.id,
    toolName: tool.name,
    date: dateStr,
    slotMinutes: tool.defaultSlotMinutes,
    slots: slots.map((s) => ({
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      availableLicenses: s.availableLicenses,
    })),
  });
}
