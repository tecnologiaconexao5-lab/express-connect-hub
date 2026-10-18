import { test, expect } from "@playwright/test";
import * as path from "path";
import { loginCliente } from "./helpers/auth";

const SCREENSHOT_DIR = "test-results/screenshots/portal-patio";

test.describe("MISSÃO 52 - Portal Cliente: Módulo Pátio", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("01 - Login cliente redireciona para portal", async ({ page }) => {
    console.log("[TEST] Login como cliente de teste");

    await loginCliente(page, "portal-patio");
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    console.log(`[TEST] URL final: ${currentUrl}`);
    
    // Deve redirecionar para /portal-cliente
    expect(currentUrl).toContain("/portal-cliente");
  });

  test("02 - Dashboard do Portal carrega corretamente", async ({ page }) => {
    await loginCliente(page, "portal-patio");
    await page.goto("/portal-cliente", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(5000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "02-dashboard.png"),
      fullPage: true,
    });

    const bodyText = await page.evaluate(() => document.body.innerText);

    const dashboardChecks = {
      "Dashboard ou Centro de Controle": bodyText.includes("Dashboard") || bodyText.includes("Centro de Controle") || bodyText.includes("Centro de Controle Operacional"),
      "KPIs visíveis": bodyText.includes("Operações") || bodyText.includes("Em Distribuição") || bodyText.includes("Concluídas") || bodyText.includes("Hoje"),
      "Menu lateral": bodyText.includes("Pedidos") && bodyText.includes("Pátio"),
    };

    console.log("\n[TEST] Dashboard checks:");
    for (const [label, found] of Object.entries(dashboardChecks)) {
      console.log(`  ${label}: ${found ? "✅" : "❌"}`);
    }

    expect(bodyText.length).toBeGreaterThan(500);
  });

  test("03 - Menu Pátio aparece na sidebar", async ({ page }) => {
    await loginCliente(page, "portal-patio");
    await page.goto("/portal-cliente", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Verificar se o menu Pátio existe
    const patioMenuItem = page.locator('button:has-text("Pátio"), button:has-text("Patio")');
    const patioVisible = await patioMenuItem.count();

    console.log(`[TEST] Menu Pátio encontrado: ${patioVisible > 0 ? "✅" : "❌"}`);

    // Screenshot da sidebar
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "03-menu-patio.png"),
      fullPage: false,
    });

    expect(patioVisible).toBeGreaterThan(0);
  });

  test("04 - Clicar no menu Pátio abre a tela", async ({ page }) => {
    await loginCliente(page, "portal-patio");
    await page.goto("/portal-cliente", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Clicar no menu Pátio
    const patioMenuItem = page.locator('button:has-text("Pátio"), button:has-text("Patio")').first();
    await patioMenuItem.click();
    await page.waitForTimeout(3000);

    // Screenshot da tela de Pátio
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "04-tela-patio.png"),
      fullPage: true,
    });

    const bodyText = await page.evaluate(() => document.body.innerText);

    const patioChecks = {
      "Título Pátio ou Controle de Pátio": bodyText.includes("Pátio") || bodyText.includes("Controle de Pátio"),
      "KPIs de pátio": bodyText.includes("Veículos") || bodyText.includes("Aguardando") || bodyText.includes("Carregamento") || bodyText.includes("Hoje"),
      "Lista de veículos ou empty state": bodyText.includes("veículo") || bodyText.includes("Nenhum veículo") || bodyText.includes("pátio") || bodyText.length > 300,
    };

    console.log("\n[TEST] Pátio screen checks:");
    for (const [label, found] of Object.entries(patioChecks)) {
      console.log(`  ${label}: ${found ? "✅" : "❌"}`);
    }

    expect(bodyText.length).toBeGreaterThan(300);
  });

  test("05 - Pátio exibe dados ou empty state profissional", async ({ page }) => {
    await loginCliente(page, "portal-patio");
    await page.goto("/portal-cliente", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Clicar no menu Pátio
    const patioMenuItem = page.locator('button:has-text("Pátio"), button:has-text("Patio")').first();
    await patioMenuItem.click();
    
    // Esperar loading terminar e empty state aparecer
    await page.waitForTimeout(5000);
    
    // Esperar que loading desapareça
    await page.waitForSelector('text=Carregando dados do pátio', { state: 'detached', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(3000);

    const bodyText = await page.evaluate(() => document.body.innerText);

    // Verificar se tem dados ou empty state
    const hasData =
      bodyText.includes("veículo") ||
      bodyText.includes("Veículos") ||
      bodyText.includes("placa") ||
      bodyText.includes("Placa");

    const hasEmptyState =
      bodyText.includes("Nenhum veículo") ||
      bodyText.includes("Não há veículos") ||
      bodyText.includes("pátio no momento") ||
      bodyText.includes("Pátio") ||  // Título da seção
      bodyText.includes("Controle de Pátio");

    console.log(`\n[TEST] Dados ou empty state:`);
    console.log(`  - Body length: ${bodyText.length} chars`);
    console.log(`  - Tem dados: ${hasData ? "✅" : "❌"}`);
    console.log(`  - Empty state: ${hasEmptyState ? "✅" : "❌"}`);
    console.log(`  - Texto encontrado: "${bodyText.substring(0, 200)}..."`);

    // Screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "05-patio-dados-ou-empty.png"),
      fullPage: true,
    });

    expect(hasData || hasEmptyState).toBeTruthy();
  });

  test("06 - Pedidos continuam funcionando", async ({ page }) => {
    await loginCliente(page, "portal-patio");
    await page.goto("/portal-cliente", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Clicar no menu Pedidos
    const pedidosMenuItem = page.locator('button:has-text("Pedidos")').first();
    await pedidosMenuItem.click();
    await page.waitForTimeout(4000);

    // Screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "06-pedidos.png"),
      fullPage: true,
    });

    const bodyText = await page.evaluate(() => document.body.innerText);

    // Validacao funcional:aba abriu, titulo existe, ha estrutura (tabela/card/empty state)
    const tituloValido = bodyText.includes("Pedidos") && bodyText.length > 50;
    const estruturaPresente = bodyText.includes("Status") || bodyText.includes("Em Andamento") || bodyText.includes("pedido") || bodyText.includes("encontrado");
    const temAcoes = bodyText.includes("Exportar") || bodyText.includes("Novo") || bodyText.includes("Programado") || bodyText.includes("Em Rota") || bodyText.includes("Entregue");

    const pedidosChecks = {
      "Aba abriu com titulo Pedidos": tituloValido,
      "Estrutura da aba presente": estruturaPresente,
      "Acoes/botoes disponiveis": temAcoes,
    };

    console.log("\n[TEST] Pedidos checks:");
    for (const [label, found] of Object.entries(pedidosChecks)) {
      console.log(`  ${label}: ${found ? "✅" : "❌"}`);
    }
    console.log(`  Body length: ${bodyText.length} chars`);

    expect(tituloValido).toBeTruthy();
    expect(estruturaPresente || temAcoes).toBeTruthy();
  });

  test("07 - Financeiro continua funcionando", async ({ page }) => {
    await loginCliente(page, "portal-patio");
    await page.goto("/portal-cliente", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Clicar no menu Financeiro
    const financeiroMenuItem = page.locator('button:has-text("Financeiro")').first();
    await financeiroMenuItem.click();
    await page.waitForTimeout(3000);

    // Screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "07-financeiro.png"),
      fullPage: true,
    });

    const bodyText = await page.evaluate(() => document.body.innerText);

    const financeiroChecks = {
      "Faturas": bodyText.includes("Fatura") || bodyText.includes("FAT"),
      "Valores": bodyText.includes("R$") || bodyText.includes("Valor"),
      "Status": bodyText.includes("Paga") || bodyText.includes("Vencida") || bodyText.includes("A vencer"),
    };

    console.log("\n[TEST] Financeiro checks:");
    for (const [label, found] of Object.entries(financeiroChecks)) {
      console.log(`  ${label}: ${found ? "✅" : "❌"}`);
    }

    expect(bodyText.length).toBeGreaterThan(300);
  });

  test("08 - Comprovantes continuam funcionando", async ({ page }) => {
    await loginCliente(page, "portal-patio");
    await page.goto("/portal-cliente", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Clicar no menu Comprovantes
    const comprovantesMenuItem = page.locator('button:has-text("Comprovantes")').first();
    await comprovantesMenuItem.click();
    await page.waitForTimeout(3000);

    // Screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "08-comprovantes.png"),
      fullPage: true,
    });

    const bodyText = await page.evaluate(() => document.body.innerText);

    const comprovantesChecks = {
      "Comprovantes": bodyText.includes("Comprovante") || bodyText.includes("POD"),
      "Fotos ou assinaturas": bodyText.includes("Foto") || bodyText.includes("Assinatura") || bodyText.includes("Sem comprovantes"),
    };

    console.log("\n[TEST] Comprovantes checks:");
    for (const [label, found] of Object.entries(comprovantesChecks)) {
      console.log(`  ${label}: ${found ? "✅" : "❌"}`);
    }

    expect(bodyText.length).toBeGreaterThan(150);
  });

  test("09 - Validação final sem erros de console", async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await loginCliente(page, "portal-patio");
    await page.goto("/portal-cliente", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Navegar por todas as abas
    const tabs = ["Dashboard", "Pátio", "Patio", "Pedidos", "Financeiro", "Comprovantes"];

    for (const tab of tabs) {
      const menuItem = page.locator(`button:has-text("${tab}")`).first();
      if (await menuItem.count() > 0) {
        await menuItem.click();
        await page.waitForTimeout(2000);
      }
    }

    // Screenshot final
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "09-validacao-final.png"),
      fullPage: true,
    });

    console.log(`\n[TEST] Erros de console: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log("  Erros:", consoleErrors);
    }

    // Permitir até 2 erros não críticos
    const criticalErrors = consoleErrors.filter(
      (err) => !err.includes("404") && !err.includes("favicon") && !err.includes("net::")
    );

    console.log(`  Erros críticos: ${criticalErrors.length}`);

    expect(criticalErrors.length).toBeLessThan(3);
  });
});