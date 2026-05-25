/**
 * Cálculo de slots libres para una herramienta en una fecha dada.
 *
 * Lógica:
 *  1. Obtener todas las licencias activas de la herramienta.
 *  2. Para cada licencia:
 *     a. Obtener AvailabilitySlots NO bloqueados que cubran el día.
 *     b. Obtener AvailabilitySlots BLOQUEADOS que se superpongan.
 *     c. Obtener Reservas CONFIRMED que se superpongan.
 *     d. Generar candidatos de `slotMinutes` minutos; excluir los ocupados/bloqueados.
 *  3. Agregar por hora de inicio: contar cuántas licencias tienen ese slot libre.
 *  4. Retornar lista ordenada por hora.
 *
 * Nota: todos los timestamps son UTC. La UI debe convertir a zona local del usuario.
 */

import { prisma } from "./prisma";

export interface FreeSlot {
  startsAt: Date;
  endsAt: Date;
  /** Número de licencias con ese slot disponible (≥ 1). */
  availableLicenses: number;
}

/**
 * Devuelve todos los slots libres para una herramienta en un día (UTC).
 * `date` debe ser un Date cuyo año/mes/día UTC correspondan al día deseado.
 */
export async function getFreeSlots(
  toolId: string,
  date: Date,
  slotMinutes: number = 120
): Promise<FreeSlot[]> {
  const dayStart = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );
  const dayEnd = dayStart + 86_400_000;
  const slotMs = slotMinutes * 60_000;

  const licenses = await prisma.licenseAccount.findMany({
    where: { toolId, isActive: true },
    select: { id: true },
  });
  if (licenses.length === 0) return [];

  // slotStart (ms) → cuántas licencias lo tienen libre
  const counts = new Map<number, number>();

  for (const license of licenses) {
    const [availSlots, blockedSlots, reservations] = await Promise.all([
      prisma.availabilitySlot.findMany({
        where: {
          licenseAccountId: license.id,
          isBlocked: false,
          startsAt: { lt: new Date(dayEnd) },
          endsAt: { gt: new Date(dayStart) },
        },
        select: { startsAt: true, endsAt: true },
      }),
      prisma.availabilitySlot.findMany({
        where: {
          licenseAccountId: license.id,
          isBlocked: true,
          startsAt: { lt: new Date(dayEnd) },
          endsAt: { gt: new Date(dayStart) },
        },
        select: { startsAt: true, endsAt: true },
      }),
      prisma.reservation.findMany({
        where: {
          licenseAccountId: license.id,
          status: "CONFIRMED",
          startsAt: { lt: new Date(dayEnd) },
          endsAt: { gt: new Date(dayStart) },
        },
        select: { startsAt: true, endsAt: true },
      }),
    ]);

    // Convertir bloqueados y reservas a rangos de ms para comparación rápida
    const busy = [
      ...blockedSlots.map((b) => [b.startsAt.getTime(), b.endsAt.getTime()] as const),
      ...reservations.map((r) => [r.startsAt.getTime(), r.endsAt.getTime()] as const),
    ];

    for (const avail of availSlots) {
      // Recortar al día
      const windowStart = Math.max(avail.startsAt.getTime(), dayStart);
      const windowEnd = Math.min(avail.endsAt.getTime(), dayEnd);

      let current = windowStart;
      while (current + slotMs <= windowEnd) {
        const slotEnd = current + slotMs;
        const isFree = !busy.some(([bs, be]) => bs < slotEnd && be > current);
        if (isFree) {
          counts.set(current, (counts.get(current) ?? 0) + 1);
        }
        current += slotMs;
      }
    }
  }

  return Array.from(counts.entries())
    .sort(([a], [b]) => a - b)
    .map(([ts, count]) => ({
      startsAt: new Date(ts),
      endsAt: new Date(ts + slotMs),
      availableLicenses: count,
    }));
}

/**
 * Elige automáticamente la licencia menos cargada que tenga disponibilidad
 * para el rango [startsAt, endsAt). Retorna null si no hay ninguna libre.
 *
 * Usado al crear una reserva: el participante nunca ve qué licencia se le asigna.
 */
export async function pickAvailableLicense(
  toolId: string,
  startsAt: Date,
  endsAt: Date
): Promise<string | null> {
  const licenses = await prisma.licenseAccount.findMany({
    where: { toolId, isActive: true },
    select: { id: true },
  });

  for (const { id: licenseAccountId } of licenses) {
    // ¿Hay availability no bloqueada que cubra el rango?
    const avail = await prisma.availabilitySlot.findFirst({
      where: {
        licenseAccountId,
        isBlocked: false,
        startsAt: { lte: startsAt },
        endsAt: { gte: endsAt },
      },
      select: { id: true },
    });
    if (!avail) continue;

    // ¿Hay algo bloqueado o reservado que se superponga?
    const [blocked, reserved] = await Promise.all([
      prisma.availabilitySlot.findFirst({
        where: {
          licenseAccountId,
          isBlocked: true,
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
        select: { id: true },
      }),
      prisma.reservation.findFirst({
        where: {
          licenseAccountId,
          status: "CONFIRMED",
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
        select: { id: true },
      }),
    ]);

    if (!blocked && !reserved) return licenseAccountId;
  }

  return null;
}
