import { describe, it, expect } from "vitest";
import { calcularFluxo } from "@/services/financeiro/fluxoCaixaService";

// ============================================================================
// F0-F — Fluxo de Caixa: validações matemáticas (sem persistir dados fictícios).
// Realizado vem SOMENTE de financeiro_baixas (estornada=false); previsto vem dos
// títulos (receber/pagar). Nunca somados como dois fatos econômicos distintos.
// ============================================================================

describe("F0-F — Fluxo de Caixa (previsto × realizado)", () => {
  it("1. receber R$ 1.000 previsto, sem baixa → previsto=1.000, realizado=0", () => {
    const r = calcularFluxo(
      [{ tipo: "entrada", valor: 1000 }],
      [] // nenhuma baixa
    );
    expect(r.previstoEntrada).toBe(1000);
    expect(r.realizadoEntrada).toBe(0);
    expect(r.previstoSaida).toBe(0);
  });

  it("2. baixa parcial R$ 300 → previsto rastreável (1.000) e realizado=300 (NUNCA 1.300)", () => {
    const r = calcularFluxo(
      [{ tipo: "entrada", valor: 1000 }], // título previsto
      [{ titulo_tabela: "financeiro_receber", valor_baixado: 300, estornada: false }]
    );
    expect(r.previstoEntrada).toBe(1000); // título permanece previsto/rastreável
    expect(r.realizadoEntrada).toBe(300); // só a baixa
    // duplicidade proibida: não soma 1.000 + 300 como entrada real
    expect(r.realizadoEntrada).not.toBe(1300);
  });

  it("3. pagar R$ 500 e baixar R$ 200 → previsto saída=500, realizado saída=200", () => {
    const r = calcularFluxo(
      [{ tipo: "saida", valor: 500 }],
      [{ titulo_tabela: "financeiro_pagar", valor_baixado: 200, estornada: false }]
    );
    expect(r.previstoSaida).toBe(500);
    expect(r.realizadoSaida).toBe(200);
  });

  it("4. baixa estornada NÃO entra no realizado", () => {
    const r = calcularFluxo(
      [{ tipo: "entrada", valor: 1000 }],
      [
        { titulo_tabela: "financeiro_receber", valor_baixado: 300, estornada: false },
        { titulo_tabela: "financeiro_receber", valor_baixado: 700, estornada: true }, // estornada
      ]
    );
    expect(r.realizadoEntrada).toBe(300); // estornada ignorada
  });

  it("5. múltiplas baixas → realizado = soma exata das não estornadas", () => {
    const r = calcularFluxo(
      [
        { tipo: "entrada", valor: 1000 },
        { tipo: "saida", valor: 800 },
      ],
      [
        { titulo_tabela: "financeiro_receber", valor_baixado: 100, estornada: false },
        { titulo_tabela: "financeiro_receber", valor_baixado: 250, estornada: false },
        { titulo_tabela: "financeiro_receber", valor_baixado: 50, estornada: true },
        { titulo_tabela: "financeiro_pagar", valor_baixado: 120, estornada: false },
        { titulo_tabela: "financeiro_pagar", valor_baixado: 30, estornada: true },
      ]
    );
    expect(r.realizadoEntrada).toBe(350); // 100 + 250 (estornada 50 fora)
    expect(r.realizadoSaida).toBe(120); // estornada 30 fora
    expect(r.fluxoRealizado).toBe(230); // 350 - 120
  });
});
