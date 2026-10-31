// ============================================================
// COTAÇÃO EXPRESS — Proposta comercial Enterprise em PDF
// Emissor exclusivo: Conexão Express (nunca pessoa física)
// ============================================================
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
const page = readSrc("src/pages/CotacaoExpress.tsx");
const pdf = readSrc("src/lib/cotacaoPdf.ts");

describe("A) Proposta comercial em PDF", () => {
  it("A.1 botão do Resumo gera PDF Enterprise (sem window.print)", () => {
    expect(page).toContain("gerarPropostaCotacaoPDF");
    expect(page).toContain("salvarPropostaPdf");
    expect(page).toContain("Salvar PDF / Imprimir");
    expect(page).not.toContain("window.print()");
  });

  it("A.2 documento usa a identidade institucional da Conexão Express", () => {
    expect(pdf).toContain("empresaConfig.razaoSocial");
    expect(pdf).toContain("empresaConfig.cnpj");
    expect(pdf).toContain("PROPOSTA COMERCIAL");
    expect(pdf).toContain("drawCoverPage");
    expect(pdf).toContain("doc.save(");
    expect(pdf.toLowerCase()).not.toContain("diego");
    expect(pdf.toLowerCase()).not.toContain("balbino");
  });

  it("A.3 PDF respeita a marca e destaca veículo + valor", () => {
    expect(pdf).toContain("VEÍCULO INDICADO");
    expect(pdf).toContain("VALOR DA PROPOSTA");
    expect(pdf).toContain("ORANGE");
    expect(pdf).toContain("NAVY");
    expect(pdf).toContain("fmtBRL(input.valor)");
    expect(pdf).toContain("DADOS DA PROPOSTA");
    expect(pdf).toContain("CONDIÇÕES COMERCIAIS");
  });

  it("A.4 UI do Resumo usa roxo + laranja e destaca veículo/valor", () => {
    expect(page).toContain("border-[#2E1065]");
    expect(page).toContain("from-[#2E1065]");
    expect(page).toContain("Proposta Comercial");
    expect(page).toContain("Veículo indicado");
    expect(page).toContain("Proposta instantânea");
  });
});
