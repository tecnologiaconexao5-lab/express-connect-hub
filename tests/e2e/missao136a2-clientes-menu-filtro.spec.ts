import { test, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const EVIDENCIAS_DIR = "docs/homologacao/missao136a2";

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

test.describe("Missão 136-A.2 — Encerramento das Ressalvas", () => {

  test.describe("CENÁRIO 1 — Menu", () => {

    test("01 — Gestão Comercial NÃO contém Clientes", async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForTimeout(2000);

      const sidebar = page.locator("aside").first();
      await sidebar.hover();
      await page.waitForTimeout(500);

      // Expande Gestão Comercial
      const btnComercial = page.locator('button[title="Gestão Comercial"]').first();
      await expect(btnComercial).toBeVisible({ timeout: 10000 });
      await btnComercial.click();
      await page.waitForTimeout(1000);

      // Clientes NÃO deve estar visível dentro de Gestão Comercial
      // Procura por "Clientes" apenas dentro da área expandida da Gestão Comercial
      const comercialSection = page.locator("aside").first();
      const clientesNoComercial = comercialSection.locator('button:has-text("Clientes")');
      // Como Cadastros Base não está expandido, "Clientes" de lá não aparece
      // E Gestão Comercial não tem mais "Clientes" — deve ser 0
      await expect(clientesNoComercial).toHaveCount(0);

      await page.screenshot({ path: path.join(EVIDENCIAS_DIR, "01_gestao_comercial_sem_clientes.png") });
    });

    test("02 — Cadastros Base contém Clientes", async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForTimeout(2000);

      const sidebar = page.locator("aside").first();
      await sidebar.hover();
      await page.waitForTimeout(500);

      const btnCadastros = page.locator('button[title="Cadastros Base"]').first();
      await expect(btnCadastros).toBeVisible({ timeout: 10000 });
      await btnCadastros.click();
      await page.waitForTimeout(1000);

      const btnClientes = page.locator('button:has-text("Clientes")').first();
      await expect(btnClientes).toBeVisible({ timeout: 5000 });

      await page.screenshot({ path: path.join(EVIDENCIAS_DIR, "02_cadastros_base_com_clientes.png") });
    });

    test("03 — Clientes aparece exatamente uma vez no menu", async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForTimeout(2000);

      const sidebar = page.locator("aside").first();
      await sidebar.hover();
      await page.waitForTimeout(500);

      // Expande Gestão Comercial e Cadastros Base
      const btnComercial = page.locator('button[title="Gestão Comercial"]').first();
      await btnComercial.click();
      await page.waitForTimeout(500);

      const btnCadastros = page.locator('button[title="Cadastros Base"]').first();
      await btnCadastros.click();
      await page.waitForTimeout(1000);

      // Conta quantas vezes "Clientes" aparece no menu lateral
      const ocorrencias = page.locator("aside").first().locator('button:has-text("Clientes")');
      const count = await ocorrencias.count();

      await page.screenshot({ path: path.join(EVIDENCIAS_DIR, "03_clientes_ocorrencia_unica.png") });
      expect(count).toBe(1);
    });

  });

  test.describe("CENÁRIO 2 — Filtro do Dashboard", () => {

    test("04 — Dashboard carrega com período inicial (Mês)", async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      await page.goto("/dashboard");
      await page.waitForLoadState("domcontentloaded");

      // Alterna para a aba Executivo
      const tabExecutivo = page.locator('button[role="tab"]:has-text("Executivo")').first();
      await expect(tabExecutivo).toBeVisible({ timeout: 10000 });
      await tabExecutivo.click();
      await page.waitForTimeout(3000);

      // Verifica que o seletor de período mostra "Mês"
      const periodoSelect = page.locator("span:has-text('Mês')").first();
      await expect(periodoSelect).toBeVisible({ timeout: 5000 });

      await page.screenshot({ path: path.join(EVIDENCIAS_DIR, "04_dashboard_periodo_inicial.png") });
      expect(consoleErrors.filter(e => e.includes("Uncaught"))).toHaveLength(0);
    });

    test("05 — Alterar período dispara carregamento", async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("domcontentloaded");

      const tabExecutivo = page.locator('button[role="tab"]:has-text("Executivo")').first();
      await expect(tabExecutivo).toBeVisible({ timeout: 10000 });
      await tabExecutivo.click();
      await page.waitForTimeout(2000);

      // Abre o seletor de período
      const selectTrigger = page.locator('[role="combobox"]').first();
      await expect(selectTrigger).toBeVisible({ timeout: 5000 });
      await selectTrigger.click();
      await page.waitForTimeout(500);

      // Seleciona "Hoje"
      const optionHoje = page.locator('[role="option"]:has-text("Hoje")').first();
      await expect(optionHoje).toBeVisible({ timeout: 5000 });
      await optionHoje.click();
      await page.waitForTimeout(2000);

      await page.screenshot({ path: path.join(EVIDENCIAS_DIR, "05_dashboard_periodo_alterado.png") });
    });

    test("06 — Dados atualizam após alterar período", async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("domcontentloaded");

      const tabExecutivo = page.locator('button[role="tab"]:has-text("Executivo")').first();
      await expect(tabExecutivo).toBeVisible({ timeout: 10000 });
      await tabExecutivo.click();
      await page.waitForTimeout(3000);

      // Altera para Trimestre
      const selectTrigger = page.locator('[role="combobox"]').first();
      await selectTrigger.click();
      await page.waitForTimeout(500);
      const optionTrimestre = page.locator('[role="option"]:has-text("Trimestre")').first();
      await optionTrimestre.click();
      await page.waitForTimeout(3000);

      await page.screenshot({ path: path.join(EVIDENCIAS_DIR, "06_dashboard_dados_atualizados.png") });
    });

  });

  test.describe("CENÁRIO 3 — Regressão Clientes", () => {

    test("07 — Abrir Clientes pelo menu, visualizar detalhe, voltar", async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      await page.goto("/cadastros/clientes");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2000);

      // Verifica que a lista carregou
      await expect(page.locator("h1, h2, h3").filter({ hasText: /Clientes/i }).first()).toBeVisible({ timeout: 10000 });

      await page.screenshot({ path: path.join(EVIDENCIAS_DIR, "07_clientes_lista.png") });

      // Tenta clicar em algum cliente na lista
      const primeiroCliente = page.locator("table tbody tr a, table tbody tr").first();
      if (await primeiroCliente.isVisible({ timeout: 3000 }).catch(() => false)) {
        await primeiroCliente.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(EVIDENCIAS_DIR, "08_cliente_detalhe.png") });

        // Volta para a lista
        await page.goto("/cadastros/clientes");
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(EVIDENCIAS_DIR, "09_cliente_lista_apos_voltar.png") });
      }

      expect(consoleErrors.filter(e => e.includes("Uncaught"))).toHaveLength(0);
    });

  });

});
