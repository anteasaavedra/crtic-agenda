/**
 * Capa de envío de email.
 *
 * - Usa Resend como proveedor.
 * - Registra cada intento en EmailLog.
 * - No lanza excepciones: devuelve boolean (true = enviado).
 *   Los errores se loguean en consola y en EmailLog.lastError.
 *
 * Funciones de alto nivel:
 *   sendMagicLinkEmail, sendReservationConfirmedEmail,
 *   sendReminderEmail, sendCancellationEmail
 */

import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import {
  magicLinkTemplate,
  reservationConfirmedTemplate,
  reminderTemplate,
  cancellationTemplate,
  mentorNotificationTemplate,
  type ReservationEmailData,
  type MentorNotificationData,
} from "@/lib/email-templates";

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY no configurado");
  return new Resend(key);
}

function getFromAddress(): string {
  return process.env.RESEND_FROM ?? "CRTIC Agenda <no-reply@agenda.crtic.cl>";
}

// ─── Core: send + log ────────────────────────────────────────────────────────

interface SendOptions {
  to: string;
  templateName: string;
  subject: string;
  html: string;
  text: string;
  reservationId?: string;
  participantId?: string | null;
}

/**
 * Envía un email vía Resend y actualiza EmailLog.
 * @returns true si el envío fue exitoso.
 */
export async function sendEmailNow(opts: SendOptions): Promise<boolean> {
  // Crear log inicial
  let logId: string | null = null;
  try {
    const log = await prisma.emailLog.create({
      data: {
        toEmail: opts.to,
        template: opts.templateName,
        subject: opts.subject,
        reservationId: opts.reservationId,
        participantId: opts.participantId,
        status: "QUEUED",
      },
    });
    logId = log.id;
  } catch (logErr) {
    console.error("[email] Error creando EmailLog:", logErr);
  }

  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: getFromAddress(),
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });

    if (error) throw new Error(error.message);

    // Marcar como enviado
    if (logId) {
      await prisma.emailLog.update({
        where: { id: logId },
        data: {
          status: "SENT",
          sentAt: new Date(),
          attempts: { increment: 1 },
          providerMessageId: data?.id ?? null,
        },
      });
    }
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error(`[email] Error enviando a ${opts.to}:`, msg);

    if (logId) {
      await prisma.emailLog.update({
        where: { id: logId },
        data: {
          status: "FAILED",
          attempts: { increment: 1 },
          lastError: msg.substring(0, 500),
        },
      });
    }
    return false;
  }
}

// ─── Funciones de alto nivel ─────────────────────────────────────────────────

export async function sendMagicLinkEmail(
  toEmail: string,
  magicLinkUrl: string
): Promise<boolean> {
  const tpl = magicLinkTemplate({ url: magicLinkUrl });
  return sendEmailNow({
    to: toEmail,
    templateName: "magic-link",
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  });
}

export async function sendReservationConfirmedEmail(
  toEmail: string,
  data: ReservationEmailData,
  reservationId?: string,
  participantId?: string
): Promise<boolean> {
  const tpl = reservationConfirmedTemplate(data);
  return sendEmailNow({
    to: toEmail,
    templateName: "reservation-confirmed",
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    reservationId,
    participantId,
  });
}

export async function sendReminderEmail(
  toEmail: string,
  data: ReservationEmailData,
  type: "24h" | "1h",
  reservationId: string,
  participantId?: string | null
): Promise<boolean> {
  const tpl = reminderTemplate(data, type);
  return sendEmailNow({
    to: toEmail,
    templateName: `reminder-${type}`,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    reservationId,
    participantId,
  });
}

export async function sendMentorNotificationEmail(
  mentorEmail: string,
  data: MentorNotificationData,
  reservationId: string
): Promise<boolean> {
  const tpl = mentorNotificationTemplate(data);
  return sendEmailNow({
    to: mentorEmail,
    templateName: "mentor-notification",
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    reservationId,
  });
}

export async function sendCancellationEmail(
  toEmail: string,
  data: Omit<ReservationEmailData, "credential"> & { reason?: string },
  reservationId: string,
  participantId?: string | null
): Promise<boolean> {
  const tpl = cancellationTemplate(data);
  return sendEmailNow({
    to: toEmail,
    templateName: "cancelled",
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    reservationId,
    participantId,
  });
}
