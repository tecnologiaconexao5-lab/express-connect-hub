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
    expect(pdf).toContain("PROPOSTA COMERCIAL");
    expect(pdf).toContain("drawContentHeader");
    expect(pdf).toContain("doc.save(");
    expect(pdf.toLowerCase()).not.toContain("diego");
    expect(pdf.toLowerCase()).not.toContain("balbino");
  });

  it("A.5 sem capa: página 1 inicia com o conteúdo logo abaixo do cabeçalho", () => {
    expect(pdf).not.toContain("drawCoverPage");
    expect(pdf).toContain("loadLogo");
    const headerIdx = pdf.indexOf("drawHeader();");
    const firstAddPage = pdf.indexOf("doc.addPage()");
    expect(headerIdx).toBeGreaterThan(-1);
    expect(firstAddPage).toBeGreaterThan(headerIdx);
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

describe("D) Revisão 2026-11-08 — e-mail comercial, nº numérico, ordem e card removido", () => {
  it("D.1 conteúdo da proposta usa exclusivamente comercial@conexaoexpress.com.br", () => {
    expect(pdf).toContain("comercial@conexaoexpress.com.br");
    expect(pdf).toContain("value: EMAIL_CONTATO_PROPOSTA");
    expect(pdf).not.toContain("empresaConfig.email");
  });

  it("D.2 numeroProposta: PROP-AAAAMMDD-<4 dígitos> (sem letras após a data)", () => {
    expect(pdf).toContain("PROP-${stamp}-${sufixo}");
    expect(pdf).toContain('padStart(4, "0")');
    expect(pdf).not.toContain(".toUpperCase()");
  });

  it("D.3 DADOS DA CARGA vem antes de ROTA COTADA", () => {
    expect(pdf.indexOf("DADOS DA CARGA")).toBeLessThan(pdf.indexOf("ROTA COTADA"));
  });

  it("D.4 card final 'Emissor institucional' removido por completo", () => {
    expect(pdf).not.toContain("Emissor institucional");
    expect(pdf).not.toContain("empresaConfig.cnpj");
    expect(pdf).not.toContain("empresaConfig.endereco");
    expect(pdf).not.toContain("BG_LIGHT");
    expect(pdf).toContain("doc.save(");
  });
});
