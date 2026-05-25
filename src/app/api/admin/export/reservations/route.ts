/**
 * GET /api/admin/export/reservations
 *
 * Exporta todas las reservas como CSV (protegido, solo admin).
 * Compatible con Excel (BOM UTF-8 + CRLF).
 *
 * Query params opcionales:
 *  - status: CONFIRMED | CANCELLED | COMPLETED | NO_SHOW
 *  - from:   YYYY-MM-DD (fecha inicio UTC)
 *  - to:     YYYY-MM-DD (fecha fin UTC)
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ReservationStatus } from "@prisma/client";

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function esc(value: unknown): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\r") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCSV(header: string[], rows: unknown[][]): string {
  const lines = [header, ...rows].map((r) => r.map(esc).join(","));
  return "﻿" + lines.join("\r\n"); // BOM para compatibilidad con Excel
}

// ─── Handler ──────────────────────────────────────────────────────────────────

const VALID_STATUSES: ReservationStatus[] = ["CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"];

export async function GET(request: Request) {
  // Verificar sesión de admin
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const fromParam  = searchParams.get("from");
  const toParam    = searchParams.get("to");

  const statusFilter =
    statusParam && VALID_STATUSES.includes(statusParam as ReservationStatus)
      ? (statusParam as ReservationStatus)
      : undefined;

  const fromDate = fromParam ? new Date(`${fromParam}T00:00:00Z`) : undefined;
  const toDate   = toParam   ? new Date(`${toParam}T23:59:59.999Z`) : undefined;

  const reservations = await prisma.reservation.findMany({
    where: {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(fromDate || toDate
        ? {
            startsAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate   ? { lte: toDate }   : {}),
            },
          }
        : {}),
    },
    include: {
      participant: {
        include: {
          user:   { select: { name: true, email: true } },
          course: { select: { name: true } },
        },
      },
      licenseAccount: {
        include: { tool: { select: { name: true } } },
      },
    },
    orderBy: { startsAt: "desc" },
  });

  const header = [
    "ID",
    "Estado",
    "Participante",
    "Email participante",
    "Curso",
    "Herramienta",
    "Licencia",
    "Inicio (UTC)",
    "Término (UTC)",
    "Duración (min)",
    "Creada el (UTC)",
    "Cancelada el (UTC)",
    "Motivo cancelación",
    "ID evento Calendar",
  ];

  const rows = reservations.map((r) => {
    const name = r.guestName ?? r.participant?.user.name ?? "";
    const email = r.guestEmail ?? r.participant?.user.email ?? "";
    const course = r.participant?.course.name ?? "Público";
    return [
      r.id,
      r.status,
      name,
      email,
      course,
      r.licenseAccount.tool.name,
      r.licenseAccount.label,
      r.startsAt.toISOString(),
      r.endsAt.toISOString(),
      (r.endsAt.getTime() - r.startsAt.getTime()) / 60_000,
      r.createdAt.toISOString(),
      r.cancelledAt?.toISOString() ?? "",
      r.cancellationReason ?? "",
      r.googleEventIdAdmin ?? "",
    ];
  });

  const csv = toCSV(header, rows);
  const filename = `reservas_${new Date().toISOString().substring(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control":       "no-store",
    },
  });
}
