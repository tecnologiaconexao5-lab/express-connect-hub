import { describe, it, expect, beforeAll } from "vitest";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtratoFechamentoPrestador, OperacaoFinanceira } from "@/services/financeiro/extratoPrestadorService";
import {
  generateExtratoPrestadorPDF,
  formatarMoedaPDF,
  montarAdicionais,
  montarTrajetoServico,
  limparTrajetoTexto,
  calcularValorExibidoOperacao,
} from "@/lib/pdf/extratoPrestadorReport";

// ============================================================================
// TMS-S02 — Finalização premium do Extrato do Prestador.
// Gera PDF REAL (mesma função usada na tela) e valida estrutura/ordem/valores.
// Nenhum dado do banco é lido; o extrato é montado com os MESMOS valores do
// teste financeiro real já comprovado (CÉSAR + Calvo, 31/05/2026 a 21/08/2026,
// líquido R$ 11.750,50).
// ============================================================================

const LOGO_PATH = join(process.cwd(), "public", "logos", "logo-conexao-oficial.png");
const OUT_DIR = join(process.cwd(), "test-results", "tms-s02");
const OUT_PDF = join(OUT_DIR, "extrato_cesar_calvo.pdf");

function montarExtratoTeste(): ExtratoFechamentoPrestador {
  return {
    numero: "FP-202608-ABC12345",
    prestador: {
      id: "prest-1",
      nome_completo: "CÉSAR AUGUSTO HOLANDA SILVA",
      cpf_cnpj: "12345678901",
      veiculo_tipo: "Cavalo Truck",
      veiculo_placa: "ABC-1D23",
    },
    periodo_inicio: "2026-05-31",
    periodo_fim: "2026-08-21",
    data_geracao: "2026-08-21",
    status: "conferido",
    status_pagamento: "programado",
    status_aprovacao: "aprovado",
    data_prevista_pagamento: "2026-09-05",
    clienteLabel: "Calvo Comércio e Importação Ltda",
    origemLabel: "ordem_servico",
    valor_total_creditos: 12580.5,
    valor_total_debitos: 830,
    valor_liquido: 11750.5,
    valor_servicos: 11730.5,
    valor_pedagio: 350,
    valor_adicionais: 500,
    valor_reembolsos: 0,
    valor_descontos: 0,
    valor_adiantamentos: 830,
    valor_combustivel: 0,
    valor_bonus: 0,
    operacoes: [
      {
        id: "os-1",
        tipo: "credito",
        data_operacao: "2026-06-10",
        tipoOrigem: "ordem_servico",
        ordem_servico_numero: "OS-2026-100",
        origem: "Guarulhos",
        destino: "Morumbi",
        km_total: 52,
        valor_base: 5000,
        valor: 5000,
        valor_pedagio: 150,
        valor_adicionais: 200,
      },
      {
        id: "os-2",
        tipo: "credito",
        data_operacao: "2026-07-15",
        tipoOrigem: "ordem_servico",
        ordem_servico_numero: "OS-2026-101",
        origem: "C a m p i n a s",
        destino: "O s a s c o",
        km_total: 85,
        valor_base: 6730.5,
        valor: 6730.5,
        valor_pedagio: 200,
        valor_adicionais: 300,
      },
      {
        id: "man-1",
        tipo: "debito",
        data_operacao: "2026-08-05",
        tipoOrigem: "manual",
        descricao: "Adiantamento",
        valor: -830,
        valor_base: 0,
      },
    ],
    movimentos: [],
    observacoes: "Extrato referente à produção do período selecionado. Cliente: Calvo Comércio e Importação Ltda",
  };
}

/** Remove os bytes de codificação 0x00 que o jsPDF usa como alta ordem por glifo. */
function extrairTextoPDF(buffer: Buffer): string {
  return buffer.toString("latin1").replaceAll("\u0000", "");
}

/** Constrói uma operação válida (campos obrigatórios preenchidos). */
function op(parcial: Partial<OperacaoFinanceira>): OperacaoFinanceira {
  return {
    id: "op-teste",
    tipo: "credito",
    data_operacao: "2026-06-10",
    valor_base: 0,
    ...parcial,
  };
}

describe("TMS-S02 — Helpers de apresentação do extrato", () => {
  it("limparTrajetoTexto remove espaçamento artificial entre letras", () => {
    expect(limparTrajetoTexto("G u a r u l h o s")).toBe("Guarulhos");
    expect(limparTrajetoTexto("C a m p i n a s")).toBe("Campinas");
    expect(limparTrajetoTexto("  Guarulhos   /  Osasco  ")).toBe("Guarulhos / Osasco");
  });

  it("limparTrajetoTexto preserva palavras compostas reais", () => {
    expect(limparTrajetoTexto("São Paulo")).toBe("São Paulo");
    expect(limparTrajetoTexto("Santo André")).toBe("Santo André");
  });

  it("montarTrajetoServico monta trajeto natural e ignora UUID", () => {
    const o = op({ origem: "Guarulhos", destino: "Morumbi", km_total: 52, valor_base: 5000, valor: 5000 });
    const trajeto = montarTrajetoServico(o);
    expect(trajeto).toContain("Guarulhos");
    expect(trajeto).toContain("Morumbi");
    expect(trajeto).toContain("52 km");
    expect(trajeto).not.toMatch(/\d{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);

    const opUuid = op({ origem: "550e8400-e29b-41d4-a716-446655440000", destino: "Morumbi" });
    expect(montarTrajetoServico(opUuid)).not.toContain("550e8400");
  });

  it("montarTrajetoServico usa descrição natural em lançamentos manuais", () => {
    const manual = op({ tipo: "debito", data_operacao: "2026-08-05", tipoOrigem: "manual", descricao: "Adiantamento", valor: -830 });
    expect(montarTrajetoServico(manual)).toBe("Adiantamento");
  });

  it("montarAdicionais usa somente dados reais da operação", () => {
    expect(montarAdicionais(op({ valor_pedagio: 150, valor_adicionais: 200 }))).toBe("Pedágio · Adicional");
    expect(montarAdicionais(op({ valor_pedagio: 0 }))).toBe("—");
    expect(montarAdicionais(op({ valor_reembolso_outros: 40 }))).toBe("Reembolso");
    expect(montarAdicionais(op({ valor_combustivel: 80 }))).toBe("Combustível");
    expect(montarAdicionais(op({}))).toBe("—");
  });

  it("calcularValorExibidoOperacao mantém sinal correto (crédito + / débito -)", () => {
    expect(calcularValorExibidoOperacao(op({ tipo: "credito", valor: 5000 }))).toBe(5000);
    expect(calcularValorExibidoOperacao(op({ tipo: "debito", valor: -830 }))).toBe(-830);
    expect(calcularValorExibidoOperacao(op({ tipo: "debito", valor: 830 }))).toBe(-830);
  });

  it("formatarMoedaPDF aplica padrão brasileiro", () => {
    expect(formatarMoedaPDF(520)).toBe("R$ 520,00");
    expect(formatarMoedaPDF(66.43)).toBe("R$ 66,43");
    expect(formatarMoedaPDF(2177.92)).toBe("R$ 2.177,92");
    expect(formatarMoedaPDF(-830)).toBe("-R$ 830,00");
  });
});

describe("TMS-S02 — Geração do PDF REAL do extrato", () => {
  beforeAll(() => {
    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  });

  it("usa o asset oficial /logos/logo-conexao-oficial.png (letras brancas + X colorido)", () => {
    expect(existsSync(LOGO_PATH)).toBe(true);
    const buf = readFileSync(LOGO_PATH);
    expect(buf.length).toBeGreaterThan(1000);
    // Assinatura PNG
    expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  it("gera o PDF com a nova ordem (Operações → Resumo → Valor Líquido) e sem Romaneio", async () => {
    const extrato = montarExtratoTeste();
    const logoBase64 = `data:image/png;base64,${readFileSync(LOGO_PATH).toString("base64")}`;

    const doc = await generateExtratoPrestadorPDF(extrato, {
      save: false,
      logoBase64,
      logoWidth: 1024,
      logoHeight: 682,
    });
    const output = doc.output("arraybuffer");
    expect(output.byteLength).toBeGreaterThan(5000);

    const outPath = OUT_PDF;
    writeFileSync(outPath, Buffer.from(output));
    console.log("[TMS-S02] PDF gerado em:", outPath, "bytes:", output.byteLength);
    expect(existsSync(outPath)).toBe(true);

    const texto = extrairTextoPDF(Buffer.from(output));

    // 1. Cabeçalho / título
    expect(texto).toContain("EXTRATO DE FECHAMENTO DO PRESTADOR");
    expect(texto).toContain("Conexão Express Transportes LTDA");
    expect(texto).toContain("CNPJ: 31.227.975/0001-80");
    expect(texto).toContain("São Paulo/SP");

    // 2. Organização Prestador | Cliente / Período | Pagamento
    expect(texto).toContain("PRESTADOR");
    expect(texto).toContain("CÉSAR AUGUSTO HOLANDA SILVA");
    expect(texto).toContain("CLIENTE");
    expect(texto).toContain("Calvo Comércio e Importação Ltda");
    expect(texto).toContain("PERÍODO");
    expect(texto).toContain("31/05/2026 a 21/08/2026");
    expect(texto).toContain("PAGAMENTO");
    expect(texto).toContain("Previsão para: 05/09/2026");

    // 3. Nova ordem obrigatória
    const iOp = texto.indexOf("OPERAÇÕES DO PERÍODO");
    const iRes = texto.indexOf("RESUMO FINANCEIRO");
    const iLiq = texto.indexOf("VALOR LÍQUIDO");
    expect(iOp).toBeGreaterThan(-1);
    expect(iRes).toBeGreaterThan(iOp);
    expect(iLiq).toBeGreaterThan(iRes);

    // 4. Sem coluna Romaneio / OS
    expect(texto).not.toContain("Ordem / Romaneio");

    // 5. Nova tabela: Data | Serviço / Trajeto | Adicionais | Valor
    expect(texto).toContain("Serviço / Trajeto");
    expect(texto).toContain("Adicionais");

    // 6. Valores no padrão brasileiro
    expect(texto).toContain("R$ 11.750,50");
    expect(texto).toContain("R$ 12.580,50");
    expect(texto).toContain("-R$ 830,00");

    // 7. Trajeto sem letras artificialmente espaçadas
    expect(texto).toContain("Campinas");
    expect(texto).toContain("Osasco");
    expect(texto).not.toContain("C a m p i n a s");
    expect(texto).not.toContain("O s a s c o");

    // 8. Rodapé discreto (sem Ref. interna técnica)
    expect(texto).toContain("Conexão Express · Gerado em");
    expect(texto).toContain("Página 1 de");
    expect(texto).not.toContain("Ref. interna");
  });

  it("extrato sem operações gera documento sem quebra", async () => {
    const extrato = montarExtratoTeste();
    extrato.operacoes = [];
    const doc = await generateExtratoPrestadorPDF(extrato, { save: false });
    const buf = Buffer.from(doc.output("arraybuffer"));
    expect(buf.length).toBeGreaterThan(5000);
    const texto = extrairTextoPDF(buf);
    expect(texto).toContain("Nenhuma operação registrada neste período.");
    expect(texto).toContain("VALOR LÍQUIDO");
  });
});
