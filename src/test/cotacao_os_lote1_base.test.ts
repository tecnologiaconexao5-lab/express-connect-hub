// ============================================================
// LOTE 1 — CORREÇÕES DE BASE (COTAÇÃO → OS + PDF)
// Cobre: fuso da OS, herança de nome/telefone, endereços desmembrados,
// status inicial "Em Análise" e faixa superior azul escura no PDF.
// ============================================================
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  montarParadasFase1,
  montarOrcamentoDaCotacao,
  type CotacaoPublica,
  type EnderecoEstruturadoCotacao,
} from "@/services/cotacoes/cotacaoPublicaService";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const migracao = readSrc("supabase/migrations/20261109000000_cotacao_os_correcoes_base.sql");
const service = readSrc("src/services/cotacoes/cotacaoPublicaService.ts");
const wizard = readSrc("src/pages/CotacaoExpress.tsx");
const orcamentoToOS = readSrc("src/services/comercial/orcamentoToOSService.ts");
const orcamentoForm = readSrc("src/components/comercial/OrcamentoForm.tsx");
const foundation = readSrc("src/lib/pdf/foundation.ts");
const cotacaoPdf = readSrc("src/lib/cotacaoPdf.ts");

const detalhe: EnderecoEstruturadoCotacao = {
  logradouro: "Av. Paulista",
  numero: "1000",
  bairro: "Bela Vista",
  cidade: "São Paulo",
  uf: "SP",
  cep: "01310-100",
  lat: -23.5613,
  lng: -46.6565,
  place_name: "Av. Paulista, 1000, Bela Vista, São Paulo - SP, 01310-100",
};

const cotacaoExemplo = (): CotacaoPublica => ({
  id: "11111111-1111-1111-1111-111111111111",
  status: "Pronto para OS",
  nome_cliente: "Ferreira",
  telefone: "11988887777",
  carga_descricao: "Encomenda",
  carga_peso: 10,
  carga_dimensoes: "40x40x40 cm",
  carga_volumes: 1,
  paradas: [
    {
      sequencia: 1,
      tipo: "retirada",
      endereco: "Av. Paulista, 1000, Bela Vista, São Paulo - SP, 01310-100",
      enderecoDetalhado: detalhe,
    },
    {
      sequencia: 2,
      tipo: "entrega",
      endereco: "Rua Augusta, 500, Consolação, São Paulo - SP, 01305-000",
      enderecoDetalhado: {
        ...detalhe,
        logradouro: "Rua Augusta",
        numero: "500",
        bairro: "Consolação",
        cep: "01305-000",
      },
    },
  ],
  data_desejada: null,
  hora_desejada: null,
  detalhes: [],
  orcamento_id: null,
  valor_aprovado: 150,
  metadata: {
    precificacao: { valor: 150, rotulo_veiculo: "Fiorino" } as unknown as CotacaoPublica["metadata"]["precificacao"],
  },
  created_at: "2026-11-09T09:38:00",
});

describe("1) Fuso horário da OS (America/Sao_Paulo)", () => {
  it("1.1 migration grava created_at/updated_at/histórico da OS no fuso local", () => {
    expect(migracao).toContain("now() AT TIME ZONE 'America/Sao_Paulo'");
    // O INSERT da OS usa o fuso local nas colunas created_at/updated_at.
    const blocoOs = migracao.slice(
      migracao.indexOf("INSERT INTO public.ordens_servico"),
      migracao.indexOf("RETURNING id INTO v_os_id"),
    );
    expect(blocoOs).toContain("(now() AT TIME ZONE 'America/Sao_Paulo')");
    expect(blocoOs).not.toMatch(/,\s*now\(\),\s*now\(\)\s*\)\s*RETURNING/);
  });

  it("1.2 fluxo Orçamento→OS também usa o fuso local", () => {
    expect(orcamentoToOS).toContain("agoraSaoPauloISO");
    expect(orcamentoToOS).toContain("created_at: agoraSaoPauloISO()");
    expect(orcamentoToOS).toContain("updated_at: agoraSaoPauloISO()");
  });
});

describe("2) Cliente herdado (nome + telefone da cotação)", () => {
  it("2.1 migration renomeia cadastro casado por telefone e sincroniza telefone", () => {
    expect(migracao).toContain("SET nome_fantasia = v_cliente_nome");
    expect(migracao).toContain("regexp_replace(COALESCE(telefone");
    expect(migracao).toContain("whatsapp = v_telefone");
  });

  it("2.2 serviço de pré-preenchimento espelha a mesma regra", () => {
    expect(service).toContain("casouPorTelefone");
    expect(service).toContain("patch.nome_fantasia = nome");
    expect(service).toContain("patch.razao_social = nome");
  });

  it("2.3 OrcamentoForm mantém clienteId em sincronia com a seleção", () => {
    expect(orcamentoForm).toContain('update("clienteId"');
    expect(orcamentoForm).toContain("rec?.id ? String(rec.id) : undefined");
  });
});

describe("3) Endereços desmembrados (Rua/Número/Bairro/Cidade/UF/CEP)", () => {
  it("3.1 service persiste a sugestão estruturada nas paradas", () => {
    expect(service).toContain("enderecoDetalhado");
    expect(service).toContain("paradasDetalhes");
    expect(service).toContain("montarParadasFase1(input.paradas, input.paradasTipos, input.paradasDetalhes)");
  });

  it("3.2 wizard envia rua/número/bairro/cidade/UF/CEP/coordenadas", () => {
    expect(wizard).toContain("detalheDaParada");
    expect(wizard).toContain("paradasDetalhes: pontosComTipo.map((p) => p.detalhe)");
    expect(wizard).toContain("logradouro: s.rua || \"\"");
    expect(wizard).toContain("bairro: s.bairro || \"\"");
    expect(wizard).toContain("cidade: s.cidade || \"\"");
    expect(wizard).toContain("uf: s.uf || \"\"");
  });

  it("3.3 migration desmembra e monta o endereço completo na OS", () => {
    expect(migracao).toContain("f_endereco_cotacao_os");
    expect(migracao).toContain("f_parse_endereco_cotacao");
    for (const campo of ["logradouro", "numero", "bairro", "cidade", "uf", "estado", "cep"]) {
      expect(migracao).toContain(`'${campo}'`);
    }
  });

  it("3.4 montarParadasFase1 mantém o endereço estruturado", () => {
    const paradas = montarParadasFase1(["Av. Paulista, 1000"], ["retirada"], [detalhe]);
    expect(paradas).toHaveLength(1);
    expect(paradas[0].enderecoDetalhado).toEqual(detalhe);
  });

  it("3.5 montarOrcamentoDaCotacao usa o estruturado (rua/número/cidade/UF/CEP)", () => {
    const orc = montarOrcamentoDaCotacao(cotacaoExemplo());
    expect(orc.enderecos[0].endereco).toBe("Av. Paulista, 1000");
    expect(orc.enderecos[0].cidade).toBe("São Paulo");
    expect(orc.enderecos[0].uf).toBe("SP");
    expect(orc.enderecos[0].cep).toBe("01310-100");
    expect(orc.enderecos[1].endereco).toBe("Rua Augusta, 500");
  });
});

describe("4) Status inicial da OS (Em Análise)", () => {
  it("4.1 OS nasce 'em_analise' na migration", () => {
    const blocoOs = migracao.slice(
      migracao.indexOf("INSERT INTO public.ordens_servico"),
      migracao.indexOf("RETURNING id INTO v_os_id"),
    );
    expect(blocoOs).toContain("'em_analise'");
  });

  it("4.2 blindagem 'aguardando' não rebaixa para rascunho", () => {
    expect(migracao).toContain("SET status = 'em_analise'");
    expect(migracao).not.toContain("SET status = 'rascunho'");
  });
});

describe("5) PDF — faixa superior azul escuro com logo branco", () => {
  it("5.1 header suporta tema dark (fundo NAVY + textos brancos)", () => {
    expect(foundation).toContain('theme?: "light" | "dark"');
    expect(foundation).toContain('opts.theme === "dark"');
    expect(foundation).toContain("doc.setFillColor(NAVY[0], NAVY[1], NAVY[2])");
    expect(foundation).toContain("WHITE[0]");
  });

  it("5.2 proposta comercial da cotação usa o tema dark", () => {
    expect(cotacaoPdf).toContain('theme: "dark"');
    expect(cotacaoPdf).toContain("PROPOSTA COMERCIAL");
  });
});
