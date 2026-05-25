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

export async function createParticipant(formData: FormData) {
  const session = await requireAdmin();

  try {
    const courseId = formData.get("courseId") as string;
    const email = (formData.get("email") as string)?.trim().toLowerCase();
    const name = (formData.get("name") as string)?.trim();

    if (!courseId || !email || !name) {
      throw new Error("Curso, email y nombre son requeridos");
    }

    // Validar email básico
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("El email no tiene un formato válido");
    }

    // Verificar que el curso existe
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new Error("Curso no encontrado");

    // Upsert del User (puede existir de otro curso)
    const user = await prisma.user.upsert({
      where: { email },
      update: { name }, // actualizar nombre si cambia
      create: { email, name, role: "PARTICIPANT" },
    });

    // Verificar si ya es participante de este curso
    const existing = await prisma.participant.findUnique({
      where: { courseId_userId: { courseId, userId: user.id } },
    });
    if (existing) {
      throw new Error(`${email} ya es participante de este curso`);
    }

    const participant = await prisma.participant.create({
      data: { courseId, userId: user.id, status: "ACTIVE" },
    });

    await audit({
      actorId: session.user.id,
      action: "CREATE_PARTICIPANT",
      entityType: "Participant",
      entityId: participant.id,
      metadata: { courseId, userId: user.id, email, name },
    });

    revalidatePath("/admin/participants");
    revalidatePath(`/admin/courses/${courseId}`);
    redirect("/admin/participants");
  } catch (e) {
    if (isRedirect(e)) throw e;
    const msg = e instanceof Error ? e.message : "Error inesperado";
    redirect(`/admin/participants/new?error=${encodeURIComponent(msg)}`);
  }
}

export async function updateParticipantStatus(formData: FormData) {
  const session = await requireAdmin();

  try {
    const id = formData.get("id") as string;
    const status = formData.get("status") as
      | "ACTIVE"
      | "SUSPENDED"
      | "REMOVED";

    if (!id || !status) throw new Error("Datos incompletos");

    const participant = await prisma.participant.update({
      where: { id },
      data: { status },
    });

    await audit({
      actorId: session.user.id,
      action: "UPDATE_PARTICIPANT_STATUS",
      entityType: "Participant",
      entityId: id,
      metadata: { status, courseId: participant.courseId },
    });

    revalidatePath("/admin/participants");
    redirect("/admin/participants");
  } catch (e) {
    if (isRedirect(e)) throw e;
    redirect("/admin/participants?error=Error+al+actualizar+participante");
  }
}
