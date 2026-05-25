import Link from "next/link";
import { createCourse } from "@/actions/courses";

export default async function NewCoursePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/courses" className="hover:text-gray-700">Cursos</Link>
        <span>/</span>
        <span className="text-gray-900">Nuevo curso</span>
      </div>

      <h1 className="mt-4 text-2xl font-bold text-gray-900">Nuevo curso</h1>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm max-w-2xl">
        {error && (
          <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {decodeURIComponent(error)}
          </div>
        )}

        <form action={createCourse} className="space-y-5">
          {/* Nombre */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              type="text"
              required
              placeholder="Ej: Residencia IA 2026"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
            />
          </div>

          {/* Descripción */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Descripción
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder="Descripción del curso o programa..."
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
            />
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Fecha de inicio <span className="text-red-500">*</span>
              </label>
              <input
                name="startsOn"
                type="date"
                required
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Fecha de término <span className="text-red-500">*</span>
              </label>
              <input
                name="endsOn"
                type="date"
                required
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
            </div>
          </div>

          {/* Límites */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Máx. reservas por semana
              </label>
              <input
                name="maxReservationsPerWeek"
                type="number"
                min="1"
                placeholder="Sin límite"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Máx. reservas por día
              </label>
              <input
                name="maxReservationsPerDay"
                type="number"
                min="1"
                placeholder="Sin límite"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
            </div>
          </div>

          {/* Ventana de reserva */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Ventana de reserva (días)
            </label>
            <input
              name="reservationWindowDays"
              type="number"
              min="1"
              defaultValue="14"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
            />
            <p className="text-xs text-gray-400">
              ¿Con cuántos días de anticipación puede reservar un participante?
            </p>
          </div>

          {/* Cancelación */}
          <div className="rounded-md border border-gray-200 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <input
                id="allowCancellation"
                name="allowCancellation"
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-gray-300 text-slate-600 focus:ring-slate-500"
              />
              <label htmlFor="allowCancellation" className="text-sm font-medium text-gray-700">
                Permitir que participantes cancelen sus reservas
              </label>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Horas mínimas de anticipación para cancelar
              </label>
              <input
                name="cancellationCutoffHours"
                type="number"
                min="0"
                defaultValue="2"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
            </div>
          </div>

          {/* Acciones */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              Crear curso
            </button>
            <Link
              href="/admin/courses"
              className="rounded-md border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
