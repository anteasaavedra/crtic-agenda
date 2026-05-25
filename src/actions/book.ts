"use server";

/**
 * Acción de servidor para que el participante cree una reserva.
 *
 * Valida que:
 *  - Existe sesión de participante.
 *  - El participantId pertenece al usuario de la sesión.
 *  - El participante tiene acceso a la herramienta (CourseTool).
 *  - Hay licencias disponibles para el slot.
 */

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getParticipantSession } from "@/lib/participant-session";
import { pickAvailableLicense } from "@/lib/availability";
import { createReservationRecord } from "@/lib/reservations";
import { audit } from "@/lib/audit";
import { sendReservationConfirmedEmail } from "@/lib/email";
import { scheduleReminderEmails } from "@/lib/jobs";
import { safeDecrypt } from "@/lib/encryption";
import { getISOWeek } from "@/lib/iso-week";
import { createAdminCalendarEvent } from "@/lib/google-calendar";

type RedirectError = Error & { digest?: string };
function isRedirect(e: unknown): e is RedirectError {
  return (e as RedirectError)?.digest?.startsWith("NEXT_REDIRECT") ?? false;
}

export async function createReservationParticipant(formData: FormData) {
  const session = await getParticipantSession();
  if (!session) redirect("/login");

  try {
    const participantId = (formData.get("participantId") as string)?.trim();
    const toolId = (formData.get("toolId") as string)?.trim();
    const startsAtStr = (formData.get("startsAt") as string)?.trim();

    if (!participantId || !toolId || !startsAtStr) {
      throw new Error("Datos de reserva incompletos");
    }

    // Verificar que el participante pertenece al usuario de la sesión
    const participant = await prisma.participant.findUnique({
      where: { id: participantId },
      select: { userId: true, courseId: true, status: true },
    });

    if (!participant || participant.userId !== session.userId) {
      throw new Error("No autorizado");
    }
    if (participant.status !== "ACTIVE") {
      throw new Error("Tu participación en este curso no está activa");
    }

    // Verificar que el curso tiene acceso a la herramienta
    const courseTool = await prisma.courseTool.findUnique({
      where: { courseId_toolId: { courseId: participant.courseId, toolId } },
    });

    if (!courseTool) {
      throw new Error("Tu curso no tiene acceso a esta herramienta");
    }

    // Parsear startsAt y calcular endsAt
    const startsAt = new Date(startsAtStr);
    if (isNaN(startsAt.getTime())) throw new Error("Fecha u hora inválida");

    const tool = await prisma.tool.findUnique({
      where: { id: toolId },
      select: { defaultSlotMinutes: true, name: true, isActive: true },
    });

    if (!tool) throw new Error("Herramienta no encontrada");
    if (!tool.isActive) throw new Error("Herramienta inactiva");

    const endsAt = new Date(startsAt.getTime() + tool.defaultSlotMinutes * 60_000);

    // Seleccionar licencia disponible
    const licenseAccountId = await pickAvailableLicense(toolId, startsAt, endsAt);
    if (!licenseAccountId) {
      throw new Error(
        `No hay licencias de ${tool.name} disponibles para ese horario. ` +
          "Prueba otro horario o fecha."
      );
    }

    // Crear reserva
    const result = await createReservationRecord({
      participantId,
      licenseAccountId,
      startsAt,
      endsAt,
    });

    await audit({
      actorId: session.userId,
      action: "CREATE_RESERVATION_PARTICIPANT",
      entityType: "Reservation",
      entityId: result.reservation.id,
      metadata: {
        participantId,
        licenseAccountId,
        toolId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      },
    });

    // ─── Email de confirmación + scheduling de recordatorios ──────────────
    // Fetch de datos para el email (en paralelo con el scheduling)
    const [participantFull, credentialRecord] = await Promise.all([
      prisma.participant.findUnique({
        where: { id: participantId },
        include: {
          user: { select: { name: true, email: true } },
          course: { select: { name: true } },
        },
      }),
      // Buscar credencial de la semana de la reserva
      (async () => {
        const { isoYear, isoWeek } = getISOWeek(startsAt);
        return prisma.weeklyCredential.findUnique({
          where: {
            licenseAccountId_isoYear_isoWeek: { licenseAccountId, isoYear, isoWeek },
          },
          select: { usernameEncrypted: true, passwordEncrypted: true, isoYear: true, isoWeek: true },
        });
      })(),
    ]);

    if (participantFull) {
      const { isoYear, isoWeek } = credentialRecord
        ? { isoYear: credentialRecord.isoYear, isoWeek: credentialRecord.isoWeek }
        : getISOWeek(startsAt);

      const credential = credentialRecord
        ? {
            username: safeDecrypt(credentialRecord.usernameEncrypted),
            password: safeDecrypt(credentialRecord.passwordEncrypted),
            weekLabel: `${isoYear}-W${String(isoWeek).padStart(2, "0")}`,
          }
        : null;

      // Fire-and-forget (no bloqueamos la reserva si el email falla)
      sendReservationConfirmedEmail(
        participantFull.user.email,
        {
          participantName: participantFull.user.name ?? "",
          courseName: participantFull.course.name,
          toolName: tool.name,
          startsAt,
          endsAt,
          credential,
        },
        result.reservation.id,
        participantId
      ).catch((err) => console.error("[book] Error enviando confirmación:", err));
    }

    // Programar recordatorios (no-throw)
    scheduleReminderEmails(result.reservation.id, startsAt);

    // Crear evento en Google Calendar (fire-and-forget)
    createAdminCalendarEvent(result.reservation.id).catch((err) =>
      console.error("[createReservationParticipant] Error creando evento calendario:", err)
    );

    redirect("/mis-reservas?success=1");
  } catch (e) {
    if (isRedirect(e)) throw e;
    const msg = e instanceof Error ? e.message : "Error inesperado al crear la reserva";
    const dateStr = (formData.get("startsAt") as string)?.substring(0, 10) ?? "";
    const toolId = (formData.get("toolId") as string) ?? "";
    redirect(
      `/book/${toolId}?error=${encodeURIComponent(msg)}&date=${dateStr}`
    );
  }
}
