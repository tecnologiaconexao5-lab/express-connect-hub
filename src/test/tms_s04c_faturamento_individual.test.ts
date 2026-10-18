import { describe, it, expect, beforeAll } from "vitest";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { DadosEmpresaFatura } from "@/services/financeiro/faturaService";
import { extrairValorJsonb } from "@/services/relatorios/relatorioService";
import { gerarPDFRelatorioFaturamentoIndividual, type RelatorioFaturamentoIndividualInput } from "@/utils/pdfFatura";
import { gerarPDFRelatorioOperacionalBuffer } from "@/utils/pdfRelatorioOperacional";

// ============================================================================
// TMS-S04C — Relatório Individual de Faturamento do Cliente.
// Valida os cenários A–G com fixture local (sem banco).
// ============================================================================

const LOGO_PATH = join(process.cwd(), "public", "logos", "logo-conexao-oficial.png");
const OUT_DIR = join(process.cwd(), "test-results", "tms-s04c");
const OUT_PDF = join(OUT_DIR, "relatorio_individual_cliente.pdf");
const OUT_PDF_30 = join(OUT_DIR, "relatorio_individual_cliente_30.pdf");

const EMPRESA: DadosEmpresaFatura = {
  razaoSocial: "Conexão Express Transportes LTDA",
  nomeFantasia: "Conexão Express",
  cnpj: "31.227.975/0001-80",
  ie: "123.456.789.000",
  inscricaoMunicipal: null,
  endereco: "Av. Paulista, 1000 - Bela Vista",
  cidade: "São Paulo",
  uf: "SP",
  cep: "01310-100",
  telefone: "(11) 4225-1600",
  email: "financeiro@conexaoexpress.com.br",
  emailFinanceiro: "financeiro@conexaoexpress.com.br",
  banco: "Banco Cora SCFI",
  agencia: "0001",
  conta: "1390923-1",
  pix: "financeiro@conexaoexpress.com.br",
  logoPath: "/logos/logo-conexao-colorido.png",
};

function item(p: Partial<RelatorioFaturamentoIndividualInput["itens"][number]> = {}) {
  return {
    data: "2026-08-16",
    romaneio: "",
    veiculo: "—",
    trajeto: "",
    valorBase: 520,
    kmAdicional: 0,
    pedagio: 0,
    reembolso: 0,
    descontos: 0,
    valorTotal: 520,
    ...p,
  };
}

function input(itens: RelatorioFaturamentoIndividualInput["itens"]): RelatorioFaturamentoIndividualInput {
  const resumo = itens.reduce(
    (a, i) => {
      a.quantidade += 1;
      a.valorBase += i.valorBase;
      a.kmAdicional += i.kmAdicional;
      a.pedagio += i.pedagio;
      a.reembolso += i.reembolso;
      a.descontos += i.descontos;
      a.totalFaturado += i.valorTotal;
      return a;
    },
    { quantidade: 0, valorBase: 0, kmAdicional: 0, pedagio: 0, reembolso: 0, descontos: 0, totalFaturado: 0 }
  );
  return {
    cliente: "Calvo Comércio e Importação Ltda",
    clienteCnpj: "11.222.333/0001-81",
    periodo: "01/08/2026 a 22/08/2026",
    itens,
    resumo,
    empresa: EMPRESA,
    logoBase64: `data:image/png;base64,${readFileSync(LOGO_PATH).toString("base64")}`,
  };
}

/** Remove os bytes de codificação 0x00 que o jsPDF usa como alta ordem por glifo. */
function extrairTextoPDF(buffer: Buffer): string {
  return buffer.toString("latin1").replaceAll("\u0000", "");
}

describe("TMS-S04C — extrairValorJsonb (fonte real do valor adicional)", () => {
  it("número puro", () => {
    expect(extrairValorJsonb(100)).toBe(100);
    expect(extrairValorJsonb(34.2)).toBe(34.2);
  });
  it("objeto {valor}", () => {
    expect(extrairValorJsonb({ valor: 66.43 })).toBeCloseTo(66.43, 2);
  });
  it("objeto de adicionais do pricing (km_excedente, espera...)", () => {
    expect(extrairValorJsonb({ km_excedente: 34.2, espera: 0, reentrega: 12 })).toBeCloseTo(46.2, 2);
  });
  it("string monetária", () => {
    expect(extrairValorJsonb("R$ 100,00")).toBeCloseTo(100, 2);
  });
  it("nulo/vazio → 0", () => {
    expect(extrairValorJsonb(null)).toBe(0);
    expect(extrairValorJsonb(undefined)).toBe(0);
    expect(extrairValorJsonb("")).toBe(0);
  });
});

describe("TMS-S04C — PDF do Relatório Individual (cenários A–G)", () => {
  beforeAll(() => {
    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  });

  it("Cenário A: 1 cliente + 2 operações", async () => {
    const inp = input([
      item({ data: "2026-08-16", romaneio: "343550", veiculo: "Iveco Daily · FSP0I96", valorBase: 520, valorTotal: 520 }),
      item({ data: "2026-08-18", romaneio: "343551", veiculo: "Mercedes 1113 · GHI9J87", valorBase: 520, valorTotal: 520 }),
    ]);
    const doc = await gerarPDFRelatorioFaturamentoIndividual(inp);
    const texto = extrairTextoPDF(Buffer.from(doc.output("arraybuffer")));
    expect(texto).toContain("RELATÓRIO DE FATURAMENTO");
    expect(texto).toContain("Calvo Comércio e Importação Ltda");
    expect(texto).toContain("343550");
    expect(texto).toContain("FSP0I96");
    expect(texto).toContain("R$ 520,00");
    expect(texto).toContain("Página 1 de 1");
  });

  it("Cenário B: adicionais (KM adicional + pedágio) aparecem com valor", async () => {
    const inp = input([
      item({ valorBase: 500, kmAdicional: 34.2, pedagio: 66.43, valorTotal: 600.63 }),
    ]);
    const doc = await gerarPDFRelatorioFaturamentoIndividual(inp);
    const texto = extrairTextoPDF(Buffer.from(doc.output("arraybuffer")));
    expect(texto).toContain("R$ 34,20");
    expect(texto).toContain("R$ 66,43");
    expect(texto).toContain("R$ 600,63");
  });

  it("Cenário C: desconto exibido como negativo", async () => {
    const inp = input([
      item({ valorBase: 520, descontos: 50, valorTotal: 470 }),
    ]);
    const doc = await gerarPDFRelatorioFaturamentoIndividual(inp);
    const texto = extrairTextoPDF(Buffer.from(doc.output("arraybuffer")));
    expect(texto).toContain("-R$ 50,00");
    expect(texto).toContain("R$ 470,00");
  });

  it("Cenário D: sem adicionais → nenhum valor de adicional inventado", async () => {
    const inp = input([
      item({ valorTotal: 520 }),
    ]);
    const doc = await gerarPDFRelatorioFaturamentoIndividual(inp);
    const texto = extrairTextoPDF(Buffer.from(doc.output("arraybuffer")));
    // Sem KM adicional / pedágio / reembolso / desconto inventados
    expect(texto).not.toContain("R$ 34,20");
    expect(texto).not.toContain("R$ 66,43");
    expect(texto).not.toContain("R$ 50,00");
    expect(texto).toContain("R$ 520,00");
  });

  it("Cenário E: 30 operações → multipágina com cabeçalho repetido", async () => {
    const inp = input(
      Array.from({ length: 30 }, (_, i) =>
        item({ data: "2026-08-16", romaneio: `ROM-${i}`, valorBase: 520, valorTotal: 520 })
      )
    );
    const doc = await gerarPDFRelatorioFaturamentoIndividual(inp);
    const pages = doc.getNumberOfPages();
    expect(pages).toBeGreaterThan(1);
    writeFileSync(OUT_PDF_30, Buffer.from(doc.output("arraybuffer")));
    const texto = extrairTextoPDF(Buffer.from(doc.output("arraybuffer")));
    expect(texto).toContain("Página 2 de");
    expect(texto).toContain("TOTAL FATURADO");
  });

  it("Cenário F: nenhum UUID aparece no PDF", async () => {
    const inp = input([
      item({ valorTotal: 520 }),
      item({ valorTotal: 600 }),
    ]);
    const doc = await gerarPDFRelatorioFaturamentoIndividual(inp);
    const texto = extrairTextoPDF(Buffer.from(doc.output("arraybuffer")));
    expect(texto).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(texto).not.toContain("cliente_id");
    expect(texto).not.toContain("os_id");
  });

  it("Cenário G: quantidade NÃO usa formato monetário", async () => {
    const inp = input([
      item({ valorTotal: 520 }),
      item({ valorTotal: 520 }),
      item({ valorTotal: 520 }),
      item({ valorTotal: 520 }),
      item({ valorTotal: 520 }),
    ]);
    const doc = await gerarPDFRelatorioFaturamentoIndividual(inp);
    const texto = extrairTextoPDF(Buffer.from(doc.output("arraybuffer")));
    expect(texto).toContain("Quantidade de serviços");
    expect(texto).not.toContain("R$ 5,00");
    expect(texto).toContain("R$ 2.600,00"); // 5 × 520 total faturado
  });

  it("gera o PDF de prova com dados reais (1 cliente + 2 operações + adicionais)", async () => {
    const inp = input([
      item({ data: "2026-08-16", romaneio: "343550", veiculo: "Iveco Daily · FSP0I96", trajeto: "Guarulhos › Morumbi", valorBase: 500, kmAdicional: 34.2, pedagio: 66.43, valorTotal: 600.63 }),
      item({ data: "2026-08-18", romaneio: "343551", veiculo: "Mercedes 1113 · GHI9J87", trajeto: "Campinas › Osasco", valorBase: 520, descontos: 50, valorTotal: 470 }),
    ]);
    const doc = await gerarPDFRelatorioFaturamentoIndividual(inp);
    writeFileSync(OUT_PDF, Buffer.from(doc.output("arraybuffer")));
    console.log("[TMS-S04C] PDF gerado em:", OUT_PDF, "bytes:", (await doc.output("arraybuffer")).byteLength);
    expect(existsSync(OUT_PDF)).toBe(true);
    const texto = extrairTextoPDF(Buffer.from(doc.output("arraybuffer")));
    expect(texto).toContain("Calvo Comércio e Importação Ltda");
    expect(texto).toContain("01/08/2026 a 22/08/2026");
    expect(texto).toContain("R$ 600,63");
    expect(texto).toContain("R$ 470,00");
  });

  it("Relatório agregado: quantidades NÃO usam formato monetário (moeda:false)", async () => {
    const buf = await gerarPDFRelatorioOperacionalBuffer({
      titulo: "Relatório Operacional de Faturamento",
      subtitulo: "Faturamento por cliente — visão operacional consolidada",
      periodo: "01/08/2026 a 22/08/2026",
      colunas: ["Cliente", "Qtd OS", "Valor Faturado"],
      linhas: [
        ["Cliente A", "2", "R$ 1.000,00"],
        ["Cliente B", "3", "R$ 1.500,00"],
      ],
      totais: [
        { label: "Total de Clientes:", valor: "2", moeda: false },
        { label: "Total Faturado:", valor: "R$ 2.500,00" },
        { label: "Total de Operações:", valor: "5", moeda: false },
      ],
      orientacao: "landscape",
    });
    const texto = extrairTextoPDF(Buffer.from(buf));
    expect(texto).toContain("Total de Clientes:");
    expect(texto).toContain("Total de Operações:");
    // Quantidade NUNCA com "R$" (espaço normal ou não-separável)
    const nbsp = "\u00a0";
    expect(texto).not.toContain("R$ 2,00");
    expect(texto).not.toContain(`R$${nbsp}2,00`);
    expect(texto).not.toContain("R$ 5,00");
    expect(texto).not.toContain(`R$${nbsp}5,00`);
    // Total faturado (moeda) presente
    expect(texto).toContain("2.500,00");
  });
});
