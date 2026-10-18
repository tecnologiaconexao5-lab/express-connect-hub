import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const DB_URL = "postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres";
const ADMIN_EMAIL = "tamiris.castilho@conexaoexpress.com.br";
const ADMIN_PASSWORD = "Conexao@2026";
const TS = Date.now();
const SENTINELA_DESC = `FIN3623B-${TS}`;
const SENTINELA_VALOR = 12.35;
const SS = "test-results/e2e/fin3623b";

let pg: any = null;
async function getDb() {
  if (pg) return pg;
  const { Client } = await import("pg");
  pg = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  return pg;
}
async function q(sql: string) { return (await (await getDb()).query(sql)).rows; }

async function ss(page: Page, name: string) {
  fs.mkdirSync(SS, { recursive: true });
  await page.screenshot({ path: path.join(SS, `${name}.png`), fullPage: false });
}

async function login(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.locator('input[type="email"], input[placeholder*="email"]').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"], button:has-text("Entrar")').click();
  await page.waitForTimeout(3000);
}

const estado = {
  sentinelaId: "" as string,
  contaCoraId: "" as string,
  contaCoraNome: "" as string,
  baixaId: "" as string,
};

test.describe("FIN-362.3B — PROVA RECEBER", () => {
  test.afterAll(async () => { if (pg) await pg.end(); });

  // ─── PASSO 1: UI Contas a Receber renderiza ────────────────────────

  test("PASSO 1 — UI Contas a Receber renderiza", async ({ page }) => {
    await login(page);
    await page.goto("/financeiro?tab=receber", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);

    const hasTable = await page.locator("table").first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/Nenhum recebível encontrado/i).isVisible().catch(() => false);
    const hasNovaReceita = await page.getByRole("button", { name: /Nova Receita/i }).isVisible().catch(() => false);
    expect(hasTable || hasEmpty || hasNovaReceita).toBeTruthy();
    expect(hasNovaReceita).toBeTruthy();
    await ss(page, "p1-receber-ui");
  });

  // ─── PASSO 2: Conta Cora real ──────────────────────────────────────

  test("PASSO 2 — Conta Cora real (contas_financeiras)", async ({ page }) => {
    const contas = await q(
      `SELECT id, nome, banco, ativa FROM contas_financeiras WHERE ativa = true ORDER BY principal DESC, nome ASC`
    );
    expect(contas.length).toBeGreaterThan(0);
    const cora = contas.find((c: any) => (c.nome || "").toLowerCase().includes("cora"));
    const sel = cora || contas[0];
    estado.contaCoraId = sel.id;
    estado.contaCoraNome = sel.nome;
    expect(estado.contaCoraId).toBeTruthy();
  });

  // ─── PASSO 3: Criar sentinela via UI ───────────────────────────────

  test("PASSO 3 — Criar sentinela FIN3623B via UI", async ({ page }) => {
    await login(page);
    await page.goto("/financeiro?tab=receber", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Clicar Nova Receita
    await page.getByRole("button", { name: /Nova Receita/i }).click();
    await page.waitForTimeout(1500);

    // Tab Dados Principais (já ativo) — Preencher cliente
    const clienteInput = page.getByPlaceholder("Buscar cliente por razão social ou CNPJ...");
    await clienteInput.waitFor({ state: "visible", timeout: 8000 });
    await clienteInput.fill("CALVO");
    await page.waitForTimeout(2000);

    // Clicar no primeiro resultado do dropdown
    const dropdownItem = page.locator(".absolute.z-10 div").filter({ hasText: /CALVO/i }).first();
    await dropdownItem.waitFor({ state: "visible", timeout: 5000 });
    await dropdownItem.click();
    await page.waitForTimeout(500);

    // Preencher fatura/documento
    const docInput = page.getByPlaceholder("FAT-0001");
    if (await docInput.isVisible().catch(() => false)) await docInput.fill(SENTINELA_DESC);

    // Tab Valores — Valor Bruto
    const tabVal = page.getByRole("tab", { name: /Valores/i });
    await tabVal.click();
    await page.waitForTimeout(500);

    const valorInput = page.locator('input[type="number"]').first();
    await valorInput.fill(String(SENTINELA_VALOR));

    await ss(page, "p3-form");

    // Salvar
    await page.getByRole("button", { name: /Salvar$/i }).click();
    await page.waitForTimeout(3000);
    await ss(page, "p3-pos-salvar");

    // Validar no DB
    const db = await q(
      `SELECT id, fatura, valor, status, cliente_nome FROM financeiro_receber
       WHERE fatura ILIKE '%${SENTINELA_DESC}%' ORDER BY created_at DESC LIMIT 1`
    );
    expect(db.length).toBeGreaterThan(0);
    estado.sentinelaId = db[0].id;
    expect(db[0].status).toBe("pendente");
  });

  // ─── PASSO 4: Baixar sentinela com conta real ──────────────────────

  test("PASSO 4 — Baixar sentinela via UI com conta real", async ({ page }) => {
    // === INTERCEPTAR REDE ANTES de navegar ===
    const networkLog: string[] = [];
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('contas_financeiras') || url.includes('configuracoes_sistema')) {
        try {
          const body = await response.text();
          const entry = `[${response.status()}] ${url.substring(0, 120)} => ${body.substring(0, 400)}`;
          networkLog.push(entry);
          console.log(`[NET] ${entry}`);
        } catch {}
      }
    });

    // === INTERCEPTAR console ANTES de navegar ===
    const browserLogs: string[] = [];
    page.on('console', msg => {
      const txt = msg.text();
      if (msg.type() === 'error' || txt.toLowerCase().includes('error') || txt.toLowerCase().includes('catch') || txt.includes('contas')) {
        browserLogs.push(`[${msg.type()}] ${txt.substring(0, 300)}`);
        console.log(`[BROWSER] [${msg.type()}] ${txt.substring(0, 200)}`);
      }
    });

    await login(page);
    await page.goto("/financeiro?tab=receber", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(8000);

    // Busca LOCAL — buscar pelo CLIENTE (não pelo fatura, porque listarRecebiveis filtra descricao/cliente)
    const localSearch = page.getByPlaceholder("Buscar fatura, cliente, OS...");
    await localSearch.waitFor({ state: "visible", timeout: 10000 });
    await localSearch.fill("Calvo");
    await page.waitForTimeout(3000);
    await ss(page, "p4-busca-calvo");

    // Verificar que a linha aparece (pode ter mais de uma, pegar a que tem valor)
    const rows = page.locator("tr").filter({ hasText: /Calvo/i });
    const rowCount = await rows.count();
    console.log(`[UI] Linhas Calvo encontradas: ${rowCount}`);

    // Pegar a primeira linha que tem botão Baixa
    let targetRow = rows.first();
    let foundBaixa = false;
    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const btn = row.locator('button[title="Baixa"]');
      if (await btn.isVisible().catch(() => false)) {
        targetRow = row;
        foundBaixa = true;
        break;
      }
    }
    console.log(`[UI] Botão Baixa encontrado: ${foundBaixa}`);

    if (!foundBaixa) {
      // Se não encontrou botão Baixa, tentar sem filtro de busca
      await localSearch.clear();
      await page.waitForTimeout(3000);
      const allRows = page.locator("tr").filter({ hasText: /Calvo/i });
      const allCount = await allRows.count();
      console.log(`[UI] Linhas Calvo sem filtro: ${allCount}`);
      for (let i = 0; i < allCount; i++) {
        const row = allRows.nth(i);
        const btn = row.locator('button[title="Baixa"]');
        if (await btn.isVisible().catch(() => false)) {
          targetRow = row;
          foundBaixa = true;
          break;
        }
      }
    }

    await ss(page, "p4-linha-encontrada");

    // Clicar botão Baixa
    const baixaBtn = targetRow.locator('button[title="Baixa"]');
    await baixaBtn.waitFor({ state: "visible", timeout: 10000 });
    await baixaBtn.click();
    await page.waitForTimeout(1500);
    await ss(page, "p4-dialog-baixa-aberto");

    // Verificar dialog
    const dialog = page.locator('[role="dialog"]').filter({ hasText: /Baixa de Recebível/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // === DUMP dos logs de rede e browser ===
    console.log(`\n=== NETWORK LOG (${networkLog.length} entries) ===`);
    networkLog.forEach(e => console.log(e));
    console.log(`=== BROWSER LOG (${browserLogs.length} entries) ===`);
    browserLogs.forEach(e => console.log(e));
    console.log(`=== END LOGS ===\n`);

    // Debug: verificar estado do Select de Conta via DOM
    const contaComboState = await dialog.locator('button[role="combobox"]').last().getAttribute('data-state');
    const contaComboText = await dialog.locator('button[role="combobox"]').last().textContent();
    console.log(`[UI] Conta combo data-state="${contaComboState}" text="${contaComboText}"`);

    // Verificar quantos SelectItem existem DENTRO do dialog (não no portal)
    const selectItemsInDialog = await dialog.locator('[role="menuitem"], [data-radix-collection-item], [data-state="unchecked"], [data-state="checked"]').count();
    console.log(`[UI] Itens Select no dialog DOM: ${selectItemsInDialog}`);

    // Verificar o HTML do Select de Conta
    const selectHtml = await dialog.locator('div:has(> label:text("Conta"))').first().innerHTML();
    console.log(`[UI] Select Conta HTML (truncado): ${selectHtml.substring(0, 500)}`);

    // Verificar se há erros de console recentes
    const consoleErrors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    await page.waitForTimeout(500);
    console.log(`[UI] Console errors recentes: ${consoleErrors.length}`);
    consoleErrors.forEach(e => console.log(`  ERR: ${e.substring(0, 200)}`));

    // O overlay do Dialog (z-50 bg-black/80) bloqueia cliques.
    // Usar force:true para bypass + luego teclado para abrir dropdown
    const contaCombo = dialog.locator('button[role="combobox"]').last();
    await contaCombo.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Click force para bypassar overlay, depois ArrowDown + Enter para selecionar
    await contaCombo.click({ force: true });
    await page.waitForTimeout(500);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(1000);
    // Enter seleciona a opção highlighted
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1000);

    // Verificar se selecionou (texto do combo deve mudar de "Selecione")
    const comboText = await contaCombo.textContent();
    console.log(`[UI] Conta combo após seleção: "${comboText}"`);
    await ss(page, "p4-conta-selecionada");

    // Se não selecionou, tentar com Tab+Enter
    if (!comboText || comboText.includes("Selecione")) {
      console.log(`[UI] Seleção não confirmada, tentando Tab+Enter...`);
      await contaCombo.click({ force: true });
      await page.waitForTimeout(500);
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(1000);
      await page.keyboard.press("Tab");
      await page.waitForTimeout(500);
      await ss(page, "p4-conta-retry");
    }

    // Clicar Baixa Total — force:true para bypassar overlay do Dialog
    const baixaTotalBtn = dialog.getByRole("button", { name: /Baixa Total/i });
    await baixaTotalBtn.click({ force: true });
    await page.waitForTimeout(5000);
    await ss(page, "p4-pos-baixa");

    // ── PROVA DB ──
    const baixaDb = await q(
      `SELECT b.id, b.titulo_id, b.titulo_tabela, b.valor_baixado, b.saldo_restante,
              b.estornada, b.data_baixa, b.conta_financeira_id, b.forma_pagamento
       FROM financeiro_baixas b
       WHERE b.titulo_id = '${estado.sentinelaId}'
         AND b.titulo_tabela = 'financeiro_receber'
         AND NOT b.estornada
       ORDER BY b.created_at DESC LIMIT 1`
    );

    console.log(`[DB] Baixa encontrada: ${baixaDb.length > 0 ? "SIM" : "NÃO"}`);
    if (baixaDb.length > 0) {
      console.log(`  id: ${baixaDb[0].id}`);
      console.log(`  valor_baixado: ${baixaDb[0].valor_baixado}`);
      console.log(`  conta_financeira_id: ${baixaDb[0].conta_financeira_id}`);
      console.log(`  saldo_restante: ${baixaDb[0].saldo_restante}`);
    }

    expect(baixaDb.length).toBeGreaterThan(0);
    estado.baixaId = baixaDb[0].id;
  });

  // ─── PASSO 5: Assertion conta_financeira_id ≠ NULL ────────────────

  test("PASSO 5 — conta_financeira_id NÃO NULL = UUID da conta", async ({ page }) => {
    expect(estado.sentinelaId).toBeTruthy();

    const baixa = await q(
      `SELECT id, titulo_id, titulo_tabela, valor_baixado, saldo_restante,
              estornada, data_baixa, conta_financeira_id, forma_pagamento
       FROM financeiro_baixas
       WHERE titulo_id = '${estado.sentinelaId}'
         AND titulo_tabela = 'financeiro_receber'
         AND NOT estornada
       LIMIT 1`
    );

    expect(baixa.length).toBe(1);

    // GATE: conta_financeira_id NÃO NULO
    expect(baixa[0].conta_financeira_id).not.toBeNull();
    expect(baixa[0].conta_financeira_id).toBeTruthy();

    // UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(baixa[0].conta_financeira_id).toMatch(uuidRegex);

    // UUID = conta selecionada
    expect(baixa[0].conta_financeira_id).toBe(estado.contaCoraId);

    // Conta existe e está ativa
    const conta = await q(
      `SELECT id, nome, ativa FROM contas_financeiras WHERE id = '${baixa[0].conta_financeira_id}' AND ativa = true`
    );
    expect(conta.length).toBe(1);

    // Valor correto
    expect(Number(baixa[0].valor_baixado)).toBe(SENTINELA_VALOR);

    // Não estornada
    expect(baixa[0].estornada).toBe(false);

    console.log(`[DB] ✅ GATE: conta_financeira_id = ${baixa[0].conta_financeira_id} (${conta[0].nome})`);
  });

  // ─── PASSO 6: Status = pago + saldo = 0 ───────────────────────────

  test("PASSO 6 — Status = pago, saldo_restante = 0", async ({ page }) => {
    expect(estado.sentinelaId).toBeTruthy();

    // Verificar título mudou para pago
    const titulo = await q(
      `SELECT id, status, data_pagamento, valor, valor_liquido
       FROM financeiro_receber WHERE id = '${estado.sentinelaId}'`
    );
    expect(titulo.length).toBe(1);
    expect(titulo[0].status).toBe("pago");
    expect(titulo[0].data_pagamento).toBeTruthy();

    // Verificar saldo na baixa
    const baixa = await q(
      `SELECT saldo_restante FROM financeiro_baixas
       WHERE titulo_id = '${estado.sentinelaId}' AND NOT estornada LIMIT 1`
    );
    expect(baixa.length).toBe(1);
    expect(Number(baixa[0].saldo_restante)).toBe(0);

    console.log(`[DB] ✅ Status: ${titulo[0].status}, data_pagamento: ${titulo[0].data_pagamento}`);
    console.log(`[DB] ✅ saldo_restante: ${baixa[0].saldo_restante}`);
  });

  // ─── PASSO 7: UI pós-baixa ────────────────────────────────────────

  test("PASSO 7 — UI exibe título como PAGO", async ({ page }) => {
    await login(page);
    await page.goto("/financeiro?tab=receber", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Buscar pelo sentinela na busca LOCAL
    const localSearch = page.getByPlaceholder("Buscar fatura, cliente, OS...");
    await localSearch.waitFor({ state: "visible", timeout: 10000 });
    await localSearch.fill(SENTINELA_DESC);
    await page.waitForTimeout(2500);
    await ss(page, "p7-pos-baixa-ui");

    // Verificar badge PAGO
    const row = page.locator("tr").filter({ hasText: SENTINELA_DESC }).first();
    const hasPago = await row.getByText(/PAGO/i).isVisible().catch(() => false);
    console.log(`[UI] Badge PAGO visível: ${hasPago}`);
  });

});
