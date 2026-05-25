/**
 * /admin/magic-links
 *
 * Herramienta de testing para generar magic links sin necesidad de email.
 * SOLO para desarrollo / staging. En producción con Stage 5, los links
 * se enviarán por email directamente.
 */

import { prisma } from "@/lib/prisma";
import { generateMagicLinkAdmin } from "@/actions/auth-participant";

const ERROR_MESSAGES: Record<string, string> = {
  email_requerido:              "El correo es requerido.",
  usuario_no_encontrado:        "No existe usuario con ese correo.",
  sin_participaciones_activas:  "El usuario no tiene participaciones activas.",
};

export default async function MagicLinksPage({
  searchParams,
}: {
  searchParams: Promise<{
    preview?: string;
    email?: string;
    error?: string;
  }>;
}) {
  const { preview, email: previewEmail, error } = await searchParams;

  // Tokens recientes (últimas 24 h) para referencia
  const recentTokens = await prisma.magicLinkToken.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Participantes activos para el select de ayuda
  const activeParticipants = await prisma.participant.findMany({
    where: { status: "ACTIVE" },
    include: {
      user: { select: { email: true, name: true } },
      course: { select: { name: true } },
    },
    orderBy: [{ course: { name: "asc" } }, { user: { email: "asc" } }],
    take: 100,
  });

  // Agrupar emails únicos
  const uniqueEmails = [
    ...new Map(activeParticipants.map((p) => [p.user.email, p])).values(),
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900">Magic Links</h1>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
            Solo desarrollo
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Genera enlaces de acceso para participantes sin enviar email.
          Útil para probar el flujo de Stage 4 antes de integrar Resend (Stage 5).
        </p>
      </div>

      {/* Banner de error */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {ERROR_MESSAGES[error] ?? decodeURIComponent(error)}
        </div>
      )}

      {/* Link generado */}
      {preview && previewEmail && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-green-700 mb-2">
            Magic link generado para {previewEmail}
          </p>
          <p className="text-xs text-gray-500 mb-1">
            Copia y pega este enlace en el navegador del participante (válido por 15 min):
          </p>
          <code className="block break-all rounded bg-white border border-green-200 px-3 py-2 text-xs text-gray-800 select-all">
            {decodeURIComponent(preview)}
          </code>
          <p className="mt-2 text-xs text-green-600">
            ✓ Abre el enlace en una ventana de incógnito para simular la experiencia del participante.
          </p>
        </div>
      )}

      {/* Formulario */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Generar enlace de acceso
        </h2>
        <form action={generateMagicLinkAdmin} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Correo del participante <span className="text-red-500">*</span>
            </label>
            <input
              name="email"
              type="email"
              required
              placeholder="participante@correo.com"
              list="participant-emails"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
            />
            <datalist id="participant-emails">
              {uniqueEmails.map((p) => (
                <option key={p.user.email} value={p.user.email}>
                  {p.user.name ?? p.user.email}
                </option>
              ))}
            </datalist>
            <p className="text-xs text-gray-400">
              Solo funcionará si el email tiene participaciones activas.
            </p>
          </div>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            Generar enlace
          </button>
        </form>
      </div>

      {/* Tokens recientes */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">
          Tokens recientes (últimas 24 h)
        </h2>
        {recentTokens.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-8 text-center text-sm text-gray-400">
            Sin tokens en las últimas 24 horas.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Expira</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Estado</th>
                </tr>
              </thead>
              <tbody>
                {recentTokens.map((t) => {
                  const isExpired = t.expiresAt < new Date();
                  const isUsed = !!t.usedAt;
                  const status = isUsed ? "Usado" : isExpired ? "Expirado" : "Activo";
                  const statusClass = isUsed
                    ? "bg-gray-100 text-gray-500"
                    : isExpired
                    ? "bg-red-100 text-red-700"
                    : "bg-green-100 text-green-700";

                  return (
                    <tr key={t.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-800">{t.email}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {t.expiresAt.toISOString().substring(11, 16)} UTC
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
