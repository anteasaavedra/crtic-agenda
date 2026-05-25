import Link from "next/link";
import { createTool } from "@/actions/tools";

export default async function NewToolPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/tools" className="hover:text-gray-700">Herramientas</Link>
        <span>/</span>
        <span className="text-gray-900">Nueva herramienta</span>
      </div>

      <h1 className="mt-4 text-2xl font-bold text-gray-900">Nueva herramienta</h1>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm max-w-2xl">
        {error && (
          <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {decodeURIComponent(error)}
          </div>
        )}

        <form action={createTool} className="space-y-5">
          {/* Nombre */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              type="text"
              required
              placeholder="Ej: Krea, Runway, Adobe Firefly"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
            />
          </div>

          {/* Descripción */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Descripción</label>
            <textarea
              name="description"
              rows={2}
              placeholder="Breve descripción de la herramienta..."
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
            />
          </div>

          {/* URL de acceso */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              URL de acceso a la plataforma
            </label>
            <input
              name="accessUrl"
              type="url"
              placeholder="Ej: https://krea.ai"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
            />
            <p className="text-xs text-gray-400">
              Se incluirá en los correos de confirmación y recordatorio junto con las credenciales.
            </p>
          </div>

          {/* Instrucciones */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Instrucciones de uso
            </label>
            <textarea
              name="instructionsMd"
              rows={5}
              placeholder="Escribe las instrucciones en Markdown. Se incluirán en el correo de confirmación y en el evento de Calendar."
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
            />
            <p className="text-xs text-gray-400">Soporta Markdown básico</p>
          </div>

          {/* Categoría */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Categoría <span className="text-red-500">*</span>
            </label>
            <select
              name="category"
              required
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              defaultValue="LICENCIA"
            >
              <option value="LICENCIA">🔑 Licencia (KREA, Runway, etc.)</option>
              <option value="MENTORIA">💬 Mentoría</option>
            </select>
          </div>

          {/* Duración */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Bloque por defecto (minutos)
              </label>
              <input
                name="defaultSlotMinutes"
                type="number"
                min="30"
                step="30"
                defaultValue="120"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Máximo por reserva (minutos)
              </label>
              <input
                name="maxReservationMinutes"
                type="number"
                min="30"
                step="30"
                defaultValue="120"
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
              Crear herramienta
            </button>
            <Link
              href="/admin/tools"
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
