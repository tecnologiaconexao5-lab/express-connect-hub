/**
 * FAT-PDF-CABECALHO-03 — Dados do emitente no cabeçalho da FATURA.
 *
 * Fonte canônica: config_financeira_empresa (configuracoes_sistema).
 * Corrigido: razaoSocial + ie (cnpj já corrigido em FAT-02).
 * Endereço NÃO inventado (sem fonte canônica comprovada) — ver relatório.
 *
 * Somente leitura no banco (nenhuma escrita neste teste).
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buscarDadosEmpresaParaFatura } from "@/services/financeiro/faturaService";
import { gerarPDFFatura, type PdfFaturaInput } from "@/utils/pdfFatura";

const NEW_RAZAO = "CONEXAO TRANSPORTES LTDA";
const NEW_CNPJ = "31.227.975/0001-80";
const NEW_IE = "119.836.105.110";
const OLD_RAZAO = "CONEXAO SERVICOES EXPRESS LTDA";
const OLD_IE = "138381146110";

function extrairTextoPDF(buffer: Buffer): string {
  return buffer.toString("latin1").replace(/\u0000/g, "");
}

async function gerarTextoReal(): Promise<{ texto: string; empresa: Awaited<ReturnType<typeof buscarDadosEmpresaParaFatura>> }> {
  const empresa = await buscarDadosEmpresaParaFatura();
  const input: PdfFaturaInput = {
    modelo: "conexao_express",
    numero: "000038",
    descricao: "FAT-PDF-CABECALHO-03 — prova de dados do emitente",
    cliente: "Cliente Teste",
    clienteCnpj: "11.222.333/0001-81",
    clienteIe: "987654321",
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
    empresa,
    dadosCliente: null,
  };
  const logoPath = path.resolve(process.cwd(), "public", "logos", "logo-conexao-oficial.png");
  if (fs.existsSync(logoPath)) {
    input.logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
  }
  const doc = await gerarPDFFatura(input);
  const buf = Buffer.from(doc.output("arraybuffer"));
  const outDir = path.resolve(process.cwd(), "test-results", "fat-pdf-cabecalho-03");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "fatura_cabecalho_emitente.pdf"), buf);
  return { texto: extrairTextoPDF(buf), empresa };
}

describe("FAT-PDF-CABECALHO-03 — dados do emitente", () => {
  it("fonte canônica resolve razão social / CNPJ / IE", async () => {
    const emp = await buscarDadosEmpresaParaFatura();
    console.log("[FAT-CAB-03] empresa:", JSON.stringify({ razaoSocial: emp.razaoSocial, cnpj: emp.cnpj, ie: emp.ie, endereco: emp.endereco, cidade: emp.cidade, uf: emp.uf }));
    expect(emp.razaoSocial).toBe(NEW_RAZAO);
    expect(emp.cnpj).toBe(NEW_CNPJ);
    expect(emp.ie).toBe(NEW_IE);
  });

  it("PDF do fluxo real contém razão social, CNPJ e IE corretos", async () => {
    const { texto } = await gerarTextoReal();
    expect(texto).toContain(NEW_RAZAO);
    expect(texto).toContain(`CNPJ: ${NEW_CNPJ}`);
    expect(texto).toContain(`IE: ${NEW_IE}`);
  });

  it("PDF NÃO contém a razão social nem a IE antigas (fiscal)", async () => {
    const { texto } = await gerarTextoReal();
    expect(texto).not.toContain(OLD_RAZAO);
    expect(texto).not.toContain(OLD_IE);
  });

  it("cliente, valores e vencimento preservados", async () => {
    const { texto } = await gerarTextoReal();
    expect(texto).toContain("11.222.333/0001-81"); // CNPJ cliente
    expect(texto).toContain("300,00");
    expect(texto).toContain("31/08/2026");
  });
});
