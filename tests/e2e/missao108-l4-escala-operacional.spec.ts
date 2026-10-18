// ============================================================
// MISSÃO 108-L4 — Portal Escala Operacional Real
// Valida: sidebar, navegação, render com dados reais ou empty state
// ============================================================

import { test, expect } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";
import { tirarScreenshot } from "./helpers/screenshots";

test.describe("M108-L4: Escala Operacional Real", () => {
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

  test("01 — Sidebar item Escala existe e navega sem erros", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    const escalaBtn = page.locator('nav button:has-text("Escala")');
    await expect(escalaBtn).toBeVisible({ timeout: 10000 });
    await escalaBtn.click();
    await page.waitForTimeout(4000);

    await tirarScreenshot(page, "m108l4-escala");
    const body = page.locator("body");
    await expect(body).not.toContainText("Carregando sessão", { timeout: 10000 });
    expect(jsErrors.length).toBe(0);
  });

  test("02 — Renderiza título Escala Operacional e estatísticas", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("Escala")').click();
    await page.waitForTimeout(5000);

    await expect(page.locator("text=Escala Operacional").first()).toBeVisible({ timeout: 10000 });

    const body = page.locator("body");
    const text = await body.textContent();
    expect(text).toContain("Escala Operacional");
    if (text?.includes("registro(s)")) {
      expect(text).toMatch(/\d+ registro/);
    }

    expect(jsErrors.length).toBe(0);

    await tirarScreenshot(page, "m108l4-escala-estatisticas");
  });

  test("03 — Navegação para outras abas e volta sem erros", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("Escala")').click();
    await page.waitForTimeout(3000);

    await page.locator('nav button:has-text("Dashboard")').click();
    await page.waitForTimeout(2000);

    await page.locator('nav button:has-text("Escala")').click();
    await page.waitForTimeout(3000);

    expect(jsErrors.length).toBe(0);
  });

  test("04 — Renderiza header, corpo com dados ou estado vazio sem erros", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("Escala")').click();
    await page.waitForTimeout(5000);

    const body = page.locator("body");
    await expect(body).not.toContainText("Carregando sessão", { timeout: 10000 });

    const pageText = (await body.textContent()) || "";
    const temHeader = pageText.includes("Escala Operacional");
    const temDados = pageText.includes("registro(s)") || pageText.includes("Total");
    const temMensagem = pageText.includes("Cliente não identificado") || pageText.includes("Nenhuma alocação encontrada");

    expect(temHeader).toBeTruthy();
    if (!temMensagem) {
      expect(temDados || pageText.includes("Carregando")).toBeTruthy();
    }
    expect(jsErrors.length).toBe(0);
  });

  test("05 — Navegação ampla por sidebar sem erros de console", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    const abas = ["Executivo", "Insights IA", "Escala", "Pedidos", "Comprovantes", "Dashboard"];
    for (const aba of abas) {
      const btn = page.locator(`nav button:has-text("${aba}")`).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(2000);
      }
    }

    expect(jsErrors.length).toBe(0);
  });
});
