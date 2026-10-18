/**
 * ESCALA-FIN-01 — Proteção de títulos financeiros FECHADOS (M66/M80).
 *
 * Edições posteriores da Escala/OS não podem sobrescrever o VALOR de títulos
 * pagos/recebidos/cancelados. Títulos abertos continuam recalculando.
 *
 * Comportamento validado por SQL transacional (BEGIN/ROLLBACK) e aplicado em produção.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
const MIG = read("supabase/migrations/20260922000004_escala_fin_01_proteger_titulos_fechados.sql");
const ROLLBACK = read("supabase/migrations/20260922000005_escala_fin_01_rollback.sql");

const body = (sql: string) => sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
const MIG_BODY = body(MIG);

describe("ESCALA-FIN-01 — guardas de títulos fechados", () => {
  it("protege financeiro_receber (pago/recebido/cancelada) em M66 e M80", () => {
    expect((MIG_BODY.match(/financeiro_receber\.status NOT IN \('pago','recebido','cancelada'\)/g) || []).length).toBe(1);
    expect((MIG_BODY.match(/status NOT IN \('pago','recebido','cancelada'\)/g) || []).length).toBe(2);
  });

  it("protege financeiro_pagar (pago/cancelado/cancelada) em M66 e M80", () => {
    expect((MIG_BODY.match(/financeiro_pagar\.status NOT IN \('pago','cancelado','cancelada'\)/g) || []).length).toBe(1);
    expect((MIG_BODY.match(/status NOT IN \('pago','cancelado','cancelada'\)/g) || []).length).toBe(2);
  });

  it("protege pagamentos_prestadores (status_pagamento pago/cancelado) em M66 e M80", () => {
    expect((MIG_BODY.match(/status_pagamento NOT IN \('pago','cancelado'\)/g) || []).length).toBe(2);
  });

  it("define SOMENTE M66 e M80 (2 funções)", () => {
    expect((MIG.match(/CREATE OR REPLACE FUNCTION/g) || []).length).toBe(2);
  });

  it("sem ALTER TABLE / DELETE (sem saneamento histórico)", () => {
    expect(MIG_BODY).not.toMatch(/ALTER\s+TABLE/i);
    expect(MIG_BODY).not.toMatch(/DELETE\s+FROM/i);
  });
});

describe("ESCALA-FIN-01 — rollback restaura versão anterior", () => {
  it("rollback NÃO contém as guardas de status", () => {
    const rb = body(ROLLBACK);
    expect(rb).not.toContain("status NOT IN ('pago','recebido','cancelada')");
    expect(rb).not.toContain("status NOT IN ('pago','cancelado','cancelada')");
    expect(rb).not.toContain("status_pagamento NOT IN ('pago','cancelado')");
  });
  it("rollback define as duas funções", () => {
    expect((ROLLBACK.match(/CREATE OR REPLACE FUNCTION/g) || []).length).toBe(2);
  });
});
