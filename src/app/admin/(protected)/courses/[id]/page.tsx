import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { addToolToCourse, removeToolFromCourse } from "@/actions/courses";

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const [course, allTools] = await Promise.all([
    prisma.course.findUnique({
      where: { id },
      include: {
        tools: { include: { tool: true }, orderBy: { tool: { name: "asc" } } },
        participants: {
          include: { user: { select: { name: true, email: true } } },
          orderBy: { joinedAt: "desc" },
        },
        createdBy: { select: { name: true, email: true } },
      },
    }),
    prisma.tool.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!course) notFound();

  const associatedToolIds = new Set(course.tools.map((ct) => ct.toolId));
  const availableTools = allTools.filter((t) => !associatedToolIds.has(t.id));

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
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/courses" className="hover:text-gray-700">Cursos</Link>
        <span>/</span>
        <span className="text-gray-900">{course.name}</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{course.name}</h1>
        <p className="mt-1 text-sm text-gray-500 font-mono">{course.slug}</p>
        {course.description && (
          <p className="mt-2 text-sm text-gray-600">{course.description}</p>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Info */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Configuración</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-gray-400">Período</dt>
            <dd className="text-gray-900">{formatDate(course.startsOn)} — {formatDate(course.endsOn)}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Ventana de reserva</dt>
            <dd className="text-gray-900">{course.reservationWindowDays} días</dd>
          </div>
          <div>
            <dt className="text-gray-400">Máx. por semana</dt>
            <dd className="text-gray-900">{course.maxReservationsPerWeek ?? "Sin límite"}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Máx. por día</dt>
            <dd className="text-gray-900">{course.maxReservationsPerDay ?? "Sin límite"}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Cancelación</dt>
            <dd className="text-gray-900">
              {course.allowCancellation
                ? `Sí (con ${course.cancellationCutoffHours}h de anticipación)`
                : "No permitida"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-400">Creado por</dt>
            <dd className="text-gray-900">{course.createdBy.name ?? course.createdBy.email}</dd>
          </div>
        </dl>
      </div>

      {/* Herramientas */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          Herramientas asociadas ({course.tools.length})
        </h2>

        {course.tools.length > 0 && (
          <div className="space-y-2 mb-4">
            {course.tools.map(({ tool }) => (
              <div
                key={tool.id}
                className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
              >
                <span className="text-sm font-medium text-gray-800">{tool.name}</span>
                <form action={removeToolFromCourse}>
                  <input type="hidden" name="courseId" value={course.id} />
                  <input type="hidden" name="toolId" value={tool.id} />
                  <button
                    type="submit"
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Quitar
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}

        {availableTools.length > 0 && (
          <form action={addToolToCourse} className="flex gap-2">
            <input type="hidden" name="courseId" value={course.id} />
            <select
              name="toolId"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none"
            >
              {availableTools.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Agregar
            </button>
          </form>
        )}

        {availableTools.length === 0 && course.tools.length === 0 && (
          <p className="text-sm text-gray-400">
            No hay herramientas disponibles.{" "}
            <Link href="/admin/tools/new" className="text-slate-600 hover:underline">
              Crear una →
            </Link>
          </p>
        )}
      </div>

      {/* Participantes */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">
            Participantes ({course.participants.length})
          </h2>
          <Link
            href={`/admin/participants/new?courseId=${course.id}`}
            className="text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            + Agregar
          </Link>
        </div>

        {course.participants.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">
            No hay participantes aún.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Ingresó</th>
              </tr>
            </thead>
            <tbody>
              {course.participants.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.user.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[p.status]}`}>
                      {statusLabel[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(p.joinedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
