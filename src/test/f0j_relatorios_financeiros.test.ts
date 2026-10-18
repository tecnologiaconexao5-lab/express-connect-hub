import { describe, it, expect } from "vitest";
import {
  calcularResumoFinanceiro,
  resumirPorCliente,
  resumirPorPrestador,
  calcularInadimplencia,
  filtrarPorPeriodo,
} from "@/services/financeiro/relatoriosFinanceirosService";

// ============================================================================
// F0-J — Relatórios Financeiros: cálculos puros (sem dados fictícios persistidos).
// ============================================================================

describe("F0-J — Resumo Financeiro (KPIs = mesma fonte da tabela)", () => {
  it("1. filtro por período afeta faturado (só títulos do período)", () => {
    const receber = [
      { id: "r1", cliente: "A", valor: 1000, data_vencimento: "2026-08-10", status: "aberto" },
      { id: "r2", cliente: "B", valor: 500, data_vencimento: "2026-09-10", status: "aberto" },
    ];
    const noPeriodo = filtrarPorPeriodo(receber, (r) => r.data_vencimento, "2026-08-01", "2026-08-31");
    expect(noPeriodo).toHaveLength(1);
    const r = calcularResumoFinanceiro({ receber: noPeriodo, pagar: [], pagamentos: [], baixasReceber: [], baixasPagar: [] });
    expect(r.faturado).toBe(1000);
  });

  it("2. filtro por cliente: resumo considera somente o cliente", () => {
    const receber = [
      { id: "r1", cliente: "Cliente A", valor: 1000, data_vencimento: "2026-08-10", status: "aberto" },
      { id: "r2", cliente: "Cliente B", valor: 500, data_vencimento: "2026-08-15", status: "aberto" },
    ];
    const linhas = resumirPorCliente(receber, []);
    expect(linhas.find((l) => l.cliente === "Cliente A")?.faturado).toBe(1000);
    expect(linhas.find((l) => l.cliente === "Cliente B")?.faturado).toBe(500);
  });

  it("3. filtro por prestador: resumo considera somente o prestador", () => {
    const pagamentos = [
      { prestador: "P1", valor_liquido: 600, impacto_dre: true },
      { prestador: "P2", valor_liquido: 900, impacto_dre: true },
    ];
    const linhas = resumirPorPrestador(pagamentos);
    expect(linhas.find((l) => l.prestador === "P1")?.valorLiquido).toBe(600);
    expect(linhas.find((l) => l.prestador === "P2")?.valorLiquido).toBe(900);
  });

  it("4. status previsto × realizado (faturado vs recebido; estorno fora)", () => {
    const r = calcularResumoFinanceiro({
      receber: [{ id: "r1", cliente: "A", valor: 1000, status: "aberto" }],
      pagar: [],
      pagamentos: [],
      baixasReceber: [
        { titulo_tabela: "financeiro_receber", titulo_id: "r1", valor_baixado: 600, estornada: false },
        { titulo_tabela: "financeiro_receber", titulo_id: "r1", valor_baixado: 400, estornada: true }, // estornada
      ],
      baixasPagar: [],
    });
    expect(r.faturado).toBe(1000); // previsto
    expect(r.recebido).toBe(600); // realizado (estorno fora)
    expect(r.aReceber).toBe(400);
  });

  it("5. total da tabela = KPI (soma dos clientes = faturado do resumo)", () => {
    const receber = [
      { id: "r1", cliente: "A", valor: 1000, data_vencimento: "2026-08-10", status: "aberto" },
      { id: "r2", cliente: "B", valor: 500, data_vencimento: "2026-08-15", status: "aberto" },
    ];
    const linhas = resumirPorCliente(receber, []);
    const somaClientes = linhas.reduce((s, l) => s + l.faturado, 0);
    const kpi = calcularResumoFinanceiro({ receber, pagar: [], pagamentos: [], baixasReceber: [], baixasPagar: [] });
    expect(somaClientes).toBe(kpi.faturado); // mesma fonte, mesmo total
    expect(somaClientes).toBe(1500);
  });

  it("6. previsto não é confundido com realizado", () => {
    const r = calcularResumoFinanceiro({
      receber: [{ id: "r1", cliente: "A", valor: 1000, status: "aberto" }],
      pagar: [{ id: "p1", fornecedor: "X", valor: 300, status: "aberto" }],
      pagamentos: [{ prestador: "P1", valor_liquido: 450, impacto_dre: true }],
      baixasReceber: [{ titulo_tabela: "financeiro_receber", titulo_id: "r1", valor_baixado: 700, estornada: false }],
      baixasPagar: [{ titulo_tabela: "financeiro_pagar", titulo_id: "p1", valor_baixado: 100, estornada: false }],
    });
    expect(r.recebido).toBe(700); // realizado (não 1.000)
    expect(r.pagoRealizado).toBe(100); // realizado (não 300)
    expect(r.aPagar).toBe(200);
    expect(r.custoPrestador).toBe(450);
  });

  it("7. exportação usa dataset filtrado (KPIs sobre o mesmo conjunto filtrado)", () => {
    const receber = [
      { id: "r1", cliente: "A", valor: 1000, data_vencimento: "2026-08-10", status: "aberto" },
      { id: "r2", cliente: "B", valor: 500, data_vencimento: "2026-09-01", status: "aberto" },
      { id: "r3", cliente: "C", valor: 300, data_vencimento: "2026-08-20", status: "aberto" },
    ];
    // dataset filtrado (agosto, clientes A e C) → KPI e export usam o mesmo total
    const filtrado = receber.filter((r) => r.cliente !== "B" && (r.data_vencimento || "") <= "2026-08-31");
    const kpi = calcularResumoFinanceiro({ receber: filtrado, pagar: [], pagamentos: [], baixasReceber: [], baixasPagar: [] });
    const linhas = resumirPorCliente(filtrado, []);
    expect(linhas).toHaveLength(2);
    expect(kpi.faturado).toBe(1300); // 1000 + 300 (B excluído pelo filtro)
    expect(linhas.reduce((s, l) => s + l.faturado, 0)).toBe(kpi.faturado);
  });

  it("inadimplência: títulos vencidos não baixados, com dias de atraso", () => {
    const receber = [
      { id: "r1", cliente: "A", valor: 1000, data_vencimento: "2026-08-01", status: "aberto" },
      { id: "r2", cliente: "B", valor: 500, data_vencimento: "2026-09-01", status: "aberto" },
      { id: "r3", cliente: "C", valor: 300, data_vencimento: "2026-07-15", status: "pago" },
    ];
    const inadimplentes = calcularInadimplencia(receber, [], "2026-08-15");
    expect(inadimplentes).toHaveLength(1); // só r1 (r2 não venceu; r3 pago)
    expect(inadimplentes[0].cliente).toBe("A");
    expect(inadimplentes[0].diasAtraso).toBe(14);
  });
});
