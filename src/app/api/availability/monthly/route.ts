/**
 * GET /api/availability/monthly
 *
 * Devuelve el número de slots disponibles por día para un mes dado.
 * Usado por el calendario público para colorear los días.
 *
 * Query params:
 *   toolId           — ID de la herramienta (requerido si no hay licenseAccountId)
 *   licenseAccountId — filtrar a una licencia específica (opcional)
 *   month            — YYYY-MM (requerido)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const toolId           = searchParams.get("toolId");
  const licenseAccountId = searchParams.get("licenseAccountId");
  const month            = searchParams.get("month"); // YYYY-MM

  if (!month || (!toolId && !licenseAccountId)) {
    return NextResponse.json({ error: "Parámetros requeridos" }, { status: 400 });
  }

  const [year, monthNum] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, monthNum - 1, 1));
  const monthEnd   = new Date(Date.UTC(year, monthNum, 1));

  const licenseFilter = licenseAccountId
    ? { id: licenseAccountId }
    : { toolId: toolId!, isActive: true };

  const timeRange = { gte: monthStart, lt: monthEnd };

  // Fetch slots y reservas en paralelo
  const [slots, reservations] = await Promise.all([
    prisma.availabilitySlot.findMany({
      where: { licenseAccount: licenseFilter, isBlocked: false, startsAt: timeRange },
      select: { startsAt: true, licenseAccountId: true },
    }),
    prisma.reservation.findMany({
      where: { licenseAccount: licenseFilter, status: "CONFIRMED", startsAt: timeRange },
      select: { startsAt: true, licenseAccountId: true },
    }),
  ]);

  // Set de slots ocupados usando timestamp numérico como clave (evita conversiones a ISO string)
  const reservedSet = new Set(
    reservations.map((r) => `${r.licenseAccountId}|${r.startsAt.getTime()}`)
  );

  // Contar slots disponibles agrupados por día (YYYY-MM-DD en UTC)
  const dateCounts: Record<string, number> = {};
  for (const slot of slots) {
    if (!reservedSet.has(`${slot.licenseAccountId}|${slot.startsAt.getTime()}`)) {
      const dateStr = slot.startsAt.toISOString().split("T")[0];
      dateCounts[dateStr] = (dateCounts[dateStr] ?? 0) + 1;
    }
  }

  return NextResponse.json({ dates: dateCounts });
}
