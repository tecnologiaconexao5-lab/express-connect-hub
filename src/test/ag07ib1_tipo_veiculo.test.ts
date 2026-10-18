import { describe, it, expect, vi } from "vitest";

// ============================================================================
// AG-07I-B1 — BLOQUEIO DE TIPO DE VEÍCULO INCOMPATÍVEL NA ESCALA
// Testes: compatibilidade tipo OS × veículo, normalização, motoboy, regressão.
// ============================================================================

const dbRef = vi.hoisted(() => ({
  prestadores: [] as Record<string, unknown>[],
  alocacoes_escala: [] as Record<string, unknown>[],
  veiculos: [] as Record<string, unknown>[],
  ordens_servico: [] as Record<string, unknown>[],
  documentos_prestadores: [] as Record<string, unknown>[],
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
  tipoVeiculoCompativel,
  verificarCompatibilidadeTipoVeiculo,
  verificarElegibilidadeVeiculo,
} from "@/services/escala/eligibilidadeOperacionalService";
import { criarAlocacao, trocarMotorista, trocarVeiculo } from "@/services/escala/escalaService";

// ═══════════════════════════════════════════════════════════════════════════
// A–G: Regra pura tipoVeiculoCompativel (sem banco)
// ═══════════════════════════════════════════════════════════════════════════

describe("AG-07I-B1 — tipoVeiculoCompativel (regra pura)", () => {
  it("A) fiorino × fiorino → OK", () => {
    const r = tipoVeiculoCompativel("fiorino", "fiorino");
    expect(r.elegivel).toBe(true);
  });

  it("B) truck × truck → OK", () => {
    expect(tipoVeiculoCompativel("truck", "truck").elegivel).toBe(true);
  });

  it("C) truck exigido × fiorino → BLOQUEADO", () => {
    const r = tipoVeiculoCompativel("truck", "fiorino");
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("tipo_veiculo_incompativel");
  });

  it("D) vuc exigido × moto → BLOQUEADO", () => {
    const r = tipoVeiculoCompativel("vuc", "moto");
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("tipo_veiculo_incompativel");
  });

  it("E) moto × moto → OK", () => {
    expect(tipoVeiculoCompativel("moto", "moto").elegivel).toBe(true);
  });

  it("F) OS sem tipo exigido → não bloqueia", () => {
    expect(tipoVeiculoCompativel(null, "fiorino").elegivel).toBe(true);
    expect(tipoVeiculoCompativel("", "truck").elegivel).toBe(true);
    expect(tipoVeiculoCompativel(undefined, "moto").elegivel).toBe(true);
  });

  it("G) operação sem veículo (tipoVeiculo vazio) → bloqueia se OS exige", () => {
    const r = tipoVeiculoCompativel("fiorino", null);
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("tipo_veiculo_incompativel");
  });

  it("K-1) normalização: '  TRUCK  ' × 'truck' → OK", () => {
    expect(tipoVeiculoCompativel("  TRUCK  ", "truck").elegivel).toBe(true);
  });

  it("K-2) van × kombi → INCOMPATÍVEL (tipos distintos, sem evidência contratual)", () => {
    expect(tipoVeiculoCompativel("van", "kombi").elegivel).toBe(false);
    expect(tipoVeiculoCompativel("kombi", "van").elegivel).toBe(false);
  });

  it("K-3) passeio × outro → INCOMPATÍVEL (outro é genérico)", () => {
    expect(tipoVeiculoCompativel("passeio", "outro").elegivel).toBe(false);
    expect(tipoVeiculoCompativel("outro", "passeio").elegivel).toBe(false);
  });

  it("K-4) Carreta × toco → INCOMPATÍVEL (categorias distintas)", () => {
    expect(tipoVeiculoCompativel("carreta", "toco").elegivel).toBe(false);
  });

  it("K-5) hr × vuc → INCOMPATÍVEL", () => {
    expect(tipoVeiculoCompativel("hr", "vuc").elegivel).toBe(false);
  });

  it("K-6) outro × outro → OK", () => {
    expect(tipoVeiculoCompativel("outro", "outro").elegivel).toBe(true);
  });

  it("K-7) outro × truck → INCOMPATÍVEL (outro não é wildcard)", () => {
    expect(tipoVeiculoCompativel("outro", "truck").elegivel).toBe(false);
    expect(tipoVeiculoCompativel("truck", "outro").elegivel).toBe(false);
  });

  it("K-8) outro × fiorino → INCOMPATÍVEL", () => {
    expect(tipoVeiculoCompativel("outro", "fiorino").elegivel).toBe(false);
  });

  it("G-2) passeio × passeio → OK (App 'Carro de Passeio' agora mapeia para passeio)", () => {
    expect(tipoVeiculoCompativel("passeio", "passeio").elegivel).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H: Veículo inativo continua bloqueado (regressão AG-07F)
// ═══════════════════════════════════════════════════════════════════════════

describe("AG-07I-B1 — Regressão: veículo inativo/manutenção bloqueado", () => {
  it("H) veículo inativo → bloqueado", async () => {
    dbRef.veiculos = [{ status: "inativo" }];
    const r = await verificarElegibilidadeVeiculo("ABC1D23");
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("veiculo_inelegivel");
  });

  it("H-2) veículo manutenção → bloqueado", async () => {
    dbRef.veiculos = [{ status: "manutencao" }];
    const r = await verificarElegibilidadeVeiculo("XYZ9K88");
    expect(r.elegivel).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// I: criarAlocacao não contorna gate de tipo
// ═══════════════════════════════════════════════════════════════════════════

describe("AG-07I-B1 — criarAlocacao com gate de tipo", () => {
  it("I) OS exige truck + veículo fiorino → criação recusada", async () => {
    // Prestador elegível
    dbRef.prestadores = [{ status: "ativo", liberado_app: true }];
    // OS exige truck
    dbRef.ordens_servico = [{ veiculo_tipo: "truck" }];
    // Veículo do prestador é fiorino (via verificarElegibilidadeVeiculo)
    dbRef.veiculos = [{ status: "disponivel" }];

    const r = await criarAlocacao({
      data_escala: "2026-08-25",
      tipo_veiculo: "fiorino",
      prestador_id: "prest-001",
      ordem_servico_id: "os-001",
      placa: "ABC1D23",
    });

    expect(r.sucesso).toBe(false);
    expect(r.erro).toContain("incompatível");
  });

  it("I-2) OS exige fiorino + veículo fiorino → criação permitida", async () => {
    dbRef.prestadores = [{ status: "ativo", liberado_app: true }];
    dbRef.ordens_servico = [{ veiculo_tipo: "fiorino" }];
    dbRef.veiculos = [{ status: "disponivel" }];
    // Sem conflito
    dbRef.alocacoes_escala = [];

    const r = await criarAlocacao({
      data_escala: "2026-08-25",
      tipo_veiculo: "fiorino",
      prestador_id: "prest-001",
      ordem_servico_id: "os-001",
      placa: "ABC1D23",
    });

    expect(r.sucesso).toBe(true);
  });

  it("I-3) OS sem tipo exigido + qualquer veículo → criação permitida", async () => {
    dbRef.prestadores = [{ status: "ativo", liberado_app: true }];
    dbRef.ordens_servico = [{ veiculo_tipo: null }];
    dbRef.veiculos = [{ status: "disponivel" }];
    dbRef.alocacoes_escala = [];

    const r = await criarAlocacao({
      data_escala: "2026-08-25",
      tipo_veiculo: "moto",
      prestador_id: "prest-001",
      ordem_servico_id: "os-002",
    });

    expect(r.sucesso).toBe(true);
  });

  it("I-4) sem OS (ordem_servico_id vazio) → não bloqueia por tipo", async () => {
    dbRef.prestadores = [{ status: "ativo", liberado_app: true }];
    dbRef.veiculos = [{ status: "disponivel" }];
    dbRef.alocacoes_escala = [];

    const r = await criarAlocacao({
      data_escala: "2026-08-25",
      tipo_veiculo: "moto",
      prestador_id: "prest-001",
    });

    expect(r.sucesso).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// J: trocarMotorista / trocarVeiculo não contornam gate
// ═══════════════════════════════════════════════════════════════════════════

describe("AG-07I-B1 — trocarMotorista com gate de tipo", () => {
  it("J) trocar para prestador com veículo incompatível → recusado", async () => {
    // Alocação atual com OS
    dbRef.alocacoes_escala = [{ prestador_id: "old", prestador_nome: "Old", data_escala: "2026-08-25", status: "aceita", ordem_servico_id: "os-001" }];
    // Novo prestador elegível
    dbRef.prestadores = [{ nome_completo: "Novo", status: "ativo", liberado_app: true }];
    // Veículo do novo prestador
    dbRef.veiculos = [{ tipo: "fiorino" }];
    // OS exige truck
    dbRef.ordens_servico = [{ veiculo_tipo: "truck" }];

    const r = await trocarMotorista("aloc-001", "novo-001", "user-001", "teste");
    expect(r.sucesso).toBe(false);
    expect(r.erro).toContain("incompatível");
  });

  // J-2: happy-path para trocarMotorista testado via regra pura (tipoVeiculoCompativel)
  // e pelo caso de falha J; mock não suporta chained query na mesma tabela.

});

describe("AG-07I-B1 — trocarVeiculo com gate de tipo", () => {
  it("J-3) trocar para veículo incompatível com OS → recusado", async () => {
    dbRef.alocacoes_escala = [{ placa: "OLD1A11", data_escala: "2026-08-25", status: "aceita", ordem_servico_id: "os-001" }];
    dbRef.veiculos = [{ status: "disponivel", tipo: "fiorino" }];
    dbRef.ordens_servico = [{ veiculo_tipo: "truck" }];

    const r = await trocarVeiculo("aloc-001", "NEW2B22", "user-001", "teste");
    expect(r.sucesso).toBe(false);
    expect(r.erro).toContain("incompatível");
  });

  // J-4: happy-path para trocarVeiculo testado via regra pura (tipoVeiculoCompativel)
  // e pelo caso de falha J-3; mock não suporta chained query na mesma tabela.

});

// ═══════════════════════════════════════════════════════════════════════════
// Motoboy preservado
// ═══════════════════════════════════════════════════════════════════════════

describe("AG-07I-B1 — Motoboy preservado", () => {
  it("E-2) moto × moto na criarAlocacao → permitido", async () => {
    dbRef.prestadores = [{ status: "ativo", liberado_app: true }];
    dbRef.ordens_servico = [{ veiculo_tipo: "moto" }];
    dbRef.veiculos = [{ status: "disponivel" }];
    dbRef.alocacoes_escala = [];

    const r = await criarAlocacao({
      data_escala: "2026-08-25",
      tipo_veiculo: "moto",
      prestador_id: "moto-001",
      ordem_servico_id: "os-moto",
      placa: "MOT1A23",
    });
    expect(r.sucesso).toBe(true);
  });

  it("F-2) OS sem tipo + moto → não bloqueia", () => {
    expect(tipoVeiculoCompativel(null, "moto").elegivel).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// verificarCompatibilidadeTipoVeiculo (async, com OS no banco)
// ═══════════════════════════════════════════════════════════════════════════

describe("AG-07I-B1 — verificarCompatibilidadeTipoVeiculo (async)", () => {
  it("sem OS → elegível", async () => {
    const r = await verificarCompatibilidadeTipoVeiculo(null, "fiorino");
    expect(r.elegivel).toBe(true);
  });

  it("OS com veiculo_tipo + tipo compatível → elegível", async () => {
    dbRef.ordens_servico = [{ veiculo_tipo: "van" }];
    const r = await verificarCompatibilidadeTipoVeiculo("os-001", "van");
    expect(r.elegivel).toBe(true);
  });

  it("OS van + tipo kombi → INCOMPATÍVEL (sem equivalência)", async () => {
    dbRef.ordens_servico = [{ veiculo_tipo: "van" }];
    const r = await verificarCompatibilidadeTipoVeiculo("os-001", "kombi");
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("tipo_veiculo_incompativel");
  });

  it("OS com veiculo_tipo + tipo incompatível → inelegível", async () => {
    dbRef.ordens_servico = [{ veiculo_tipo: "truck" }];
    const r = await verificarCompatibilidadeTipoVeiculo("os-001", "moto");
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("tipo_veiculo_incompativel");
  });

  it("OS sem veiculo_tipo → elegível (fail-open)", async () => {
    dbRef.ordens_servico = [{ veiculo_tipo: null }];
    const r = await verificarCompatibilidadeTipoVeiculo("os-001", "fiorino");
    expect(r.elegivel).toBe(true);
  });
});
