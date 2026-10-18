import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// AG-07H — DOCUMENTOS, VALIDADES E BLOQUEIOS OPERACIONAIS
// Cenários A–N.
// ============================================================================

const dbRef = vi.hoisted(() => ({
  prestadores: [] as Record<string, unknown>[],
  documentos_prestadores: [] as Record<string, unknown>[],
  alocacoes_escala: [] as Record<string, unknown>[],
  alocacoes_escala_insercoes: [] as Record<string, unknown>[],
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
  update: () => Builder;
  delete: () => Builder;
  maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: null }>;
  single: () => Promise<{ data: Record<string, unknown> | null; error: null }>;
  then: (resolve: (r: { data: Record<string, unknown>[]; count: number; error: null }) => unknown) => unknown;
}

const makeBuilder = (tabela: string): Builder => {
  const b = {} as Builder;
  for (const m of ["select", "eq", "in", "neq", "gte", "lte", "or", "ilike", "order", "limit", "range", "insert", "update", "delete"]) {
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
  supabase: {
    from: (t: string) => {
      const b = makeBuilder(t);
      (b as unknown as Record<string, unknown>).insert = (payload: Record<string, unknown>) => {
        if (t === "alocacoes_escala") (dbRef.alocacoes_escala_insercoes as Record<string, unknown>[]).push(payload);
        return b;
      };
      return b;
    },
  },
}));

import {
  prestadorDocumentalmenteElegivel,
  documentoBloqueia,
  documentoVencido,
  prestadorOperacionalmenteElegivelDados,
} from "@/services/escala/eligibilidadeOperacionalService";
import { criarAlocacao } from "@/services/escala/escalaService";

beforeEach(() => {
  dbRef.prestadores = [];
  dbRef.documentos_prestadores = [];
  dbRef.alocacoes_escala = [];
  dbRef.alocacoes_escala_insercoes = [];
  dbRef.veiculos = [];
});

const cnhValida = { tipo: "CNH Frente", status: "valido", validade: "2035-01-01" };
const cnhPendente = { tipo: "CNH Frente", status: "pendente", validade: "2035-01-01" };
const cnhRejeitada = { tipo: "CNH Frente", status: "reprovado", validade: "2035-01-01" };
const cnhVencida = { tipo: "CNH Frente", status: "valido", validade: "2020-01-01" };
const cnhVencendo = { tipo: "CNH Frente", status: "valido", validade: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10) };
const comprovante = { tipo: "Comprovante de Residência", status: "valido", validade: null };

describe("AG-07H — Regra pura documental", () => {
  it("A) documentação completa → elegível", () => {
    expect(prestadorDocumentalmenteElegivel([cnhValida, comprovante]).elegivel).toBe(true);
  });

  it("B) CNH pendente → bloqueia", () => {
    const r = prestadorDocumentalmenteElegivel([cnhPendente, comprovante]);
    expect(r.elegivel).toBe(false);
  });

  it("C) CNH rejeitada → bloqueia", () => {
    expect(prestadorDocumentalmenteElegivel([cnhRejeitada, comprovante]).elegivel).toBe(false);
  });

  it("D) CNH vencida → bloqueia", () => {
    const r = prestadorDocumentalmenteElegivel([cnhVencida, comprovante]);
    expect(r.elegivel).toBe(false);
  });

  it("E) CNH válida → permite (com comprovante)", () => {
    expect(prestadorDocumentalmenteElegivel([cnhValida, comprovante]).elegivel).toBe(true);
  });

  it("F) documento obrigatório faltante → bloqueia", () => {
    // participa do fluxo (tem CNH) mas falta comprovante de residência
    expect(prestadorDocumentalmenteElegivel([cnhValida]).elegivel).toBe(false);
  });

  it("F2) prestador sem nenhum documento → ELEGÍVEL (legado, fail-open)", () => {
    expect(prestadorDocumentalmenteElegivel([]).elegivel).toBe(true);
  });

  it("G) documento opcional faltante → NÃO bloqueia", () => {
    expect(prestadorDocumentalmenteElegivel([cnhValida, comprovante, { tipo: "ANTT", status: "pendente" }]).elegivel).toBe(true);
  });

  it("H) ANTT ausente → NÃO bloqueia (não aplicável por padrão)", () => {
    expect(prestadorDocumentalmenteElegivel([cnhValida, comprovante]).elegivel).toBe(true);
  });

  it("I) documento vencendo em breve → alerta (não bloqueia)", () => {
    expect(prestadorDocumentalmenteElegivel([cnhVencendo, comprovante]).elegivel).toBe(true);
  });

  it("documentoBloqueia/vencido: classificações", () => {
    expect(documentoBloqueia("reprovado")).toBe(true);
    expect(documentoBloqueia("vencido")).toBe(true);
    expect(documentoBloqueia("pendente")).toBe(true);
    expect(documentoBloqueia("valido")).toBe(false);
    expect(documentoBloqueia("aprovado")).toBe(false);
    expect(documentoVencido("2020-01-01")).toBe(true);
    expect(documentoVencido("2035-01-01")).toBe(false);
    expect(documentoVencido(null)).toBe(false);
  });
});

describe("AG-07H — K/L: bloqueio na Escala", () => {
  const base = { data_escala: "2026-08-16", tipo_veiculo: "moto" };

  it("K) tentativa direta de alocação com CNH vencida → BLOQUEADA", async () => {
    dbRef.prestadores = [{ status: "ativo", liberado_app: true }];
    dbRef.documentos_prestadores = [cnhVencida, comprovante];
    dbRef.alocacoes_escala = [];
    const r = await criarAlocacao({ ...base, prestador_id: "prest-1" });
    expect(r.sucesso).toBe(false);
    expect(String(r.erro).toLowerCase()).toContain("cnh");
  });

  it("K2) CNH rejeitada → alocação BLOQUEADA", async () => {
    dbRef.prestadores = [{ status: "ativo", liberado_app: true }];
    dbRef.documentos_prestadores = [cnhRejeitada, comprovante];
    dbRef.alocacoes_escala = [];
    const r = await criarAlocacao({ ...base, prestador_id: "prest-1" });
    expect(r.sucesso).toBe(false);
  });

  it("L) operação em andamento NÃO é destruída (nenhuma alocação nova criada no bloqueio)", async () => {
    dbRef.prestadores = [{ status: "ativo", liberado_app: true }];
    dbRef.documentos_prestadores = [cnhVencida, comprovante];
    dbRef.alocacoes_escala = [{ id: "existente", prestador_id: "prest-1", status: "em_rota" }];
    const r = await criarAlocacao({ ...base, prestador_id: "prest-1" });
    expect(r.sucesso).toBe(false);
    // nenhuma inserção nova; a alocação existente permanece intacta
    expect(dbRef.alocacoes_escala_insercoes.length).toBe(0);
    expect(dbRef.alocacoes_escala[0].status).toBe("em_rota");
  });

  it("A/regressão) ativo + liberado + CNH válida → alocação permitida", async () => {
    dbRef.prestadores = [{ status: "ativo", liberado_app: true }];
    dbRef.documentos_prestadores = [cnhValida, comprovante];
    dbRef.alocacoes_escala = [];
    const r = await criarAlocacao({ ...base, prestador_id: "prest-1" });
    expect(r.sucesso).toBe(true);
  });
});

describe("AG-07H — N: regressão do gate AG-07F", () => {
  it("gate duro preservado (status + liberado_app)", () => {
    expect(prestadorOperacionalmenteElegivelDados({ status: "ativo", liberado_app: true }).elegivel).toBe(true);
    expect(prestadorOperacionalmenteElegivelDados({ status: "em_analise", liberado_app: false }).elegivel).toBe(false);
    expect(prestadorOperacionalmenteElegivelDados({ status: "ativo", liberado_app: false }).elegivel).toBe(false);
  });
});
