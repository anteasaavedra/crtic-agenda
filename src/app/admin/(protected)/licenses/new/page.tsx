import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createLicense } from "@/actions/licenses";

export default async function NewLicensePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const tools = await prisma.tool.findMany({
    where: { isActive: true, category: "LICENCIA" },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/licenses" className="hover:text-gray-700">Licencias</Link>
        <span>/</span>
        <span className="text-gray-900">Nueva licencia</span>
      </div>

      <h1 className="mt-4 text-2xl font-bold text-gray-900">Nueva licencia</h1>
      <p className="mt-1 text-sm text-gray-500">
        Una licencia es una cuenta física (login) de la herramienta que los participantes compartirán.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm max-w-xl">
        {error && (
          <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {decodeURIComponent(error)}
          </div>
        )}

        {tools.length === 0 ? (
          <div className="rounded-md bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
            Primero debes{" "}
            <Link href="/admin/tools/new" className="font-semibold underline">
              crear una herramienta
            </Link>{" "}
            antes de poder agregar licencias.
          </div>
        ) : (
          <form action={createLicense} className="space-y-5">
            {/* Herramienta */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Herramienta <span className="text-red-500">*</span>
              </label>
              <select
                name="toolId"
                required
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              >
                <option value="">Selecciona una herramienta</option>
                {tools.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Etiqueta */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Etiqueta <span className="text-red-500">*</span>
              </label>
              <input
                name="label"
                type="text"
                required
                placeholder="Ej: Krea cuenta 1, Runway principal"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
              <p className="text-xs text-gray-400">
                Nombre interno para identificar esta cuenta.
              </p>
            </div>

            {/* Email de la cuenta */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Email de la cuenta (opcional)
              </label>
              <input
                name="accountEmail"
                type="email"
                placeholder="cuenta@ejemplo.com"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
              <p className="text-xs text-gray-400">
                Referencia interna, no se comparte con participantes.
              </p>
            </div>

            {/* Notas */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Notas internas</label>
              <textarea
                name="notes"
                rows={2}
                placeholder="Información adicional para el equipo..."
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
            </div>

            {/* Aviso seguridad */}
            <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
              Las credenciales de acceso (usuario y contraseña) se cargan por separado
              en <Link href="/admin/credentials" className="font-semibold underline">Gestión de Credenciales</Link> y
              se cifran con AES-256-GCM antes de guardarse.
            </div>

            {/* Acciones */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                Crear licencia
              </button>
              <Link
                href="/admin/licenses"
                className="rounded-md border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
