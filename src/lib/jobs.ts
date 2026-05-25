/**
 * Scheduling de recordatorios vía tabla ScheduledReminder en Postgres.
 * Reemplaza pg-boss — funciona correctamente en entornos serverless.
 */

import { prisma } from "@/lib/prisma";

export async function scheduleReminderEmails(
  reservationId: string,
  startsAt: Date
): Promise<void> {
  const jobs = [
    { type: "24h", offsetMs: 24 * 60 * 60 * 1000 },
    { type: "1h",  offsetMs:      60 * 60 * 1000 },
  ];

  try {
    const now = new Date();
    const pending = jobs
      .map(({ type, offsetMs }) => ({
        type,
        sendAt: new Date(startsAt.getTime() - offsetMs),
      }))
      .filter(({ sendAt }) => sendAt > now); // solo programar si aún no pasó

    if (pending.length === 0) return;

    await prisma.scheduledReminder.createMany({
      data: pending.map(({ type, sendAt }) => ({
        reservationId,
        type,
        sendAt,
      })),
    });
  } catch (err) {
    console.error("[jobs] Error al programar recordatorios para", reservationId, err);
  }
}
