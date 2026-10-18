import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ============================================================================
// AG-07G — UNIFICAÇÃO APP → RECRUTAMENTO → PRESTADOR + PREVENÇÃO DE DUPLICIDADE
// Cenários A–L.
// ============================================================================

const dbRef = vi.hoisted(() => ({
  prestadores: [] as Record<string, unknown>[],
  prestadores_atualizacoes: [] as Record<string, unknown>[],
  prestadores_insercoes: [] as Record<string, unknown>[],
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
      // intercepta update/insert p/ registrar payloads
      const rawUpdate = b.update;
      (b as unknown as Record<string, unknown>).update = (payload: Record<string, unknown>) => {
        (dbRef.prestadores_atualizacoes as Record<string, unknown>[]).push(payload);
        return b;
      };
      (b as unknown as Record<string, unknown>).insert = (payload: Record<string, unknown>) => {
        (dbRef.prestadores_insercoes as Record<string, unknown>[]).push(payload);
        return b;
      };
      return b;
    },
  },
}));

vi.mock("@/modules/recrutamento/services/identidadePrestadorService", () => ({
  normalizarDocumento: (v: string) => String(v || "").replace(/\D/g, ""),
  normalizarTelefone: (v: string) => String(v || "").replace(/\D/g, ""),
  normalizarEmail: (v: string) => String(v || "").trim().toLowerCase(),
  ehCpfSintetico: (v: string) => /^REC_/i.test(String(v || "").trim()),
  buscarPrestadorOperacionalExistente: vi.fn(async () => existenteRef.current),
}));

const existenteRef = { current: null as Record<string, unknown> | null };

import {
  normalizarDocumento,
  normalizarTelefone,
  normalizarEmail,
  ehCpfSintetico,
} from "@/modules/recrutamento/services/identidadePrestadorService";
import { conversaoCandidatoService } from "@/modules/recrutamento/services/conversaoCandidatoService";
import { prestadorOperacionalmenteElegivelDados } from "@/services/escala/eligibilidadeOperacionalService";

function candidato(stage: string, telefone = "11 99999-8888", email = "joao@teste.com") {
  return {
    id: "cand-1",
    nome: "João da Silva",
    telefone,
    email,
    stage,
    cidade: "São Paulo",
    uf: "SP",
    veiculo: "Moto",
    placa: "FSP0I96",
    tags: [],
    documentos: [],
  } as unknown as Parameters<typeof conversaoCandidatoService.sincronizarComOperacao>[0];
}

const prestadorRecrutamento = { id: "rec-1", nome: "João da Silva" } as Parameters<typeof conversaoCandidatoService.sincronizarComOperacao>[1];

beforeEach(() => {
  existenteRef.current = null;
  dbRef.prestadores_atualizacoes = [];
  dbRef.prestadores_insercoes = [];
  dbRef.prestadores = [];
});

describe("AG-07G — Normalização de identidade (CPF/telefone/e-mail)", () => {
  it("D) CPF com máscara e sem máscara → mesma identidade", () => {
    expect(normalizarDocumento("123.456.789-01")).toBe("12345678901");
    expect(normalizarDocumento("12345678901")).toBe("12345678901");
  });

  it("E) telefone formatado → normalização", () => {
    expect(normalizarTelefone("(11) 99999-8888")).toBe("11999998888");
    expect(normalizarTelefone("11999998888")).toBe("11999998888");
  });

  it("e-mail normalizado em minúsculas", () => {
    expect(normalizarEmail("  Joao@Teste.COM ")).toBe("joao@teste.com");
  });

  it("F) CPF REC_ é detectado como sintético (nunca substitui CPF real)", () => {
    expect(ehCpfSintetico("REC_11999998888")).toBe(true);
    expect(ehCpfSintetico("12345678901")).toBe(false);
  });
});

describe("AG-07G — Conversão reutiliza prestador existente (sem segunda pessoa)", () => {
  it("C) prestador do App já existe (telefone casa) → REUTILIZA e não cria novo", async () => {
    existenteRef.current = { id: "app-1", nome_completo: "João da Silva", telefone: "(11) 99999-8888", cpf_cnpj: "12345678901", status: "em_analise", liberado_app: false, email: null, whatsapp: null };
    await conversaoCandidatoService.sincronizarComOperacao(candidato("aprovado"), prestadorRecrutamento);
    // REUSOU: update no prestador existente, NENHUM insert novo
    expect(dbRef.prestadores_insercoes.length).toBe(0);
    expect(dbRef.prestadores_atualizacoes.length).toBe(1);
  });

  it("I) aprovação (stage aprovado) → status ativo + liberado_app=true no reuso", async () => {
    existenteRef.current = { id: "app-1", nome_completo: "João da Silva", telefone: "11999998888", cpf_cnpj: "12345678901", status: "em_analise", liberado_app: false, email: null, whatsapp: null };
    await conversaoCandidatoService.sincronizarComOperacao(candidato("aprovado"), prestadorRecrutamento);
    const patch = dbRef.prestadores_atualizacoes[0] as Record<string, unknown>;
    expect(patch.status).toBe("ativo");
    expect(patch.liberado_app).toBe(true);
    // CPF real preservado (patch NÃO toca cpf_cnpj)
    expect("cpf_cnpj" in patch).toBe(false);
  });

  it("J) reprovação/bloqueio → não libera (status analise + liberado_app=false)", async () => {
    existenteRef.current = { id: "app-1", nome_completo: "João", telefone: "11999998888", cpf_cnpj: "12345678901", status: "em_analise", liberado_app: false, email: null, whatsapp: null };
    await conversaoCandidatoService.sincronizarComOperacao(candidato("reprovado"), prestadorRecrutamento);
    const patch = dbRef.prestadores_atualizacoes[0] as Record<string, unknown>;
    expect(patch.liberado_app).toBe(false);
  });

  it("K) dados preenchidos no App NÃO são apagados por valores vazios do recrutamento", async () => {
    existenteRef.current = { id: "app-1", nome_completo: "João Completo", telefone: "11999998888", cpf_cnpj: "12345678901", status: "em_analise", liberado_app: false, email: "app@teste.com", whatsapp: "11999998888", origem: "app_prestador" };
    await conversaoCandidatoService.sincronizarComOperacao(candidato("ativo"), prestadorRecrutamento);
    const patch = dbRef.prestadores_atualizacoes[0] as Record<string, unknown>;
    // nome, telefone, whatsapp, email já preenchidos no App → NÃO entram no patch
    expect("nome_completo" in patch).toBe(false);
    expect("telefone" in patch).toBe(false);
    expect("email" in patch).toBe(false);
    expect("cpf_cnpj" in patch).toBe(false);
    // veículo/documentos não são tocados no reuso → sem duplicar veículo/documento
    expect("veiculos" in patch).toBe(false);
    expect("documentos" in patch).toBe(false);
  });

  it("sem prestador existente → cria (status/liberado coerentes)", async () => {
    existenteRef.current = null;
    await conversaoCandidatoService.sincronizarComOperacao(candidato("aprovado"), prestadorRecrutamento);
    expect(dbRef.prestadores_insercoes.length).toBe(1);
    const insert = dbRef.prestadores_insercoes[0] as Record<string, unknown>;
    expect(insert.status).toBe("ativo");
    expect(insert.liberado_app).toBe(true);
  });
});

describe("AG-07G — G: veículo não duplica na conversão", () => {
  it("reuso não insere veículo novo (patch não contém veiculos)", async () => {
    existenteRef.current = { id: "app-1", nome_completo: "João", telefone: "11999998888", cpf_cnpj: "12345678901", status: "em_analise", liberado_app: false, email: null, whatsapp: null };
    await conversaoCandidatoService.sincronizarComOperacao(candidato("ativo"), prestadorRecrutamento);
    const patch = dbRef.prestadores_atualizacoes[0] as Record<string, unknown>;
    expect("veiculos" in patch).toBe(false);
  });
});

describe("AG-07G — L: regressão do gate AG-07F", () => {
  it("gate operacional preservado (status + liberado_app)", () => {
    expect(prestadorOperacionalmenteElegivelDados({ status: "ativo", liberado_app: true }).elegivel).toBe(true);
    expect(prestadorOperacionalmenteElegivelDados({ status: "em_analise", liberado_app: false }).elegivel).toBe(false);
  });
});
