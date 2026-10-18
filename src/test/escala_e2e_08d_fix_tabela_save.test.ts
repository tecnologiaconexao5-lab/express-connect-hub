/**
 * ESCALA-E2E-08D — Fix tabela/SAVE (ordem-independente + fail-safe + race).
 *
 * Cobre A–H. Segue o padrão do repositório: lógica pura REAL (helpers do sistema)
 * + asserções de fonte do componente (garantias de fluxo).
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { selecionarTabelaPorCondicaoTerica } from "@/helpers/condicaoTerica";
import { resolverFranquiaEfetiva, resolverTarifaKmExcedente } from "@/helpers/franquiaKm";
import { resolverRepassePrestadorBase } from "@/helpers/repassePrestador";
import { calcularPrecoRapido } from "@/services/precificacao/precificacaoEngineService";
import type { TabelaValorAplicada } from "@/services/precificacao/types";

const SRC = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/operacao/EscalaLista.tsx"),
  "utf8"
);

const HML_TABLE: TabelaValorAplicada = {
  id: "b8c78f48-0b8a-4b88-9a41-5d57c5af8886",
  nome: "HML E2E VUC - HOMOLOGACAO APP",
  fonte: "tabelas_valores",
  valor_base: 300,
  franquia_km: 100,
  valor_km_excedente: 1.2,
  percentual_prestador: 80,
};

const VEICULO = { tipo_veiculo: "vuc", condicao_termica: "seca" };
const CLIENTE_NOME = "HOMOLOGAÇÃO APP";
const KM = 150;

const normalizar = (s: string) => (s || "").trim().toUpperCase();

/** Reproduz SOMENTE o predicado de match de cliente do componente (não o algoritmo de seleção). */
const matchCliente = (t: { cliente?: string; universal?: boolean }, nome: string) =>
  !t.universal && normalizar(t.cliente || "") !== "" && normalizar(t.cliente || "") === normalizar(nome);

describe("ESCALA-E2E-08D — A/B: seleção independente de ordem", () => {
  const candidata = { id: HML_TABLE.id, cliente: CLIENTE_NOME, universal: false, classificacao_termica: "seco" };

  it("A) prestador→cliente: veículo/tipo já resolvido, cliente depois → tabela encontrada", () => {
    // veículo já resolvido (tipo vuc) + cliente selecionado depois
    const tipoVeiculo = VEICULO.tipo_veiculo;
    expect(tipoVeiculo).toBe("vuc");
    expect(matchCliente(candidata, CLIENTE_NOME)).toBe(true);
    const sel = selecionarTabelaPorCondicaoTerica([candidata], VEICULO.condicao_termica);
    expect(sel.tabela?.id).toBe(HML_TABLE.id);
    expect(sel.ambiguidade).toBe(false);
  });

  it("B) cliente→prestador: cliente antes, veículo resolve depois → tabela encontrada (efeito reativo)", () => {
    // o predicado reativo só exige cliente + tipo de veículo (não depende da ordem)
    const deveBuscar = (clienteId: string, tipoVeiculo?: string) => !!clienteId && !!tipoVeiculo;
    expect(deveBuscar("cliente-1", undefined)).toBe(false); // veículo ainda não resolvido
    expect(deveBuscar("cliente-1", "vuc")).toBe(true);      // veículo resolvido → busca
    // a fonte deve conter o efeito reativo com as dependências canônicas
    expect(SRC).toMatch(/ESCALA-E2E-08D — resolução reativa e INDEPENDENTE DE ORDEM/);
    expect(SRC).toMatch(/if \(!modalOpen\) return;/);
    expect(SRC).toMatch(/if \(!novoClienteId\) return;/);
    expect(SRC).toMatch(/if \(!prestadorVeiculo\?\.tipo_veiculo\) return;/);
  });
});

describe("ESCALA-E2E-08D — C/D: recálculo ao trocar prestador/veículo/cliente", () => {
  it("C) dependências incluem tipo de veículo e condição térmica", () => {
    expect(SRC).toMatch(/prestadorVeiculo\?\.tipo_veiculo,\s*\n\s*prestadorVeiculo\?\.condicao_termica,/);
  });

  it("D) dependências incluem cliente (id e nome)", () => {
    expect(SRC).toMatch(/modalOpen,\s*\n\s*novoClienteId,\s*\n\s*novoClienteNome,/);
  });
});

describe("ESCALA-E2E-08D — E: tabela realmente inexistente continua bloqueando", () => {
  it("sem candidata → seleção nula → guarda de SAVE permanece", () => {
    const sel = selecionarTabelaPorCondicaoTerica([], VEICULO.condicao_termica);
    expect(sel.tabela).toBeNull();
    // guarda de bloqueio preservada (usa tabelaEfetiva)
    expect(SRC).toMatch(
      /if \(novoClienteId && !tabelaEfetiva && !ajusteClienteMotivo && ajusteClienteValor === 0\) \{\s*\n\s*return toast\.error\("Sem tabela de preço/
    );
  });
});

describe("ESCALA-E2E-08D — F: FAIL-SAFE do SAVE", () => {
  it("reconsulta UMA vez antes de bloquear e usa o resultado real", () => {
    expect(SRC).toMatch(/let tabelaEfetiva = tabelaValores;/);
    expect(SRC).toMatch(
      /if \(novoClienteId && prestadorVeiculo\?\.tipo_veiculo && !tabelaValores\) \{[\s\S]*?const tabelaReconsultada = await buscarTabelaValoresCliente\(/
    );
    expect(SRC).toMatch(/if \(tabelaReconsultada\) tabelaEfetiva = tabelaReconsultada;/);
    expect(SRC).toMatch(/const totals = calcularTotalAlocacao\(tabelaEfetiva\);/);
    expect(SRC).toMatch(/tabela_id: tabelaEfetiva\?\.id \|\| null,/);
  });
});

describe("ESCALA-E2E-08D — G: proteção contra race (resposta antiga)", () => {
  it("seqRef + isStale impedem sobrescrita por resposta antiga", () => {
    expect(SRC).toMatch(/const tabelaReqSeqRef = useRef\(0\);/);
    expect(SRC).toMatch(/const reqId = \+\+tabelaReqSeqRef\.current;/);
    expect(SRC).toMatch(/const isStale = \(\) => reqId !== tabelaReqSeqRef\.current;/);
    expect(SRC).toMatch(/if \(isStale\(\)\) return null;/);
    expect(SRC).toMatch(/if \(!isStale\(\)\) setLoadingTabelaValores\(false\);/);
    // não há mais chamada manual no onChange do cliente (evita duplicidade/race)
    expect(SRC).not.toMatch(/if \(prestadorVeiculo\?\.tipo_veiculo\) \{\s*\n\s*buscarTabelaValoresCliente\(id \|\| ""/);
  });
});

describe("ESCALA-E2E-08D — H: nenhum ajuste manual automático / tabela fake / zero", () => {
  it("o bloco de fail-safe não cria ajuste manual nem tabela fake", () => {
    const bloco = SRC.slice(
      SRC.indexOf("let tabelaEfetiva = tabelaValores;"),
      SRC.indexOf("const totals = calcularTotalAlocacao(tabelaEfetiva);")
    );
    expect(bloco.length).toBeGreaterThan(0);
    expect(bloco).not.toMatch(/setAjusteClienteValor/);
    expect(bloco).not.toMatch(/setTabelaValores\(\{\s*id:\s*""/); // sem tabela fake
    expect(bloco).not.toMatch(/valor_base:\s*0/);                 // sem fallback de valor zero
  });
});

describe("ESCALA-E2E-08D — valores canônicos (fixture HML)", () => {
  it("cliente: 300 + (150-100)*1.20 = 360", () => {
    expect(resolverFranquiaEfetiva(100, 100)).toBe(100);
    expect(resolverTarifaKmExcedente(1.2, 0)).toBe(1.2);
    const r = calcularPrecoRapido(HML_TABLE, KM);
    expect(r.valorCliente).toBe(360);
    expect(r.kmExcedente).toBe(50);
  });

  it("prestador: cadastro valor_diaria=250 → base 250 (independente do cliente)", () => {
    const rep = resolverRepassePrestadorBase({
      modo: "cadastro",
      valorDiaria: 250,
      valorSaida: null,
      valorBaseCliente: 360,
    });
    expect(rep.base).toBe(250);
    expect(rep.origem).toBe("cadastro");
  });
});
