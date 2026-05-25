import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { toggleLicenseStatus } from "@/actions/licenses";

export default async function LicensesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const licenses = await prisma.licenseAccount.findMany({
    where: { tool: { category: "LICENCIA" } },
    include: {
      tool: { select: { name: true } },
      _count: {
        select: {
          weeklyCredentials: true,
          reservations: { where: { status: "CONFIRMED" } },
        },
      },
    },
    orderBy: [{ tool: { name: "asc" } }, { label: "asc" }],
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Licencias</h1>
          <p className="mt-1 text-sm text-gray-500">
            {licenses.length} licencia(s) registrada(s)
          </p>
        </div>
        <Link
          href="/admin/licenses/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          + Nueva licencia
        </Link>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}

      <div className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        {licenses.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">
            No hay licencias. Crea la primera.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Herramienta</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Etiqueta</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Email cuenta</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Credenciales</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Reservas activas</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Estado</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((l) => (
                <tr key={l.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{l.tool.name}</td>
                  <td className="px-4 py-3 text-gray-700">{l.label}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{l.accountEmail ?? "—"}</td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {l._count.weeklyCredentials}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {l._count.reservations}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        l.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {l.isActive ? "Activa" : "Inactiva"}
                      </span>
                      <form action={toggleLicenseStatus}>
                        <input type="hidden" name="id" value={l.id} />
                        <input type="hidden" name="isActive" value={String(l.isActive)} />
                        <button
                          type="submit"
                          className="text-xs text-slate-500 hover:text-slate-800"
                        >
                          {l.isActive ? "Desactivar" : "Activar"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
