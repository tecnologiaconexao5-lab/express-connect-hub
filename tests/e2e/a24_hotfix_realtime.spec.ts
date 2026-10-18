import { test, expect } from "@playwright/test";
import * as path from "path";

// HOTFIX A24 — validação REAL da Torre em execução.
// Alvo: http://localhost:8800 (dev server ativo). Requer login real (credenciais QA/PRODUÇÃO permitidas p/ leitura).
const BASE_URL = process.env.TMS_BASE_URL || "http://localhost:8800";
const SCREENSHOT_DIR = "test-results/e2e/a24-hotfix";
const ADMIN_EMAIL = "tamiris.castilho@conexaoexpress.com.br";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "Conexao@2026";

test.describe("HOTFIX A24 — Torre abre sem erro Realtime", () => {

  test("Torre abre, sem Error Boundary, sem erro realtime, Mensagens/KPI/Alertas OK", async ({ page }) => {
    const consoleErrors: string[] = [];
    const jsErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => jsErrors.push(err.message));

    // Login
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
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-dashboard.png") });

    // Navegar para a Torre (sidebar)
    const torreBtn = page.locator('button:has-text("Torre de Controle"), a:has-text("Torre de Controle")').first();
    await torreBtn.waitFor({ state: "visible", timeout: 15000 });
    await torreBtn.click();
    await page.waitForTimeout(8000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-torre.png"), fullPage: true });

    const url = page.url();
    console.log(`[PROVA] URL Torre: ${url}`);

    // 1. Torre abriu? (sem NotFound / sem tela de erro)
    const bodyText = (await page.textContent("body")) || "";
    expect(url).toContain("torre-controle");
    expect(bodyText).not.toContain("Algo deu errado");
    expect(bodyText).not.toContain("Error Boundary");
    console.log(`[PROVA] Torre abriu (body len=${bodyText.length})`);

    // 2. Erro realtime específico NÃO deve aparecer no console
    const realtimeErr = consoleErrors.filter((e) => e.includes("cannot add 'postgres_changes' callbacks"));
    console.log(`[PROVA] Erros realtime no console: ${realtimeErr.length}`);
    expect(realtimeErr).toHaveLength(0);

    // 3. Nenhum pageerror crítico
    const criticalJs = jsErrors.filter((e) => !e.includes("favicon") && !e.includes("WebSocket") && !e.includes("HMR") && !e.includes("ResizeObserver"));
    console.log(`[PROVA] pageerrors críticos: ${criticalJs.length}`);
    expect(criticalJs).toHaveLength(0);

    // 4. KPI PODs Pendentes visível
    const kpiVisible = await page.locator('text=PODs Pendentes').first().isVisible().catch(() => false);
    console.log(`[PROVA] KPI PODs Pendentes: ${kpiVisible}`);
    expect(kpiVisible).toBeTruthy();

    // 5. Central de Alertas visível
    const alertasVisible = await page.locator('text=Central de Alertas').first().isVisible().catch(() => false);
    console.log(`[PROVA] Central de Alertas: ${alertasVisible}`);
    expect(alertasVisible).toBeTruthy();

    // 6. Botão Mensagens visível
    const btnMensagens = page.locator('button:has-text("Mensagens")').first();
    const msgVisible = await btnMensagens.isVisible().catch(() => false);
    console.log(`[PROVA] Botão Mensagens: ${msgVisible}`);
    expect(msgVisible).toBeTruthy();

    // 7. Abrir painel de mensagens
    await btnMensagens.click();
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-painel-mensagens.png"), fullPage: true });
    const chatVisible = await page.locator('text=Mensagens / Chat com Prestadores').first().isVisible().catch(() => false);
    console.log(`[PROVA] Painel Mensagens abre: ${chatVisible}`);
    expect(chatVisible).toBeTruthy();

    // 8. Fechar e navegar para outra tela e voltar para a Torre (re-montagem)
    await page.locator('button[data-state]').first().press("Escape").catch(() => {});
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1000);

    const dashboardBtn = page.locator('button:has-text("Dashboard Executivo"), a:has-text("Dashboard Executivo")').first();
    await dashboardBtn.waitFor({ state: "visible", timeout: 10000 });
    await dashboardBtn.click();
    await page.waitForURL("**/dashboard", { timeout: 20000 });
    await page.waitForTimeout(3000);

    const torreBtn2 = page.locator('button:has-text("Torre de Controle"), a:has-text("Torre de Controle")').first();
    await torreBtn2.click();
    await page.waitForTimeout(6000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-torre-remontada.png"), fullPage: true });

    // Re-montagem sem erro realtime
    const realtimeErr2 = consoleErrors.filter((e) => e.includes("cannot add 'postgres_changes' callbacks"));
    console.log(`[PROVA] Erros realtime após re-montagem: ${realtimeErr2.length}`);
    expect(realtimeErr2).toHaveLength(0);
    const bodyText2 = (await page.textContent("body")) || "";
    expect(bodyText2).not.toContain("Error Boundary");

    // 9. KPI continua após re-montagem
    const kpiVisible2 = await page.locator('text=PODs Pendentes').first().isVisible().catch(() => false);
    console.log(`[PROVA] KPI POD após re-montagem: ${kpiVisible2}`);
    expect(kpiVisible2).toBeTruthy();

    console.log(`\n[RESUMO] console errors totais: ${consoleErrors.length}`);
    consoleErrors.slice(0, 10).forEach((e) => console.log(`  console.error: ${e}`));
  });
});
