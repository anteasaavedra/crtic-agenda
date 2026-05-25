import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SeguimientoPage({
  searchParams,
}: {
  searchParams: Promise<{ toolId?: string }>;
}) {
  const { toolId } = await searchParams;

  const tools = await prisma.tool.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  // ── Obtener IDs de licencias del tool seleccionado (o todas) ──────────────
  const licenseWhere = toolId
    ? { toolId }
    : {};

  const licenses = await prisma.licenseAccount.findMany({
    where: licenseWhere,
    select: { id: true, toolId: true },
  });

  const licenseIds = licenses.map((l) => l.id);

  // ── Reservas confirmadas agrupadas por email ───────────────────────────────
  const reservations = await prisma.reservation.findMany({
    where: {
      licenseAccountId: { in: licenseIds },
      status: "CONFIRMED",
      OR: [
        { guestEmail: { not: null } },
        { participant: { isNot: null } },
      ],
    },
    include: {
      participant: { include: { user: { select: { name: true, email: true } } } },
      licenseAccount: { include: { tool: { select: { id: true, name: true } } } },
    },
    orderBy: { startsAt: "asc" },
  });

  // ── Agregar por email ──────────────────────────────────────────────────────
  type Row = {
    name: string;
    email: string;
    byTool: Record<string, { toolName: string; count: number; lastDate: Date }>;
    total: number;
  };
  const byEmail = new Map<string, Row>();

  for (const r of reservations) {
    const email =
      r.guestEmail ??
      r.participant?.user.email ??
      null;
    if (!email) continue;

    const name =
      r.guestName ??
      r.participant?.user.name ??
      email;

    const tool = r.licenseAccount.tool;

    if (!byEmail.has(email)) {
      byEmail.set(email, { name, email, byTool: {}, total: 0 });
    }

    const row = byEmail.get(email)!;
    row.total += 1;

    if (!row.byTool[tool.id]) {
      row.byTool[tool.id] = { toolName: tool.name, count: 0, lastDate: r.startsAt };
    }
    row.byTool[tool.id].count += 1;
    if (r.startsAt > row.byTool[tool.id].lastDate) {
      row.byTool[tool.id].lastDate = r.startsAt;
    }
  }

  const rows = [...byEmail.values()].sort((a, b) => b.total - a.total);

  const selectedTool = tools.find((t) => t.id === toolId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Seguimiento de uso</h1>
          <p className="mt-1 text-sm text-gray-500">
            Número de reservas confirmadas por participante
            {selectedTool ? ` — ${selectedTool.name}` : " — todas las herramientas"}
          </p>
        </div>
        <Link
          href="/admin/reservations"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← Reservas
        </Link>
      </div>

      {/* Filtro por herramienta */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/admin/reservations/seguimiento"
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            !toolId
              ? "bg-slate-900 text-white"
              : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          Todas
        </Link>
        {tools.map((t) => (
          <Link
            key={t.id}
            href={`/admin/reservations/seguimiento?toolId=${t.id}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              toolId === t.id
                ? "bg-slate-900 text-white"
                : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t.name}
          </Link>
        ))}
        <span className="ml-2 text-xs text-gray-400">
          {rows.length} participante(s)
        </span>
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">
            No hay reservas confirmadas
            {selectedTool ? ` para ${selectedTool.name}` : ""}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Participante
                  </th>
                  {toolId ? (
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                      Reservas
                    </th>
                  ) : (
                    tools.map((t) => (
                      <th
                        key={t.id}
                        className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500"
                        title={t.name}
                      >
                        {t.name.length > 12 ? t.name.slice(0, 12) + "…" : t.name}
                      </th>
                    ))
                  )}
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-700">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.email}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                  >
                    {/* Nombre / email */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{row.name}</p>
                      <p className="text-xs text-gray-500">{row.email}</p>
                    </td>

                    {/* Conteo por herramienta */}
                    {toolId ? (
                      <td className="px-4 py-3 text-center">
                        <CountBadge count={row.byTool[toolId]?.count ?? 0} />
                      </td>
                    ) : (
                      tools.map((t) => {
                        const entry = row.byTool[t.id];
                        return (
                          <td key={t.id} className="px-4 py-3 text-center">
                            <CountBadge count={entry?.count ?? 0} />
                          </td>
                        );
                      })
                    )}

                    {/* Total */}
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-800">
                        {row.total}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CountBadge({ count }: { count: number }) {
  if (count === 0)
    return <span className="text-gray-300 text-sm">—</span>;
  const color =
    count >= 5
      ? "bg-red-100 text-red-800"
      : count >= 3
      ? "bg-amber-100 text-amber-800"
      : "bg-green-100 text-green-800";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      {count}
    </span>
  );
}
