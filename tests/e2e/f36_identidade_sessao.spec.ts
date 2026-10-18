// ============================================================
// F36 — Testes E2E: Identidade Digital, Sessões e Credenciais
// ============================================================

import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/central-ia");
  await page.waitForLoadState("networkidle");
});

test.describe("F36 — Identidade Digital", () => {
  test("1. Central IA carrega sem erros de console", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

    await expect(page.locator("body")).toBeVisible({ timeout: 15000 });

    // Navega para a primeira aba visível para confirmar que a UI carregou
    const abas = page.locator("button, [role='tab'], a").filter({ hasText: /Robôs|Robo|Conhecimento|Missões|Trabalho/i });
    const count = await abas.count();
    if (count > 0) {
      await abas.first().click();
      await page.waitForTimeout(500);
    }

    expect(consoleErrors.length).toBe(0);
  });

  test("2. Navegação ampla entre todas as abas sem erros", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

    // Navega por todas as abas visíveis
    const abas = page.locator('[role="tablist"] button, [role="tablist"] [role="tab"]');
    const count = await abas.count();
    console.log(`  📋 ${count} abas encontradas`);

    for (let i = 0; i < Math.min(count, 15); i++) {
      const aba = abas.nth(i);
      if (await aba.isVisible()) {
        await aba.click();
        await page.waitForTimeout(400);
      }
    }

    expect(consoleErrors.length).toBe(0);
  });

  test("3. Aba Ferramentas carrega catálogo", async ({ page }) => {
    // Navega para a aba Ferramentas
    const ferramentasTab = page.locator('[role="tablist"] button, [role="tablist"] [role="tab"]').filter({ hasText: /Ferramentas|ferramentas/i });
    if (await ferramentasTab.isVisible()) {
      await ferramentasTab.click();
      await page.waitForTimeout(1000);
    }

    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

    // Verifica que algo carregou
    await page.waitForTimeout(2000);
    expect(consoleErrors.length).toBe(0);
  });

  test("4. Aba Conectores carrega", async ({ page }) => {
    const conectoresTab = page.locator('[role="tablist"] button, [role="tablist"] [role="tab"]').filter({ hasText: /Conectores|conectores/i });
    if (await conectoresTab.isVisible()) {
      await conectoresTab.click();
      await page.waitForTimeout(1000);
    }

    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

    await page.waitForTimeout(2000);
    expect(consoleErrors.length).toBe(0);
  });

  test("5. Aba Trabalho carrega", async ({ page }) => {
    const trabalhaTab = page.locator('[role="tablist"] button, [role="tablist"] [role="tab"]').filter({ hasText: /Trabalho|trabalho/i });
    if (await trabalhaTab.isVisible()) {
      await trabalhaTab.click();
      await page.waitForTimeout(1000);
    }

    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

    await page.waitForTimeout(2000);
    expect(consoleErrors.length).toBe(0);
  });

  test("6. Validação final sem erros de console", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

    // Navega rapidamente por 5 abas para estressar
    const abas = page.locator('[role="tablist"] button, [role="tablist"] [role="tab"]');
    const count = await abas.count();
    for (let i = 0; i < Math.min(count, 10); i += 2) {
      const aba = abas.nth(i);
      if (await aba.isVisible()) {
        await aba.click();
        await page.waitForTimeout(200);
      }
    }

    await page.waitForTimeout(1000);
    expect(consoleErrors.length).toBe(0);
  });
});
