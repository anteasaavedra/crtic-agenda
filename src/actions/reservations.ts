"use server";

/**
 * Acciones de servidor para reservas.
 *
 * createReservation: Disponible en Stage 3 para que el admin cree reservas
 * de prueba. En Stage 4 se añade una acción equivalente para participantes.
 *
 * cancelReservation: Solo admins (o participante dueño con política habilitada).
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createReservationRecord, cancelReservationRecord } from "@/lib/reservations";
import { pickAvailableLicense } from "@/lib/availability";
import { sendCancellationEmail } from "@/lib/email";
import { createAdminCalendarEvent, deleteAdminCalendarEvent } from "@/lib/google-calendar";

type RedirectError = Error & { digest?: string };
function isRedirect(e: unknown): e is RedirectError {
  return (e as RedirectError)?.digest?.startsWith("NEXT_REDIRECT") ?? false;
}

// ─── Crear reserva (admin — para pruebas) ────────────────────────────────────

export async function createReservationAdmin(formData: FormData) {
  const session = await requireAdmin();

  try {
    const participantId = (formData.get("participantId") as string)?.trim();
    const toolId = (formData.get("toolId") as string)?.trim();
    const dateStr = formData.get("date") as string;  // YYYY-MM-DD
    const timeStr = formData.get("time") as string;  // HH:MM

    if (!participantId || !toolId || !dateStr || !timeStr) {
      throw new Error("Todos los campos son requeridos");
    }

    const startsAt = new Date(`${dateStr}T${timeStr}:00Z`);
    if (isNaN(startsAt.getTime())) throw new Error("Fecha u hora inválida");

    const tool = await prisma.tool.findUnique({
      where: { id: toolId },
      select: { defaultSlotMinutes: true, name: true },
    });
    if (!tool) throw new Error("Herramienta no encontrada");

    const endsAt = new Date(startsAt.getTime() + tool.defaultSlotMinutes * 60_000);

    // Selección automática de licencia disponible
    const licenseAccountId = await pickAvailableLicense(toolId, startsAt, endsAt);
    if (!licenseAccountId) {
      throw new Error(
        `No hay licencias de ${tool.name} disponibles para ese horario`
      );
    }

    const result = await createReservationRecord({
      participantId,
      licenseAccountId,
      startsAt,
      endsAt,
    });

    await audit({
      actorId: session.user.id,
      action: "CREATE_RESERVATION",
      entityType: "Reservation",
      entityId: result.reservation.id,
      metadata: {
        participantId,
        licenseAccountId,
        toolId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        createdByAdmin: true,
      },
    });

    // Crear evento en Google Calendar (fire-and-forget)
    createAdminCalendarEvent(result.reservation.id).catch((err) =>
      console.error("[createReservationAdmin] Error creando evento calendario:", err)
    );

    revalidatePath("/admin/reservations");

    if (result.credentialWarning) {
      redirect(
        `/admin/reservations?warning=${encodeURIComponent(result.credentialWarning)}`
      );
    }
    redirect("/admin/reservations");
  } catch (e) {
    if (isRedirect(e)) throw e;
    const msg = e instanceof Error ? e.message : "Error inesperado";
    redirect(`/admin/reservations?error=${encodeURIComponent(msg)}`);
  }
}

// ─── Cancelar reserva (admin) ─────────────────────────────────────────────────

export async function cancelReservationAdmin(formData: FormData) {
  const session = await requireAdmin();

  try {
    const id = (formData.get("id") as string)?.trim();
    const reason =
      (formData.get("reason") as string)?.trim() || "Cancelada por administrador";

    if (!id) throw new Error("ID de reserva requerido");

    const reservation = await cancelReservationRecord(
      id,
      session.user.id,
      reason
    );

    await audit({
      actorId: session.user.id,
      action: "CANCEL_RESERVATION",
      entityType: "Reservation",
      entityId: id,
      metadata: {
        reason,
        startsAt: reservation.startsAt.toISOString(),
        licenseAccountId: reservation.licenseAccountId,
      },
    });

    // Enviar email de cancelación al participante (fire-and-forget)
    prisma.reservation.findUnique({
      where: { id },
      include: {
        participant: {
          include: {
            user: { select: { name: true, email: true } },
            course: { select: { name: true } },
          },
        },
        licenseAccount: { include: { tool: { select: { name: true } } } },
      },
    }).then((full) => {
      if (!full) return;
      // Soporta tanto reservas de invitado (guestEmail) como de participante con cuenta
      const recipientEmail =
        full.guestEmail ?? full.participant?.user.email ?? null;
      const recipientName =
        full.guestName ?? full.participant?.user.name ?? "";
      const courseName =
        full.participant?.course.name ?? full.licenseAccount.tool.name;
      if (!recipientEmail) return;
      sendCancellationEmail(
        recipientEmail,
        {
          participantName: recipientName,
          courseName,
          toolName: full.licenseAccount.tool.name,
          startsAt: full.startsAt,
          endsAt: full.endsAt,
          reason,
        },
        id,
        full.participantId
      ).catch((err) => console.error("[cancelReservationAdmin] Error enviando email:", err));
    }).catch(() => {/* no-op */});

    // Eliminar evento de Google Calendar (fire-and-forget)
    deleteAdminCalendarEvent(id).catch((err) =>
      console.error("[cancelReservationAdmin] Error eliminando evento calendario:", err)
    );

    revalidatePath("/admin/reservations");
    redirect("/admin/reservations");
  } catch (e) {
    if (isRedirect(e)) throw e;
    const msg = e instanceof Error ? e.message : "Error inesperado";
    redirect(`/admin/reservations?error=${encodeURIComponent(msg)}`);
  }
}
