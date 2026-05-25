import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function ToolsPage() {
  const tools = await prisma.tool.findMany({
    include: {
      _count: { select: { licenses: true, courses: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Herramientas</h1>
          <p className="mt-1 text-sm text-gray-500">{tools.length} herramienta(s) registrada(s)</p>
        </div>
        <Link
          href="/admin/tools/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          + Nueva herramienta
        </Link>
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        {tools.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">
            No hay herramientas. Crea la primera.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">URL de acceso</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Licencias</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Bloque (min)</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Estado</th>
              </tr>
            </thead>
            <tbody>
              {tools.map((t) => (
                <tr key={t.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                  <td className="px-4 py-3 text-sm">
                    {t.accessUrl ? (
                      <a
                        href={t.accessUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-600 hover:text-slate-900 hover:underline font-mono text-xs"
                      >
                        {t.accessUrl}
                      </a>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">{t._count.licenses}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{t.defaultSlotMinutes}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      t.isActive
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {t.isActive ? "Activa" : "Inactiva"}
                    </span>
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
