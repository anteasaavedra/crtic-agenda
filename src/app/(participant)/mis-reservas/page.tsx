import Link from "next/link";
import { requireParticipantSession } from "@/lib/participant-session";
import { prisma } from "@/lib/prisma";
import { getISOWeek } from "@/lib/iso-week";
import { safeDecrypt } from "@/lib/encryption";

export default async function MisReservasPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const session = await requireParticipantSession();
  const { success, error } = await searchParams;

  // Reservas del participante (todas sus participaciones)
  const reservations = await prisma.reservation.findMany({
    where: {
      participant: { userId: session.userId },
      status: { in: ["CONFIRMED", "COMPLETED", "NO_SHOW"] },
    },
    include: {
      participant: {
        include: { course: { select: { name: true } } },
      },
      licenseAccount: {
        include: { tool: { select: { name: true } } },
      },
    },
    orderBy: { startsAt: "asc" },
  });

  // ─── Batch-fetch de credenciales ─────────────────────────────────────────
  type CredKey = { licenseAccountId: string; isoYear: number; isoWeek: number };
  const credLookups = new Map<string, CredKey>();

  for (const r of reservations) {
    if (r.status === "CONFIRMED") {
      const { isoYear, isoWeek } = getISOWeek(r.startsAt);
      const key = `${r.licenseAccountId}||${isoYear}||${isoWeek}`;
      if (!credLookups.has(key)) {
        credLookups.set(key, { licenseAccountId: r.licenseAccountId, isoYear, isoWeek });
      }
    }
  }

  const credMap = new Map<string, { username: string; password: string }>();
  if (credLookups.size > 0) {
    const creds = await prisma.weeklyCredential.findMany({
      where: { OR: [...credLookups.values()] },
      select: {
        licenseAccountId: true,
        isoYear: true,
        isoWeek: true,
        usernameEncrypted: true,
        passwordEncrypted: true,
      },
    });
    for (const c of creds) {
      credMap.set(`${c.licenseAccountId}||${c.isoYear}||${c.isoWeek}`, {
        username: safeDecrypt(c.usernameEncrypted),
        password: safeDecrypt(c.passwordEncrypted),
      });
    }
  }

  // Separar en próximas y pasadas
  const now = new Date();
  const upcoming = reservations.filter(
    (r) => r.status === "CONFIRMED" && r.startsAt >= now
  );
  const past = reservations.filter(
    (r) => r.status !== "CONFIRMED" || r.startsAt < now
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mis reservas</h1>
          <p className="mt-1 text-sm text-gray-500">
            {upcoming.length} próxima(s) · {past.length} pasada(s)
          </p>
        </div>
        <Link
          href="/tools"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          + Nueva reserva
        </Link>
      </div>

      {/* Banners */}
      {success === "1" && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          ✓ Reserva creada exitosamente. Las credenciales aparecerán abajo cuando estén disponibles.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Sin reservas */}
      {reservations.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <p className="text-sm text-gray-500">Todavía no tienes reservas.</p>
          <Link
            href="/tools"
            className="mt-4 inline-block text-sm text-slate-600 hover:underline"
          >
            Reservar un horario →
          </Link>
        </div>
      )}

      {/* Próximas reservas */}
      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Próximas
          </h2>
          {upcoming.map((r) => {
            const { isoYear, isoWeek } = getISOWeek(r.startsAt);
            const credential = credMap.get(`${r.licenseAccountId}||${isoYear}||${isoWeek}`);
            const startIso = r.startsAt.toISOString();
            const endIso = r.endsAt.toISOString();
            const dateStr = startIso.substring(0, 10);
            const startH = startIso.substring(11, 16);
            const endH = endIso.substring(11, 16);
            const durationMin = (r.endsAt.getTime() - r.startsAt.getTime()) / 60_000;
            const weekLabel = `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;

            return (
              <div
                key={r.id}
                className="overflow-hidden rounded-xl border border-green-200 bg-white shadow-sm"
              >
                {/* Barra superior */}
                <div className="border-b border-green-100 bg-green-50 px-5 py-2.5 flex items-center justify-between">
                  <span className="text-sm font-semibold text-green-800">
                    {r.licenseAccount.tool.name}
                  </span>
                  <span className="text-xs text-green-600">
                    {r.participant?.course.name ?? "—"}
                  </span>
                </div>

                <div className="px-5 py-4 space-y-3">
                  {/* Horario */}
                  <div>
                    <p className="text-base font-semibold text-gray-900 capitalize">
                      {new Date(`${dateStr}T12:00:00Z`).toLocaleDateString("es-CL", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        timeZone: "UTC",
                      })}
                    </p>
                    <p className="font-mono text-sm text-gray-600">
                      {startH} — {endH} UTC
                      <span className="ml-2 font-sans text-xs text-gray-400">
                        ({durationMin} min)
                      </span>
                    </p>
                  </div>

                  {/* Credenciales */}
                  {credential ? (
                    <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                        Credenciales de acceso — semana {weekLabel}
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <span className="text-gray-500">Usuario</span>
                        <span className="font-mono font-medium text-gray-900 select-all">
                          {credential.username}
                        </span>
                        <span className="text-gray-500">Contraseña</span>
                        <span className="font-mono font-medium text-gray-900 select-all">
                          {credential.password}
                        </span>
                      </div>
                      <p className="text-xs text-blue-500 mt-1">
                        Estas credenciales son válidas solo para la semana {weekLabel}.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
                      <p className="text-xs text-amber-700">
                        ⏳ Las credenciales de acceso para la semana {weekLabel} aún no están
                        disponibles. El administrador las cargará próximamente.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Reservas pasadas / completadas */}
      {past.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Historial
          </h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <tbody>
                {past.map((r) => {
                  const startIso = r.startsAt.toISOString();
                  const dateStr = startIso.substring(0, 10);
                  const startH = startIso.substring(11, 16);
                  const endH = r.endsAt.toISOString().substring(11, 16);

                  const statusColors: Record<string, string> = {
                    CONFIRMED:  "bg-yellow-100 text-yellow-800",
                    COMPLETED:  "bg-gray-100 text-gray-600",
                    NO_SHOW:    "bg-red-100 text-red-700",
                    CANCELLED:  "bg-red-100 text-red-700",
                  };
                  const statusLabels: Record<string, string> = {
                    CONFIRMED:  "Pasada",
                    COMPLETED:  "Completada",
                    NO_SHOW:    "No asistió",
                    CANCELLED:  "Cancelada",
                  };

                  return (
                    <tr
                      key={r.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">
                          {r.licenseAccount.tool.name}
                        </p>
                        <p className="text-xs text-gray-500">{r.participant?.course.name ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">
                        {dateStr}<br />
                        <span className="text-gray-400">{startH}–{endH} UTC</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            statusColors[r.status] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {statusLabels[r.status] ?? r.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
