"use server";

/**
 * Acciones de servidor para gestión de links públicos de reserva.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { generateShareToken } from "@/lib/share-links";

type RedirectError = Error & { digest?: string };
function isRedirect(e: unknown): e is RedirectError {
  return (e as RedirectError)?.digest?.startsWith("NEXT_REDIRECT") ?? false;
}

/**
 * Crea un nuevo link público de reserva para una herramienta.
 */
export async function createShareLink(formData: FormData) {
  const session = await requireAdmin();

  try {
    const licenseAccountId = (formData.get("licenseAccountId") as string)?.trim() || null;
    const label = (formData.get("label") as string)?.trim();
    const expiresAtStr = (formData.get("expiresAt") as string)?.trim();

    if (!licenseAccountId || !label) {
      throw new Error("Licencia y etiqueta son requeridos");
    }

    // Obtener herramienta desde la licencia seleccionada
    const licenseAccount = await prisma.licenseAccount.findUnique({
      where: { id: licenseAccountId },
      include: { tool: true },
    });
    if (!licenseAccount) throw new Error("Licencia no encontrada");
    if (!licenseAccount.isActive) throw new Error("La licencia no está activa");

    const toolId = licenseAccount.toolId;

    const token = generateShareToken();
    let expiresAt: Date | null = null;
    if (expiresAtStr) {
      expiresAt = new Date(expiresAtStr);
      if (expiresAt < new Date()) {
        throw new Error("La fecha de expiración debe ser en el futuro");
      }
    }

    const shareLink = await prisma.shareLink.create({
      data: {
        toolId,
        licenseAccountId,
        token,
        label,
        expiresAt,
        maxPerWeekEmail: 3,
        cancelCutoffHrs: 1,
      },
    });

    await audit({
      actorId: session.user.id,
      action: "CREATE_SHARE_LINK",
      entityType: "ShareLink",
      entityId: shareLink.id,
      metadata: {
        toolId,
        toolName: licenseAccount.tool.name,
        licenseAccountId,
        licenseLabel: licenseAccount.label,
        label,
        token: token.substring(0, 8) + "...",
        expiresAt: expiresAt?.toISOString(),
      },
    });

    revalidatePath("/admin/share-links");
    redirect(`/admin/share-links?success=${shareLink.id}`);
  } catch (e) {
    if (isRedirect(e)) throw e;
    const msg = e instanceof Error ? e.message : "Error inesperado";
    redirect(`/admin/share-links?error=${encodeURIComponent(msg)}`);
  }
}

/**
 * Revoca (desactiva) un link de reserva existente.
 */
export async function revokeShareLink(formData: FormData) {
  const session = await requireAdmin();

  try {
    const id = formData.get("id") as string;
    if (!id) throw new Error("ID requerido");

    const link = await prisma.shareLink.findUnique({
      where: { id },
    });
    if (!link) throw new Error("Link no encontrado");

    await prisma.shareLink.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    await audit({
      actorId: session.user.id,
      action: "REVOKE_SHARE_LINK",
      entityType: "ShareLink",
      entityId: id,
      metadata: { label: link.label },
    });

    revalidatePath("/admin/share-links");
    redirect("/admin/share-links?success=revoked");
  } catch (e) {
    if (isRedirect(e)) throw e;
    redirect("/admin/share-links?error=Error+al+revocar+link");
  }
}

/**
 * Reactiva un link que fue revocado.
 */
export async function reactivateShareLink(formData: FormData) {
  const session = await requireAdmin();

  try {
    const id = formData.get("id") as string;
    if (!id) throw new Error("ID requerido");

    const link = await prisma.shareLink.findUnique({
      where: { id },
    });
    if (!link) throw new Error("Link no encontrado");

    await prisma.shareLink.update({
      where: { id },
      data: { revokedAt: null },
    });

    await audit({
      actorId: session.user.id,
      action: "REACTIVATE_SHARE_LINK",
      entityType: "ShareLink",
      entityId: id,
      metadata: { label: link.label },
    });

    revalidatePath("/admin/share-links");
    redirect("/admin/share-links?success=reactivated");
  } catch (e) {
    if (isRedirect(e)) throw e;
    redirect("/admin/share-links?error=Error+al+reactivar+link");
  }
}

/**
 * Elimina un link permanentemente.
 */
export async function deleteShareLink(formData: FormData) {
  const session = await requireAdmin();

  try {
    const id = formData.get("id") as string;
    if (!id) throw new Error("ID requerido");

    const link = await prisma.shareLink.findUnique({
      where: { id },
    });
    if (!link) throw new Error("Link no encontrado");

    // Borrar todas las reservas asociadas al link
    await prisma.reservation.deleteMany({
      where: { shareLinkId: id },
    });

    await prisma.shareLink.delete({
      where: { id },
    });

    await audit({
      actorId: session.user.id,
      action: "DELETE_SHARE_LINK",
      entityType: "ShareLink",
      entityId: id,
      metadata: { label: link.label, reservasDeleted: true },
    });

    revalidatePath("/admin/share-links");
    redirect("/admin/share-links?success=deleted");
  } catch (e) {
    if (isRedirect(e)) throw e;
    redirect("/admin/share-links?error=Error+al+eliminar+link");
  }
}
