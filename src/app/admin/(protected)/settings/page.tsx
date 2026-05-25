/**
 * /admin/settings
 *
 * Configuración del sistema:
 *  - Integración con Google Calendar (OAuth + selección de calendario)
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listCalendars } from "@/lib/google-calendar";
import { initiateGoogleAuth, disconnectGoogleAccount, saveCalendarId } from "@/actions/google";

const SUCCESS_MESSAGES: Record<string, string> = {
  google_connected:    "✓ Google Calendar conectado correctamente.",
  google_disconnected: "✓ Cuenta de Google desconectada.",
  calendar_guardado:   "✓ Calendario guardado.",
};

const ERROR_MESSAGES: Record<string, string> = {
  google_denied:     "Acceso denegado. Debes aceptar los permisos para continuar.",
  google_error:      "Error al conectar con Google. Intenta nuevamente.",
  callback_invalido: "Callback de Google inválido.",
  state_invalido:    "Estado OAuth inválido (posible CSRF). Intenta de nuevo.",
  exchange_failed:   "Error al obtener los tokens de Google. Intenta de nuevo.",
  calendar_requerido:"Selecciona un calendario antes de guardar.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { success, error } = await searchParams;
  const session = await getServerSession(authOptions);
  const adminId = session!.user.id;

  // Estado de la cuenta Google del admin actual
  const googleAccount = await prisma.googleAccount.findUnique({
    where: { userId: adminId },
    select: {
      calendarId:      true,
      lastRefreshedAt: true,
      expiryDate:      true,
    },
  });

  const isConnected = !!googleAccount;

  // Calendarios disponibles (si conectado)
  let calendars: { id: string; summary: string; primary: boolean }[] = [];
  let calendarsFetchError: string | null = null;

  if (isConnected) {
    try {
      calendars = await listCalendars(adminId);
    } catch (err) {
      calendarsFetchError = err instanceof Error ? err.message : "Error al obtener calendarios";
    }
  }

  const currentCalendarId = googleAccount?.calendarId ?? "primary";

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="mt-1 text-sm text-gray-500">
          Ajustes del sistema y conexiones externas.
        </p>
      </div>

      {/* Banners */}
      {success && SUCCESS_MESSAGES[success] && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {SUCCESS_MESSAGES[success]}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {ERROR_MESSAGES[error] ?? decodeURIComponent(error)}
        </div>
      )}

      {/* ─── Google Calendar ────────────────────────────────────────────────── */}
      <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Google Calendar</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Los eventos se crean automáticamente en el calendario del admin cuando un
            participante confirma o cancela una reserva.
          </p>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Estado */}
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                isConnected
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {isConnected ? "● Conectado" : "○ No conectado"}
            </span>
            {isConnected && googleAccount.lastRefreshedAt && (
              <span className="text-xs text-gray-400">
                Token renovado:{" "}
                {googleAccount.lastRefreshedAt.toISOString().substring(0, 10)}
              </span>
            )}
          </div>

          {/* Conectar */}
          {!isConnected && (
            <form action={initiateGoogleAuth}>
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                Conectar Google Calendar
              </button>
              <p className="mt-2 text-xs text-gray-400">
                Se te pedirá acceso de lectura/escritura a Google Calendar.
                Solo el admin que conecta puede escribir eventos.
              </p>
            </form>
          )}

          {/* Conectado: seleccionar calendario */}
          {isConnected && (
            <div className="space-y-4">
              {calendarsFetchError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  Error obteniendo calendarios: {calendarsFetchError}
                </div>
              ) : (
                <form action={saveCalendarId} className="flex items-end gap-3">
                  <div className="flex-1 space-y-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Calendario donde escribir eventos
                    </label>
                    <select
                      name="calendarId"
                      defaultValue={currentCalendarId}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
                    >
                      {calendars.length === 0 ? (
                        <option value="primary">primary (Mi calendario)</option>
                      ) : (
                        calendars.map((cal) => (
                          <option key={cal.id} value={cal.id}>
                            {cal.summary}
                            {cal.primary ? " (principal)" : ""}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
                  >
                    Guardar
                  </button>
                </form>
              )}

              {/* Desconectar */}
              <form action={disconnectGoogleAccount}>
                <button
                  type="submit"
                  className="text-xs text-red-500 hover:text-red-700 focus:outline-none"
                >
                  Desconectar cuenta de Google
                </button>
              </form>
            </div>
          )}
        </div>
      </section>

      {/* ─── Info de entorno ─────────────────────────────────────────────────── */}
      <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Información de configuración</h2>
        </div>
        <div className="px-6 py-4 space-y-2 text-sm text-gray-500">
          <p>
            <span className="font-medium text-gray-700">Redirect URI para Google Cloud:</span>{" "}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
              {process.env.GOOGLE_REDIRECT_URI ?? "GOOGLE_REDIRECT_URI no configurado"}
            </code>
          </p>
          <p className="text-xs text-gray-400">
            Agrega esta URL en: Google Cloud Console → APIs y servicios → Credenciales →
            OAuth 2.0 → URIs de redirección autorizadas.
          </p>
        </div>
      </section>
    </div>
  );
}
