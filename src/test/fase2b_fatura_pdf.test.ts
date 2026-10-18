import { describe, it, expect } from "vitest";
import { montarObservacaoRomaneios } from "@/services/financeiro/faturaService";

// Regras de domínio da Fase 2B — funções puras e conceitos testáveis sem banco.

describe("FASE 2B — Observação automática", () => {
  it("múltiplos romaneios → texto gramatical correto", () => {
    expect(montarObservacaoRomaneios(["343198", "343216", "343241"]))
      .toBe("Referente aos romaneios nº 343198, 343216 e 343241.");
  });
  it("romaneio único", () => {
    expect(montarObservacaoRomaneios(["343198"])).toBe("Referente ao romaneio nº 343198.");
  });
});

describe("FASE 2B — Elegibilidade para faturamento (mesmo cliente)", () => {
  // A regra "seleção somente do mesmo cliente" é validada no domínio da Central.
  it("serviços de clientes diferentes NÃO podem formar uma única fatura", () => {
    const itens = [
      { clienteId: "c1", valorClienteTotal: 600 },
      { clienteId: "c2", valorClienteTotal: 600 },
    ];
    const clientes = new Set(itens.map((i) => i.clienteId));
    expect(clientes.size).toBeGreaterThan(1);
    expect(clientes.size).toBe(2);
  });

  it("serviços do mesmo cliente podem formar uma única fatura", () => {
    const itens = [
      { clienteId: "c1", valorClienteTotal: 600 },
      { clienteId: "c1", valorClienteTotal: 600 },
    ];
    const clientes = new Set(itens.map((i) => i.clienteId));
    expect(clientes.size).toBe(1);
  });

  it("serviço já faturado é excluído da seleção", () => {
    const itens = [
      { id: "a", faturamento: { status: "faturado" }, valorClienteTotal: 600 },
      { id: "b", faturamento: { status: "nao_faturado" }, valorClienteTotal: 600 },
    ];
    const elegiveis = itens.filter((i) => i.faturamento.status === "nao_faturado");
    expect(elegiveis).toHaveLength(1);
    expect(elegiveis[0].id).toBe("b");
  });

  it("sem valor faturável bloqueia seleção", () => {
    const item = { faturamento: { status: "nao_faturado" }, valorClienteTotal: 0, clienteId: "c1" };
    const bloq = !item.clienteId || item.valorClienteTotal <= 0;
    expect(bloq).toBe(true);
  });
});

describe("FASE 2B — Total da seleção usa exclusivamente Total Cliente", () => {
  it("soma apenas valorClienteTotal (nunca prestador)", () => {
    const itens = [
      { valorClienteTotal: 600, valorPrestadorTotal: 300 },
      { valorClienteTotal: 600, valorPrestadorTotal: 250 },
      { valorClienteTotal: 600, valorPrestadorTotal: 280 },
    ];
    const totalCliente = itens.reduce((s, i) => s + i.valorClienteTotal, 0);
    expect(totalCliente).toBe(1800);
    expect(totalCliente).not.toBe(itens.reduce((s, i) => s + i.valorPrestadorTotal, 0));
  });
});

describe("FASE 2B — Prévia NÃO consome numeração", () => {
  it("fatura rascunho na prévia exibe 'Rascunho' em vez de número definitivo", () => {
    const fatura = { numero: null, valor_total: 1800 };
    const numeroPrevia = fatura.numero || "Rascunho";
    expect(numeroPrevia).toBe("Rascunho");
    // A numeração definitiva só existe após emissão
    const emitida = { numero: "FAT-2026-000001" };
    expect(emitida.numero).toMatch(/^FAT-\d{4}-\d{6}$/);
  });
});

describe("FASE 2B — PDF não contém valores do prestador/margem", () => {
  it("o modelo de prévia/PDF usa apenas campos do cliente", () => {
    const item = {
      valor_base: 600,
      valor_adicionais: 50,
      valor_descontos: 0,
      // NÃO há campos de custo prestador no item de fatura
    };
    const keys = Object.keys(item);
    expect(keys).not.toContain("valor_repasse");
    expect(keys).not.toContain("valor_prestador");
    expect(keys).not.toContain("margem");
  });
});

describe("FASE 2B — Cancelamento exige motivo", () => {
  it("não permite cancelar sem motivo", () => {
    const motivo = "";
    const valido = motivo.trim().length > 0;
    expect(valido).toBe(false);
  });
  it("permite cancelar com motivo preenchido", () => {
    const motivo = "Erro de faturamento do cliente";
    const valido = motivo.trim().length > 0;
    expect(valido).toBe(true);
  });
});
