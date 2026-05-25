import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { EmailStatus } from "@prisma/client";

const STATUS_STYLES: Record<EmailStatus, string> = {
  QUEUED:  "bg-yellow-100 text-yellow-800",
  SENT:    "bg-green-100 text-green-800",
  FAILED:  "bg-red-100 text-red-800",
  BOUNCED: "bg-orange-100 text-orange-800",
};

const STATUS_FILTER_OPTIONS = [
  { value: "",        label: "Todos" },
  { value: "QUEUED",  label: "En cola" },
  { value: "SENT",    label: "Enviados" },
  { value: "FAILED",  label: "Fallidos" },
  { value: "BOUNCED", label: "Rebotados" },
];

const VALID_STATUSES: EmailStatus[] = ["QUEUED", "SENT", "FAILED", "BOUNCED"];

export default async function EmailLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  const statusFilter: EmailStatus | undefined =
    status && VALID_STATUSES.includes(status as EmailStatus)
      ? (status as EmailStatus)
      : undefined;

  const [logs, counts] = await Promise.all([
    prisma.emailLog.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.emailLog.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const countByStatus = Object.fromEntries(
    counts.map((c) => [c.status, c._count._all])
  ) as Partial<Record<EmailStatus, number>>;

  const totalFailed = countByStatus.FAILED ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Logs de Email</h1>
        <p className="mt-1 text-sm text-gray-500">
          {countByStatus.SENT ?? 0} enviados ·{" "}
          {countByStatus.QUEUED ?? 0} en cola ·{" "}
          {totalFailed > 0 ? (
            <span className="font-medium text-red-600">{totalFailed} fallidos</span>
          ) : (
            <span>{totalFailed} fallidos</span>
          )}
          {countByStatus.BOUNCED ? ` · ${countByStatus.BOUNCED} rebotados` : ""}
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-1">
        {STATUS_FILTER_OPTIONS.map((opt) => {
          const isActive = (status ?? "") === opt.value;
          const count =
            opt.value && countByStatus[opt.value as EmailStatus]
              ? ` (${countByStatus[opt.value as EmailStatus]})`
              : "";
          return (
            <Link
              key={opt.value}
              href={opt.value ? `/admin/email-logs?status=${opt.value}` : "/admin/email-logs"}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-slate-900 text-white"
                  : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {opt.label}{count}
            </Link>
          );
        })}
        <span className="ml-2 text-xs text-gray-400">{logs.length} resultado(s)</span>
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {logs.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">
            No hay registros{statusFilter ? ` con estado "${statusFilter}"` : ""}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Destinatario
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Template / Asunto
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                    Intentos
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-gray-800">{log.toEmail}</td>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-gray-500">{log.template}</p>
                      <p className="text-xs text-gray-700 mt-0.5 truncate max-w-xs">
                        {log.subject}
                      </p>
                      {log.lastError && (
                        <p className="mt-0.5 text-xs text-red-600 truncate max-w-xs" title={log.lastError}>
                          ✗ {log.lastError}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          STATUS_STYLES[log.status] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">
                      {log.attempts}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-gray-600">
                        {log.createdAt.toISOString().substring(0, 10)}
                      </p>
                      <p className="font-mono text-xs text-gray-400">
                        {log.createdAt.toISOString().substring(11, 16)} UTC
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info sobre reintentos */}
      {totalFailed > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <strong>{totalFailed} email(s) fallido(s).</strong>{" "}
          El worker en <code>/api/jobs/process</code> reintenta automáticamente los jobs de recordatorio.
          Los emails de confirmación/cancelación fallidos deben reenviarse manualmente desde el panel de Resend.
        </div>
      )}
    </div>
  );
}
