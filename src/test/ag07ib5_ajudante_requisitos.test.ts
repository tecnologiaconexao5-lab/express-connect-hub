/**
 * AG-07I-B5 — Testes de bloqueio AJUDANTE OBRIGATÓRIO
 *
 * Regra: quando a OS exige ajudante (carga_ajudante=true), a alocação
 * deve ter ajudantes > 0. Caso contrário → BLOQUEADO.
 *
 * Fonte oficial OS: ordens_servico.carga_ajudante (boolean)
 * Fonte oficial alocação: alocacoes_escala.ajudantes (integer)
 * Prestador: possui_ajudante = apenas metadata (NÃO estruturado)
 *
 * Trocas (trocarMotorista/trocarVeiculo): NÃO protegidas —
 * ajudantes já alocados na alocação existente não mudam com troca.
 */
import { describe, it, expect, vi } from "vitest";
import {
  operacaoExigeAjudante,
  ajudanteCompativel,
  verificarAjudante,
  capacidadeVeiculoCompativel,
  tipoVeiculoCompativel,
  refrigeradoCompativel,
  operacaoRequerRefrigerado,
  veiculoPossuiCapacidadeTermica,
  verificarElegibilidadeVeiculo,
} from "@/services/escala/eligibilidadeOperacionalService";

// ── Mock Supabase ──────────────────────────────────────────────────────
const mockOs: Record<string, any> = {};

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => ({
      select: (_cols?: string) => ({
        eq: (_col: string, _val: string) => ({
          maybeSingle: () => {
            if (table === "ordens_servico") return { data: mockOs[_val] ?? null };
            return { data: null };
          },
          single: () => {
            if (table === "ordens_servico") return { data: mockOs[_val] ?? null };
            return { data: null };
          },
        }),
      }),
    }),
  },
}));

beforeEach(() => {
  Object.keys(mockOs).forEach((k) => delete mockOs[k]);
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. REGRAS PURAS (sem banco)
// ═══════════════════════════════════════════════════════════════════════════

describe("AG-07I-B5 — operacaoExigeAjudante", () => {
  it("true → exige ajudante", () => {
    expect(operacaoExigeAjudante(true)).toBe(true);
  });
  it("false → não exige", () => {
    expect(operacaoExigeAjudante(false)).toBe(false);
  });
  it("null → não exige (fail-open)", () => {
    expect(operacaoExigeAjudante(null)).toBe(false);
  });
  it("undefined → não exige (fail-open)", () => {
    expect(operacaoExigeAjudante(undefined)).toBe(false);
  });
});

describe("AG-07I-B5 — ajudanteCompativel (pura)", () => {
  it("operação NÃO exige ajudante → ELEGÍVEL (ajudantes=0)", () => {
    expect(ajudanteCompativel(false, 0).elegivel).toBe(true);
  });
  it("operação NÃO exige ajudante → ELEGÍVEL (ajudantes=null)", () => {
    expect(ajudanteCompativel(false, null).elegivel).toBe(true);
  });
  it("operação NÃO exige ajudante → ELEGÍVEL (ajudantes=2)", () => {
    expect(ajudanteCompativel(false, 2).elegivel).toBe(true);
  });
  it("operação EXIGE + ajudantes=1 → ELEGÍVEL", () => {
    expect(ajudanteCompativel(true, 1).elegivel).toBe(true);
  });
  it("operação EXIGE + ajudantes=3 → ELEGÍVEL", () => {
    expect(ajudanteCompativel(true, 3).elegivel).toBe(true);
  });
  it("operação EXIGE + ajudantes=0 → BLOQUEADO", () => {
    const r = ajudanteCompativel(true, 0);
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("ajudante_obrigatorio_ausente");
  });
  it("operação EXIGE + ajudantes=null → BLOQUEADO", () => {
    const r = ajudanteCompativel(true, null);
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("ajudante_obrigatorio_ausente");
  });
  it("operação EXIGE + ajudantes=undefined → BLOQUEADO", () => {
    const r = ajudanteCompativel(true, undefined);
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("ajudante_obrigatorio_ausente");
  });
  it("operação EXIGE + ajudantes=-1 → BLOQUEADO (tratado como 0)", () => {
    const r = ajudanteCompativel(true, -1);
    expect(r.elegivel).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. VERIFICAR COM BANCO (mockado)
// ═══════════════════════════════════════════════════════════════════════════

describe("AG-07I-B5 — verificarAjudante (banco)", () => {
  it("OS sem carga_ajudante → ELEGÍVEL (fail-open)", async () => {
    mockOs["os-1"] = { carga_ajudante: null };
    const r = await verificarAjudante("os-1", 0);
    expect(r.elegivel).toBe(true);
  });
  it("OS com carga_ajudante=false + ajudantes=0 → ELEGÍVEL", async () => {
    mockOs["os-2"] = { carga_ajudante: false };
    const r = await verificarAjudante("os-2", 0);
    expect(r.elegivel).toBe(true);
  });
  it("OS com carga_ajudante=true + ajudantes=1 → ELEGÍVEL", async () => {
    mockOs["os-3"] = { carga_ajudante: true };
    const r = await verificarAjudante("os-3", 1);
    expect(r.elegivel).toBe(true);
  });
  it("OS com carga_ajudante=true + ajudantes=0 → BLOQUEADO", async () => {
    mockOs["os-4"] = { carga_ajudante: true };
    const r = await verificarAjudante("os-4", 0);
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("ajudante_obrigatorio_ausente");
    expect(r.detalhe).toContain("exige ajudante");
  });
  it("OS não encontrada → ELEGÍVEL (fail-open)", async () => {
    const r = await verificarAjudante("os-inexistente", 0);
    expect(r.elegivel).toBe(true);
  });
  it("osId vazio → ELEGÍVEL", async () => {
    const r = await verificarAjudante(null, 0);
    expect(r.elegivel).toBe(true);
  });
  it("OS com carga_ajudante=true + ajudantes=2 → ELEGÍVEL", async () => {
    mockOs["os-7"] = { carga_ajudante: true };
    const r = await verificarAjudante("os-7", 2);
    expect(r.elegivel).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. REGRESSÃO — Gates anteriores preservados
// ═══════════════════════════════════════════════════════════════════════════

describe("AG-07I-B5 regressão — B1 tipo veículo preservado", () => {
  it("tipo exato → ELEGÍVEL", () => {
    expect(tipoVeiculoCompativel("van", "van").elegivel).toBe(true);
  });
  it("tipos diferentes → INELEGÍVEL", () => {
    expect(tipoVeiculoCompativel("van", "kombi").elegivel).toBe(false);
  });
  it("sem tipo exigido → ELEGÍVEL", () => {
    expect(tipoVeiculoCompativel(null, "van").elegivel).toBe(true);
  });
  it("outro ≠ van", () => {
    expect(tipoVeiculoCompativel("outro", "van").elegivel).toBe(false);
  });
});

describe("AG-07I-B5 regressão — B2 capacidade preservada", () => {
  it("peso dentro da capacidade → ELEGÍVEL", () => {
    const r = capacidadeVeiculoCompativel(1000, 2000, 5, 10);
    expect(r.elegivel).toBe(true);
  });
  it("peso excede capacidade → BLOQUEADO", () => {
    const r = capacidadeVeiculoCompativel(3000, 2000, 0, 0);
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("capacidade_peso_insuficiente");
  });
  it("cubagem excede capacidade → BLOQUEADO", () => {
    const r = capacidadeVeiculoCompativel(0, 0, 15, 10);
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("capacidade_cubagem_insuficiente");
  });
  it("ambos ausentes → ELEGÍVEL", () => {
    expect(capacidadeVeiculoCompativel(0, 0, 0, 0).elegivel).toBe(true);
  });
});

describe("AG-07I-B5 regressão — B3 refrigerado preservado", () => {
  it("operação sem refrigerado → ELEGÍVEL", () => {
    expect(refrigeradoCompativel(false, "seco").elegivel).toBe(true);
  });
  it("operação com refrigerado + veículo refrigerado → ELEGÍVEL", () => {
    expect(refrigeradoCompativel(true, "refrigerado").elegivel).toBe(true);
  });
  it("operação com refrigerado + veículo seco → BLOQUEADO", () => {
    const r = refrigeradoCompativel(true, "seco");
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("requisito_refrigerado_nao_atendido");
  });
  it("operação com refrigerado + veículo congelado → ELEGÍVEL", () => {
    expect(refrigeradoCompativel(true, "congelado").elegivel).toBe(true);
  });
  it("operação com refrigerado + veículo null → BLOQUEADO", () => {
    const r = refrigeradoCompativel(true, null);
    expect(r.elegivel).toBe(false);
  });
});

describe("AG-07I-B5 regressão — operacaoRequerRefrigerado", () => {
  it("carga_refrigerada=true → true", () => {
    expect(operacaoRequerRefrigerado(true, null)).toBe(true);
  });
  it("veiculo_termica=refrigerado → true", () => {
    expect(operacaoRequerRefrigerado(false, "refrigerado")).toBe(true);
  });
  it("veiculo_termica=seco → false", () => {
    expect(operacaoRequerRefrigerado(false, "seco")).toBe(false);
  });
  it("ambos null → false", () => {
    expect(operacaoRequerRefrigerado(null, null)).toBe(false);
  });
});

describe("AG-07I-B5 regressão — veiculoPossuiCapacidadeTermica", () => {
  it("refrigerado → true", () => {
    expect(veiculoPossuiCapacidadeTermica("refrigerado")).toBe(true);
  });
  it("congelado → true", () => {
    expect(veiculoPossuiCapacidadeTermica("congelado")).toBe(true);
  });
  it("termico → true", () => {
    expect(veiculoPossuiCapacidadeTermica("termico")).toBe(true);
  });
  it("térmico → true", () => {
    expect(veiculoPossuiCapacidadeTermica("térmico")).toBe(true);
  });
  it("seco → false", () => {
    expect(veiculoPossuiCapacidadeTermica("seco")).toBe(false);
  });
  it("null → false", () => {
    expect(veiculoPossuiCapacidadeTermica(null)).toBe(false);
  });
});

describe("AG-07I-B5 regressão — veículo elegível preservado", () => {
  const mockVeiculos: Record<string, any> = {};

  it("veículo disponível → ELEGÍVEL", async () => {
    // Usar mock existente do verificarElegibilidadeVeiculo
    const r = await verificarElegibilidadeVeiculo(null);
    expect(r.elegivel).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. MOTBOY PRESERVADO
// ═══════════════════════════════════════════════════════════════════════════

describe("AG-07I-B5 — motoboy sem ajudante preservado", () => {
  it("operação NÃO exige ajudante (carga_ajudante=false) → motoboy OK", () => {
    expect(ajudanteCompativel(false, 0).elegivel).toBe(true);
  });
  it("operação NÃO exige ajudante (carga_ajudante=null) → motoboy OK", () => {
    expect(ajudanteCompativel(false, null).elegivel).toBe(true);
  });
});
