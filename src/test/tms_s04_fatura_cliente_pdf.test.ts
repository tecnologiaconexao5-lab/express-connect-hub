import { describe, it, expect, beforeAll } from "vitest";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { FaturaComItens } from "@/services/financeiro/faturaService";
import { montarInputPdfFatura } from "@/services/financeiro/faturaService";
import type { DadosEmpresaFatura, DadosClienteFatura } from "@/services/financeiro/faturaService";
import { gerarPDFFatura, type PdfFaturaInput } from "@/utils/pdfFatura";

// ============================================================================
// TMS-S04 — Fatura + Relatório de Faturamento Premium do Cliente.
// Gera PDF REAL (mesmo gerador usado na tela) e valida a estrutura premium,
// a ausência de UUID, valores BRL, ordem das seções e o comportamento
// multipágina. Nenhum dado do banco é lido (fixture local).
// ============================================================================

const LOGO_PATH = join(process.cwd(), "public", "logos", "logo-conexao-oficial.png");
const OUT_DIR = join(process.cwd(), "test-results", "tms-s04");
const OUT_PDF = join(OUT_DIR, "fatura_cliente_premium.pdf");
const OUT_PDF_30 = join(OUT_DIR, "fatura_cliente_premium_30itens.pdf");

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

const CLIENTE: DadosClienteFatura = {
  razaoSocial: "Calvo Comércio e Importação Ltda",
  nomeFantasia: "Calvo",
  cnpj: "11.222.333/0001-81",
  ie: "987654321",
  inscricaoMunicipal: null,
  endereco: "Av. do Cliente, 500 - Centro",
  cidade: "Guarulhos",
  uf: "SP",
  vencimentoPadraoDias: 30,
  tipoCobranca: "Boleto",
  tabelaValoresPadraoId: null,
  enderecoCompleto: "Av. do Cliente, 500 - Centro - Guarulhos/SP",
};

function montarItem(numero: string, origem: string, destino: string, base: number, adicionais: number) {
  return {
    id: `it-${numero}`,
    fatura_id: "fat-1",
    os_id: "550e8400-e29b-41d4-a716-446655440000", // UUID — NÃO deve aparecer no PDF
    alocacao_id: null,
    cliente_id: "cli-1",
    romaneio: `ROM-${numero}`,
    descricao: `${numero} — ${origem} → ${destino}`,
    data_servico: "2026-08-31",
    valor_base: base,
    valor_adicionais: adicionais,
    valor_descontos: 0,
    valor_total: base + adicionais,
    km_excedente: 0,
    pedagio_cliente: adicionais,
    ajudante_cliente: 0,
    diaria_cliente: 0,
    saidas_adicionais_cliente: 0,
    status: "ativo" as const,
    criado_por: null,
    criado_em: "2026-08-31T12:00:00",
    atualizado_em: "2026-08-31T12:00:00",
  };
}

function montarFatura(itensQtd: number): FaturaComItens {
  const itens = Array.from({ length: itensQtd }, (_, i) =>
    montarItem(`OS-2026-${100 + i}`, "Guarulhos", i % 2 === 0 ? "Morumbi" : "Campinas", 520, i * 100)
  );
  const subtotal = itens.reduce((s, i) => s + i.valor_base, 0);
  const acrescimos = itens.reduce((s, i) => s + i.valor_adicionais, 0);
  return {
    id: "fat-1",
    tenant_id: "t",
    numero: "000038",
    cliente_id: "cli-1",
    modelo: "conexao_express",
    descricao: "",
    data_emissao: "2026-08-21",
    competencia_inicio: "2026-08-01",
    competencia_fim: "2026-08-15",
    vencimento: "2026-09-05",
    valor_bruto: subtotal,
    descontos: 0,
    acrescimos,
    valor_total: subtotal + acrescimos,
    status: "emitida",
    observacao: "Referente ao transporte do período.",
    observacao_fiscal: null,
    conta_receber_id: null,
    criado_por: null,
    criado_em: "2026-08-21T12:00:00",
    atualizado_por: null,
    atualizado_em: "2026-08-21T12:00:00",
    cancelado_em: null,
    cancelado_por: null,
    motivo_cancelamento: null,
    metadata: {},
    itens: itens as FaturaComItens["itens"],
  };
}

function montarInput(itensQtd = 2): PdfFaturaInput {
  const f = montarFatura(itensQtd);
  return montarInputPdfFatura(f, EMPRESA, CLIENTE);
}

/** Remove os bytes de codificação 0x00 que o jsPDF usa como alta ordem por glifo. */
function extrairTextoPDF(buffer: Buffer): string {
  return buffer.toString("latin1").replaceAll("\u0000", "");
}

describe("TMS-S04 — Enriquecimento do PdfFaturaInput (montarInputPdfFatura)", () => {
  it("não expõe UUID da OS; recupera número interno + trajeto do snapshot", () => {
    const input = montarInput(2);
    const item = input.itens[0];
    expect(item.numeroOS).toBe("OS-2026-100");
    expect(item.os).toBe("OS-2026-100");
    expect(item.servicoTrajeto).toContain("Guarulhos");
    expect(item.servicoTrajeto).toContain("Morumbi");
    expect(String(item.os)).not.toContain("550e8400");
    // o snapshot original (descricao) mantém o conteúdo real
    expect(item.descricao).toContain("OS-2026-100");
  });

  it("propaga período, status comercial e romaneio", () => {
    const input = montarInput(2);
    expect(input.competenciaInicio).toBe("2026-08-01");
    expect(input.competenciaFim).toBe("2026-08-15");
    expect(input.statusComercial).toBe("Emitida");
    expect(input.itens[0].romaneio).toBe("ROM-OS-2026-100");
  });

  it("item manual sem OS → OS Conexão vazio e trajeto = descrição", () => {
    const f = montarFatura(1);
    f.itens[0].os_id = null;
    f.itens[0].descricao = "Fatura manual";
    const input = montarInputPdfFatura(f, EMPRESA, CLIENTE);
    expect(input.itens[0].numeroOS).toBe("");
    expect(input.itens[0].servicoTrajeto).toBe("Fatura manual");
  });
});

describe("TMS-S04 — Geração do PDF PREMIUM da Fatura do Cliente", () => {
  beforeAll(() => {
    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  });

  it("usa o asset oficial /logos/logo-conexao-oficial.png (branco + X colorido)", () => {
    expect(existsSync(LOGO_PATH)).toBe(true);
    const buf = readFileSync(LOGO_PATH);
    expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  it("gera o PDF premium com 2 serviços e valida estrutura/valores/ordem", async () => {
    const input = montarInput(2);
    input.logoBase64 = `data:image/png;base64,${readFileSync(LOGO_PATH).toString("base64")}`;
    input.documentosFiscais = [{ cte: "CTE-2026-343550", nfse: "" }];

    const doc = await gerarPDFFatura(input);
    const output = doc.output("arraybuffer");
    expect(output.byteLength).toBeGreaterThan(5000);

    writeFileSync(OUT_PDF, Buffer.from(output));
    console.log("[TMS-S04] PDF gerado em:", OUT_PDF, "bytes:", output.byteLength);
    expect(existsSync(OUT_PDF)).toBe(true);

    const texto = extrairTextoPDF(Buffer.from(output));

    // Cabeçalho / identificação
    expect(texto).toContain("FATURA DE SERVIÇOS DE TRANSPORTE");
    expect(texto).toContain("Conexão Express Transportes LTDA");
    expect(texto).toContain("CNPJ: 31.227.975/0001-80");
    // FATURA-CLIENTE-01 — "Nº Conexão"/"Nº Cliente" são informações internas
    // do sistema e NÃO podem aparecer no PDF destinado ao cliente.
    expect(texto).not.toContain("Nº Conexão");
    expect(texto).not.toContain("Nº Cliente");
    expect(texto).toContain("000038");
    expect(texto).toContain("Emissão");
    expect(texto).toContain("Vencimento");
    expect(texto).toContain("Período");
    expect(texto).toContain("01/08/2026 a 15/08/2026");

    // Cliente
    expect(texto).toContain("CLIENTE");
    expect(texto).toContain("Razão Social");
    expect(texto).toContain("Calvo Comércio e Importação Ltda");
    expect(texto).toContain("CNPJ/CPF");
    expect(texto).toContain("11.222.333/0001-81");

    // Resumo
    expect(texto).toContain("RESUMO DA FATURA");
    expect(texto).toContain("Quantidade de serviços");
    expect(texto).toContain("TOTAL DA FATURA");

    // Tabela de serviços
    expect(texto).toContain("OS Conexão");
    expect(texto).toContain("Romaneio / OC");
    expect(texto).toContain("Serviço / Trajeto");
    expect(texto).toContain("Valor Base");
    expect(texto).toContain("Adicionais");

    // OS Conexão = número interno (não UUID)
    expect(texto).toContain("OS-2026-100");
    expect(texto).not.toContain("550e8400");

    // Trajeto natural (→ trocado por › render-safe)
    expect(texto).toContain("Guarulhos");
    expect(texto).toContain("Morumbi");

    // Documentos fiscais (somente quando houver)
    expect(texto).toContain("DOCUMENTOS FISCAIS");
    expect(texto).toContain("CTE-2026-343550");

    // Condições de pagamento + banco real
    expect(texto).toContain("CONDIÇÕES DE PAGAMENTO");
    expect(texto).toContain("Banco Cora SCFI");
    expect(texto).toContain("financeiro@conexaoexpress.com.br");

    // Valores BRL + total
    expect(texto).toContain("R$ 520,00");
    expect(texto).toContain("R$ 100,00");
    expect(texto).toContain("Página 1 de 1");

    // Ordens das seções
    const iCliente = texto.indexOf("CLIENTE");
    const iResumo = texto.indexOf("RESUMO DA FATURA");
    const iCond = texto.indexOf("CONDIÇÕES DE PAGAMENTO");
    expect(iResumo).toBeGreaterThan(iCliente);
    expect(iCond).toBeGreaterThan(iResumo);
  });

  it("com 30 serviços gera documento multipágina sem UUID e com identificação", async () => {
    const input = montarInput(30);
    input.logoBase64 = `data:image/png;base64,${readFileSync(LOGO_PATH).toString("base64")}`;
    const doc = await gerarPDFFatura(input);
    const pages = doc.getNumberOfPages();
    expect(pages).toBeGreaterThan(1);
    const buf = Buffer.from(doc.output("arraybuffer"));
    writeFileSync(OUT_PDF_30, buf);
    console.log("[TMS-S04] PDF multipágina gerado em:", OUT_PDF_30, "páginas:", pages, "bytes:", buf.length);
    const texto = extrairTextoPDF(buf);
    expect(texto).not.toContain("550e8400");
    expect(texto).toContain("OS-2026-100");
    expect(texto).toContain("OS-2026-129");
    expect(texto).toContain("Página 2 de");
    expect(texto).toContain("TOTAL DA FATURA");
    expect(texto).toContain("R$");
  });
});
