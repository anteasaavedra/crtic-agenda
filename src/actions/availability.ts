"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

type RedirectError = Error & { digest?: string };
function isRedirect(e: unknown): e is RedirectError {
  return (e as RedirectError)?.digest?.startsWith("NEXT_REDIRECT") ?? false;
}

// ─── Crear slot de disponibilidad ─────────────────────────────────────────────

export async function createAvailabilitySlot(formData: FormData) {
  const session = await requireAdmin();

  const licenseAccountId = (formData.get("licenseAccountId") as string)?.trim();

  try {
    const date = formData.get("date") as string;       // YYYY-MM-DD
    const startTime = formData.get("startTime") as string; // HH:MM
    const endTime = formData.get("endTime") as string;     // HH:MM
    const isBlocked = formData.get("isBlocked") === "on";
    const reason = (formData.get("reason") as string)?.trim() || null;

    if (!licenseAccountId || !date || !startTime || !endTime) {
      throw new Error("Todos los campos son requeridos");
    }

    // Construir timestamps UTC
    const startsAt = new Date(`${date}T${startTime}:00Z`);
    const endsAt = new Date(`${date}T${endTime}:00Z`);

    if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) {
      throw new Error("Fecha u hora inválida");
    }
    if (startsAt >= endsAt) {
      throw new Error("La hora de inicio debe ser anterior a la de término");
    }

    const durationMin = (endsAt.getTime() - startsAt.getTime()) / 60_000;
    if (durationMin < 30) {
      throw new Error("El bloque debe tener al menos 30 minutos");
    }

    await prisma.availabilitySlot.create({
      data: { licenseAccountId, startsAt, endsAt, isBlocked, reason },
    });

    await audit({
      actorId: session.user.id,
      action: "CREATE_AVAILABILITY_SLOT",
      entityType: "AvailabilitySlot",
      metadata: {
        licenseAccountId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        isBlocked,
        reason,
      },
    });

    revalidatePath(`/admin/availability/${licenseAccountId}`);
    revalidatePath("/admin/availability");
    redirect(`/admin/availability/${licenseAccountId}`);
  } catch (e) {
    if (isRedirect(e)) throw e;

    // Detectar violación del EXCLUDE constraint
    const errText = String(e);
    const msg = errText.includes("AvailabilitySlot_no_overlap")
      ? "Ya existe un slot de disponibilidad que se superpone en ese horario"
      : e instanceof Error
        ? e.message
        : "Error inesperado";

    redirect(
      `/admin/availability/${licenseAccountId}?error=${encodeURIComponent(msg)}`
    );
  }
}

// ─── Generador masivo de slots ────────────────────────────────────────────────

/**
 * Genera slots de disponibilidad en bloque para un rango de fechas.
 * Parámetros del form:
 *   licenseIds[]  — IDs de licencias (puede ser varias)
 *   dateFrom      — YYYY-MM-DD (Chile local)
 *   dateTo        — YYYY-MM-DD (Chile local)
 *   weekdays[]    — 0=Dom, 1=Lun … 6=Sab (días a incluir)
 *   startTime     — HH:MM (hora Chile, se convierte a UTC sumando offset)
 *   endTime       — HH:MM (hora Chile)
 *   slotMinutes   — duración de cada bloque en minutos
 *   utcOffset     — offset en horas (ej. -4 para Chile verano). Default -4.
 *   clearFirst    — "on" → eliminar slots futuros existentes antes de generar
 */
export async function generateAvailabilityBulk(formData: FormData) {
  const session = await requireAdmin();

  try {
    const licenseIds = formData.getAll("licenseIds[]") as string[];
    const dateFrom    = formData.get("dateFrom") as string;
    const dateTo      = formData.get("dateTo") as string;
    const weekdays    = (formData.getAll("weekdays[]") as string[]).map(Number);
    const startTime   = formData.get("startTime") as string; // HH:MM hora Chile
    const endTime     = formData.get("endTime") as string;
    const slotMinutes = parseInt((formData.get("slotMinutes") as string) ?? "90", 10);
    const utcOffset   = parseInt((formData.get("utcOffset") as string) ?? "-4", 10);
    const clearFirst  = formData.get("clearFirst") === "on";

    if (!licenseIds.length || !dateFrom || !dateTo || !weekdays.length || !startTime || !endTime) {
      throw new Error("Todos los campos son requeridos");
    }

    if (slotMinutes < 30 || slotMinutes > 480) {
      throw new Error("El bloque debe ser entre 30 y 480 minutos");
    }

    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    // Minutos desde medianoche Chile
    const startMinutes = sh * 60 + sm;
    const rawEndMinutes = eh * 60 + em;

    // Si hora de término <= hora de inicio → cruza la medianoche (día siguiente)
    const crossesMidnight = rawEndMinutes <= startMinutes;
    const endMinutes = crossesMidnight ? rawEndMinutes + 1440 : rawEndMinutes;

    if (endMinutes - startMinutes < slotMinutes) {
      throw new Error("El rango horario es menor que la duración del bloque");
    }

    // Convertir offset a minutos (negativo → adelantar para pasar a UTC)
    const offsetMin = utcOffset * 60; // ej. -4h → -240 min

    // Iterar fechas
    const from = new Date(dateFrom + "T12:00:00Z");
    const to   = new Date(dateTo   + "T12:00:00Z");

    if (from > to) throw new Error("La fecha inicial debe ser anterior a la final");

    const slotsToCreate: {
      licenseAccountId: string;
      startsAt: Date;
      endsAt: Date;
      isBlocked: boolean;
    }[] = [];

    const cur = new Date(from);
    while (cur <= to) {
      const dow = cur.getUTCDay(); // 0=Dom … 6=Sab
      if (weekdays.includes(dow)) {
        // Generar bloques del día (puede cruzar medianoche)
        let blockStart = startMinutes;
        while (blockStart + slotMinutes <= endMinutes) {
          const blockEnd = blockStart + slotMinutes;

          // Calcular UTC: hora Chile → UTC = Chile - offset
          // setUTCHours acepta valores > 23 y desborda al día siguiente automáticamente
          const startUtcMin = blockStart - offsetMin;
          const endUtcMin   = blockEnd   - offsetMin;

          const startsAt = new Date(cur);
          startsAt.setUTCHours(
            Math.floor(startUtcMin / 60),
            startUtcMin % 60,
            0, 0
          );
          const endsAt = new Date(cur);
          endsAt.setUTCHours(
            Math.floor(endUtcMin / 60),
            endUtcMin % 60,
            0, 0
          );

          for (const licenseAccountId of licenseIds) {
            slotsToCreate.push({ licenseAccountId, startsAt, endsAt, isBlocked: false });
          }

          blockStart = blockEnd;
        }
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    if (slotsToCreate.length === 0) {
      throw new Error("No se generaron slots. Verifica el rango de fechas y los días seleccionados.");
    }

    // Borrar slots futuros existentes si se pidió
    if (clearFirst) {
      await prisma.availabilitySlot.deleteMany({
        where: {
          licenseAccountId: { in: licenseIds },
          startsAt: { gte: from },
          endsAt: { lte: new Date(to.getTime() + 24 * 60 * 60 * 1000) },
        },
      });
    }

    // Insertar en batch, ignorando duplicados
    await prisma.availabilitySlot.createMany({
      data: slotsToCreate,
      skipDuplicates: true,
    });

    await audit({
      actorId: session.user.id,
      action: "BULK_GENERATE_AVAILABILITY",
      entityType: "AvailabilitySlot",
      metadata: {
        licenseIds,
        dateFrom,
        dateTo,
        weekdays,
        startTime,
        endTime,
        slotMinutes,
        utcOffset,
        clearFirst,
        slotsCreated: slotsToCreate.length,
      },
    });

    revalidatePath("/admin/availability");
    redirect(`/admin/availability?success=${slotsToCreate.length}`);
  } catch (e) {
    if (isRedirect(e)) throw e;
    const msg = e instanceof Error ? e.message : "Error inesperado";
    redirect(`/admin/availability?error=${encodeURIComponent(msg)}`);
  }
}

// ─── Eliminar slot de disponibilidad ─────────────────────────────────────────

export async function deleteAvailabilitySlot(formData: FormData) {
  const session = await requireAdmin();

  const licenseAccountId = (formData.get("licenseAccountId") as string)?.trim();

  try {
    const id = formData.get("id") as string;
    if (!id || !licenseAccountId) throw new Error("Datos incompletos");

    await prisma.availabilitySlot.delete({ where: { id } });

    await audit({
      actorId: session.user.id,
      action: "DELETE_AVAILABILITY_SLOT",
      entityType: "AvailabilitySlot",
      entityId: id,
      metadata: { licenseAccountId },
    });

    revalidatePath(`/admin/availability/${licenseAccountId}`);
    revalidatePath("/admin/availability");
    redirect(`/admin/availability/${licenseAccountId}`);
  } catch (e) {
    if (isRedirect(e)) throw e;
    redirect(
      `/admin/availability/${licenseAccountId}?error=Error+al+eliminar+el+slot`
    );
  }
}
