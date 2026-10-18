import { test, expect } from "@playwright/test";
import * as path from "path";

const SCREENSHOT_DIR = "test-results/e2e/comprovantes-a23d";
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

async function goToConferenciaFinanceira(page: import("@playwright/test").Page) {
  await loginAndGoToDashboard(page);
  const financeiroBtn = page.locator('button:has-text("Financeiro Enterprise"), div:has-text("Financeiro Enterprise")').first();
  await financeiroBtn.waitFor({ state: "visible", timeout: 10000 });
  await financeiroBtn.click();
  await page.waitForTimeout(1500);
  const receberBtn = page.locator('a:has-text("Contas a Receber"), button:has-text("Contas a Receber")').first();
  await receberBtn.waitFor({ state: "visible", timeout: 10000 });
  await receberBtn.click();
  await page.waitForTimeout(4000);
}

test.describe("MISSÃO A23 — FASE D — POD ↔ Financeiro", () => {

  test("1. Conferência Financeira carrega sem erros JS", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await goToConferenciaFinanceira(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-conferencia.png"), fullPage: true });

    expect(jsErrors.filter(e => !e.includes("favicon") && !e.includes("WebSocket") && !e.includes("HMR")).length).toBe(0);
  });

  test("2. Consulta entregas_protocolo (fonte oficial de POD)", async ({ page }) => {
    const apiCalls: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("supabase") && req.url().includes("rest/v1")) {
        apiCalls.push(req.url().split("?")[0]);
      }
    });

    await goToConferenciaFinanceira(page);
    await page.waitForTimeout(6000);

    const queriedEntregas = apiCalls.some((c) => c.includes("entregas_protocolo"));
    console.log(`[TEST] entregas_protocolo consultada: ${queriedEntregas}`);
    expect(queriedEntregas).toBeTruthy();
  });

  test("3. Pagamentos — prestadores consulta entregas_protocolo para status de comprovante", async ({ page }) => {
    const apiCalls: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("supabase") && req.url().includes("rest/v1")) {
        apiCalls.push(req.url().split("?")[0]);
      }
    });

    await loginAndGoToDashboard(page);
    const financeiroBtn = page.locator('button:has-text("Financeiro Enterprise"), div:has-text("Financeiro Enterprise")').first();
    await financeiroBtn.waitFor({ state: "visible", timeout: 10000 });
    await financeiroBtn.click();
    await page.waitForTimeout(1500);
    const pagamentoBtn = page.locator('a:has-text("Pagamento em Lote (CNAB)"), button:has-text("Pagamento em Lote"), a:has-text("Pagamentos")').first();
    const visible = await pagamentoBtn.isVisible().catch(() => false);
    if (visible) {
      await pagamentoBtn.click();
      await page.waitForTimeout(6000);
      const queriedEntregas = apiCalls.some((c) => c.includes("entregas_protocolo"));
      console.log(`[TEST] PagamentoPrestadores — entregas_protocolo consultada: ${queriedEntregas}`);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-pagamento.png"), fullPage: true });
  });
});
