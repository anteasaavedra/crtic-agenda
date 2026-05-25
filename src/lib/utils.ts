import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convierte un texto a slug URL-safe.
 * Ejemplo: "Diseño con IA" → "diseno-con-ia"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quitar tildes
    .replace(/[^a-z0-9\s-]/g, "")    // solo alfanumérico, espacios y guiones
    .trim()
    .replace(/\s+/g, "-")             // espacios → guiones
    .replace(/-+/g, "-");             // colapsar guiones múltiples
}

/** Formatea una fecha como "lun 11 may 2026 09:00" en zona UTC. */
export function formatDateTime(date: Date): string {
  return date.toLocaleString("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/** Formatea una fecha como "11/05/2026". */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Retorna la fecha actual como YYYY-MM-DD en UTC. */
export function todayUTC(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Type guard para distinguir errores de redirect de Next.js
 * (usados dentro de Server Actions con redirect()).
 * Necesario para no tragar redirects en bloques catch.
 */
type RedirectError = Error & { digest?: string };
export function isRedirect(e: unknown): e is RedirectError {
  return (e as RedirectError)?.digest?.startsWith("NEXT_REDIRECT") ?? false;
}
