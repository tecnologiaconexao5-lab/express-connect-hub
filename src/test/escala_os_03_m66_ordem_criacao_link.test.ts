/**
 * ESCALA-OS-03 — M66: criar/upsert da OS ANTES de gravar o link (FK imediata).
 *
 * Corrige a FK violation ao processar alocação sem ordem_servico_id, movendo o
 * UPDATE de alocacoes_escala.ordem_servico_id para DEPOIS do INSERT/upsert da OS.
 * Preserva idempotência (ON CONFLICT id), atomicidade (RAISE), cancel E2E-03 e FIN-01.
 *
 * Comportamento validado por SQL transacional (BEGIN/ROLLBACK) e aplicado em produção.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
const MIG = read("supabase/migrations/20260922000007_escala_os_03_m66_ordem_criacao_link.sql");
const ROLLBACK = read("supabase/migrations/20260922000008_escala_os_03_rollback.sql");

describe("ESCALA-OS-03 — ordem criação→link no M66", () => {
  it("INSERT da OS ocorre ANTES do UPDATE de link", () => {
    const iOs = MIG.indexOf("INSERT INTO ordens_servico");
    const iLink = MIG.indexOf("SET ordem_servico_id = v_os_id");
    expect(iOs).toBeGreaterThan(-1);
    expect(iLink).toBeGreaterThan(-1);
    expect(iOs).toBeLessThan(iLink);
  });

  it("preserva idempotência da OS (ON CONFLICT (id) DO UPDATE)", () => {
    expect(MIG).toContain("ON CONFLICT (id) DO UPDATE");
  });

  it("preserva atomicidade E2E-05 (RAISE, sem THEN NULL)", () => {
    expect(MIG).toContain("EXCEPTION WHEN OTHERS THEN RAISE; END;");
    expect((MIG.match(/THEN NULL/g) || []).length).toBe(0);
  });

  it("preserva as guardas FIN-01 (títulos fechados)", () => {
    expect(MIG).toContain("financeiro_receber.status NOT IN ('pago','recebido','cancelada')");
    expect(MIG).toContain("financeiro_pagar.status NOT IN ('pago','cancelado','cancelada')");
    expect(MIG).toContain("pagamentos_prestadores.status_pagamento NOT IN ('pago','cancelado')");
  });

  it("define SOMENTE M66 (1 função)", () => {
    expect((MIG.match(/CREATE OR REPLACE FUNCTION/g) || []).length).toBe(1);
  });
});

describe("ESCALA-OS-03 — rollback restaura a ordem anterior", () => {
  it("no rollback, o UPDATE de link volta a vir ANTES do INSERT da OS", () => {
    const iOs = ROLLBACK.indexOf("INSERT INTO ordens_servico");
    const iLink = ROLLBACK.indexOf("SET ordem_servico_id = v_os_id");
    expect(iLink).toBeGreaterThan(-1);
    expect(iOs).toBeGreaterThan(-1);
    expect(iLink).toBeLessThan(iOs);
  });
});
