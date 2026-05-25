/**
 * Rate limiter en memoria — ventana fija (fixed window).
 *
 * Apropiado para despliegues en un solo servidor.
 * Para entornos multi-instancia (ej. Vercel con múltiples serverless functions),
 * reemplazar por @upstash/ratelimit + @upstash/redis.
 *
 * Uso en Server Actions:
 *   const ip = await getClientIp();
 *   const { allowed } = rateLimit(`magic-link:${ip}`, 5, 15 * 60 * 1000);
 *   if (!allowed) redirect("/login?error=demasiados_intentos");
 */

import { headers } from "next/headers";

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

// Limpia entradas expiradas cada 10 minutos (solo en entornos con setInterval)
const globalScope = globalThis as unknown as { __rateLimitCleanup?: NodeJS.Timeout };
if (typeof setInterval !== "undefined" && typeof globalScope.__rateLimitCleanup === "undefined") {
  globalScope.__rateLimitCleanup = setInterval(
    () => {
      const now = Date.now();
      for (const [key, entry] of store.entries()) {
        if (now > entry.resetAt) store.delete(key);
      }
    },
    10 * 60 * 1000
  );
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;          // ms desde epoch
  retryAfterSeconds: number;
}

/**
 * Verifica y registra una solicitud.
 * @param key         Identificador único (ej. "magic-link:1.2.3.4")
 * @param maxRequests Máximo de solicitudes permitidas en la ventana
 * @param windowMs    Duración de la ventana en milisegundos
 */
export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const existing = store.get(key);

  // Ventana nueva o expirada
  if (!existing || now > existing.resetAt) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: maxRequests - 1, resetAt, retryAfterSeconds: 0 };
  }

  // Ventana activa: límite alcanzado
  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count++;
  return {
    allowed: true,
    remaining: maxRequests - existing.count,
    resetAt: existing.resetAt,
    retryAfterSeconds: 0,
  };
}

/**
 * Obtiene la IP del cliente desde los headers de la request.
 * Funciona detrás de Vercel/Nginx/Cloudflare.
 */
export async function getClientIp(): Promise<string> {
  const headersList = await headers();
  return (
    headersList.get("x-forwarded-for")?.split(",")[0].trim() ??
    headersList.get("x-real-ip") ??
    "unknown"
  );
}

// Configuraciones predefinidas (exportadas para reutilizar)
export const RATE_LIMITS = {
  /** Magic link: 5 solicitudes por IP cada 15 minutos */
  MAGIC_LINK:   { max: 5,   windowMs: 15 * 60 * 1000 },
  /** API pública de disponibilidad: 120 por IP por minuto */
  AVAILABILITY: { max: 120, windowMs:      60 * 1000 },
  /** Admin login: 10 intentos por IP cada 10 minutos */
  ADMIN_LOGIN:  { max: 10,  windowMs: 10 * 60 * 1000 },
} as const;
