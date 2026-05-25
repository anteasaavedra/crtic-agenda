import Link from "next/link";
import { ArrowLeft, ArrowRight, MessageCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MentoriasPage() {
  const tools = await prisma.tool.findMany({
    where: { isActive: true, category: "MENTORIA" },
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#f7f7f6" }}>
      {/* Header */}
      <header style={{ backgroundColor: "#1d1f23" }}>
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{ color: "#9ca3af" }}
            aria-label="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <p
              className="text-xs font-bold tracking-[0.2em] uppercase"
              style={{ color: "#ff4613", fontFamily: "var(--font-raleway)" }}
            >
              CRTIC
            </p>
            <h1
              className="text-white font-bold text-lg leading-none"
              style={{ fontFamily: "var(--font-raleway)" }}
            >
              Agenda
            </h1>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-10">
        {/* Título sección */}
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "#eafaf6" }}
          >
            <MessageCircle className="w-5 h-5" style={{ color: "#3bd4ae" }} />
          </div>
          <h2
            className="text-2xl font-bold"
            style={{ color: "#1d1f23", fontFamily: "var(--font-raleway)" }}
          >
            Mentorías
          </h2>
        </div>
        <p
          className="mb-10 ml-[52px] text-sm"
          style={{ color: "#6b7280", fontFamily: "var(--font-barlow)" }}
        >
          Reserva una sesión con el equipo CRTIC.
        </p>

        {tools.length === 0 ? (
          <div className="text-center py-24" style={{ color: "#9ca3af" }}>
            <p className="text-lg mb-1" style={{ fontFamily: "var(--font-raleway)" }}>
              No hay mentorías disponibles actualmente
            </p>
            <p className="text-sm" style={{ fontFamily: "var(--font-barlow)" }}>
              Vuelve más tarde o contacta a tu coordinador.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tools.map((tool) => (
              <Link key={tool.id} href={`/mentorias/${tool.slug}`} className="group block">
                <div
                  className="bg-white rounded-2xl p-6 flex flex-col h-full transition-all duration-200 hover:-translate-y-0.5"
                  style={{
                    border: "1.5px solid #e5e5e3",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                  }}
                >
                  <h3
                    className="text-lg font-bold mb-1"
                    style={{ color: "#1d1f23", fontFamily: "var(--font-raleway)" }}
                  >
                    {tool.name}
                  </h3>
                  {tool.description && (
                    <p
                      className="text-sm flex-1 mb-4"
                      style={{ color: "#6b7280", fontFamily: "var(--font-barlow)" }}
                    >
                      {tool.description}
                    </p>
                  )}
                  <span
                    className="flex items-center gap-1 text-sm font-semibold mt-auto"
                    style={{ color: "#3bd4ae", fontFamily: "var(--font-barlow)" }}
                  >
                    Ver horarios
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
