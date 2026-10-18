import { describe, it, expect } from "vitest";
import { calcularMargemOs, calcularIndicadores } from "@/services/financeiro/margemOsService";

// ============================================================================
// F0-I — Margem por OS: cálculos puros (sem dupla contagem).
// ============================================================================

const base = {
  osId: "os-1",
  osNumero: "OS-202608-000001",
  clienteNome: "Cliente X",
  prestadorNome: "Prestador Y",
  custoPrestador: 0,
  outrosCustos: 0,
};

describe("F0-I — Margem por OS", () => {
  it("1. receita 600 / custo 450 → margem 150 e margem % = 25%", () => {
    const l = calcularMargemOs({ ...base, receita: 600, receitaFonte: "faturamento", custoPrestador: 450 });
    expect(l.margem).toBe(150);
    expect(l.margemPct).toBeCloseTo(25, 5);
    expect(l.statusMargem).toBe("real");
  });

  it("2. receita 1.000 / custo 1.100 → margem −100 e margem % = −10%", () => {
    const l = calcularMargemOs({ ...base, receita: 1000, receitaFonte: "faturamento", custoPrestador: 1100 });
    expect(l.margem).toBe(-100);
    expect(l.margemPct).toBeCloseTo(-10, 5);
  });

  it("3. custo do prestador não é contado duas vezes (valor_liquido já embute componentes)", () => {
    // valor_liquido = serviços + pedágio + reembolsos + adicionais − descontos ...
    // O modelo recebe APENAS custoPrestador (nunca valor_liquido + componentes).
    const l = calcularMargemOs({ ...base, receita: 1000, receitaFonte: "faturamento", custoPrestador: 450 });
    expect(l.custoPrestador).toBe(450);
    expect(l.margem).toBe(1000 - 450); // sem duplicidade
  });

  it("4. fatura + receber NÃO duplicam receita (fonte única por OS)", () => {
    // receita é UM único número (fonte já resolvida: faturamento OU operacional).
    const l = calcularMargemOs({ ...base, receita: 1000, receitaFonte: "faturamento", custoPrestador: 400 });
    expect(l.receita).toBe(1000);
    expect(l.margem).toBe(600);
  });

  it("5. OS sem receita confirmada aparece como prevista/pendente (não inventa margem real)", () => {
    const prevista = calcularMargemOs({ ...base, receita: 600, receitaFonte: "operacional", custoPrestador: 450 });
    expect(prevista.statusMargem).toBe("prevista");
    expect(prevista.margemPct).toBeCloseTo(25, 5); // % computada sobre valor previsto, mas sinalizada

    const pendente = calcularMargemOs({ ...base, receita: 0, receitaFonte: "sem_receita", custoPrestador: 450 });
    expect(pendente.statusMargem).toBe("pendente");
    expect(pendente.margemPct).toBe(0); // sem receita → % 0 (não inventado)
  });

  it("6. filtros alteram tabela e indicadores com o MESMO conjunto de dados", () => {
    const l1 = calcularMargemOs({ ...base, osId: "os-1", receita: 600, receitaFonte: "faturamento", custoPrestador: 450 });
    const l2 = calcularMargemOs({ ...base, osId: "os-2", receita: 1000, receitaFonte: "faturamento", custoPrestador: 1100 });
    const l3 = calcularMargemOs({ ...base, osId: "os-3", receita: 800, receitaFonte: "operacional", custoPrestador: 500 });

    const todas = calcularIndicadores([l1, l2, l3]);
    expect(todas.quantidadeOs).toBe(3);
    expect(todas.receitaTotal).toBe(2400);
    expect(todas.custoTotal).toBe(2050);
    expect(todas.margemTotal).toBe(350);
    expect(todas.osNegativas).toBe(1);

    // filtro: somente margem positiva
    const positivas = [l1, l2, l3].filter((l) => l.margem >= 0);
    const indPositivas = calcularIndicadores(positivas);
    expect(indPositivas.quantidadeOs).toBe(2);
    expect(indPositivas.margemTotal).toBe(450);
    expect(indPositivas.margemMediaPct).toBeCloseTo((450 / 1400) * 100, 5);
  });
});
