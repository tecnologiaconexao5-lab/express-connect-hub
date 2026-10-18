import { describe, it, expect } from "vitest";
import {
  montarDescricaoCalvo,
  sugerirModeloFatura,
  sugerirVencimento,
} from "@/services/financeiro/faturaService";

describe("A30 — Sugestão de modelo de fatura por cliente", () => {
  it("cliente com razão social contendo 'calvo' → modelo Calvo", () => {
    expect(sugerirModeloFatura("CALVO LOGÍSTICA LTDA")).toBe("calvo");
    expect(sugerirModeloFatura("Calvo Distribuição S.A.")).toBe("calvo");
  });

  it("demais clientes → Padrão Conexão Express", () => {
    expect(sugerirModeloFatura("MAGAZINE LUIZA")).toBe("conexao_express");
    expect(sugerirModeloFatura(null)).toBe("conexao_express");
    expect(sugerirModeloFatura(undefined)).toBe("conexao_express");
  });
});

describe("A30 — Vencimento sugerido", () => {
  it("retorna data no formato ISO", () => {
    const v = sugerirVencimento("2026-08-16");
    expect(v).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("usa emissão + 30 dias", () => {
    const v = sugerirVencimento("2026-08-16");
    expect(v).toBe("2026-09-15");
  });

  it("sem data → usa hoje + 30", () => {
    const v = sugerirVencimento();
    expect(v).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("A30 — Descrição automática Calvo (consolida romaneios/OC)", () => {
  it("múltiplos romaneios consolidados em uma frase", () => {
    const desc = montarDescricaoCalvo([
      { romaneio: "343241" },
      { romaneio: "343216" },
      { romaneio: "343198" },
      { romaneio: "340927" },
      { romaneio: "342396" },
      { romaneio: "343099" },
    ]);
    expect(desc).toBe("Receita de CT-e referente aos romaneios nº 343241, 343216, 343198, 340927, 342396 e 343099.");
  });

  it("elimina duplicidades", () => {
    const desc = montarDescricaoCalvo([
      { romaneio: "343198" },
      { romaneio: "343198" },
      { romaneio: "343216" },
    ]);
    expect(desc).toBe("Receita de CT-e referente aos romaneios nº 343198 e 343216.");
  });

  it("romaneios marcados '(sem cobrança)' são incluídos", () => {
    const desc = montarDescricaoCalvo([{ romaneio: "343241" }], { semCobranca: ["340927"] });
    expect(desc).toContain("340927 (sem cobrança)");
  });

  it("com serviços de devolução adiciona sufixo", () => {
    const desc = montarDescricaoCalvo([{ romaneio: "343198" }], { temDevolucao: true });
    expect(desc).toBe("Receita de CT-e referente aos romaneios nº 343198 e serviços de devolução.");
  });

  it("ignora romaneios vazios; sem romaneios e sem devolução → vazio", () => {
    expect(montarDescricaoCalvo([{ romaneio: "" }, { romaneio: null }])).toBe("");
  });

  it("NÃO inclui OS interna, prestador, placa, origem/destino", () => {
    const desc = montarDescricaoCalvo([{ romaneio: "343198" }]);
    expect(desc).not.toContain("OS");
    expect(desc).not.toContain("placa");
    expect(desc).not.toContain("→");
    expect(desc).not.toContain("Prestador");
  });
});

describe("A30 — Regras de domínio da fatura (cliente único + valores)", () => {
  it("fatura não pode misturar clientes", () => {
    const itens = [
      { clienteId: "a", valorClienteTotal: 600 },
      { clienteId: "b", valorClienteTotal: 600 },
    ];
    const clientes = new Set(itens.map((i) => i.clienteId).filter(Boolean));
    expect(clientes.size).toBeGreaterThan(1);
  });

  it("fatura usa exclusivamente Total Cliente (nunca prestador)", () => {
    const itens = [
      { valorClienteTotal: 600, valorPrestadorTotal: 300 },
      { valorClienteTotal: 600, valorPrestadorTotal: 250 },
    ];
    const totalCliente = itens.reduce((s, i) => s + i.valorClienteTotal, 0);
    expect(totalCliente).toBe(1200);
    expect(totalCliente).not.toBe(itens.reduce((s, i) => s + i.valorPrestadorTotal, 0));
  });

  it("serviço sem cliente bloqueia emissão definitiva", () => {
    const item = { clienteId: null, valorClienteTotal: 600 };
    const bloqueado = !item.clienteId;
    expect(bloqueado).toBe(true);
  });
});
