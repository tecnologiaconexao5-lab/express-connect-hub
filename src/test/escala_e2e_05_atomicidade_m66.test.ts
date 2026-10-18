/**
 * ESCALA-E2E-05 — Atomicidade do M66 (f_trg_propagar_financeiro_alocacao).
 *
 * Remove o mascaramento de falhas: as 5 etapas (OS, receber, pagar, pagamentos,
 * composição) e o handler externo passam a PROPAGAR erro (RAISE) → rollback atômico.
 * Preserva fallbacks de SELECT STRICT, IFs, ON CONFLICT/PERFORM+IF e o E2E-03.
 *
 * Comportamento validado por SQL transacional (BEGIN/ROLLBACK) e aplicado em produção.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
const MIG = read("supabase/migrations/20260922000002_escala_e2e_05_atomicidade_m66.sql");
const ROLLBACK = read("supabase/migrations/20260922000003_escala_e2e_05_rollback.sql");

// Corpo SQL sem os comentários de cabeçalho
const body = (sql: string) => sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
const MIG_BODY = body(MIG);

describe("ESCALA-E2E-05 — M66 propaga falhas (sem mascaramento)", () => {
  it("remove todos os THEN NULL internos", () => {
    expect((MIG_BODY.match(/THEN NULL/g) || []).length).toBe(0);
  });

  it("as 5 etapas re-levantam o erro (RAISE)", () => {
    expect((MIG_BODY.match(/EXCEPTION WHEN OTHERS THEN RAISE; END;/g) || []).length).toBe(5);
  });

  it("handler externo propaga (RAISE), sem RAISE WARNING/RETURN NEW", () => {
    expect(MIG_BODY).not.toContain("RAISE WARNING");
    expect(MIG_BODY).not.toContain("GET STACKED DIAGNOSTICS v_error_msg");
    expect(/\n\s+RAISE;\n\s+END;\nEND;/.test(MIG_BODY)).toBe(true);
  });

  it("preserva fallbacks de SELECT STRICT (cliente/prestador)", () => {
    expect((MIG_BODY.match(/INTO STRICT/g) || []).length).toBe(2);
  });

  it("preserva idempotência (ON CONFLICT)", () => {
    expect(MIG_BODY).toContain("ON CONFLICT (id) DO UPDATE");
    expect(MIG_BODY).toContain("ON CONFLICT (os_id) DO UPDATE");
  });

  it("define SOMENTE a função M66 (não altera M80 nem a cancel E2E-03)", () => {
    expect((MIG.match(/CREATE OR REPLACE FUNCTION/g) || []).length).toBe(1);
    expect(MIG).toContain("FUNCTION public.f_trg_propagar_financeiro_alocacao");
  });
});

describe("ESCALA-E2E-05 — rollback restaura a versão anterior", () => {
  it("volta a ter os 5 THEN NULL e o handler externo com RAISE WARNING", () => {
    expect((ROLLBACK.match(/EXCEPTION WHEN OTHERS THEN NULL; END;/g) || []).length).toBe(5);
    expect(ROLLBACK).toContain("RAISE WARNING '[M108F]");
  });
});
