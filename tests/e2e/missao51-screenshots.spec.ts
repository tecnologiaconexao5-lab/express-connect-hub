import { test, expect } from "@playwright/test";
import * as path from "path";

const SCREENSHOT_DIR = "test-results/screenshots/logins-reais";

test.describe("MISSÃO 51 — Screenshots", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("Screenshot 01 - contato", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle", timeout: 30000 });
    await page.locator('input[type="email"]').fill("contato@conexaoexpress.com.br");
    await page.locator('input[type="password"]').fill("Conexao@2026");
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-contato.png"), fullPage: true });
  });

  test("Screenshot 02 - tamiris", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle", timeout: 30000 });
    await page.locator('input[type="email"]').fill("tamiris.castilho@conexaoexpress.com.br");
    await page.locator('input[type="password"]').fill("Conexao@2026");
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-tamiris.png"), fullPage: true });
  });

  test("Screenshot 03 - cliente-teste", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle", timeout: 30000 });
    await page.locator('input[type="email"]').fill("cliente.teste@conexaoexpress.com.br");
    await page.locator('input[type="password"]').fill("Teste@2026");
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-cliente-teste.png"), fullPage: true });
  });

  test("Screenshot 04 - portal-cliente-dados-reais", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle", timeout: 30000 });
    await page.locator('input[type="email"]').fill("cliente.teste@conexaoexpress.com.br");
    await page.locator('input[type="password"]').fill("Teste@2026");
    await page.locator('button[type="submit"]').click();
    try {
      await page.waitForURL(/\/portal-cliente/, { timeout: 30000 });
    } catch (e) {}
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-portal-cliente-dados-reais.png"), fullPage: true });
  });
});
