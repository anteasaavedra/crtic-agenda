import Link from "next/link";
import { requireParticipantSession } from "@/lib/participant-session";
import { prisma } from "@/lib/prisma";

export default async function ToolsPage() {
  const session = await requireParticipantSession();

  // Obtener cursos activos del participante
  const participations = await prisma.participant.findMany({
    where: { userId: session.userId, status: "ACTIVE" },
    select: {
      id: true,
      courseId: true,
      course: { select: { name: true, endsOn: true } },
    },
  });

  const courseIds = participations.map((p) => p.courseId);

  // Herramientas disponibles para los cursos del participante
  const tools = await prisma.tool.findMany({
    where: {
      isActive: true,
      courses: { some: { courseId: { in: courseIds } } },
    },
    select: {
      id: true,
      name: true,
      description: true,
      iconUrl: true,
      defaultSlotMinutes: true,
      _count: {
        select: { licenses: { where: { isActive: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Herramientas disponibles</h1>
        <p className="mt-1 text-sm text-gray-500">
          Cursos activos:{" "}
          {participations.map((p) => p.course.name).join(", ")}
        </p>
      </div>

      {/* Lista de herramientas */}
      {tools.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <p className="text-sm text-gray-500">
            No hay herramientas disponibles para tus cursos actualmente.
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Contacta al administrador si crees que esto es un error.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tools.map((tool) => (
            <div
              key={tool.id}
              className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div>
                {/* Icono */}
                {tool.iconUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tool.iconUrl}
                    alt=""
                    className="mb-3 h-8 w-8 rounded object-contain"
                  />
                )}

                <h2 className="font-semibold text-gray-900">{tool.name}</h2>

                {tool.description && (
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                    {tool.description}
                  </p>
                )}

                <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
                  <span>{tool.defaultSlotMinutes} min por bloque</span>
                  <span>·</span>
                  <span>{tool._count.licenses} licencia(s)</span>
                </div>
              </div>

              <div className="mt-4">
                <Link
                  href={`/book/${tool.id}`}
                  className="inline-block w-full rounded-lg bg-slate-900 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-slate-700"
                >
                  Reservar horario
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Link rápido a mis reservas */}
      {tools.length > 0 && (
        <div className="text-center">
          <Link
            href="/mis-reservas"
            className="text-sm text-slate-600 hover:underline"
          >
            Ver mis reservas →
          </Link>
        </div>
      )}
    </div>
  );
}
