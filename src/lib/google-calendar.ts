/**
 * Google Calendar — OAuth y operaciones de eventos.
 *
 * Flujo:
 *  1. Admin conecta su cuenta via OAuth (getAuthorizationUrl → exchangeCode → upsert GoogleAccount)
 *  2. En cada reserva: createAdminCalendarEvent (fire-and-forget desde las actions)
 *  3. En cada cancelación: deleteAdminCalendarEvent (idem)
 *
 * Los tokens se almacenan cifrados en GoogleAccount.
 * El cliente OAuth renueva automáticamente el access token y guarda el nuevo.
 */

import { google, type calendar_v3 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

// ─── Cliente OAuth ────────────────────────────────────────────────────────────

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

function getOAuth2Client(): OAuth2Client {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri  = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Variables GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REDIRECT_URI son requeridas"
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// ─── URL de autorización ──────────────────────────────────────────────────────

export function getAuthorizationUrl(state: string): string {
  return getOAuth2Client().generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // Necesario para obtener refresh_token en re-autorizaciones
    state,
  });
}

// ─── Intercambio de código ────────────────────────────────────────────────────

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiryDate: Date;
}

export async function exchangeCode(code: string): Promise<GoogleTokens> {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error(
      "Google no devolvió tokens completos. Asegúrate de solicitar acceso offline con prompt=consent."
    );
  }

  return {
    accessToken:  tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate:   new Date(tokens.expiry_date ?? Date.now() + 3_600_000),
  };
}

// ─── Cliente autenticado (con auto-refresh) ────────────────────────────────────

async function getAuthorizedClient(
  userId: string
): Promise<{ auth: OAuth2Client; calendarId: string } | null> {
  const account = await prisma.googleAccount.findUnique({
    where: { userId },
    select: {
      accessTokenEncrypted:  true,
      refreshTokenEncrypted: true,
      expiryDate:            true,
      calendarId:            true,
    },
  });

  if (!account) return null;

  const client = getOAuth2Client();
  client.setCredentials({
    access_token:  decrypt(account.accessTokenEncrypted),
    refresh_token: decrypt(account.refreshTokenEncrypted),
    expiry_date:   account.expiryDate.getTime(),
  });

  // Guardar nuevo access token cuando el cliente lo renueve
  client.on("tokens", (newTokens) => {
    if (newTokens.access_token) {
      prisma.googleAccount
        .update({
          where: { userId },
          data: {
            accessTokenEncrypted: encrypt(newTokens.access_token),
            expiryDate: new Date(newTokens.expiry_date ?? Date.now() + 3_600_000),
            lastRefreshedAt: new Date(),
          },
        })
        .catch((err) => console.error("[calendar] Error guardando token renovado:", err));
    }
  });

  return {
    auth:       client,
    calendarId: account.calendarId ?? "primary",
  };
}

// ─── Listar calendarios ───────────────────────────────────────────────────────

export interface CalendarItem {
  id: string;
  summary: string;
  primary: boolean;
}

export async function listCalendars(userId: string): Promise<CalendarItem[]> {
  const result = await getAuthorizedClient(userId);
  if (!result) return [];

  const cal = google.calendar({ version: "v3", auth: result.auth });
  const response = await cal.calendarList.list({ maxResults: 50 });

  return (response.data.items ?? []).map((item) => ({
    id:      item.id ?? "primary",
    summary: item.summary ?? item.id ?? "Sin nombre",
    primary: item.primary ?? false,
  }));
}

// ─── Construcción del evento ──────────────────────────────────────────────────

interface EventData {
  toolName:         string;
  licenseLabel:     string;
  participantName:  string;
  participantEmail: string;
  courseName:       string;
  startsAt:         Date;
  endsAt:           Date;
}

function buildEvent(data: EventData): calendar_v3.Schema$Event {
  const durationMin = (data.endsAt.getTime() - data.startsAt.getTime()) / 60_000;

  const attendees: calendar_v3.Schema$EventAttendee[] = [];
  if (data.participantEmail) {
    attendees.push({ email: data.participantEmail, displayName: data.participantName });
  }

  return {
    summary: `${data.toolName} — ${data.participantName}`,
    description: [
      `Herramienta : ${data.toolName}`,
      `Licencia    : ${data.licenseLabel}`,
      `Curso       : ${data.courseName}`,
      `Participante: ${data.participantName} <${data.participantEmail}>`,
      `Duración    : ${durationMin} min`,
      "",
      "Generado por CRTIC Agenda",
    ].join("\n"),
    start:     { dateTime: data.startsAt.toISOString(), timeZone: "America/Santiago" },
    end:       { dateTime: data.endsAt.toISOString(),   timeZone: "America/Santiago" },
    attendees,
    colorId:   "7", // Peacock (azul)
  };
}

// ─── Operaciones de alto nivel ────────────────────────────────────────────────

/**
 * Crea un evento en el calendario del primer admin con Google Account conectado.
 * No lanza excepciones: registra el resultado en CalendarEventLog.
 */
export async function createAdminCalendarEvent(reservationId: string): Promise<void> {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", googleAccount: { isNot: null } },
    select: { id: true },
  });

  if (!admin) return; // Google Calendar no configurado

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      participant: {
        include: {
          user:   { select: { name: true, email: true } },
          course: { select: { name: true } },
        },
      },
      licenseAccount: { include: { tool: { select: { name: true } } } },
    },
  });

  if (!reservation) return;

  const authResult = await getAuthorizedClient(admin.id);
  if (!authResult) return;

  let eventId: string | null = null;
  let errorMessage: string | null = null;

  try {
    const cal = google.calendar({ version: "v3", auth: authResult.auth });
    const participantName =
      reservation.guestName ??
      reservation.participant?.user.name ??
      reservation.guestEmail ??
      reservation.participant?.user.email ??
      "Invitado";
    const participantEmail =
      reservation.guestEmail ??
      reservation.participant?.user.email ??
      "";
    const courseName =
      reservation.participant?.course.name ??
      reservation.licenseAccount.tool.name;

    const response = await cal.events.insert({
      calendarId:  authResult.calendarId,
      sendUpdates: "all",
      requestBody: buildEvent({
        toolName:         reservation.licenseAccount.tool.name,
        licenseLabel:     reservation.licenseAccount.label,
        participantName,
        participantEmail,
        courseName,
        startsAt:         reservation.startsAt,
        endsAt:           reservation.endsAt,
      }),
    });

    eventId = response.data.id ?? null;

    if (eventId) {
      await prisma.reservation.update({
        where: { id: reservationId },
        data:  { googleEventIdAdmin: eventId },
      });
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Error desconocido";
    console.error("[calendar] Error creando evento:", errorMessage);
  }

  await prisma.calendarEventLog.create({
    data: {
      reservationId,
      calendarTarget: "ADMIN",
      googleEventId:  eventId,
      action:         errorMessage ? "FAILED" : "CREATED",
      errorMessage,
    },
  }).catch(console.error);
}

/**
 * Crea un evento de mentoría con Google Meet y agrega mentor + participante como invitados.
 * Devuelve el Meet link si tuvo éxito, null en caso contrario.
 */
export async function createMentorshipCalendarEvent(reservationId: string): Promise<string | null> {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", googleAccount: { isNot: null } },
    select: { id: true },
  });
  if (!admin) return null;

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      licenseAccount: { include: { tool: { select: { name: true } } } },
    },
  });
  if (!reservation) return null;

  const authResult = await getAuthorizedClient(admin.id);
  if (!authResult) return null;

  const mentorEmail   = reservation.licenseAccount.accountEmail;
  const mentorName    = reservation.licenseAccount.label;
  const participantName  = reservation.guestName  ?? "Participante";
  const participantEmail = reservation.guestEmail ?? null;

  const attendees: calendar_v3.Schema$EventAttendee[] = [];
  if (mentorEmail)    attendees.push({ email: mentorEmail,    displayName: mentorName });
  if (participantEmail) attendees.push({ email: participantEmail, displayName: participantName });

  let meetLink: string | null = null;
  let eventId: string | null = null;
  let errorMessage: string | null = null;

  try {
    const cal = google.calendar({ version: "v3", auth: authResult.auth });

    const response = await cal.events.insert({
      calendarId: authResult.calendarId,
      conferenceDataVersion: 1,
      sendUpdates: "all",
      requestBody: {
        summary: `Mentoría CRTIC: ${mentorName} — ${participantName}`,
        description: [
          `Mentoría   : ${reservation.licenseAccount.tool.name}`,
          `Mentor     : ${mentorName}`,
          `Participante: ${participantName}${participantEmail ? ` <${participantEmail}>` : ""}`,
          "",
          "Generado por CRTIC Agenda",
        ].join("\n"),
        start: { dateTime: reservation.startsAt.toISOString(), timeZone: "America/Santiago" },
        end:   { dateTime: reservation.endsAt.toISOString(),   timeZone: "America/Santiago" },
        attendees,
        conferenceData: {
          createRequest: {
            requestId: `mentoria-${reservationId}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 },
            { method: "popup", minutes: 30 },
          ],
        },
      },
    });

    eventId  = response.data.id ?? null;
    meetLink = response.data.conferenceData?.entryPoints
      ?.find((ep) => ep.entryPointType === "video")?.uri ?? null;

    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        ...(eventId  && { googleEventIdAdmin: eventId }),
        ...(meetLink && { meetLink }),
      },
    });
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Error desconocido";
    console.error("[calendar] Error creando evento de mentoría:", errorMessage);
  }

  await prisma.calendarEventLog.create({
    data: {
      reservationId,
      calendarTarget: "ADMIN",
      googleEventId:  eventId,
      action:         errorMessage ? "FAILED" : "CREATED",
      errorMessage,
    },
  }).catch(console.error);

  return meetLink;
}

/**
 * Elimina el evento del calendario admin asociado a la reserva.
 * No lanza excepciones.
 */
export async function deleteAdminCalendarEvent(reservationId: string): Promise<void> {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", googleAccount: { isNot: null } },
    select: { id: true },
  });

  if (!admin) return;

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { googleEventIdAdmin: true },
  });

  if (!reservation?.googleEventIdAdmin) return; // Sin evento que eliminar

  const authResult = await getAuthorizedClient(admin.id);
  if (!authResult) return;

  let errorMessage: string | null = null;

  try {
    const cal = google.calendar({ version: "v3", auth: authResult.auth });
    await cal.events.delete({
      calendarId: authResult.calendarId,
      eventId:    reservation.googleEventIdAdmin,
    });

    await prisma.reservation.update({
      where: { id: reservationId },
      data:  { googleEventIdAdmin: null },
    });
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === 404 || code === 410) {
      // El evento ya fue eliminado — no es un error
      await prisma.reservation.update({
        where: { id: reservationId },
        data:  { googleEventIdAdmin: null },
      }).catch(console.error);
    } else {
      errorMessage = err instanceof Error ? err.message : "Error desconocido";
      console.error("[calendar] Error eliminando evento:", errorMessage);
    }
  }

  await prisma.calendarEventLog.create({
    data: {
      reservationId,
      calendarTarget: "ADMIN",
      action:         errorMessage ? "FAILED" : "DELETED",
      errorMessage,
    },
  }).catch(console.error);
}
