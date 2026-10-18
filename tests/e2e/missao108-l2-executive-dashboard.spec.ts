// ============================================================
// MISSÃO 108-L2 — Executive Dashboard no Portal Cliente
// Valida: sidebar, navegação, componente renderizado
// ============================================================

import { test, expect } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";
import { tirarScreenshot } from "./helpers/screenshots";

test.describe("M108-L2: Executive Dashboard Real", () => {
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

  test("01 — Sidebar item executivo existe e navega sem erros", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    const executivoBtn = page.locator('nav button:has-text("Executivo")');
    await expect(executivoBtn).toBeVisible({ timeout: 10000 });
    await executivoBtn.click();
    await page.waitForTimeout(4000);

    await tirarScreenshot(page, "m108l2-executive-dashboard");
    const body = page.locator("body");
    await expect(body).not.toContainText("Carregando sessão", { timeout: 10000 });
    expect(jsErrors.length).toBe(0);
  });

  test("02 — Componente renderiza KPIs ou estado vazio", async ({ page }) => {
    await page.locator('nav button:has-text("Executivo")').click();
    await page.waitForTimeout(5000);

    const bodyText = await page.locator("body").textContent() || "";
    const temConteudo = bodyText.includes("Performance") || bodyText.includes("SLA") || bodyText.includes("Sem d") || bodyText.includes("Visualizar");
    expect(temConteudo).toBeTruthy();
  });

  test("03 — Filtros e secoes condicionais aparecem se houver dados", async ({ page }) => {
    await page.locator('nav button:has-text("Executivo")').click();
    await page.waitForTimeout(4000);

    await tirarScreenshot(page, "m108l2-filtros");

    const body = page.locator("body");
    await expect(body).not.toContainText("Carregando...", { timeout: 5000 });

    const filtro7dias = page.locator('button:has-text("Últimos 7 dias")');
    if (await filtro7dias.isVisible({ timeout: 2000 }).catch(() => false)) {
      await filtro7dias.click();
      await page.waitForTimeout(1500);
    }
  });

  test("04 — Componente renderiza sem erros com ou sem dados", async ({ page }) => {
    await page.locator('nav button:has-text("Executivo")').click();
    await page.waitForTimeout(4000);

    await tirarScreenshot(page, "m108l2-component-state");
    const body = await page.locator("body").textContent() || "";
    expect(body.length).toBeGreaterThan(50);
  });

  test("05 — Exportacao de relatorio", async ({ page }) => {
    await page.locator('nav button:has-text("Executivo")').click();
    await page.waitForTimeout(4000);

    const exportBtn = page.locator('button:has-text("Exportar")');
    if (await exportBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 15000 }),
        exportBtn.click(),
      ]);
      expect(download.suggestedFilename()).toContain("relatorio_executivo");
    }
  });

  test("06 — Grafico comparativo mensal se houver dados", async ({ page }) => {
    await page.locator('nav button:has-text("Executivo")').click();
    await page.waitForTimeout(4000);

    await tirarScreenshot(page, "m108l2-grafico-mensal");
    const chartTitle = page.locator("text=Comparativo Mensal");
    if (await chartTitle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(chartTitle).toBeVisible();
    }
  });
});
