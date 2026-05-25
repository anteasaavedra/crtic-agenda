/**
 * GET /api/jobs/process
 *
 * Worker endpoint para procesar jobs de recordatorio de email.
 * Llamado por un cron externo cada ~5 minutos.
 *
 * Autenticación: Bearer token via Authorization header o ?secret= en query.
 *
 * Configuración Vercel Cron (vercel.json):
 * {
 *   "crons": [{ "path": "/api/jobs/process", "schedule": "* /5 * * * *" }]
 * }
 * (Vercel Cron añade automáticamente el header Authorization: Bearer <CRON_SECRET>)
 *
 * Variables de entorno requeridas:
 *   CRON_SECRET — string secreto para autenticar el endpoint
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBoss, JOB_EMAIL_REMINDER, type ReminderJobData } from "@/lib/boss";
import { sendReminderEmail } from "@/lib/email";
import { safeDecrypt } from "@/lib/encryption";
import { getISOWeek } from "@/lib/iso-week";

const BATCH_SIZE = 10;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn("[cron] CRON_SECRET no configurado — endpoint desprotegido");
    return true; // Permitir en dev sin secret
  }

  // Vercel Cron: Authorization: Bearer <secret>
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  // Alternativa: ?secret=... (para pruebas manuales)
  const url = new URL(request.url);
  if (url.searchParams.get("secret") === secret) return true;

  return false;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const boss = await getBoss();
  // pg-boss v9+: fetch(name, options)
  const jobs = await boss.fetch<ReminderJobData>(JOB_EMAIL_REMINDER, { batchSize: BATCH_SIZE });

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ processed: 0, message: "Sin jobs pendientes" });
  }

  let processed = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      await processReminderJob(job.data);
      await boss.complete(JOB_EMAIL_REMINDER, job.id);
      processed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      console.error(`[cron] Job ${job.id} falló:`, msg);
      await boss.fail(JOB_EMAIL_REMINDER, job.id, { message: msg });
      failed++;
    }
  }

  return NextResponse.json({ processed, failed });
}

// ─── Procesamiento de un job de recordatorio ──────────────────────────────────

async function processReminderJob(data: ReminderJobData): Promise<void> {
  const { reservationId, type } = data;

  // Obtener reserva con toda la info necesaria
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

  // Si la reserva ya no está confirmada, no enviar
  if (reservation.status !== "CONFIRMED") {
    console.info(`[cron] Reserva ${reservationId} en estado ${reservation.status}, saltando.`);
    return;
  }

  // Resolver email y nombre — puede ser reserva de invitado (guestEmail) o participante con cuenta
  const recipientEmail =
    reservation.guestEmail ??
    reservation.participant?.user.email ??
    null;

  const recipientName =
    reservation.guestName ??
    reservation.participant?.user.name ??
    "";

  const courseName =
    reservation.participant?.course.name ??
    reservation.licenseAccount.tool.name;

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

  // Recordatorio de 1h sin credenciales → no enviar (no tiene sentido sin acceso)
  if (type === "1h" && !credential) {
    console.info(`[cron] Recordatorio 1h de reserva ${reservationId} omitido — sin credenciales para la semana ${weekLabel}.`);
    return;
  }

  // Reconstruir cancelToken desde el hash no es posible — se omite en recordatorios
  // (el participante ya recibió el link en el email de confirmación)

  // Enviar email
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
