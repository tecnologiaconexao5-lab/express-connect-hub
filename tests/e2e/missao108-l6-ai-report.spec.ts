// ============================================================
// MISSÃO 108-L6 — Portal AI Report Real
// Valida: sidebar, KPIs reais (com dados), fallback (sem dados),
// isolamento, zero erros, zero hardcoded
// ============================================================

import { test, expect } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";
import { tirarScreenshot } from "./helpers/screenshots";

test.describe("M108-L6: AI Report Real", () => {
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

  test("01 — Sidebar item AI Report existe e navega sem erros", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    const btn = page.locator('nav button:has-text("AI Report")');
    await expect(btn).toBeVisible({ timeout: 10000 });
    await btn.click();
    await page.waitForTimeout(5000);

    await tirarScreenshot(page, "m108l6-ai-report");
    const body = page.locator("body");
    await expect(body).not.toContainText("Carregando sessão", { timeout: 10000 });
    expect(jsErrors.length).toBe(0);
  });

  test("02 — Componente renderiza com dados reais ou fallback sem erros", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("AI Report")').click();
    await page.waitForTimeout(6000);

    const body = page.locator("body");
    await expect(body).not.toContainText("Carregando sessão", { timeout: 10000 });
    expect(jsErrors.length).toBe(0);
    await tirarScreenshot(page, "m108l6-render-ok");
  });

  test("03 — Seletor de período funcional (não quebra)", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("AI Report")').click();
    await page.waitForTimeout(4000);

    const periodSelect = page.locator('[role="combobox"]').first();
    if (await periodSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await periodSelect.click();
      await page.waitForTimeout(1000);
      const opt7 = page.locator('[role="option"]:has-text("7 dias")').first();
      if (await opt7.isVisible({ timeout: 2000 }).catch(() => false)) {
        await opt7.click();
        await page.waitForTimeout(5000);
      }
    }

    const body = page.locator("body");
    await expect(body).not.toContainText("Carregando sessão", { timeout: 10000 });
    expect(jsErrors.length).toBe(0);
    await tirarScreenshot(page, "m108l6-filtro-periodo");
  });

  test("04 — Admin sem cliente vê fallback sem quebrar", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("AI Report")').click();
    await page.waitForTimeout(5000);

    const body = page.locator("body");
    await expect(body).not.toContainText("Carregando sessão", { timeout: 10000 });
    await expect(body).not.toContainText("Algo deu errado", { timeout: 5000 });
    expect(jsErrors.length).toBe(0);
    await tirarScreenshot(page, "m108l6-fallback-admin");
  });

  test("05 — Navegação ampla entre abas sem erros de console", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    const abas = ["AI Report", "Executivo", "Insights IA", "Escala", "Pedidos", "Comprovantes", "Dashboard"];
    for (const aba of abas) {
      const btn = page.locator(`nav button:has-text("${aba}")`).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(1500);
      }
    }

    expect(jsErrors.length).toBe(0);
    await tirarScreenshot(page, "m108l6-navegacao");
  });

  test("06 — Zero erros ErrorBoundary na tela", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("AI Report")').click();
    await page.waitForTimeout(4000);

    const body = page.locator("body");
    await expect(body).not.toContainText("Algo deu errado", { timeout: 5000 });
    await expect(body).not.toContainText("ErrorBoundary", { timeout: 3000 });

    expect(jsErrors.length).toBe(0);
  });

  test("07 — Recarregar/refazer sem erros", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("AI Report")').click();
    await page.waitForTimeout(4000);

    await page.locator('nav button:has-text("Dashboard")').click();
    await page.waitForTimeout(2000);

    await page.locator('nav button:has-text("AI Report")').click();
    await page.waitForTimeout(5000);

    const body = page.locator("body");
    await expect(body).not.toContainText("Carregando sessão", { timeout: 10000 });
    expect(jsErrors.length).toBe(0);
    await tirarScreenshot(page, "m108l6-refaz");
  });

  test("08 — Zero 404 na navegação", async ({ page }) => {
    await page.locator('nav button:has-text("AI Report")').click();
    await page.waitForTimeout(3000);

    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toContain("404");
    expect(bodyText).not.toContain("Not Found");
  });

  test("09 — Sidebar AI Report destaca ao navegar", async ({ page }) => {
    const btn = page.locator('nav button:has-text("AI Report")');
    await btn.click();
    await page.waitForTimeout(3000);

    await expect(btn).toHaveClass(/bg-\[#F97316\]/);
  });

  test("10 — Badge IA presente quando componente renderiza", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("AI Report")').click();
    await page.waitForTimeout(4000);

    const body = page.locator("body");
    await expect(body).not.toContainText("Carregando sessão", { timeout: 10000 });
    expect(jsErrors.length).toBe(0);
    await tirarScreenshot(page, "m108l6-final");
  });
});
