import Link from "next/link";
import { notFound } from "next/navigation";
import { requireParticipantSession } from "@/lib/participant-session";
import { prisma } from "@/lib/prisma";
import { getFreeSlots } from "@/lib/availability";
import { createReservationParticipant } from "@/actions/book";

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ toolId: string }>;
  searchParams: Promise<{ date?: string; error?: string }>;
}) {
  const session = await requireParticipantSession();
  const { toolId } = await params;
  const { date: dateParam, error } = await searchParams;

  // ─── Herramienta ──────────────────────────────────────────────────────────
  const tool = await prisma.tool.findUnique({
    where: { id: toolId, isActive: true },
    select: { id: true, name: true, description: true, defaultSlotMinutes: true },
  });
  if (!tool) notFound();

  // ─── Participaciones elegibles para esta herramienta ──────────────────────
  const eligibleParticipants = await prisma.participant.findMany({
    where: {
      userId: session.userId,
      status: "ACTIVE",
      course: {
        tools: { some: { toolId } },
      },
    },
    select: {
      id: true,
      course: { select: { name: true } },
    },
  });

  if (eligibleParticipants.length === 0) {
    // El usuario no tiene acceso a esta herramienta
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-gray-600">
          No tienes acceso a <strong>{tool.name}</strong> desde ninguno de tus cursos activos.
        </p>
        <Link href="/tools" className="mt-4 inline-block text-sm text-slate-600 hover:underline">
          ← Volver
        </Link>
      </div>
    );
  }

  // ─── Fecha seleccionada ───────────────────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];
  const selectedDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;

  const dateObj = new Date(`${selectedDate}T00:00:00Z`);

  // Días anterior y siguiente para navegación
  const prevDate = new Date(dateObj);
  prevDate.setUTCDate(prevDate.getUTCDate() - 1);
  const nextDate = new Date(dateObj);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);

  const prevStr = prevDate.toISOString().split("T")[0];
  const nextStr = nextDate.toISOString().split("T")[0];

  // Nombre legible de la fecha
  const dateName = dateObj.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  // ─── Slots disponibles ────────────────────────────────────────────────────
  const slots = await getFreeSlots(toolId, dateObj, tool.defaultSlotMinutes);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/tools" className="hover:text-gray-800">
          Herramientas
        </Link>
        <span>/</span>
        <span className="text-gray-900">{tool.name}</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">{tool.name}</h1>
        {tool.description && (
          <p className="mt-1 text-sm text-gray-500">{tool.description}</p>
        )}
        <p className="mt-1 text-xs text-gray-400">
          Bloques de {tool.defaultSlotMinutes} minutos · Horarios en UTC
          (Chile: UTC−4 en verano / UTC−3 en invierno)
        </p>
      </div>

      {/* Banner de error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Navegación de fecha */}
      <div className="flex items-center justify-between">
        <Link
          href={`/book/${toolId}?date=${prevStr}`}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          ← Anterior
        </Link>

        <div className="text-center">
          <p className="text-sm font-semibold capitalize text-gray-900">{dateName}</p>
          {selectedDate === today && (
            <span className="text-xs text-slate-500">Hoy</span>
          )}
        </div>

        <Link
          href={`/book/${toolId}?date=${nextStr}`}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          Siguiente →
        </Link>
      </div>

      {/* Selector de participación (si el usuario está en múltiples cursos con esta herramienta) */}

      {/* Grid de slots + formulario */}
      {slots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <p className="text-sm text-gray-500">
            No hay horarios disponibles para este día.
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Prueba con otra fecha usando los botones de navegación.
          </p>
        </div>
      ) : (
        <form action={createReservationParticipant} className="space-y-4">
          {/* participantId */}
          {eligibleParticipants.length === 1 ? (
            <input type="hidden" name="participantId" value={eligibleParticipants[0].id} />
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ¿Para cuál curso quieres reservar? <span className="text-red-500">*</span>
              </label>
              <select
                name="participantId"
                required
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              >
                {eligibleParticipants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.course.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <input type="hidden" name="toolId" value={toolId} />

          {/* Slots como radio buttons estilizados */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="mb-3 text-sm font-medium text-gray-700">
              Selecciona un horario:
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {slots.map((slot) => {
                const startH = new Date(slot.startsAt).toISOString().substring(11, 16);
                const endH = new Date(slot.endsAt).toISOString().substring(11, 16);
                const available = slot.availableLicenses > 0;

                return (
                  <label
                    key={slot.startsAt.toISOString()}
                    className={`relative flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 transition-colors has-[:checked]:border-slate-600 has-[:checked]:bg-slate-50 ${
                      available
                        ? "border-gray-200 hover:border-gray-300"
                        : "cursor-not-allowed border-gray-100 opacity-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="startsAt"
                      value={slot.startsAt.toISOString()}
                      required
                      disabled={!available}
                      className="sr-only"
                    />
                    <span className="font-mono text-sm text-gray-800">
                      {startH} — {endH} UTC
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        available ? "text-green-600" : "text-gray-400"
                      }`}
                    >
                      {available
                        ? `${slot.availableLicenses} libre${slot.availableLicenses > 1 ? "s" : ""}`
                        : "Completo"}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            Confirmar reserva
          </button>

          <p className="text-center text-xs text-gray-400">
            La licencia se asigna automáticamente. Podrás ver las credenciales de acceso en{" "}
            <Link href="/mis-reservas" className="underline">
              Mis reservas
            </Link>
            .
          </p>
        </form>
      )}
    </div>
  );
}
