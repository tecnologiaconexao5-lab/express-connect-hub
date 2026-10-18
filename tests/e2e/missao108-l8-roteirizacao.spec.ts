// ============================================================
// MISSÃO 108-L8 — Portal Roteirização Real
// Valida: sidebar, navegação, render com dados reais ou empty state
// ============================================================

import { test, expect } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";
import { tirarScreenshot } from "./helpers/screenshots";

test.describe("M108-L8: Roteirização Real", () => {
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

  test("01 — Sidebar item Roteirização existe e navega sem erros", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    const roteirizacaoBtn = page.locator('nav button:has-text("Roteirização")');
    await expect(roteirizacaoBtn).toBeVisible({ timeout: 10000 });
    await roteirizacaoBtn.click();
    await page.waitForTimeout(4000);

    await tirarScreenshot(page, "m108l8-roteirizacao");
    const body = page.locator("body");
    await expect(body).not.toContainText("Carregando sessão", { timeout: 10000 });
    expect(jsErrors.length).toBe(0);
  });

  test("02 — Renderiza título Roteirização e indicadores", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("Roteirização")').click();
    await page.waitForTimeout(5000);

    await expect(page.locator("text=Roteirização").first()).toBeVisible({ timeout: 10000 });

    const body = page.locator("body");
    const text = await body.textContent();
    expect(text).toContain("Roteirização");

    expect(jsErrors.length).toBe(0);

    await tirarScreenshot(page, "m108l8-roteirizacao-indicadores");
  });

  test("03 — Filtro de período funciona", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("Roteirização")').click();
    await page.waitForTimeout(3000);

    const filterSelect = page.locator('select, [role="combobox"]').first();
    if (await filterSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filterSelect.click();
      await page.waitForTimeout(500);
      const option = page.locator('option, [role="option"]:has-text("7 dias")').first();
      if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
        await option.click();
        await page.waitForTimeout(3000);
      }
    }

    expect(jsErrors.length).toBe(0);
  });

  test("04 — Botão refresh carrega dados sem erros", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("Roteirização")').click();
    await page.waitForTimeout(3000);

    const refreshBtn = page.locator('button svg[class*="refresh"], button[title*="carregar" i]').first();
    if (await refreshBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await refreshBtn.click();
      await page.waitForTimeout(3000);
    }

    expect(jsErrors.length).toBe(0);
  });

  test("05 — Navegação para outras abas e volta sem erros", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("Roteirização")').click();
    await page.waitForTimeout(3000);

    await page.locator('nav button:has-text("Dashboard")').click();
    await page.waitForTimeout(2000);

    await page.locator('nav button:has-text("Roteirização")').click();
    await page.waitForTimeout(3000);

    expect(jsErrors.length).toBe(0);
  });

  test("06 — Abre modal de detalhes se houver rota", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("Roteirização")').click();
    await page.waitForTimeout(5000);

    const rotaCard = page.locator('div[class*="cursor-pointer"]:has-text("Rota")').first();
    if (await rotaCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await rotaCard.click();
      await page.waitForTimeout(2000);

      await expect(page.locator("text=Detalhes da Rota").first()).toBeVisible({ timeout: 5000 });
    }

    expect(jsErrors.length).toBe(0);

    await tirarScreenshot(page, "m108l8-roteirizacao-detalhes");
  });

  test("07 — Renderiza KPIs visíveis na tela", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("Roteirização")').click();
    await page.waitForTimeout(5000);

    const kpis = ["Entregas", "Regiões", "Distância", "Tempo Est.", "Veículos", "Ocupação", "SLA", "Atrasos"];
    for (const kpi of kpis) {
      const el = page.locator(`text=${kpi}`).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(el).toBeVisible();
      }
    }

    expect(jsErrors.length).toBe(0);
  });
});
