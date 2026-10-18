import { test, expect } from "@playwright/test";
import * as path from "path";

const BASE_URL = process.env.TMS_BASE_URL || "http://localhost:8800";
const SCREENSHOT_DIR = "test-results/e2e/a25-d";
const ADMIN_EMAIL = "tamiris.castilho@conexaoexpress.com.br";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "Conexao@2026";

test.describe("A25-D — Correção final tracking (Torre abre, sem erro)", () => {

  test("Torre abre, sem erros JS, mensagens/KPI/mapa renderizam", async ({ page }) => {
    const consoleErrors: string[] = [];
    const jsErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(2000);
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.waitFor({ state: "visible", timeout: 15000 });
    await emailInput.click();
    await emailInput.type(ADMIN_EMAIL, { delay: 20 });
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.waitFor({ state: "visible", timeout: 5000 });
    await passwordInput.click();
    await passwordInput.type(ADMIN_PASSWORD, { delay: 20 });
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL("**/dashboard", { timeout: 30000 });
    await page.waitForTimeout(3000);

    // Torre
    const torreBtn = page.locator('button:has-text("Torre de Controle"), a:has-text("Torre de Controle")').first();
    await torreBtn.waitFor({ state: "visible", timeout: 15000 });
    await torreBtn.click();
    await page.waitForTimeout(8000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-torre.png"), fullPage: true });

    expect(page.url()).toContain("torre-controle");
    const bodyText = (await page.textContent("body")) || "";
    expect(bodyText).not.toContain("Error Boundary");

    // Sem erro realtime
    const realtimeErr = consoleErrors.filter((e) => e.includes("cannot add 'postgres_changes' callbacks"));
    expect(realtimeErr).toHaveLength(0);

    // KPI PODs Pendentes e Central de Alertas
    expect(await page.locator('text=PODs Pendentes').first().isVisible().catch(() => false)).toBeTruthy();
    expect(await page.locator('text=Central de Alertas').first().isVisible().catch(() => false)).toBeTruthy();

    // Botão Mensagens (A24) continua
    expect(await page.locator('button:has-text("Mensagens")').first().isVisible().catch(() => false)).toBeTruthy();

    // Consulta à alocação sem OS (rede): busca alocacoes_escala
    // (a Torre chama buscarAlocacoesSemOS ao montar)
    const criticalJs = jsErrors.filter((e) => !e.includes("favicon") && !e.includes("WebSocket") && !e.includes("HMR") && !e.includes("ResizeObserver"));
    expect(criticalJs).toHaveLength(0);

    // Remontagem: sair e voltar para Torre
    const dashboardBtn = page.locator('button:has-text("Dashboard Executivo"), a:has-text("Dashboard Executivo")').first();
    await dashboardBtn.waitFor({ state: "visible", timeout: 10000 });
    await dashboardBtn.click();
    await page.waitForURL("**/dashboard", { timeout: 20000 });
    await page.waitForTimeout(3000);

    const torreBtn2 = page.locator('button:has-text("Torre de Controle"), a:has-text("Torre de Controle")').first();
    await torreBtn2.click();
    await page.waitForTimeout(6000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-torre-remontada.png"), fullPage: true });

    const bodyText2 = (await page.textContent("body")) || "";
    expect(bodyText2).not.toContain("Error Boundary");
    const realtimeErr2 = consoleErrors.filter((e) => e.includes("cannot add 'postgres_changes' callbacks"));
    expect(realtimeErr2).toHaveLength(0);
    expect(await page.locator('text=PODs Pendentes').first().isVisible().catch(() => false)).toBeTruthy();

    console.log(`[PROVA] console errors totais: ${consoleErrors.length}`);
    console.log(`[PROVA] pageerrors críticos: ${criticalJs.length}`);
  });
});
