/**
 * FAT-PDF-CNPJ-01 — CNPJ do emitente da FATURA.
 *
 * Correto: 31.227.975/0001-80
 * Antigo (proibido): 42.796.040/0001-31
 *
 * Prova:
 *  - o gerador de PDF de Fatura renderiza o CNPJ da empresa fornecida (fonte),
 *    não um hardcode;
 *  - nenhum arquivo de runtime contém o CNPJ antigo;
 *  - empresaConfig (config canônica local) usa o CNPJ correto;
 *  - cliente/valores/vencimento/descrição/dados bancários preservados.
 *
 * A fonte do CNPJ da Fatura em produção é buscarDadosEmpresaParaFatura()
 * (config_financeira_empresa → configuracoes_fiscais → empresaConfig).
 * O valor do banco NÃO é alterado por esta missão (ver relatório).
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { empresaConfig } from "@/utils/empresaConfig";
import { gerarPDFFatura, type PdfFaturaInput } from "@/utils/pdfFatura";
import type { DadosEmpresaFatura } from "@/services/financeiro/faturaService";

const NEW_CNPJ = "31.227.975/0001-80";
const OLD_CNPJ = "42.796.040/0001-31";

function extrairTextoPDF(buffer: Buffer): string {
  return buffer.toString("latin1").replace(/\u0000/g, "");
}

function readSrc(rel: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
}

const EMPRESA: DadosEmpresaFatura = {
  razaoSocial: "Conexão Express Transportes LTDA",
  nomeFantasia: "Conexão Express",
  cnpj: NEW_CNPJ,
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

const CLIENTE_CNPJ = "11.222.333/0001-81";

const INPUT: PdfFaturaInput = {
  modelo: "conexao_express",
  numero: "000038",
  descricao: "Fatura de teste FAT-PDF-CNPJ-01",
  cliente: "Calvo Comércio e Importação Ltda",
  clienteCnpj: CLIENTE_CNPJ,
  clienteIe: null,
  data: "01/08/2026",
  vencimento: "31/08/2026",
  itens: [
    {
      data: "01/08/2026",
      os: "OS-2026-100",
      romaneio: "OC-1",
      descricao: "Guarulhos → Morumbi",
      valor: 300,
      servicoTrajeto: "Guarulhos → Morumbi",
      valorBase: 300,
      valorAdicionais: 0,
      valorDescontos: 0,
    },
  ],
  subtotal: 300,
  acrescimos: 0,
  descontos: 0,
  total: 300,
  observacao: "",
  empresa: EMPRESA,
  dadosCliente: null,
};

async function gerarTexto(): Promise<string> {
  const logoPath = path.resolve(process.cwd(), "public", "logos", "logo-conexao-oficial.png");
  const input: PdfFaturaInput = { ...INPUT };
  if (fs.existsSync(logoPath)) {
    input.logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
  }
  const doc = await gerarPDFFatura(input);
  const buf = Buffer.from(doc.output("arraybuffer"));
  const outDir = path.resolve(process.cwd(), "test-results", "fat-pdf-cnpj-01");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "fatura_emitente_cnpj.pdf"), buf);
  return extrairTextoPDF(buf);
}

describe("FAT-PDF-CNPJ-01 — CNPJ do emitente da Fatura", () => {
  // T1 — PDF emitente usa 31.227.975/0001-80
  it("T1: PDF da fatura contém o CNPJ correto do emitente", async () => {
    const texto = await gerarTexto();
    expect(texto).toContain(`CNPJ: ${NEW_CNPJ}`);
  });

  // T2 — CNPJ antigo não aparece no PDF novo
  it("T2: PDF da fatura NÃO contém o CNPJ antigo", async () => {
    const texto = await gerarTexto();
    expect(texto).not.toContain(OLD_CNPJ);
  });

  // T3 — CNPJ do cliente não é alterado
  it("T3: CNPJ do cliente preservado", async () => {
    const texto = await gerarTexto();
    expect(texto).toContain(CLIENTE_CNPJ);
  });

  // T4 — razão social preservada
  it("T4: razão social do emitente preservada", async () => {
    const texto = await gerarTexto();
    expect(texto).toContain("Conexão Express Transportes LTDA");
  });

  // T5 — valores preservados
  it("T5: valores da fatura preservados", async () => {
    const texto = await gerarTexto();
    expect(texto).toContain("300,00");
  });

  // T6 — vencimento preservado
  it("T6: vencimento preservado", async () => {
    const texto = await gerarTexto();
    expect(texto).toContain("31/08/2026");
  });

  // T7 — descrição preservada
  it("T7: descrição preservada", async () => {
    const texto = await gerarTexto();
    expect(texto).toContain("FATURA DE SERVIÇOS DE TRANSPORTE");
    expect(texto).toContain("OS-2026-100");
  });

  // T8 — dados bancários vêm da fonte (empresa/banco), sem hardcode novo
  it("T8: dados bancários vêm da fonte informada", async () => {
    const texto = await gerarTexto();
    expect(texto).toContain("Banco Cora SCFI");
    const pdfFatura = readSrc("src/utils/pdfFatura.ts");
    expect(pdfFatura).not.toContain("1390923");
  });

  // T9 — sem hardcode bancário novo no PDF de fatura
  it("T9: pdfFatura.ts sem CNPJ hardcoded", () => {
    const pdfFatura = readSrc("src/utils/pdfFatura.ts");
    expect(pdfFatura).not.toContain(OLD_CNPJ);
    expect(pdfFatura).not.toContain(NEW_CNPJ);
  });

  // T10 — layout preservado (marcadores estruturais)
  it("T10: layout premium preservado", async () => {
    const texto = await gerarTexto();
    expect(texto).toContain("FATURA DE SERVIÇOS DE TRANSPORTE");
    expect(texto).toContain("RESUMO DA FATURA");
    expect(texto).toContain("TOTAL DA FATURA");
  });

  // T11 — busca final: old CNPJ em runtime (código) = 0
  it("T11: nenhum arquivo de runtime contém o CNPJ antigo", () => {
    const runtimeFiles = [
      "src/components/comercial/orcamentoPdf.ts",
      "src/lib/pdf/clientReport.ts",
      "src/lib/pdf/consolidatedReports.ts",
      "src/lib/pdf/prestadorReport.ts",
      "src/lib/professionalPdfTemplate.ts",
      "src/pages/Contratos.tsx",
      "src/utils/pdfFatura.ts",
      "src/services/financeiro/faturaService.ts",
      "src/utils/empresaConfig.ts",
    ];
    const withOld = runtimeFiles.filter((f) => readSrc(f).includes(OLD_CNPJ));
    expect(withOld).toEqual([]);
  });

  // T12 — config canônica local usa o CNPJ correto
  it("T12: empresaConfig.cnpj = 31.227.975/0001-80", () => {
    expect(empresaConfig.cnpj).toBe(NEW_CNPJ);
  });
});
