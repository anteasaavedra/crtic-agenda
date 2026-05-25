"use server";

/**
 * Acciones de servidor para gestión de credenciales semanales.
 *
 * SEGURIDAD CRÍTICA:
 * - El campo `password` de los formData NUNCA se incluye en AuditLog ni en logs.
 * - Solo se registra: licenseAccountId, isoYear, isoWeek, username.
 * - El cifrado ocurre en el servidor antes de que el dato toque Prisma.
 * - El descifrado solo ocurre en server components autenticados como ADMIN.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { encrypt } from "@/lib/encryption";
import { getISOWeekBounds } from "@/lib/iso-week";

type RedirectError = Error & { digest?: string };
function isRedirect(e: unknown): e is RedirectError {
  return (e as RedirectError)?.digest?.startsWith("NEXT_REDIRECT") ?? false;
}

export async function upsertCredential(formData: FormData) {
  const session = await requireAdmin();

  try {
    const licenseAccountId = (
      formData.get("licenseAccountId") as string
    )?.trim();
    const isoYear = parseInt(formData.get("isoYear") as string);
    const isoWeek = parseInt(formData.get("isoWeek") as string);
    const username = (formData.get("username") as string)?.trim();
    // password: se lee, se cifra, y NO se vuelve a usar después de cifrar
    const password = formData.get("password") as string;

    // Validaciones
    if (!licenseAccountId || !username || !password) {
      throw new Error("Todos los campos son requeridos");
    }
    if (isNaN(isoYear) || isNaN(isoWeek)) {
      throw new Error("Año y semana deben ser números válidos");
    }
    if (isoWeek < 1 || isoWeek > 53) {
      throw new Error("La semana ISO debe estar entre 1 y 53");
    }
    if (isoYear < 2020 || isoYear > 2099) {
      throw new Error("El año debe estar entre 2020 y 2099");
    }

    // Verificar licencia
    const license = await prisma.licenseAccount.findUnique({
      where: { id: licenseAccountId },
    });
    if (!license) throw new Error("Licencia no encontrada");

    // Calcular validez de la semana
    const { from, until } = getISOWeekBounds(isoYear, isoWeek);

    // Cifrar ANTES de cualquier log o persistencia
    const usernameEncrypted = encrypt(username);
    const passwordEncrypted = encrypt(password);
    // A partir de aquí `password` no se usa más.

    await prisma.weeklyCredential.upsert({
      where: {
        licenseAccountId_isoYear_isoWeek: {
          licenseAccountId,
          isoYear,
          isoWeek,
        },
      },
      update: {
        usernameEncrypted,
        passwordEncrypted,
        encryptionKeyVersion: 1,
        validFrom: from,
        validUntil: until,
        createdById: session.user.id,
        createdAt: new Date(), // refleja la última actualización
      },
      create: {
        licenseAccountId,
        isoYear,
        isoWeek,
        validFrom: from,
        validUntil: until,
        usernameEncrypted,
        passwordEncrypted,
        encryptionKeyVersion: 1,
        createdById: session.user.id,
      },
    });

    // Auditoría: incluir username (no es secreto), NUNCA password
    await audit({
      actorId: session.user.id,
      action: "UPSERT_CREDENTIAL",
      entityType: "WeeklyCredential",
      metadata: {
        licenseAccountId,
        licenseLabel: license.label,
        isoYear,
        isoWeek,
        username,
        // password: deliberadamente omitido
      },
    });

    revalidatePath("/admin/credentials");
    redirect("/admin/credentials");
  } catch (e) {
    if (isRedirect(e)) throw e;
    const msg = e instanceof Error ? e.message : "Error inesperado";
    redirect(`/admin/credentials?error=${encodeURIComponent(msg)}`);
  }
}

export async function deleteCredential(formData: FormData) {
  const session = await requireAdmin();

  try {
    const id = formData.get("id") as string;
    if (!id) throw new Error("ID requerido");

    const cred = await prisma.weeklyCredential.findUnique({ where: { id } });
    if (!cred) throw new Error("Credencial no encontrada");

    await prisma.weeklyCredential.delete({ where: { id } });

    await audit({
      actorId: session.user.id,
      action: "DELETE_CREDENTIAL",
      entityType: "WeeklyCredential",
      entityId: id,
      metadata: {
        licenseAccountId: cred.licenseAccountId,
        isoYear: cred.isoYear,
        isoWeek: cred.isoWeek,
      },
    });

    revalidatePath("/admin/credentials");
    redirect("/admin/credentials");
  } catch (e) {
    if (isRedirect(e)) throw e;
    redirect("/admin/credentials?error=Error+al+eliminar+credencial");
  }
}
