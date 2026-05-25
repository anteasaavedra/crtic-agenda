import type { ReactNode } from "react";
import Link from "next/link";
import { getParticipantSession } from "@/lib/participant-session";

export default async function ParticipantLayout({ children }: { children: ReactNode }) {
  const session = await getParticipantSession();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/tools" className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              CRTIC
            </span>
            <span className="text-sm font-bold text-gray-900">Agenda</span>
          </Link>

          {session ? (
            <div className="flex items-center gap-4">
              <nav className="hidden items-center gap-1 sm:flex">
                <Link
                  href="/tools"
                  className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                >
                  Herramientas
                </Link>
                <Link
                  href="/mis-reservas"
                  className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                >
                  Mis reservas
                </Link>
              </nav>
              <div className="flex items-center gap-3 border-l border-gray-200 pl-4">
                <span className="hidden text-xs text-gray-500 sm:block">{session.email}</span>
                <a
                  href="/logout"
                  className="text-xs text-gray-500 hover:text-gray-800"
                >
                  Salir
                </a>
              </div>
            </div>
          ) : null}
        </div>

        {/* Mobile nav (solo cuando hay sesión) */}
        {session && (
          <div className="flex border-t border-gray-100 sm:hidden">
            <Link
              href="/tools"
              className="flex-1 py-2 text-center text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Herramientas
            </Link>
            <Link
              href="/mis-reservas"
              className="flex-1 py-2 text-center text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Mis reservas
            </Link>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
