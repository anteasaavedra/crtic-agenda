/**
 * Tests E2E — Panel de administrador
 *
 * Cubre: login, navegación, creación de disponibilidad, gestión de reservas.
 *
 * Requiere variables de entorno:
 *   TEST_ADMIN_EMAIL    — email del admin (ej. admin@crtic.cl)
 *   TEST_ADMIN_PASSWORD — contraseña del admin
 */

import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL    = process.env.TEST_ADMIN_EMAIL    ?? "admin@crtic.cl";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "changeme";

// ─── Helper: login como admin ─────────────────────────────────────────────────

async function adminLogin(page: Page) {
  await page.goto("/admin/login");
  await page.fill('input[name="email"]', ADMIN_EMAIL);
  await page.fill('input[name="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin(?!\/login)/);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Admin — Autenticación", () => {
  test("redirige a /admin/login cuando no autenticado", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("login exitoso con credenciales válidas", async ({ page }) => {
    await adminLogin(page);
    await expect(page).toHaveURL(/\/admin/);
    // Debe mostrar el sidebar de navegación
    await expect(page.getByText("Dashboard")).toBeVisible();
  });

  test("error con credenciales incorrectas", async ({ page }) => {
    await page.goto("/admin/login");
    await page.fill('input[name="email"]', ADMIN_EMAIL);
    await page.fill('input[name="password"]', "contraseña_incorrecta");
    await page.click('button[type="submit"]');
    // Debe mostrar error (NextAuth redirige con ?error=CredentialsSignin o similar)
    await expect(page).toHaveURL(/error/);
  });
});

test.describe("Admin — Navegación", () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  test("puede navegar a Herramientas", async ({ page }) => {
    await page.click("text=Herramientas");
    await expect(page).toHaveURL(/\/admin\/tools/);
    await expect(page.getByRole("heading", { name: "Herramientas" })).toBeVisible();
  });

  test("puede navegar a Disponibilidad", async ({ page }) => {
    await page.click("text=Disponibilidad");
    await expect(page).toHaveURL(/\/admin\/availability/);
  });

  test("puede navegar a Reservas", async ({ page }) => {
    await page.click("text=Reservas");
    await expect(page).toHaveURL(/\/admin\/reservations/);
  });

  test("puede navegar a Credenciales", async ({ page }) => {
    await page.click("text=Credenciales");
    await expect(page).toHaveURL(/\/admin\/credentials/);
  });

  test("puede navegar a Configuración", async ({ page }) => {
    await page.click("text=Configuración");
    await expect(page).toHaveURL(/\/admin\/settings/);
    await expect(page.getByText("Google Calendar")).toBeVisible();
  });
});

test.describe("Admin — Disponibilidad", () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  test("lista de licencias visible", async ({ page }) => {
    await page.goto("/admin/availability");
    // Debe mostrar la tabla de licencias o el mensaje vacío
    const table = page.locator("table");
    const emptyMsg = page.getByText("No hay licencias creadas");
    await expect(table.or(emptyMsg)).toBeVisible();
  });
});

test.describe("Admin — Reservas", () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  test("tabla de reservas visible", async ({ page }) => {
    await page.goto("/admin/reservations");
    await expect(page.getByRole("heading", { name: "Reservas" })).toBeVisible();
    // El formulario de prueba debe estar presente
    await expect(page.getByText("Crear reserva de prueba")).toBeVisible();
  });

  test("filtro por estado funciona", async ({ page }) => {
    await page.goto("/admin/reservations");
    await page.click("text=Confirmadas");
    await expect(page).toHaveURL(/status=CONFIRMED/);
  });

  test("enlace de exportar CSV disponible", async ({ page }) => {
    await page.goto("/admin/reservations");
    // Verificar que el endpoint de CSV responde correctamente
    const response = await page.request.get("/api/admin/export/reservations");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");
  });
});

test.describe("Admin — Magic Links", () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  test("página de magic links accesible", async ({ page }) => {
    await page.goto("/admin/magic-links");
    await expect(page.getByRole("heading", { name: "Magic Links" })).toBeVisible();
    await expect(page.getByText("Solo desarrollo")).toBeVisible();
  });
});

test.describe("Admin — Email Logs", () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  test("tabla de logs visible", async ({ page }) => {
    await page.goto("/admin/email-logs");
    await expect(page.getByRole("heading", { name: "Logs de Email" })).toBeVisible();
  });
});

test.describe("Admin — Seguridad", () => {
  test("headers de seguridad presentes", async ({ page }) => {
    const response = await page.request.get("/admin/login");
    const headers = response.headers();
    expect(headers["x-frame-options"]).toBeTruthy();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["content-security-policy"]).toBeTruthy();
    expect(headers["referrer-policy"]).toBeTruthy();
  });

  test("CSV export requiere autenticación", async ({ page }) => {
    // Sin autenticar, debe devolver 401
    const response = await page.request.get("/api/admin/export/reservations");
    expect(response.status()).toBe(401);
  });
});
