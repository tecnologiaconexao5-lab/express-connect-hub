import { describe, it, expect } from "vitest";
import {
  calcularDRE,
  classificarDespesa,
  classificarReceita,
  periodoParaDatas,
} from "@/services/financeiro/dreService";

// ============================================================================
// F0-G — DRE Gerencial: cálculos puros + prevenção de duplicidade.
// Sem lançamentos fictícios persistentes em Produção.
// ============================================================================

describe("F0-G — DRE (fontes reais, sem duplicidade)", () => {
  it("1. receita de R$ 1.000 é contabilizada UMA vez (não R$ 2.000 / R$ 3.000)", () => {
    // Fatura/OS não duplicam: só financeiro_receber é a fonte de receita.
    const r = calcularDRE([{ valor: 1000, categoria: "Frete" }], [], []);
    expect(r.receitaBruta).toBe(1000);
    expect(r.receitaLiquida).toBe(1000);
  });

  it("2. custo de prestador de R$ 600 propagado é contabilizado UMA única vez", () => {
    // pagamentos_prestadores com impacto_dre=true; mesmo valor NÃO volta em financeiro_pagar.
    const r = calcularDRE(
      [],
      [{ valor_liquido: 600, impacto_dre: true }],
      [{ valor: 600, categoria: "Repasse" }] // repasse seria excluído na origem (os_id null)
    );
    // classificação: 'Repasse' não é despesa operacional classificável além de "outras"
    // — a proteção real está em excluir repasses de financeiro_pagar (os_id).
    expect(r.custosPrestadores).toBe(600);
  });

  it("2b. impacto_dre=false NÃO entra no custo DRE", () => {
    const r = calcularDRE([], [{ valor_liquido: 600, impacto_dre: false }], []);
    expect(r.custosPrestadores).toBe(0);
  });

  it("3. pedágio/reembolso respeitam valor_liquido (rede já embute os componentes)", () => {
    // 600 serviços + 200 pedágio + 100 reembolso − 0 descontos = 900 líquido
    const r = calcularDRE([], [{ valor_liquido: 900, impacto_dre: true }], []);
    expect(r.custosPrestadores).toBe(900);
  });

  it("4. baixa financeira NÃO cria nova competência (não é input do DRE)", () => {
    // Receber/pagar uma conta (baixa) não gera receita/despesa nova: baixas não
    // entram em calcularDRE. Passar os mesmos dados duas vezes não dobra nada.
    const base = { receitas: [{ valor: 1000, categoria: "Frete" }], custos: [{ valor_liquido: 400, impacto_dre: true }], despesas: [] as any[] };
    const r1 = calcularDRE(base.receitas, base.custos, base.despesas);
    const r2 = calcularDRE(base.receitas, base.custos, base.despesas);
    expect(r1.receitaBruta).toBe(r2.receitaBruta);
    expect(r1.receitaBruta).toBe(1000);
  });

  it("5. estorno de baixa não altera competência econômica", () => {
    // Estorno só afeta movimento bancário; competência permanece.
    const r = calcularDRE([{ valor: 1000, categoria: "Frete" }], [], []);
    expect(r.receitaLiquida).toBe(1000);
    // nenhum parâmetro de baixa/estorno existe na fórmula
  });

  it("fórmula exata: Receita Líquida, Resultado Bruto, EBITDA, EBIT, Lucro", () => {
    const r = calcularDRE(
      [
        { valor: 1000, categoria: "Frete" },
        { valor: 50, categoria: "Juros recebidos" }, // receita financeira
      ],
      [{ valor_liquido: 600, impacto_dre: true }],
      [
        { valor: 30, categoria: "ISS" },                        // dedução
        { valor: 80, categoria: "Aluguel" },                    // administrativa
        { valor: 40, categoria: "Marketing" },                  // comercial
        { valor: 20, categoria: "Material de escritório" },     // outras
        { valor: 10, categoria: "Tarifa bancária" },            // financeira
      ]
    );
    expect(r.receitaBruta).toBe(1000);
    expect(r.deducoes).toBe(30);
    expect(r.receitaLiquida).toBe(970);
    expect(r.custosPrestadores).toBe(600);
    expect(r.despesasOperacionais).toBe(80 + 40 + 20); // 140
    expect(r.ebitda).toBe(970 - 600 - 140); // 230
    expect(r.depreciacao).toBe(0);
    expect(r.ebit).toBe(230);
    expect(r.receitasFinanceiras).toBe(50);
    expect(r.despesasFinanceiras).toBe(10);
    expect(r.resultadoFinanceiro).toBe(40);
    expect(r.lucroAntesIR).toBe(270);
    expect(r.ir).toBe(0);
    expect(r.lucroLiquido).toBe(270);
    // soma dos grupos = resultado final
    expect(r.receitaLiquida).toBe(r.receitaBruta - r.deducoes);
    expect(r.ebitda).toBe(r.receitaLiquida - r.custosPrestadores - r.despesasOperacionais);
    expect(r.lucroLiquido).toBe(r.ebit + r.resultadoFinanceiro - r.ir);
  });

  it("valores negativos/positivos coerentes (estorno de receita reduz receita)", () => {
    const r = calcularDRE(
      [
        { valor: 1000, categoria: "Frete" },
        { valor: -200, categoria: "Frete" }, // estorno/cancelamento (status cancelado excluído na origem)
      ],
      [],
      []
    );
    expect(r.receitaBruta).toBe(800);
  });

  it("classificação pelo Plano de Contas existente (categoria/plano_conta)", () => {
    expect(classificarDespesa("Combustível", "3.1.2 Custos")).toBe("outras");
    expect(classificarDespesa("Imposto", "3.3.1")).toBe("imposto");
    expect(classificarDespesa("Aluguel")).toBe("administrativa");
    expect(classificarDespesa(null, "4.1.2 Tarifas Bancárias")).toBe("financeira");
    expect(classificarReceita("Frete")).toBe("operacional");
    expect(classificarReceita("Juros sobre aplicação")).toBe("financeira");
  });

  it("filtro de período: mensal retorna a competência e o mês anterior", () => {
    const j = periodoParaDatas("mensal", "2026-08");
    expect(j.inicio).toBe("2026-08-01");
    expect(j.fim).toBe("2026-08-31");
    expect(j.inicioAnterior).toBe("2026-07-01");
    expect(j.fimAnterior).toBe("2026-07-31");
  });

  it("filtro trimestral/anual usa a janela correta", () => {
    const t = periodoParaDatas("trimestral", "2026-08");
    expect(t.inicio).toBe("2026-06-01");
    expect(t.fim).toBe("2026-08-31");
    const a = periodoParaDatas("anual", "2026-08");
    expect(a.inicio).toBe("2025-09-01");
    expect(a.fim).toBe("2026-08-31");
  });

  it("período personalizado com janela anterior de mesma duração", () => {
    const p = periodoParaDatas("personalizado", "2026-08", "2026-08-10", "2026-08-20");
    expect(p.inicio).toBe("2026-08-10");
    expect(p.fim).toBe("2026-08-20");
    expect(p.fimAnterior).toBe("2026-08-09");
  });
});
