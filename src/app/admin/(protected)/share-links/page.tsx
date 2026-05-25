import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { Link2, Trash2, RotateCcw } from "lucide-react";
import {
  createShareLink,
  revokeShareLink,
  reactivateShareLink,
  deleteShareLink,
} from "@/actions/share-links";
import { CopyLinkButton } from "@/components/admin/copy-link-button";

export const dynamic = "force-dynamic";

export default async function ShareLinksPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireAdmin();

  const { error, success } = await searchParams;

  const [links, licenses] = await Promise.all([
    prisma.shareLink.findMany({
      include: {
        tool: true,
        licenseAccount: { select: { id: true, label: true } },
        _count: { select: { reservations: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Todas las licencias activas, agrupadas por herramienta
    prisma.licenseAccount.findMany({
      where: { isActive: true },
      include: { tool: { select: { id: true, name: true } } },
      orderBy: [{ tool: { name: "asc" } }, { label: "asc" }],
    }),
  ]);

  const getShareLinkUrl = (token: string): string => {
    return `${process.env.NEXT_PUBLIC_APP_URL}/r/${token}`;
  };

  const isExpired = (expiresAt: Date | null): boolean => {
    return expiresAt != null && expiresAt < new Date();
  };

  const isRevoked = (revokedAt: Date | null): boolean => {
    return revokedAt != null;
  };

  // Agrupar licencias por herramienta para el <optgroup>
  const licensesByTool = new Map<string, { toolName: string; licenses: typeof licenses }>();
  for (const l of licenses) {
    if (!licensesByTool.has(l.tool.id)) {
      licensesByTool.set(l.tool.id, { toolName: l.tool.name, licenses: [] });
    }
    licensesByTool.get(l.tool.id)!.licenses.push(l);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Link2 className="w-6 h-6" />
          Links de reserva por grupo
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Cada link permite que un grupo acceda a una licencia específica
        </p>
      </div>

      {/* Success/Error messages */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success === "revoked"
            ? "Link revocado correctamente"
            : success === "reactivated"
              ? "Link reactivado correctamente"
              : success === "deleted"
                ? "Link eliminado correctamente"
                : "Link creado correctamente ✓"}
        </div>
      )}

      {/* Create form */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Crear nuevo link de grupo
        </h2>

        <form action={createShareLink} className="space-y-4 max-w-lg">
          {/* Licencia específica */}
          <div>
            <label htmlFor="licenseAccountId" className="block text-sm font-medium text-gray-700 mb-1">
              Licencia <span className="text-red-500">*</span>
            </label>
            <select
              name="licenseAccountId"
              id="licenseAccountId"
              required
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
            >
              <option value="">— Selecciona una licencia —</option>
              {[...licensesByTool.entries()].map(([, { toolName, licenses: tls }]) => (
                <optgroup key={toolName} label={toolName}>
                  {tls.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              El link solo permitirá reservar en esta licencia específica.
            </p>
          </div>

          {/* Etiqueta */}
          <div>
            <label htmlFor="label" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del grupo / descripción <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="label"
              id="label"
              required
              placeholder="Ej. Grupo A — KREA Licencia 1"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
            />
          </div>

          {/* Expiración */}
          <div>
            <label htmlFor="expiresAt" className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de expiración <span className="text-xs text-gray-400">(opcional)</span>
            </label>
            <input
              type="datetime-local"
              name="expiresAt"
              id="expiresAt"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
            />
          </div>

          <button
            type="submit"
            className="rounded-md bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Generar link
          </button>
        </form>
      </div>

      {/* Links list */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Links creados</h2>
        </div>

        {links.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">
            No hay links todavía. Crea uno arriba.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Grupo / Descripción
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Herramienta · Licencia
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                    Reservas
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {links.map((link) => {
                  const url = getShareLinkUrl(link.token);
                  const revoked = isRevoked(link.revokedAt);
                  const expired = isExpired(link.expiresAt);
                  const status = revoked
                    ? "Revocado"
                    : expired
                      ? "Expirado"
                      : "Activo";
                  const statusColor =
                    status === "Activo"
                      ? "bg-green-100 text-green-800"
                      : status === "Expirado"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800";

                  return (
                    <tr key={link.id} className="hover:bg-gray-50">
                      {/* Label + URL */}
                      <td className="px-4 py-4">
                        <p className="font-medium text-gray-900">{link.label}</p>
                        <p className="mt-0.5 font-mono text-xs text-gray-400 truncate max-w-xs">
                          {url}
                        </p>
                      </td>

                      {/* Herramienta · Licencia */}
                      <td className="px-4 py-4">
                        <p className="text-gray-900">{link.tool.name}</p>
                        {link.licenseAccount && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {link.licenseAccount.label}
                          </p>
                        )}
                      </td>

                      {/* Reservas */}
                      <td className="px-4 py-4 text-center text-gray-600">
                        {link._count.reservations}
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
                          {status}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {/* Copiar URL */}
                          <CopyLinkButton url={url} />

                          {!revoked && !expired && (
                            <form action={revokeShareLink} className="inline">
                              <input type="hidden" name="id" value={link.id} />
                              <button
                                type="submit"
                                title="Revocar link"
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </form>
                          )}

                          {revoked && (
                            <form action={reactivateShareLink} className="inline">
                              <input type="hidden" name="id" value={link.id} />
                              <button
                                type="submit"
                                title="Reactivar link"
                                className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">Cómo funciona el acceso por grupo</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-700">
          <li>Crea un link por cada grupo (ej. Grupo A → KREA Licencia 1, Grupo B → KREA Licencia 2)</li>
          <li>Cada link solo muestra disponibilidad de su licencia asignada</li>
          <li>Comparte el link con el grupo correspondiente</li>
          <li>En <strong>Seguimiento</strong> puedes ver cuántas veces ha reservado cada email</li>
        </ol>
      </div>
    </div>
  );
}
