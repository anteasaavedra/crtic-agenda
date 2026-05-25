import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E Test Configuration — CRTIC Agenda
 *
 * Variables de entorno necesarias para los tests:
 *   TEST_ADMIN_EMAIL    — email del admin de prueba
 *   TEST_ADMIN_PASSWORD — contraseña del admin de prueba
 *   TEST_PARTICIPANT_EMAIL — email de un participante activo de prueba
 *   PLAYWRIGHT_BASE_URL — URL base (default: http://localhost:3000)
 *
 * Ejecutar: npx playwright test
 * Con UI:   npx playwright test --ui
 * Un archivo: npx playwright test tests/e2e/admin.spec.ts
 */

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // Secuencial para evitar colisiones en la BD de prueba
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Un worker para mantener estado predecible
  reporter: process.env.CI ? "github" : "html",

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Idioma español para que los selectores de texto funcionen
    locale: "es-CL",
    timezoneId: "America/Santiago",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Descomentar para testing en más navegadores:
    // { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    // { name: "Mobile Safari", use: { ...devices["iPhone 13"] } },
  ],

  // Levanta el servidor de desarrollo si no está corriendo
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
