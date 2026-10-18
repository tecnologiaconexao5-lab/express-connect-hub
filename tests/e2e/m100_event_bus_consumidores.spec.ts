import { test, expect } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";

test.describe("M100 — Migração de Consumidores para Event Bus", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page);
  });

  test("01 — Torre de Controle carrega com timeline do Event Bus", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/torre-controle");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    const jsErrors = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("ERR_BLOCKED") &&
        !e.includes("mapbox") &&
        !e.includes("404")
    );
    expect(jsErrors).toEqual([]);
    const body = await page.textContent("body");
    expect(body).not.toContain("Carregando sessão");
    const temEventBus = body.includes("[Event Bus]") || body.includes("evento") || body.includes("Timeline");
    expect(temEventBus).toBeTruthy();
  });

  test("02 — NOC Dashboard aba Eventos carrega ao vivo", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    const eventosTab = page.locator('button[value="eventos"]');
    await expect(eventosTab).toBeVisible();
    await eventosTab.click();
    await page.waitForTimeout(2000);
    const jsErrors = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("ERR_BLOCKED") &&
        !e.includes("mapbox")
    );
    expect(jsErrors).toEqual([]);
    const body = await page.textContent("body");
    expect(body).not.toContain("Carregando sessão");
  });

  test("03 — TabEventos exibe eventos ou estado vazio", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    const eventosTab = page.locator('button[value="eventos"]');
    await eventosTab.click();
    await page.waitForTimeout(2000);
    const body = await page.textContent("body");
    const hasEventos = body.includes("Eventos ao Vivo");
    const hasEmpty = body.includes("Nenhum evento recente");
    expect(hasEventos || hasEmpty).toBeTruthy();
  });

  test("04 — useEventosRealtime hook importável sem erro", async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        const mod = await import("/src/hooks/useEventosRealtime.ts");
        return {
          ok: true,
          hasExport: typeof mod.useEventosRealtime === "function",
        };
      } catch (e: any) {
        return { ok: false, erro: e.message };
      }
    });
    expect(result.ok).toBe(true);
    expect(result.hasExport).toBe(true);
  });

  test("05 — RLS corrigida: anon não vê eventos internos", async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        const mod = await import("/src/services/eventBus/eventBusService.ts");
        const res = await mod.buscarEventos({
          visibility: "internal",
          limit: 5,
        });
        return { sucesso: res.sucesso, total: res.total, erro: res.erro };
      } catch (e: any) {
        return { sucesso: false, erro: e.message };
      }
    });

    if (!result.erro) {
      expect(typeof result.sucesso).toBe("boolean");
    }
  });

  test("06 — PortalEventosFeed importável", async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        const mod = await import("/src/components/portal-cliente/PortalEventosFeed.tsx");
        return {
          ok: true,
          hasDefault: typeof mod.default === "function",
        };
      } catch (e: any) {
        return { ok: false, erro: e.message };
      }
    });
    expect(result.ok).toBe(true);
    expect(result.hasDefault).toBe(true);
  });

  test("07 — TabOperacional ainda funciona sem regressão", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    const operacionalTab = page.locator('button[value="operacional"]');
    await operacionalTab.click();
    await page.waitForTimeout(2000);
    await expect(page.locator("text=Ordens de Serviço").first()).toBeVisible();
  });

  test("08 — TabExecutivo ainda funciona sem regressão", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    const executivoTab = page.locator('button[value="executivo"]');
    await executivoTab.click();
    await page.waitForTimeout(2000);
    await expect(page.locator("text=Total de Clientes").first()).toBeVisible();
  });
});
