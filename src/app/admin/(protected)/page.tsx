import { prisma } from "@/lib/prisma";
import { BookOpen, Wrench, KeyRound, Users } from "lucide-react";

export default async function AdminDashboardPage() {
  const [courses, tools, licenses, participants] = await Promise.all([
    prisma.course.count(),
    prisma.tool.count({ where: { isActive: true } }),
    prisma.licenseAccount.count({ where: { isActive: true } }),
    prisma.participant.count({ where: { status: "ACTIVE" } }),
  ]);

  const stats = [
    { label: "Cursos", value: courses, icon: BookOpen, href: "/admin/courses" },
    { label: "Herramientas activas", value: tools, icon: Wrench, href: "/admin/tools" },
    { label: "Licencias activas", value: licenses, icon: KeyRound, href: "/admin/licenses" },
    { label: "Participantes activos", value: participants, icon: Users, href: "/admin/participants" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">
        Resumen del sistema de reserva de licencias
      </p>

      {/* Tarjetas de stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <a
            key={label}
            href={href}
            className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">{label}</p>
              <Icon className="h-5 w-5 text-slate-400" />
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
          </a>
        ))}
      </div>

      {/* Accesos rápidos */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
          Acciones rápidas
        </h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {[
            { href: "/admin/courses/new", label: "Nuevo curso" },
            { href: "/admin/tools/new", label: "Nueva herramienta" },
            { href: "/admin/licenses/new", label: "Nueva licencia" },
            { href: "/admin/participants/new", label: "Nuevo participante" },
            { href: "/admin/credentials", label: "Cargar credenciales" },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
