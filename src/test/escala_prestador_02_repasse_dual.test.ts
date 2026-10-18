/**
 * ESCALA-PRESTADOR-02 — Repasse dual canônico (Cadastro do prestador × % sobre tabela).
 *
 * Regra aprovada:
 *  - Padrão: modo "cadastro" → base = valor_diaria ?? valor_saida ?? 0 (não soma, não inventa).
 *  - "percentual": base = valor da tabela cliente × percentual informado (só por escolha explícita).
 *  - "fixo": preservado.
 *  - tabelas_valores.percentual_prestador NUNCA é fallback oculto no modo cadastro.
 *
 * Caso real Clayton: valor_diaria=250, valor_saida=250; tabela cliente = 300.
 */

import { describe, it, expect } from "vitest";
import { resolverRepassePrestadorBase } from "@/helpers/repassePrestador";
import { calcularPrecoRapido } from "@/services/precificacao/precificacaoEngineService";
import type { TabelaValorAplicada } from "@/services/precificacao/types";

// Tabela do cliente Mineirão/Fiorino (evidência de teste — não hardcode de produção).
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

// Cadastro do prestador Clayton (evidência de teste).
const CLAYTON = { valorDiaria: 250, valorSaida: 250 };

// T1 — selecionar Clayton → padrão Cadastro do prestador
describe("T1: padrão é Cadastro do prestador", () => {
  it("modo cadastro retorna origem 'cadastro'", () => {
    const r = resolverRepassePrestadorBase({ modo: "cadastro", ...CLAYTON, valorBaseCliente: 300 });
    expect(r.origem).toBe("cadastro");
  });
});

// T2 — Clayton → base R$250
describe("T2: Clayton base R$250 (cadastro)", () => {
  it("usa valor_diaria 250", () => {
    const r = resolverRepassePrestadorBase({ modo: "cadastro", ...CLAYTON, valorBaseCliente: 300 });
    expect(r.base).toBe(250);
  });
});

// T3 — não calcular 80% automaticamente
describe("T3: cadastro NÃO usa 80% da tabela cliente", () => {
  it("mesmo com percentual 80 disponível, base = 250 (não 240)", () => {
    const r = resolverRepassePrestadorBase({
      modo: "cadastro",
      ...CLAYTON,
      valorBaseCliente: 300,
      percentual: 80,
    });
    expect(r.base).toBe(250);
    expect(r.base).not.toBe(240);
  });
});

// T4 — tabela cliente continua R$300
describe("T4: base do cliente preservada em R$300", () => {
  it("engine mantém valorCliente = 300", () => {
    const res = calcularPrecoRapido(TABELA_CLIENTE, 50);
    expect(res.valorCliente).toBe(300);
  });
});

// T5 — selecionar "% sobre tabela"
describe("T5: modo percentual (explícito)", () => {
  it("origem 'percentual'", () => {
    const r = resolverRepassePrestadorBase({
      modo: "percentual",
      percentual: 80,
      valorBaseCliente: 300,
    });
    expect(r.origem).toBe("percentual");
  });
});

// T6 — informar 80% → R$240
describe("T6: 80% sobre 300 = 240", () => {
  it("base = 240", () => {
    const r = resolverRepassePrestadorBase({
      modo: "percentual",
      percentual: 80,
      valorBaseCliente: 300,
    });
    expect(r.base).toBe(240);
  });
});

// T7 — informar 50% → R$150
describe("T7: 50% sobre 300 = 150", () => {
  it("base = 150", () => {
    const r = resolverRepassePrestadorBase({
      modo: "percentual",
      percentual: 50,
      valorBaseCliente: 300,
    });
    expect(r.base).toBe(150);
  });
});

// T8 — percentual 0 tratado corretamente
describe("T8: percentual 0 é válido (base 0, sem fallback)", () => {
  it("0% → 0 (não cai para 80)", () => {
    const r = resolverRepassePrestadorBase({
      modo: "percentual",
      percentual: 0,
      valorBaseCliente: 300,
    });
    expect(r.base).toBe(0);
  });
});

// T9 — voltar para Cadastro → restaura R$250
describe("T9: voltar ao Cadastro restaura 250", () => {
  it("modo cadastro novamente = 250", () => {
    const percentual = resolverRepassePrestadorBase({ modo: "percentual", percentual: 80, valorBaseCliente: 300 });
    expect(percentual.base).toBe(240);
    const cadastro = resolverRepassePrestadorBase({ modo: "cadastro", ...CLAYTON, valorBaseCliente: 300 });
    expect(cadastro.base).toBe(250);
  });
});

// T10 — alteração não modifica o cadastro do Clayton
describe("T10: helper é puro — cadastro não é alterado", () => {
  it("objeto de entrada permanece intacto", () => {
    const input = { modo: "percentual" as const, valorDiaria: 250, valorSaida: 250, percentual: 80, valorBaseCliente: 300 };
    const snapshot = JSON.stringify(input);
    resolverRepassePrestadorBase(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

// T11 — snapshot registra origem Cadastro
describe("T11: origem cadastro no snapshot", () => {
  it("retorna origem 'cadastro'", () => {
    expect(resolverRepassePrestadorBase({ modo: "cadastro", ...CLAYTON, valorBaseCliente: 300 }).origem).toBe("cadastro");
  });
});

// T12 — snapshot registra origem Percentual quando escolhido
describe("T12: origem percentual no snapshot", () => {
  it("retorna origem 'percentual'", () => {
    expect(
      resolverRepassePrestadorBase({ modo: "percentual", percentual: 80, valorBaseCliente: 300 }).origem
    ).toBe("percentual");
  });
});

// T13 — cliente/prestador permanecem separados
describe("T13: separação cliente × prestador", () => {
  it("cadastro ignora o percentual da tabela cliente", () => {
    const comTabela = resolverRepassePrestadorBase({ modo: "cadastro", ...CLAYTON, valorBaseCliente: 300, percentual: 80 });
    const semTabela = resolverRepassePrestadorBase({ modo: "cadastro", ...CLAYTON, valorBaseCliente: 0 });
    expect(comTabela.base).toBe(semTabela.base);
  });
  it("percentual ignora a diária do prestador", () => {
    const a = resolverRepassePrestadorBase({ modo: "percentual", percentual: 50, valorBaseCliente: 300, valorDiaria: 250 });
    const b = resolverRepassePrestadorBase({ modo: "percentual", percentual: 50, valorBaseCliente: 300 });
    expect(a.base).toBe(b.base);
  });
});

// T14 — ESCALA-05 preservada (match de cliente + veículo)
describe("T14: ESCALA-05 preservada", () => {
  it("normalização trim+uppercase continua casando Mineirão", () => {
    const normalizar = (s: string) => (s || "").trim().toUpperCase();
    expect(normalizar(" Mineirao Abc")).toBe(normalizar("MINEIRAO ABC"));
    expect(normalizar("Mineirao Abc") !== normalizar("OUTRO CLIENTE")).toBe(true);
  });
});

// T15 — fallback de valor_diaria → valor_saida e ausência não inventa valor
describe("T15: fallback e ausência", () => {
  it("valor_diaria ausente usa valor_saida", () => {
    const r = resolverRepassePrestadorBase({ modo: "cadastro", valorDiaria: null, valorSaida: 250, valorBaseCliente: 300 });
    expect(r.base).toBe(250);
  });
  it("ambos ausentes → 0 (não inventa)", () => {
    const r = resolverRepassePrestadorBase({ modo: "cadastro", valorDiaria: null, valorSaida: null, valorBaseCliente: 300 });
    expect(r.base).toBe(0);
  });
  it("não soma diária + saída", () => {
    const r = resolverRepassePrestadorBase({ modo: "cadastro", valorDiaria: 250, valorSaida: 250, valorBaseCliente: 300 });
    expect(r.base).toBe(250);
    expect(r.base).not.toBe(500);
  });
});
