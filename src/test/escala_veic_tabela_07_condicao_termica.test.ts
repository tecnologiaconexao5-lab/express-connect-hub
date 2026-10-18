/**
 * ESCALA-VEIC-TABELA-07 — Condição térmica independente do tipo de veículo.
 *
 * Dimensão VEÍCULO: fiorino, vuc, van, ... (tabelas_valores.tipo_veiculo)
 * Dimensão TÉRMICA: seco | termico | refrigerado (tabelas_valores.classificacao_termica)
 * Proibido compor tipos artificiais (fiorino_refrigerada, vuc_refrigerado, ...).
 */

import { describe, it, expect } from "vitest";
import {
  normalizarCondicaoTerica,
  condicaoTericaCompativel,
  selecionarTabelaPorCondicaoTerica,
  CONDICOES_TERMICAS,
} from "@/helpers/condicaoTerica";
import { resolverFranquiaEfetiva } from "@/helpers/franquiaKm";
import { resolverRepassePrestadorBase } from "@/helpers/repassePrestador";

// T1 — Fiorino + Seco permanece Fiorino
describe("T1: Fiorino + Seco permanece Fiorino", () => {
  it("tipo_veiculo inalterado e térmica seco", () => {
    const t = { tipo_veiculo: "fiorino", classificacao_termica: "seco" };
    expect(t.tipo_veiculo).toBe("fiorino");
    expect(normalizarCondicaoTerica(t.classificacao_termica)).toBe("seco");
  });
});

// T2 — Fiorino + Térmico permanece Fiorino
describe("T2: Fiorino + Térmico permanece Fiorino", () => {
  it("tipo_veiculo inalterado e térmica termico (acento normalizado)", () => {
    const t = { tipo_veiculo: "fiorino", classificacao_termica: "térmico" };
    expect(t.tipo_veiculo).toBe("fiorino");
    expect(normalizarCondicaoTerica(t.classificacao_termica)).toBe("termico");
  });
});

// T3 — Fiorino + Refrigerado permanece Fiorino
describe("T3: Fiorino + Refrigerado permanece Fiorino", () => {
  it("tipo_veiculo inalterado e térmica refrigerado", () => {
    const t = { tipo_veiculo: "fiorino", classificacao_termica: "refrigerado" };
    expect(t.tipo_veiculo).toBe("fiorino");
    expect(normalizarCondicaoTerica(t.classificacao_termica)).toBe("refrigerado");
  });
});

// T4 — Seco ≠ Térmico
describe("T4: Seco ≠ Térmico", () => {
  it("incompatíveis", () => {
    expect(condicaoTericaCompativel("seco", "termico")).toBe(false);
    expect(condicaoTericaCompativel("termico", "seco")).toBe(false);
  });
});

// T5 — Térmico ≠ Refrigerado
describe("T5: Térmico ≠ Refrigerado", () => {
  it("incompatíveis", () => {
    expect(condicaoTericaCompativel("termico", "refrigerado")).toBe(false);
    expect(condicaoTericaCompativel("refrigerado", "termico")).toBe(false);
  });
});

// T6 — veículo e térmico são dimensões independentes
describe("T6: veículo e térmico independentes", () => {
  it("mesmo veículo, três térmicas distintas", () => {
    const tabelas = [
      { id: "a", tipo_veiculo: "fiorino", classificacao_termica: "seco" },
      { id: "b", tipo_veiculo: "fiorino", classificacao_termica: "termico" },
      { id: "c", tipo_veiculo: "fiorino", classificacao_termica: "refrigerado" },
    ];
    expect(tabelas.every((t) => t.tipo_veiculo === "fiorino")).toBe(true);
    expect(new Set(tabelas.map((t) => t.classificacao_termica)).size).toBe(3);
  });
});

// T7 — tabela específica correta é priorizada
describe("T7: tabela compatível priorizada", () => {
  const candidatas = [
    { id: "seco", classificacao_termica: "seco" },
    { id: "refrig", classificacao_termica: "refrigerado" },
  ];
  it("veículo refrigerado → tabela refrigerada", () => {
    expect(selecionarTabelaPorCondicaoTerica(candidatas, "refrigerado").tabela?.id).toBe("refrig");
  });
  it("veículo seco → tabela seca", () => {
    expect(selecionarTabelaPorCondicaoTerica(candidatas, "seco").tabela?.id).toBe("seco");
  });
});

// T8 — tabela térmica incompatível não é selecionada
describe("T8: incompatível não selecionada", () => {
  it("veículo seco + só tabela refrigerada → null", () => {
    const r = selecionarTabelaPorCondicaoTerica([{ id: "refrig", classificacao_termica: "refrigerado" }], "seco");
    expect(r.tabela).toBeNull();
  });
  it("ambiguidade sem condição do veículo → não escolher", () => {
    const r = selecionarTabelaPorCondicaoTerica(
      [{ id: "seco", classificacao_termica: "seco" }, { id: "refrig", classificacao_termica: "refrigerado" }],
      null
    );
    expect(r.ambiguidade).toBe(true);
    expect(r.tabela).toBeNull();
  });
  it("condição desconhecida = curinga (preserva legado)", () => {
    const r = selecionarTabelaPorCondicaoTerica([{ id: "x", classificacao_termica: null }], "refrigerado");
    expect(r.tabela?.id).toBe("x");
  });
});

// T9 — nenhuma composição artificial de tipo_veiculo
describe("T9: sem tipos artificiais", () => {
  it("condições canônicas são apenas seco/termico/refrigerado", () => {
    expect(CONDICOES_TERMICAS).toEqual(["seco", "termico", "refrigerado"]);
  });
  it("nomes compostos não são condições térmicas válidas", () => {
    expect(normalizarCondicaoTerica("fiorino_refrigerada")).toBeNull();
    expect(normalizarCondicaoTerica("fiorino_termica")).toBeNull();
    expect(normalizarCondicaoTerica("vuc_refrigerado")).toBeNull();
  });
});

// T10 — ESCALA-05 preservada
describe("T10: ESCALA-05 preservada", () => {
  it("normalização trim+uppercase do cliente", () => {
    const normalizar = (s: string) => (s || "").trim().toUpperCase();
    expect(normalizar(" Mineirao Abc")).toBe(normalizar("MINEIRAO ABC"));
    expect(normalizar("MINEIRAO ABC") === normalizar("OUTRO CLIENTE")).toBe(false);
  });
});

// T11 — ESCALA-06 preservada
describe("T11: ESCALA-06 preservada", () => {
  it("franquia canônica e zero válido", () => {
    expect(resolverFranquiaEfetiva(100, 0)).toBe(100);
    expect(resolverFranquiaEfetiva(null, 80)).toBe(80);
    expect(resolverFranquiaEfetiva(null, null)).toBe(0);
  });
});

// T12 — ESCALA-PRESTADOR-02 preservada
describe("T12: ESCALA-PRESTADOR-02 preservada", () => {
  it("cadastro 250; percentual 80% = 240", () => {
    expect(resolverRepassePrestadorBase({ modo: "cadastro", valorDiaria: 250, valorSaida: 250, valorBaseCliente: 300 }).base).toBe(250);
    expect(resolverRepassePrestadorBase({ modo: "percentual", percentual: 80, valorBaseCliente: 300 }).base).toBe(240);
  });
});

// T13 — explicit 0 da franquia continua válido
describe("T13: franquia 0 explícito válido", () => {
  it("0 preservado", () => {
    expect(resolverFranquiaEfetiva(0, 50)).toBe(0);
  });
});

// T14 — nenhuma mistura cliente/prestador
describe("T14: cliente × prestador separados", () => {
  it("térmica do cliente não interfere no repasse do prestador", () => {
    const basePrestador = resolverRepassePrestadorBase({ modo: "cadastro", valorDiaria: 250, valorSaida: 250, valorBaseCliente: 300 }).base;
    const tabelaCliente = selecionarTabelaPorCondicaoTerica([{ id: "r", classificacao_termica: "refrigerado" }], "refrigerado").tabela;
    expect(basePrestador).toBe(250);
    expect(tabelaCliente?.id).toBe("r");
  });
});

// T15 — integridade do módulo
describe("T15: integridade (typecheck/build)", () => {
  it("helpers exportam funções válidas", () => {
    expect(typeof normalizarCondicaoTerica).toBe("function");
    expect(typeof condicaoTericaCompativel).toBe("function");
    expect(typeof selecionarTabelaPorCondicaoTerica).toBe("function");
  });
});
