/**
 * Tests E2E — Flujo del participante
 *
 * Cubre: login con magic link, catálogo de herramientas, reserva, mis reservas.
 *
 * Requiere variables de entorno:
 *   TEST_PARTICIPANT_EMAIL — email de un participante activo
 *   TEST_ADMIN_EMAIL       — email del admin (para generar magic links de prueba)
 *   TEST_ADMIN_PASSWORD    — contraseña del admin
 *
 * Notas:
 *   - El magic link se genera via el panel de admin (/admin/magic-links).
 *   - Los tests de reserva requieren que existan herramientas y disponibilidad configuradas.
 */

import { test, expect, type Page } from "@playwright/test";

const PARTICIPANT_EMAIL = process.env.TEST_PARTICIPANT_EMAIL ?? "participante@test.cl";
const ADMIN_EMAIL       = process.env.TEST_ADMIN_EMAIL       ?? "admin@crtic.cl";
const ADMIN_PASSWORD    = process.env.TEST_ADMIN_PASSWORD    ?? "changeme";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function adminLogin(page: Page) {
  await page.goto("/admin/login");
  await page.fill('input[name="email"]', ADMIN_EMAIL);
  await page.fill('input[name="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin(?!\/login)/);
}

/**
 * Genera un magic link para el participante usando el panel de admin.
 * Devuelve la URL del magic link.
 */
async function generateMagicLink(page: Page, email: string): Promise<string> {
  await adminLogin(page);
  await page.goto("/admin/magic-links");

  // Rellenar email y generar link
  await page.fill('input[name="email"]', email);
  await page.click('button[type="submit"]');

  // Esperar a que aparezca el link generado
  await page.waitForURL(/preview=/);
  const previewParam = new URL(page.url()).searchParams.get("preview");
  if (!previewParam) throw new Error("No se generó el magic link");

  return decodeURIComponent(previewParam);
}

// ─── Tests de autenticación ───────────────────────────────────────────────────

test.describe("Participante — Autenticación", () => {
  test("redirige a /login cuando no autenticado", async ({ page }) => {
    await page.goto("/tools");
    await expect(page).toHaveURL(/\/login/);
  });

  test("página de login tiene formulario de email", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /enviar enlace/i })).toBeVisible();
  });

  test("muestra confirmación al enviar email válido", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "cualquier@correo.cl");
    await page.click('button[type="submit"]');
    // Siempre muestra "enlace enviado" sin revelar si existe
    await expect(page).toHaveURL(/sent=1/);
    await expect(page.getByText(/enlace enviado/i)).toBeVisible();
  });

  test("flujo completo: magic link → login → herramientas", async ({ page }) => {
    // Generar magic link via admin
    const magicLinkUrl = await generateMagicLink(page, PARTICIPANT_EMAIL);

    // Abrir magic link en un contexto limpio (sin cookies de admin)
    await page.context().clearCookies();
    await page.goto(magicLinkUrl);

    // Debe redirigir a /tools
    await expect(page).toHaveURL(/\/tools/);
    await expect(page.getByRole("heading", { name: "Herramientas disponibles" })).toBeVisible();
  });

  test("magic link usado no puede reutilizarse", async ({ page }) => {
    const magicLinkUrl = await generateMagicLink(page, PARTICIPANT_EMAIL);

    // Usar el link una primera vez
    await page.context().clearCookies();
    await page.goto(magicLinkUrl);
    await page.waitForURL(/\/tools/);

    // Cerrar sesión
    await page.goto("/logout");

    // Intentar usar el mismo link de nuevo
    await page.goto(magicLinkUrl);
    await expect(page).toHaveURL(/error=enlace_ya_usado/);
  });
});

test.describe("Participante — Catálogo de herramientas", () => {
  test.beforeEach(async ({ page }) => {
    // Autenticar participante para cada test
    const magicLinkUrl = await generateMagicLink(page, PARTICIPANT_EMAIL);
    await page.context().clearCookies();
    await page.goto(magicLinkUrl);
    await page.waitForURL(/\/tools/);
  });

  test("muestra herramientas disponibles", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Herramientas disponibles" })).toBeVisible();
    // Puede estar vacío si no hay herramientas configuradas — no es un error
    const tools = page.locator("a", { hasText: "Reservar horario" });
    const emptyMsg = page.getByText("No hay herramientas disponibles");
    await expect(tools.first().or(emptyMsg)).toBeVisible();
  });

  test("header muestra email del participante", async ({ page }) => {
    await expect(page.getByText(PARTICIPANT_EMAIL)).toBeVisible();
  });

  test("link 'Mis reservas' funciona", async ({ page }) => {
    await page.click("text=Mis reservas");
    await expect(page).toHaveURL(/\/mis-reservas/);
  });

  test("logout elimina la sesión", async ({ page }) => {
    await page.goto("/logout");
    await page.goto("/tools");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Participante — Reserva de horario", () => {
  // Este test requiere:
  // 1. Herramienta activa asociada al curso del participante
  // 2. Al menos un slot de disponibilidad en la fecha de hoy

  test.skip(!process.env.TEST_TOOL_ID, "TEST_TOOL_ID no configurado — skipping");

  const toolId = process.env.TEST_TOOL_ID ?? "";

  test.beforeEach(async ({ page }) => {
    const magicLinkUrl = await generateMagicLink(page, PARTICIPANT_EMAIL);
    await page.context().clearCookies();
    await page.goto(magicLinkUrl);
    await page.waitForURL(/\/tools/);
  });

  test("página de reserva muestra slots disponibles", async ({ page }) => {
    const today = new Date().toISOString().split("T")[0];
    await page.goto(`/book/${toolId}?date=${today}`);

    // Puede haber slots o el mensaje de "sin horarios"
    const slots = page.locator('input[type="radio"][name="startsAt"]');
    const noSlots = page.getByText("No hay horarios disponibles");
    await expect(slots.first().or(noSlots)).toBeVisible();
  });

  test("navegación de fechas funciona", async ({ page }) => {
    await page.goto(`/book/${toolId}`);
    await page.click("text=Siguiente →");
    await expect(page).toHaveURL(/date=/);
  });
});

test.describe("Participante — Mis reservas", () => {
  test.beforeEach(async ({ page }) => {
    const magicLinkUrl = await generateMagicLink(page, PARTICIPANT_EMAIL);
    await page.context().clearCookies();
    await page.goto(magicLinkUrl);
    await page.waitForURL(/\/tools/);
  });

  test("página Mis reservas accesible", async ({ page }) => {
    await page.goto("/mis-reservas");
    await expect(page.getByRole("heading", { name: "Mis reservas" })).toBeVisible();
  });

  test("botón 'Nueva reserva' lleva al catálogo", async ({ page }) => {
    await page.goto("/mis-reservas");
    await page.click("text=+ Nueva reserva");
    await expect(page).toHaveURL(/\/tools/);
  });
});

test.describe("Participante — API de disponibilidad", () => {
  test("GET /api/availability sin params devuelve 400", async ({ page }) => {
    const r = await page.request.get("/api/availability");
    expect(r.status()).toBe(400);
  });

  test("GET /api/availability con fecha válida devuelve slots", async ({ page }) => {
    // Requiere una herramienta válida
    if (!process.env.TEST_TOOL_ID) return;
    const today = new Date().toISOString().split("T")[0];
    const r = await page.request.get(
      `/api/availability?toolId=${process.env.TEST_TOOL_ID}&date=${today}`
    );
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty("slots");
    expect(Array.isArray(body.slots)).toBe(true);
  });
});
