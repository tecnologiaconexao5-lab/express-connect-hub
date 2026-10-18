import { test, expect, type Page } from "@playwright/test";
import dotenv from "dotenv";
import * as fs from "node:fs";
import * as path from "node:path";
import { Client } from "pg";
import { loginAdmin } from "./helpers/auth";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const POSITIVE_PAYMENT_ID = "7bf3107d-d14c-47a6-a45c-3eeb52412c59";
const POSITIVE_TITLE_ID = "6f871e9f-764b-4df7-a8f9-349d6f960fed";
const FAILURE_PAYMENT_ID = "a2b2e3c7-4abe-495c-80ff-d4d10cb85e5a";
const CORA_ID = "9741ad36-79a6-4e1f-94a5-512e08758186";
const SCREENSHOT_DIR = "test-results/e2e/fin3623e";

let db: Client;

async function query<T = Record<string, unknown>>(sql: string, values: unknown[] = []): Promise<T[]> {
  const result = await db.query(sql, values);
  return result.rows as T[];
}

async function screenshot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: false });
}

async function openPayments(page: Page) {
  await page.goto("/financeiro?tab=pagamento-prestadores", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const parentTab = page.getByRole("tab", { name: /Fechamentos e Pagamentos/i });
  if (await parentTab.isVisible().catch(() => false)) await parentTab.click();
  await page.waitForTimeout(1000);
}

test.describe("FIN-362.3E - consistencia e atomicidade", () => {
  test.beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL ausente");
    db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await db.connect();
  });

  test.afterAll(async () => {
    await db?.end();
  });

  test("pagamento com OS liquida titulo exato e confirma na UI", async ({ page }) => {
    const beforePayment = await query<{ status: string; status_pagamento: string; valor_liquido: string }>(
      "SELECT status, status_pagamento, valor_liquido FROM pagamentos_prestadores WHERE id = $1",
      [POSITIVE_PAYMENT_ID]
    );
    const beforeTitle = await query<{ status: string; valor: string; os_id: string }>(
      "SELECT status, valor, os_id FROM financeiro_pagar WHERE id = $1",
      [POSITIVE_TITLE_ID]
    );
    const beforeBajas = await query<{ count: number }>(
      "SELECT count(*)::int AS count FROM financeiro_baixas WHERE titulo_id = $1 AND NOT estornada",
      [POSITIVE_TITLE_ID]
    );

    expect(beforePayment[0]).toMatchObject({ status: "pendente", status_pagamento: "nao_vencido", valor_liquido: "520.00" });
    expect(beforeTitle[0]).toMatchObject({ status: "pendente", valor: "520.00", os_id: "ae30da69-1d16-4600-a27d-edfa073ef239" });
    expect(beforeBajas[0]?.count).toBe(0);

    await loginAdmin(page, "fin3623e-positive");
    await openPayments(page);
    await page.getByRole("tab", { name: "Fechamentos Anteriores" }).click();
    await page.waitForTimeout(1200);

    const row = page.locator("tr")
      .filter({ hasText: "CESAR AUGUSTO HOLANDA SILVA" })
      .filter({ hasText: "2026-08-28" })
      .filter({ hasText: "R$ 520,00" });
    await expect(row).toHaveCount(1);
    await screenshot(page, "positive-before");

    await row.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText("Liberação com Justificativa")).toBeVisible();
    await page.locator("textarea").fill("FIN-362.3E conciliacao explicita por OS e valor integral");
    await page.getByRole("button", { name: /Liberar com Justificativa/i }).click();
    await expect(page.getByText(/Status atualizado|Pagamento confirmado/i).first()).toBeVisible({ timeout: 15000 });
    await screenshot(page, "positive-after");

    const afterPayment = await query<{ status: string; status_pagamento: string; data_pagamento: string }>(
      "SELECT status, status_pagamento, data_pagamento FROM pagamentos_prestadores WHERE id = $1",
      [POSITIVE_PAYMENT_ID]
    );
    const afterTitle = await query<{ status: string; data_pagamento: string; conta_pagadora: string }>(
      "SELECT status, data_pagamento, conta_pagadora FROM financeiro_pagar WHERE id = $1",
      [POSITIVE_TITLE_ID]
    );
    const bajas = await query<{ id: string; valor_baixado: string; saldo_restante: string; conta_financeira_id: string; estornada: boolean }>(
      "SELECT id, valor_baixado, saldo_restante, conta_financeira_id, estornada FROM financeiro_baixas WHERE titulo_id = $1 ORDER BY created_at DESC",
      [POSITIVE_TITLE_ID]
    );

    expect(afterPayment[0]?.status_pagamento).toBe("pago");
    expect(afterPayment[0]?.status).toBe("pago");
    expect(afterPayment[0]?.data_pagamento).toBeTruthy();
    expect(afterTitle[0]).toMatchObject({ status: "pago", conta_pagadora: "Cora" });
    expect(bajas).toHaveLength(1);
    expect(Number(bajas[0].valor_baixado)).toBe(520);
    expect(Number(bajas[0].saldo_restante)).toBe(0);
    expect(bajas[0].conta_financeira_id).toBe(CORA_ID);
    expect(bajas[0].estornada).toBe(false);
  });

  test("falha sem titulo coerente nao confirma pagamento", async ({ page }) => {
    const before = await query<{ status: string; status_pagamento: string; valor_liquido: string }>(
      "SELECT status, status_pagamento, valor_liquido FROM pagamentos_prestadores WHERE id = $1",
      [FAILURE_PAYMENT_ID]
    );
    const beforeBajas = await query<{ count: number }>(
      "SELECT count(*)::int AS count FROM financeiro_baixas WHERE observacao LIKE $1",
      [`%${FAILURE_PAYMENT_ID.slice(0, 8)}%`]
    );
    expect(before[0]).toMatchObject({ status: "pendente", status_pagamento: "pendente", valor_liquido: "3150.34" });
    expect(beforeBajas[0]?.count).toBe(0);

    await loginAdmin(page, "fin3623e-failure");
    await openPayments(page);
    await page.getByRole("tab", { name: "Pagamentos Manuais" }).click();
    await page.waitForTimeout(1200);

    const row = page.locator("tr")
      .filter({ hasText: "CESAR AUGUSTO HOLANDA SILVA" })
      .filter({ hasText: "R$ 3.150,34" })
      .filter({ hasText: "Pendente" });
    await expect(row).toHaveCount(1);
    await row.locator('button[title="Marcar Conferido"]').click();
    await page.waitForTimeout(1200);

    const readyRow = page.locator("tr")
      .filter({ hasText: "CESAR AUGUSTO HOLANDA SILVA" })
      .filter({ hasText: "R$ 3.150,34" })
      .filter({ hasText: "Conferido" });
    await expect(readyRow).toHaveCount(1);
    await readyRow.locator('button[title="Marcar Pago"]').click();
    await expect(page.getByText(/Erro:.*titulo financeiro|Erro:.*titulo/i).first()).toBeVisible({ timeout: 15000 });
    await screenshot(page, "failure-no-title");

    const after = await query<{ status: string; status_pagamento: string; data_pagamento: string | null }>(
      "SELECT status, status_pagamento, data_pagamento FROM pagamentos_prestadores WHERE id = $1",
      [FAILURE_PAYMENT_ID]
    );
    const afterBajas = await query<{ count: number }>(
      "SELECT count(*)::int AS count FROM financeiro_baixas WHERE observacao LIKE $1",
      [`%${FAILURE_PAYMENT_ID.slice(0, 8)}%`]
    );
    expect(after[0]).toMatchObject({ status: "pendente", status_pagamento: "pendente", data_pagamento: null });
    expect(afterBajas[0]?.count).toBe(0);
  });
});
