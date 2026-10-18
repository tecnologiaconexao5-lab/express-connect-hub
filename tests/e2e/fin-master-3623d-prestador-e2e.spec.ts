import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const ADMIN_EMAIL = "tamiris.castilho@conexaoexpress.com.br";
const ADMIN_PASSWORD = "Conexao@2026";
const PAGAMENTO_ID = "32fe474f-41c7-432b-a21e-7d0b2831c1bb";
const CORA_UUID = "9741ad36-79a6-4e1f-94a5-512e08758186";
const DB = "postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres";
const SS = "test-results/e2e/fin3623d";

let pg: any;
async function getDb() {
  if (pg) return pg;
  const { Client } = await import("pg");
  pg = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  return pg;
}

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

async function goToManuais(page: Page) {
  await page.goto("/financeiro?tab=pagamento-prestadores", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const tabFM = page.getByRole("tab", { name: /Fechamentos e Pagamentos/i });
  if (await tabFM.isVisible()) { await tabFM.click(); await page.waitForTimeout(1500); }
  // Widen date filter to include Aug 2026
  const dataInicio = page.locator('input[type="date"]').first();
  if (await dataInicio.isVisible().catch(() => false)) {
    await dataInicio.fill("2026-01-01");
    await page.waitForTimeout(500);
    const atualizarBtn = page.getByRole("button", { name: /Atualizar/i });
    if (await atualizarBtn.isVisible().catch(() => false)) {
      await atualizarBtn.click();
      await page.waitForTimeout(2000);
    }
  }
  const tabM = page.getByRole("tab", { name: /Pagamentos Manuais/i });
  if (await tabM.isVisible()) { await tabM.click(); await page.waitForTimeout(2000); }
}

test.describe("FIN-362.3D — CONFIRMAR PAGAMENTO PRESTADOR", () => {
  test.afterAll(async () => { if (pg) await pg.end(); });

  test("PASSO 1 — Snapshot ANTES + localizar linha", async ({ page }) => {
    const c = await getDb();
    const r = await c.query(
      `SELECT status_pagamento, status_conferencia, valor_liquido, data_pagamento, status
       FROM pagamentos_prestadores WHERE id = $1`, [PAGAMENTO_ID]
    );
    expect(r.rows.length).toBe(1);
    console.log(`ANTES: status=${r.rows[0].status}, stat_pag=${r.rows[0].status_pagamento}, conf=${r.rows[0].status_conferencia}, valor=${r.rows[0].valor_liquido}`);
    expect(r.rows[0].status_pagamento).toBe("pendente");
    expect(r.rows[0].status_conferencia).toBe("conferido");

    await login(page);
    await goToManuais(page);
    await ss(page, "p1-manuais");

    // Row filter: CESAR + "Conferido" (unique to 32fe474f among CESAR rows)
    const row = page.locator("tr").filter({ hasText: "CESAR" }).filter({ hasText: "Conferido" }).filter({ hasText: "Pendente" });
    const cnt = await row.count();
    console.log(`Rows with CESAR+Conferido+Pendente: ${cnt}`);
    expect(cnt).toBeGreaterThanOrEqual(1);

    // Verify "Marcar Pago" button exists in this row
    const pagoBtn = row.first().locator('button[title="Marcar Pago"]');
    const vis = await pagoBtn.isVisible().catch(() => false);
    console.log(`Marcar Pago visible: ${vis}`);
  });

  test("PASSO 2 — Clicar Marcar Pago", async ({ page }) => {
    await login(page);
    await goToManuais(page);

    const row = page.locator("tr").filter({ hasText: "CESAR" }).filter({ hasText: "Conferido" }).filter({ hasText: "Pendente" });
    expect(await row.count()).toBeGreaterThanOrEqual(1);

    await ss(page, "p2-antes-click");

    const pagoBtn = row.first().locator('button[title="Marcar Pago"]');
    await expect(pagoBtn).toBeVisible({ timeout: 10000 });
    await pagoBtn.click();
    await page.waitForTimeout(3000);

    await ss(page, "p2-apos-click");

    // Verify toast success
    const toast = page.locator("text=Marcado como pago").first();
    const hasToast = await toast.isVisible().catch(() => false);
    console.log(`Toast "Marcado como pago": ${hasToast}`);
  });

  test("PASSO 3 — Verificar pagamento = pago no DB", async ({ page }) => {
    const c = await getDb();
    const r = await c.query(
      `SELECT status_pagamento, status, data_pagamento
       FROM pagamentos_prestadores WHERE id = $1`, [PAGAMENTO_ID]
    );
    const row = r.rows[0];
    console.log(`DEPOIS: status_pag=${row.status_pagamento}, status=${row.status}, data_pag=${row.data_pagamento}`);
    expect(row.status_pagamento).toBe("pago");
    expect(row.data_pagamento).toBeTruthy();
  });

  test("PASSO 4 — Verificar financeiro_baixas com conta_financeira_id CORA", async ({ page }) => {
    const c = await getDb();
    // Baixa is created via RPC or INSERT — check by payment ID in observacao
    const bx = await c.query(
      `SELECT id, titulo_tabela, valor_baixado, conta_financeira, conta_financeira_id, data_baixa, observacao
       FROM financeiro_baixas
       WHERE observacao LIKE $1
       ORDER BY created_at DESC LIMIT 3`,
      [`%${PAGAMENTO_ID.slice(0, 8)}%`]
    );
    console.log(`financeiro_baixas for payment: ${bx.rows.length}`);

    if (bx.rows.length > 0) {
      const b = bx.rows[0];
      console.log(`  id=${b.id.slice(0,8)} valor=${b.valor_baixado} conta=${b.conta_financeira} conta_id=${b.conta_financeira_id}`);
      expect(b.conta_financeira_id).toBeTruthy();
      expect(b.conta_financeira_id).toBe(CORA_UUID);
      expect(b.conta_financeira).toBe("Cora");
      expect(Number(b.valor_baixado)).toBeGreaterThan(0);
    } else {
      console.log("No baixa found — checking if RPC was used...");
      // RPC baixas use titulo_id pointing to financeiro_pagar
      const fp = await c.query(
        `SELECT id, valor, status FROM financeiro_pagar WHERE id = $1`,
        ['9f2be89f-5ece-4cc5-be29-50010b64e64e']
      );
      if (fp.rows.length > 0) {
        console.log(`  financeiro_pagar: status=${fp.rows[0].status}, valor=${fp.rows[0].valor}`);
      }
    }
  });

  test("PASSO 5 — Fluxo de Caixa reflete movimento Cora", async ({ page }) => {
    const c = await getDb();
    const r = await c.query(
      `SELECT COUNT(*) as cnt, SUM(valor_baixado) as total
       FROM financeiro_baixas
       WHERE conta_financeira_id = $1 AND data_baixa = CURRENT_DATE`,
      [CORA_UUID]
    );
    console.log(`Fluxo Cora today: ${r.rows[0].cnt} entries, total R$${r.rows[0].total}`);
    expect(Number(r.rows[0].cnt)).toBeGreaterThan(0);

    await login(page);
    await page.goto("/financeiro?tab=fluxo", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    await ss(page, "p5-fluxo");
  });

  test("PASSO 6 — DRE mostra despesa de prestador", async ({ page }) => {
    const c = await getDb();
    const r = await c.query(
      `SELECT COUNT(*) as cnt FROM financeiro_baixas
       WHERE conta_financeira_id = $1 AND data_baixa = CURRENT_DATE`,
      [CORA_UUID]
    );
    console.log(`DRE: ${r.rows[0].cnt} baixas today for Cora`);
    expect(Number(r.rows[0].cnt)).toBeGreaterThan(0);

    await login(page);
    await page.goto("/financeiro?tab=dre", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    await ss(page, "p6-dre");
  });

  test("PASSO 7 — Zero dupla contagem", async ({ page }) => {
    const c = await getDb();

    // Baixas for this payment (by observacao or titulo_id)
    const bx = await c.query(
      `SELECT COUNT(*) as cnt, SUM(valor_baixado) as total
       FROM financeiro_baixas
       WHERE observacao LIKE $1 OR titulo_id = $2`,
      [`%${PAGAMENTO_ID.slice(0, 8)}%`, PAGAMENTO_ID]
    );
    console.log(`Baixas for this payment: ${bx.rows[0].cnt}, total R$${bx.rows[0].total}`);

    // New financeiro_pagar entries (should be 0)
    const pgResult = await c.query(
      `SELECT COUNT(*) as cnt FROM financeiro_pagar
       WHERE observacoes LIKE $1 OR descricao LIKE $1`,
      [`%${PAGAMENTO_ID.slice(0, 8)}%`]
    );
    console.log(`New financeiro_pagar: ${pgResult.rows[0].cnt}`);
    expect(Number(pgResult.rows[0].cnt)).toBe(0);

    // Summary
    const totalBx = await c.query(
      `SELECT COUNT(*) as cnt, SUM(valor_baixado) as total
       FROM financeiro_baixas WHERE conta_financeira_id = $1 AND data_baixa = CURRENT_DATE`,
      [CORA_UUID]
    );
    console.log(`Total baixas Cora today: ${totalBx.rows[0].cnt} entries, total R$${totalBx.rows[0].total}`);

    expect(Number(bx.rows[0].cnt)).toBeGreaterThanOrEqual(1);
  });
});
