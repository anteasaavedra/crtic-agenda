import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createMentor } from "@/actions/mentors";

export default async function NewMentorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const areas = await prisma.tool.findMany({
    where: { isActive: true, category: "MENTORIA" },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/mentores" className="hover:text-gray-700">Mentores</Link>
        <span>/</span>
        <span className="text-gray-900">Nuevo mentor</span>
      </div>

      <h1 className="mt-4 text-2xl font-bold text-gray-900">Nuevo mentor</h1>
      <p className="mt-1 text-sm text-gray-500">
        Agrega un mentor con su email de Google para que el sistema pueda crearle invitaciones de Meet automáticamente.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm max-w-xl">
        {error && (
          <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {decodeURIComponent(error)}
          </div>
        )}

        {areas.length === 0 ? (
          <div className="rounded-md bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
            Primero debes{" "}
            <Link href="/admin/tools/new" className="font-semibold underline">
              crear una herramienta de tipo Mentoría
            </Link>{" "}
            antes de poder agregar mentores.
          </div>
        ) : (
          <form action={createMentor} className="space-y-5">
            {/* Nombre */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Nombre del mentor <span className="text-red-500">*</span>
              </label>
              <input
                name="label"
                type="text"
                required
                placeholder="Ej: Ana López"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
            </div>

            {/* Email Google */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Email Google <span className="text-red-500">*</span>
              </label>
              <input
                name="accountEmail"
                type="email"
                required
                placeholder="mentor@crtic.cl"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
              <p className="text-xs text-gray-400">
                Se usará para enviar el invite de Google Meet al confirmar una reserva.
              </p>
            </div>

            {/* Área de mentoría */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Área de mentoría <span className="text-red-500">*</span>
              </label>
              <select
                name="toolId"
                required
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              >
                <option value="">Selecciona un área</option>
                {areas.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Notas */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Notas internas</label>
              <textarea
                name="notes"
                rows={2}
                placeholder="Especialidad, disponibilidad especial, etc."
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
            </div>

            {/* Acciones */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Crear mentor
              </button>
              <Link
                href="/admin/mentores"
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
