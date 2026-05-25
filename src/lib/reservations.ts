/**
 * Motor de reservas — validación y creación.
 *
 * Reglas de negocio aplicadas (en orden):
 *  1. Tiempos básicos: startsAt < endsAt, no pasado
 *  2. La reserva no puede cruzar la frontera de semana ISO
 *  3. Duración dentro del máximo de la herramienta (120 min MVP)
 *  4. Participante ACTIVE en el curso
 *  5. Herramienta y licencia activas, asociadas al curso del participante
 *  6. Dentro de la ventana de reserva del curso (reservationWindowDays)
 *  7. Dentro de las fechas del curso
 *  8. Existe un AvailabilitySlot no bloqueado que contiene el rango completo
 *  9. No existe un AvailabilitySlot bloqueado que se superponga
 * 10. Límite semanal del curso (maxReservationsPerWeek)
 * 11. Límite diario del curso (maxReservationsPerDay)
 *
 * Las reglas de anti-solapamiento (misma licencia, mismo participante)
 * las impone Postgres con EXCLUDE USING gist (exclude_constraints.sql).
 * Capturamos esas violaciones y devolvemos mensajes amigables.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getISOWeek, getISOWeekBounds, sameISOWeek } from "./iso-week";

export interface ReservationInput {
  participantId: string;
  licenseAccountId: string;
  startsAt: Date;
  endsAt: Date;
}

export interface ReservationResult {
  reservation: {
    id: string;
    participantId: string | null;
    licenseAccountId: string;
    startsAt: Date;
    endsAt: Date;
    status: string;
  };
  hasCredentials: boolean;
  /** Presente cuando la reserva es válida pero faltan credenciales para esa semana. */
  credentialWarning?: string;
}

// ─── Validación ───────────────────────────────────────────────────────────────

/**
 * Valida todas las reglas de negocio sin crear nada en BD.
 * Retorna null si todo está bien, o un string de error si algo falla.
 */
export async function validateReservation(
  input: ReservationInput
): Promise<string | null> {
  const { participantId, licenseAccountId, startsAt, endsAt } = input;

  // 1. Tiempos básicos
  const now = new Date();
  if (startsAt <= now) return "No se puede reservar en el pasado";
  if (startsAt >= endsAt)
    return "La hora de inicio debe ser anterior a la de término";

  const durationMin = (endsAt.getTime() - startsAt.getTime()) / 60_000;
  if (durationMin < 30) return "La duración mínima es de 30 minutos";

  // 2. Cruce de semana ISO
  if (!sameISOWeek(startsAt, endsAt))
    return "La reserva no puede cruzar la frontera de semana ISO (lunes 00:00 UTC)";

  // 3. Participante
  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    include: { course: true },
  });
  if (!participant) return "Participante no encontrado";
  if (participant.status !== "ACTIVE")
    return "El participante no está activo en este curso";

  // 4. Licencia y herramienta
  const license = await prisma.licenseAccount.findUnique({
    where: { id: licenseAccountId },
    include: { tool: true },
  });
  if (!license) return "Licencia no encontrada";
  if (!license.isActive) return "La licencia está inactiva";
  if (!license.tool.isActive) return "La herramienta está inactiva";

  // 5. Duración máxima de la herramienta
  if (durationMin > license.tool.maxReservationMinutes)
    return `Duración máxima para ${license.tool.name}: ${license.tool.maxReservationMinutes} minutos`;

  // 6. Herramienta asociada al curso del participante
  const courseTool = await prisma.courseTool.findFirst({
    where: { courseId: participant.courseId, toolId: license.toolId },
  });
  if (!courseTool)
    return "Esta herramienta no está habilitada para el curso del participante";

  const course = participant.course;

  // 7. Ventana de reserva
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + course.reservationWindowDays);
  if (startsAt > windowEnd)
    return `Solo se puede reservar con hasta ${course.reservationWindowDays} días de anticipación`;

  // 8. Dentro de las fechas del curso
  const courseEnd = new Date(course.endsOn);
  courseEnd.setUTCDate(courseEnd.getUTCDate() + 1); // endsOn es inclusivo
  if (startsAt < course.startsOn || startsAt >= courseEnd)
    return "La reserva debe estar dentro de las fechas del curso";

  // 9. Existe slot de disponibilidad NO bloqueado que contiene el rango completo
  const availSlot = await prisma.availabilitySlot.findFirst({
    where: {
      licenseAccountId,
      isBlocked: false,
      startsAt: { lte: startsAt },
      endsAt: { gte: endsAt },
    },
  });
  if (!availSlot)
    return "No hay disponibilidad declarada para ese horario en esta licencia";

  // 10. No hay slot BLOQUEADO que se superponga
  const blockedSlot = await prisma.availabilitySlot.findFirst({
    where: {
      licenseAccountId,
      isBlocked: true,
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
  if (blockedSlot)
    return `Horario bloqueado: ${blockedSlot.reason ?? "mantenimiento programado"}`;

  // 11. Límite semanal
  if (course.maxReservationsPerWeek) {
    const { isoYear, isoWeek } = getISOWeek(startsAt);
    const { from, until } = getISOWeekBounds(isoYear, isoWeek);
    const weekCount = await prisma.reservation.count({
      where: {
        participantId,
        status: "CONFIRMED",
        startsAt: { gte: from, lt: until },
      },
    });
    if (weekCount >= course.maxReservationsPerWeek)
      return `Límite semanal alcanzado: máximo ${course.maxReservationsPerWeek} reserva(s) por semana`;
  }

  // 12. Límite diario
  if (course.maxReservationsPerDay) {
    const dayStart = new Date(
      Date.UTC(
        startsAt.getUTCFullYear(),
        startsAt.getUTCMonth(),
        startsAt.getUTCDate()
      )
    );
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const dayCount = await prisma.reservation.count({
      where: {
        participantId,
        status: "CONFIRMED",
        startsAt: { gte: dayStart, lt: dayEnd },
      },
    });
    if (dayCount >= course.maxReservationsPerDay)
      return `Límite diario alcanzado: máximo ${course.maxReservationsPerDay} reserva(s) por día`;
  }

  return null;
}

// ─── Creación ─────────────────────────────────────────────────────────────────

function parseDbExclusionError(e: unknown): string | null {
  const text = e instanceof Prisma.PrismaClientKnownRequestError
    ? String(e.meta?.details ?? e.message)
    : String(e);

  if (text.includes("Reservation_license_no_overlap"))
    return "Esa licencia ya está reservada para ese horario (reserva concurrente)";
  if (text.includes("Reservation_participant_no_overlap"))
    return "Ya tienes una reserva que se superpone con ese horario";
  return null;
}

/**
 * Valida todas las reglas y crea la reserva en una operación atómica.
 * Las colisiones de concurrencia las captura el EXCLUDE constraint de Postgres.
 */
export async function createReservationRecord(
  input: ReservationInput
): Promise<ReservationResult> {
  const error = await validateReservation(input);
  if (error) throw new Error(error);

  const { participantId, licenseAccountId, startsAt, endsAt } = input;

  let reservation;
  try {
    reservation = await prisma.reservation.create({
      data: { participantId, licenseAccountId, startsAt, endsAt, status: "CONFIRMED" },
    });
  } catch (e) {
    const dbMsg = parseDbExclusionError(e);
    if (dbMsg) throw new Error(dbMsg);
    throw e;
  }

  // Verificar si hay credenciales para esa semana
  const { isoYear, isoWeek } = getISOWeek(startsAt);
  const hasCred = await prisma.weeklyCredential.findUnique({
    where: {
      licenseAccountId_isoYear_isoWeek: { licenseAccountId, isoYear, isoWeek },
    },
    select: { id: true },
  });

  return {
    reservation,
    hasCredentials: !!hasCred,
    credentialWarning: hasCred
      ? undefined
      : `Sin credenciales cargadas para la semana ${isoWeek}/${isoYear}. Recuerda cargarlas antes del turno.`,
  };
}

// ─── Cancelación ─────────────────────────────────────────────────────────────

export async function cancelReservationRecord(
  id: string,
  cancelledById: string,
  reason: string
) {
  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation) throw new Error("Reserva no encontrada");
  if (reservation.status !== "CONFIRMED")
    throw new Error("Solo se pueden cancelar reservas CONFIRMED");

  return prisma.reservation.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledById,
      cancellationReason: reason,
    },
  });
}
