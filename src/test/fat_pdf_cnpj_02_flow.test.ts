/**
 * FAT-PDF-CNPJ-02 — prova do fluxo REAL de resolução do CNPJ canônico da Fatura.
 *
 * Executa buscarDadosEmpresaParaFatura() (fonte real) e gera o PDF com o fluxo
 * existente. Somente leitura no banco (nenhuma escrita).
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buscarDadosEmpresaParaFatura } from "@/services/financeiro/faturaService";
import { gerarPDFFatura, type PdfFaturaInput } from "@/utils/pdfFatura";

const NEW_CNPJ = "31.227.975/0001-80";
const OLD_CNPJ = "42.796.040/0001-31";

function extrairTextoPDF(buffer: Buffer): string {
  return buffer.toString("latin1").replace(/\u0000/g, "");
}

describe("FAT-PDF-CNPJ-02 — resolução real da fonte canônica", () => {
  it("buscarDadosEmpresaParaFatura resolve o CNPJ canônico (31.227.975/0001-80)", async () => {
    const emp = await buscarDadosEmpresaParaFatura();
    console.log("[FAT-PDF-CNPJ-02] empresa resolvida:", JSON.stringify({ cnpj: emp.cnpj, razaoSocial: emp.razaoSocial, banco: emp.banco, conta: emp.conta }));
    expect(emp.cnpj).toBe(NEW_CNPJ);
    expect(emp.cnpj).not.toBe(OLD_CNPJ);
  });

  it("PDF gerado pelo fluxo real contém o CNPJ canônico e não o antigo", async () => {
    const emp = await buscarDadosEmpresaParaFatura();
    const input: PdfFaturaInput = {
      modelo: "conexao_express",
      numero: "000038",
      descricao: "FAT-PDF-CNPJ-02 — prova de config canônica",
      cliente: "Cliente Teste",
      clienteCnpj: "11.222.333/0001-81",
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
      empresa: emp,
      dadosCliente: null,
    };

    const logoPath = path.resolve(process.cwd(), "public", "logos", "logo-conexao-oficial.png");
    if (fs.existsSync(logoPath)) {
      input.logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
    }

    const doc = await gerarPDFFatura(input);
    const buf = Buffer.from(doc.output("arraybuffer"));
    const outDir = path.resolve(process.cwd(), "test-results", "fat-pdf-cnpj-02");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "fatura_cnpj_canonical.pdf"), buf);

    const texto = extrairTextoPDF(buf);
    expect(texto).toContain(`CNPJ: ${NEW_CNPJ}`);
    expect(texto).not.toContain(OLD_CNPJ);
    // cliente preservado
    expect(texto).toContain("11.222.333/0001-81");
    // valores/vencimento preservados
    expect(texto).toContain("300,00");
    expect(texto).toContain("31/08/2026");
  });
});
