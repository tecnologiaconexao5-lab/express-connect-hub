/**
 * ESCALA-FIN-01.1 — Proteger financeiro_pagar status='parcial' (M66/M80).
 *
 * Estende a guarda FIN-01 de financeiro_pagar para incluir 'parcial', impedindo que
 * M66/M80 reabram valor/status de título com baixa parcial.
 * Comportamento validado por SQL transacional (BEGIN/ROLLBACK) e aplicado em produção.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
const MIG = read("supabase/migrations/20260922000011_escala_fin_01_1_proteger_parcial.sql");
const ROLLBACK = read("supabase/migrations/20260922000012_escala_fin_01_1_rollback.sql");

const body = (sql: string) => sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
const MIG_BODY = body(MIG);

describe("ESCALA-FIN-01.1 — guarda 'parcial'", () => {
  it("protege financeiro_pagar com 'parcial' em M66 e M80", () => {
    expect((MIG_BODY.match(/status NOT IN \('pago','parcial','cancelado','cancelada'\)/g) || []).length).toBe(2);
  });

  it("preserva as demais guardas FIN-01 (receber e pagamentos)", () => {
    expect(MIG_BODY).toContain("financeiro_receber.status NOT IN ('pago','recebido','cancelada')");
    expect(MIG_BODY).toContain("pagamentos_prestadores.status_pagamento NOT IN ('pago','cancelado')");
  });

  it("define SOMENTE M66 e M80 (2 funções)", () => {
    expect((MIG.match(/CREATE OR REPLACE FUNCTION/g) || []).length).toBe(2);
  });

  it("sem ALTER TABLE / DELETE", () => {
    expect(MIG_BODY).not.toMatch(/ALTER\s+TABLE/i);
    expect(MIG_BODY).not.toMatch(/DELETE\s+FROM/i);
  });
});

describe("ESCALA-FIN-01.1 — rollback restaura versão anterior", () => {
  it("rollback NÃO contém a guarda 'parcial'", () => {
    expect(body(ROLLBACK)).not.toContain("'pago','parcial','cancelado','cancelada'");
    expect(body(ROLLBACK)).toContain("'pago','cancelado','cancelada'");
  });
});
