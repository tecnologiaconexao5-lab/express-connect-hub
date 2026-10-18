// ═══════════════════════════════════════════════════════════════════════════════
// TMS-COM-ORC-02 — Persistência de Total / Data / PDF (orçamento comercial)
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { calcularValorFinal, calcularValores, calcularValoresDoOrcamento, montarPayloadOrcamento } from "@/components/comercial/orcamentoCalculo";
import { toOrcamentoInsert, toOrcamentoDomain } from "@/lib/dbMappers";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const SRC_FORM = "src/components/comercial/OrcamentoForm.tsx";
const SRC_LISTA = "src/components/comercial/OrcamentosLista.tsx";
const SRC_PDF = "src/components/comercial/orcamentoPdf.ts";

const zeros = { adicionais: 0, pedagio: 0, kmExcedente: 0, ajudante: 0, adValorem: 0, gris: 0, devolucao: 0, reentrega: 0, descontos: 0, custoEstimado: 0, tabelaVinculada: "" };

describe("CASO 1-2 — cálculo canônico (fonte única)", () => {
  it("CASO 1: valorBase=2200, demais 0 => valorFinal=2200", () => {
    expect(calcularValorFinal({ valorBase: 2200, ...zeros })).toBe(2200);
    expect(calcularValores({ valorBase: 2200, ...zeros }).valorFinal).toBe(2200);
  });
  it("CASO 2: valorBase=2200 + adicionais 100 + pedagio 50 - desconto 20 => 2330", () => {
    expect(calcularValorFinal({ valorBase: 2200, ...zeros, adicionais: 100, pedagio: 50, descontos: 20 })).toBe(2330);
  });
  it("derivação adValorem/gris preservada (0,3% / 0,15%) e fora da regra Amazon/ABC", () => {
    const v = calcularValoresDoOrcamento({ valores: { valorBase: 1000, ...zeros }, carga: { valorDeclarado: 1000 }, cliente: "Cliente X" });
    expect(v.adValorem).toBeCloseTo(3);
    expect(v.gris).toBeCloseTo(1.5);
    expect(v.valorFinal).toBeCloseTo(1004.5);
    const amazon = calcularValoresDoOrcamento({ valores: { valorBase: 1000, ...zeros }, carga: { valorDeclarado: 1000 }, cliente: "Amazon Logística" });
    expect(amazon.adValorem).toBe(0);
    expect(amazon.gris).toBe(0);
  });
});

describe("CASO 3-4 — payload do formulário já contém valorFinal (sem state stale)", () => {
  const base = { numero: "ORC-TEST", cliente: "X", carga: { valorDeclarado: 0 }, valores: { valorBase: 2200, ...zeros } };
  it("CASO 3: salvar imediatamente após editar valorBase => valorFinal=2200", () => {
    const payload = montarPayloadOrcamento(base as never) as unknown as { valores: { valorFinal: number } };
    expect(payload.valores.valorFinal).toBe(2200);
  });
  it("CASO 4: salvar rascunho => valorFinal correto", () => {
    const payload = { ...(montarPayloadOrcamento(base as never) as object), status: "rascunho" } as unknown as { valores: { valorFinal: number }; status: string };
    expect(payload.status).toBe("rascunho");
    expect(payload.valores.valorFinal).toBe(2200);
  });
  it("componente: handleSalvar usa montarPayloadOrcamento (NÃO recalcular()+onSalvar(data) stale)", () => {
    const src = read(SRC_FORM);
    // TMS-COM-CARGA-01 — calcula sobre a carga enriquecida (derivados) antes do payload.
    expect(src).toContain("montarPayloadOrcamento(comDerivadosCarga(data))");
    expect(src).not.toMatch(/recalcular\(\);\s*\n\s*onSalvar\(data\)/);
  });
});

describe("CASO 5 — mapper persiste JSONB + colunas dedicadas coerentes", () => {
  it("valores.valorBase/valorFinal E valor_base/valor_final", () => {
    const payload = toOrcamentoInsert({ numero: "ORC-1", valores: { valorBase: 2200, valorFinal: 2200 } } as never) as Record<string, unknown>;
    expect((payload.valores as Record<string, unknown>).valorBase).toBe(2200);
    expect((payload.valores as Record<string, unknown>).valorFinal).toBe(2200);
    expect(payload.valor_base).toBe(2200);
    expect(payload.valor_final).toBe(2200);
  });
});

describe("CASO 6-7 — reload: snake_case → domínio (listagem/PDF)", () => {
  it("CASO 6: toOrcamentoDomain converte data_emissao/cliente_cnpj/valores", () => {
    const d = toOrcamentoDomain({
      numero: "ORC-202609-8659", status: "em_analise",
      data_emissao: "2026-09-24", cliente_cnpj: "04.785.340/0001-26",
      valor_base: null, valor_final: null,
      valores: { valorBase: 2200, valorFinal: 2200 }, enderecos: [], carga: {}, veiculo: {},
    });
    expect(d.dataEmissao).toBe("2026-09-24");
    expect(d.clienteCnpj).toBe("04.785.340/0001-26");
    expect(d.valorFinal).toBe(2200);
  });
  it("CASO 7: listagem usa toOrcamentoDomain e exibe orc.dataEmissao / valores.valorFinal", () => {
    const src = read(SRC_LISTA);
    expect(src).toContain(".map(toOrcamentoDomain)");
    expect(src).toContain("orc.dataEmissao");
    expect(src).toContain("orc.valores?.valorFinal");
  });
});

describe("CASO 8-10 — PDF sem undefined + valorFinal + filename", () => {
  const pdf = read(SRC_PDF);
  it("CASO 8: Detalhamento de Pontos não usa propriedades inexistentes", () => {
    expect(pdf).not.toContain("String(e.sequencia)");
    expect(pdf).toContain("e.sequencia ?? idx + 1");
    expect(pdf).not.toContain("STATUS_CONFIG[orc.status].label"); // agora com ?.
  });
  it("CASO 9: PDF usa valorFinal (não só valorBase)", () => {
    expect(pdf).toContain("valorFinal");
    // TMS-ORC-PDF-01 — total impresso vem da regra canônica (linhas legadas com
    // valorFinal gravado 0 deixam de imprimir R$ 0,00).
    expect(pdf).toMatch(/fmt\(resolverValorFinal\(valores\)\)/);
  });
  it("CASO 10: filename termina em .pdf e usa número ORC com fallback", () => {
    expect(pdf).toContain('_Orcamento_Comercial.pdf');
    expect(pdf).toMatch(/orc\.numero \|\| "ORC"/);
  });
  it("data ausente/inválida não vira data futura fictícia", () => {
    expect(pdf).not.toMatch(/Date\.now\(\) \+ 7 \* 24 \* 60 \* 60 \* 1000/);
  });
});

describe("CASO 11 — data de emissão do NOVO orçamento", () => {
  it("default = hoje e input de data limitado a hoje", () => {
    const src = read(SRC_FORM);
    expect(src).toContain('dataEmissao: new Date().toISOString().split("T")[0]');
    expect(src).toContain('max={new Date().toISOString().split("T")[0]}');
  });
});

describe("Encoding — mojibake não reincide no orçamento", () => {
  it("OrcamentoForm usa 'ORÇAMENTO' correto e não contém a variante corrompida", () => {
    const src = read(SRC_FORM);
    const mojibake = Buffer.from("ORÇAMENTO", "utf8").toString("latin1");
    expect(src).toContain("generateProfessionalPDF(data, \"ORÇAMENTO\")");
    expect(src).not.toContain(mojibake);
  });
});
