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

export async function createLicense(formData: FormData) {
  const session = await requireAdmin();

  try {
    const toolId = formData.get("toolId") as string;
    const label = (formData.get("label") as string)?.trim();
    const accountEmail =
      (formData.get("accountEmail") as string)?.trim() || null;
    const notes = (formData.get("notes") as string)?.trim() || null;

    if (!toolId || !label) {
      throw new Error("Herramienta y etiqueta son requeridos");
    }

    // Verificar que la herramienta existe y está activa
    const tool = await prisma.tool.findUnique({ where: { id: toolId } });
    if (!tool) throw new Error("Herramienta no encontrada");

    const license = await prisma.licenseAccount.create({
      data: { toolId, label, accountEmail, notes, isActive: true },
    });

    await audit({
      actorId: session.user.id,
      action: "CREATE_LICENSE",
      entityType: "LicenseAccount",
      entityId: license.id,
      metadata: { toolId, label, accountEmail },
    });

    revalidatePath("/admin/licenses");
    redirect("/admin/licenses");
  } catch (e) {
    if (isRedirect(e)) throw e;
    const msg = e instanceof Error ? e.message : "Error inesperado";
    redirect(`/admin/licenses/new?error=${encodeURIComponent(msg)}`);
  }
}

export async function toggleLicenseStatus(formData: FormData) {
  const session = await requireAdmin();

  try {
    const id = formData.get("id") as string;
    const current = formData.get("isActive") === "true";
    if (!id) throw new Error("ID de licencia requerido");

    await prisma.licenseAccount.update({
      where: { id },
      data: { isActive: !current },
    });

    await audit({
      actorId: session.user.id,
      action: current ? "DEACTIVATE_LICENSE" : "ACTIVATE_LICENSE",
      entityType: "LicenseAccount",
      entityId: id,
    });

    revalidatePath("/admin/licenses");
    redirect("/admin/licenses");
  } catch (e) {
    if (isRedirect(e)) throw e;
    redirect("/admin/licenses?error=Error+al+cambiar+estado");
  }
}
