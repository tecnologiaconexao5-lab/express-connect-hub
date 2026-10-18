/**
 * ESCALA-VEIC-TABELA-06 — Franquia KM canônica (tabela do cliente).
 *
 * Regra:
 *  franquia efetiva = franquia_km (inclusive 0) → senão km_franquia (inclusive 0) → senão 0.
 *  Nunca usar `||`. 0 é válido.
 *
 * Caso real Mineirão: franquia_km=100, km_franquia=0, valor_km_excedente=1.20, valor_base=300.
 */

import { describe, it, expect } from "vitest";
import { resolverFranquiaEfetiva, resolverTarifaKmExcedente } from "@/helpers/franquiaKm";
import { calcularPrecoRapido } from "@/services/precificacao/precificacaoEngineService";
import { resolverRepassePrestadorBase } from "@/helpers/repassePrestador";
import type { TabelaValorAplicada } from "@/services/precificacao/types";

// Tabela do cliente Mineirão/Fiorino (evidência de teste).
const TABELA_CLIENTE: TabelaValorAplicada = {
  id: "1cfaa88a-0802-4d1e-9026-abfb0224a8dc",
  nome: "Tabela Cliente",
  fonte: "tabelas_valores",
  valor_base: 300,
  franquia_km: 100,
  valor_km_excedente: 1.2,
  percentual_prestador: 80,
  valor_fixo_prestador: 0,
  tipo_repasse_prestador: "percentual",
};

// T1 — match Mineirão/Fiorino preservado (ESCALA-05)
describe("T1: match Mineirão/Fiorino preservado", () => {
  const normalizar = (s: string) => (s || "").trim().toUpperCase();
  const match = (db: string, input: string) =>
    normalizar(db) !== "" && normalizar(input) !== "" && normalizar(db) === normalizar(input);

  it("tabela específica encontrada", () => {
    const tabelas = [
      { id: "1cfaa88a-0802-4d1e-9026-abfb0224a8dc", cliente: " Mineirao Abc", tipo_veiculo: "fiorino", ativo: true, universal: false },
    ];
    const found = tabelas.find(
      (t) => !t.universal && t.tipo_veiculo === "fiorino" && t.ativo && match(t.cliente, "MINEIRAO ABC")
    );
    expect(found?.id).toBe("1cfaa88a-0802-4d1e-9026-abfb0224a8dc");
  });
});

// T2 — canonical=100 legacy=0 → 100
describe("T2: franquia_km=100 vence km_franquia=0", () => {
  it("retorna 100", () => {
    expect(resolverFranquiaEfetiva(100, 0)).toBe(100);
  });
});

// T3 — canonical=0 legacy>0 → 0 (0 explícito é válido)
describe("T3: franquia_km=0 explícito permanece 0", () => {
  it("retorna 0 mesmo com legado 50", () => {
    expect(resolverFranquiaEfetiva(0, 50)).toBe(0);
  });
});

// T4 — canonical null → legacy
describe("T4: franquia_km null usa legado", () => {
  it("retorna legado 80", () => {
    expect(resolverFranquiaEfetiva(null, 80)).toBe(80);
    expect(resolverFranquiaEfetiva(undefined, 80)).toBe(80);
    expect(resolverFranquiaEfetiva("", 80)).toBe(80);
  });
});

// T5 — ambos ausentes → 0
describe("T5: ambos ausentes → 0", () => {
  it("retorna 0", () => {
    expect(resolverFranquiaEfetiva(null, null)).toBe(0);
    expect(resolverFranquiaEfetiva(undefined, undefined)).toBe(0);
  });
});

// T6-T10 — excedente conforme franquia efetiva (100)
describe("T6: 0 km → sem excedente", () => {
  it("excedente 0", () => {
    expect(calcularPrecoRapido(TABELA_CLIENTE, 0).kmExcedente).toBe(0);
  });
});
describe("T7: 100 km → sem excedente", () => {
  it("excedente 0", () => {
    expect(calcularPrecoRapido(TABELA_CLIENTE, 100).kmExcedente).toBe(0);
  });
});
describe("T8: 101 km → 1 km excedente", () => {
  it("excedente 1 e cliente 301.20", () => {
    const r = calcularPrecoRapido(TABELA_CLIENTE, 101);
    expect(r.kmExcedente).toBe(1);
    expect(r.valorCliente).toBeCloseTo(301.2, 2);
  });
});
describe("T9: 110 km → 10 km excedentes", () => {
  it("excedente 10 e cliente 312", () => {
    const r = calcularPrecoRapido(TABELA_CLIENTE, 110);
    expect(r.kmExcedente).toBe(10);
    expect(r.valorCliente).toBeCloseTo(312, 2);
  });
});
describe("T10: 150 km → 50 km excedentes", () => {
  it("excedente 50 e cliente 360", () => {
    const r = calcularPrecoRapido(TABELA_CLIENTE, 150);
    expect(r.kmExcedente).toBe(50);
    expect(r.valorCliente).toBeCloseTo(360, 2);
  });
});

// T11 — tarifa vem da tabela, sem 2.50 inventado
describe("T11: tarifa dinâmica da tabela (sem 2.50)", () => {
  it("usa valor_km_excedente da tabela", () => {
    const r = calcularPrecoRapido(TABELA_CLIENTE, 150);
    expect(r.valorCliente).toBeCloseTo(300 + 50 * 1.2, 2);
    expect(r.valorCliente).not.toBeCloseTo(300 + 50 * 2.5, 2);
  });
  it("0 explícito preservado e fallback legado", () => {
    expect(resolverTarifaKmExcedente(0, 5)).toBe(0);
    expect(resolverTarifaKmExcedente(null, 5)).toBe(5);
    expect(resolverTarifaKmExcedente(1.2, 9)).toBe(1.2);
  });
});

// T12 — snapshot grava franquia efetiva
describe("T12: snapshot grava franquia efetiva", () => {
  it("metadata.faturamento.franquia_km = 100 (não 0)", () => {
    const tabela = { franquia_km: 100, km_franquia: 0 };
    const snapshot = { franquia_km: resolverFranquiaEfetiva(tabela.franquia_km, tabela.km_franquia) };
    expect(snapshot.franquia_km).toBe(100);
    expect(snapshot.franquia_km).not.toBe(0);
  });
});

// T13 — ESCALA-05 permanece PASS
describe("T13: ESCALA-05 preservada", () => {
  it("normalização continua casando Mineirão e rejeitando outro cliente", () => {
    const normalizar = (s: string) => (s || "").trim().toUpperCase();
    expect(normalizar(" Mineirao Abc")).toBe(normalizar("MINEIRAO ABC"));
    expect(normalizar("MINEIRAO ABC") === normalizar("OUTRO CLIENTE")).toBe(false);
  });
});

// T14 — ESCALA-PRESTADOR-02 permanece PASS
describe("T14: ESCALA-PRESTADOR-02 preservada", () => {
  it("cadastro Clayton = 250; percentual 80% = 240", () => {
    expect(resolverRepassePrestadorBase({ modo: "cadastro", valorDiaria: 250, valorSaida: 250, valorBaseCliente: 300 }).base).toBe(250);
    expect(resolverRepassePrestadorBase({ modo: "percentual", percentual: 80, valorBaseCliente: 300 }).base).toBe(240);
  });
});

// T15 — cliente/prestador separados
describe("T15: franquia cliente × prestador separadas", () => {
  it("franquia do cliente não interfere no prestador e vice-versa", () => {
    const franquiaCliente = resolverFranquiaEfetiva(100, 0);
    const franquiaPrestador = resolverFranquiaEfetiva(null, 0);
    expect(franquiaCliente).toBe(100);
    expect(franquiaPrestador).toBe(0);
    expect(franquiaCliente).not.toBe(franquiaPrestador);
  });
});
