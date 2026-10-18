import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock do Supabase (apenas para verificarNumeroFaturaManualDisponivel) ──────
let mockFaturaRows: unknown[] = [];

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          limit: async () => ({ data: mockFaturaRows, error: null }),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/pdfLogoSupport", () => ({
  getLogoWithFallback: vi.fn(async () => ({ base64: "data:image/png;base64,AAA", isText: false, naturalWidth: 1545, naturalHeight: 982 })),
  drawLogoSafe: vi.fn(() => {}),
  fetchLogoAsBase64: vi.fn(async () => null),
  renderLogoTextFallback: vi.fn(() => {}),
  addImageSafely: vi.fn(() => {}),
  renderLogoTextPremium: vi.fn(() => {}),
}));

import {
  montarSnapshotConta,
  verificarNumeroFaturaManualDisponivel,
  montarPreviaFatura,
  montarInputPdfFatura,
  type FaturaComItens,
} from "@/services/financeiro/faturaService";
import type { DadosEmpresaFatura, DadosClienteFatura } from "@/services/financeiro/faturaService";
import { gerarPDFFatura } from "@/utils/pdfFatura";

beforeEach(() => {
  mockFaturaRows = [];
});

const EMPRESA: DadosEmpresaFatura = {
  razaoSocial: "CONEXÃO SERVIÇOS EXPRESS LTDA",
  nomeFantasia: "Conexão Express",
  cnpj: "12.345.678/0001-90",
  ie: "123.456.789",
  inscricaoMunicipal: null,
  endereco: "Rua Teste, 100",
  cidade: "São Paulo",
  uf: "SP",
  cep: "01000-000",
  telefone: "(11) 0000-0000",
  email: "contato@conexaoexpress.com.br",
  emailFinanceiro: "financeiro@conexaoexpress.com.br",
  banco: "Banco Antigo",
  agencia: "1111",
  conta: "22222-2",
  pix: "pix-antigo@conexaoexpress.com.br",
  logoPath: "/logos/logo-conexao-colorido.png",
};

const CLIENTE: DadosClienteFatura = {
  razaoSocial: "CALVO COML IMPO E EXP. LTDA",
  nomeFantasia: "Calvo",
  cnpj: "98.765.432/0001-10",
  ie: "987654321",
  inscricaoMunicipal: null,
  endereco: "Av. Cliente, 500",
  cidade: "Guarulhos",
  uf: "SP",
  vencimentoPadraoDias: 30,
  tipoCobranca: null,
  tabelaValoresPadraoId: null,
};

function faturaManualBase(): FaturaComItens {
  return {
    id: "fat-1",
    tenant_id: "t",
    numero: null,
    cliente_id: "cli-1",
    modelo: "conexao_express",
    descricao: "Receita de CT-e referente aos romaneios nº 343550.",
    data_emissao: "2026-09-05",
    competencia_inicio: null,
    competencia_fim: null,
    vencimento: "2026-09-05",
    valor_bruto: 3550.54,
    descontos: 0,
    acrescimos: 0,
    valor_total: 3550.54,
    status: "rascunho",
    observacao: "validação interna: e-mail enviado em 05/09",
    observacao_fiscal: null,
    conta_receber_id: null,
    criado_por: null,
    criado_em: "2026-09-05T12:00:00",
    atualizado_por: null,
    atualizado_em: "2026-09-05T12:00:00",
    cancelado_em: null,
    cancelado_por: null,
    motivo_cancelamento: null,
    metadata: {
      origem: "manual",
      numeroManual: "38",
      parcela: "1",
      contaBancaria: { banco: "Banco Cora SCFI", agencia: "0001", conta: "1390923-1", pix: "financeiro@conexaoexpress.com.br" },
      modelo: "conexao_express",
      descricao: "Receita de CT-e referente aos romaneios nº 343550.",
    },
    itens: [{
      id: "it-1",
      fatura_id: "fat-1",
      os_id: null,
      alocacao_id: null,
      cliente_id: "cli-1",
      romaneio: null,
      descricao: "Fatura manual",
      data_servico: "2026-09-05",
      valor_base: 3550.54,
      valor_adicionais: 0,
      valor_descontos: 0,
      valor_total: 3550.54,
      km_excedente: 0,
      pedagio_cliente: 0,
      ajudante_cliente: 0,
      diaria_cliente: 0,
      saidas_adicionais_cliente: 0,
      status: "ativo",
      criado_por: null,
      criado_em: "2026-09-05T12:00:00",
      atualizado_em: "2026-09-05T12:00:00",
    }],
  };
}

describe("F38-MANUAL — Snapshot da conta bancária", () => {
  it("monta snapshot a partir da conta de configuração", () => {
    const s = montarSnapshotConta({
      id: "c1",
      nome: "Cora",
      banco: "Banco Cora SCFI",
      codigoBanco: "403",
      agencia: "0001",
      conta: "1390923-1",
      digito: "1",
      pix: "financeiro@conexaoexpress.com.br",
      titular: "Conexão",
      titularCnpj: "",
      tipo: "Conta Corrente",
      ativa: true,
      principal: true,
    });
    expect(s).toEqual({ banco: "Banco Cora SCFI", agencia: "0001", conta: "1390923-1", pix: "financeiro@conexaoexpress.com.br" });
  });

  it("conta nula → snapshot nulo (sem erro)", () => {
    expect(montarSnapshotConta(null)).toBeNull();
    expect(montarSnapshotConta(undefined)).toBeNull();
  });
});

describe("F38-MANUAL — Checagem de duplicidade do número", () => {
  it("número em uso (coluna numero) → não disponível", async () => {
    mockFaturaRows = [{ id: "x" }];
    const r = await verificarNumeroFaturaManualDisponivel("FAT-2026-000038");
    expect(r.disponivel).toBe(false);
    expect(r.message).toBe("Já existe uma fatura com este número.");
  });

  it("número em uso (metadata.numeroManual) → não disponível", async () => {
    mockFaturaRows = [{ id: "y" }];
    const r = await verificarNumeroFaturaManualDisponivel("38");
    expect(r.disponivel).toBe(false);
  });

  it("número livre → disponível", async () => {
    const r = await verificarNumeroFaturaManualDisponivel("99");
    expect(r.disponivel).toBe(true);
  });

  it("número vazio → disponível (sem checagem)", async () => {
    const r = await verificarNumeroFaturaManualDisponivel("");
    expect(r.disponivel).toBe(true);
  });
});

describe("F38-MANUAL — Prévia usa número manual e remove observação interna do PDF", () => {
  it("numero da prévia = numeroManual quando não há número oficial", () => {
    const previa = montarPreviaFatura(faturaManualBase(), EMPRESA, CLIENTE);
    expect(previa.numero).toBe("38");
    expect(previa.total).toBe(3550.54);
    expect(previa.cliente).toBe(CLIENTE.razaoSocial);
  });

  it("fatura manual: observação interna NÃO aparece na prévia", () => {
    const previa = montarPreviaFatura(faturaManualBase(), EMPRESA, CLIENTE);
    expect(previa.observacao).toBe("");
  });

  it("fatura automática: observação continua saindo na prévia", () => {
    const f = faturaManualBase();
    f.metadata.origem = "automatica";
    f.metadata.numeroManual = undefined;
    f.numero = "FAT-2026-000001";
    const previa = montarPreviaFatura(f, EMPRESA, CLIENTE);
    expect(previa.observacao).toBe("validação interna: e-mail enviado em 05/09");
    expect(previa.numero).toBe("FAT-2026-000001");
  });
});

describe("F38-MANUAL — Snapshot da conta aplicado ao PDF (montarInputPdfFatura)", () => {
  it("empresa do PDF usa os dados da conta snapshotada na fatura", () => {
    const input = montarInputPdfFatura(faturaManualBase(), EMPRESA, CLIENTE);
    expect(input.empresa.banco).toBe("Banco Cora SCFI");
    expect(input.empresa.agencia).toBe("0001");
    expect(input.empresa.conta).toBe("1390923-1");
    expect(input.empresa.pix).toBe("financeiro@conexaoexpress.com.br");
  });

  it("fatura sem snapshot mantém a conta da empresa", () => {
    const f = faturaManualBase();
    f.metadata.contaBancaria = null;
    const input = montarInputPdfFatura(f, EMPRESA, CLIENTE);
    expect(input.empresa.banco).toBe("Banco Antigo");
    expect(input.empresa.pix).toBe("pix-antigo@conexaoexpress.com.br");
  });

  it("observação interna não vai para o PDF da fatura manual", () => {
    const input = montarInputPdfFatura(faturaManualBase(), EMPRESA, CLIENTE);
    expect(input.observacao).toBe("");
    expect(input.numero).toBe("38");
  });
});

// ── Cenário real Fatura 38 (CALVO) — valida correções F38-MANUAL-2 ────────────
function faturaCalvo38(): FaturaComItens {
  const base = faturaManualBase();
  base.modelo = "calvo";
  base.metadata.modelo = "calvo";
  base.metadata.parcela = "1";
  base.descricao =
    "Receita de CT-e referente aos romaneios nº 343550, 343375, 343421, 341721, 341770 e 343488, incluindo serviço de devolução.";
  base.metadata.descricao = base.descricao;
  base.itens[0].descricao = base.descricao;
  return base;
}

describe("F38-MANUAL-2 — IE e parcela chegam ao PdfFaturaInput", () => {
  it("clienteIe é preenchido (não null) quando cliente possui IE", () => {
    const input = montarInputPdfFatura(faturaManualBase(), EMPRESA, CLIENTE);
    expect(input.clienteIe).toBe("987654321");
    expect(input.clienteCnpj).toBe(CLIENTE.cnpj);
  });

  it("parcela da fatura manual (metadata) chega ao input do PDF", () => {
    const input = montarInputPdfFatura(faturaCalvo38(), EMPRESA, CLIENTE);
    expect(input.parcela).toBe("1");
  });
});

describe("F38-MANUAL-2 — PDF CALVO da Fatura 38 (fixture, sem persistência)", () => {
  it("reproduz o padrão homologado: cliente, CNPJ, IE, endereço, banco, valor", async () => {
    const input = montarInputPdfFatura(faturaCalvo38(), EMPRESA, CLIENTE);
    const doc = await gerarPDFFatura(input);
    const buf = Buffer.from(doc.output("arraybuffer"));
    const s = buf.toString("latin1");

    // Cliente em "Cobrança para:" + dados completos (nunca "—" com cliente válido)
    expect(s).toContain("Cobrança para: CALVO COML IMPO E EXP. LTDA");
    expect(s).not.toContain("Cobrança para: —");
    expect(s).toContain("CNPJ: 98.765.432/0001-10");
    expect(s).toContain("IE: 987654321");
    expect(s).toContain("Av. Cliente, 500");

    // Conta bancária selecionada (snapshot) — sem hardcode
    expect(s).toContain("Dados para Transferência Bancária");
    expect(s).toContain("Banco Cora SCFI");
    expect(s).toContain("AG: 0001");
    expect(s).toContain("C/C: 1390923-1");
    expect(s).toContain("CHAVE PIX: financeiro@conexaoexpress.com.br");

    // Fatura 38, descrição (com wrap de linha na coluna), vencimento e valor
    expect(s).toContain("38");
    expect(s).toContain("Receita de CT-e");
    expect(s).toContain("343550");
    expect(s).toContain("devolução");
    expect(s).toContain("05/09/2026");
    // "R$" é seguido de espaço não-separável (NBSP) na formatação BRL — verifica o valor
    expect(s).toContain("R$");
    expect(s).toContain("3.550,54");
  });

  it("conta do snapshot prevalece sobre a conta genérica da empresa", () => {
    const input = montarInputPdfFatura(faturaCalvo38(), EMPRESA, CLIENTE);
    expect(input.empresa.banco).toBe("Banco Cora SCFI");
    expect(input.empresa.banco).not.toBe("Banco Antigo");
    // Sem snapshot → mantém conta principal da configuração
    const f = faturaCalvo38();
    f.metadata.contaBancaria = null;
    const fallback = montarInputPdfFatura(f, EMPRESA, CLIENTE);
    expect(fallback.empresa.banco).toBe("Banco Antigo");
  });
});
