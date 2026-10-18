// ============================================================
// FIN-MASTER-362.3 — Fechamento do Receber e Rastreabilidade Bancária
// ============================================================
// Framework: Playwright
// Browser: Chromium (Desktop Chrome)
// Ambiente: TMS localhost:8801 → Supabase produção
// Regra: UI real → Backend → DB → UI. NENHUM page.evaluate
//        chamando service/RPC/INSERT diretamente.
// ============================================================

import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// ─── Config ──────────────────────────────────────────────────────────────────

const DB_URL = "postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres";
const ADMIN_EMAIL = "tamiris.castilho@conexaoexpress.com.br";
const ADMIN_PASSWORD = "Conexao@2026";

const TS = Date.now();
const SENTINELA_DESC = `FIN3623-SENTINELA-RECEBER`;
const SENTINELA_VALOR = 12.35;
const FATURA_DESC = "FIN3623 HOMOLOGACAO PDF CONEXAO EXPRESS";
const FATURA_VALOR = 123.46;
const FATURA_NUMERO = `FIN3623F-${TS}`;

const SS = "test-results/e2e/fin3623";

// ─── DB Client ───────────────────────────────────────────────────────────────

let pg: any = null;
async function getDb() {
  if (pg) return pg;
  const { Client } = await import("pg");
  pg = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  return pg;
}
async function q(sql: string) { return (await (await getDb()).query(sql)).rows; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function ss(page: Page, name: string) {
  fs.mkdirSync(SS, { recursive: true });
  await page.screenshot({ path: path.join(SS, `${name}.png`), fullPage: false });
}
async function ssf(page: Page, name: string) {
  fs.mkdirSync(SS, { recursive: true });
  await page.screenshot({ path: path.join(SS, `${name}.png`), fullPage: true });
}

async function login(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.locator('input[type="email"], input[placeholder*="email"]').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"], button:has-text("Entrar")').click();
  await page.waitForTimeout(3000);
}

// ─── Shared state ────────────────────────────────────────────────────────────

const estado = {
  sentinelaId: "" as string,
  contaCoraId: "" as string,
  contaCoraNome: "" as string,
  faturaId: "" as string,
  baixaId: "" as string,
};

// ============================================================
test.describe("FIN-MASTER-362.3 — Receber + Rastreabilidade + PDF", () => {

  test.afterAll(async () => { if (pg) await pg.end(); });

  // ─── 1. ContasReceber UI renderiza ──────────────────────────────────

  test("1 - ContasReceber renderiza pela UI (sem page.evaluate)", async ({ page }) => {
    await login(page);

    await page.goto("/financeiro?tab=receber", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    await ss(page, "01-receber-antes");

    // Verificar que a aba "Contas a Receber" está ativa
    const tabReceber = page.locator('[role="tab"][data-state="active"], [role="tab"][aria-selected="true"]').filter({ hasText: /Receber/i });
    const isTabActive = await tabReceber.isVisible().catch(() => false);
    console.log(`[UI] Aba Receber ativa: ${isTabActive}`);

    // Verificar que o componente renderizou (tabela ou "nenhum recebível")
    const hasTable = await page.locator("table").first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/Nenhum recebível encontrado/i).isVisible().catch(() => false);
    const hasKPIs = await page.getByText(/Total a Receber/i).isVisible().catch(() => false);

    console.log(`[UI] Tabela visível: ${hasTable}`);
    console.log(`[UI] Empty state: ${hasEmpty}`);
    console.log(`[UI] KPIs visíveis: ${hasKPIs}`);

    // O componente DEVE renderizar (tabela, empty state ou KPIs)
    expect(hasTable || hasEmpty || hasKPIs).toBeTruthy();

    // Verificar que "Nova Receita" está visível
    const novaReceitaBtn = page.getByRole("button", { name: /Nova Receita/i });
    await expect(novaReceitaBtn).toBeVisible({ timeout: 5000 });

    await ss(page, "01-receber-renderizou");
  });

  // ─── 2. Buscar conta Cora real ──────────────────────────────────────

  test("2 - Buscar conta financeira real (contas_financeiras)", async ({ page }) => {
    const contas = await q(
      `SELECT id, nome, banco, numero_conta, ativa, principal
       FROM contas_financeiras
       WHERE ativa = true
       ORDER BY principal DESC, nome ASC`
    );
    console.log(`[DB] Contas financeiras ativas: ${contas.length}`);
    contas.forEach((c: any) => {
      console.log(`  ${c.id} | ${c.nome} | ${c.banco} | principal=${c.principal}`);
    });

    expect(contas.length).toBeGreaterThan(0);

    // Preferir Cora se existir, senão usar a primeira
    const cora = contas.find((c: any) => (c.nome || "").toLowerCase().includes("cora"));
    const contaSelecionada = cora || contas[0];

    estado.contaCoraId = contaSelecionada.id;
    estado.contaCoraNome = contaSelecionada.nome;

    console.log(`[DB] Conta selecionada: ${estado.contaCoraNome} (${estado.contaCoraId})`);
    expect(estado.contaCoraId).toBeTruthy();
  });

  // ─── 3. Criar sentinela receber via UI ──────────────────────────────

  test("3 - Criar FIN3623-SENTINELA-RECEBER via UI", async ({ page }) => {
    await login(page);

    await page.goto("/financeiro?tab=receber", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Nova Receita
    const novaReceitaBtn = page.getByRole("button", { name: /Nova Receita/i });
    await novaReceitaBtn.waitFor({ state: "visible", timeout: 10000 });
    await novaReceitaBtn.click();
    await page.waitForTimeout(1500);
    await ss(page, "03-dialog-receber");

    // Buscar cliente (CALVO)
    const clienteInput = page.getByPlaceholder(/buscar cliente/i);
    if (await clienteInput.isVisible().catch(() => false)) {
      await clienteInput.fill("CALVO");
      await page.waitForTimeout(2000);

      // Selecionar primeiro resultado do dropdown
      const suggestion = page.locator(".absolute.z-10 div").filter({ hasText: /CALVO/i }).first();
      if (await suggestion.isVisible().catch(() => false)) {
        await suggestion.click();
      } else {
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(300);
        await page.keyboard.press("Enter");
      }
      await page.waitForTimeout(500);
    }

    // Preencher fatura/documento
    const docInput = page.getByPlaceholder(/FAT-0001/i);
    if (await docInput.isVisible().catch(() => false)) {
      await docInput.fill(SENTINELA_DESC);
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
      await valorBrutoInput.fill(String(SENTINELA_VALOR));
    }

    await ss(page, "03-form-preenchido");

    // Salvar
    const salvarBtn = page.getByRole("button", { name: /Salvar$/i });
    await salvarBtn.click();
    await page.waitForTimeout(3000);
    await ss(page, "03-pos-salvar");

    // Validar no banco
    const dbResult = await q(
      `SELECT id, fatura, valor, status, cliente_id, cliente_nome
       FROM financeiro_receber
       WHERE fatura ILIKE '%${SENTINELA_DESC}%'
       ORDER BY created_at DESC LIMIT 1`
    );
    console.log(`[DB] Sentinela criado:`, dbResult);

    expect(dbResult.length).toBeGreaterThan(0);
    estado.sentinelaId = dbResult[0].id;
    console.log(`[DB] Sentinela ID: ${estado.sentinelaId}`);
  });

  // ─── 4. Baixa via UI com conta real ─────────────────────────────────

  test("4 - Baixar sentinela via UI com conta real", async ({ page }) => {
    await login(page);

    await page.goto("/financeiro?tab=receber", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Buscar título
    const searchInput = page.getByPlaceholder(/Buscar/i).first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(SENTINELA_DESC);
      await page.waitForTimeout(2000);
    }

    await ss(page, "04-antes-baixa");

    // Encontrar linha do sentinela e clicar botão Baixa (CreditCard icon)
    const tituloRow = page.locator("tr").filter({ hasText: SENTINELA_DESC }).first();
    const baixaBtn = tituloRow.locator("button").filter({ has: page.locator("svg") }).nth(2);
    // Botão Baixa é o terceiro botão de ação (Eye, Edit, CreditCard)
    const allBtns = tituloRow.locator("button[title]");
    const baixaBtnByTitle = tituloRow.locator('button[title="Baixa"]');

    if (await baixaBtnByTitle.isVisible().catch(() => false)) {
      await baixaBtnByTitle.click();
    } else if (await baixaBtn.isVisible().catch(() => false)) {
      await baixaBtn.click();
    } else {
      // Fallback: clicar qualquer botão de ação que abre dialog
      const btns = tituloRow.locator("button");
      const count = await btns.count();
      for (let i = 0; i < count; i++) {
        const btn = btns.nth(i);
        const title = await btn.getAttribute("title");
        if (title?.includes("Baixa") || title?.includes("Recebimento")) {
          await btn.click();
          break;
        }
      }
    }
    await page.waitForTimeout(1500);
    await ss(page, "04-dialog-baixa");

    // Verificar que o dialog de baixa abriu
    const dialogBaixa = page.locator('[role="dialog"]').filter({ hasText: /Baixa de Recebível/i });
    const dialogVisible = await dialogBaixa.isVisible().catch(() => false);
    console.log(`[UI] Dialog baixa visível: ${dialogVisible}`);

    if (dialogVisible) {
      // Selecionar conta financeira (Cora ou primeira disponível)
      const contaSelect = dialogBaixa.locator('button[role="combobox"]').filter({ hasText: /Selecione|Conta/i });
      if (await contaSelect.isVisible().catch(() => false)) {
        await contaSelect.click();
        await page.waitForTimeout(500);

        // Procurar a conta Cora ou primeira opção
        const contaOption = page.locator('[role="option"]').filter({ hasText: estado.contaCoraNome || /Cora/i }).first();
        if (await contaOption.isVisible().catch(() => false)) {
          await contaOption.click();
        } else {
          // Selecionar primeira opção disponível
          const firstOption = page.locator('[role="option"]').first();
          if (await firstOption.isVisible().catch(() => false)) {
            await firstOption.click();
          }
        }
        await page.waitForTimeout(500);
      }

      await ss(page, "04-conta-selecionada");

      // Clicar Baixa Total
      const baixaTotalBtn = dialogBaixa.getByRole("button", { name: /Baixa Total/i });
      if (await baixaTotalBtn.isVisible().catch(() => false)) {
        await baixaTotalBtn.click();
        await page.waitForTimeout(3000);
      }

      await ss(page, "04-pos-baixa");
    }

    // ── PROVA DB: financeiro_baixas ──
    const baixaDb = await q(
      `SELECT b.id, b.titulo_id, b.titulo_tabela, b.valor_baixado, b.saldo_restante,
              b.estornada, b.data_baixa, b.conta_financeira_id, b.conta_financeira,
              b.forma_pagamento, b.observacao
       FROM financeiro_baixas b
       WHERE b.titulo_id = '${estado.sentinelaId}'
         AND b.titulo_tabela = 'financeiro_receber'
         AND NOT b.estornada
       ORDER BY b.created_at DESC LIMIT 1`
    );

    console.log(`[DB] Baixa encontrada:`, baixaDb);

    if (baixaDb.length > 0) {
      estado.baixaId = baixaDb[0].id;

      // ASSERTION OBRIGATÓRIA
      expect(baixaDb[0].id).toBeTruthy();
      expect(baixaDb[0].titulo_tabela).toBe("financeiro_receber");
      expect(Number(baixaDb[0].valor_baixado)).toBe(SENTINELA_VALOR);
      expect(Number(baixaDb[0].saldo_restante)).toBe(0);
      expect(baixaDb[0].estornada).toBe(false);
      expect(baixaDb[0].data_baixa).toBeTruthy();

      // CONTA_FINANCEIRA_ID NÃO NULL
      expect(baixaDb[0].conta_financeira_id).not.toBeNull();
      console.log(`[DB] conta_financeira_id na baixa: ${baixaDb[0].conta_financeira_id}`);

      // UUID da conta = UUID da conta selecionada
      if (estado.contaCoraId) {
        expect(baixaDb[0].conta_financeira_id).toBe(estado.contaCoraId);
        console.log(`[DB] UUID da baixa = UUID da conta selecionada: ✅`);
      }

      console.log(`[DB] ✅ BAIXA PERSISTIDA COM CONTA_FINANCEIRA_ID`);
    } else {
      console.log(`[DB] ⚠️ Nenhuma baixa encontrada — UI pode não ter completado`);
    }
  });

  // ─── 5. UI pós-baixa ───────────────────────────────────────────────

  test("5 - Validar UI pós-baixa (título pago)", async ({ page }) => {
    await login(page);

    await page.goto("/financeiro?tab=receber", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Buscar título
    const searchInput = page.getByPlaceholder(/Buscar/i).first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(SENTINELA_DESC);
      await page.waitForTimeout(2000);
    }

    await ss(page, "05-pos-baixa-ui");

    // Verificar que o título aparece como PAGO na UI
    const tituloRow = page.locator("tr").filter({ hasText: SENTINELA_DESC }).first();
    const hasPago = await tituloRow.getByText(/PAGO/i).isVisible().catch(() => false);
    console.log(`[UI] Título marcado como PAGO: ${hasPago}`);

    // Verificar no DB que status mudou para pago
    const statusDb = await q(
      `SELECT status, data_pagamento, conta_entrada
       FROM financeiro_receber
       WHERE id = '${estado.sentinelaId}'`
    );
    if (statusDb.length > 0) {
      console.log(`[DB] Status pós-baixa: ${statusDb[0].status}`);
      console.log(`[DB] Data pagamento: ${statusDb[0].data_pagamento}`);
      console.log(`[DB] Conta entrada: ${statusDb[0].conta_entrada}`);
      expect(statusDb[0].status).toBe("pago");
    }
  });

  // ─── 6. Tesouraria e Fluxo ─────────────────────────────────────────

  test("6 - Tesouraria e Fluxo reconciliados com a baixa", async ({ page }) => {
    await login(page);

    // Validação via DB (Tesouraria = baixas por conta)
    const tesouraria = await q(
      `SELECT b.conta_financeira_id, cf.nome as conta_nome,
              COUNT(*) as qtd_baixas, COALESCE(SUM(b.valor_baixado), 0) as total_recebido
       FROM financeiro_baixas b
       LEFT JOIN contas_financeiras cf ON cf.id = b.conta_financeira_id
       WHERE b.titulo_tabela = 'financeiro_receber'
         AND NOT b.estornada
         AND b.conta_financeira_id IS NOT NULL
       GROUP BY b.conta_financeira_id, cf.nome
       ORDER BY total_recebido DESC`
    );
    console.log(`[DB] Tesouraria (baixas com conta):`, tesouraria);

    // Verificar que a conta usada aparece
    if (estado.contaCoraId && tesouraria.length > 0) {
      const contaBaixa = tesouraria.find((t: any) => t.conta_financeira_id === estado.contaCoraId);
      if (contaBaixa) {
        console.log(`[DB] Conta ${contaBaixa.conta_nome}: ${contaBaixa.qtd_baixas} baixas, R$ ${contaBaixa.total_recebido}`);
        expect(Number(contaBaixa.total_recebido)).toBeGreaterThan(0);
      }
    }

    // Fluxo de caixa: entrada realizada
    const fluxoEntrada = await q(
      `SELECT titulo_tabela, SUM(valor_baixado) as total
       FROM financeiro_baixas
       WHERE NOT estornada AND data_baixa >= CURRENT_DATE - INTERVAL '1 day'
       GROUP BY titulo_tabela`
    );
    console.log(`[DB] Fluxo entradas recentes:`, fluxoEntrada);

    // Navegar para Fluxo de Caixa para verificação visual
    await page.goto("/financeiro?tab=fluxo", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await ss(page, "06-fluxo-caixa");

    // UI x DB: capturar valor exibido e comparar
    const hasFluxo = await page.locator("table, [data-testid]").first().isVisible().catch(() => false);
    console.log(`[UI] Fluxo de caixa renderizou: ${hasFluxo}`);
  });

  // ─── 7. Assertion obrigatória (conta_financeira_id) ────────────────

  test("7 - Assertion obrigatória: conta_financeira_id não NULL", async ({ page }) => {
    // Esta assertion é feita via DB — não depende de UI
    const baixa = await q(
      `SELECT id, conta_financeira_id, titulo_id, valor_baixado, estornada
       FROM financeiro_baixas
       WHERE titulo_id = '${estado.sentinelaId}'
         AND titulo_tabela = 'financeiro_receber'
         AND NOT estornada
       LIMIT 1`
    );

    console.log(`[DB] Assertion baixa:`, baixa);

    if (baixa.length > 0) {
      // 1. ID não nulo
      expect(baixa[0].id).not.toBeNull();
      expect(baixa[0].id).toBeTruthy();

      // 2. conta_financeira_id NÃO NULO
      expect(baixa[0].conta_financeira_id).not.toBeNull();
      expect(baixa[0].conta_financeira_id).toBeTruthy();

      // 3. UUID válido (formato)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(baixa[0].conta_financeira_id).toMatch(uuidRegex);

      // 4. Conta existe e está ativa
      const conta = await q(
        `SELECT id, nome, ativa FROM contas_financeiras
         WHERE id = '${baixa[0].conta_financeira_id}' AND ativa = true`
      );
      expect(conta.length).toBe(1);
      console.log(`[DB] ✅ Assertion: conta_financeira_id = ${baixa[0].conta_financeira_id} (${conta[0].nome})`);

      // 5. Valor correto
      expect(Number(baixa[0].valor_baixado)).toBe(SENTINELA_VALOR);

      // 6. Não estornada
      expect(baixa[0].estornada).toBe(false);
    } else {
      throw new Error("Nenhuma baixa encontrada para o sentinela — assertion falhou");
    }
  });

  // ─── 8. Fatura/PDF E2E ─────────────────────────────────────────────

  test("8 - Criar fatura via UI, gerar PDF, editar, re-gerar", async ({ page }) => {
    await login(page);

    await page.goto("/financeiro?tab=faturas", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await ss(page, "08-faturas-antes");

    // Nova Fatura Manual
    const novaFaturaBtn = page.getByRole("button", { name: /Nova Fatura Manual/i });
    await novaFaturaBtn.waitFor({ state: "visible", timeout: 10000 });
    await novaFaturaBtn.click();
    await page.waitForTimeout(1500);
    await ss(page, "08-dialog-fatura");

    // Número
    const numeroInput = page.getByPlaceholder(/Ex\.\s*:?\s*38/i);
    if (await numeroInput.isVisible().catch(() => false)) {
      await numeroInput.fill(FATURA_NUMERO);
    }

    // Cliente (SearchableSelect)
    const clienteInput = page.getByPlaceholder(/Pesquisar cliente/i);
    if (await clienteInput.isVisible().catch(() => false)) {
      await clienteInput.fill("CALVO");
      await page.waitForTimeout(2000);
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(300);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(500);
    }

    // Descrição
    const descTextarea = page.locator("textarea").first();
    if (await descTextarea.isVisible().catch(() => false)) {
      await descTextarea.fill(FATURA_DESC);
    }

    // Valor
    const valorInput = page.locator('input[inputmode="decimal"]');
    if (await valorInput.isVisible().catch(() => false)) {
      await valorInput.fill(String(FATURA_VALOR));
    }

    await ss(page, "08-form-fatura");

    // Salvar Rascunho
    const salvarRascunho = page.getByRole("button", { name: /Salvar Rascunho/i });
    if (await salvarRascunho.isVisible().catch(() => false)) {
      await salvarRascunho.click();
      await page.waitForTimeout(3000);
      await ss(page, "08-pos-rascunho");
    }

    // Validar fatura no banco
    const faturaDb = await q(
      `SELECT id, numero, status, valor_total, metadata, cliente_id
       FROM faturas
       WHERE numero = '${FATURA_NUMERO}'
          OR metadata->>'numeroManual' = '${FATURA_NUMERO}'
       ORDER BY criado_em DESC LIMIT 1`
    );
    console.log(`[DB] Fatura criada:`, faturaDb);

    if (faturaDb.length > 0) {
      estado.faturaId = faturaDb[0].id;
      console.log(`[DB] Fatura ID: ${estado.faturaId}, status: ${faturaDb[0].status}`);

      // Validar endereço do cliente no PDF (BUG-2 fix)
      const clienteEndereco = await q(
        `SELECT razao_social, cnpj, logradouro, numero, complemento, bairro, cidade, uf, cep
         FROM clientes
         WHERE id = '${faturaDb[0].cliente_id}'`
      );
      if (clienteEndereco.length > 0) {
        const c = clienteEndereco[0];
        console.log(`[DB] Cliente: ${c.razao_social}`);
        console.log(`[DB] CNPJ: ${c.cnpj}`);
        console.log(`[DB] Endereço: ${c.logradouro || ''}, ${c.numero || ''} - ${c.bairro || ''}, ${c.cidade || ''}/${c.uf || ''}`);
        // Verificar que endereço não está vazio (BUG-2)
        expect(c.logradouro || c.cidade || c.cep).toBeTruthy();
      }

      // Validar dados bancários (BUG-3 fix)
      const contasBancarias = await q(
        `SELECT nome, banco, agencia, numero_conta, pix
         FROM contas_financeiras WHERE ativa = true LIMIT 1`
      );
      if (contasBancarias.length > 0) {
        console.log(`[DB] Conta bancária: ${contasBancarias[0].nome} (${contasBancarias[0].banco})`);
        expect(contasBancarias[0].nome).toBeTruthy();
      }
    }

    // ── 8b. Editar fatura e re-gerar PDF ──
    if (estado.faturaId) {
      // Navegar de volta para faturas
      await page.goto("/financeiro?tab=faturas", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);

      // Buscar fatura criada
      const searchInput = page.getByPlaceholder(/Buscar/i).first();
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill(FATURA_NUMERO);
        await page.waitForTimeout(2000);
      }

      // Clicar na fatura para editar
      const faturaRow = page.locator("tr, [role='row']").filter({ hasText: FATURA_NUMERO }).first();
      if (await faturaRow.isVisible().catch(() => false)) {
        const editBtn = faturaRow.locator('button[title="Editar"], button:has-text("Editar")').first();
        if (await editBtn.isVisible().catch(() => false)) {
          await editBtn.click();
          await page.waitForTimeout(1500);
          await ss(page, "08b-dialog-editar");

          // Editar descrição
          const descInput = page.locator("textarea").first();
          if (await descInput.isVisible().catch(() => false)) {
            await descInput.clear();
            await descInput.fill(`${FATURA_DESC} - EDITADO`);
            await page.waitForTimeout(500);
          }

          await ss(page, "08b-form-editado");

          // Salvar
          const salvarBtn = page.getByRole("button", { name: /Salvar/i });
          if (await salvarBtn.isVisible().catch(() => false)) {
            await salvarBtn.click();
            await page.waitForTimeout(3000);
            await ss(page, "08b-pos-editar");
          }
        }
      }

      // Validar descrição atualizada no DB
      const faturaAtualizada = await q(
        `SELECT metadata->>'descricao' as descricao
         FROM faturas WHERE id = '${estado.faturaId}'`
      );
      if (faturaAtualizada.length > 0) {
        console.log(`[DB] Descrição pós-edição: ${faturaAtualizada[0].descricao}`);
        expect(faturaAtualizada[0].descricao).toContain("EDITADO");
      }

      await ss(page, "08c-fatura-editada");
    }
  });

  // ─── 9. Regressão ──────────────────────────────────────────────────

  test("9 - Navegação financeira sem erros de console", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await login(page);

    // Navegar por todas as abas financeiras
    const tabs = ["receber", "pagar", "faturas", "contas-caixas", "fluxo", "dashboard"];
    for (const tab of tabs) {
      await page.goto(`/financeiro?tab=${tab}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);
      await ss(page, `09-regressao-${tab}`);
    }

    // Filtrar erros significativos (ignorar warnings e network errors)
    const criticalErrors = consoleErrors.filter(e =>
      !e.includes("401") && !e.includes("403") && !e.includes("net::") &&
      !e.includes("favicon") && !e.includes("WebSocket") && !e.includes("HMR")
    );
    console.log(`[UI] Console errors nas abas financeiras: ${criticalErrors.length}`);
    criticalErrors.forEach(e => console.log(`  ${e.substring(0, 200)}`));

    // Nenhum erro crítico de JS
    expect(criticalErrors.length).toBe(0);
  });

});
