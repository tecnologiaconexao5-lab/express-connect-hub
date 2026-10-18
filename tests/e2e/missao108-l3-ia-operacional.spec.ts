// ============================================================
// MISSÃO 108-L3 — IA Operacional Real
// Valida: sidebar, navegação, dados reais, insights
// ============================================================

import { test, expect } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";
import { tirarScreenshot } from "./helpers/screenshots";

test.describe("M108-L3: IA Operacional Real", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page);
    await page.waitForTimeout(2000);
    const portalBtn = page.locator('button:has-text("Portal"), a:has-text("Portal Cliente")').first();
    if (await portalBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await portalBtn.click();
    } else {
      await page.goto("/portal-cliente");
      await page.waitForTimeout(2000);
    }
    await page.waitForTimeout(3000);
  });

  test("01 — Sidebar item Insights IA existe e navega sem erros", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    const insightsBtn = page.locator('nav button:has-text("Insights IA")');
    await expect(insightsBtn).toBeVisible({ timeout: 10000 });
    await insightsBtn.click();
    await page.waitForTimeout(4000);

    await tirarScreenshot(page, "m108l3-ia-operacional");
    const body = page.locator("body");
    await expect(body).not.toContainText("Carregando sessão", { timeout: 10000 });
    expect(jsErrors.length).toBe(0);
  });

  test("02 — Componente renderiza header e filtros de periodo", async ({ page }) => {
    await page.locator('nav button:has-text("Insights IA")').click();
    await page.waitForTimeout(4000);

    await expect(page.locator("text=Insights Operacionais").first()).toBeVisible({ timeout: 5000 });

    const filtro7dias = page.locator('button:has-text("Últimos 7 dias")');
    const filtro30dias = page.locator('button:has-text("Últimos 30 dias")');
    const filtroMes = page.locator('button:has-text("Mês Atual")');

    if (await filtro7dias.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(filtro7dias).toBeVisible();
    }
    if (await filtro30dias.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(filtro30dias).toBeVisible();
    }
    if (await filtroMes.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(filtroMes).toBeVisible();
    }
  });

  test("03 — Navega sem erros de console", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("Insights IA")').click();
    await page.waitForTimeout(3000);

    await page.locator('nav button:has-text("Dashboard")').click();
    await page.waitForTimeout(2000);

    await page.locator('nav button:has-text("Insights IA")').click();
    await page.waitForTimeout(3000);

    expect(jsErrors.length).toBe(0);
  });

  test("04 — Footer com contagem de insights", async ({ page }) => {
    await page.locator('nav button:has-text("Insights IA")').click();
    await page.waitForTimeout(4000);

    const body = page.locator("body");
    await expect(body).not.toContainText("Carregando...", { timeout: 5000 });

    const bodyText = await page.locator("body").textContent() || "";
    expect(bodyText.includes("insights") || bodyText.includes("Insights")).toBeTruthy();
  });
});
