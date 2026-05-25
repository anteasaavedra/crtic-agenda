/**
 * Funciones para generar y validar links públicos de reserva.
 *
 * Un ShareLink es un token criptográfico que permite:
 * - Acceso público a la página de reserva de una herramienta
 * - Booking directo sin autenticación (solo nombre + email)
 * - Rastreo de reservas por referencia al link
 */

import crypto from "crypto";
import { prisma } from "./prisma";

const TOKEN_BYTES = 32; // 256 bits

/**
 * Genera un token aleatorio de 32 bytes en hex (256 bits).
 */
export function generateShareToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString("hex");
}

/**
 * Busca y valida un ShareLink activo por token.
 * Devuelve null si:
 * - No existe
 * - Está revocado
 * - Ha expirado
 * - La herramienta no está activa
 */
export async function getActiveShareLink(token: string) {
  const link = await prisma.shareLink.findUnique({
    where: { token },
    include: {
      tool: true,
    },
  });

  if (!link) return null;
  if (!link.isActive || link.revokedAt) return null;
  if (link.expiresAt && link.expiresAt < new Date()) return null;
  if (!link.tool.isActive) return null;

  return link;
}

/**
 * Obtiene disponibilidad para una herramienta (used by public booking page).
 * Si se pasa licenseAccountId, solo muestra slots de esa licencia específica.
 */
export async function getToolAvailability(
  toolId: string,
  date: string,
  licenseAccountId?: string | null
) {
  const tool = await prisma.tool.findUnique({
    where: { id: toolId },
    include: {
      licenses: {
        where: {
          isActive: true,
          // Si el link está fijado a una licencia específica, filtrar
          ...(licenseAccountId ? { id: licenseAccountId } : {}),
        },
      },
    },
  });

  if (!tool) return null;

  const [year, month, day] = date.split("-").map(Number);
  const dateObj = new Date(year, month - 1, day);
  const startOfDay = new Date(dateObj);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(dateObj);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const slots = [];

  for (const license of tool.licenses) {
    const availability = await prisma.availabilitySlot.findMany({
      where: {
        licenseAccountId: license.id,
        startsAt: { gte: startOfDay, lte: endOfDay },
        isBlocked: false,
      },
      orderBy: { startsAt: "asc" },
    });

    for (const slot of availability) {
      const reserved = await prisma.reservation.findFirst({
        where: {
          licenseAccountId: license.id,
          startsAt: { gte: slot.startsAt, lt: slot.endsAt },
          status: { in: ["CONFIRMED"] },
        },
      });

      if (!reserved) {
        slots.push({
          startsAt: slot.startsAt.toISOString(),
          endsAt: slot.endsAt.toISOString(),
          licenseAccountId: license.id,
        });
      }
    }
  }

  return { tool, slots };
}

/**
 * Verifica si un email ha alcanzado el límite de reservas esta semana para un link.
 */
export async function checkWeeklyEmailLimit(
  shareLinkId: string,
  guestEmail: string
) {
  const link = await prisma.shareLink.findUnique({
    where: { id: shareLinkId },
  });
  if (!link) return false;

  // ISO week start/end
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const diff = now.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // adjust for Sunday
  const weekStart = new Date(now.setUTCDate(diff));
  weekStart.setUTCHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  const count = await prisma.reservation.count({
    where: {
      shareLinkId,
      guestEmail,
      createdAt: { gte: weekStart, lte: weekEnd },
      status: "CONFIRMED",
    },
  });

  return count < link.maxPerWeekEmail;
}

/**
 * Hash HMAC del token de cancelación (para validar en el endpoint sin almacenar plaintext).
 */
export function hashCancelToken(token: string): string {
  return crypto
    .createHmac("sha256", process.env.PARTICIPANT_SESSION_SECRET || "")
    .update(token)
    .digest("hex");
}

/**
 * Genera un token de cancelación para incluir en el email.
 */
export function generateCancelToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
