import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { upsertCredential, deleteCredential } from "@/actions/credentials";
import { safeDecrypt } from "@/lib/encryption";
import { formatISOWeek, currentISOWeek } from "@/lib/iso-week";
import { DeleteConfirmButton } from "@/components/admin/delete-confirm-button";
import { formatDate } from "@/lib/utils";

export default async function CredentialsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { isoYear, isoWeek } = currentISOWeek();

  const [licenses, credentials] = await Promise.all([
    prisma.licenseAccount.findMany({
      where: { isActive: true },
      include: { tool: { select: { name: true } } },
      orderBy: [{ tool: { name: "asc" } }, { label: "asc" }],
    }),
    prisma.weeklyCredential.findMany({
      include: {
        licenseAccount: {
          include: { tool: { select: { name: true } } },
        },
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: [
        { licenseAccount: { tool: { name: "asc" } } },
        { licenseAccount: { label: "asc" } },
        { isoYear: "desc" },
        { isoWeek: "desc" },
      ],
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Credenciales semanales</h1>
        <p className="mt-1 text-sm text-gray-500">
          Las contraseñas se cifran con AES-256-GCM antes de guardarse. Solo el usuario se muestra aquí.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Formulario para cargar credenciales */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm max-w-2xl">
        <h2 className="text-base font-semibold text-gray-900 mb-1">
          Cargar o actualizar credenciales
        </h2>
        <p className="text-xs text-gray-400 mb-5">
          Si ya existen credenciales para esa licencia + semana, se reemplazarán.
          La contraseña anterior quedará irrecuperable.
        </p>

        {licenses.length === 0 ? (
          <div className="rounded-md bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
            Primero debes{" "}
            <Link href="/admin/licenses/new" className="font-semibold underline">
              crear licencias
            </Link>{" "}
            antes de cargar credenciales.
          </div>
        ) : (
          <form action={upsertCredential} className="space-y-5">
            {/* Licencia */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Licencia <span className="text-red-500">*</span>
              </label>
              <select
                name="licenseAccountId"
                required
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              >
                <option value="">Selecciona una licencia</option>
                {licenses.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.tool.name} — {l.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Año y semana ISO */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Año ISO <span className="text-red-500">*</span>
                </label>
                <input
                  name="isoYear"
                  type="number"
                  required
                  min="2020"
                  max="2099"
                  defaultValue={isoYear}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Semana ISO <span className="text-red-500">*</span>
                </label>
                <input
                  name="isoWeek"
                  type="number"
                  required
                  min="1"
                  max="53"
                  defaultValue={isoWeek}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 -mt-3">
              Semana actual: <strong>{formatISOWeek(isoYear, isoWeek)}</strong>
            </p>

            {/* Usuario */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Usuario <span className="text-red-500">*</span>
              </label>
              <input
                name="username"
                type="text"
                required
                autoComplete="off"
                placeholder="usuario@plataforma.com"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
            </div>

            {/* Contraseña */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Contraseña <span className="text-red-500">*</span>
              </label>
              <input
                name="password"
                type="password"
                required
                autoComplete="new-password"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
              <p className="text-xs text-amber-600">
                ⚠️ La contraseña se cifra al guardar y no puede verse después.
                Asegúrate de ingresar el valor correcto.
              </p>
            </div>

            <button
              type="submit"
              className="rounded-md bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              Guardar credenciales
            </button>
          </form>
        )}
      </div>

      {/* Tabla de credenciales existentes */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">
          Credenciales registradas ({credentials.length})
        </h2>
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          {credentials.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-gray-400">
              No hay credenciales cargadas aún.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Herramienta</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Licencia</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Semana</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Válida</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Usuario</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Contraseña</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Cargada por</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {credentials.map((c) => {
                  const username = safeDecrypt(c.usernameEncrypted);
                  const isCurrentWeek =
                    c.isoYear === isoYear && c.isoWeek === isoWeek;
                  return (
                    <tr
                      key={c.id}
                      className={`border-b border-gray-100 last:border-0 ${
                        isCurrentWeek ? "bg-green-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {c.licenseAccount.tool.name}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {c.licenseAccount.label}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">
                        {formatISOWeek(c.isoYear, c.isoWeek)}
                        {isCurrentWeek && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            actual
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {formatDate(c.validFrom)} — {formatDate(c.validUntil)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-800">
                        {username}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-400 tracking-widest">
                        ••••••••
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {c.createdBy.name ?? c.createdBy.email}
                        <br />
                        <span className="text-gray-400">
                          {formatDate(c.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <form action={deleteCredential}>
                          <input type="hidden" name="id" value={c.id} />
                          <DeleteConfirmButton
                            message="¿Eliminar estas credenciales? Esta acción no se puede deshacer."
                          />
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
