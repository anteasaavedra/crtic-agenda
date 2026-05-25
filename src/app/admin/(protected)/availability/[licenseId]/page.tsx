import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { createAvailabilitySlot, deleteAvailabilitySlot } from "@/actions/availability";

export default async function LicenseAvailabilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ licenseId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { licenseId } = await params;
  const { error } = await searchParams;

  const license = await prisma.licenseAccount.findUnique({
    where: { id: licenseId },
    include: {
      tool: { select: { name: true, defaultSlotMinutes: true } },
      availability: {
        orderBy: { startsAt: "asc" },
      },
    },
  });

  if (!license) notFound();

  const today = new Date().toISOString().split("T")[0];

  // Agrupar slots por fecha para mejor visualización
  const slotsByDate = license.availability.reduce<
    Record<string, typeof license.availability>
  >((acc, slot) => {
    const key = slot.startsAt.toISOString().split("T")[0];
    if (!acc[key]) acc[key] = [];
    acc[key].push(slot);
    return acc;
  }, {});

  const availableCount = license.availability.filter((s) => !s.isBlocked).length;
  const blockedCount = license.availability.filter((s) => s.isBlocked).length;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/availability" className="hover:text-gray-700">Disponibilidad</Link>
        <span>/</span>
        <span className="text-gray-900">{license.tool.name} — {license.label}</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {license.tool.name} — {license.label}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {availableCount} slot(s) de disponibilidad · {blockedCount} bloqueado(s) ·
          Bloque por defecto: {license.tool.defaultSlotMinutes} min
        </p>
        <p className="mt-1 text-xs text-amber-600">
          ⚠️ Los horarios son en UTC. Chile continental: UTC−4 (verano) / UTC−3 (invierno).
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Formulario para agregar slot */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm max-w-xl">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Agregar slot de disponibilidad
        </h2>
        <form action={createAvailabilitySlot} className="space-y-4">
          <input type="hidden" name="licenseAccountId" value={license.id} />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Fecha <span className="text-red-500">*</span>
            </label>
            <input
              name="date"
              type="date"
              required
              defaultValue={today}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Hora inicio (UTC) <span className="text-red-500">*</span>
              </label>
              <input
                name="startTime"
                type="time"
                required
                defaultValue="09:00"
                step="1800"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Hora término (UTC) <span className="text-red-500">*</span>
              </label>
              <input
                name="endTime"
                type="time"
                required
                defaultValue="18:00"
                step="1800"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-md border border-gray-200 px-4 py-3">
            <input
              id="isBlocked"
              name="isBlocked"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-slate-600"
            />
            <label htmlFor="isBlocked" className="text-sm font-medium text-gray-700">
              Marcar como bloqueado (mantenimiento, feriado, etc.)
            </label>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Motivo del bloqueo (opcional)
            </label>
            <input
              name="reason"
              type="text"
              placeholder="Ej: Mantenimiento programado"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
            />
          </div>

          <button
            type="submit"
            className="rounded-md bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            Agregar slot
          </button>
        </form>
      </div>

      {/* Lista de slots */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">
          Slots definidos ({license.availability.length})
        </h2>

        {license.availability.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-10 text-center text-sm text-gray-400">
            No hay slots definidos. Agrega el primero arriba.
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(slotsByDate).map(([date, slots]) => (
              <div
                key={date}
                className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden"
              >
                <div className="border-b border-gray-100 bg-gray-50 px-4 py-2">
                  <p className="text-sm font-medium text-gray-700">
                    {new Date(date + "T12:00:00Z").toLocaleDateString("es-CL", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      timeZone: "UTC",
                    })}
                  </p>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {slots.map((slot) => {
                      const startH = slot.startsAt.toISOString().substring(11, 16);
                      const endH = slot.endsAt.toISOString().substring(11, 16);
                      const durationMin =
                        (slot.endsAt.getTime() - slot.startsAt.getTime()) / 60_000;
                      return (
                        <tr
                          key={slot.id}
                          className="border-b border-gray-50 last:border-0"
                        >
                          <td className="px-4 py-3 font-mono text-sm text-gray-800">
                            {startH} — {endH} UTC
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {durationMin} min
                          </td>
                          <td className="px-4 py-3">
                            {slot.isBlocked ? (
                              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                                Bloqueado{slot.reason ? `: ${slot.reason}` : ""}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                                Disponible
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <form action={deleteAvailabilitySlot}>
                              <input type="hidden" name="id" value={slot.id} />
                              <input
                                type="hidden"
                                name="licenseAccountId"
                                value={license.id}
                              />
                              <button
                                type="submit"
                                className="text-xs text-red-500 hover:text-red-700"
                              >
                                Eliminar
                              </button>
                            </form>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
