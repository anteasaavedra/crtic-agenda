import { requestMagicLink } from "@/actions/auth-participant";

const ERROR_MESSAGES: Record<string, string> = {
  enlace_invalido:              "El enlace no es válido.",
  enlace_ya_usado:              "Este enlace ya fue utilizado. Solicita uno nuevo.",
  enlace_expirado:              "El enlace ha expirado (15 minutos). Solicita uno nuevo.",
  usuario_no_encontrado:        "No encontramos una cuenta con ese correo.",
  sin_participaciones_activas:  "No tienes cursos activos en este momento.",
  email_invalido:               "Ingresa un correo electrónico válido.",
  demasiados_intentos:          "Demasiados intentos. Espera unos minutos antes de volver a intentarlo.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  const errorMsg = error ? (ERROR_MESSAGES[error] ?? decodeURIComponent(error)) : null;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <div className="w-full max-w-sm">
        {/* Logo / título */}
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">CRTIC</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Agenda</h1>
          <p className="mt-2 text-sm text-gray-500">
            Ingresa tu correo para recibir un enlace de acceso.
          </p>
        </div>

        {/* Mensaje de éxito */}
        {sent === "1" && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-4 text-center">
            <p className="text-sm font-medium text-green-800">¡Enlace enviado!</p>
            <p className="mt-1 text-xs text-green-600">
              Revisa tu bandeja de entrada. El enlace expira en 15 minutos.
            </p>
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {/* Formulario */}
        {sent !== "1" && (
          <form action={requestMagicLink} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Correo electrónico
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                placeholder="tu@correo.com"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              Enviar enlace de acceso
            </button>
          </form>
        )}

        {/* Botón para reintentar después del éxito */}
        {sent === "1" && (
          <div className="mt-4 text-center">
            <a href="/login" className="text-sm text-slate-600 hover:underline">
              ¿No llegó? Intentar de nuevo
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
