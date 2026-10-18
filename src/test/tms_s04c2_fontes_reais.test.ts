import { describe, it, expect, vi } from "vitest";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ============================================================================
// TMS-S04C.2 — FONTES REAIS do Relatório Individual de Faturamento do Cliente.
// Valida os cenários 1–8: OS, Escala (representada pela OS), lançamentos
// manuais, deduplicação, campos oficiais e preview = PDF.
// ============================================================================

const dbRef = vi.hoisted(() => ({
  clientes: [] as Record<string, unknown>[],
  ordens_servico: [] as Record<string, unknown>[],
  faturas: [] as Record<string, unknown>[],
}));

interface SupabaseBuilder {
  select: () => SupabaseBuilder;
  eq: () => SupabaseBuilder;
  in: () => SupabaseBuilder;
  neq: () => SupabaseBuilder;
  gte: () => SupabaseBuilder;
  lte: () => SupabaseBuilder;
  or: () => SupabaseBuilder;
  ilike: () => SupabaseBuilder;
  order: () => SupabaseBuilder;
  limit: () => SupabaseBuilder;
  maybeSingle: () => Promise<{ data: null; error: null }>;
  single: () => Promise<{ data: null; error: null }>;
  then: (resolve: (r: { data: Record<string, unknown>[]; error: null }) => unknown) => unknown;
}

const makeBuilder = (tabela: string): SupabaseBuilder => {
  const b = {} as SupabaseBuilder;
  for (const m of ["select", "eq", "in", "neq", "gte", "lte", "or", "ilike", "order", "limit"]) {
    (b as unknown as Record<string, unknown>)[m] = () => b;
  }
  b.maybeSingle = async () => ({ data: null, error: null });
  b.single = async () => ({ data: null, error: null });
  b.then = (resolve) =>
    resolve({ data: ((dbRef as Record<string, unknown>)[tabela] as Record<string, unknown>[]) || [], error: null });
  return b;
};

vi.mock("@/lib/supabase", () => ({
  supabase: { from: (t: string) => makeBuilder(t) },
}));

import { buscarDadosFaturamentoIndividual } from "@/services/relatorios/relatorioService";
import { gerarPDFRelatorioFaturamentoIndividual, type RelatorioFaturamentoIndividualInput } from "@/utils/pdfFatura";
import type { DadosEmpresaFatura } from "@/services/financeiro/faturaService";

const CLIENTE_ID = "550e8400-e29b-41d4-a716-446655440000";
const CLIENTE = {
  id: CLIENTE_ID,
  nome_fantasia: "Calvo Comércio e Importação Ltda",
  razao_social: "Calvo Comércio e Importação Ltda",
  cnpj: "11.222.333/0001-81",
  cidade: "Guarulhos",
  uf: "SP",
};

function os(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    numero: `OS-2026-${id}`,
    data: "2026-08-16",
    data_servico: "2026-08-16",
    created_at: "2026-08-16T12:00:00",
    cliente: CLIENTE_ID,
    status: "finalizada",
    valor_cliente: 520,
    romaneio: "343550",
    veiculo_tipo: "Iveco Daily",
    placa_alocada: "FSP0I96",
    pedagio: 0,
    adicionais: 0,
    descontos: 0,
    origem: "Guarulhos",
    destino: "Morumbi",
    enderecos: [],
    ...extra,
  };
}

function faturaManual(item: Record<string, unknown>, extraFatura: Record<string, unknown> = {}) {
  return {
    id: "fat-manual-1",
    numero: "38",
    data_emissao: "2026-08-20",
    status: "emitida",
    metadata: { origem: "manual" },
    fatura_itens: [item],
    ...extraFatura,
  };
}

function setupClientes() {
  dbRef.clientes = [CLIENTE];
}

/** Remove os bytes de codificação 0x00 que o jsPDF usa como alta ordem por glifo. */
function extrairTextoPDF(buffer: Buffer): string {
  return buffer.toString("latin1").replaceAll("\u0000", "");
}

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

describe("TMS-S04C.2 — Fontes reais (buscarDadosFaturamentoIndividual)", () => {
  it("Cenário 1: operação de OS real aparece UMA vez", async () => {
    setupClientes();
    dbRef.ordens_servico = [os("100")];
    dbRef.faturas = [];
    const r = await buscarDadosFaturamentoIndividual({ clienteId: CLIENTE_ID, dataInicial: "2026-08-01", dataFinal: "2026-08-31" });
    expect(r).not.toBeNull();
    expect(r!.operacoes).toHaveLength(1);
    expect(r!.operacoes[0].origem).toBe("os");
    expect(r!.operacoes[0].valorTotal).toBe(520);
    expect(r!.operacoes[0].romaneio).toBe("343550");
    expect(r!.resumo.totalFaturado).toBe(520);
  });

  it("Cenário 2: Escala representada pela OS — NÃO duplica (item manual com os_id da OS é ignorado)", async () => {
    setupClientes();
    dbRef.ordens_servico = [os("100")];
    // lançamento manual que referencia a MESMA OS → deve ser descartado
    dbRef.faturas = [faturaManual({
      id: "man-1", os_id: "100", romaneio: null, descricao: "Fatura manual da OS 100",
      data_servico: "2026-08-16", valor_base: 520, valor_total: 520,
      km_excedente: 0, pedagio_cliente: 0, valor_descontos: 0, valor_adicionais: 0,
    })];
    const r = await buscarDadosFaturamentoIndividual({ clienteId: CLIENTE_ID, dataInicial: "2026-08-01", dataFinal: "2026-08-31" });
    expect(r!.operacoes).toHaveLength(1); // apenas a OS
    expect(r!.operacoes[0].origem).toBe("os");
    expect(r!.resumo.quantidade).toBe(1);
  });

  it("Cenário 3: lançamento manual válido de cliente aparece (sem veículo/placa → '—')", async () => {
    setupClientes();
    dbRef.ordens_servico = [];
    dbRef.faturas = [faturaManual({
      id: "man-1", os_id: null, romaneio: null, descricao: "Taxa operacional",
      data_servico: "2026-08-20", valor_base: 300, valor_total: 300,
      km_excedente: 0, pedagio_cliente: 0, valor_descontos: 0, valor_adicionais: 0,
    })];
    const r = await buscarDadosFaturamentoIndividual({ clienteId: CLIENTE_ID, dataInicial: "2026-08-01", dataFinal: "2026-08-31" });
    expect(r!.operacoes).toHaveLength(1);
    expect(r!.operacoes[0].origem).toBe("manual");
    expect(r!.operacoes[0].veiculo).toBe("—");
    expect(r!.operacoes[0].valorBase).toBe(300); // fatura_itens.valor_base (oficial direto)
    expect(r!.operacoes[0].valorTotal).toBe(300);
    expect(r!.resumo.totalFaturado).toBe(300);
  });

  it("Cenário 4: pedágio cobrado do cliente (OS.pedagio) correto", async () => {
    setupClientes();
    dbRef.ordens_servico = [os("100", { valor_cliente: 586.43, pedagio: 66.43 })];
    dbRef.faturas = [];
    const r = await buscarDadosFaturamentoIndividual({ clienteId: CLIENTE_ID, dataInicial: "2026-08-01", dataFinal: "2026-08-31" });
    expect(r!.operacoes[0].pedagio).toBe(66.43);
    expect(r!.operacoes[0].valorTotal).toBe(586.43);
  });

  it("Cenário 5: KM adicional disponível (adicionais.jsonb.km_excedente) correto", async () => {
    setupClientes();
    dbRef.ordens_servico = [os("100", { adicionais: { km_excedente: 34.2, espera: 0 } })];
    dbRef.faturas = [];
    const r = await buscarDadosFaturamentoIndividual({ clienteId: CLIENTE_ID, dataInicial: "2026-08-01", dataFinal: "2026-08-31" });
    expect(r!.operacoes[0].kmAdicional).toBeCloseTo(34.2, 2);
  });

  it("Cenário 5b: KM adicional oficial de lançamento manual (fatura_itens.km_excedente)", async () => {
    setupClientes();
    dbRef.ordens_servico = [];
    dbRef.faturas = [faturaManual({
      id: "man-1", os_id: null, romaneio: null, descricao: "Ajuste",
      data_servico: "2026-08-20", valor_base: 500, valor_total: 534.2,
      km_excedente: 34.2, pedagio_cliente: 0, valor_descontos: 0, valor_adicionais: 34.2,
    })];
    const r = await buscarDadosFaturamentoIndividual({ clienteId: CLIENTE_ID, dataInicial: "2026-08-01", dataFinal: "2026-08-31" });
    expect(r!.operacoes[0].kmAdicional).toBeCloseTo(34.2, 2);
  });

  it("Cenário 6: sem reembolso estruturado → 0 (PDF mostra '—')", async () => {
    setupClientes();
    dbRef.ordens_servico = [os("100")];
    dbRef.faturas = [faturaManual({
      id: "man-1", os_id: null, romaneio: null, descricao: "Manual",
      data_servico: "2026-08-20", valor_base: 100, valor_total: 100,
      km_excedente: 0, pedagio_cliente: 0, valor_descontos: 0, valor_adicionais: 0,
    })];
    const r = await buscarDadosFaturamentoIndividual({ clienteId: CLIENTE_ID, dataInicial: "2026-08-01", dataFinal: "2026-08-31" });
    expect(r!.operacoes.every((o) => o.reembolso === 0)).toBe(true);
    expect(r!.resumo.reembolso).toBe(0);
  });

  it("Cenário 8: nenhum UUID exposto nos dados/PDF", async () => {
    setupClientes();
    dbRef.ordens_servico = [os("100")];
    dbRef.faturas = [];
    const r = await buscarDadosFaturamentoIndividual({ clienteId: CLIENTE_ID, dataInicial: "2026-08-01", dataFinal: "2026-08-31" });
    const flat = JSON.stringify(r!.operacoes);
    expect(flat).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});

describe("TMS-S04C.2 — Preview = PDF (mesma fonte) + logo", () => {
  const OUT_DIR = join(process.cwd(), "test-results", "tms-s04c2");
  const OUT_PDF = join(OUT_DIR, "relatorio_individual_fontes_reais.pdf");

  function toInput(r: NonNullable<Awaited<ReturnType<typeof buscarDadosFaturamentoIndividual>>>): RelatorioFaturamentoIndividualInput {
    return {
      cliente: r.cliente.nome,
      clienteCnpj: r.cliente.cnpj || undefined,
      periodo: "01/08/2026 a 22/08/2026",
      itens: r.operacoes.map((o) => ({
        data: o.data, romaneio: o.romaneio, veiculo: o.veiculo, trajeto: o.trajeto,
        valorBase: o.valorBase, kmAdicional: o.kmAdicional, pedagio: o.pedagio,
        reembolso: o.reembolso, descontos: o.descontos, valorTotal: o.valorTotal,
      })),
      resumo: r.resumo,
      empresa: EMPRESA,
      logoBase64: `data:image/png;base64,${readFileSync(join(process.cwd(), "public", "logos", "logo-conexao-oficial.png")).toString("base64")}`,
    };
  }

  it("Cenário 7: PDF gerado a partir das MESMAS operações da prévia (totais idênticos)", async () => {
    setupClientes();
    dbRef.ordens_servico = [os("100", { valor_cliente: 586.43, pedagio: 66.43, adicionais: { km_excedente: 34.2 } })];
    dbRef.faturas = [faturaManual({
      id: "man-1", os_id: null, romaneio: null, descricao: "Taxa",
      data_servico: "2026-08-20", valor_base: 300, valor_total: 300,
      km_excedente: 0, pedagio_cliente: 0, valor_descontos: 0, valor_adicionais: 0,
    })];
    const r = await buscarDadosFaturamentoIndividual({ clienteId: CLIENTE_ID, dataInicial: "2026-08-01", dataFinal: "2026-08-31" });
    // a prévia renderiza r.operacoes; o PDF é gerado a partir do mesmo array
    const doc = await gerarPDFRelatorioFaturamentoIndividual(toInput(r!));
    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(OUT_PDF, Buffer.from(doc.output("arraybuffer")));
    const texto = extrairTextoPDF(Buffer.from(doc.output("arraybuffer")));
    // total da OS (586,43) + manual (300) = 886,43
    expect(texto).toContain("R$ 586,43");
    expect(texto).toContain("R$ 300,00");
    expect(texto).toContain("R$ 886,43");
    expect(existsSync(OUT_PDF)).toBe(true);
  });

  it("PDF não expõe UUID e a prévia usa a mesma origem (dados.id não sai)", async () => {
    setupClientes();
    dbRef.ordens_servico = [os("100")];
    dbRef.faturas = [];
    const r = await buscarDadosFaturamentoIndividual({ clienteId: CLIENTE_ID, dataInicial: "2026-08-01", dataFinal: "2026-08-31" });
    const doc = await gerarPDFRelatorioFaturamentoIndividual(toInput(r!));
    const texto = extrairTextoPDF(Buffer.from(doc.output("arraybuffer")));
    expect(texto).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});
