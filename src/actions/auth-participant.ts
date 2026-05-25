"use server";

/**
 * Acciones de servidor relacionadas con la autenticación de participantes.
 *
 * requestMagicLink  — pública: solicita un magic link para un email.
 * generateMagicLinkAdmin — solo admin: genera un link de prueba y lo muestra en /admin/magic-links.
 */

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { createMagicLinkToken, buildMagicLinkUrl } from "@/lib/magic-link";
import { sendMagicLinkEmail } from "@/lib/email";
import { rateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";

// ─── Solicitar magic link (pública) ──────────────────────────────────────────

export async function requestMagicLink(formData: FormData) {
  const email = (formData.get("email") as string)?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/login?error=email_invalido");
  }

  // Rate limit por IP: 5 solicitudes cada 15 minutos
  const ip = await getClientIp();
  const { allowed } = rateLimit(
    `magic-link:${ip}`,
    RATE_LIMITS.MAGIC_LINK.max,
    RATE_LIMITS.MAGIC_LINK.windowMs
  );
  if (!allowed) redirect("/login?error=demasiados_intentos");

  // Por seguridad siempre mostramos el mismo mensaje, sin revelar si el email existe.
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (user) {
    const hasActive = await prisma.participant.findFirst({
      where: { userId: user.id, status: "ACTIVE" },
      select: { id: true },
    });

    if (hasActive) {
      const token = await createMagicLinkToken(email);
      const url = buildMagicLinkUrl(token);
      // No-throw: si el envío falla, el usuario igual ve "enlace enviado"
      // para no revelar si el email existe o no
      await sendMagicLinkEmail(email, url).catch((err) =>
        console.error("[requestMagicLink] Error enviando email:", err)
      );
    }
  }

  redirect("/login?sent=1");
}

// ─── Generar link de prueba (solo admin) ─────────────────────────────────────

export async function generateMagicLinkAdmin(formData: FormData) {
  await requireAdmin();

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  if (!email) redirect("/admin/magic-links?error=email_requerido");

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) redirect(`/admin/magic-links?error=usuario_no_encontrado`);

  const hasActive = await prisma.participant.findFirst({
    where: { userId: user!.id, status: "ACTIVE" },
    select: { id: true },
  });

  if (!hasActive) {
    redirect(`/admin/magic-links?error=sin_participaciones_activas`);
  }

  const token = await createMagicLinkToken(email);
  const url = buildMagicLinkUrl(token);

  // Redirigimos de vuelta a la página con el link visible (solo admin)
  redirect(
    `/admin/magic-links?preview=${encodeURIComponent(url)}&email=${encodeURIComponent(email)}`
  );
}
