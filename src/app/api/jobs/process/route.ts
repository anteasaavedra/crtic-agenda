/**
 * GET /api/jobs/process
 *
 * Worker endpoint para procesar recordatorios de email pendientes.
 * Llamado por cron-job.org cada 5 minutos.
 *
 * Autenticación: ?secret=<CRON_SECRET>
 * O bien: Authorization: Bearer <CRON_SECRET>
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendReminderEmail } from "@/lib/email";
import { safeDecrypt } from "@/lib/encryption";
import { getISOWeek } from "@/lib/iso-week";

const BATCH_SIZE = 10;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn("[cron] CRON_SECRET no configurado — endpoint desprotegido");
    return true;
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  if (url.searchParams.get("secret") === secret) return true;
  return false;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Tomar recordatorios pendientes cuya hora de envío ya llegó
  const pending = await prisma.scheduledReminder.findMany({
    where: {
      sentAt: null,
      sendAt: { lte: new Date() },
    },
    take: BATCH_SIZE,
    orderBy: { sendAt: "asc" },
  });

  if (pending.length === 0) {
    return NextResponse.json({ processed: 0, message: "Sin recordatorios pendientes" });
  }

  let processed = 0;
  let failed = 0;

  for (const reminder of pending) {
    try {
      await processReminder(reminder.reservationId, reminder.type as "24h" | "1h");
      await prisma.scheduledReminder.update({
        where: { id: reminder.id },
        data: { sentAt: new Date() },
      });
      processed++;
    } catch (err) {
      console.error(`[cron] Recordatorio ${reminder.id} falló:`, err);
      failed++;
    }
  }

  return NextResponse.json({ processed, failed });
}

async function processReminder(reservationId: string, type: "24h" | "1h"): Promise<void> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      participant: {
        include: {
          user: { select: { name: true, email: true } },
          course: { select: { name: true } },
        },
      },
      licenseAccount: {
        include: { tool: { select: { name: true, accessUrl: true } } },
      },
    },
  });

  if (!reservation) {
    console.warn(`[cron] Reserva ${reservationId} no encontrada, saltando.`);
    return;
  }

  if (reservation.status !== "CONFIRMED") {
    console.info(`[cron] Reserva ${reservationId} en estado ${reservation.status}, saltando.`);
    return;
  }

  const recipientEmail =
    reservation.guestEmail ?? reservation.participant?.user.email ?? null;
  const recipientName =
    reservation.guestName ?? reservation.participant?.user.name ?? "";
  const courseName =
    reservation.participant?.course.name ?? reservation.licenseAccount.tool.name;

  if (!recipientEmail) {
    console.warn(`[cron] Reserva ${reservationId} sin email destinatario, saltando.`);
    return;
  }

  // Buscar credenciales para la semana de la reserva
  const { isoYear, isoWeek } = getISOWeek(reservation.startsAt);
  const weekLabel = `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;

  const credentialRecord = await prisma.weeklyCredential.findUnique({
    where: {
      licenseAccountId_isoYear_isoWeek: {
        licenseAccountId: reservation.licenseAccountId,
        isoYear,
        isoWeek,
      },
    },
    select: { usernameEncrypted: true, passwordEncrypted: true },
  });

  const credential = credentialRecord
    ? {
        username: safeDecrypt(credentialRecord.usernameEncrypted),
        password: safeDecrypt(credentialRecord.passwordEncrypted),
        weekLabel,
      }
    : null;

  // No enviar recordatorio de 1h sin credenciales
  if (type === "1h" && !credential) {
    console.info(`[cron] Recordatorio 1h de ${reservationId} omitido — sin credenciales para ${weekLabel}.`);
    return;
  }

  await sendReminderEmail(
    recipientEmail,
    {
      participantName: recipientName,
      courseName,
      toolName: reservation.licenseAccount.tool.name,
      accessUrl: reservation.licenseAccount.tool.accessUrl,
      startsAt: reservation.startsAt,
      endsAt: reservation.endsAt,
      credential,
      reservationId: reservation.id,
    },
    type,
    reservation.id,
    reservation.participantId
  );
}
