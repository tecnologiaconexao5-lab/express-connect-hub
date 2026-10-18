/**
 * ESCALA-E2E-03 — Cancelamento OS coerente com Alocação e Financeiro.
 *
 * Corrige: ao cancelar a alocação, a OS vinculada (ordem_servico_id) passa a ser
 * cancelada também, mantendo ALOCACAO + OS + FINANCEIRO coerentes.
 * Idempotente, sem DELETE, sem criar nova OS, sem tocar M66/M80.
 *
 * O comportamento real foi validado por SQL transacional (BEGIN/ROLLBACK) e
 * aplicado em produção via migration. Aqui validamos o CONTEÚDO da migration.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const MIGRATION = read("supabase/migrations/20260922000000_escala_e2e_03_cancelamento_os_coerente.sql");
const ROLLBACK = read("supabase/migrations/20260922000001_escala_e2e_03_rollback.sql");

describe("ESCALA-E2E-03 — cancelamento da OS vinculada", () => {
  it("migration cancela a MESMA OS (por ordem_servico_id), sem criar nova OS", () => {
    expect(MIGRATION).toContain("UPDATE public.ordens_servico");
    expect(MIGRATION).toContain("SET status = 'cancelada'");
    expect(MIGRATION).toContain("WHERE id = NEW.ordem_servico_id");
    expect(MIGRATION).toContain("IF NEW.ordem_servico_id IS NOT NULL THEN");
    expect(MIGRATION).not.toMatch(/INSERT INTO public\.ordens_servico/i);
  });

  it("é idempotente (só cancela se ainda não cancelada)", () => {
    expect(MIGRATION).toContain("AND status IS DISTINCT FROM 'cancelada'");
    expect(MIGRATION).toContain("IF OLD.status = 'cancelada' THEN");
  });

  it("preserva proteção de títulos pagos/recebidos", () => {
    expect(MIGRATION).toContain("status NOT IN ('pago', 'recebido', 'cancelada')");
    expect(MIGRATION).toContain("status NOT IN ('pago', 'cancelada')");
  });

  it("não faz DELETE nem altera M66/M80", () => {
    expect(MIGRATION).not.toMatch(/DELETE\s+FROM/i);
    expect(MIGRATION).not.toContain("f_trg_propagar_financeiro_alocacao");
    expect(MIGRATION).not.toContain("f_trg_propagar_financeiro_os");
  });

  it("rollback restaura a função SEM o cancelamento da OS", () => {
    expect(ROLLBACK).toContain("f_trg_cancelar_financeiro_alocacao");
    expect(ROLLBACK).not.toContain("UPDATE public.ordens_servico");
    expect(ROLLBACK).toContain("v_updated_receber");
  });
});
