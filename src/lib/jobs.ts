/**
 * Scheduling de jobs de recordatorio vía pg-boss.
 *
 * Se llama desde las acciones de servidor después de confirmar una reserva.
 * Los jobs son procesados por GET /api/jobs/process (cron).
 */

import { getBoss, JOB_EMAIL_REMINDER, type ReminderJobData } from "@/lib/boss";

/**
 * Programa los emails de recordatorio (24h y 1h antes del inicio).
 * No lanza excepciones: si falla el scheduling solo loguea el error.
 */
export async function scheduleReminderEmails(
  reservationId: string,
  startsAt: Date
): Promise<void> {
  const jobs: { type: ReminderJobData["type"]; offsetMs: number }[] = [
    { type: "24h", offsetMs: 24 * 60 * 60 * 1000 },
    { type: "1h",  offsetMs:      60 * 60 * 1000 },
  ];

  try {
    const boss = await getBoss();

    await Promise.all(
      jobs.map(({ type, offsetMs }) => {
        const startAfter = new Date(startsAt.getTime() - offsetMs);

        // Si la fecha ya pasó (reserva muy próxima), no programar
        if (startAfter <= new Date()) return Promise.resolve();

        const payload: ReminderJobData = { reservationId, type };
        // pg-boss v9+: send(name, data, options)
        return boss.send(JOB_EMAIL_REMINDER, payload, {
          startAfter: startAfter.toISOString(),
        });
      })
    );
  } catch (err) {
    // No bloqueamos la reserva si el scheduling falla
    console.error("[jobs] Error al programar recordatorios para", reservationId, err);
  }
}
