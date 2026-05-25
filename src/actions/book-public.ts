"use server";

/**
 * Reserva pública directa (catálogo /licencias o /mentorias).
 * No requiere ShareLink — el usuario elige la herramienta desde el catálogo.
 * Límite: 1 reserva por email por día (por herramienta).
 */

import { prisma } from "@/lib/prisma";
import { generateCancelToken, hashCancelToken } from "@/lib/share-links";
import { sendReservationConfirmedEmail, sendMentorNotificationEmail } from "@/lib/email";
import { scheduleReminderEmails } from "@/lib/jobs";
import { createAdminCalendarEvent, createMentorshipCalendarEvent } from "@/lib/google-calendar";

const CANCEL_CUTOFF_HRS = 1;

/**
 * Verifica que el email no tenga ya una reserva CONFIRMADA para la misma
 * herramienta el mismo día calendario (UTC) que el slot solicitado.
 */
async function checkToolDailyLimit(
  toolId: string,
  guestEmail: string,
  slotStartsAt: Date
): Promise<boolean> {
  const dayStart = new Date(slotStartsAt);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(slotStartsAt);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const count = await prisma.reservation.count({
    where: {
      licenseAccount: { toolId },
      guestEmail,
      startsAt: { gte: dayStart, lte: dayEnd },
      status: "CONFIRMED",
    },
  });

  return count === 0;
}

export async function bookPublicTool(formData: FormData) {
  try {
    const toolSlug = (formData.get("toolSlug") as string)?.trim();
    const guestName = (formData.get("guestName") as string)?.trim();
    const guestEmail = (formData.get("guestEmail") as string)?.trim();
    const startsAtStr = formData.get("startsAt") as string;

    if (!toolSlug || !guestName || !guestEmail || !startsAtStr) {
      return { error: "Todos los campos son requeridos" };
    }

    if (!guestEmail.includes("@")) {
      return { error: "Email inválido" };
    }

    // Parse datetime primero (necesario para el límite diario)
    const startsAt = new Date(startsAtStr);
    if (isNaN(startsAt.getTime())) {
      return { error: "Horario inválido" };
    }

    // Validar herramienta
    const tool = await prisma.tool.findUnique({
      where: { slug: toolSlug, isActive: true },
    });
    if (!tool) {
      return { error: "Herramienta no encontrada" };
    }

    // Verificar límite diario (1 reserva por día por herramienta)
    const withinLimit = await checkToolDailyLimit(tool.id, guestEmail, startsAt);
    if (!withinLimit) {
      return {
        error: `Ya tienes una reserva para ${tool.name} ese día. Solo se permite una reserva por día.`,
      };
    }

    // Buscar licencias
    const licenses = await prisma.licenseAccount.findMany({
      where: { toolId: tool.id, isActive: true },
    });
    if (licenses.length === 0) {
      return { error: "No hay licencias disponibles para esta herramienta" };
    }

    // Buscar slot disponible en alguna licencia
    let selectedLicense = null;
    let selectedSlot = null;

    for (const license of licenses) {
      const slot = await prisma.availabilitySlot.findFirst({
        where: {
          licenseAccountId: license.id,
          startsAt: { lte: startsAt },
          endsAt: { gt: startsAt },
          isBlocked: false,
        },
      });

      if (slot) {
        const conflict = await prisma.reservation.findFirst({
          where: {
            licenseAccountId: license.id,
            startsAt: { lt: slot.endsAt },
            endsAt: { gt: startsAt },
            status: "CONFIRMED",
          },
        });

        if (!conflict) {
          selectedLicense = license;
          selectedSlot = slot;
          break;
        }
      }
    }

    if (!selectedLicense || !selectedSlot) {
      return { error: "Horario no disponible" };
    }

    // Generar token de cancelación
    const cancelToken = generateCancelToken();
    const cancelTokenHash = hashCancelToken(cancelToken);

    // Crear reserva (sin shareLinkId)
    const reservation = await prisma.reservation.create({
      data: {
        licenseAccountId: selectedLicense.id,
        guestName,
        guestEmail,
        cancelTokenHash,
        startsAt: selectedSlot.startsAt,
        endsAt: selectedSlot.endsAt,
        status: "CONFIRMED",
      },
    });

    const isMentoria = tool.category === "MENTORIA";

    // Para mentorías: crear evento en Google Calendar con Meet link
    let meetLink: string | null = null;
    if (isMentoria) {
      try {
        meetLink = await createMentorshipCalendarEvent(reservation.id);
      } catch (err) {
        console.error("[book-public] Error creando evento de mentoría:", err);
      }
    }

    // Email de confirmación al participante (fire-and-forget)
    try {
      await sendReservationConfirmedEmail(
        guestEmail,
        {
          participantName: guestName,
          courseName: tool.name,
          toolName: tool.name,
          accessUrl: isMentoria ? null : tool.accessUrl,
          meetLink,
          startsAt: reservation.startsAt,
          endsAt: reservation.endsAt,
          credential: null,
          cancelToken,
          reservationId: reservation.id,
        },
        reservation.id
      );
    } catch (err) {
      console.error("[book-public] Error sending email:", err);
    }

    // Para mentorías: notificar al mentor
    if (isMentoria && selectedLicense.accountEmail) {
      try {
        await sendMentorNotificationEmail(
          selectedLicense.accountEmail,
          {
            mentorName: selectedLicense.label,
            participantName: guestName,
            participantEmail: guestEmail,
            toolName: tool.name,
            startsAt: reservation.startsAt,
            endsAt: reservation.endsAt,
            meetLink,
          },
          reservation.id
        );
      } catch (err) {
        console.error("[book-public] Error enviando email al mentor:", err);
      }
    }

    // Para licencias: crear evento en calendario del admin + programar recordatorios
    if (!isMentoria) {
      createAdminCalendarEvent(reservation.id).catch((err) =>
        console.error("[book-public] Error creando evento en Calendar:", err)
      );
      try {
        await scheduleReminderEmails(reservation.id, reservation.startsAt);
      } catch (err) {
        console.error("[book-public] Error scheduling reminders:", err);
      }
    }

    return {
      success: true,
      reservationId: reservation.id,
      message: `Reserva confirmada. Recibirás un email en ${guestEmail}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error inesperado";
    console.error("[book-public] Error:", msg);
    return { error: msg };
  }
}

export async function cancelPublicReservation(
  reservationId: string,
  cancelToken: string
) {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { licenseAccount: { include: { tool: true } } },
    });

    if (!reservation) return { error: "Reserva no encontrada" };
    if (!reservation.cancelTokenHash)
      return { error: "Esta reserva no puede cancelarse" };

    const expected = hashCancelToken(cancelToken);
    if (expected !== reservation.cancelTokenHash)
      return { error: "Token de cancelación inválido" };

    const cutoffMs = CANCEL_CUTOFF_HRS * 60 * 60 * 1000;
    if (Date.now() > reservation.startsAt.getTime() - cutoffMs) {
      return {
        error: `No puedes cancelar dentro de ${CANCEL_CUTOFF_HRS}h del horario`,
      };
    }

    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: "Cancelado por el participante vía link",
      },
    });

    return { success: true, message: "Reserva cancelada correctamente." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error inesperado";
    return { error: msg };
  }
}
