/**
 * GET /admin/google/callback
 *
 * Callback OAuth de Google Calendar.
 * Ruta protegida por el middleware de admin (el usuario debe estar autenticado).
 *
 * Registrar esta URL en Google Cloud Console:
 *   https://console.cloud.google.com/apis/credentials
 *   → OAuth 2.0 Client IDs → URIs de redirección autorizadas
 *   → Agregar: https://<DOMINIO>/admin/google/callback
 *
 * Variable de entorno: GOOGLE_REDIRECT_URI=https://<DOMINIO>/admin/google/callback
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { encrypt } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";
import { exchangeCode } from "@/lib/google-calendar";

const OAUTH_STATE_COOKIE = "google_oauth_state";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const settingsUrl = (param?: string, value?: string) => {
    const url = new URL("/admin/settings", request.url);
    if (param && value) url.searchParams.set(param, value);
    return NextResponse.redirect(url);
  };

  // Acceso denegado por el usuario en el consent screen
  if (error === "access_denied") return settingsUrl("error", "google_denied");
  if (error) return settingsUrl("error", "google_error");

  if (!code || !state) return settingsUrl("error", "callback_invalido");

  // Verificar state para prevenir CSRF
  const cookieStore = await cookies();
  const storedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;

  if (!storedState || storedState !== state) {
    return settingsUrl("error", "state_invalido");
  }

  // Limpiar cookie de estado
  cookieStore.delete(OAUTH_STATE_COOKIE);

  // Verificar sesión de admin
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  try {
    const tokens = await exchangeCode(code);

    await prisma.googleAccount.upsert({
      where:  { userId: session.user.id },
      create: {
        userId:                session.user.id,
        accessTokenEncrypted:  encrypt(tokens.accessToken),
        refreshTokenEncrypted: encrypt(tokens.refreshToken),
        scope:                 "https://www.googleapis.com/auth/calendar",
        expiryDate:            tokens.expiryDate,
        calendarId:            "primary",
      },
      update: {
        accessTokenEncrypted:  encrypt(tokens.accessToken),
        refreshTokenEncrypted: encrypt(tokens.refreshToken),
        expiryDate:            tokens.expiryDate,
        lastRefreshedAt:       new Date(),
      },
    });

    return settingsUrl("success", "google_connected");
  } catch (err) {
    console.error("[google/callback] Error intercambiando código:", err);
    return settingsUrl("error", "exchange_failed");
  }
}
