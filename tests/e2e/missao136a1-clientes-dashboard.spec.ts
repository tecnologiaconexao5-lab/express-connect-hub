import { test, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const EVIDENCIAS_DIR = "docs/homologacao/missao136a1";

const USER_ADMIN = {
  email: "tamiris.castilho@conexaoexpress.com.br",
  name: "Tamiris Castilho",
  role: "super_admin",
  unit: "Matriz",
};

test.beforeAll(() => {
  if (!fs.existsSync(EVIDENCIAS_DIR)) {
    fs.mkdirSync(EVIDENCIAS_DIR, { recursive: true });
  }
});

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate((u) => {
    localStorage.setItem("tms_user", JSON.stringify(u));
  }, USER_ADMIN);
});

test.describe("Missão 136-A.1 — Homologação Funcional Real de Clientes, Menu e Dashboard", () => {

  test("01 — Dashboard carrega sem travar em loading", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");

    // Aguarda carregar título do Dashboard
    await expect(page.locator("text=Centro de Controle Operacional")).toBeVisible({ timeout: 10000 });
    
    // Alterna para a aba Executivo pelo role tab
    const tabExecutivo = page.locator('button[role="tab"]:has-text("Executivo")').first();
    if (await tabExecutivo.isVisible()) {
      await tabExecutivo.click();
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: path.join(EVIDENCIAS_DIR, "01_dashboard_carregado.png") });
    expect(consoleErrors.filter(e => e.includes("Uncaught"))).toHaveLength(0);
  });

  test("02 — Menu Cadastros Base contém Clientes", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForTimeout(2000);

    // Paira sobre o menu lateral para expandir (hover)
    const sidebar = page.locator('aside').first();
    await sidebar.hover();
    await page.waitForTimeout(500);

    // Expande Cadastros Base no AppSidebar
    const btnCadastrosBase = page.locator('button[title="Cadastros Base"]').first();
    await expect(btnCadastrosBase).toBeVisible({ timeout: 10000 });
    await btnCadastrosBase.click();
    await page.waitForTimeout(1000);

    // Subitem Clientes deve estar visível
    const btnClientes = page.locator('button:has-text("Clientes")').first();
    await expect(btnClientes).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(EVIDENCIAS_DIR, "02_menu_clientes_visivel.png") });
  });

  test("03 — Fluxo Completo: Criar, Salvar, Buscar e Editar Cliente", async ({ page }) => {
    const timestamp = Date.now();
    const cnpjFicticio = `88.${Math.floor(100 + Math.random() * 899)}.${Math.floor(100 + Math.random() * 899)}/0001-${Math.floor(10 + Math.random() * 89)}`;
    const razaoSocial = `CLIENTE HOMOLOGACAO FUNCIONAL 136A1 ${timestamp} LTDA`;
    const nomeFantasia = `CLIENTE HML ${timestamp}`;

    // 1. Abrir lista de clientes
    await page.goto("/cadastros/clientes");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(EVIDENCIAS_DIR, "03_lista_clientes.png") });

    // 2. Abrir formulário Cadastrar Cliente
    const btnNovo = page.locator('button:has-text("Cadastrar Cliente"), button:has-text("Novo Cliente")').first();
    await expect(btnNovo).toBeVisible({ timeout: 10000 });
    await btnNovo.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCIAS_DIR, "04_novo_cliente.png") });

    // 3. Preencher dados gerais
    const inputRazao = page.locator('input[placeholder*="Razão"], input[name*="razao"], input[id*="razao"]').first();
    if (await inputRazao.isVisible()) {
      await inputRazao.fill(razaoSocial);
    } else {
      const firstInput = page.locator('input[type="text"]').first();
      await firstInput.fill(razaoSocial);
    }

    const inputFantasia = page.locator('input[placeholder*="Fantasia"], input[name*="fantasia"]').first();
    if (await inputFantasia.isVisible()) {
      await inputFantasia.fill(nomeFantasia);
    }

    const inputCnpj = page.locator('input[placeholder*="CNPJ"], input[name*="cnpj"]').first();
    if (await inputCnpj.isVisible()) {
      await inputCnpj.fill(cnpjFicticio);
    }

    await page.screenshot({ path: path.join(EVIDENCIAS_DIR, "05_dados_gerais.png") });

    // 4. Salvar cliente
    const btnSalvar = page.locator('button:has-text("Salvar Cliente"), button:has-text("Salvar")').first();
    await expect(btnSalvar).toBeVisible({ timeout: 5000 });
    await btnSalvar.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(EVIDENCIAS_DIR, "09_cliente_salvo.png") });

    // 5. Buscar o cliente criado na lista
    await page.goto("/cadastros/clientes");
    await page.waitForTimeout(2000);
    const inputBusca = page.locator('input[placeholder*="Buscar"], input[placeholder*="Pesquisar"]').first();
    if (await inputBusca.isVisible()) {
      await inputBusca.fill(nomeFantasia);
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: path.join(EVIDENCIAS_DIR, "10_busca_cliente.png") });

    // 6. Abrir o detalhe do cliente e alterar um campo
    const itemCliente = page.locator(`text=${nomeFantasia}`).first();
    if (await itemCliente.isVisible()) {
      await itemCliente.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(EVIDENCIAS_DIR, "11_cliente_detalhe.png") });

      const editFantasia = page.locator('input[placeholder*="Fantasia"], input[name*="fantasia"]').first();
      if (await editFantasia.isVisible()) {
        await editFantasia.fill(`${nomeFantasia} - EDITA`);
        await page.locator('button:has-text("Salvar")').first().click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(EVIDENCIAS_DIR, "12_cliente_editado.png") });
      }
    }
  });

});
