"use server";

/**
 * Acciones de servidor para la integración con Google Calendar.
 *
 * initiateGoogleAuth    — inicia el flujo OAuth (redirige a Google).
 * disconnectGoogleAccount — desconecta la cuenta de Google del admin.
 * saveCalendarId        — guarda el calendario seleccionado por el admin.
 */

import crypto from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getAuthorizationUrl } from "@/lib/google-calendar";

const OAUTH_STATE_COOKIE = "google_oauth_state";

// ─── Iniciar OAuth ────────────────────────────────────────────────────────────

export async function initiateGoogleAuth() {
  await requireAdmin();

  const state = crypto.randomBytes(16).toString("hex");
  const cookieStore = await cookies();

  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   10 * 60, // 10 minutos
    path:     "/",
  });

  redirect(getAuthorizationUrl(state));
}

// ─── Desconectar cuenta de Google ────────────────────────────────────────────

export async function disconnectGoogleAccount() {
  const session = await requireAdmin();

  try {
    await prisma.googleAccount.delete({
      where: { userId: session.user.id },
    });

    await audit({
      actorId:    session.user.id,
      action:     "DISCONNECT_GOOGLE",
      entityType: "GoogleAccount",
      entityId:   session.user.id,
    });
  } catch {
    // Si no existe, no es un error
  }

  revalidatePath("/admin/settings");
  redirect("/admin/settings?success=google_disconnected");
}

// ─── Guardar calendario seleccionado ─────────────────────────────────────────

export async function saveCalendarId(formData: FormData) {
  const session = await requireAdmin();

  const calendarId = (formData.get("calendarId") as string)?.trim();
  if (!calendarId) redirect("/admin/settings?error=calendar_requerido");

  await prisma.googleAccount.update({
    where: { userId: session.user.id },
    data:  { calendarId },
  });

  revalidatePath("/admin/settings");
  redirect("/admin/settings?success=calendar_guardado");
}
