/**
 * GET /logout
 *
 * Elimina la cookie de sesión del participante y redirige al login.
 */

import { NextResponse } from "next/server";
import { SESSION_COOKIE_OPTIONS } from "@/lib/participant-session";

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(SESSION_COOKIE_OPTIONS.name);
  return response;
}
