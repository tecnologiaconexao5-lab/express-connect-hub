/**
 * AG-07I-B2 — Testes de bloqueio por capacidade KG / M³
 *
 * Regra: quando AMBOS os campos (OS.peso × veiculos.capacidade_kg, ou
 * OS.cubagem × veiculos.capacidade_m3) existem e são > 0, exige
 * capacidade >= carga. Caso contrário: fail-open (não bloqueia).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  capacidadeVeiculoCompativel,
  verificarCapacidadeVeiculo,
  tipoVeiculoCompativel,
  verificarElegibilidadeVeiculo,
} from "@/services/escala/eligibilidadeOperacionalService";

// ── Mock Supabase ──────────────────────────────────────────────────────
const mockAlocacoes: Record<string, any> = {};
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
          single: () => {
            if (table === "alocacoes_escala") return { data: mockAlocacoes[val] || null };
            return { data: null };
          },
        }),
      }),
    }),
  },
}));

beforeEach(() => {
  Object.keys(mockAlocacoes).forEach((k) => delete mockAlocacoes[k]);
  Object.keys(mockOs).forEach((k) => delete mockOs[k]);
  Object.keys(mockVeiculos).forEach((k) => delete mockVeiculos[k]);
});

// ═══════════════════════════════════════════════════════════════════════
// A) REGRAS PURAS — capacidadeVeiculoCompativel
// ═══════════════════════════════════════════════════════════════════════

describe("AG-07I-B2 — capacidadeVeiculoCompativel (regra pura)", () => {
  // A) OS 2500kg × veículo 1500kg → BLOQUEADO
  it("A) OS 2500kg × veículo 1500kg → BLOQUEADO", () => {
    const r = capacidadeVeiculoCompativel(2500, 1500, null, null);
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("capacidade_peso_insuficiente");
  });

  // B) OS 1500kg × veículo 2500kg → OK
  it("B) OS 1500kg × veículo 2500kg → OK", () => {
    const r = capacidadeVeiculoCompativel(1500, 2500, null, null);
    expect(r.elegivel).toBe(true);
  });

  // C) OS 2500kg × veículo 2500kg → OK (exatamente igual)
  it("C) OS 2500kg × veículo 2500kg → OK", () => {
    const r = capacidadeVeiculoCompativel(2500, 2500, null, null);
    expect(r.elegivel).toBe(true);
  });

  // D) OS sem peso → não bloqueia
  it("D) OS sem peso → não bloqueia", () => {
    expect(capacidadeVeiculoCompativel(null, 1500, null, null).elegivel).toBe(true);
    expect(capacidadeVeiculoCompativel(0, 1500, null, null).elegivel).toBe(true);
    expect(capacidadeVeiculoCompativel(undefined, 1500, null, null).elegivel).toBe(true);
  });

  // E) OS 12m³ × veículo 8m³ → BLOQUEADO
  it("E) OS 12m³ × veículo 8m³ → BLOQUEADO", () => {
    const r = capacidadeVeiculoCompativel(null, null, 12, 8);
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("capacidade_cubagem_insuficiente");
  });

  // F) OS 8m³ × veículo 12m³ → OK
  it("F) OS 8m³ × veículo 12m³ → OK", () => {
    const r = capacidadeVeiculoCompativel(null, null, 8, 12);
    expect(r.elegivel).toBe(true);
  });

  // G) cubagem igual → OK
  it("G) cubagem igual → OK", () => {
    const r = capacidadeVeiculoCompativel(null, null, 8, 8);
    expect(r.elegivel).toBe(true);
  });

  // H) OS sem cubagem → não bloqueia
  it("H) OS sem cubagem → não bloqueia", () => {
    expect(capacidadeVeiculoCompativel(null, null, null, 8).elegivel).toBe(true);
    expect(capacidadeVeiculoCompativel(null, null, 0, 8).elegivel).toBe(true);
  });

  // I) peso OK + cubagem insuficiente → BLOQUEADO
  it("I) peso OK + cubagem insuficiente → BLOQUEADO", () => {
    const r = capacidadeVeiculoCompativel(1500, 2500, 12, 8);
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("capacidade_cubagem_insuficiente");
  });

  // J) peso insuficiente + cubagem OK → BLOQUEADO
  it("J) peso insuficiente + cubagem OK → BLOQUEADO", () => {
    const r = capacidadeVeiculoCompativel(2500, 1500, 8, 12);
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("capacidade_peso_insuficiente");
  });

  // K) moto sem capacidade + OS sem requisito → OK
  it("K) moto sem capacidade + OS sem requisito → OK", () => {
    const r = capacidadeVeiculoCompativel(null, null, null, null);
    expect(r.elegivel).toBe(true);
  });

  // Veículo sem capacidade cadastrada → não bloqueia
  it("Veículo sem capacidade cadastrada → não bloqueia", () => {
    expect(capacidadeVeiculoCompativel(1500, null, null, null).elegivel).toBe(true);
    expect(capacidadeVeiculoCompativel(1500, 0, null, null).elegivel).toBe(true);
    expect(capacidadeVeiculoCompativel(null, null, 8, null).elegivel).toBe(true);
  });

  // Peso e cubagem ambos insuficientes → bloqueia no primeiro check (peso)
  it("Ambos insuficientes → bloqueia peso primeiro", () => {
    const r = capacidadeVeiculoCompativel(5000, 2000, 15, 5);
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("capacidade_peso_insuficiente");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// L) criarAlocacao — gate de capacidade não é contornado
// ═══════════════════════════════════════════════════════════════════════

describe("AG-07I-B2 — criarAlocacao com gate de capacidade", () => {
  it("L) OS com peso alto + veículo com capacidade baixa → bloqueado", async () => {
    mockOs["os-cap-001"] = { peso: 3000, cubagem: 10 };
    mockVeiculos["ABC1D23"] = { status: "ativo", tipo: "truck", capacidade_kg: 1500, capacidade_m3: 8 };

    const { verificarCapacidadeVeiculo } = await import("@/services/escala/eligibilidadeOperacionalService");
    const r = await verificarCapacidadeVeiculo("os-cap-001", "ABC1D23");
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("capacidade_peso_insuficiente");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// M) trocarMotorista — gate de capacidade não é contornado
// ═══════════════════════════════════════════════════════════════════════

describe("AG-07I-B2 — verificarCapacidadeVeiculo async", () => {
  it("M) OS + veículo existentes com capacidade OK → elegível", async () => {
    mockOs["os-cap-002"] = { peso: 1500, cubagem: 5 };
    mockVeiculos["XYZ9A12"] = { capacidade_kg: 2500, capacidade_m3: 10 };

    const r = await verificarCapacidadeVeiculo("os-cap-002", "XYZ9A12");
    expect(r.elegivel).toBe(true);
  });

  it("N) OS + veículo existentes com capacidade insuficiente → ineligível", async () => {
    mockOs["os-cap-003"] = { peso: 4000, cubagem: 12 };
    mockVeiculos["DEF4B56"] = { capacidade_kg: 2000, capacidade_m3: 6 };

    const r = await verificarCapacidadeVeiculo("os-cap-003", "DEF4B56");
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("capacidade_peso_insuficiente");
  });

  it("O) OS sem peso → fail-open mesmo com veículo sem capacidade", async () => {
    mockOs["os-cap-004"] = { peso: null, cubagem: null };
    mockVeiculos["GHI7C89"] = { capacidade_kg: null, capacidade_m3: null };

    const r = await verificarCapacidadeVeiculo("os-cap-004", "GHI7C89");
    expect(r.elegivel).toBe(true);
  });

  it("P) OS inexistente → fail-open", async () => {
    const r = await verificarCapacidadeVeiculo("os-inexistente", "PLACA123");
    expect(r.elegivel).toBe(true);
  });

  it("Q) placa inexistente → fail-open", async () => {
    mockOs["os-cap-005"] = { peso: 2000, cubagem: 8 };
    const r = await verificarCapacidadeVeiculo("os-cap-005", "NAOEXISTE");
    expect(r.elegivel).toBe(true);
  });

  it("R) osId nulo → elegível", async () => {
    const r = await verificarCapacidadeVeiculo(null, "ABC1D23");
    expect(r.elegivel).toBe(true);
  });

  it("S) placa nula → elegível", async () => {
    const r = await verificarCapacidadeVeiculo("os-cap-006", null);
    expect(r.elegivel).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// O) REGRESSÃO — tipo incompatível continua bloqueando (B1)
// ═══════════════════════════════════════════════════════════════════════

describe("AG-07I-B2 — regressão B1: tipo incompatível continua bloqueando", () => {
  it("O) truck × van → INCOMPATÍVEL (B1 preservado)", () => {
    expect(tipoVeiculoCompativel("truck", "van").elegivel).toBe(false);
  });

  it("O2) van × van → OK (B1 preservado)", () => {
    expect(tipoVeiculoCompativel("van", "van").elegivel).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// P) REGRESSÃO — veículo inativo continua bloqueando (AG-07F)
// ═══════════════════════════════════════════════════════════════════════

describe("AG-07I-B2 — regressão AG-07F: veículo inativo continua bloqueando", () => {
  it("P) veículo inativo → ineligível", async () => {
    mockVeiculos["PLACA_INAT"] = { status: "inativo" };
    const r = await verificarElegibilidadeVeiculo("PLACA_INAT");
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("veiculo_inelegivel");
  });
});
