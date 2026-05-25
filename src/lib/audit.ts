/**
 * Helper de auditoría.
 * Registra acciones críticas en AuditLog con trazabilidad completa.
 *
 * Acciones auditadas obligatoriamente:
 * - ADMIN_LOGIN
 * - CREATE_COURSE, CREATE_TOOL, CREATE_LICENSE, CREATE_PARTICIPANT
 * - UPSERT_CREDENTIAL (sin incluir el password)
 * - CANCEL_RESERVATION
 * - UPDATE_AVAILABILITY
 * - REMOVE_PARTICIPANT
 */

import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  /** Contexto adicional. NUNCA incluir passwords ni tokens en este campo. */
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Escribe una entrada en AuditLog.
 * No lanza excepciones para no interrumpir el flujo principal;
 * en caso de fallo loguea el error en consola.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    // Prisma espera undefined (no null) para campos opcionales en CreateInput.
    await prisma.auditLog.create({
      data: {
        action:     entry.action,
        entityType: entry.entityType,
        actorId:    entry.actorId   ?? undefined,
        entityId:   entry.entityId  ?? undefined,
        metadata:   (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress:  entry.ipAddress ?? undefined,
        userAgent:  entry.userAgent ?? undefined,
      },
    });
  } catch (err) {
    // El fallo de auditoría no debe bloquear la operación principal,
    // pero sí debe ser visible en los logs del servidor.
    console.error("[audit] Error al escribir AuditLog:", err, entry.action);
  }
}
