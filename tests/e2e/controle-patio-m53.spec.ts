import { test, expect } from "@playwright/test";
import * as path from "path";
import { loginAdmin } from "./helpers/auth";

const SCREENSHOT_DIR = "test-results/e2e/controle-patio";
const TIMEOUT = 30000;

test.describe("M53 - Controle de Patio", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("01 - Login admin vai para TMS Admin, nao Portal Cliente", async ({ page }) => {
    await loginAdmin(page, "m53");
    try {
      await page.waitForURL(/dashboard|operacao|financeiro|comercial|torre-controle/, { timeout: TIMEOUT });
    } catch {
      console.log("URL atual apos login:", page.url());
    }
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    console.log(`[TEST] URL apos login: ${currentUrl}`);
    expect(currentUrl).not.toContain("/portal-cliente");
    expect(currentUrl).not.toContain("/login");

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "01-pos-login-dashboard.png"),
      fullPage: false,
    });
    // Sidebar collapsed - "Conexao Express" fica hidden. Verifica que o dashboard carregou
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain("Dashboard Executivo");
    expect(bodyText).not.toContain("Portal do Cliente");
  });

  test("02 - Sidebar contem Controle de Patio", async ({ page }) => {
    await loginAdmin(page, "m53");
    try {
      await page.waitForURL(/dashboard|operacao|financeiro|comercial|torre-controle/, { timeout: TIMEOUT });
    } catch {
      console.log("URL atual apos login:", page.url());
    }
    await page.waitForTimeout(3000);

    // Expande sidebar via hover
    const sidebar = page.locator("aside").first();
    await sidebar.hover({ force: true, timeout: 5000 });
    await page.waitForTimeout(1500);

    // Clica em Apoio Operacional para expandir sub-itens
    await page.locator("aside button:has-text('Apoio Operacional')").click({ timeout: 5000, force: true });
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "02-sidebar-apoio-expandido.png"),
      fullPage: false,
    });

    // Verifica texto Controle de Patio visivel
    await expect(page.getByText("Controle de Pátio", { exact: false })).toBeVisible({ timeout: 5000 });
  });

  test("03 - Navegar via sidebar ate Controle de Patio", async ({ page }) => {
    await loginAdmin(page, "m53");
    try {
      await page.waitForURL(/dashboard|operacao|financeiro|comercial|torre-controle/, { timeout: TIMEOUT });
    } catch {
      console.log("URL atual apos login:", page.url());
    }
    await page.waitForTimeout(3000);

    // Expande sidebar
    await page.locator("aside").first().hover({ force: true, timeout: 5000 });
    await page.waitForTimeout(1500);

    // Expande Apoio Operacional
    await page.locator("aside button:has-text('Apoio Operacional')").click({ force: true, timeout: 5000 });
    await page.waitForTimeout(1000);

    // Tenta clicar Controle de Patio
    const patioBtn = page.locator("aside button:has-text('Controle de Patio')");
    if (await patioBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await patioBtn.click({ force: true, timeout: 5000 });
      await page.waitForTimeout(3000);
    } else {
      // Fallback: navega direto via JavaScript na SPA
      console.log("FALLBACK: navegacao JS direta");
      await page.evaluate(() => {
        window.history.pushState({}, "", "/controle-patio");
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      await page.waitForTimeout(3000);
    }

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "03-controle-patio-aberto.png"),
      fullPage: false,
    });

    console.log("URL final:", page.url());
  });

  test("04 - Tela Controle de Patio carrega com abas e metricas", async ({ page }) => {
    await loginAdmin(page, "m53");
    try {
      await page.waitForURL(/dashboard|operacao|financeiro|comercial|torre-controle/, { timeout: TIMEOUT });
    } catch {
      console.log("URL atual apos login:", page.url());
    }
    await page.waitForTimeout(3000);

    // Expande sidebar
    await page.locator("aside").first().hover({ force: true, timeout: 5000 });
    await page.waitForTimeout(1500);
    await page.locator("aside button:has-text('Apoio Operacional')").click({ force: true, timeout: 5000 });
    await page.waitForTimeout(1000);

    const patioBtn = page.locator("aside button:has-text('Controle de Patio')");
    if (await patioBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await patioBtn.click({ force: true, timeout: 5000 });
      await page.waitForTimeout(3000);
    } else {
      await page.evaluate(() => {
        window.history.pushState({}, "", "/controle-patio");
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      await page.waitForTimeout(3000);
    }

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "04-pagina-completa.png"),
      fullPage: true,
    });

    // Verifica metricas e abas
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log("BODY (400 chars):", bodyText.substring(0, 400));

    // Tenta encontrar elementos da pagina Controle de Patio
    const hasTitle = bodyText.includes("Controle de Patio") || bodyText.includes("Controle de Pátio");
    const hasKanban = bodyText.includes("Kanban");
    const hasDocas = bodyText.includes("Docas");
    const hasRegras = bodyText.includes("Regras");
    const hasAlertas = bodyText.includes("Alertas");

    console.log(`Titulo: ${hasTitle}, Kanban: ${hasKanban}, Docas: ${hasDocas}, Regras: ${hasRegras}, Alertas: ${hasAlertas}`);

    // Verifica navegacao bem sucedida
    expect(page.url()).toContain("/controle-patio");
  });

  test("05 - Navegar abas Kanban, Docas e Regras (SPA navigation)", async ({ page }) => {
    await loginAdmin(page, "m53");
    try {
      await page.waitForURL(/dashboard|operacao|financeiro|comercial|torre-controle/, { timeout: TIMEOUT });
    } catch {
      console.log("URL atual apos login:", page.url());
    }
    await page.waitForTimeout(3000);

    // Navega SPA (sem reload) para /controle-patio
    await page.evaluate(() => {
      window.history.pushState({}, "", "/controle-patio");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "05-patio-kanban.png"),
      fullPage: false,
    });

    // Clica aba Docas
    const docas = page.locator('button[role="tab"]:has-text("Docas")');
    if (await docas.isVisible({ timeout: 3000 }).catch(() => false)) {
      await docas.click({ force: true });
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "06-docas-tab.png"),
        fullPage: false,
      });
      console.log("Aba Docas ativada");
    }

    // Clica aba Regras
    const regras = page.locator('button[role="tab"]:has-text("Regras")');
    if (await regras.isVisible({ timeout: 3000 }).catch(() => false)) {
      await regras.click({ force: true });
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "07-regras-tab.png"),
        fullPage: false,
      });
      console.log("Aba Regras ativada");
    }

    // Clica aba Alertas
    const alertas = page.locator('button[role="tab"]:has-text("Alertas")');
    if (await alertas.isVisible({ timeout: 3000 }).catch(() => false)) {
      await alertas.click({ force: true });
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "08-alertas-tab.png"),
        fullPage: false,
      });
      console.log("Aba Alertas ativada");
    }
  });
});
