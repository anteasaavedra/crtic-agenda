import type { NextConfig } from "next";

// ─── Content Security Policy ──────────────────────────────────────────────────
// Ajustar según las fuentes externas que uses.
// Para producción con nonces (más seguro): ver Next.js Middleware CSP docs.
const CSP = [
  "default-src 'self'",
  // Next.js App Router necesita 'unsafe-inline' para hidratación en producción.
  // Idealmente reemplazar por nonce-based CSP.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  // data: para imágenes inline, blob: para objetos generados en el cliente, https: para iconos externos
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // Conexiones a APIs externas
  "connect-src 'self' https://api.resend.com https://www.googleapis.com https://oauth2.googleapis.com",
  // Google OAuth consent screen se abre en el navegador (no en iframe)
  "frame-src https://accounts.google.com",
  "frame-ancestors 'none'", // Previene clickjacking
  "object-src 'none'",
  "base-uri 'self'",
  // Server Actions y formularios van siempre a 'self'
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  // Fuerza HTTPS durante 2 años, incluyendo subdominios
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Previene que el navegador infiera el MIME type
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  // Previene clickjacking (duplicado por CSP frame-ancestors, pero útil para compat)
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  // Controla info de referrer enviada a otros sitios
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  // Desactiva APIs de hardware innecesarias
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // DNS prefetch para mejor performance
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  // Content Security Policy
  {
    key: "Content-Security-Policy",
    value: CSP,
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        // Aplica a todas las rutas
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  // Evita exponer info del servidor en el header X-Powered-By
  poweredByHeader: false,
};

export default nextConfig;
