import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { updateParticipantStatus } from "@/actions/participants";

export default async function ParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const participants = await prisma.participant.findMany({
    include: {
      user: { select: { name: true, email: true } },
      course: { select: { name: true } },
    },
    orderBy: [{ course: { name: "asc" } }, { joinedAt: "desc" }],
  });

  const statusLabel: Record<string, string> = {
    ACTIVE: "Activo",
    SUSPENDED: "Suspendido",
    REMOVED: "Eliminado",
  };
  const statusColor: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800",
    SUSPENDED: "bg-yellow-100 text-yellow-800",
    REMOVED: "bg-red-100 text-red-800",
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Participantes</h1>
          <p className="mt-1 text-sm text-gray-500">
            {participants.length} participante(s) en total
          </p>
        </div>
        <Link
          href="/admin/participants/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          + Nuevo participante
        </Link>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}

      <div className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        {participants.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">
            No hay participantes aún.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Curso</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Ingresó</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Estado</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.user.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.user.email}</td>
                  <td className="px-4 py-3 text-gray-600">{p.course.name}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(p.joinedAt)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[p.status]}`}>
                        {statusLabel[p.status]}
                      </span>
                      {p.status === "ACTIVE" && (
                        <form action={updateParticipantStatus}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="status" value="SUSPENDED" />
                          <button type="submit" className="text-xs text-yellow-600 hover:text-yellow-800">
                            Suspender
                          </button>
                        </form>
                      )}
                      {p.status === "SUSPENDED" && (
                        <form action={updateParticipantStatus}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="status" value="ACTIVE" />
                          <button type="submit" className="text-xs text-green-600 hover:text-green-800">
                            Reactivar
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
