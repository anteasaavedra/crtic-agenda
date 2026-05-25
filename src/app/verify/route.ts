/**
 * GET /verify?token=HEX_TOKEN
 *
 * Valida el magic link, crea la sesión de participante y redirige a /tools.
 * En caso de error redirige a /login con un query param de error.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSessionToken, SESSION_COOKIE_OPTIONS } from "@/lib/participant-session";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  const loginUrl = (error: string) =>
    new URL(`/login?error=${encodeURIComponent(error)}`, request.url);

  if (!token || !/^[0-9a-f]{64}$/.test(token)) {
    return NextResponse.redirect(loginUrl("enlace_invalido"));
  }

  // Buscar token en BD
  const magicToken = await prisma.magicLinkToken.findUnique({
    where: { token },
  });

  if (!magicToken) {
    return NextResponse.redirect(loginUrl("enlace_invalido"));
  }
  if (magicToken.usedAt) {
    return NextResponse.redirect(loginUrl("enlace_ya_usado"));
  }
  if (magicToken.expiresAt < new Date()) {
    return NextResponse.redirect(loginUrl("enlace_expirado"));
  }

  // Buscar usuario por email
  const user = await prisma.user.findUnique({
    where: { email: magicToken.email },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    return NextResponse.redirect(loginUrl("usuario_no_encontrado"));
  }

  // Verificar que tiene al menos una participación activa
  const hasParticipation = await prisma.participant.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    select: { id: true },
  });

  if (!hasParticipation) {
    return NextResponse.redirect(loginUrl("sin_participaciones_activas"));
  }

  // Marcar token como usado (transacción optimista — ya validado arriba)
  await prisma.magicLinkToken.update({
    where: { id: magicToken.id },
    data: { usedAt: new Date() },
  });

  // Crear cookie de sesión
  const sessionToken = buildSessionToken({ userId: user.id, email: user.email });

  const response = NextResponse.redirect(new URL("/tools", request.url));
  response.cookies.set(SESSION_COOKIE_OPTIONS.name, sessionToken, SESSION_COOKIE_OPTIONS);

  return response;
}
