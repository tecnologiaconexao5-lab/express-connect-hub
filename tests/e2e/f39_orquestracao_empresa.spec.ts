// ============================================================
// F39 — Testes E2E: Orquestração Enterprise
// ============================================================

import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/central-ia");
  await page.waitForLoadState("networkidle");
});

test.describe("F39 — Orquestração Enterprise (Fluxos Corporativos)", () => {
  test("1. Central IA carrega sem erros de console", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    await expect(page.locator("body")).toBeVisible({ timeout: 15000 });
    const abas = page.locator("button, [role='tab'], a").filter({ hasText: /Robôs|Robo|Missões|Trabalho|Diretor|Fluxos|Logs/i });
    if (await abas.count() > 0) { await abas.first().click(); await page.waitForTimeout(500); }
    expect(consoleErrors.length).toBe(0);
  });

  test("2. Navegação ampla entre todas as abas sem erros", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    const abas = page.locator("button, [role='tab'], a");
    const count = await abas.count();
    for (let i = 0; i < Math.min(count, 15); i++) {
      const aba = abas.nth(i);
      if (await aba.isVisible()) { await aba.click(); await page.waitForTimeout(300); }
    }
    expect(consoleErrors.length).toBe(0);
  });

  test("3. Aba Diretor Virtual carrega", async ({ page }) => {
    const tab = page.locator("button, [role='tab'], a").filter({ hasText: /Diretor|diretor/i });
    if (await tab.isVisible()) { await tab.click(); await page.waitForTimeout(1000); }
    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    await page.waitForTimeout(2000);
    expect(consoleErrors.length).toBe(0);
  });

  test("4. Aba Missões carrega", async ({ page }) => {
    const tab = page.locator("button, [role='tab'], a").filter({ hasText: /Missões|missoes|Missao/i });
    if (await tab.isVisible()) { await tab.click(); await page.waitForTimeout(1000); }
    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    await page.waitForTimeout(2000);
    expect(consoleErrors.length).toBe(0);
  });

  test("5. Aba Trabalho carrega", async ({ page }) => {
    const tab = page.locator("button, [role='tab'], a").filter({ hasText: /Trabalho|trabalho/i });
    if (await tab.isVisible()) { await tab.click(); await page.waitForTimeout(1000); }
    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    await page.waitForTimeout(2000);
    expect(consoleErrors.length).toBe(0);
  });

  test("6. Aba Conectores carrega", async ({ page }) => {
    const tab = page.locator("button, [role='tab'], a").filter({ hasText: /Conectores|conectores/i });
    if (await tab.isVisible()) { await tab.click(); await page.waitForTimeout(1000); }
    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    await page.waitForTimeout(2000);
    expect(consoleErrors.length).toBe(0);
  });

  test("7. Validação final sem erros de console", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    const abas = page.locator("button, [role='tab'], a");
    const count = await abas.count();
    for (let i = 0; i < Math.min(count, 10); i += 2) {
      const aba = abas.nth(i);
      if (await aba.isVisible()) { await aba.click(); await page.waitForTimeout(200); }
    }
    await page.waitForTimeout(1000);
    expect(consoleErrors.length).toBe(0);
  });
});
