"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Wrench,
  KeyRound,
  ShieldCheck,
  CalendarDays,
  ClipboardList,
  LogOut,
  Link2,
  Mail,
  Settings,
  BarChart2,
  Eye,
  Users,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/tools", label: "Herramientas", icon: Wrench },
  { href: "/admin/licenses", label: "Licencias", icon: KeyRound },
  { href: "/admin/mentores", label: "Mentores", icon: Users },
  { href: "/admin/availability", label: "Disponibilidad", icon: CalendarDays },
  { href: "/admin/reservations", label: "Reservas", icon: ClipboardList },
  { href: "/admin/reservations/seguimiento", label: "Seguimiento", icon: BarChart2 },
  { href: "/admin/credentials", label: "Credenciales", icon: ShieldCheck },
  { href: "/admin/share-links", label: "Links de reserva", icon: Link2 },
  { href: "/admin/email-preview", label: "Preview emails", icon: Eye },
  { href: "/admin/email-logs", label: "Email Logs", icon: Mail },
  { href: "/admin/settings", label: "Configuración", icon: Settings },
];

interface NavSidebarProps {
  user: { name?: string | null; email?: string | null };
}

export function NavSidebar({ user }: NavSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col text-white sticky top-0" style={{ backgroundColor: "#1d1f23" }}>
      {/* Logo */}
      <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <p
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "#ff4613" }}
        >
          CRTIC
        </p>
        <h1 className="mt-0.5 text-base font-bold text-white">Agenda</h1>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Usuario + logout */}
      <div className="border-t border-slate-700 px-3 py-4">
        <div className="mb-2 px-3">
          <p className="truncate text-sm font-medium text-white">
            {user.name ?? "Administrador"}
          </p>
          <p className="truncate text-xs text-slate-400">{user.email}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
