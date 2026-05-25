/**
 * Magic link tokens para autenticación de participantes.
 *
 * - Token: 32 bytes aleatorios en hex (64 caracteres).
 * - Expiración: 15 minutos.
 * - Un solo uso (se marca usedAt al validar).
 * - Al crear un nuevo token para un email, se eliminan los anteriores no usados.
 */

import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const TOKEN_EXPIRY_MINUTES = 15;

// ─── Crear token ─────────────────────────────────────────────────────────────

export async function createMagicLinkToken(email: string): Promise<string> {
  // Limpiar tokens anteriores no usados para este email
  await prisma.magicLinkToken.deleteMany({
    where: { email, usedAt: null },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60_000);

  await prisma.magicLinkToken.create({
    data: { email, token, expiresAt },
  });

  return token;
}

// ─── Construir URL ───────────────────────────────────────────────────────────

export function buildMagicLinkUrl(token: string): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.NODE_ENV === "production"
      ? "https://agenda.crtic.cl"
      : "http://localhost:3000");
  return `${baseUrl}/verify?token=${token}`;
}

// ─── Validar y consumir token ─────────────────────────────────────────────────
// Nota: la validación completa (buscar en DB, marcar usedAt, etc.)
// se hace en /verify/route.ts para poder setear la cookie en la respuesta HTTP.
