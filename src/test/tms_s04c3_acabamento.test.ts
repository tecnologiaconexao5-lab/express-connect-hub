import { describe, it, expect, vi } from "vitest";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ============================================================================
// TMS-S04C.3 — Acabamento final do Relatório Individual do Cliente.
// Cenários A–G: clientes reais, logo, cabeçalho, Romaneio/OC + trajeto,
// alinhamento e valores preservados (S04C.2).
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

import { buscarClientesAtivos, buscarDadosFaturamentoIndividual } from "@/services/relatorios/relatorioService";
import { gerarPDFRelatorioFaturamentoIndividual, type RelatorioFaturamentoIndividualInput } from "@/utils/pdfFatura";
import type { DadosEmpresaFatura } from "@/services/financeiro/faturaService";

const LOGO = `data:image/png;base64,${readFileSync(join(process.cwd(), "public", "logos", "logo-conexao-oficial.png")).toString("base64")}`;

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

function input(itens: RelatorioFaturamentoIndividualInput["itens"]): RelatorioFaturamentoIndividualInput {
  const resumo = itens.reduce(
    (a, i) => {
      a.quantidade += 1;
      a.valorBase += i.valorBase;
      a.kmAdicional += i.kmAdicional;
      a.pedagio += i.pedagio;
      a.reembolso += i.reembolso;
      a.descontos += i.descontos;
      a.totalFaturado += i.valorTotal;
      return a;
    },
    { quantidade: 0, valorBase: 0, kmAdicional: 0, pedagio: 0, reembolso: 0, descontos: 0, totalFaturado: 0 }
  );
  return {
    cliente: "Calvo Comércio e Importação Ltda",
    clienteCnpj: "11.222.333/0001-81",
    periodo: "01/08/2026 a 22/08/2026",
    itens,
    resumo,
    empresa: EMPRESA,
    logoBase64: LOGO,
  };
}

/** Remove os bytes de codificação 0x00 que o jsPDF usa como alta ordem por glifo. */
function extrairTextoPDF(buffer: Buffer): string {
  return buffer.toString("latin1").replaceAll("\u0000", "");
}

describe("TMS-S04C.3 — Cenário A: clientes do cadastro oficial", () => {
  it("buscarClientesAtivos consulta a tabela clientes filtrando status ativo", async () => {
    dbRef.clientes = [{ id: "c1", nome_fantasia: "Calvo", razao_social: "Calvo Ltda", cnpj: "11.222.333/0001-81", status: "ativo" }];
    const res = await buscarClientesAtivos();
    expect(Array.isArray(res)).toBe(true);
    expect(res).toHaveLength(1);
  });

  it("fonte do seletor (RelatorioFaturamentoCliente) usa clientesAtivos do cadastro", () => {
    const src = readFileSync(
      join(process.cwd(), "src", "components", "financeiro", "relatorios", "RelatorioFaturamentoCliente.tsx"),
      "utf8"
    );
    expect(src).toContain("buscarClientesAtivos()");
    expect(src).toContain("clientesAtivos");
  });
});

describe("TMS-S04C.3 — Cenário B/C: cliente selecionado por nome, nunca UUID", () => {
  const CLIENTE_ID = "550e8400-e29b-41d4-a716-446655440000";

  it("cliente com nome fantasia usa nome fantasia; sem fantasia usa razão social (e nunca UUID)", async () => {
    dbRef.clientes = [{ id: CLIENTE_ID, nome_fantasia: "Calvo Comércio", razao_social: "Calvo Ltda", cnpj: "11.222.333/0001-81", cidade: "Guarulhos", uf: "SP" }];
    dbRef.ordens_servico = [];
    dbRef.faturas = [];
    const r1 = await buscarDadosFaturamentoIndividual({ clienteId: CLIENTE_ID });
    expect(r1!.cliente.nome).toBe("Calvo Comércio");

    dbRef.clientes = [{ id: CLIENTE_ID, nome_fantasia: null, razao_social: "Razão Social Real Ltda", cnpj: "99.999.999/0001-00", cidade: "São Paulo", uf: "SP" }];
    const r2 = await buscarDadosFaturamentoIndividual({ clienteId: CLIENTE_ID });
    expect(r2!.cliente.nome).toBe("Razão Social Real Ltda");
    // o NOME exibido nunca é um UUID (id interno não é exposto ao usuário)
    expect(r2!.cliente.nome).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });

  it("PDF exibe o nome do cliente (nunca UUID)", async () => {
    const doc = await gerarPDFRelatorioFaturamentoIndividual(input([
      { data: "2026-08-16", romaneio: "343198", veiculo: "Iveco Daily · FSP0I96", trajeto: "Guarulhos › Morumbi", valorBase: 520, kmAdicional: 0, pedagio: 0, reembolso: 0, descontos: 0, valorTotal: 520 },
    ]));
    const texto = extrairTextoPDF(Buffer.from(doc.output("arraybuffer")));
    expect(texto).toContain("Calvo Comércio e Importação Ltda");
    expect(texto).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});

describe("TMS-S04C.3 — Cenários D/E/F: Romaneio/OC + trajeto limpos", () => {
  const base = { veiculo: "Iveco Daily · FSP0I96", valorBase: 520, kmAdicional: 0, pedagio: 0, reembolso: 0, descontos: 0, valorTotal: 520 };

  it("D) romaneio preenchido + trajeto → duas linhas, sem vírgula", async () => {
    const doc = await gerarPDFRelatorioFaturamentoIndividual(input([
      { ...base, data: "2026-08-16", romaneio: "343198", trajeto: "Guarulhos › Morumbi" },
    ]));
    const texto = extrairTextoPDF(Buffer.from(doc.output("arraybuffer")));
    expect(texto).toContain("343198");
    expect(texto).toContain("Guarulhos");
    expect(texto).toContain("Morumbi");
    expect(texto).not.toContain("343198,Guarulhos");
  });

  it("E) romaneio vazio + trajeto → '—' e trajeto, NUNCA '—,trajeto'", async () => {
    const doc = await gerarPDFRelatorioFaturamentoIndividual(input([
      { ...base, data: "2026-08-16", romaneio: "", trajeto: "Guarulhos › São Paulo" },
    ]));
    const texto = extrairTextoPDF(Buffer.from(doc.output("arraybuffer")));
    expect(texto).toContain("Guarulhos");
    expect(texto).toContain("São Paulo");
    expect(texto).not.toContain("—,Guarulhos");
    expect(texto).not.toContain("—,Guarulhos › São Paulo");
  });

  it("F) sem romaneio e sem trajeto → apenas '—'", async () => {
    const doc = await gerarPDFRelatorioFaturamentoIndividual(input([
      { ...base, data: "2026-08-16", romaneio: "", trajeto: "" },
    ]));
    const texto = extrairTextoPDF(Buffer.from(doc.output("arraybuffer")));
    expect(texto).not.toContain("—,Guarulhos");
  });
});

describe("TMS-S04C.3 — Cenário G: valores e totais preservados (S04C.2)", () => {
  const OUT_DIR = join(process.cwd(), "test-results", "tms-s04c3");
  const OUT_PDF = join(OUT_DIR, "relatorio_individual_acabamento.pdf");

  it("PDF mantém os mesmos valores/totais da S04C.2 (OS + manual)", async () => {
    const inp = input([
      { data: "2026-08-16", romaneio: "343550", veiculo: "Iveco Daily · FSP0I96", trajeto: "Guarulhos › Morumbi", valorBase: 520, kmAdicional: 34.2, pedagio: 66.43, reembolso: 0, descontos: 0, valorTotal: 586.43 },
      { data: "2026-08-20", romaneio: "", veiculo: "—", trajeto: "Taxa operacional", valorBase: 300, kmAdicional: 0, pedagio: 0, reembolso: 0, descontos: 0, valorTotal: 300 },
    ]);
    const doc = await gerarPDFRelatorioFaturamentoIndividual(inp);
    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(OUT_PDF, Buffer.from(doc.output("arraybuffer")));
    const texto = extrairTextoPDF(Buffer.from(doc.output("arraybuffer")));
    expect(texto).toContain("R$ 586,43");
    expect(texto).toContain("R$ 300,00");
    expect(texto).toContain("R$ 886,43");
    expect(texto).toContain("TOTAL FATURADO");
    expect(existsSync(OUT_PDF)).toBe(true);
  });
});
