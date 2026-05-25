import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export default async function CoursesPage() {
  const courses = await prisma.course.findMany({
    include: {
      _count: { select: { participants: true, tools: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cursos</h1>
          <p className="mt-1 text-sm text-gray-500">{courses.length} curso(s) registrado(s)</p>
        </div>
        <Link
          href="/admin/courses/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          + Nuevo curso
        </Link>
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        {courses.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">
            No hay cursos. Crea el primero.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Slug</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Período</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Herramientas</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Participantes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.slug}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDate(c.startsOn)} — {formatDate(c.endsOn)}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {c._count.tools}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {c._count.participants}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/courses/${c.id}`}
                      className="text-slate-600 hover:text-slate-900 text-xs font-medium"
                    >
                      Ver →
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
