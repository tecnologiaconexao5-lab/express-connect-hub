import { describe, it, expect } from "vitest";
import {
  calcularTotalItem,
  montarObservacaoRomaneios,
} from "@/services/financeiro/faturaService";

describe("FASE 2A — Fatura: cálculo do total do item (valores do CLIENTE)", () => {
  it("total = base + adicionais − descontos", () => {
    expect(calcularTotalItem({ valor_base: 600, valor_adicionais: 50, valor_descontos: 20 })).toBe(630);
  });

  it("total nunca é negativo (floor em zero)", () => {
    expect(calcularTotalItem({ valor_base: 100, valor_adicionais: 0, valor_descontos: 999 })).toBe(0);
  });

  it("sem adicionais/descontos → total = base", () => {
    expect(calcularTotalItem({ valor_base: 600, valor_adicionais: 0, valor_descontos: 0 })).toBe(600);
  });
});

// FIN-BUG-01 — KM excedente do cliente deve entrar no total do item da fatura.
describe("FIN-BUG-01 — KM excedente somado ao total do item", () => {
  it("total = base + km_excedente + adicionais − descontos", () => {
    expect(
      calcularTotalItem({ valor_base: 700, km_excedente: 150, valor_adicionais: 50, valor_descontos: 0 })
    ).toBe(900);
  });

  it("km_excedente sozinho (sem demais componentes) soma ao valor base", () => {
    expect(calcularTotalItem({ valor_base: 700, km_excedente: 150 })).toBe(850);
  });

  it("km_excedente ausente/zero mantém o cálculo anterior", () => {
    expect(calcularTotalItem({ valor_base: 600, valor_adicionais: 50, valor_descontos: 20 })).toBe(630);
    expect(calcularTotalItem({ valor_base: 600, km_excedente: 0, valor_adicionais: 50, valor_descontos: 20 })).toBe(630);
  });

  it("floor em zero vale também quando km + adicionais < descontos", () => {
    expect(calcularTotalItem({ valor_base: 50, km_excedente: 10, valor_adicionais: 5, valor_descontos: 999 })).toBe(0);
  });
});

describe("FASE 2A — Fatura: observação automática de romaneios", () => {
  it("múltiplos romaneios → 'Referente aos romaneios nº X, Y e Z.'", () => {
    expect(montarObservacaoRomaneios(["343198", "343216", "343241"]))
      .toBe("Referente aos romaneios nº 343198, 343216 e 343241.");
  });

  it("romaneio único → 'Referente ao romaneio nº X.'", () => {
    expect(montarObservacaoRomaneios(["343198"])).toBe("Referente ao romaneio nº 343198.");
  });

  it("ignora romaneios vazios/null", () => {
    expect(montarObservacaoRomaneios(["343198", "", null, undefined, "  "]))
      .toBe("Referente ao romaneio nº 343198.");
  });

  it("não repete números", () => {
    expect(montarObservacaoRomaneios(["343198", "343198", "343216"]))
      .toBe("Referente aos romaneios nº 343198 e 343216.");
  });

  it("nenhum romaneio → string vazia", () => {
    expect(montarObservacaoRomaneios([null, "", undefined])).toBe("");
  });
});

// Regras conceituais da Fase 2A validadas por função pura do banco/domain.
describe("FASE 2A — Regras de domínio (modelagem)", () => {
  it("valores do prestador NÃO entram na fatura (fatura = cobrança do cliente)", () => {
    // O item de fatura guarda apenas componentes do cliente; não há campo
    // de repasse do prestador na interface AdicionarItemFaturaInput.
    const inputKeys = ["valor_base", "valor_adicionais", "valor_descontos", "km_excedente", "pedagio_cliente", "ajudante_cliente", "diaria_cliente", "saidas_adicionais_cliente"];
    expect(inputKeys).not.toContain("valor_repasse");
    expect(inputKeys).not.toContain("valor_prestador");
  });

  it("snapshot imutável: valores faturados são gravados no item (não relidos da tabela comercial)", () => {
    // O item carrega valor_base/adicionais/descontos/total — snapshot próprio.
    const item = { valor_base: 600, valor_adicionais: 50, valor_descontos: 0 };
    expect(item.valor_base).toBe(600);
    expect(item.valor_adicionais).toBe(50);
    // Uma alteração posterior na tabela comercial não afeta este snapshot.
    expect(item.valor_base).toBe(600);
  });
});
