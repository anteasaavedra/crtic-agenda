import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createParticipant } from "@/actions/participants";

export default async function NewParticipantPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; courseId?: string }>;
}) {
  const { error, courseId: preselectedCourseId } = await searchParams;

  const courses = await prisma.course.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/participants" className="hover:text-gray-700">Participantes</Link>
        <span>/</span>
        <span className="text-gray-900">Nuevo participante</span>
      </div>

      <h1 className="mt-4 text-2xl font-bold text-gray-900">Nuevo participante</h1>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm max-w-xl">
        {error && (
          <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {decodeURIComponent(error)}
          </div>
        )}

        {courses.length === 0 ? (
          <div className="rounded-md bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
            Primero debes{" "}
            <Link href="/admin/courses/new" className="font-semibold underline">
              crear un curso
            </Link>{" "}
            antes de agregar participantes.
          </div>
        ) : (
          <form action={createParticipant} className="space-y-5">
            {/* Curso */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Curso <span className="text-red-500">*</span>
              </label>
              <select
                name="courseId"
                required
                defaultValue={preselectedCourseId ?? ""}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              >
                <option value="">Selecciona un curso</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Nombre */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Nombre completo <span className="text-red-500">*</span>
              </label>
              <input
                name="name"
                type="text"
                required
                placeholder="Ej: Ana García"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                name="email"
                type="email"
                required
                placeholder="participante@ejemplo.com"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
              <p className="text-xs text-gray-400">
                Se usará para enviar el magic link de acceso y los correos de reserva.
              </p>
            </div>

            {/* Acciones */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                Agregar participante
              </button>
              <Link
                href="/admin/participants"
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
