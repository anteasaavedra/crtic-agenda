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

export async function createTool(formData: FormData) {
  const session = await requireAdmin();

  try {
    const name = (formData.get("name") as string)?.trim();
    const description = (formData.get("description") as string)?.trim() || null;
    const instructionsMd =
      (formData.get("instructionsMd") as string)?.trim() || null;
    const accessUrl = (formData.get("accessUrl") as string)?.trim() || null;
    const defaultSlot = formData.get("defaultSlotMinutes") as string;
    const maxReservation = formData.get("maxReservationMinutes") as string;
    const categoryRaw = (formData.get("category") as string)?.trim();
    const category =
      categoryRaw === "MENTORIA" ? "MENTORIA" : "LICENCIA";

    if (!name) throw new Error("El nombre de la herramienta es requerido");

    const baseSlug = slugify(name);
    let slug = baseSlug;
    let attempt = 0;
    while (await prisma.tool.findUnique({ where: { slug } })) {
      attempt++;
      slug = `${baseSlug}-${attempt}`;
    }

    const tool = await prisma.tool.create({
      data: {
        name,
        slug,
        description,
        instructionsMd,
        accessUrl,
        category,
        defaultSlotMinutes: defaultSlot ? parseInt(defaultSlot) : 120,
        maxReservationMinutes: maxReservation ? parseInt(maxReservation) : 120,
        isActive: true,
      },
    });

    await audit({
      actorId: session.user.id,
      action: "CREATE_TOOL",
      entityType: "Tool",
      entityId: tool.id,
      metadata: { name, slug },
    });

    revalidatePath("/admin/tools");
    redirect("/admin/tools");
  } catch (e) {
    if (isRedirect(e)) throw e;
    const msg = e instanceof Error ? e.message : "Error inesperado";
    redirect(`/admin/tools/new?error=${encodeURIComponent(msg)}`);
  }
}
