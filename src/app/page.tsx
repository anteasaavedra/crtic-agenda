import Link from "next/link";
import { KeyRound, MessageCircle, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f7f7f6]">
      {/* Header */}
      <header className="bg-[#1d1f23]">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#ff4613]"
             style={{ fontFamily: "var(--font-raleway)" }}>
            CRTIC
          </p>
          <h1 className="text-white font-bold text-lg leading-none"
              style={{ fontFamily: "var(--font-raleway)" }}>
            Agenda
          </h1>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="text-center max-w-lg mb-14">
          <h2 className="text-4xl font-bold mb-4 leading-tight text-[#1d1f23]"
              style={{ fontFamily: "var(--font-raleway)" }}>
            ¿Qué quieres{" "}
            <span className="text-[#ff4613]">reservar?</span>
          </h2>
          <p className="text-base text-[#6b7280]"
             style={{ fontFamily: "var(--font-barlow)" }}>
            Elige el tipo de reserva, selecciona el recurso y elige tu horario.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-2xl">
          {/* Licencias */}
          <Link href="/licencias" className="group block">
            <div className="bg-white rounded-2xl p-8 flex flex-col items-center text-center
                            border-[1.5px] border-[#e5e5e3] shadow-sm
                            transition-all duration-200 hover:-translate-y-1 hover:border-[#ff4613] hover:shadow-md">
              <div className="w-16 h-16 bg-[#fff1ed] rounded-2xl flex items-center justify-center mb-5
                              group-hover:bg-[#ffe4d9] transition-colors">
                <KeyRound className="w-7 h-7 text-[#ff4613]" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-[#1d1f23]"
                  style={{ fontFamily: "var(--font-raleway)" }}>
                Licencias
              </h3>
              <p className="text-sm mb-6 flex-1 text-[#6b7280]"
                 style={{ fontFamily: "var(--font-barlow)" }}>
                KREA, Runway, ElevenLabs, Suno y otras herramientas de IA
              </p>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-[#ff4613]"
                    style={{ fontFamily: "var(--font-barlow)" }}>
                Ver disponibilidad
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
          </Link>

          {/* Mentorías */}
          <Link href="/mentorias" className="group block">
            <div className="bg-white rounded-2xl p-8 flex flex-col items-center text-center
                            border-[1.5px] border-[#e5e5e3] shadow-sm
                            transition-all duration-200 hover:-translate-y-1 hover:border-[#3bd4ae] hover:shadow-md">
              <div className="w-16 h-16 bg-[#eafaf6] rounded-2xl flex items-center justify-center mb-5
                              group-hover:bg-[#d4f5ec] transition-colors">
                <MessageCircle className="w-7 h-7 text-[#3bd4ae]" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-[#1d1f23]"
                  style={{ fontFamily: "var(--font-raleway)" }}>
                Mentorías
              </h3>
              <p className="text-sm mb-6 flex-1 text-[#6b7280]"
                 style={{ fontFamily: "var(--font-barlow)" }}>
                Sesiones individuales con el equipo CRTIC
              </p>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-[#3bd4ae]"
                    style={{ fontFamily: "var(--font-barlow)" }}>
                Ver disponibilidad
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#e5e5e3] py-5">
        <p className="text-center text-xs text-[#9ca3af]"
           style={{ fontFamily: "var(--font-barlow)" }}>
          CRTIC · Centro de Recursos para la Tecnología e Innovación en la Cultura
        </p>
      </footer>
    </div>
  );
}
