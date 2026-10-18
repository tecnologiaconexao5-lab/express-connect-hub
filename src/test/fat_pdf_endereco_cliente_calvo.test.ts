import { describe, it, expect, vi } from "vitest";

// ============================================================================
// FATURA-CLIENTE-02 — endereço do cliente no modelo CALVO (casos de borda).
// Valida o gerador REAL (gerarPDFFatura) offline, sem banco:
//   A. só `enderecoCompleto` (caso real do Calvo — cadastro sem logradouro);
//   B. só `endereco` do cadastro (fallback legado);
//   C. sem endereço algum → sem linha de endereço e sem "undefined".
// Em todos: "Nº Conexão"/"Nº Cliente" NÃO aparecem (FATURA-CLIENTE-01).
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
import { montarInputPdfFatura } from "@/services/financeiro/faturaService";
import type { FaturaComItens, DadosClienteFatura, DadosEmpresaFatura } from "@/services/financeiro/faturaService";

const EMPRESA: DadosEmpresaFatura = {
  razaoSocial: "Conexão Express Transportes LTDA",
  nomeFantasia: "Conexão Express",
  cnpj: "31.227.975/0001-80",
  ie: "123.456.789.000",
  inscricaoMunicipal: null,
  endereco: "Av. Paulista, 1000",
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
  logoPath: "",
};

const CLIENTE_BASE: DadosClienteFatura = {
  razaoSocial: "Calvo Comercio e Importacao LTDA",
  nomeFantasia: "Calvo",
  cnpj: "00.640.071/0001-59",
  ie: "796497088113",
  inscricaoMunicipal: null,
  endereco: "",
  cidade: "",
  uf: "",
  vencimentoPadraoDias: 30,
  tipoCobranca: "Boleto",
  tabelaValoresPadraoId: null,
  enderecoCompleto: null,
};

function faturaCalvo(): FaturaComItens {
  return {
    id: "fat-calvo",
    tenant_id: "t",
    numero: "FAT-2026-000014",
    numero_cliente: 5,
    cliente_id: "cli-calvo",
    modelo: "calvo",
    descricao: "",
    data_emissao: "2026-09-05",
    competencia_inicio: "2026-08-01",
    competencia_fim: "2026-08-31",
    vencimento: "2026-10-05",
    valor_bruto: 2091.4,
    descontos: 0,
    acrescimos: 0,
    valor_total: 2091.4,
    status: "emitida",
    observacao: "",
    observacao_fiscal: null,
    conta_receber_id: null,
    criado_por: null,
    criado_em: "2026-09-05T12:00:00",
    atualizado_por: null,
    atualizado_em: "2026-09-05T12:00:00",
    cancelado_em: null,
    cancelado_por: null,
    motivo_cancelamento: null,
    metadata: { modelo: "calvo" },
    itens: [
      {
        id: "it-1",
        fatura_id: "fat-calvo",
        os_id: null,
        alocacao_id: null,
        cliente_id: "cli-calvo",
        romaneio: "343241",
        descricao: "Receita de CT-e referente aos romaneios nº 343241",
        data_servico: "2026-08-10",
        valor_base: 2091.4,
        valor_adicionais: 0,
        valor_descontos: 0,
        valor_total: 2091.4,
        km_excedente: 0,
        pedagio_cliente: 0,
        ajudante_cliente: 0,
        diaria_cliente: 0,
        saidas_adicionais_cliente: 0,
        status: "ativo",
        criado_por: null,
        criado_em: "2026-09-05T12:00:00",
        atualizado_em: "2026-09-05T12:00:00",
      },
    ],
  } as unknown as FaturaComItens;
}

  const textoDoPdf = (buf: Buffer) => buf.toString("latin1").split("\u0000").join("");

async function gerar(cliente: DadosClienteFatura): Promise<string> {
  const input = montarInputPdfFatura(faturaCalvo(), EMPRESA, cliente);
  expect(input.modelo).toBe("calvo");
  const doc = await gerarPDFFatura(input);
  return textoDoPdf(Buffer.from(doc.output("arraybuffer")));
}

describe("FATURA-CLIENTE-02 — endereço no modelo CALVO", () => {
  it("A) usa enderecoCompleto (enderecos_clientes) quando o cadastro não tem logradouro", async () => {
    const texto = await gerar({
      ...CLIENTE_BASE,
      enderecoCompleto: "Rua Jamil João Zarif, 684, Unidades 20, 21, 22 e 23, Jardim Santa Vicência - Guarulhos/SP - CEP: 07143-000",
    });
    expect(texto).toContain("Cobrança para: Calvo Comercio e Importacao LTDA");
    expect(texto).toContain("Rua Jamil João Zarif, 684");
    expect(texto).toContain("CEP: 07143-000");
    expect(texto).toContain("Guarulhos/SP");
    expect(texto).not.toContain("Nº Conexão");
    expect(texto).not.toContain("Nº Cliente");
  });

  it("B) cai no fallback do cadastro quando não há enderecoCompleto", async () => {
    const texto = await gerar({
      ...CLIENTE_BASE,
      endereco: "Av. do Cliente, 500 - Centro",
      cidade: "Guarulhos",
      uf: "SP",
    });
    // separado: o "—" (em dash) sai do jsPDF como byte WinAnsi 0x97
    expect(texto).toContain("Av. do Cliente, 500 - Centro");
    expect(texto).toContain("Guarulhos/SP");
    expect(texto).not.toContain("Nº Conexão");
    expect(texto).not.toContain("Nº Cliente");
  });

  it("C) sem endereço algum não imprime linha de endereço (sem 'undefined')", async () => {
    const texto = await gerar({ ...CLIENTE_BASE });
    expect(texto).not.toContain("undefined");
    expect(texto).not.toContain("CNPJ: undefined");
    expect(texto).toContain("Cobrança para: Calvo Comercio e Importacao LTDA");
    expect(texto).not.toContain("Nº Conexão");
    expect(texto).not.toContain("Nº Cliente");
  });
});
