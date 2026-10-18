// ═══════════════════════════════════════════════════════════════════════════════
// TMS-ORC-PDF-01 — Correção do PDF de orçamento comercial:
//   A) "Duração estimada" sai do PDF e CONTINUA na tela (formulário);
//   B) Resumo financeiro com nomenclatura profissional
//      ("Valor Base do Frete" / "VALOR FINAL DA PROPOSTA");
//   C) VALOR FINAL impresso ≠ R$ 0,00 quando há valor real — origem do dado é a
//      regra canônica calcularValorFinal() (sem valor fixo, sem regra paralela);
//   D) Componentes (adicionais/pedágio/descontos) preservados no total.
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { construirPdfOrcamento } from "@/components/comercial/orcamentoPdf";
import { resolverValorFinal, calcularValorFinal } from "@/components/comercial/orcamentoCalculo";
import { toOrcamentoDomain } from "@/lib/dbMappers";
import type { Orcamento } from "@/components/comercial/types";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const SRC_PDF = "src/components/comercial/orcamentoPdf.ts";
const SRC_FORM = "src/components/comercial/OrcamentoForm.tsx";

const pdf = read(SRC_PDF);
const form = read(SRC_FORM);

// Registro LEGADO real (ORC-202609-8659): valorBase=2200 gravado, valorFinal=0.
const valoresLegado = {
  tabelaVinculada: "", valorBase: 2200, adicionais: 0, pedagio: 0, kmExcedente: 0,
  ajudante: 0, adValorem: 0, gris: 0, devolucao: 0, reentrega: 0, descontos: 0,
  valorFinal: 0, custoEstimado: 0, margemEstimada: 0, lucroEstimado: 0,
} as unknown as Orcamento["valores"];

const orcLegado: Orcamento = {
  id: "legado-1",
  numero: "ORC-202609-8659",
  cliente: "CLIENTE LEGADO ORC-PDF-01",
  clienteCnpj: "04.785.340/0001-26",
  unidade: "Matriz",
  centroCusto: "COMERCIAL",
  responsavel: "Validação ORC-PDF-01",
  dataEmissao: "2026-09-24",
  validade: "2026-10-30",
  tipoOperacao: "Carga fechada",
  modalidade: "esporadico",
  prioridade: "normal",
  pedidoInterno: "",
  observacoesGerais: "Proposta legada para validação da correção do PDF.",
  status: "em_analise",
  enderecos: [
    { tipo: "coleta", sequencia: 1, endereco: "Av. das Nações Unidas, 1000", cidade: "São Paulo", uf: "SP", cep: "04578-000", contato: "João Coleta", telefone: "(11) 99999-0001", instrucoes: "", janelaInicio: "08:00", janelaFim: "12:00" },
    { tipo: "entrega", sequencia: 2, endereco: "Rod. Anhanguera, km 25", cidade: "Jundiaí", uf: "SP", cep: "13200-000", contato: "Maria Entrega", telefone: "(11) 99999-0002", instrucoes: "", janelaInicio: "14:00", janelaFim: "18:00" },
  ],
  carga: { tipo: "geral", descricao: "Carga geral paletizada", volumes: 10, peso: 500, cubagem: 2.5, pallets: 5, valorDeclarado: 0, refrigerado: false, ajudante: false, fragil: false, empilhavel: true, risco: false, perigosa: false, controlada: false, observacoes: "" },
  veiculo: { tipo: "truck", subcategoria: "pesado", carroceria: "sider" },
  valores: valoresLegado,
  distancia_rota: { distancia_km: 350, duracao_min: 360, distancia_texto: "350 km", duracao_texto: "6h 00min", maps_provider: "mapbox" },
  historico: [],
} as unknown as Orcamento;

const gerarLatin = async (orc: Orcamento): Promise<{ latin: string; paginas: number; bytes: number }> => {
  const doc = await construirPdfOrcamento(orc);
  const buf = Buffer.from(doc.output("arraybuffer") as ArrayBuffer);
  return { latin: buf.toString("latin1"), paginas: doc.getNumberOfPages(), bytes: buf.length };
};

describe("TMS-ORC-PDF-01 A — Duração: fora do PDF, na tela", () => {
  it("PDF não imprime mais 'Duração estimada' nem usa duracao_texto", () => {
    expect(pdf).not.toContain("Duração estimada");
    expect(pdf).not.toContain("duracao_texto");
  });

  it("distância estimada permanece no PDF (apenas a duração sai)", () => {
    expect(pdf).toContain("Distância estimada");
  });

  it("tela (formulário) mantém a duração da rota", () => {
    expect(form).toContain("duracaoTexto");
    expect(form).toContain("duracao_texto");
  });

  it("PDF real legado não contém 'Duração estimada'", async () => {
    const { latin, paginas } = await gerarLatin(orcLegado);
    expect(paginas).toBeGreaterThanOrEqual(1);
    expect(latin).not.toContain("Dura\u00E7\u00E3o estimada");
    expect(latin).toContain("Dist\u00E2ncia estimada");
  }, 30000);
});

describe("TMS-ORC-PDF-01 B — Nomenclatura profissional do resumo financeiro", () => {
  it("primeira linha do resumo é 'Valor Base do Frete' (não 'Valor do Transporte')", () => {
    expect(pdf).toContain('"Valor Base do Frete"');
    expect(pdf).not.toContain('"Valor do Transporte"');
  });

  it("faixa de destaque é 'VALOR FINAL DA PROPOSTA' (não 'VALOR FINAL' genérico)", () => {
    expect(pdf).toContain('doc.text("VALOR FINAL DA PROPOSTA"');
    expect(pdf).not.toMatch(/doc\.text\("VALOR FINAL",/);
  });

  it("PDF real renderiza a nova nomenclatura", async () => {
    const { latin } = await gerarLatin(orcLegado);
    expect(latin).toContain("Valor Base do Frete");
    expect(latin).toContain("VALOR FINAL DA PROPOSTA");
    expect(latin).not.toContain("Valor do Transporte");
  }, 30000);
});

describe("TMS-ORC-PDF-01 C — VALOR FINAL impresso = total real (regra canônica)", () => {
  it("registro legado (base 2200 / final gravado 0) => total exibido 2200", () => {
    expect(resolverValorFinal(valoresLegado)).toBe(2200);
    expect(calcularValorFinal(valoresLegado)).toBe(2200);
  });

  it("valorFinal persistido é respeitado (sem recalcular por cima)", () => {
    const v = { ...valoresLegado, valorFinal: 1500 };
    expect(resolverValorFinal(v)).toBe(1500);
  });

  it("override manual é respeitado (inclusive ajuste para 0)", () => {
    const v = { ...valoresLegado, valorFinal: 0, pricing: { overrideManual: true } };
    expect(resolverValorFinal(v)).toBe(0);
  });

  it("sem valores não inventa total (0 => 0)", () => {
    const v = { ...valoresLegado, valorBase: 0, valorFinal: 0 };
    expect(resolverValorFinal(v)).toBe(0);
  });

  it("PDF legado mostra VALOR FINAL = R$ 2.200,00 (não R$ 0,00)", async () => {
    const { latin } = await gerarLatin(orcLegado);
    expect(latin).toMatch(/R\$\s2\.200,00/);
    expect(latin).not.toContain("R$ 0,00");
  }, 30000);

  it("toOrcamentoDomain normaliza o total legado na leitura (banco intacto)", () => {
    const dom = toOrcamentoDomain({
      numero: "ORC-202609-8659", status: "em_analise",
      valor_base: null, valor_final: null,
      valores: { valorBase: 2200, valorFinal: 0 },
      enderecos: [], carga: {}, veiculo: {},
    });
    expect(dom.valores.valorFinal).toBe(2200);
    expect(dom.valorFinal).toBe(2200);
    expect(dom.valores.valorBase).toBe(2200);
  });

  it("toOrcamentoDomain espelha coluna dedicada quando o JSONB não tem total", () => {
    const dom = toOrcamentoDomain({
      numero: "ORC-1", valor_base: 2200, valor_final: 2200,
      valores: {}, enderecos: [], carga: {}, veiculo: {},
    });
    expect(dom.valores.valorBase).toBe(2200);
    expect(dom.valores.valorFinal).toBe(2200);
    expect(dom.valorFinal).toBe(2200);
  });

  it("toOrcamentoDomain preserva override manual persistido", () => {
    const dom = toOrcamentoDomain({
      numero: "ORC-1", valor_base: null, valor_final: null,
      valores: { valorBase: 2200, valorFinal: 400, pricing: { overrideManual: true } },
      enderecos: [], carga: {}, veiculo: {},
    });
    expect(dom.valores.valorFinal).toBe(400);
    expect(dom.valorFinal).toBe(400);
  });
});

describe("TMS-ORC-PDF-01 D — Componentes preservados no total impresso", () => {
  const comComponentes: Orcamento = {
    ...orcLegado,
    id: "legado-2",
    numero: "ORC-202609-9901",
    valores: {
      ...valoresLegado,
      valorBase: 2200, adicionais: 100, pedagio: 50, kmExcedente: 0, ajudante: 0,
      devolucao: 0, reentrega: 0, descontos: 20, valorFinal: 0,
    },
  } as unknown as Orcamento;

  it("regra canônica soma os componentes existentes", () => {
    expect(resolverValorFinal(comComponentes.valores)).toBe(2330);
  });

  it("PDF lista os componentes e fecha com o total correto", async () => {
    const { latin } = await gerarLatin(comComponentes);
    expect(latin).toContain("Adicionais");
    expect(latin).toContain("Ped\u00E1gio");
    expect(latin).toContain("Descontos");
    expect(latin).toMatch(/R\$\s2\.330,00/);
  }, 30000);
});
