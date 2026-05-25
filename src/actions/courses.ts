"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/utils";

type RedirectError = Error & { digest?: string };

function isRedirect(e: unknown): e is RedirectError {
  return (e as RedirectError)?.digest?.startsWith("NEXT_REDIRECT") ?? false;
}

// ─── Crear curso ──────────────────────────────────────────────────────────────

export async function createCourse(formData: FormData) {
  const session = await requireAdmin();

  try {
    const name = (formData.get("name") as string)?.trim();
    const description = (formData.get("description") as string)?.trim() || null;
    const startsOn = formData.get("startsOn") as string;
    const endsOn = formData.get("endsOn") as string;
    const maxPerWeek = formData.get("maxReservationsPerWeek") as string;
    const maxPerDay = formData.get("maxReservationsPerDay") as string;
    const windowDays = formData.get("reservationWindowDays") as string;
    const allowCancel = formData.get("allowCancellation") === "on";
    const cutoffHours = formData.get("cancellationCutoffHours") as string;

    if (!name || !startsOn || !endsOn) {
      throw new Error("Nombre, fecha de inicio y fecha de término son requeridos");
    }
    if (new Date(startsOn) >= new Date(endsOn)) {
      throw new Error("La fecha de inicio debe ser anterior a la de término");
    }

    const baseSlug = slugify(name);
    // Asegurar unicidad del slug añadiendo un sufijo numérico si es necesario
    let slug = baseSlug;
    let attempt = 0;
    while (await prisma.course.findUnique({ where: { slug } })) {
      attempt++;
      slug = `${baseSlug}-${attempt}`;
    }

    const course = await prisma.course.create({
      data: {
        name,
        slug,
        description,
        startsOn: new Date(startsOn),
        endsOn: new Date(endsOn),
        maxReservationsPerWeek: maxPerWeek ? parseInt(maxPerWeek) : null,
        maxReservationsPerDay: maxPerDay ? parseInt(maxPerDay) : null,
        reservationWindowDays: windowDays ? parseInt(windowDays) : 14,
        allowCancellation: allowCancel,
        cancellationCutoffHours: cutoffHours ? parseInt(cutoffHours) : 2,
        createdById: session.user.id,
      },
    });

    await audit({
      actorId: session.user.id,
      action: "CREATE_COURSE",
      entityType: "Course",
      entityId: course.id,
      metadata: { name, slug },
    });

    revalidatePath("/admin/courses");
    redirect("/admin/courses");
  } catch (e) {
    if (isRedirect(e)) throw e;
    const msg = e instanceof Error ? e.message : "Error inesperado";
    redirect(`/admin/courses/new?error=${encodeURIComponent(msg)}`);
  }
}

// ─── Asociar herramienta a curso ──────────────────────────────────────────────

export async function addToolToCourse(formData: FormData) {
  const session = await requireAdmin();

  try {
    const courseId = formData.get("courseId") as string;
    const toolId = formData.get("toolId") as string;

    if (!courseId || !toolId) throw new Error("Datos incompletos");

    await prisma.courseTool.create({ data: { courseId, toolId } });

    await audit({
      actorId: session.user.id,
      action: "ADD_TOOL_TO_COURSE",
      entityType: "CourseTool",
      metadata: { courseId, toolId },
    });

    revalidatePath(`/admin/courses/${courseId}`);
    redirect(`/admin/courses/${courseId}`);
  } catch (e) {
    if (isRedirect(e)) throw e;
    const msg = e instanceof Error ? e.message : "Error inesperado";
    const courseId = formData.get("courseId") as string;
    redirect(
      `/admin/courses/${courseId}?error=${encodeURIComponent(msg)}`
    );
  }
}

// ─── Quitar herramienta de curso ──────────────────────────────────────────────

export async function removeToolFromCourse(formData: FormData) {
  const session = await requireAdmin();

  try {
    const courseId = formData.get("courseId") as string;
    const toolId = formData.get("toolId") as string;

    if (!courseId || !toolId) throw new Error("Datos incompletos");

    await prisma.courseTool.delete({
      where: { courseId_toolId: { courseId, toolId } },
    });

    await audit({
      actorId: session.user.id,
      action: "REMOVE_TOOL_FROM_COURSE",
      entityType: "CourseTool",
      metadata: { courseId, toolId },
    });

    revalidatePath(`/admin/courses/${courseId}`);
    redirect(`/admin/courses/${courseId}`);
  } catch (e) {
    if (isRedirect(e)) throw e;
    const courseId = formData.get("courseId") as string;
    redirect(`/admin/courses/${courseId}?error=Error+al+quitar+herramienta`);
  }
}
