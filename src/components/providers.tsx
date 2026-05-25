"use client";

import { SessionProvider } from "next-auth/react";

/**
 * Wrapper de SessionProvider para usar useSession() en componentes cliente.
 * Se aplica solo en el layout del admin, no en el root layout.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
