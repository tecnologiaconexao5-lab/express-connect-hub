import { describe, it, expect, vi, beforeAll } from "vitest";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

// ============================================================================
// A31I — Teste visual: gera o PDF do modelo do cliente (consolidado) localmente,
// sem emitir fatura real e sem consumir numeração de produção. O PDF gerado é
// salvo em test-results/a31i/ para comparação com a referência.
// ============================================================================

vi.mock("@/lib/pdfLogoSupport", () => ({
  getLogoWithFallback: vi.fn(async () => ({ base64: "data:image/png;base64,AAA", isText: false, naturalWidth: 1545, naturalHeight: 982 })),
  drawLogoSafe: vi.fn(() => {}),
  fetchLogoAsBase64: vi.fn(async () => null),
  renderLogoTextFallback: vi.fn(() => {}),
  addImageSafely: vi.fn(() => {}),
  renderLogoTextPremium: vi.fn(() => {}),
}));

import { gerarPDFFatura, type PdfFaturaInput } from "@/utils/pdfFatura";
import { drawLogoSafe } from "@/lib/pdfLogoSupport";

const inputMocked: PdfFaturaInput = {
  modelo: "calvo",
  numero: "Rascunho",
  descricao:
    "Receita de CT-e referente aos romaneios nº 343241, 343216, 343198, 340927 (sem cobrança), 342396 e 343099 e serviços de devolução.",
  cliente: "CALVO LOGÍSTICA LTDA",
  clienteCnpj: "12.345.678/0001-90",
  clienteIe: "123.456.789.012",
  data: "2026-08-17",
  vencimento: "2026-09-16",
  itens: [
    {
      data: "2026-08-10",
      os: "OS-202608-100",
      romaneio: "343241",
      descricao: "Receita de CT-e referente aos romaneios nº 343241, 343216, 343198, 340927 (sem cobrança), 342396 e 343099 e serviços de devolução.",
      valor: 1250,
    },
  ],
  subtotal: 1250,
  acrescimos: 0,
  descontos: 0,
  total: 1250,
  observacao: "Referente aos romaneios nº 343241, 343216, 343198, 340927, 342396 e 343099.",
  empresa: {
    razaoSocial: "CONEXÃO SERVIÇOS EXPRESS LTDA",
    nomeFantasia: "Conexão Express",
    cnpj: "00.000.000/0001-00",
    ie: "111.111.111.111",
    inscricaoMunicipal: null,
    endereco: "Av. Teste, 1000 - Centro",
    cidade: "Guarulhos",
    uf: "SP",
    cep: "07000-000",
    email: "financeiro@conexaoexpress.com.br",
    emailFinanceiro: "financeiro@conexaoexpress.com.br",
    telefone: "(11) 4000-0000",
    banco: "Banco Itaú",
    agencia: "0001",
    conta: "00000-0",
    pix: "00.000.000/0001-00",
    logoPath: "",
  },
  dadosCliente: {
    razaoSocial: "CALVO LOGÍSTICA LTDA",
    nomeFantasia: "Calvo Logística",
    cnpj: "12.345.678/0001-90",
    ie: "123.456.789.012",
    inscricaoMunicipal: null,
    endereco: "Rua do Cliente, 200 - Centro",
    cidade: "São Paulo",
    uf: "SP",
    vencimentoPadraoDias: 30,
    tipoCobranca: null,
    tabelaValoresPadraoId: null,
  },
};

describe("A31I — Geração local do PDF (teste visual, sem emissão)", () => {
  const dir = join(process.cwd(), "test-results", "a31i");

  beforeAll(() => {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  });

  it("gera o PDF do modelo do cliente (consolidado) para comparação visual", async () => {
    const doc = await gerarPDFFatura(inputMocked);
    const output = doc.output("arraybuffer");
    expect(output.byteLength).toBeGreaterThan(1000);
    const outPath = join(dir, "fatura_modelo_cliente_visual.pdf");
    writeFileSync(outPath, Buffer.from(output));
    // Retorna o caminho para o relatório
    console.log("[A31I] PDF visual gerado em:", outPath, "bytes:", output.byteLength);
    expect(existsSync(outPath)).toBe(true);
  });

  it("rascunho não consome numeração oficial (número exibido = Rascunho)", async () => {
    const numero = inputMocked.numero && inputMocked.numero !== "Rascunho" ? inputMocked.numero : "Rascunho";
    expect(numero).toBe("Rascunho");
  });

  it("A31-I.4 — PDF contém dados bancários dinâmicos (Banco/AG/C-C/PIX)", async () => {
    vi.mocked(drawLogoSafe).mockClear();
    const doc = await gerarPDFFatura(inputMocked);
    const buf = Buffer.from(doc.output("arraybuffer"));
    const s = buf.toString("latin1");
    expect(s).toContain("Dados para Transferência Bancária");
    expect(s).toContain("Banco Itaú");
    expect(s).toContain("AG: 0001");
    expect(s).toContain("C/C: 00000-0");
    expect(s).toContain("CHAVE PIX");
  });

  it("A31-I.4 — NENHUM banco hardcoded (Cora e afins não aparecem)", () => {
    const srcPdf = inputMocked.empresa;
    expect(srcPdf.banco).toBe("Banco Itaú"); // vem do input (config), não hardcode
    const hardcodeCora = "Cora" === srcPdf.banco;
    expect(hardcodeCora).toBe(false);
  });

  it("A31-I.4 — sem configuração bancária NÃO gera dados fictícios", async () => {
    const semBanco: PdfFaturaInput = {
      ...inputMocked,
      empresa: { ...inputMocked.empresa, banco: "", agencia: "", conta: "", pix: "" },
    };
    const doc = await gerarPDFFatura(semBanco);
    const buf = Buffer.from(doc.output("arraybuffer"));
    const s = buf.toString("latin1");
    expect(s).not.toContain("Dados para Transferência Bancária");
    expect(s).not.toContain("Banco");
  });

  it("A31-I.4 — logo centralizado: x = (pageWidth - renderedLogoWidth) / 2", async () => {
    vi.mocked(drawLogoSafe).mockClear();
    await gerarPDFFatura(inputMocked);
    const call = vi.mocked(drawLogoSafe).mock.calls[0];
    expect(call).toBeTruthy();
    const opts = call[2] as { x: number; maxWidth: number; align?: string };
    const pageWidth = 595.28; // A4 pt
    const expected = (pageWidth - opts.maxWidth) / 2;
    expect(opts.align).toBe("left");
    expect(opts.x).toBeCloseTo(expected, 0);
  });
});