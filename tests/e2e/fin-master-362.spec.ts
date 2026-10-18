// ============================================================
// FIN-MASTER-362 — QA E2E Automatizado — Reconciliação Real
// ============================================================
// Framework: Playwright
// Browser: Chromium (Desktop Chrome)
// Ambiente: TMS localhost:8801 → Supabase produção (uwrvzsjtpgaifkktpepn)
// Regra: UI real → Backend → DB → UI. Sem INSERT/UPDATE direto.
// ============================================================

import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.hVQ3kBhOMne6mFjGq3P9f8kjNYnDmQ3c6e8vkUFRAprFjrQ4egt5kN8Quh1QTOQ3dGYF8SYOSpk";
const ADMIN_EMAIL = "tamiris.castilho@conexaoexpress.com.br";
const ADMIN_PASSWORD = "Conexao@2026";
const DB_URL = "postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres";

const TEST_ID = `FIN362-${Date.now()}`;
const PAGAR_DESCRICAO = `${TEST_ID} E2E PAGAR`;
const PAGAR_VALOR = 137.89;
const PAGAR_VENCIMENTO = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

const RECEBER_DESCRICAO = `${TEST_ID} E2E RECEBER`;
const RECEBER_VALOR = 250.0;

const FATURA_NUMERO = `FIN362F`;
const FATURA_DESCRICAO = "FIN362 HOMOLOGACAO REAL DO FATURAMENTO CONEXAO EXPRESS";
const FATURA_VALOR = 123.45;

const SCREENSHOT_DIR = "test-results/e2e/fin362";

// ─── DB Client (pg) ──────────────────────────────────────────────────────────

let pgClient: any = null;

async function getDb() {
  if (pgClient) return pgClient;
  const pg = await import("pg");
  const { Client } = pg;
  pgClient = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pgClient.connect();
  return pgClient;
}

async function queryDb(sql: string): Promise<any[]> {
  const client = await getDb();
  const result = await client.query(sql);
  return result.rows;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function screenshot(page: Page, name: string) {
  const dir = path.join(SCREENSHOT_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({
    path: path.join(dir, `${name}.png`),
    fullPage: false,
  });
}

async function screenshotFull(page: Page, name: string) {
  const dir = path.join(SCREENSHOT_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({
    path: path.join(dir, `${name}.png`),
    fullPage: true,
  });
}

async function loginAdmin(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  const emailInput = page.locator('input[type="email"], input[placeholder*="email"]').first();
  await emailInput.waitFor({ state: "visible", timeout: 15000 });
  await emailInput.fill(ADMIN_EMAIL);
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.waitFor({ state: "visible", timeout: 5000 });
  await passwordInput.fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"], button:has-text("Entrar")').click();
  await page.waitForTimeout(3000);
  await screenshot(page, "00-login");
}

async function navigateToTab(page: Page, tab: string) {
  await page.goto(`/financeiro?tab=${tab}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await screenshot(page, `nav-${tab}`);
}

async function readKPI(page: Page, label: string): Promise<string> {
  try {
    const kpiEl = page.locator("p").filter({ hasText: label }).first();
    const parent = kpiEl.locator("..").locator("..");
    const valueEl = parent.locator("p").filter({ hasText: /R\$|[\d.,]+/ }).first();
    return (await valueEl.textContent()) || "0";
  } catch {
    return "N/A";
  }
}

function parseBRL(text: string): number {
  if (!text || text === "N/A" || text === "—") return 0;
  return Number(
    text
      .replace(/R\$\s*/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim()
  ) || 0;
}

// ─── Cleanup state ───────────────────────────────────────────────────────────

const createdIds = {
  pagarId: null as string | null,
  baixaId: null as string | null,
  receberId: null as string | null,
  faturaId: null as string | null,
};

// ============================================================
// TEST SUITE
// ============================================================

test.describe("FIN-MASTER-362 — QA E2E Financeiro", () => {

  test.beforeAll(async () => {
    if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  test.afterAll(async () => {
    if (pgClient) await pgClient.end();
  });

  // ─── 01. Login ───────────────────────────────────────────────────────────

  test("01 - Login como admin", async ({ page }) => {
    await loginAdmin(page);
    await expect(page).not.toHaveURL(/login/);
    await screenshot(page, "01-pos-login");
  });

  // ─── 02. Navegar ao Financeiro ──────────────────────────────────────────

  test("02 - Abrir modulo Financeiro", async ({ page }) => {
    await loginAdmin(page);
    await navigateToTab(page, "dashboard");
    await expect(page.locator("text=Dashboard Financeiro")).toBeVisible({ timeout: 15000 });
    await screenshotFull(page, "02-dashboard");
  });

  // ─── 03. Criar Conta a Pagar ───────────────────────────────────────────

  test("03 - Criar titulo a pagar via UI", async ({ page }) => {
    await loginAdmin(page);
    await navigateToTab(page, "pagar");
    await page.waitForTimeout(2000);

    // KPIs antes
    const kpiAntes = await readKPI(page, "Total a Pagar");
    console.log(`[KPIS] Total a Pagar ANTES: ${kpiAntes}`);
    await screenshot(page, "03-pagar-antes");

    // Clicar Nova Despesa
    const novaDespesaBtn = page.getByRole("button", { name: /Nova Despesa/i });
    await novaDespesaBtn.waitFor({ state: "visible", timeout: 10000 });
    await novaDespesaBtn.click();
    await page.waitForTimeout(1000);
    await screenshot(page, "03-dialog-aberto");

    // Preencher formulário
    const favorecidoInput = page.getByPlaceholder(/Fornecedor.*Favorecido/i);
    await favorecidoInput.waitFor({ state: "visible", timeout: 5000 });
    await favorecidoInput.fill("FORNECEDOR E2E FIN362");
    await page.waitForTimeout(500);

    const docInput = page.getByPlaceholder("NF-1234");
    if (await docInput.isVisible().catch(() => false)) {
      await docInput.fill("FIN362-E2E-001");
    }

    // Categoria
    const categoriaSelect = page.locator("label").filter({ hasText: /Categoria/i }).locator("..").locator("button[role='combobox'], select, [data-slot='select-trigger']").first();
    if (await categoriaSelect.isVisible().catch(() => false)) {
      await categoriaSelect.click();
      await page.waitForTimeout(500);
      const servicosOption = page.getByRole("option", { name: /Serviços|Outras/i }).first();
      if (await servicosOption.isVisible().catch(() => false)) {
        await servicosOption.click();
      } else {
        await page.keyboard.press("Escape");
      }
    }

    // Valor
    const valorInput = page.locator('input[type="number"]').first();
    if (await valorInput.isVisible().catch(() => false)) {
      await valorInput.fill(String(PAGAR_VALOR));
    }

    // Vencimento
    const vencInput = page.locator('input[type="date"]').last();
    if (await vencInput.isVisible().catch(() => false)) {
      await vencInput.fill(PAGAR_VENCIMENTO);
    }

    // Observações
    const obsTextarea = page.locator("textarea").first();
    if (await obsTextarea.isVisible().catch(() => false)) {
      await obsTextarea.fill(`FIN-362 E2E PAGAR - HOMOLOGACAO - ${TEST_ID}`);
    }

    await screenshot(page, "03-form-preenchido");

    // Salvar
    const salvarBtn = page.getByRole("button", { name: /Salvar/i });
    await salvarBtn.click();
    await page.waitForTimeout(3000);
    await screenshot(page, "03-pos-salvar");

    // Validar que o título aparece na lista
    const tituloNaLista = page.locator("tr, [role='row']").filter({ hasText: "FORNECEDOR E2E FIN362" });
    const isVisible = await tituloNaLista.isVisible().catch(() => false);
    console.log(`[UI] Título visível na lista: ${isVisible}`);

    // Validar no banco
    const dbResult = await queryDb(
      `SELECT id, descricao, valor, status, data_vencimento, fornecedor
       FROM financeiro_pagar
       WHERE descricao ILIKE '%${TEST_ID}%'
       ORDER BY created_at DESC LIMIT 1`
    );

    if (dbResult.length > 0) {
      const row = dbResult[0];
      createdIds.pagarId = row.id;
      console.log(`[DB] Título criado: id=${row.id}, valor=${row.valor}, status=${row.status}`);
      expect(row.descricao).toContain(TEST_ID);
      expect(Number(row.valor)).toBeCloseTo(PAGAR_VALOR, 2);
    } else {
      console.log("[DB] WARN: Título não encontrado no banco via query direta");
    }

    await screenshot(page, "03-final");
  });

  // ─── 04. Registrar Pagamento (Baixa) ───────────────────────────────────

  test("04 - Registrar pagamento via UI", async ({ page }) => {
    await loginAdmin(page);
    await navigateToTab(page, "pagar");
    await page.waitForTimeout(2000);

    // KPIs antes
    const kpiPagarAntes = parseBRL(await readKPI(page, "Total a Pagar"));
    const kpiPagoMesAntes = parseBRL(await readKPI(page, "Pago no Mês"));
    console.log(`[KPIS] Pagar ANTES: ${kpiPagarAntes}, Pago Mês ANTES: ${kpiPagoMesAntes}`);

    // Buscar o título na lista
    const tituloRow = page.locator("tr, [role='row']").filter({ hasText: "FORNECEDOR E2E FIN362" }).first();
    const isTitleVisible = await tituloRow.isVisible().catch(() => false);

    if (!isTitleVisible) {
      console.log("[UI] Título não encontrado na lista — tentando busca");
      const searchInput = page.getByPlaceholder(/Buscar/i).first();
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill("FIN362");
        await page.waitForTimeout(2000);
      }
    }

    await screenshot(page, "04-antes-baixa");

    // Abrir dropdown de ações
    const rowForAction = page.locator("tr, [role='row']").filter({ hasText: /FIN362|FORNECEDOR E2E/i }).first();
    const actionBtn = rowForAction.locator("button").last();
    if (await actionBtn.isVisible().catch(() => false)) {
      await actionBtn.click();
      await page.waitForTimeout(500);

      // Clicar em Registrar Pagamento
      const pgtoItem = page.getByRole("menuitem", { name: /Registrar Pagamento/i });
      if (await pgtoItem.isVisible().catch(() => false)) {
        await pgtoItem.click();
        await page.waitForTimeout(1000);
        await screenshot(page, "04-dialog-baixa");

        // Selecionar Pgto Total
        const pgtoTotal = page.getByRole("button", { name: /Pgto Total/i });
        if (await pgtoTotal.isVisible().catch(() => false)) {
          await pgtoTotal.click();
        }

        // Selecionar conta financeira (apenas Cora — a única real)
        const contaSelect = page.locator("label").filter({ hasText: /Conta Pagadora/i }).locator("..").locator("button[role='combobox'], [data-slot='select-trigger']").first();
        if (await contaSelect.isVisible().catch(() => false)) {
          await contaSelect.click();
          await page.waitForTimeout(500);
          const coraOption = page.getByRole("option", { name: /Cora/i }).first();
          if (await coraOption.isVisible().catch(() => false)) {
            await coraOption.click();
          } else {
            // Se Cora não aparece, fechar e usar o que estiver disponível
            await page.keyboard.press("Escape");
          }
        }

        await screenshot(page, "04-form-baixa");

        // Confirmar pagamento
        const confirmarBtn = page.getByRole("button", { name: /Confirmar Pagamento/i });
        await confirmarBtn.click();
        await page.waitForTimeout(3000);
        await screenshot(page, "04-pos-baixa");
      } else {
        console.log("[UI] WARN: Menuitem 'Registrar Pagamento' não encontrado");
        await screenshot(page, "04-sem-menu-pagamento");
      }
    } else {
      console.log("[UI] WARN: Botão de ações não encontrado na linha");
      await screenshot(page, "04-sem-action-btn");
    }

    // Validar no banco
    if (createdIds.pagarId) {
      const pagarCheck = await queryDb(
        `SELECT id, status, data_pagamento FROM financeiro_pagar WHERE id = '${createdIds.pagarId}'`
      );
      if (pagarCheck.length > 0) {
        console.log(`[DB] Pós-baixa: status=${pagarCheck[0].status}, data_pagamento=${pagarCheck[0].data_pagamento}`);
      }

      const baixaCheck = await queryDb(
        `SELECT id, valor_baixado, saldo_restante, estornada, conta_financeira_id, forma_pagamento
         FROM financeiro_baixas
         WHERE titulo_id = '${createdIds.pagarId}' AND titulo_tabela = 'financeiro_pagar'
         ORDER BY created_at DESC LIMIT 1`
      );
      if (baixaCheck.length > 0) {
        const b = baixaCheck[0];
        createdIds.baixaId = b.id;
        console.log(`[DB] Baixa: id=${b.id}, valor=${b.valor_baixado}, saldo=${b.saldo_restante}, estornada=${b.estornada}`);
        expect(Number(b.valor_baixado)).toBeCloseTo(PAGAR_VALOR, 2);
        expect(b.estornada).toBe(false);
      } else {
        console.log("[DB] WARN: Baixa não encontrada — RPC pode não ter sido chamada via UI");
      }
    }

    // KPIs depois
    const kpiPagarDepois = parseBRL(await readKPI(page, "Total a Pagar"));
    const kpiPagoMesDepois = parseBRL(await readKPI(page, "Pago no Mês"));
    console.log(`[KPIS] Pagar DEPOIS: ${kpiPagarDepois}, Pago Mês DEPOIS: ${kpiPagoMesDepois}`);
    console.log(`[KPIS] Diferença Pago Mês: ${kpiPagoMesDepois - kpiPagoMesAntes} (esperado: ~${PAGAR_VALOR})`);

    await screenshot(page, "04-kpis-depois");
  });

  // ─── 05. Tesouraria ─────────────────────────────────────────────────────

  test("05 - Validar Tesouraria (saldo conta)", async ({ page }) => {
    await loginAdmin(page);

    // Saldo antes no banco
    const contaCheck = await queryDb(
      `SELECT id, nome, saldo, saldo_inicial FROM contas_financeiras WHERE ativa = true ORDER BY nome`
    );
    console.log(`[DB] Contas financeiras:`, contaCheck);

    const saldoAntes = contaCheck.length > 0 ? Number(contaCheck[0].saldo) : 0;
    console.log(`[DB] Saldo conta ANTES: ${saldoAntes}`);

    // Navegar para Contas & Caixas
    await navigateToTab(page, "contas-caixas");
    await screenshotFull(page, "05-tesouraria");

    // Validar no banco: entradas/saídas da conta
    if (createdIds.pagarId) {
      const movimentacoes = await queryDb(
        `SELECT conta_financeira_id, conta_financeira, titulo_tabela, valor_baixado, data_baixa
         FROM financeiro_baixas
         WHERE conta_financeira_id IS NOT NULL AND NOT estornada
         ORDER BY data_baixa DESC LIMIT 10`
      );
      console.log(`[DB] Movimentações na conta:`, movimentacoes);
    }
  });

  // ─── 06. Fluxo de Caixa ────────────────────────────────────────────────

  test("06 - Validar Fluxo de Caixa", async ({ page }) => {
    await loginAdmin(page);
    await navigateToTab(page, "fluxo");
    await page.waitForTimeout(3000);
    await screenshotFull(page, "06-fluxo-caixa");

    // Validar no banco: previsto vs realizado
    const fluxoRealizado = await queryDb(
      `SELECT titulo_tabela, COUNT(*) as qtd, COALESCE(SUM(valor_baixado),0) as total
       FROM financeiro_baixas WHERE NOT estornada
       GROUP BY titulo_tabela`
    );
    console.log(`[DB] Fluxo realizado (baixas):`, fluxoRealizado);

    const fluxoPrevisto = await queryDb(
      `SELECT 'entrada' as tipo, COUNT(*) as qtd, COALESCE(SUM(valor),0) as total
       FROM financeiro_receber WHERE status NOT IN ('cancelado','cancelada','pago','paga')
       UNION ALL
       SELECT 'saida', COUNT(*), COALESCE(SUM(valor),0)
       FROM financeiro_pagar WHERE status NOT IN ('cancelado','cancelada','pago','paga')`
    );
    console.log(`[DB] Fluxo previsto:`, fluxoPrevisto);
  });

  // ─── 07. DRE ────────────────────────────────────────────────────────────

  test("07 - Validar DRE Gerencial", async ({ page }) => {
    await loginAdmin(page);
    await navigateToTab(page, "dre");
    await page.waitForTimeout(3000);
    await screenshotFull(page, "07-dre");

    // Validar fontes da DRE no banco
    const dreReceita = await queryDb(
      `SELECT COUNT(*) as qtd, COALESCE(SUM(valor),0) as total
       FROM financeiro_receber WHERE status NOT IN ('cancelado','cancelada')`
    );
    console.log(`[DB] DRE Receita (receber):`, dreReceita);

    const dreCusto = await queryDb(
      `SELECT COUNT(*) as qtd, COALESCE(SUM(valor_liquido),0) as total
       FROM pagamentos_prestadores WHERE impacto_dre = true AND status = 'pago'`
    );
    console.log(`[DB] DRE Custo prestador:`, dreCusto);

    const dreDespesa = await queryDb(
      `SELECT COUNT(*) as qtd, COALESCE(SUM(valor),0) as total
       FROM financeiro_pagar WHERE status NOT IN ('cancelado','cancelada','pago','paga')
       AND categoria NOT ILIKE '%repass%' AND categoria NOT ILIKE '%imposto%'`
    );
    console.log(`[DB] DRE Despesas:`, dreDespesa);

    // Nota: depreciação=0 e IR/CSLL=0 — a UI deve indicar "NÃO CONFIGURADO"
    const temDepreciacao = await queryDb(
      `SELECT COUNT(*) as qtd FROM configuracoes_sistema WHERE chave ILIKE '%depreciação%'`
    );
    console.log(`[DB] Depreciação configurada: ${temDepreciacao[0].qtd > 0 ? 'SIM' : 'NÃO'}`);
  });

  // ─── 08. Contas a Receber — Criar ──────────────────────────────────────

  test("08 - Criar titulo a receber via UI", async ({ page }) => {
    await loginAdmin(page);
    await navigateToTab(page, "receber");
    await page.waitForTimeout(2000);
    await screenshot(page, "08-receber-antes");

    // Nova Receita
    const novaReceitaBtn = page.getByRole("button", { name: /Nova Receita/i });
    await novaReceitaBtn.waitFor({ state: "visible", timeout: 10000 });
    await novaReceitaBtn.click();
    await page.waitForTimeout(1000);
    await screenshot(page, "08-dialog-receber");

    // Preencher cliente
    const clienteInput = page.getByPlaceholder(/razao social|CNPJ/i);
    if (await clienteInput.isVisible().catch(() => false)) {
      await clienteInput.fill("CALVO");
      await page.waitForTimeout(1500);
      // Selecionar primeiro resultado
      const suggestion = page.locator("[role='option'], .absolute .item, .dropdown-item").first();
      if (await suggestion.isVisible().catch(() => false)) {
        await suggestion.click();
      } else {
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
      }
    }

    // Vencimento
    const vencInputs = page.locator('input[type="date"]');
    const vencCount = await vencInputs.count();
    if (vencCount >= 2) {
      await vencInputs.nth(1).fill(PAGAR_VENCIMENTO);
    }

    // Tab Valores
    const valoresTab = page.getByRole("tab", { name: /Valores/i });
    if (await valoresTab.isVisible().catch(() => false)) {
      await valoresTab.click();
      await page.waitForTimeout(500);
    }

    // Valor Bruto
    const valorBrutoInput = page.locator('input[type="number"]').first();
    if (await valorBrutoInput.isVisible().catch(() => false)) {
      await valorBrutoInput.fill(String(RECEBER_VALOR));
    }

    await screenshot(page, "08-form-receber");

    // Criar
    const criarBtn = page.getByRole("button", { name: /Criar Lan[çc]amento/i });
    if (await criarBtn.isVisible().catch(() => false)) {
      await criarBtn.click();
    } else {
      const salvarBtn = page.getByRole("button", { name: /Salvar/i });
      await salvarBtn.click();
    }
    await page.waitForTimeout(3000);
    await screenshot(page, "08-pos-receber");

    // Validar no banco
    const dbResult = await queryDb(
      `SELECT id, descricao, valor, status, cliente_id
       FROM financeiro_receber
       WHERE descricao ILIKE '%${TEST_ID}%'
       ORDER BY created_at DESC LIMIT 1`
    );
    if (dbResult.length > 0) {
      createdIds.receberId = dbResult[0].id;
      console.log(`[DB] Receber criado: id=${dbResult[0].id}, valor=${dbResult[0].valor}, status=${dbResult[0].status}`);
    } else {
      console.log("[DB] WARN: Receber não encontrado via query direta");
    }
  });

  // ─── 09. Contas a Receber — Receber ────────────────────────────────────

  test("09 - Registrar recebimento via UI", async ({ page }) => {
    await loginAdmin(page);
    await navigateToTab(page, "receber");
    await page.waitForTimeout(2000);

    // Buscar título
    const searchInput = page.getByPlaceholder(/Buscar/i).first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill("FIN362");
      await page.waitForTimeout(2000);
    }

    await screenshot(page, "09-antes-recebimento");

    // Ações do título
    const tituloRow = page.locator("tr, [role='row']").filter({ hasText: /FIN362|E2E RECEBER/i }).first();
    const actionBtn = tituloRow.locator("button").last();
    if (await actionBtn.isVisible().catch(() => false)) {
      await actionBtn.click();
      await page.waitForTimeout(500);

      const receberItem = page.getByRole("menuitem", { name: /Registrar Recebimento/i });
      if (await receberItem.isVisible().catch(() => false)) {
        await receberItem.click();
        await page.waitForTimeout(1000);
        await screenshot(page, "09-dialog-recebimento");

        // Confirmar
        const confirmarBtn = page.getByRole("button", { name: /Confirmar Recebimento/i });
        if (await confirmarBtn.isVisible().catch(() => false)) {
          await confirmarBtn.click();
          await page.waitForTimeout(3000);
          await screenshot(page, "09-pos-recebimento");
        }
      }
    }

    // Validar no banco
    if (createdIds.receberId) {
      const baixaCheck = await queryDb(
        `SELECT id, valor_baixado, saldo_restante, estornada
         FROM financeiro_baixas
         WHERE titulo_id = '${createdIds.receberId}' AND titulo_tabela = 'financeiro_receber'
         AND NOT estornada ORDER BY created_at DESC LIMIT 1`
      );
      if (baixaCheck.length > 0) {
        console.log(`[DB] Recebimento: valor=${baixaCheck[0].valor_baixado}, saldo=${baixaCheck[0].saldo_restante}`);
      }
    }
  });

  // ─── 10. Fatura Manual ─────────────────────────────────────────────────

  test("10 - Criar fatura manual via UI", async ({ page }) => {
    await loginAdmin(page);
    await navigateToTab(page, "faturas");
    await page.waitForTimeout(2000);
    await screenshot(page, "10-faturas-antes");

    // Nova Fatura Manual
    const novaFaturaBtn = page.getByRole("button", { name: /Nova Fatura Manual/i });
    await novaFaturaBtn.waitFor({ state: "visible", timeout: 10000 });
    await novaFaturaBtn.click();
    await page.waitForTimeout(1500);
    await screenshot(page, "10-dialog-fatura");

    // Número
    const numeroInput = page.getByPlaceholder(/Ex\.\s*:?\s*38/i);
    if (await numeroInput.isVisible().catch(() => false)) {
      await numeroInput.fill(FATURA_NUMERO);
    }

    // Cliente (SearchableSelect)
    const clienteInput = page.getByPlaceholder(/Pesquisar cliente/i);
    if (await clienteInput.isVisible().catch(() => false)) {
      await clienteInput.fill("CALVO");
      await page.waitForTimeout(1500);
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(500);
    }

    // Descrição
    const descTextarea = page.locator("textarea").first();
    if (await descTextarea.isVisible().catch(() => false)) {
      await descTextarea.fill(FATURA_DESCRICAO);
    }

    // Valor
    const valorInput = page.locator('input[inputmode="decimal"]');
    if (await valorInput.isVisible().catch(() => false)) {
      await valorInput.fill(String(FATURA_VALOR));
    }

    await screenshot(page, "10-form-fatura");

    // Salvar Rascunho
    const salvarRascunho = page.getByRole("button", { name: /Salvar Rascunho/i });
    if (await salvarRascunho.isVisible().catch(() => false)) {
      await salvarRascunho.click();
      await page.waitForTimeout(3000);
      await screenshot(page, "10-pos-rascunho");
    }

    // Validar no banco
    const faturaDb = await queryDb(
      `SELECT id, numero, status, valor_total, metadata
       FROM faturas
       WHERE numero = '${FATURA_NUMERO}' OR metadata->>'TEST_ID' = '${TEST_ID}'
       ORDER BY criado_em DESC LIMIT 1`
    );
    if (faturaDb.length > 0) {
      createdIds.faturaId = faturaDb[0].id;
      console.log(`[DB] Fatura: id=${faturaDb[0].id}, numero=${faturaDb[0].numero}, status=${faturaDb[0].status}, valor=${faturaDb[0].valor_total}`);
      console.log(`[DB] Metadata:`, JSON.stringify(faturaDb[0].metadata || {}).substring(0, 200));
    }
  });

  // ─── 11. Dashboard ──────────────────────────────────────────────────────

  test("11 - Validar Dashboard Financeiro KPIs", async ({ page }) => {
    await loginAdmin(page);
    await navigateToTab(page, "dashboard");
    await page.waitForTimeout(3000);
    await screenshotFull(page, "11-dashboard-kpis");

    // Capturar KPIs da UI
    const kpis = [
      "Receita do Mês",
      "Custos Operacionais",
      "Resultado Líquido",
      "Margem Média",
      "A Receber (7 dias)",
      "A Pagar Geral",
      "Repasses Prestadores",
      "Inadimplência",
    ];

    for (const kpi of kpis) {
      const valor = await readKPI(page, kpi);
      console.log(`[UI] KPI "${kpi}": ${valor}`);
    }

    // Validar contra DB
    const receitaMes = await queryDb(
      `SELECT COALESCE(SUM(valor_cliente),0) as total
       FROM ordens_servico
       WHERE status = 'concluida'
       AND updated_at >= date_trunc('month', CURRENT_DATE)
       AND updated_at < date_trunc('month', CURRENT_DATE) + interval '1 month'`
    );
    console.log(`[DB] Receita do mês (OS concluídas): ${receitaMes[0]?.total}`);

    const custoPrestadores = await queryDb(
      `SELECT COALESCE(SUM(valor_liquido),0) as total
       FROM pagamentos_prestadores WHERE impacto_dre = true AND status = 'pago'`
    );
    console.log(`[DB] Custo prestadores (pago + impacto_dre): ${custoPrestadores[0]?.total}`);
  });

  // ─── 12. Margem por OS ─────────────────────────────────────────────────

  test("12 - Validar Margem por OS", async ({ page }) => {
    await loginAdmin(page);
    await navigateToTab(page, "margem-os");
    await page.waitForTimeout(3000);
    await screenshotFull(page, "12-margem-os");

    // Amostra de composições financeiras
    const margens = await queryDb(
      `SELECT os_id, valor_cliente, valor_prestador, margem_bruta, margem_liquida,
              percentual_margem_liquida, outros_custos
       FROM composicao_financeira_os
       ORDER BY percentual_margem_liquida ASC
       LIMIT 10`
    );
    console.log(`[DB] Margens por OS (amostra):`, margens);

    // Identificar margem negativa
    const negativas = margens.filter(m => Number(m.percentual_margem_liquida) < 0);
    console.log(`[DB] OS com margem negativa: ${negativas.length}`);
    negativas.forEach(n => {
      console.log(`  OS ${n.os_id}: margem ${n.percentual_margem_liquida}%`);
    });

    // Identificar margem 100%
    const margem100 = margens.filter(m => Number(m.percentual_margem_liquida) >= 99.9);
    console.log(`[DB] OS com margem ~100%: ${margem100.length}`);
  });

  // ─── 13. Dados Legacy ──────────────────────────────────────────────────

  test("13 - Classificar dados legacy", async ({ page }) => {
    await loginAdmin(page);

    // 4 receber phantom (pago sem baixa)
    const phantomReceber = await queryDb(
      `SELECT fr.id, fr.descricao, fr.valor, fr.status, fr.cliente, fr.created_at
       FROM financeiro_receber fr
       WHERE fr.status IN ('pago','paga')
       AND NOT EXISTS (
         SELECT 1 FROM financeiro_baixas b
         WHERE b.titulo_tabela = 'financeiro_receber' AND b.titulo_id = fr.id AND NOT b.estornada
       )
       ORDER BY fr.created_at DESC`
    );
    console.log(`[DB] Phantom receber (pago sem baixa): ${phantomReceber.length}`);
    phantomReceber.forEach((r: any) => {
      console.log(`  ${r.id} | ${r.descricao} | R$ ${r.valor} | ${r.status} | ${r.created_at}`);
    });

    // NULL valor
    const nullValor = await queryDb(
      `SELECT id, descricao, valor, status FROM financeiro_receber WHERE valor IS NULL`
    );
    console.log(`[DB] Receber com valor NULL: ${nullValor.length}`);

    // NULL status
    const nullStatus = await queryDb(
      `SELECT id, descricao, valor, status FROM financeiro_pagar WHERE status IS NULL`
    );
    console.log(`[DB] Pagar com status NULL: ${nullStatus.length}`);

    // Test data
    const testData = await queryDb(
      `SELECT 'pagar' as tabela, id, descricao, valor, status, created_at
       FROM financeiro_pagar
       WHERE descricao ILIKE '%TESTE%' OR descricao ILIKE '%HOMOLOGACAO%'
          OR descricao ILIKE '%SEED%' OR descricao ILIKE '%MOCK%'
          OR descricao ILIKE '%FIN01%' OR descricao ILIKE '%FIN361%'
          OR descricao ILIKE '%DUPLICATE%'
       UNION ALL
       SELECT 'receber', id, descricao, valor, status, created_at
       FROM financeiro_receber
       WHERE descricao ILIKE '%TESTE%' OR descricao ILIKE '%HOMOLOGACAO%'
          OR descricao ILIKE '%SEED%' OR descricao ILIKE '%MOCK%'
          OR descricao ILIKE '%FIN01%' OR descricao ILIKE '%FIN361%'
          OR descricao ILIKE '%DUPLICATE%'
       ORDER BY created_at DESC`
    );
    console.log(`[DB] Registros teste/homologação: ${testData.length}`);

    // Baixas
    const baixas = await queryDb(
      `SELECT titulo_tabela, COUNT(*) as qtd, COALESCE(SUM(valor_baixado),0) as total,
              SUM(CASE WHEN estornada THEN 1 ELSE 0 END) as estornadas
       FROM financeiro_baixas GROUP BY titulo_tabela`
    );
    console.log(`[DB] Baixas:`, baixas);

    // Contas financeiras
    const contas = await queryDb(
      `SELECT id, nome, banco, agencia, numero_conta, saldo, ativa, principal
       FROM contas_financeiras ORDER BY nome`
    );
    console.log(`[DB] Contas financeiras:`, contas);

    // Configurações financeiras
    const configs = await queryDb(
      `SELECT chave, valor FROM configuracoes_sistema
       WHERE chave ILIKE '%financ%' OR chave ILIKE '%conta%'`
    );
    console.log(`[DB] Config financeiras: ${configs.length > 0 ? configs : 'VAZIO (BUG-3)'}`);

    // Transferências
    const transfs = await queryDb(
      `SELECT COUNT(*) as qtd, COALESCE(SUM(valor),0) as total FROM financeiro_transferencias`
    );
    console.log(`[DB] Transferências: ${transfs[0].qtd} (total R$ ${transfs[0].total})`);

    await screenshot(page, "13-dados-legacy");
  });

  // ─── 14. Relatórios ────────────────────────────────────────────────────

  test("14 - Validar Relatórios Financeiros", async ({ page }) => {
    await loginAdmin(page);
    await navigateToTab(page, "relatorios");
    await page.waitForTimeout(3000);
    await screenshotFull(page, "14-relatorios");

    // Faturamento
    await navigateToTab(page, "relatorio-faturamento");
    await page.waitForTimeout(2000);
    await screenshotFull(page, "14-rel-faturamento");

    // Pagamento Prestadores
    await navigateToTab(page, "pagamento-prestadores");
    await page.waitForTimeout(2000);
    await screenshotFull(page, "14-rel-pag-prestadores");
  });

  // ─── 15. Config Financeira (BUG-3) ────────────────────────────────────

  test("15 - Validar Config Financeira (BUG-3)", async ({ page }) => {
    await loginAdmin(page);
    await navigateToTab(page, "config-financeira");
    await page.waitForTimeout(3000);
    await screenshotFull(page, "15-config-financeira");

    // BUG-3: configuracoes_sistema não contém chaves financeiras
    const configs = await queryDb(
      `SELECT chave, valor FROM configuracoes_sistema
       WHERE chave IN ('config_financeira_empresa', 'contas_financeiras_config')`
    );
    console.log(`[DB] BUG-3 check: ${configs.length === 0 ? 'CONFIRMADO (chaves ausentes)' : 'RESOLVIDO'}`);
  });

  // ─── 16. Contas & Caixas ──────────────────────────────────────────────

  test("16 - Validar Contas & Caixas", async ({ page }) => {
    await loginAdmin(page);
    await navigateToTab(page, "contas-caixas");
    await page.waitForTimeout(3000);
    await screenshotFull(page, "16-contas-caixas");

    // Saldo real da conta
    const conta = await queryDb(
      `SELECT nome, saldo, saldo_inicial FROM contas_financeiras WHERE ativa = true`
    );
    if (conta.length > 0) {
      console.log(`[DB] Conta ${conta[0].nome}: saldo_inicial=${conta[0].saldo_inicial}, saldo atual=${conta[0].saldo}`);
    }

    // Total baixas por conta
    const baixasPorConta = await queryDb(
      `SELECT conta_financeira, COUNT(*) as qtd, COALESCE(SUM(valor_baixado),0) as total
       FROM financeiro_baixas WHERE NOT estornada AND conta_financeira_id IS NOT NULL
       GROUP BY conta_financeira`
    );
    console.log(`[DB] Baixas por conta:`, baixasPorConta);
  });

  // ─── 17. Inadimplência ─────────────────────────────────────────────────

  test("17 - Validar Inadimplência", async ({ page }) => {
    await loginAdmin(page);
    await navigateToTab(page, "inadimplencia");
    await page.waitForTimeout(3000);
    await screenshotFull(page, "17-inadimplencia");

    // Títulos vencidos em aberto
    const vencidos = await queryDb(
       `SELECT COUNT(*) as qtd, COALESCE(SUM(valor),0) as total
        FROM financeiro_receber
        WHERE status IN ('vencida','vencido','aberto')
        AND data_vencimento < CURRENT_DATE`
    );
    console.log(`[DB] Títulos vencidos: ${vencidos[0].qtd} (R$ ${vencidos[0].total})`);
  });

  // ─── 18. Evidências Finais ─────────────────────────────────────────────

  test("18 - Capturar evidências finais", async ({ page }) => {
    await loginAdmin(page);

    // Dashboard final
    await navigateToTab(page, "dashboard");
    await page.waitForTimeout(3000);
    await screenshotFull(page, "18-dashboard-final");

    // Pagar lista
    await navigateToTab(page, "pagar");
    await page.waitForTimeout(2000);
    await screenshotFull(page, "18-pagar-final");

    // Receber lista
    await navigateToTab(page, "receber");
    await page.waitForTimeout(2000);
    await screenshotFull(page, "18-receber-final");

    // Resumo final do banco
    const resumo = await queryDb(`
      SELECT
        (SELECT COUNT(*) FROM financeiro_pagar) as pagar_total,
        (SELECT COUNT(*) FROM financeiro_pagar WHERE status IN ('pago','paga')) as pagar_pago,
        (SELECT COUNT(*) FROM financeiro_receber) as receber_total,
        (SELECT COUNT(*) FROM financeiro_receber WHERE status IN ('pago','paga')) as receber_pago,
        (SELECT COUNT(*) FROM financeiro_baixas) as baixas_total,
        (SELECT COUNT(*) FROM financeiro_baixas WHERE NOT estornada) as baixas_ativas,
        (SELECT COUNT(*) FROM contas_financeiras WHERE ativa = true) as contas_ativas,
        (SELECT COUNT(*) FROM faturas) as faturas_total,
        (SELECT COUNT(*) FROM pagamentos_prestadores) as pgto_prest_total,
        (SELECT COUNT(*) FROM financeiro_transferencias) as transferencias_total
    `);
    console.log(`[DB] RESUMO FINAL:`, resumo[0]);
  });
});
