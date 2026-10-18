import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ============================================================================
// AG-07F — GATE ÚNICO DE ELEGIBILIDADE OPERACIONAL / ESCALA
// Cenários: status, liberado_app, alocação direta, RPC do App.
// ============================================================================

const dbRef = vi.hoisted(() => ({
  prestadores: [] as Record<string, unknown>[],
  alocacoes_escala: [] as Record<string, unknown>[],
  veiculos: [] as Record<string, unknown>[],
}));

interface Builder {
  select: () => Builder;
  eq: () => Builder;
  in: () => Builder;
  neq: () => Builder;
  gte: () => Builder;
  lte: () => Builder;
  or: () => Builder;
  ilike: () => Builder;
  order: () => Builder;
  limit: () => Builder;
  range: () => Builder;
  insert: () => Builder;
  delete: () => Builder;
  maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: null }>;
  single: () => Promise<{ data: Record<string, unknown> | null; error: null }>;
  then: (resolve: (r: { data: Record<string, unknown>[]; count: number; error: null }) => unknown) => unknown;
}

const makeBuilder = (tabela: string): Builder => {
  const b = {} as Builder;
  for (const m of ["select", "eq", "in", "neq", "gte", "lte", "or", "ilike", "order", "limit", "range", "insert", "delete"]) {
    (b as unknown as Record<string, unknown>)[m] = () => b;
  }
  b.maybeSingle = async () => ({ data: (dbRef as Record<string, unknown>)[tabela]?.[0] || null, error: null });
  b.single = async () => ({ data: (dbRef as Record<string, unknown>)[tabela]?.[0] || null, error: null });
  b.then = (resolve) =>
    resolve({
      data: ((dbRef as Record<string, unknown>)[tabela] as Record<string, unknown>[]) || [],
      count: ((dbRef as Record<string, unknown>)[tabela] as Record<string, unknown>[])?.length || 0,
      error: null,
    });
  return b;
};

vi.mock("@/lib/supabase", () => ({
  supabase: { from: (t: string) => makeBuilder(t) },
}));

import {
  prestadorOperacionalmenteElegivelDados,
  verificarElegibilidadeOperacionalPrestador,
  verificarElegibilidadeVeiculo,
} from "@/services/escala/eligibilidadeOperacionalService";
import { criarAlocacao } from "@/services/escala/escalaService";

describe("AG-07F — Regra pura de elegibilidade (prestadorOperacionalmenteElegivelDados)", () => {
  it("A) ativo + liberado_app=true → elegível", () => {
    expect(prestadorOperacionalmenteElegivelDados({ status: "ativo", liberado_app: true }).elegivel).toBe(true);
    expect(prestadorOperacionalmenteElegivelDados({ status: "aprovado", liberado_app: true }).elegivel).toBe(true);
  });

  it("B) em_analise → bloqueado", () => {
    const r = prestadorOperacionalmenteElegivelDados({ status: "em_analise", liberado_app: false });
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("status_nao_autorizado");
  });

  it("C) bloqueado → bloqueado", () => {
    expect(prestadorOperacionalmenteElegivelDados({ status: "bloqueado", liberado_app: false }).elegivel).toBe(false);
  });

  it("D) inativo → bloqueado", () => {
    expect(prestadorOperacionalmenteElegivelDados({ status: "inativo", liberado_app: false }).elegivel).toBe(false);
  });

  it("E) reprovado → bloqueado", () => {
    expect(prestadorOperacionalmenteElegivelDados({ status: "reprovado", liberado_app: false }).elegivel).toBe(false);
  });

  it("F) ativo mas liberado_app=false → comportamento coerente: bloqueado", () => {
    const r = prestadorOperacionalmenteElegivelDados({ status: "ativo", liberado_app: false });
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("liberado_app_false");
  });

  it("G) prestador inexistente/sem dados → bloqueado", () => {
    const r = prestadorOperacionalmenteElegivelDados(null as unknown as Record<string, unknown>);
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("prestador_nao_encontrado");
  });

  it("regressão: prestador ativo válido (ativo + liberado_app=true) → permitido", () => {
    expect(prestadorOperacionalmenteElegivelDados({ status: "ativo", liberado_app: true }).elegivel).toBe(true);
  });
});

describe("AG-07F — verificarElegibilidadeOperacionalPrestador (backend)", () => {
  const PREST = "11111111-1111-4111-8111-111111111111";

  it("prestador inexistente → bloqueado", async () => {
    dbRef.prestadores = [];
    const r = await verificarElegibilidadeOperacionalPrestador(PREST);
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("prestador_nao_encontrado");
  });

  it("em_analise → bloqueado", async () => {
    dbRef.prestadores = [{ id: PREST, status: "em_analise", liberado_app: false, cnh_validade: null }];
    expect((await verificarElegibilidadeOperacionalPrestador(PREST)).elegivel).toBe(false);
  });

  it("ativo + liberado_app=false → bloqueado (coerente)", async () => {
    dbRef.prestadores = [{ id: PREST, status: "ativo", liberado_app: false, cnh_validade: null }];
    expect((await verificarElegibilidadeOperacionalPrestador(PREST)).elegivel).toBe(false);
  });

  it("ativo + liberado_app=true → elegível", async () => {
    dbRef.prestadores = [{ id: PREST, status: "ativo", liberado_app: true, cnh_validade: null }];
    expect((await verificarElegibilidadeOperacionalPrestador(PREST)).elegivel).toBe(true);
  });
});

describe("AG-07F — Proteção da Escala (criarAlocacao, chamada direta ao backend)", () => {
  const base = { data_escala: "2026-08-16", tipo_veiculo: "moto" };

  it("prestador em_analise → alocação BLOQUEADA (não depende do Select da UI)", async () => {
    dbRef.prestadores = [{ status: "em_analise", liberado_app: false, cnh_validade: null }];
    dbRef.alocacoes_escala = [];
    const r = await criarAlocacao({ ...base, prestador_id: "prest-analise" });
    expect(r.sucesso).toBe(false);
    expect(String(r.erro).toLowerCase()).toContain("elegí");
  });

  it("prestador bloqueado → alocação BLOQUEADA", async () => {
    dbRef.prestadores = [{ status: "bloqueado", liberado_app: false, cnh_validade: null }];
    dbRef.alocacoes_escala = [];
    const r = await criarAlocacao({ ...base, prestador_id: "prest-bloq" });
    expect(r.sucesso).toBe(false);
  });

  it("prestador ativo + liberado_app=true → alocação permitida (regressão)", async () => {
    dbRef.prestadores = [{ status: "ativo", liberado_app: true, cnh_validade: null }];
    dbRef.alocacoes_escala = [];
    const r = await criarAlocacao({ ...base, prestador_id: "prest-ok" });
    // chegou ao INSERT (sucesso true) — sem conflito e gate liberado
    expect(r.sucesso).toBe(true);
  });

  it("veículo em manutenção → alocação BLOQUEADA", async () => {
    dbRef.prestadores = [{ status: "ativo", liberado_app: true, cnh_validade: null }];
    dbRef.alocacoes_escala = [];
    dbRef.veiculos = [{ placa: "ABC-1234", status: "manutencao" }];
    const r = await criarAlocacao({ ...base, prestador_id: "prest-ok", placa: "ABC-1234" });
    expect(r.sucesso).toBe(false);
    expect(String(r.erro).toLowerCase()).toContain("veículo");
  });
});

describe("AG-07F — Busca de operações do App (f_buscar_operacoes_motorista)", () => {
  it("migration do gate filtra status autorizado + liberado_app=true", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase", "migrations", "20260822_ag07f_gate_elegibilidade_operacional.sql"),
      "utf8"
    );
    expect(sql).toContain("liberado_app = true");
    expect(sql).toContain("lower(coalesce(p.status, '')) IN ('ativo', 'aprovado')");
    expect(sql).toContain("f_buscar_operacoes_motorista");
  });
});
