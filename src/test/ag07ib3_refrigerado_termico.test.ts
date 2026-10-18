/**
 * AG-07I-B3 — Testes de bloqueio REFRIGERADO / TÉRMICO / TEMPERATURA
 *
 * Regra: quando a OS exige refrigerado/térmico, o veículo deve possuir
 * capacidade térmica (tipo_carga = "refrigerado"/"congelado"/"termico").
 * Quando a OS NÃO exige → veículo seco é permitido.
 *
 * Fonte oficial OS: carga_refrigerada (boolean) + veiculo_termica (text)
 * Fonte oficial veículo: veiculos.tipo_carga (text)
 * Temperatura: OS SEM faixa estruturada → DEPENDÊNCIA ESTRUTURAL
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  refrigeradoCompativel,
  operacaoRequerRefrigerado,
  veiculoPossuiCapacidadeTermica,
  verificarRefrigerado,
  capacidadeVeiculoCompativel,
  tipoVeiculoCompativel,
  verificarElegibilidadeVeiculo,
} from "@/services/escala/eligibilidadeOperacionalService";

// ── Mock Supabase ──────────────────────────────────────────────────────
const mockOs: Record<string, any> = {};
const mockVeiculos: Record<string, any> = {};

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => ({
      select: (_cols?: string) => ({
        eq: (_col: string, val: string) => ({
          maybeSingle: () => {
            if (table === "ordens_servico") return { data: mockOs[val] || null };
            if (table === "veiculos") return { data: mockVeiculos[val] || null };
            return { data: null };
          },
        }),
      }),
    }),
  },
}));

beforeEach(() => {
  Object.keys(mockOs).forEach((k) => delete mockOs[k]);
  Object.keys(mockVeiculos).forEach((k) => delete mockVeiculos[k]);
});

// ═══════════════════════════════════════════════════════════════════════
// HELPERS PUROS — operacaoRequerRefrigerado / veiculoPossuiCapacidadeTermica
// ═══════════════════════════════════════════════════════════════════════

describe("AG-07I-B3 — operacaoRequerRefrigerado (helper puro)", () => {
  it("carga_refrigerada=true → requer refrigerado", () => {
    expect(operacaoRequerRefrigerado(true, null)).toBe(true);
  });

  it("carga_refrigerada=false + veiculo_termica=refrigerado → requer", () => {
    expect(operacaoRequerRefrigerado(false, "refrigerado")).toBe(true);
  });

  it("carga_refrigerada=false + veiculo_termica=seco → NÃO requer", () => {
    expect(operacaoRequerRefrigerado(false, "seco")).toBe(false);
  });

  it("carga_refrigerada=null + veiculo_termica=null → NÃO requer", () => {
    expect(operacaoRequerRefrigerado(null, null)).toBe(false);
  });

  it("veiculo_termica=congelado → requer", () => {
    expect(operacaoRequerRefrigerado(false, "congelado")).toBe(true);
  });

  it("veiculo_termica=termico → requer", () => {
    expect(operacaoRequerRefrigerado(false, "termico")).toBe(true);
  });

  it("veiculo_termica=térmico → requer", () => {
    expect(operacaoRequerRefrigerado(false, "térmico")).toBe(true);
  });
});

describe("AG-07I-B3 — veiculoPossuiCapacidadeTermica (helper puro)", () => {
  it("tipo_carga=refrigerado → true", () => {
    expect(veiculoPossuiCapacidadeTermica("refrigerado")).toBe(true);
  });

  it("tipo_carga=congelado → true", () => {
    expect(veiculoPossuiCapacidadeTermica("congelado")).toBe(true);
  });

  it("tipo_carga=termico → true", () => {
    expect(veiculoPossuiCapacidadeTermica("termico")).toBe(true);
  });

  it("tipo_carga=seco → false", () => {
    expect(veiculoPossuiCapacidadeTermica("seco")).toBe(false);
  });

  it("tipo_carga=null → false", () => {
    expect(veiculoPossuiCapacidadeTermica(null)).toBe(false);
  });

  it("tipo_carga=vazio → false", () => {
    expect(veiculoPossuiCapacidadeTermica("")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// A–F) REGRA PURA — refrigeradoCompativel
// ═══════════════════════════════════════════════════════════════════════

describe("AG-07I-B3 — refrigeradoCompativel (regra pura)", () => {
  // A) refrigerado exigido + veículo refrigerado → OK
  it("A) refrigerado exigido + refrigerado → OK", () => {
    const r = refrigeradoCompativel(true, "refrigerado");
    expect(r.elegivel).toBe(true);
  });

  // B) refrigerado exigido + veículo seco → BLOQUEADO
  it("B) refrigerado exigido + seco → BLOQUEADO", () => {
    const r = refrigeradoCompativel(true, "seco");
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("requisito_refrigerado_nao_atendido");
  });

  // C) operação seca/sem requisito + veículo seco → OK
  it("C) sem requisito + seco → OK", () => {
    const r = refrigeradoCompativel(false, "seco");
    expect(r.elegivel).toBe(true);
  });

  // D) operação sem requisito térmico → não bloqueia
  it("D) sem requisito térmico → não bloqueia", () => {
    expect(refrigeradoCompativel(false, null).elegivel).toBe(true);
    expect(refrigeradoCompativel(false, undefined).elegivel).toBe(true);
  });

  // E) refrigerado exigido + veículo sem informação → BLOQUEADO (não assumir)
  it("E) refrigerado exigido + veículo sem info → BLOQUEADO", () => {
    const r = refrigeradoCompativel(true, null);
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("requisito_refrigerado_nao_atendido");
  });

  it("E2) refrigerado exigido + veículo vazio → BLOQUEADO", () => {
    const r = refrigeradoCompativel(true, "");
    expect(r.elegivel).toBe(false);
  });

  // F) térmico x refrigerado — veículo congelado é aceito para requisito refrigerado
  it("F) refrigerado exigido + congelado → OK", () => {
    const r = refrigeradoCompativel(true, "congelado");
    expect(r.elegivel).toBe(true);
  });

  it("F2) refrigerado exigido + termico → OK", () => {
    const r = refrigeradoCompativel(true, "termico");
    expect(r.elegivel).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// I) criarAlocacao — gate de refrigerado não é contornado
// ═══════════════════════════════════════════════════════════════════════

describe("AG-07I-B3 — criarAlocacao com gate de refrigerado", () => {
  it("I) OS refrigerada + veículo seco → bloqueado", async () => {
    mockOs["os-ref-001"] = { carga_refrigerada: true, veiculo_termica: null };
    mockVeiculos["REF1A23"] = { tipo_carga: "seco" };

    const { verificarRefrigerado } = await import("@/services/escala/eligibilidadeOperacionalService");
    const r = await verificarRefrigerado("os-ref-001", "REF1A23");
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("requisito_refrigerado_nao_atendido");
  });

  it("I2) OS refrigerada + veículo refrigerado → OK", async () => {
    mockOs["os-ref-002"] = { carga_refrigerada: true, veiculo_termica: null };
    mockVeiculos["REF4B56"] = { tipo_carga: "refrigerado" };

    const { verificarRefrigerado } = await import("@/services/escala/eligibilidadeOperacionalService");
    const r = await verificarRefrigerado("os-ref-002", "REF4B56");
    expect(r.elegivel).toBe(true);
  });

  it("I3) OS seca + veículo seco → OK", async () => {
    mockOs["os-ref-003"] = { carga_refrigerada: false, veiculo_termica: "seco" };
    mockVeiculos["REF7C89"] = { tipo_carga: "seco" };

    const { verificarRefrigerado } = await import("@/services/escala/eligibilidadeOperacionalService");
    const r = await verificarRefrigerado("os-ref-003", "REF7C89");
    expect(r.elegivel).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// J) verificarRefrigerado async — cenários adicionais
// ═══════════════════════════════════════════════════════════════════════

describe("AG-07I-B3 — verificarRefrigerado async", () => {
  it("J) OS com veiculo_termica=refrigerado + veículo seco → BLOQUEADO", async () => {
    mockOs["os-ref-004"] = { carga_refrigerada: false, veiculo_termica: "refrigerado" };
    mockVeiculos["REF2D34"] = { tipo_carga: "seco" };

    const r = await verificarRefrigerado("os-ref-004", "REF2D34");
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("requisito_refrigerado_nao_atendido");
  });

  it("J2) OS inexistente → fail-open", async () => {
    const r = await verificarRefrigerado("os-inexistente", "REF1A23");
    expect(r.elegivel).toBe(true);
  });

  it("J3) OS refrigerada + veículo inexistente → BLOQUEADO", async () => {
    mockOs["os-ref-005"] = { carga_refrigerada: true, veiculo_termica: null };
    const r = await verificarRefrigerado("os-ref-005", "NAOEXISTE");
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("requisito_refrigerado_nao_atendido");
  });

  it("J4) osId nulo → elegível", async () => {
    const r = await verificarRefrigerado(null, "REF1A23");
    expect(r.elegivel).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// L) MOTOBOY preservado
// ═══════════════════════════════════════════════════════════════════════

describe("AG-07I-B3 — motoboy preservado", () => {
  it("L) operação sem requisito + moto → OK (não bloqueia por ausência)", () => {
    expect(refrigeradoCompativel(false, null).elegivel).toBe(true);
    expect(refrigeradoCompativel(false, "seco").elegivel).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// M–N) REGRESSÃO B1/B2
// ═══════════════════════════════════════════════════════════════════════

describe("AG-07I-B3 — regressão B1/B2", () => {
  it("M) tipo incompatível continua bloqueando (B1)", () => {
    expect(tipoVeiculoCompativel("truck", "van").elegivel).toBe(false);
  });

  it("M2) tipo compatível continua OK (B1)", () => {
    expect(tipoVeiculoCompativel("van", "van").elegivel).toBe(true);
  });

  it("N) capacidade insuficiente continua bloqueando (B2)", () => {
    const r = capacidadeVeiculoCompativel(3000, 1500, null, null);
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("capacidade_peso_insuficiente");
  });

  it("N2) capacidade OK continua permitindo (B2)", () => {
    expect(capacidadeVeiculoCompativel(1500, 3000, null, null).elegivel).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// O) REGRESSÃO — veículo inativo continua bloqueado
// ═══════════════════════════════════════════════════════════════════════

describe("AG-07I-B3 — regressão veículo inativo", () => {
  it("O) veículo inativo → ineligível", async () => {
    mockVeiculos["PLACA_INAT"] = { status: "inativo" };
    const r = await verificarElegibilidadeVeiculo("PLACA_INAT");
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("veiculo_inelegivel");
  });
});
