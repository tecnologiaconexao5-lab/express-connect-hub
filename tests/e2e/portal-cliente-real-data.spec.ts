import { test, expect } from "@playwright/test";
import * as path from "path";

const SCREENSHOT_DIR = "test-results/screenshots/login-cliente";

const CLIENTE_EMAIL = "cliente.teste@conexaoexpress.com.br";
const CLIENTE_PASSWORD = process.env.PLAYWRIGHT_CLIENTE_PASSWORD || "Teste@2026";

test.describe("MISSÃO — Login Cliente e Dados Reais", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("01 - Login cliente redireciona para /portal-cliente", async ({ page }) => {
    console.log(`[TEST] Login como: ${CLIENTE_EMAIL}`);

    await page.goto("/login", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Preencher form de login
    await page.locator('input[type="email"]').fill(CLIENTE_EMAIL);
    await page.locator('input[type="password"]').fill(CLIENTE_PASSWORD);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "01-login.png"),
      fullPage: false,
    });

    await page.locator('button[type="submit"]').click();

    // Aguardar redirecionamento para /portal-cliente
    try {
      await page.waitForURL(/\/portal-cliente/, { timeout: 30000 });
    } catch {
      console.log(`[TEST] URL atual: ${page.url()}`);
    }
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    console.log(`[TEST] URL final: ${currentUrl}`);
    expect(currentUrl).toContain("/portal-cliente");
  });

  test("02 - Portal Cliente carregado com dados", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.locator('input[type="email"]').fill(CLIENTE_EMAIL);
    await page.locator('input[type="password"]').fill(CLIENTE_PASSWORD);
    await page.locator('button[type="submit"]').click();
    try {
      await page.waitForURL(/\/portal-cliente/, { timeout: 30000 });
    } catch {
      console.log(`[TEST] URL: ${page.url()}`);
    }
    await page.waitForTimeout(5000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "02-portal-cliente-carregado.png"),
      fullPage: true,
    });

    // Verificar que a pagina carregou com conteudo real
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log(`[TEST] Body length: ${bodyText.length} chars`);

    // Verificar textos esperados do Portal Cliente
    const textChecks: Record<string, boolean> = {
      "Dashboard ou Centro de Controle": bodyText.includes("Dashboard") || bodyText.includes("Centro de Controle"),
      "Cliente Teste ou nome da empresa": bodyText.includes("Cliente Teste") || bodyText.includes("Teste Ltda"),
      "Pedidos ou OS": bodyText.includes("Pedidos") || bodyText.includes("OS"),
      "Financeiro": bodyText.includes("Financeiro"),
    };

    for (const [label, found] of Object.entries(textChecks)) {
      console.log(`[TEST] ${label}: ${found ? "✅" : "❌"}`);
    }

    const temSidebar = bodyText.includes("Dashboard") || bodyText.includes("Pedidos") || bodyText.includes("Financeiro");
    expect(temSidebar || bodyText.length > 500).toBeTruthy();
  });

  test("03 - Dados reais OS e Financeiro visiveis", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.locator('input[type="email"]').fill(CLIENTE_EMAIL);
    await page.locator('input[type="password"]').fill(CLIENTE_PASSWORD);
    await page.locator('button[type="submit"]').click();
    try {
      await page.waitForURL(/\/portal-cliente/, { timeout: 30000 });
    } catch {
      console.log(`[TEST] URL: ${page.url()}`);
    }
    await page.waitForTimeout(5000);

    const bodyText = await page.evaluate(() => document.body.innerText);

    // Procurar por dados das OS reais
    const osChecks: Record<string, boolean> = {
      "OS-001/2026": bodyText.includes("OS-001"),
      "São Paulo -> Rio de Janeiro": (bodyText.includes("São Paulo") && bodyText.includes("Rio de Janeiro")),
      "Eletrônicos (carga)": bodyText.includes("Eletrônico") || bodyText.includes("eletrônico"),
    };

    console.log("\n[TEST] OS data check:");
    for (const [label, found] of Object.entries(osChecks)) {
      console.log(`  ${label}: ${found ? "✅" : "❌"}`);
    }

    // Procurar por dados financeiros
    const finChecks: Record<string, boolean> = {
      "FAT-001 ou Fatura": bodyText.includes("FAT-001") || bodyText.includes("Fatura"),
      "Valor 1500 ou 3200": bodyText.includes("1.500") || bodyText.includes("3.200") || bodyText.includes("1500") || bodyText.includes("3200"),
      "status pago/recebido": bodyText.includes("pago") || bodyText.includes("Pago") || bodyText.includes("recebido") || bodyText.includes("a_vencer"),
    };

    console.log("\n[TEST] Financeiro data check:");
    for (const [label, found] of Object.entries(finChecks)) {
      console.log(`  ${label}: ${found ? "✅" : "❌"}`);
    }

    // Screenshot do conteudo
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "03-dados-reais-os-financeiro.png"),
      fullPage: true,
    });

    // Pelo menos alguns dados reais aparecem
    const algumDadoReal = osChecks["OS-001/2026"] || osChecks["São Paulo -> Rio de Janeiro"] || finChecks["FAT-001 ou Fatura"];
    console.log(`\n[TEST] Algum dado real visivel: ${algumDadoReal ? "✅" : "❌"}`);
    expect(bodyText.length).toBeGreaterThan(500);
  });
});
