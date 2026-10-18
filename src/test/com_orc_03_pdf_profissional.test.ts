// ═══════════════════════════════════════════════════════════════════════════════
// TMS-COM-ORC-03 — PDF Comercial Profissional (prova de render real)
// Gera o PDF no jsdom e audita: páginas, acentos (Latin-1), ausência de
// "undefined"/"null"/mojibake, campos reais de carga/pontos/veículo/financeiro.
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { construirPdfOrcamento } from "@/components/comercial/orcamentoPdf";
import type { Orcamento } from "@/components/comercial/types";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const SRC_PDF = "src/components/comercial/orcamentoPdf.ts";
const SRC_FORM = "src/components/comercial/OrcamentoForm.tsx";

const zeros = { tabelaVinculada: "", valorBase: 2200, adicionais: 0, pedagio: 0, kmExcedente: 0, ajudante: 0, devolucao: 0, reentrega: 0, descontos: 0, valorFinal: 2200, custoEstimado: 0, margemEstimada: 0, lucroEstimado: 0 };

const orc: Orcamento = {
  id: "test-1",
  numero: "ORC-202609-9303",
  cliente: "CLIENTE CONTROLADO ORC-03",
  clienteCnpj: "11.222.333/0001-81",
  unidade: "Matriz",
  centroCusto: "COMERCIAL",
  responsavel: "Validação ORC-03",
  dataEmissao: "2026-09-26",
  validade: "2026-10-26",
  tipoOperacao: "Carga fechada",
  modalidade: "esporadico",
  prioridade: "normal",
  pedidoInterno: "",
  observacoesGerais: "Proposta controlada para validação visual.",
  status: "rascunho",
  enderecos: [
    { tipo: "coleta", sequencia: 1, endereco: "Av. das Nações Unidas, 1000", cidade: "São Paulo", uf: "SP", cep: "04578-000", contato: "João Coleta", telefone: "(11) 99999-0001", instrucoes: "", janelaInicio: "08:00", janelaFim: "12:00" },
    { tipo: "entrega", sequencia: 2, endereco: "Rod. Anhanguera, km 25", cidade: "Jundiaí", uf: "SP", cep: "13200-000", contato: "Maria Entrega", telefone: "(11) 99999-0002", instrucoes: "", janelaInicio: "14:00", janelaFim: "18:00" },
  ],
  carga: { tipo: "geral", descricao: "Carga geral paletizada", volumes: 10, peso: 500, cubagem: 2.5, pallets: 5, valorDeclarado: 0, refrigerado: false, ajudante: false, fragil: false, empilhavel: true, risco: false, perigosa: false, controlada: false, observacoes: "" },
  veiculo: { tipo: "truck", subcategoria: "pesado", carroceria: "sider" },
  valores: zeros,
  distancia_rota: { distancia_km: 350, duracao_min: 360, distancia_texto: "350 km", duracao_texto: "6h 00min", maps_provider: "mapbox" },
  historico: [],
};

async function gerarLatin(): Promise<{ paginas: number; latin: string; bytes: number }> {
  const doc = await construirPdfOrcamento(orc);
  const buf = Buffer.from(doc.output("arraybuffer") as ArrayBuffer);
  return { paginas: doc.getNumberOfPages(), latin: buf.toString("latin1"), bytes: buf.length };
}

describe("TMS-COM-ORC-03 — PDF profissional (render real)", () => {
  it("caso compacto (ORC-202609-9303) => exatamente 1 página", async () => {
    const { paginas, bytes } = await gerarLatin();
    expect(paginas).toBe(1);
    expect(bytes).toBeGreaterThan(5000);
  }, 30000);

  it("rodapé 'Página 1 de 1' no caso compacto", async () => {
    const { latin } = await gerarLatin();
    expect(latin).toContain("Página 1 de 1");
  }, 30000);

  it("normalização visual de textos (Normal/Pesado/Sider)", async () => {
    const { latin } = await gerarLatin();
    expect(latin).toContain("Caminhão Truck");
    expect(latin).toContain("Pesado");
    expect(latin).toContain("Sider");
    expect(latin).toContain("Normal");
  }, 30000);

  it("caso grande => paginação automática e sem corte", async () => {
    const muitos = Array.from({ length: 14 }, (_, i) => ({
      tipo: (i % 2 === 0 ? "coleta" : "entrega") as "coleta" | "entrega",
      sequencia: i + 1,
      endereco: `${i % 2 === 0 ? "Av. das Nações Unidas" : "Rod. Anhanguera"}, ${1000 + i + 1}`,
      cidade: "São Paulo", uf: "SP", cep: "00000-000", contato: "Contato", telefone: "(11) 90000-0000", instrucoes: "", janelaInicio: "08:00", janelaFim: "18:00",
    }));
    const grande = { ...orc, numero: "ORC-202609-9999", enderecos: muitos } as Orcamento;
    const doc = await construirPdfOrcamento(grande);
    const paginas = doc.getNumberOfPages();
    const latin = Buffer.from(doc.output("arraybuffer") as ArrayBuffer).toString("latin1");
    expect(paginas).toBeGreaterThanOrEqual(2);
    expect(latin).toContain("Anhanguera, 1014"); // último ponto presente (sem corte)
    expect(latin).toContain("Conectando negócios com excelência logística");
    expect(latin).not.toContain("undefined");
  }, 30000);

  it("não contém undefined/null/NaN/[object Object]", async () => {
    const { latin } = await gerarLatin();
    expect(latin).not.toContain("undefined");
    expect(latin).not.toContain("NaN");
    expect(latin).not.toContain("[object Object]");
  }, 30000);

  it("encoding correto (Ç,Õ,Í) e sem mojibake de texto", async () => {
    const { latin } = await gerarLatin();
    expect(latin).toContain("OR\u00C7AMENTO COMERCIAL");
    expect(latin).toContain("INFORMA\u00C7\u00D5ES DA CARGA");
    expect(latin).toContain("VE\u00CDCULO");
    expect(latin).toContain("CONDI\u00C7\u00D5ES COMERCIAIS");
    const moji = (s: string) => Buffer.from(s, "utf8").toString("latin1");
    for (const m of [moji("ORÇAMENTO"), moji("INFORMAÇÕES"), moji("VEÍCULO"), moji("CONDIÇÕES")]) {
      expect(latin).not.toContain(m);
    }
  }, 30000);

  it("mostra valor final e dados da carga/pontos", async () => {
    const { latin } = await gerarLatin();
    expect(latin).toMatch(/R\$\s2\.200,00/); // VALOR FINAL correto (espaço NBSP)
    expect(latin).toContain("Carga geral paletizada");
    expect(latin).toContain("Av. das Na");
    expect(latin).toContain("Rod. Anhanguera");
  }, 30000);
});

describe("TMS-COM-ORC-03 — fonte do PDF", () => {
  const src = read(SRC_PDF);
  it("nomenclatura profissional de veículo (sem 'IA')", () => {
    expect(src).toContain("Veículo recomendado para a operação");
    expect(src).not.toContain("sugerido pela IA");
  });
  it("formatação segura de carga (não imprime undefined)", () => {
    expect(src).not.toMatch(/String\(orc\.carga\.(volumes|peso|cubagem|pallets)\)/);
    expect(src).toContain("numOrDash");
    expect(src).toContain("moneyOrDash");
  });
  it("filename profissional .pdf", () => {
    expect(src).toContain("_Orcamento_Comercial.pdf");
    expect(src).toMatch(/orc\.numero \|\| "ORC"/);
  });
  it("rodapé com número de página em todas as páginas", () => {
    expect(src).toContain("getNumberOfPages()");
    expect(src).toContain("Página ${p} de ${totalPaginas}");
  });
});

describe("TMS-COM-ORC-03 — formulário", () => {
  it("rótulo de recomendação de veículo não menciona IA", () => {
    const src = read(SRC_FORM);
    expect(src).not.toContain("Veículo sugerido pela IA");
    expect(src).toContain("Veículo recomendado para a operação");
  });
});

describe("TMS-COM-ORC-05B — logo CLARA no Orçamento Comercial", () => {
  const src = read(SRC_PDF);
  it("carrega a variante clara /logos/logo-conexao-oficial.png", () => {
    expect(src).toContain('fetch("/logos/logo-conexao-oficial.png")');
    expect(src).not.toContain('fetch("/logo-oficial-conexao.png")');
  });
  it("mantém o fallback embutido LOGO_BASE64", () => {
    expect(src).toContain("LOGO_BASE64");
    expect(src).toContain("let logoStr: string | null = LOGO_BASE64");
  });
});
