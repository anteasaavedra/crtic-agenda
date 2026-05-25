/**
 * Templates de email para CRTIC Agenda.
 * HTML con estilos inline para máxima compatibilidad con clientes de correo.
 * Marca: #ff4613 naranja · #1d1f23 negro · #3bd4ae verde
 */

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Formatea fecha en hora Chile (America/Santiago) */
function formatDateTimeChile(date: Date): string {
  return date.toLocaleString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Santiago",
    hour12: false,
  }) + " hrs";
}

/** Solo hora en Chile */
function formatTimeChile(date: Date): string {
  return date.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Santiago",
    hour12: false,
  }) + " hrs";
}

/** Solo fecha en Chile */
function formatDateChile(date: Date): string {
  return date.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Santiago",
  });
}

// ─── Layout base ──────────────────────────────────────────────────────────────

function layout(content: string, preheader = ""): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CRTIC Agenda</title>
</head>
<body style="margin:0;padding:0;background:#f0efee;font-family:system-ui,-apple-system,Helvetica,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;color:#f0efee;">${preheader}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0efee;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" style="max-width:580px;">

          <!-- Header -->
          <tr>
            <td style="background:#1d1f23;border-radius:16px 16px 0 0;padding:22px 32px;">
              <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#ff4613;line-height:1;">CRTIC</p>
              <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#ffffff;line-height:1;">Agenda</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:36px 32px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#ffffff;border-top:1px solid #f0efee;border-radius:0 0 16px 16px;padding:20px 32px 28px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;text-align:center;">
                Centro de Recursos para la Tecnología e Innovación en la Cultura<br>
                <span style="color:#d1d5db;">Si tienes dudas, contacta a tu coordinador CRTIC.</span>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Bloque de detalle de reserva ─────────────────────────────────────────────

function reservationDetail(toolName: string, startsAt: Date, endsAt: Date): string {
  const durationMin = (endsAt.getTime() - startsAt.getTime()) / 60_000;
  const durationLabel = durationMin >= 60
    ? `${Math.floor(durationMin / 60)}h${durationMin % 60 > 0 ? ` ${durationMin % 60} min` : ""}`
    : `${durationMin} min`;

  return `
<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
  style="background:#f7f7f6;border-radius:12px;padding:20px;margin:20px 0 0;">
  <tr>
    <td>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding:5px 16px 5px 0;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#9ca3af;vertical-align:top;width:100px;">
            Herramienta
          </td>
          <td style="padding:5px 0;font-size:15px;font-weight:700;color:#1d1f23;">
            ${toolName}
          </td>
        </tr>
        <tr>
          <td style="padding:5px 16px 5px 0;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#9ca3af;vertical-align:top;">
            Fecha
          </td>
          <td style="padding:5px 0;font-size:14px;color:#374151;text-transform:capitalize;">
            ${formatDateChile(startsAt)}
          </td>
        </tr>
        <tr>
          <td style="padding:5px 16px 5px 0;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#9ca3af;vertical-align:top;">
            Horario
          </td>
          <td style="padding:5px 0;font-size:14px;color:#374151;">
            ${formatTimeChile(startsAt)} — ${formatTimeChile(endsAt)}
            <span style="color:#9ca3af;font-size:13px;">(${durationLabel})</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

// ─── Bloque de credenciales ───────────────────────────────────────────────────

function credentialBlock(username: string, password: string, accessUrl?: string | null): string {
  const accessRow = accessUrl ? `
    <tr>
      <td style="padding:4px 16px 4px 0;font-size:13px;color:#6b7280;width:90px;vertical-align:top;">Ingresar en</td>
      <td style="padding:4px 0;">
        <a href="${accessUrl}" style="font-size:14px;font-weight:700;color:#0d9488;word-break:break-all;">
          ${accessUrl}
        </a>
      </td>
    </tr>` : "";

  return `
<div style="margin-top:20px;background:#eafaf6;border:1.5px solid #3bd4ae;border-radius:12px;padding:20px;">
  <p style="margin:0 0 14px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#0d9488;">
    Credenciales de acceso
  </p>
  <table role="presentation" cellpadding="0" cellspacing="0">
    ${accessRow}
    <tr>
      <td style="padding:4px 16px 4px 0;font-size:13px;color:#6b7280;width:90px;">Usuario</td>
      <td style="padding:4px 0;font-size:14px;font-family:monospace;font-weight:700;color:#1d1f23;background:#d4f5ec;border-radius:4px;padding:3px 8px;">
        ${username}
      </td>
    </tr>
    <tr>
      <td style="padding:4px 16px 4px 0;font-size:13px;color:#6b7280;">Contraseña</td>
      <td style="padding:4px 0;font-size:14px;font-family:monospace;font-weight:700;color:#1d1f23;background:#d4f5ec;border-radius:4px;padding:3px 8px;">
        ${password}
      </td>
    </tr>
  </table>
  <p style="margin:12px 0 0;font-size:12px;color:#0d9488;line-height:1.5;">
    Usa estas credenciales para ingresar a la herramienta durante tu horario reservado.
  </p>
</div>`;
}

function meetLinkBlock(meetLink: string): string {
  return `
<div style="margin-top:20px;background:#f0f9ff;border:1.5px solid #7dd3fc;border-radius:12px;padding:20px;text-align:center;">
  <p style="margin:0 0 14px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#0284c7;">
    Reunión en Google Meet
  </p>
  <a href="${meetLink}"
     style="display:inline-block;background:#0ea5e9;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:12px 28px;border-radius:10px;letter-spacing:0.01em;">
    Unirse a la reunión
  </a>
  <p style="margin:12px 0 0;font-size:11px;color:#7dd3fc;word-break:break-all;">
    <a href="${meetLink}" style="color:#0284c7;">${meetLink}</a>
  </p>
</div>`;
}

function credentialPendingBlock(): string {
  return `
<div style="margin-top:20px;background:#fefce8;border:1.5px solid #fde68a;border-radius:12px;padding:16px;">
  <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
    ⏳ <strong>Credenciales pendientes</strong><br>
    Las recibirás en el recordatorio de 1 hora antes de tu reserva.
  </p>
</div>`;
}

// ─── Template: Magic Link ─────────────────────────────────────────────────────

export function magicLinkTemplate({
  url,
  expiryMinutes = 15,
}: {
  url: string;
  expiryMinutes?: number;
}): EmailTemplate {
  const subject = "Tu enlace de acceso a CRTIC Agenda";
  const html = layout(`
<h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1d1f23;line-height:1.2;">
  Accede a tu cuenta
</h1>
<p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
  Haz clic en el botón para ingresar a CRTIC Agenda.<br>
  El enlace es válido durante <strong style="color:#1d1f23;">${expiryMinutes} minutos</strong> y solo puede usarse una vez.
</p>
<div style="text-align:center;margin:28px 0;">
  <a href="${url}"
     style="display:inline-block;background:#ff4613;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:10px;letter-spacing:0.02em;">
    Ingresar a CRTIC Agenda
  </a>
</div>
<p style="margin:24px 0 0;font-size:12px;color:#9ca3af;line-height:1.6;text-align:center;">
  Si no solicitaste este enlace, ignora este mensaje.<br>
  Si el botón no funciona, copia y pega esta URL:<br>
  <span style="font-family:monospace;word-break:break-all;color:#6b7280;">${url}</span>
</p>`, "Accede a CRTIC Agenda con este enlace seguro");

  const text = `CRTIC Agenda — Enlace de acceso

Haz clic o copia el siguiente enlace para ingresar:
${url}

El enlace expira en ${expiryMinutes} minutos y solo puede usarse una vez.

Si no solicitaste este enlace, ignora este mensaje.`;

  return { subject, html, text };
}

// ─── Template: Confirmación de reserva ───────────────────────────────────────

export interface ReservationEmailData {
  participantName: string;
  courseName: string;
  toolName: string;
  accessUrl?: string | null;
  meetLink?: string | null;
  startsAt: Date;
  endsAt: Date;
  credential?: { username: string; password: string; weekLabel: string } | null;
  cancelToken?: string;
  reservationId?: string;
}

export function reservationConfirmedTemplate(data: ReservationEmailData): EmailTemplate {
  const { participantName, toolName, accessUrl, meetLink, startsAt, endsAt, credential, cancelToken, reservationId } = data;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const cancelUrl = (cancelToken && reservationId)
    ? `${appUrl}/cancelar?id=${reservationId}&token=${cancelToken}`
    : null;

  const credHtml = meetLink
    ? meetLinkBlock(meetLink)
    : credential
      ? credentialBlock(credential.username, credential.password, accessUrl)
      : credentialPendingBlock();

  const cancelHtml = cancelUrl
    ? `<div style="margin-top:24px;text-align:center;border-top:1px solid #f0efee;padding-top:20px;">
        <p style="margin:0 0 10px;font-size:13px;color:#9ca3af;">¿Necesitas cancelar?</p>
        <a href="${cancelUrl}"
           style="font-size:13px;color:#6b7280;text-decoration:underline;">
          Cancelar reserva
        </a>
        <p style="margin:6px 0 0;font-size:11px;color:#d1d5db;">Disponible hasta 1 hora antes de tu horario.</p>
      </div>`
    : "";

  const subject = `✓ Reserva confirmada — ${toolName}`;
  const html = layout(`
<h1 style="margin:0 0 4px;font-size:24px;font-weight:800;color:#1d1f23;">
  ¡Reserva confirmada!
</h1>
<p style="margin:0 0 4px;font-size:15px;color:#6b7280;">
  Hola${participantName ? ` <strong style="color:#1d1f23;">${participantName}</strong>` : ""},
</p>
<p style="margin:0;font-size:15px;color:#6b7280;line-height:1.6;">
  Tu reserva quedó registrada. Te esperamos en el horario indicado.
</p>

${reservationDetail(toolName, startsAt, endsAt)}
${credHtml}
${cancelHtml}`,
  `Reserva confirmada — ${toolName} el ${formatDateChile(startsAt)}`);

  const text = `✓ Reserva confirmada — ${toolName}

Hola${participantName ? ` ${participantName}` : ""},
Tu reserva quedó registrada.

Herramienta: ${toolName}
Fecha: ${formatDateChile(startsAt)}
Horario: ${formatTimeChile(startsAt)} — ${formatTimeChile(endsAt)} hrs

${meetLink
  ? `Reunión en Google Meet:\n${meetLink}`
  : credential
    ? `Credenciales de acceso:${accessUrl ? `\nIngresar en: ${accessUrl}` : ""}\nUsuario: ${credential.username}\nContraseña: ${credential.password}`
    : "Las credenciales estarán disponibles en el recordatorio de 1h antes."}

${cancelUrl ? `¿Necesitas cancelar? → ${cancelUrl}\n(Disponible hasta 1 hora antes de tu horario)` : ""}

CRTIC — Centro de Recursos para la Tecnología e Innovación en la Cultura`;

  return { subject, html, text };
}

// ─── Template: Recordatorio (24h / 1h) ────────────────────────────────────────

export function reminderTemplate(
  data: ReservationEmailData,
  type: "24h" | "1h"
): EmailTemplate {
  const { participantName, toolName, accessUrl, meetLink, startsAt, endsAt, credential, cancelToken, reservationId } = data;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const cancelUrl = (cancelToken && reservationId)
    ? `${appUrl}/cancelar?id=${reservationId}&token=${cancelToken}`
    : null;

  const is24h = type === "24h";
  const timeLabel = is24h ? "mañana" : "en 1 hora";
  const emoji = is24h ? "🔔" : "⏰";

  const credHtml = meetLink
    ? meetLinkBlock(meetLink)
    : credential
      ? credentialBlock(credential.username, credential.password, accessUrl)
      : `<div style="margin-top:20px;background:#fef2f2;border:1.5px solid #fecaca;border-radius:12px;padding:16px;">
        <p style="margin:0;font-size:13px;color:#991b1b;line-height:1.6;">
          ⚠️ <strong>Las credenciales aún no están disponibles.</strong><br>
          Contacta a tu coordinador CRTIC lo antes posible.
        </p>
      </div>`;

  const cancelHtml = (!is24h || !cancelUrl) ? "" :
    `<div style="margin-top:20px;text-align:center;">
      <a href="${cancelUrl}"
         style="font-size:13px;color:#9ca3af;text-decoration:underline;">
        Cancelar reserva
      </a>
      <span style="color:#e5e5e3;margin:0 8px;">·</span>
      <span style="font-size:12px;color:#d1d5db;">Solo hasta 1h antes</span>
    </div>`;

  const subject = is24h
    ? `🔔 Mañana: tu reserva de ${toolName}`
    : `⏰ En 1 hora: tu reserva de ${toolName}`;

  const html = layout(`
<p style="margin:0 0 2px;font-size:28px;line-height:1;">${emoji}</p>
<h1 style="margin:8px 0 4px;font-size:24px;font-weight:800;color:#1d1f23;">
  Tu reserva es ${timeLabel}
</h1>
<p style="margin:0;font-size:15px;color:#6b7280;line-height:1.6;">
  Hola${participantName ? ` <strong style="color:#1d1f23;">${participantName}</strong>` : ""},
  recuerda que tienes una reserva de <strong style="color:#1d1f23;">${toolName}</strong> ${timeLabel}.
</p>

${reservationDetail(toolName, startsAt, endsAt)}
${credHtml}
${cancelHtml}`,
  `Recordatorio: ${toolName} ${timeLabel} — ${formatTimeChile(startsAt)} hrs`);

  const text = `${emoji} Recordatorio — ${toolName}

Hola${participantName ? ` ${participantName}` : ""},
Tu reserva de ${toolName} es ${timeLabel}.

Fecha: ${formatDateChile(startsAt)}
Horario: ${formatTimeChile(startsAt)} — ${formatTimeChile(endsAt)} hrs

${meetLink
  ? `Reunión en Google Meet:\n${meetLink}`
  : credential
    ? `Credenciales de acceso:${accessUrl ? `\nIngresar en: ${accessUrl}` : ""}\nUsuario: ${credential.username}\nContraseña: ${credential.password}`
    : "⚠️ Las credenciales no están disponibles. Contacta a tu coordinador CRTIC."}

CRTIC — Centro de Recursos para la Tecnología e Innovación en la Cultura`;

  return { subject, html, text };
}

// ─── Template: Cancelación ───────────────────────────────────────────────────

export function cancellationTemplate(
  data: Omit<ReservationEmailData, "credential"> & { reason?: string }
): EmailTemplate {
  const { participantName, toolName, startsAt, endsAt, reason } = data;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const subject = `Reserva cancelada — ${toolName}`;
  const html = layout(`
<h1 style="margin:0 0 4px;font-size:24px;font-weight:800;color:#1d1f23;">
  Reserva cancelada
</h1>
<p style="margin:0;font-size:15px;color:#6b7280;line-height:1.6;">
  Hola${participantName ? ` <strong style="color:#1d1f23;">${participantName}</strong>` : ""},
  te informamos que tu reserva ha sido cancelada.
</p>

${reservationDetail(toolName, startsAt, endsAt)}

${reason ? `<div style="margin-top:16px;padding:14px 16px;background:#fef2f2;border-radius:10px;border:1px solid #fecaca;">
  <p style="margin:0;font-size:13px;color:#991b1b;line-height:1.5;">
    <strong>Motivo:</strong> ${reason}
  </p>
</div>` : ""}

<div style="margin-top:24px;text-align:center;">
  <p style="margin:0 0 14px;font-size:14px;color:#6b7280;">
    ¿Quieres reservar otro horario?
  </p>
  <a href="${appUrl}"
     style="display:inline-block;background:#ff4613;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 28px;border-radius:10px;">
    Ver disponibilidad
  </a>
</div>`,
  `Tu reserva de ${toolName} fue cancelada`);

  const text = `Reserva cancelada — ${toolName}

Hola${participantName ? ` ${participantName}` : ""},
Tu reserva ha sido cancelada.

Herramienta: ${toolName}
Fecha: ${formatDateChile(startsAt)}
Horario: ${formatTimeChile(startsAt)} — ${formatTimeChile(endsAt)} hrs
${reason ? `Motivo: ${reason}\n` : ""}
¿Quieres reservar otro horario? Visita ${appUrl}

CRTIC — Centro de Recursos para la Tecnología e Innovación en la Cultura`;

  return { subject, html, text };
}

// ─── Template: Notificación al mentor ─────────────────────────────────────────

export interface MentorNotificationData {
  mentorName: string;
  participantName: string;
  participantEmail: string;
  toolName: string;
  startsAt: Date;
  endsAt: Date;
  meetLink?: string | null;
}

export function mentorNotificationTemplate(data: MentorNotificationData): EmailTemplate {
  const { mentorName, participantName, participantEmail, toolName, startsAt, endsAt, meetLink } = data;

  const subject = `📅 Nueva mentoría reservada — ${formatDateChile(startsAt)}`;

  const html = layout(`
<h1 style="margin:0 0 4px;font-size:24px;font-weight:800;color:#1d1f23;">
  Nueva mentoría agendada
</h1>
<p style="margin:0;font-size:15px;color:#6b7280;line-height:1.6;">
  Hola <strong style="color:#1d1f23;">${mentorName}</strong>, tienes una nueva sesión de mentoría reservada.
</p>

${reservationDetail(toolName, startsAt, endsAt)}

<div style="margin-top:20px;background:#f7f7f6;border-radius:12px;padding:20px;">
  <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;">
    Participante
  </p>
  <p style="margin:0;font-size:15px;font-weight:700;color:#1d1f23;">${participantName}</p>
  <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${participantEmail}</p>
</div>

${meetLink ? meetLinkBlock(meetLink) : ""}`,
  `Nueva mentoría: ${participantName} el ${formatDateChile(startsAt)}`);

  const text = `📅 Nueva mentoría — ${toolName}

Hola ${mentorName},
Tienes una nueva sesión de mentoría reservada.

Fecha: ${formatDateChile(startsAt)}
Horario: ${formatTimeChile(startsAt)} — ${formatTimeChile(endsAt)} hrs
Participante: ${participantName} <${participantEmail}>
${meetLink ? `\nReunión en Google Meet:\n${meetLink}` : ""}

CRTIC — Centro de Recursos para la Tecnología e Innovación en la Cultura`;

  return { subject, html, text };
}
