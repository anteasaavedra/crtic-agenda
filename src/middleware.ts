import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware unificado:
 *  - Rutas /admin/*   → requieren sesión NextAuth con role ADMIN.
 *  - Rutas /tools, /book, /mis-reservas → requieren cookie "participant_session".
 *  - El resto (/, /login, /verify, /logout) es público.
 */

const PARTICIPANT_PROTECTED = ["/tools", "/book", "/mis-reservas"];

export default withAuth(
  function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Protección de rutas de participante
    if (PARTICIPANT_PROTECTED.some((p) => pathname.startsWith(p))) {
      const sessionCookie = req.cookies.get("participant_session");
      if (!sessionCookie?.value) {
        const url = req.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("redirect", pathname);
        return NextResponse.redirect(url);
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ token, req }) {
        const { pathname } = req.nextUrl;

        // Login de admin: siempre accesible
        if (pathname === "/admin/login") return true;

        // Rutas admin: requieren token con role ADMIN
        if (pathname.startsWith("/admin")) return token?.role === "ADMIN";

        // Rutas de participante: el check real lo hace el middleware function arriba
        return true;
      },
    },
    pages: {
      signIn: "/admin/login",
    },
  }
);

export const config = {
  matcher: [
    "/admin/:path*",
    "/tools/:path*",
    "/book/:path*",
    "/mis-reservas/:path*",
  ],
};
