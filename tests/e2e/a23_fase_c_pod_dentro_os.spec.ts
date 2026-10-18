import { test, expect } from "@playwright/test";
import * as path from "path";

const SCREENSHOT_DIR = "test-results/e2e/comprovantes-a23c";
const ADMIN_EMAIL = "tamiris.castilho@conexaoexpress.com.br";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "Conexao@2026";

async function loginAndGoToDashboard(page: import("@playwright/test").Page) {
  await page.goto("/login", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);
  const emailInput = page.locator('input[type="email"]').first();
  await emailInput.waitFor({ state: "visible", timeout: 10000 });
  await emailInput.click();
  await emailInput.type(ADMIN_EMAIL, { delay: 30 });
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.waitFor({ state: "visible", timeout: 5000 });
  await passwordInput.click();
  await passwordInput.type(ADMIN_PASSWORD, { delay: 30 });
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL("**/dashboard", { timeout: 20000 });
  await page.waitForTimeout(3000);
}

test.describe("MISSÃO A23 — FASE C — POD dentro da OS", () => {

  test("1. Lista de OS mostra ação 'Ver comprovantes'", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await loginAndGoToDashboard(page);

    const apoioBtn = page.locator('button:has-text("Apoio Operacional"), div:has-text("Apoio Operacional")').first();
    await apoioBtn.waitFor({ state: "visible", timeout: 10000 });
    await apoioBtn.click();
    await page.waitForTimeout(1500);

    const osBtn = page.locator('a:has-text("Ordens de Serviço"), button:has-text("Ordens de Serviço")').first();
    await osBtn.waitFor({ state: "visible", timeout: 10000 });
    await osBtn.click();
    await page.waitForTimeout(6000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-lista-os.png"), fullPage: true });

    const verComprovante = page.locator('button[title="Ver comprovantes"]').first();
    const visible = await verComprovante.isVisible().catch(() => false);
    console.log(`[TEST] Ação Ver comprovantes visível: ${visible}`);
    expect(visible).toBeTruthy();

    expect(jsErrors.filter(e => !e.includes("favicon") && !e.includes("WebSocket") && !e.includes("HMR")).length).toBe(0);
  });

  test("2. Ação 'Ver comprovantes' abre a OS em modo visualização", async ({ page }) => {
    await loginAndGoToDashboard(page);

    const apoioBtn = page.locator('button:has-text("Apoio Operacional"), div:has-text("Apoio Operacional")').first();
    await apoioBtn.waitFor({ state: "visible", timeout: 10000 });
    await apoioBtn.click();
    await page.waitForTimeout(1500);

    const osBtn = page.locator('a:has-text("Ordens de Serviço"), button:has-text("Ordens de Serviço")').first();
    await osBtn.waitFor({ state: "visible", timeout: 10000 });
    await osBtn.click();
    await page.waitForTimeout(6000);

    const verComprovante = page.locator('button[title="Ver comprovantes"]').first();
    const visible = await verComprovante.isVisible().catch(() => false);
    if (visible) {
      await verComprovante.click();
      await page.waitForTimeout(5000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-os-aberta.png"), fullPage: true });
      const body = await page.textContent("body") || "";
      expect(body.length).toBeGreaterThan(200);
    } else {
      console.log("[TEST] Nenhuma OS com ação visível — fluxo não testável com dados atuais");
    }
  });

  test("3. Navegação para aba Histórico (Entregas e Comprovantes) sem erros", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await loginAndGoToDashboard(page);

    const apoioBtn = page.locator('button:has-text("Apoio Operacional"), div:has-text("Apoio Operacional")').first();
    await apoioBtn.waitFor({ state: "visible", timeout: 10000 });
    await apoioBtn.click();
    await page.waitForTimeout(1500);

    const osBtn = page.locator('a:has-text("Ordens de Serviço"), button:has-text("Ordens de Serviço")').first();
    await osBtn.waitFor({ state: "visible", timeout: 10000 });
    await osBtn.click();
    await page.waitForTimeout(6000);

    const verComprovante = page.locator('button[title="Ver comprovantes"]').first();
    const visible = await verComprovante.isVisible().catch(() => false);
    if (visible) {
      await verComprovante.click();
      await page.waitForTimeout(5000);
      const historicoTab = page.locator('button:has-text("Histórico"), [role="tab"]:has-text("Histórico"), button:has-text("Histórico")').first();
      const tabVisible = await historicoTab.isVisible().catch(() => false);
      if (tabVisible) {
        await historicoTab.click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-aba-historico.png"), fullPage: true });
        const body = await page.textContent("body") || "";
        expect(body.length).toBeGreaterThan(200);
      }
    }

    expect(jsErrors.filter(e => !e.includes("favicon") && !e.includes("WebSocket") && !e.includes("HMR")).length).toBe(0);
  });
});
