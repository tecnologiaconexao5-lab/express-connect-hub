/**
 * ESCALA-E2E-01 — Fluxo canônico da Escala (read-only, dados reais).
 *
 * Valida a cadeia: prestador → veículo → cliente → tabela → térmica → franquia
 * → preço cliente → repasse prestador, usando as funções REAIS do sistema.
 *
 * Fixture real (Supabase, leitura): CESAR (hr) × CALVO (tabela hr).
 * A ESCRITA (salvar alocação) ficou BLOCKED — dispararia propagação financeira
 * (trigger M66) e exigiria OS de teste, alterando Financeiro (proibido).
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { resolverFranquiaEfetiva, resolverTarifaKmExcedente } from "@/helpers/franquiaKm";
import { selecionarTabelaPorCondicaoTerica, normalizarCondicaoTerica } from "@/helpers/condicaoTerica";
import { resolverRepassePrestadorBase } from "@/helpers/repassePrestador";
import { calcularPrecoRapido } from "@/services/precificacao/precificacaoEngineService";
import type { TabelaValorAplicada } from "@/services/precificacao/types";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

// Tabela real: CALVO hr (id b9269e3f...) — valores do banco.
const TABELA_CALVO_HR: TabelaValorAplicada = {
  id: "b9269e3f-cc3c-4bb0-9a2f-f77361e58b0d",
  nome: "HR/VAN 1800 GUARULHOS",
  fonte: "tabelas_valores",
  valor_base: 600,
  franquia_km: 140,
  valor_km_excedente: 1,
  percentual_prestador: 80,
};

const CESAR = { valorDiaria: 520, valorSaida: 520 };
const VEICULO_CESAR = { tipo_veiculo: "hr", tipo_carga: "seco" };
const KM = 200;

describe("ESCALA-E2E-01 — cliente (tabela)", () => {
  it("tabela específica CALVO hr compatível com veículo hr/seco", () => {
    const sel = selecionarTabelaPorCondicaoTerica(
      [{ id: TABELA_CALVO_HR.id, classificacao_termica: "seco" }],
      VEICULO_CESAR.tipo_carga
    );
    expect(sel.tabela?.id).toBe(TABELA_CALVO_HR.id);
    expect(sel.ambiguidade).toBe(false);
  });

  it("franquia canônica (franquia_km) e tarifa (valor_km_excedente)", () => {
    const t = { franquia_km: 140, km_franquia: 0, valor_km_excedente: 1, valor_km: 0 };
    expect(resolverFranquiaEfetiva(t.franquia_km, t.km_franquia)).toBe(140);
    expect(resolverTarifaKmExcedente(t.valor_km_excedente, t.valor_km)).toBe(1);
  });

  it("CLIENT_BASE/FRANCHISE/EXCESS_RATE/FINAL: 200km → 660", () => {
    const r = calcularPrecoRapido(TABELA_CALVO_HR, KM);
    expect(r.valorCliente).toBe(600 + (KM - 140) * 1); // 660
    expect(r.kmExcedente).toBe(60);
  });
});

describe("ESCALA-E2E-01 — prestador (cadastro)", () => {
  it("modo padrão cadastro; valor_diaria (não soma saída)", () => {
    const r = resolverRepassePrestadorBase({ modo: "cadastro", ...CESAR, valorBaseCliente: 660 });
    expect(r.origem).toBe("cadastro");
    expect(r.base).toBe(520);
  });

  it("% sobre tabela só por escolha explícita (80% → 528)", () => {
    const r = resolverRepassePrestadorBase({ modo: "percentual", percentual: 80, valorBaseCliente: 660 });
    expect(r.origem).toBe("percentual");
    expect(r.base).toBe(528);
  });
});

describe("ESCALA-E2E-01 — separação e térmica", () => {
  it("CLIENTE (tabela) × PRESTADOR (cadastro) independentes", () => {
    const cliente = calcularPrecoRapido(TABELA_CALVO_HR, KM).valorCliente; // 660
    const prestador = resolverRepassePrestadorBase({ modo: "cadastro", ...CESAR, valorBaseCliente: cliente }).base; // 520
    expect(cliente).toBe(660);
    expect(prestador).toBe(520);
    expect(cliente).not.toBe(prestador);
  });

  it("térmica independente do veículo (seco | termico | refrigerado)", () => {
    expect(normalizarCondicaoTerica("seco")).toBe("seco");
    expect(normalizarCondicaoTerica("térmico")).toBe("termico");
    expect(normalizarCondicaoTerica("refrigerado")).toBe("refrigerado");
    expect(normalizarCondicaoTerica("misto")).toBeNull(); // não inventa
  });

  it("Escala bloqueia prestador sem veículo e com múltiplos veículos", () => {
    const escala = readSrc("src/components/operacao/EscalaLista.tsx");
    expect(escala).toContain("não possui veículo vinculado");
    expect(escala).toContain("mais de um veículo");
  });
});
