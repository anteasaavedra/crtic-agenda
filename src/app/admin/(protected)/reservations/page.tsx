import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createReservationAdmin, cancelReservationAdmin } from "@/actions/reservations";
import { getISOWeek } from "@/lib/iso-week";
import type { ReservationStatus } from "@prisma/client";

const STATUS_LABELS: Record<ReservationStatus, { label: string; className: string }> = {
  CONFIRMED: { label: "Confirmada", className: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Cancelada", className: "bg-red-100 text-red-800" },
  COMPLETED: { label: "Completada", className: "bg-blue-100 text-blue-800" },
  NO_SHOW:   { label: "No asistió", className: "bg-yellow-100 text-yellow-800" },
};

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "",           label: "Todas" },
  { value: "CONFIRMED",  label: "Confirmadas" },
  { value: "CANCELLED",  label: "Canceladas" },
  { value: "COMPLETED",  label: "Completadas" },
  { value: "NO_SHOW",    label: "No asistió" },
];

const VALID_STATUSES: ReservationStatus[] = ["CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"];

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; warning?: string; status?: string }>;
}) {
  const { error, warning, status } = await searchParams;

  const statusFilter: ReservationStatus | undefined =
    status && VALID_STATUSES.includes(status as ReservationStatus)
      ? (status as ReservationStatus)
      : undefined;

  // Parallel: form data + reservations
  const [participants, tools, reservations] = await Promise.all([
    prisma.participant.findMany({
      where: { status: "ACTIVE" },
      include: {
        user:   { select: { name: true, email: true } },
        course: { select: { name: true } },
      },
      orderBy: [{ course: { name: "asc" } }, { user: { name: "asc" } }],
    }),
    prisma.tool.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.reservation.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
      include: {
        participant: {
          include: {
            user:   { select: { name: true, email: true } },
            course: { select: { name: true } },
          },
        },
        licenseAccount: {
          include: { tool: { select: { name: true } } },
        },
      },
      orderBy: { startsAt: "desc" },
      take: 200,
    }),
  ]);

  // Helper: nombre e email de quien hizo la reserva (guest o participante)
  const getReservee = (r: (typeof reservations)[number]) => {
    if (r.guestName || r.guestEmail) {
      return { name: r.guestName ?? "—", email: r.guestEmail ?? "—", course: "Público" };
    }
    if (r.participant) {
      return {
        name: r.participant.user.name ?? "—",
        email: r.participant.user.email ?? "—",
        course: r.participant.course.name,
      };
    }
    return { name: "—", email: "—", course: "—" };
  };

  // Batch-check credentials — one query, no N+1
  // Build a map of unique (licenseAccountId, isoYear, isoWeek) for CONFIRMED reservations
  type CredKey = { licenseAccountId: string; isoYear: number; isoWeek: number };
  const credentialLookups = new Map<string, CredKey>();
  for (const r of reservations) {
    if (r.status === "CONFIRMED") {
      const { isoYear, isoWeek } = getISOWeek(r.startsAt);
      const key = `${r.licenseAccountId}||${isoYear}||${isoWeek}`;
      if (!credentialLookups.has(key)) {
        credentialLookups.set(key, { licenseAccountId: r.licenseAccountId, isoYear, isoWeek });
      }
    }
  }

  const credentialSet = new Set<string>();
  if (credentialLookups.size > 0) {
    const creds = await prisma.weeklyCredential.findMany({
      where: { OR: [...credentialLookups.values()] },
      select: { licenseAccountId: true, isoYear: true, isoWeek: true },
    });
    for (const c of creds) {
      credentialSet.add(`${c.licenseAccountId}||${c.isoYear}||${c.isoWeek}`);
    }
  }

  // Summary stats (over full result set)
  const confirmedCount = reservations.filter((r) => r.status === "CONFIRMED").length;
  const missingCredCount = reservations.filter((r) => {
    if (r.status !== "CONFIRMED") return false;
    const { isoYear, isoWeek } = getISOWeek(r.startsAt);
    return !credentialSet.has(`${r.licenseAccountId}||${isoYear}||${isoWeek}`);
  }).length;

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservas</h1>
          <p className="mt-1 text-sm text-gray-500">
            {confirmedCount} reserva(s) confirmada(s)
            {missingCredCount > 0 && (
              <span className="ml-2 font-medium text-amber-600">
                · ⚠️ {missingCredCount} sin credencial para su semana
              </span>
            )}
          </p>
        </div>
        <Link
          href="/admin/reservations/seguimiento"
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Ver seguimiento →
        </Link>
      </div>

      {/* Banners */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}
      {warning && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          ⚠️ {decodeURIComponent(warning)}
        </div>
      )}

      {/* Test create form */}
      <div className="max-w-2xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">
          Crear reserva de prueba
        </h2>
        <p className="mb-4 mt-0.5 text-xs text-gray-500">
          Solo para testing. La licencia se asigna automáticamente según disponibilidad.
          Los horarios son en UTC.
        </p>
        <form action={createReservationAdmin} className="grid grid-cols-2 gap-4">
          {/* Participant */}
          <div className="col-span-2 space-y-1 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700">
              Participante <span className="text-red-500">*</span>
            </label>
            <select
              name="participantId"
              required
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
            >
              <option value="">— Seleccionar —</option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.user.name ?? p.user.email} · {p.course.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tool */}
          <div className="col-span-2 space-y-1 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700">
              Herramienta <span className="text-red-500">*</span>
            </label>
            <select
              name="toolId"
              required
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
            >
              <option value="">— Seleccionar —</option>
              {tools.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.defaultSlotMinutes} min)
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Fecha (UTC) <span className="text-red-500">*</span>
            </label>
            <input
              name="date"
              type="date"
              required
              defaultValue={today}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
            />
          </div>

          {/* Start time */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Hora inicio (UTC) <span className="text-red-500">*</span>
            </label>
            <input
              name="time"
              type="time"
              required
              defaultValue="09:00"
              step="1800"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
            />
          </div>

          <div className="col-span-2">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              Crear reserva
            </button>
          </div>
        </form>
      </div>

      {/* Table section */}
      <div>
        {/* Status filter tabs */}
        <div className="mb-3 flex items-center gap-1">
          {STATUS_FILTER_OPTIONS.map((opt) => {
            const isActive = (status ?? "") === opt.value;
            return (
              <Link
                key={opt.value}
                href={
                  opt.value
                    ? `/admin/reservations?status=${opt.value}`
                    : "/admin/reservations"
                }
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </Link>
            );
          })}
          <span className="ml-2 text-xs text-gray-400">
            {reservations.length} resultado(s)
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {reservations.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-gray-400">
              No hay reservas
              {statusFilter
                ? ` con estado "${STATUS_LABELS[statusFilter]?.label ?? statusFilter}"`
                : ""}
              .
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Participante
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Curso
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Herramienta / Licencia
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Horario (UTC)
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                      Credencial
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((r) => {
                    const startIso = r.startsAt.toISOString();
                    const endIso   = r.endsAt.toISOString();
                    const dateStr  = startIso.substring(0, 10);
                    const startH   = startIso.substring(11, 16);
                    const endH     = endIso.substring(11, 16);
                    const durationMin =
                      (r.endsAt.getTime() - r.startsAt.getTime()) / 60_000;
                    const { isoYear, isoWeek } = getISOWeek(r.startsAt);
                    const credKey = `${r.licenseAccountId}||${isoYear}||${isoWeek}`;
                    const hasCredential = credentialSet.has(credKey);
                    const weekLabel = `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;
                    const statusInfo =
                      STATUS_LABELS[r.status] ?? {
                        label: r.status,
                        className: "bg-gray-100 text-gray-600",
                      };

                    const reservee = getReservee(r);

                    return (
                      <tr
                        key={r.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                      >
                        {/* Participant / Guest */}
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">
                            {reservee.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {reservee.email}
                          </p>
                        </td>

                        {/* Course / Origen */}
                        <td className="px-4 py-3 text-xs text-gray-700">
                          {reservee.course}
                        </td>

                        {/* Tool / License */}
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">
                            {r.licenseAccount.tool.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {r.licenseAccount.label}
                          </p>
                        </td>

                        {/* Schedule */}
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs text-gray-800">{dateStr}</p>
                          <p className="font-mono text-xs text-gray-500">
                            {startH} — {endH}{" "}
                            <span className="text-gray-400">({durationMin} min)</span>
                          </p>
                        </td>

                        {/* Status badge */}
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.className}`}
                          >
                            {statusInfo.label}
                          </span>
                        </td>

                        {/* Credential indicator */}
                        <td className="px-4 py-3 text-center">
                          {r.status === "CONFIRMED" ? (
                            hasCredential ? (
                              <span
                                className="text-sm text-green-600"
                                title={`Credencial disponible para ${weekLabel}`}
                              >
                                ✓
                              </span>
                            ) : (
                              <Link
                                href="/admin/credentials"
                                className="text-sm text-amber-600 hover:text-amber-800"
                                title={`Sin credencial para ${weekLabel} — click para ir a Credenciales`}
                              >
                                ⚠️
                              </Link>
                            )
                          ) : (
                            <span className="text-gray-300 text-sm">—</span>
                          )}
                        </td>

                        {/* Cancel action */}
                        <td className="px-4 py-3 text-right">
                          {r.status === "CONFIRMED" && (
                            <form
                              action={cancelReservationAdmin}
                              className="flex items-center justify-end gap-2"
                            >
                              <input type="hidden" name="id" value={r.id} />
                              <input
                                name="reason"
                                type="text"
                                placeholder="Motivo..."
                                className="w-32 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                              />
                              <button
                                type="submit"
                                className="whitespace-nowrap text-xs font-medium text-red-500 hover:text-red-700"
                              >
                                Cancelar
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
