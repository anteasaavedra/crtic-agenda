/**
 * Sesión de participante — cookie firmada con HMAC-SHA256.
 *
 * Independiente de NextAuth (que solo maneja admins).
 * Cookie: "participant_session" (httpOnly, SameSite=lax, 7 días).
 *
 * Formato del token: BASE64URL(payload) + "." + HEX(HMAC-SHA256)
 */

import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "participant_session";
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 días

export interface ParticipantSessionData {
  userId: string;
  email: string;
}

// ─── Firma ───────────────────────────────────────────────────────────────────

function getSecret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET no configurado");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

// ─── Serialización ───────────────────────────────────────────────────────────

export function buildSessionToken(data: ParticipantSessionData): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function parseSessionToken(token: string): ParticipantSessionData | null {
  const dotIndex = token.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const payload = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);

  const expected = sign(payload);

  // Comparación en tiempo constante
  const aBuf = Buffer.from(expected);
  const bBuf = Buffer.from(signature);
  if (aBuf.length !== bBuf.length) return null;
  if (!crypto.timingSafeEqual(aBuf, bBuf)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.userId || !data.email) return null;
    return data as ParticipantSessionData;
  } catch {
    return null;
  }
}

// ─── Cookie helpers ──────────────────────────────────────────────────────────

export async function getParticipantSession(): Promise<ParticipantSessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return parseSessionToken(token);
}

/**
 * Para usar en server components protegidos.
 * Redirige a /login si no hay sesión válida.
 */
export async function requireParticipantSession(): Promise<ParticipantSessionData> {
  const session = await getParticipantSession();
  if (!session) redirect("/login");
  return session;
}

// ─── Constantes de cookie exportadas para route handlers ─────────────────────

export const SESSION_COOKIE_OPTIONS = {
  name: COOKIE_NAME,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: MAX_AGE_SECONDS,
  path: "/",
};
