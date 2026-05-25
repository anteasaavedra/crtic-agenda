import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { toggleMentorStatus } from "@/actions/mentors";

export const dynamic = "force-dynamic";

export default async function MentoresPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error } = await searchParams;

  const mentores = await prisma.licenseAccount.findMany({
    where: { tool: { category: "MENTORIA" } },
    include: {
      tool: { select: { name: true } },
      _count: {
        select: {
          reservations: { where: { status: "CONFIRMED" } },
          availability: { where: { isBlocked: false } },
        },
      },
    },
    orderBy: [{ tool: { name: "asc" } }, { label: "asc" }],
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mentores</h1>
          <p className="mt-1 text-sm text-gray-500">
            {mentores.length} mentor(es) registrado(s)
          </p>
        </div>
        <Link
          href="/admin/mentores/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          + Nuevo mentor
        </Link>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}

      <div className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        {mentores.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">
            No hay mentores.{" "}
            <Link href="/admin/mentores/new" className="text-slate-600 hover:underline">
              Agrega el primero →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Área</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Email Google</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Slots disponibles</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Reservas activas</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {mentores.map((m) => (
                <tr key={m.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{m.label}</td>
                  <td className="px-4 py-3 text-gray-600">{m.tool.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{m.accountEmail ?? <span className="text-red-400">Sin email</span>}</td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {m._count.availability > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        {m._count.availability}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                        Sin horarios
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">{m._count.reservations}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        m.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
                      }`}>
                        {m.isActive ? "Activo" : "Inactivo"}
                      </span>
                      <form action={toggleMentorStatus}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="isActive" value={String(m.isActive)} />
                        <button type="submit" className="text-xs text-slate-500 hover:text-slate-800">
                          {m.isActive ? "Desactivar" : "Activar"}
                        </button>
                      </form>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/availability/${m.id}`}
                      className="text-sm font-medium text-slate-600 hover:text-slate-900"
                    >
                      Ver horarios →
                    </Link>
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
