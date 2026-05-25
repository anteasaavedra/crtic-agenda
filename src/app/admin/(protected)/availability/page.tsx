import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { generateAvailabilityBulk } from "@/actions/availability";
import { TimeRangePicker } from "@/components/admin/time-range-picker";

export const dynamic = "force-dynamic";

const WEEKDAYS = [
  { value: "1", label: "Lun" },
  { value: "2", label: "Mar" },
  { value: "3", label: "Mié" },
  { value: "4", label: "Jue" },
  { value: "5", label: "Vie" },
  { value: "6", label: "Sáb" },
  { value: "0", label: "Dom" },
];

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;

  const licenses = await prisma.licenseAccount.findMany({
    where: { isActive: true },
    include: {
      tool: { select: { name: true } },
      _count: {
        select: { availability: { where: { isBlocked: false } } },
      },
    },
    orderBy: [{ tool: { name: "asc" } }, { label: "asc" }],
  });

  const today = new Date().toISOString().split("T")[0];
  const inTwoMonths = new Date();
  inTwoMonths.setMonth(inTwoMonths.getMonth() + 2);
  const defaultTo = inTwoMonths.toISOString().split("T")[0];

  // Agrupar licencias por herramienta para los checkboxes
  const byTool = new Map<string, { toolName: string; licenses: typeof licenses }>();
  for (const l of licenses) {
    if (!byTool.has(l.tool.name)) byTool.set(l.tool.name, { toolName: l.tool.name, licenses: [] });
    byTool.get(l.tool.name)!.licenses.push(l);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Disponibilidad</h1>
        <p className="mt-1 text-sm text-gray-500">
          Genera bloques horarios en masa o gestiona días individuales por licencia.
        </p>
      </div>

      {/* Banners */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          ✓ Se generaron <strong>{success}</strong> slots de disponibilidad correctamente.
        </div>
      )}

      {/* ── Generador masivo ────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">
          Generar disponibilidad en masa
        </h2>
        <p className="text-xs text-gray-500 mb-5">
          Define un rango de fechas, horario y días de la semana. Se crearán bloques automáticamente para las licencias seleccionadas.
        </p>

        <form action={generateAvailabilityBulk} className="space-y-5">
          {/* Licencias */}
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-2">
              Licencias <span className="text-red-500">*</span>
            </p>
            <div className="space-y-3">
              {[...byTool.entries()].map(([toolName, { licenses: tls }]) => (
                <div key={toolName}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    {toolName}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {tls.map((l) => (
                      <label
                        key={l.id}
                        className="flex items-center gap-2 cursor-pointer rounded-md border border-gray-200 px-3 py-2 text-sm hover:border-slate-400 transition-colors"
                      >
                        <input
                          type="checkbox"
                          name="licenseIds[]"
                          value={l.id}
                          defaultChecked
                          className="h-4 w-4 rounded border-gray-300 text-slate-700"
                        />
                        <span className="text-gray-800">{l.label}</span>
                        <span className="text-xs text-gray-400">
                          ({l._count.availability} slots)
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rango de fechas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Desde <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="dateFrom"
                required
                defaultValue={today}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hasta <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="dateTo"
                required
                defaultValue={defaultTo}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
            </div>
          </div>

          {/* Días de la semana */}
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-2">
              Días de la semana <span className="text-red-500">*</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => (
                <label
                  key={d.value}
                  className="flex items-center gap-1.5 cursor-pointer rounded-md border border-gray-200 px-3 py-2 text-sm hover:border-slate-400 transition-colors"
                >
                  <input
                    type="checkbox"
                    name="weekdays[]"
                    value={d.value}
                    defaultChecked={["1","2","3","4","5"].includes(d.value)}
                    className="h-4 w-4 rounded border-gray-300 text-slate-700"
                  />
                  <span className="text-gray-800">{d.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Horario */}
          <TimeRangePicker defaultStart="09:00" defaultEnd="19:30" />

          {/* UTC offset */}
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Zona horaria
            </label>
            <select
              name="utcOffset"
              defaultValue="-4"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
            >
              <option value="-3">Chile verano (UTC−3)</option>
              <option value="-4">Chile invierno (UTC−4)</option>
            </select>
          </div>

          {/* Opción limpiar antes */}
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
            <input
              type="checkbox"
              name="clearFirst"
              className="h-4 w-4 rounded border-gray-300 text-slate-700"
            />
            Eliminar slots existentes en el rango antes de generar
            <span className="text-xs text-gray-400">(útil para re-generar sin duplicados)</span>
          </label>

          <button
            type="submit"
            className="rounded-md bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Generar slots
          </button>
        </form>
      </div>

      {/* ── Tabla de licencias ──────────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">
          Estado por licencia
        </h2>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {licenses.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-gray-400">
              No hay licencias activas.{" "}
              <Link href="/admin/licenses" className="text-slate-600 hover:underline">
                Ir a Licencias →
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Herramienta</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Licencia</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Slots disponibles</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {licenses.map((l) => (
                  <tr key={l.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{l.tool.name}</td>
                    <td className="px-4 py-3 text-gray-700">{l.label}</td>
                    <td className="px-4 py-3 text-center">
                      {l._count.availability > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                          {l._count.availability} slots
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                          Sin disponibilidad
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/availability/${l.id}`}
                        className="text-sm font-medium text-slate-600 hover:text-slate-900"
                      >
                        Ver / editar →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
