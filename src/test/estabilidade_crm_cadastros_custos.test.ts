/**
 * ESTABILIDADE + CRM + CADASTROS + UNIT ECONOMICS
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  calcularCustoOperacional,
  consumoPadraoPorTipo,
} from "@/services/economia/custoOperacionalService";
import { precoCombustivelParaCalculo } from "@/services/combustiveis";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const ALERTA = readSrc("src/components/dashboard/AlertaOscotacaoExpress.tsx");
const CRM_LEADS_TABLE = readSrc("src/components/comercial/crm/CrmLeadsTable.tsx");
const CRM_PIPELINE = readSrc("src/components/comercial/crm/CrmPipeline.tsx");
const AGENDA = readSrc("src/components/comercial/crm/AgendaComercial.tsx");
const CRM_BASE = readSrc("src/components/comercial/crm/CrmBase.tsx");
const CRM_TYPES = readSrc("src/components/comercial/crm/crmTypes.ts");
const PROPOSTAS = readSrc("src/components/comercial/propostas/ListaPropostas.tsx");
const CLIENTES = readSrc("src/components/clientes/ClientesLista.tsx");
const PRESTADORES = readSrc("src/components/prestadores/PrestadoresLista.tsx");
const COMBUSTIVEIS_PAGE = readSrc("src/pages/Combustiveis.tsx");
const COMBUSTIVEIS_SERVICE = readSrc("src/services/combustiveis.ts");
const OS_FORM = readSrc("src/components/operacao/OrdemServicoForm.tsx");
const COTACAO_CALC = readSrc("src/services/cotacoes/cotacaoCalculoService.ts");
const MIGRATION = readSrc("supabase/migrations/20261103000000_economia_operacional_crm.sql");
const VEICULO_UI = readSrc("src/components/veiculos/VeiculoDetalhe.tsx");
const PRESTADOR_UI = readSrc("src/components/prestadores/PrestadorDetalhe.tsx");
const PAYLOAD = readSrc("src/helpers/veiculoPayload.ts");

describe("1) Estabilidade Realtime e Radix Select", () => {
  it("configura .on antes do .subscribe e usa canal único", () => {
    const onPos = ALERTA.indexOf(".on(");
    const subscribePos = ALERTA.indexOf(".subscribe()");
    expect(onPos).toBeGreaterThan(-1);
    expect(subscribePos).toBeGreaterThan(onPos);
    expect(ALERTA).toContain("os-site-solicitacoes-${Date.now()}");
  });

  it("não envia valor vazio para SelectItem de responsáveis", () => {
    expect(CRM_LEADS_TABLE).toContain("String(l.responsavel || \"\").trim()).filter(Boolean)");
  });
});

describe("2) CRM e Propostas", () => {
  it("Novo Lead e Nova Tarefa possuem Endereço", () => {
    expect(CRM_PIPELINE).toContain("Endereço");
    expect(CRM_PIPELINE).toContain("form.endereco");
    expect(AGENDA).toContain("Endereço");
    expect(AGENDA).toContain("novaTarefa.endereco");
    expect(CRM_TYPES).toContain("endereco?: string");
    expect(CRM_BASE).toContain("endereco: lead.endereco || \"\"");
  });

  it("exportação PDF e link funcionam no dropdown", () => {
    expect(PROPOSTAS).toContain("gerarPDFProfissional");
    expect(PROPOSTAS).toContain("void exportarProposta(p, false)");
    expect(PROPOSTAS).toContain("compartilharProposta(p)");
    expect(PROPOSTAS).toContain("navigator.clipboard.writeText(link)");
  });
});

describe("3) Filtros globais em Cadastros", () => {
  it("Clientes busca status, segmento, telefone, e-mail, localidade e responsáveis", () => {
    expect(CLIENTES).toContain("status.ilike.");
    expect(CLIENTES).toContain("segmento.ilike.");
    expect(CLIENTES).toContain("telefone.ilike.");
    expect(CLIENTES).toContain("email.ilike.");
    expect(CLIENTES).toContain("cidade.ilike.");
    expect(CLIENTES).toContain("responsavel_operacional.ilike.");
    expect(CLIENTES).toContain("filtroStatus");
    expect(CLIENTES).toContain("filtroSegmento");
  });

  it("Prestadores busca contato, região, tipo e status", () => {
    expect(PRESTADORES).toContain("telefone.ilike.");
    expect(PRESTADORES).toContain("whatsapp.ilike.");
    expect(PRESTADORES).toContain("email.ilike.");
    expect(PRESTADORES).toContain("regiao_principal.ilike.");
    expect(PRESTADORES).toContain("tipo_parceiro.ilike.");
    expect(PRESTADORES).toContain("status.ilike.");
  });
});

describe("4) Unit economics", () => {
  it("calcula combustível + manutenção + pedágio", () => {
    const r = calcularCustoOperacional({
      distanciaKm: 100,
      parametros: { consumoKmPorL: 10, custoManutencaoKm: 0.2, tipoCombustivel: "diesel", origem: "padrao" },
      precoCombustivel: 6,
      pedagio: 10,
    });
    expect(r.litrosEstimados).toBe(10);
    expect(r.custoCombustivel).toBe(60);
    expect(r.custoManutencao).toBe(20);
    expect(r.custoTotal).toBe(90);
    expect(r.custoPorKm).toBeCloseTo(0.9, 2);
  });

  it("tem base de consumo por tipo e preço ANP simulado", () => {
    expect(consumoPadraoPorTipo("moto")).toBe(30);
    expect(consumoPadraoPorTipo("truck")).toBe(5.5);
    expect(precoCombustivelParaCalculo("Diesel S10")).toBeGreaterThan(0);
  });

  it("página de combustível consome a base e o serviço expõe painel", () => {
    expect(COMBUSTIVEIS_SERVICE).toContain("obterPainelPrecos");
    expect(COMBUSTIVEIS_SERVICE).toContain("ANP (simulado");
    expect(COMBUSTIVEIS_PAGE).toContain("combustiveisService.obterPainelPrecos");
  });

  it("campos de consumo/manutenção existem em banco, mapeadores e UI", () => {
    expect(MIGRATION).toContain("media_consumo_km_l");
    expect(MIGRATION).toContain("custo_manutencao_km");
    expect(MIGRATION).toContain("tipo_combustivel");
    expect(PAYLOAD).toContain("media_consumo_km_l");
    expect(VEICULO_UI).toContain("Média de Consumo (km/L)");
    expect(PRESTADOR_UI).toContain("Custo Médio Manutenção (R$/km)");
  });

  it("OS e cotações usam o custo operacional", () => {
    expect(OS_FORM).toContain("estimarCustoOperacional");
    expect(OS_FORM).toContain("Custo Operacional Real do Frete");
    expect(COTACAO_CALC).toContain("custo_operacional_estimado");
    expect(COTACAO_CALC).toContain("estimarCustoOperacional");
  });
});
