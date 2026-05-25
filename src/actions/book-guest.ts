"use server";

/**
 * Acción de servidor para reservas vía link público (sin cuenta).
 *
 * Flow:
 * 1. User recibe link público `/r/[token]`
 * 2. Ve disponibilidad de la herramienta
 * 3. Ingresa nombre + email + horario
 * 4. Se crea Reservation con guestName/guestEmail
 * 5. Se envía email de confirmación + credenciales
 * 6. Se programan recordatorios automáticos
 */

import { prisma } from "@/lib/prisma";
import {
  getActiveShareLink,
  checkWeeklyEmailLimit,
  generateCancelToken,
  hashCancelToken,
} from "@/lib/share-links";
import { sendReservationConfirmedEmail } from "@/lib/email";
import { scheduleReminderEmails } from "@/lib/jobs";
import { getISOWeek } from "@/lib/iso-week";

export async function bookReservationGuest(formData: FormData) {
  try {
    const token = (formData.get("token") as string)?.trim();
    const guestName = (formData.get("guestName") as string)?.trim();
    const guestEmail = (formData.get("guestEmail") as string)?.trim();
    const startsAtStr = formData.get("startsAt") as string;

    if (!token || !guestName || !guestEmail || !startsAtStr) {
      return { error: "Todos los campos son requeridos" };
    }

    // Validar email
    if (!guestEmail.includes("@")) {
      return { error: "Email inválido" };
    }

    // Validar share link
    const shareLink = await getActiveShareLink(token);
    if (!shareLink) {
      return { error: "Link de reserva inválido o expirado" };
    }

    // Verificar límite semanal por email
    const withinLimit = await checkWeeklyEmailLimit(shareLink.id, guestEmail);
    if (!withinLimit) {
      return {
        error: `Ya tienes el máximo de ${shareLink.maxPerWeekEmail} reservas esta semana`,
      };
    }

    // Parse datetime
    const startsAt = new Date(startsAtStr);
    if (isNaN(startsAt.getTime())) {
      return { error: "Horario inválido" };
    }

    // Verificar disponibilidad — si el link está fijado a una licencia específica, usar solo esa
    const licenses = await prisma.licenseAccount.findMany({
      where: {
        toolId: shareLink.toolId,
        isActive: true,
        ...(shareLink.licenseAccountId ? { id: shareLink.licenseAccountId } : {}),
      },
    });

    if (licenses.length === 0) {
      return { error: "No hay licencias disponibles para esta herramienta" };
    }

    // Buscar un slot disponible en cualquier licencia
    let selectedLicense = null;
    let selectedSlot = null;

    for (const license of licenses) {
      const availability = await prisma.availabilitySlot.findFirst({
        where: {
          licenseAccountId: license.id,
          startsAt: { lte: startsAt },
          endsAt: { gt: startsAt },
          isBlocked: false,
        },
      });

      if (availability) {
        // Verificar que no esté reservado
        const existing = await prisma.reservation.findFirst({
          where: {
            licenseAccountId: license.id,
            startsAt: { lt: availability.endsAt },
            endsAt: { gt: startsAt },
            status: { in: ["CONFIRMED"] },
          },
        });

        if (!existing) {
          selectedLicense = license;
          selectedSlot = availability;
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

    // Crear reserva
    const reservation = await prisma.reservation.create({
      data: {
        shareLinkId: shareLink.id,
        licenseAccountId: selectedLicense.id,
        guestName,
        guestEmail,
        cancelTokenHash,
        startsAt: selectedSlot.startsAt,
        endsAt: selectedSlot.endsAt,
        status: "CONFIRMED",
      },
      include: {
        licenseAccount: {
          include: { tool: true },
        },
      },
    });

    // Enviar email de confirmación (fire-and-forget)
    try {
      await sendReservationConfirmedEmail(
        guestEmail,
        {
          participantName: guestName,
          courseName: shareLink.label,
          toolName: reservation.licenseAccount.tool.name,
          startsAt: reservation.startsAt,
          endsAt: reservation.endsAt,
          credential: null,
          cancelToken,
          reservationId: reservation.id,
        },
        reservation.id
      );
    } catch (err) {
      console.error("[book-guest] Error sending confirmation email:", err);
    }

    // Programar recordatorios automáticos (fire-and-forget)
    try {
      await scheduleReminderEmails(reservation.id, reservation.startsAt);
    } catch (err) {
      console.error("[book-guest] Error scheduling reminders:", err);
    }

    return {
      success: true,
      reservationId: reservation.id,
      message: `Reserva confirmada. Recibirás un email con los detalles en ${guestEmail}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error inesperado";
    console.error("[book-guest] Error:", msg, err);
    return { error: msg };
  }
}

/**
 * Cancelar reserva vía token (endpoint /r/[token]/cancel/[id]).
 * El token es un secreto enviado en el email — si coincide el hash, permitir cancelación.
 */
export async function cancelReservationGuest(
  reservationId: string,
  cancelToken: string
) {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        shareLink: true,
        licenseAccount: { include: { tool: true } },
      },
    });

    if (!reservation) {
      return { error: "Reserva no encontrada" };
    }

    if (!reservation.cancelTokenHash) {
      return { error: "Esta reserva no puede ser cancelada" };
    }

    // Validar token
    const expectedHash = hashCancelToken(cancelToken);
    if (expectedHash !== reservation.cancelTokenHash) {
      return { error: "Token de cancelación inválido" };
    }

    // Validar que no esté muy cerca del horario
    const link = reservation.shareLink;
    if (link) {
      const cutoffMs = link.cancelCutoffHrs * 60 * 60 * 1000;
      const now = Date.now();
      if (now > reservation.startsAt.getTime() - cutoffMs) {
        return {
          error: `No puedes cancelar dentro de ${link.cancelCutoffHrs}h del horario`,
        };
      }
    }

    // Cancelar
    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: "Cancelado por el participante vía link",
      },
    });

    return {
      success: true,
      message: "Reserva cancelada. El horario está disponible para otros usuarios.",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error inesperado";
    console.error("[cancel-guest] Error:", msg);
    return { error: msg };
  }
}
