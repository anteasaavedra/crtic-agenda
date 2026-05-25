/**
 * pg-boss singleton para job scheduling.
 *
 * Usado exclusivamente para programar emails de recordatorio (24h y 1h).
 * Las llamadas a boss.start() son idempotentes.
 */

import { PgBoss } from "pg-boss";

const g = globalThis as { __boss?: PgBoss; __bossStarted?: boolean };

function createBoss(): PgBoss {
  // En pg-boss v12 las opciones de retención (archive/delete) se configuran
  // por-queue (QueueOptions), no en el constructor. Las dejamos en default
  // (7 días retención, 14 días en created/retry).
  return new PgBoss({
    connectionString: process.env.DATABASE_URL!,
  });
}

/**
 * Devuelve la instancia de pg-boss, iniciada y lista para usar.
 * Seguro llamar múltiples veces gracias al singleton en globalThis.
 */
export async function getBoss(): Promise<PgBoss> {
  if (!g.__boss) {
    g.__boss = createBoss();
  }
  if (!g.__bossStarted) {
    await g.__boss.start();
    g.__bossStarted = true;
  }
  return g.__boss;
}

// ─── Nombres de jobs ──────────────────────────────────────────────────────────

export const JOB_EMAIL_REMINDER = "email-reminder";

export interface ReminderJobData {
  reservationId: string;
  type: "24h" | "1h";
}
