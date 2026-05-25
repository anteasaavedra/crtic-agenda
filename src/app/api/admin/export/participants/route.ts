/**
 * GET /api/admin/export/participants
 *
 * Exporta todos los participantes como CSV (protegido, solo admin).
 * Compatible con Excel (BOM UTF-8 + CRLF).
 *
 * Query params opcionales:
 *  - courseId: filtrar por curso
 *  - status:   ACTIVE | SUSPENDED | REMOVED
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ParticipantStatus } from "@prisma/client";

function esc(value: unknown): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\r") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCSV(header: string[], rows: unknown[][]): string {
  const lines = [header, ...rows].map((r) => r.map(esc).join(","));
  return "﻿" + lines.join("\r\n");
}

const VALID_STATUSES: ParticipantStatus[] = ["ACTIVE", "SUSPENDED", "REMOVED"];

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const courseIdParam = searchParams.get("courseId");
  const statusParam   = searchParams.get("status");

  const statusFilter =
    statusParam && VALID_STATUSES.includes(statusParam as ParticipantStatus)
      ? (statusParam as ParticipantStatus)
      : undefined;

  const participants = await prisma.participant.findMany({
    where: {
      ...(courseIdParam  ? { courseId: courseIdParam }   : {}),
      ...(statusFilter   ? { status: statusFilter }      : {}),
    },
    include: {
      user:   { select: { name: true, email: true, createdAt: true, lastLoginAt: true } },
      course: { select: { name: true } },
      _count: { select: { reservations: true } },
    },
    orderBy: [{ course: { name: "asc" } }, { user: { email: "asc" } }],
  });

  const header = [
    "ID participación",
    "Estado",
    "Nombre",
    "Email",
    "Curso",
    "Fecha ingreso",
    "Último login",
    "Total reservas",
  ];

  const rows = participants.map((p) => [
    p.id,
    p.status,
    p.user.name ?? "",
    p.user.email,
    p.course.name,
    p.joinedAt.toISOString().substring(0, 10),
    p.user.lastLoginAt?.toISOString().substring(0, 10) ?? "",
    p._count.reservations,
  ]);

  const csv = toCSV(header, rows);
  const filename = `participantes_${new Date().toISOString().substring(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control":       "no-store",
    },
  });
}
