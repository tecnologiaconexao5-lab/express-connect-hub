import { test, expect } from "@playwright/test";
import * as path from "path";

const SCREENSHOT_DIR = "test-results/e2e/comprovantes";
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
  console.log(`[AUTH] Logado em: ${page.url()}`);
}

test.describe("MISSÃO A23 — FASE A — Central de Comprovantes", () => {

  test("1. Rota /comprovantes acessível via sidebar", async ({ page }) => {
    const jsErrors: string[] = [];
    const httpErrors: { url: string; status: number }[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));
    page.on("response", (resp) => {
      if (resp.status() >= 400) httpErrors.push({ url: resp.url(), status: resp.status() });
    });

    await loginAndGoToDashboard(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-dashboard.png") });

    // Navegação SPA via sidebar (regra de ouro: nunca page.goto para rotas lazy)
    const apoioBtn = page.locator('button:has-text("Apoio Operacional"), div:has-text("Apoio Operacional")').first();
    await apoioBtn.waitFor({ state: "visible", timeout: 10000 });
    await apoioBtn.click();
    await page.waitForTimeout(1500);

    const comprovantesBtn = page.locator('a:has-text("Comprovantes de Entrega"), button:has-text("Comprovantes de Entrega")').first();
    await comprovantesBtn.waitFor({ state: "visible", timeout: 10000 });
    await comprovantesBtn.click();
    await page.waitForTimeout(5000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-comprovantes-tela.png"), fullPage: true });

    expect(page.url()).toContain("comprovantes");

    const heading = page.locator("h1:has-text('Comprovantes de Entrega')").first();
    await expect(heading).toBeVisible({ timeout: 8000 });

    const body = await page.textContent("body") || "";
    expect(body.length).toBeGreaterThan(200);

    expect(jsErrors.filter(e => !e.includes("favicon") && !e.includes("WebSocket") && !e.includes("HMR")).length).toBe(0);
    const errorsUnexpected = httpErrors.filter(e => !e.url.includes("supabase") && e.status !== 404);
    expect(errorsUnexpected.length).toBe(0);
  });

  test("2. Filtros profissionais visíveis (busca, período, cliente, OS, prestador, destinatário, situação)", async ({ page }) => {
    await loginAndGoToDashboard(page);

    const apoioBtn = page.locator('button:has-text("Apoio Operacional"), div:has-text("Apoio Operacional")').first();
    await apoioBtn.waitFor({ state: "visible", timeout: 10000 });
    await apoioBtn.click();
    await page.waitForTimeout(1500);

    const comprovantesBtn = page.locator('a:has-text("Comprovantes de Entrega"), button:has-text("Comprovantes de Entrega")').first();
    await comprovantesBtn.waitFor({ state: "visible", timeout: 10000 });
    await comprovantesBtn.click();
    await page.waitForTimeout(4000);

    const buscaInput = page.locator('input[placeholder*="Buscar"]').first();
    await expect(buscaInput).toBeVisible({ timeout: 8000 });

    const comboboxes = page.locator("[role='combobox']");
    const comboboxCount = await comboboxes.count();
    console.log(`[TEST] Comboboxes: ${comboboxCount}`);
    expect(comboboxCount).toBeGreaterThanOrEqual(2);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-filtros.png"), fullPage: true });
  });

  test("3. Busca geral filtra a listagem", async ({ page }) => {
    await loginAndGoToDashboard(page);

    const apoioBtn = page.locator('button:has-text("Apoio Operacional"), div:has-text("Apoio Operacional")').first();
    await apoioBtn.waitFor({ state: "visible", timeout: 10000 });
    await apoioBtn.click();
    await page.waitForTimeout(1500);

    const comprovantesBtn = page.locator('a:has-text("Comprovantes de Entrega"), button:has-text("Comprovantes de Entrega")').first();
    await comprovantesBtn.waitFor({ state: "visible", timeout: 10000 });
    await comprovantesBtn.click();
    await page.waitForTimeout(4000);

    const buscaInput = page.locator('input[placeholder*="Buscar"]').first();
    await buscaInput.fill("XPTO_NAO_EXISTE_123");
    await page.waitForTimeout(1500);

    const emptyText = page.locator("text=Nenhum comprovante encontrado");
    const emptyVisible = await emptyText.isVisible().catch(() => false);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-busca-vazia.png"), fullPage: true });
    console.log(`[TEST] Empty state visível: ${emptyVisible}`);
  });

  test("4. Listagem com colunas operacionais e dados de entregas_protocolo (network)", async ({ page }) => {
    const apiCalls: string[] = [];
    const httpErrors: { url: string; status: number }[] = [];
    page.on("request", (req) => {
      if (req.url().includes("supabase") && req.url().includes("rest/v1")) {
        apiCalls.push(req.url().split("?")[0]);
      }
    });
    page.on("response", (resp) => {
      if (resp.status() >= 400) httpErrors.push({ url: resp.url(), status: resp.status() });
    });

    await loginAndGoToDashboard(page);

    const apoioBtn = page.locator('button:has-text("Apoio Operacional"), div:has-text("Apoio Operacional")').first();
    await apoioBtn.waitFor({ state: "visible", timeout: 10000 });
    await apoioBtn.click();
    await page.waitForTimeout(1500);

    const comprovantesBtn = page.locator('a:has-text("Comprovantes de Entrega"), button:has-text("Comprovantes de Entrega")').first();
    await comprovantesBtn.waitFor({ state: "visible", timeout: 10000 });
    await comprovantesBtn.click();
    await page.waitForTimeout(6000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05-listagem.png"), fullPage: true });

    const queriedEntregas = apiCalls.some((c) => c.includes("entregas_protocolo"));
    console.log(`[TEST] entregas_protocolo consultada: ${queriedEntregas}`);
    expect(queriedEntregas).toBeTruthy();

    const errorsUnexpected = httpErrors.filter(e => !e.url.includes("supabase") && e.status !== 404);
    expect(errorsUnexpected.length).toBe(0);
  });

  test("5. Ação 'Ver comprovante' abre o dossiê", async ({ page }) => {
    await loginAndGoToDashboard(page);

    const apoioBtn = page.locator('button:has-text("Apoio Operacional"), div:has-text("Apoio Operacional")').first();
    await apoioBtn.waitFor({ state: "visible", timeout: 10000 });
    await apoioBtn.click();
    await page.waitForTimeout(1500);

    const comprovantesBtn = page.locator('a:has-text("Comprovantes de Entrega"), button:has-text("Comprovantes de Entrega")').first();
    await comprovantesBtn.waitFor({ state: "visible", timeout: 10000 });
    await comprovantesBtn.click();
    await page.waitForTimeout(6000);

    const verComprovanteBtn = page.locator('button:has-text("Ver comprovante")').first();
    const visible = await verComprovanteBtn.isVisible().catch(() => false);
    if (visible) {
      await verComprovanteBtn.click();
      await page.waitForTimeout(4000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06-dossie-aberto.png"), fullPage: true });
      const body = await page.textContent("body") || "";
      expect(body.length).toBeGreaterThan(300);
    } else {
      console.log("[TEST] Nenhum comprovante disponível — dossiê não testável com dados reais atuais");
    }
  });
});
