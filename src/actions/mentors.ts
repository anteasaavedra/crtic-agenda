"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { isRedirect } from "@/lib/utils";

export async function createMentor(formData: FormData) {
  const session = await requireAdmin();

  try {
    const toolId       = formData.get("toolId") as string;
    const label        = (formData.get("label") as string)?.trim();
    const accountEmail = (formData.get("accountEmail") as string)?.trim() || null;
    const notes        = (formData.get("notes") as string)?.trim() || null;

    if (!toolId || !label) throw new Error("Área y nombre son requeridos");
    if (!accountEmail)     throw new Error("El email Google del mentor es requerido");

    const tool = await prisma.tool.findUnique({ where: { id: toolId } });
    if (!tool || tool.category !== "MENTORIA") throw new Error("Área de mentoría no válida");

    const mentor = await prisma.licenseAccount.create({
      data: { toolId, label, accountEmail, notes, isActive: true },
    });

    await audit({
      actorId:    session.user.id,
      action:     "CREATE_MENTOR",
      entityType: "LicenseAccount",
      entityId:   mentor.id,
      metadata:   { toolId, label, accountEmail },
    });

    revalidatePath("/admin/mentores");
    redirect("/admin/mentores");
  } catch (e) {
    if (isRedirect(e)) throw e;
    const msg = e instanceof Error ? e.message : "Error inesperado";
    redirect(`/admin/mentores/new?error=${encodeURIComponent(msg)}`);
  }
}

export async function toggleMentorStatus(formData: FormData) {
  const session = await requireAdmin();

  try {
    const id      = formData.get("id") as string;
    const current = formData.get("isActive") === "true";
    if (!id) throw new Error("ID requerido");

    await prisma.licenseAccount.update({
      where: { id },
      data:  { isActive: !current },
    });

    await audit({
      actorId:    session.user.id,
      action:     current ? "DEACTIVATE_MENTOR" : "ACTIVATE_MENTOR",
      entityType: "LicenseAccount",
      entityId:   id,
    });

    revalidatePath("/admin/mentores");
    redirect("/admin/mentores");
  } catch (e) {
    if (isRedirect(e)) throw e;
    redirect("/admin/mentores?error=Error+al+cambiar+estado");
  }
}
