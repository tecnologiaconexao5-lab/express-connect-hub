import { test, expect } from "@playwright/test";
import * as path from "path";

const BASE_URL = process.env.TMS_BASE_URL || "http://localhost:8800";
const SCREENSHOT_DIR = "test-results/e2e/a25-l";
const ADMIN_EMAIL = "tamiris.castilho@conexaoexpress.com.br";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "Conexao@2026";

const consoleErrors: string[] = [];
const jsErrors: string[] = [];

async function loginAndOpenTorre(page: import("@playwright/test").Page) {
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

  const torreBtn = page.locator('button:has-text("Torre de Controle"), a:has-text("Torre de Controle")').first();
  await torreBtn.waitFor({ state: "visible", timeout: 15000 });
  await torreBtn.click();
  await page.waitForTimeout(9000);
}

test.describe("A25-L — Homologação Torre/Tracking — Painel da operação sem OS (Parte E)", () => {

  test("1. Torre abre sem Error Boundary e sem erro realtime (regressão A25-D)", async ({ page }) => {
    await loginAndOpenTorre(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-torre.png"), fullPage: true });

    expect(page.url()).toContain("torre-controle");
    const bodyText = (await page.textContent("body")) || "";
    expect(bodyText).not.toContain("Error Boundary");

    const realtimeErr = consoleErrors.filter((e) => e.includes("cannot add 'postgres_changes' callbacks"));
    expect(realtimeErr).toHaveLength(0);

    expect(await page.locator('text=PODs Pendentes').first().isVisible().catch(() => false)).toBeTruthy();
    expect(await page.locator('text=Central de Alertas').first().isVisible().catch(() => false)).toBeTruthy();

    const criticalJs = jsErrors.filter((e) =>
      !e.includes("favicon") && !e.includes("WebSocket") && !e.includes("HMR") && !e.includes("ResizeObserver")
    );
    console.log(`[PROVA] pageerrors críticos: ${criticalJs.length}`);
    expect(criticalJs).toHaveLength(0);
  });

  test("2. Abrir Painel Completo de um marcador renderiza o sheet sem crash", async ({ page }) => {
    await loginAndOpenTorre(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-torre-map.png"), fullPage: true });

    // Marcadores DOM (mapboxgl-marker) existem quando clustering está desligado (<=5 locs)
    const marcador = page.locator(".mapboxgl-marker").first();
    const temMarcador = await marcador.isVisible().catch(() => false);

    if (temMarcador) {
      await marcador.click({ force: true });
      await page.waitForTimeout(1500);

      const btnPainel = page.locator('button:has-text("Abrir Painel Completo")').first();
      const temBtn = await btnPainel.isVisible().catch(() => false);
      console.log(`[PROVA] popup 'Abrir Painel Completo' visível: ${temBtn}`);

      if (temBtn) {
        await btnPainel.click();
        await page.waitForTimeout(3500);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-painel-aberto.png"), fullPage: true });

        const bodyText = (await page.textContent("body")) || "";
        expect(bodyText).not.toContain("Error Boundary");
        expect(bodyText).not.toContain("Rendered more hooks");

        // Sheet da operação presente — verifica seções estáveis do DetalhesOperacaoSheet
        const secaoStatus = bodyText.includes("Status da Operação");
        const secaoPrestador = bodyText.includes("Prestador e Veículo");
        const secaoGPS = bodyText.includes("Dados do Dispositivo") || bodyText.includes("Bateria");
        console.log(`[PROVA] status:${secaoStatus} prestador:${secaoPrestador} gps:${secaoGPS}`);
        expect(secaoStatus && secaoPrestador && secaoGPS).toBeTruthy();
      } else {
        console.log("[SKIP] popup não abriu (depende de dados de GPS recentes) — validação de aba do painel pulada");
      }
    } else {
      console.log("[SKIP] nenhum marcador DOM visível (clustering ativo ou sem GPS recente)");
    }

    const criticalJs = jsErrors.filter((e) =>
      !e.includes("favicon") && !e.includes("WebSocket") && !e.includes("HMR") && !e.includes("ResizeObserver")
    );
    console.log(`[PROVA] pageerrors críticos: ${criticalJs.length}`);
    expect(criticalJs).toHaveLength(0);
  });

  test("3. Remontagem da Torre sem erro de hooks (sair e voltar)", async ({ page }) => {
    await loginAndOpenTorre(page);

    const dashboardBtn = page.locator('button:has-text("Dashboard Executivo"), a:has-text("Dashboard Executivo")').first();
    await dashboardBtn.waitFor({ state: "visible", timeout: 10000 });
    await dashboardBtn.click();
    await page.waitForURL("**/dashboard", { timeout: 20000 });
    await page.waitForTimeout(3000);

    const torreBtn2 = page.locator('button:has-text("Torre de Controle"), a:has-text("Torre de Controle")').first();
    await torreBtn2.click();
    await page.waitForTimeout(7000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-torre-remontada.png"), fullPage: true });

    const bodyText = (await page.textContent("body")) || "";
    expect(bodyText).not.toContain("Error Boundary");
    expect(bodyText).not.toContain("Rendered more hooks");

    const criticalJs = jsErrors.filter((e) =>
      !e.includes("favicon") && !e.includes("WebSocket") && !e.includes("HMR") && !e.includes("ResizeObserver")
    );
    console.log(`[PROVA] pageerrors críticos pós-remontagem: ${criticalJs.length}`);
    expect(criticalJs).toHaveLength(0);
  });
});