/**
 * Utilidades para semanas ISO 8601.
 * Semana ISO: comienza el lunes, la semana 1 es la que contiene el primer jueves del año.
 */

export interface ISOWeek {
  isoYear: number;
  isoWeek: number;
}

/** Calcula la semana ISO de una fecha. */
export function getISOWeek(date: Date): ISOWeek {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const day = d.getUTCDay() || 7; // Lun=1 … Dom=7
  d.setUTCDate(d.getUTCDate() + 4 - day); // avanza al jueves de la semana
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const isoWeek = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7
  );
  return { isoYear: d.getUTCFullYear(), isoWeek };
}

/** Devuelve la semana ISO actual. */
export function currentISOWeek(): ISOWeek {
  return getISOWeek(new Date());
}

/**
 * Calcula los límites exactos (UTC) de una semana ISO.
 * from = lunes 00:00:00.000 UTC
 * until = domingo 23:59:59.999 UTC
 */
export function getISOWeekBounds(
  isoYear: number,
  isoWeek: number
): { from: Date; until: Date } {
  // El 4 de enero siempre cae en la semana 1 del año ISO.
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7; // Lun=1 … Dom=7
  // Lunes de la semana 1
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);

  // Lunes de la semana objetivo
  const from = new Date(week1Monday);
  from.setUTCDate(week1Monday.getUTCDate() + (isoWeek - 1) * 7);

  // Domingo 23:59:59.999 de la semana objetivo
  const until = new Date(from);
  until.setUTCDate(from.getUTCDate() + 6);
  until.setUTCHours(23, 59, 59, 999);

  return { from, until };
}

/** Formatea como "2026-W19" */
export function formatISOWeek(isoYear: number, isoWeek: number): string {
  return `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;
}

/**
 * Verifica que una reserva no cruce la frontera de semana ISO.
 * Retorna true si startsAt y endsAt pertenecen a la misma semana ISO.
 */
export function sameISOWeek(startsAt: Date, endsAt: Date): boolean {
  const start = getISOWeek(startsAt);
  const end = getISOWeek(endsAt);
  // endsAt puede ser el instante exacto del inicio de una nueva semana;
  // por eso restamos 1 ms para comparar el último instante efectivo.
  const endEffective = getISOWeek(new Date(endsAt.getTime() - 1));
  return (
    start.isoYear === endEffective.isoYear &&
    start.isoWeek === endEffective.isoWeek
  );
}
