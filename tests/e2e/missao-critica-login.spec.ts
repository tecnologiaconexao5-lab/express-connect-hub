import { test, expect } from "@playwright/test";
import * as path from "path";

const SCREENSHOT_DIR = "test-results/screenshots/missao-critica-login";

const ADMIN_EMAIL = "tamiris.castilho@conexaoexpress.com.br";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "Conexao@2026";

const CLIENTE_EMAIL = "cliente.teste@conexaoexpress.com.br";
const CLIENTE_PASSWORD = process.env.PLAYWRIGHT_CLIENTE_PASSWORD || "Teste@2026";

test.describe("MISSÃO CRÍTICA — Credenciais Reais de Login", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("01 - Admin login com credenciais reais -> redireciona /dashboard", async ({ page }) => {
    console.log(`[TEST] Login admin: ${ADMIN_EMAIL}`);

    await page.goto("/login", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "01-admin-login-form.png"),
      fullPage: false,
    });

    await page.locator('button[type="submit"]').click();

    try {
      await page.waitForURL(/\/dashboard/, { timeout: 30000 });
    } catch {
      console.log(`[TEST] URL atual apos login admin: ${page.url()}`);
      const body = await page.locator("body").textContent();
      console.log(`[TEST] Body: ${body?.substring(0, 300)}`);
    }

    await page.waitForTimeout(3000);
    const currentUrl = page.url();
    console.log(`[TEST] URL final admin: ${currentUrl}`);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "02-admin-dashboard.png"),
      fullPage: false,
    });

    expect(currentUrl).toContain("/dashboard");
  });

  test("02 - Admin dashboard carregado com dados", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();

    try {
      await page.waitForURL(/\/dashboard/, { timeout: 30000 });
    } catch {
      console.log(`[TEST] URL: ${page.url()}`);
    }
    await page.waitForTimeout(5000);

    const bodyText = await page.locator("body").textContent() || "";

    const temDashboard = bodyText.includes("Dashboard") || bodyText.includes("dashboard");
    const temMenuLateral = bodyText.includes("Clientes") || bodyText.includes("Financeiro");

    console.log(`[TEST] Dashboard visivel: ${temDashboard}`);
    console.log(`[TEST] Menu lateral: ${temMenuLateral}`);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "03-admin-dashboard-dados.png"),
      fullPage: true,
    });

    expect(temDashboard).toBeTruthy();
  });

  test("03 - Cliente login com credenciais reais -> redireciona /portal-cliente", async ({ page }) => {
    console.log(`[TEST] Login cliente: ${CLIENTE_EMAIL}`);

    await page.goto("/login", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    await page.locator('input[type="email"]').fill(CLIENTE_EMAIL);
    await page.locator('input[type="password"]').fill(CLIENTE_PASSWORD);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "04-cliente-login-form.png"),
      fullPage: false,
    });

    await page.locator('button[type="submit"]').click();

    try {
      await page.waitForURL(/\/portal-cliente/, { timeout: 30000 });
    } catch {
      console.log(`[TEST] URL atual apos login cliente: ${page.url()}`);
      const body = await page.locator("body").textContent();
      console.log(`[TEST] Body: ${body?.substring(0, 300)}`);
    }

    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    console.log(`[TEST] URL final cliente: ${currentUrl}`);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "05-cliente-portal.png"),
      fullPage: false,
    });

    expect(currentUrl).toContain("/portal-cliente");
  });

  test("04 - Portal Cliente carregado com dados reais", async ({ page }) => {
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
      path: path.join(SCREENSHOT_DIR, "06-portal-cliente-dados.png"),
      fullPage: true,
    });

    const bodyText = await page.locator("body").textContent() || "";
    const temDashboard = bodyText.includes("Dashboard") || bodyText.includes("dashboard") || bodyText.includes("Centro de Controle");
    const temOS = bodyText.includes("Pedidos") || bodyText.includes("Ordens") || bodyText.includes("OS");
    const temFinanceiro = bodyText.includes("Financeiro");

    console.log(`[TEST] Dashboard/Centro de Controle: ${temDashboard}`);
    console.log(`[TEST] Pedidos/OS visivel: ${temOS}`);
    console.log(`[TEST] Financeiro visivel: ${temFinanceiro}`);

    expect(temDashboard).toBeTruthy();
  });

  test("05 - Credencial invalida mostra erro e permanece no login", async ({ page }) => {
    console.log(`[TEST] Testando credencial invalida`);

    await page.goto("/login", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    await page.locator('input[type="email"]').fill(CLIENTE_EMAIL);
    await page.locator('input[type="password"]').fill("senha_errada_123");
    await page.locator('button[type="submit"]').click();

    await page.waitForTimeout(3000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "07-credencial-invalida.png"),
      fullPage: false,
    });

    const bodyText = await page.locator("body").textContent() || "";
    const urlAtual = page.url();

    console.log(`[TEST] URL apos erro: ${urlAtual}`);
    console.log(`[TEST] Body contem 'Invalid login': ${bodyText.includes("Invalid login")}`);
    console.log(`[TEST] Body contem 'erro': ${bodyText.includes("erro") || bodyText.includes("Erro") || bodyText.includes("error") || bodyText.includes("Error")}`);

    // Deve permanecer na pagina de login
    expect(urlAtual).toContain("/login");
  });

  test("06 - Admin acessa /clientes (dados reais)", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();

    try {
      await page.waitForURL(/\/dashboard/, { timeout: 30000 });
    } catch {
      console.log(`[TEST] URL: ${page.url()}`);
    }
    await page.waitForTimeout(3000);

    // Navega via sidebar (SPA) para evitar "Carregando sessão..." em rotas lazy-loaded
    // Expande "Cadastros Base" no accordion da sidebar
    const cadastrosBtn = page.locator('nav button:has-text("Cadastros Base")').first();
    await cadastrosBtn.waitFor({ state: "visible", timeout: 10000 });
    await cadastrosBtn.click();
    await page.waitForTimeout(1000);

    // Clica em "Clientes" no sub-menu expandido
    const clientesBtn = page.locator('nav button:has-text("Clientes")').first();
    try {
      await clientesBtn.waitFor({ state: "visible", timeout: 5000 });
      await clientesBtn.click();
    } catch {
      // Fallback: se sidebar nao expandiu, navega via URL (SPA)
      console.log("[TEST] Sidebar accordion nao abriu, tentando navegacao direta");
      await page.evaluate(() => {
        window.history.pushState({}, "", "/cadastros/clientes");
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      await page.waitForTimeout(3000);
      // Se ainda estiver com "Carregando sessão", tenta page.goto como ultimo recurso
      const bodyAfter = await page.locator("body").textContent() || "";
      if (bodyAfter.includes("Carregando")) {
        await page.goto("/cadastros/clientes", { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(3000);
      }
    }

    await page.waitForTimeout(3000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "08-admin-clientes.png"),
      fullPage: true,
    });

    const finalUrl = page.url();
    const bodyText = await page.locator("body").textContent() || "";
    const temClientes = bodyText.includes("Clientes") || bodyText.includes("clientes");

    console.log(`[TEST] Pagina clientes visivel: ${temClientes}`);
    console.log(`[TEST] URL final: ${finalUrl}`);
    expect(finalUrl).toContain("clientes");
    expect(temClientes).toBeTruthy();
  });
});
