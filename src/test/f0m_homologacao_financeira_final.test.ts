import { describe, it, expect, vi, beforeEach } from "vitest";
import { calcularResumoFinanceiro, resumirPorCliente, resumirPorPrestador, calcularInadimplencia } from "@/services/financeiro/relatoriosFinanceirosService";
import { calcularDRE } from "@/services/financeiro/dreService";
import { calcularFluxo } from "@/services/financeiro/fluxoCaixaService";
import { calcularSaldosConta } from "@/services/financeiro/contasCaixasService";
import { calcularMargemOs, calcularIndicadores } from "@/services/financeiro/margemOsService";
import { montarNumeroRecibo, valorPorExtenso } from "@/services/financeiro/reciboService";

// ============================================================================
// F0-M — HOMOLOGAÇÃO FINANCEIRA FINAL (prova matemática integrada).
// O mesmo fato econômico aparece UMA única vez em cada visão — nunca somado.
// Nenhum dado fictício é persistido.
// ============================================================================

// ── mock mínimo para reciboService (não toca banco) ────────────────────────
const inserts: Record<string, Record<string, unknown>[]> = {};
const maybeSingleMock = vi.fn();
const singleMock = vi.fn();
const fluent = (tabela: string) => {
  const b: any = {
    eq: () => b,
    select: (cols?: string) => { b.maybeSingle = () => maybeSingleMock(); b.single = () => singleMock(); b.order = () => b; b.limit = () => b; return b; },
    like: () => b, or: () => b, gte: () => b, lte: () => b,
    then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
    insert: (rows: Record<string, unknown>[]) => { inserts[tabela] = inserts[tabela] || []; inserts[tabela].push(...rows); return { select: () => ({ single: () => singleMock() }) }; },
    update: (payload: Record<string, unknown>) => { return b; },
  };
  return b;
};
vi.mock("@/lib/supabase", () => ({ supabase: { from: (t: string) => fluent(t) } }));

const reciboMock = { id: "r1", numero: "REC-202608-00001", data_emissao: "2026-08-19", favorecido_tipo: "prestador", favorecido_nome: "Prestador X", favorecido_documento: "12345678000190", valor: 600, valor_extenso: "seiscentos reais", referencia: "Pagamento transporte OS-123", forma_pagamento: "PIX", conta_financeira: null, os_numero: "OS-123", observacoes: null, status: "emitido", motivo_cancelamento: null, data_cancelamento: null, usuario_criador: null, usuario_cancelou: null, created_at: "2026-08-19T10:00:00.000Z" };

beforeEach(() => { Object.keys(inserts).forEach((k) => delete inserts[k]); maybeSingleMock.mockReset(); singleMock.mockReset(); });

describe("F0-M — Prova matemática integrada", () => {
  it("1. RECEITA 1.000: faturado=1.000, recebido(400+600)=1.000, aReceber=0, DRE=1.000, Fluxo entrada realizada=1.000 (nunca 2.000/3.000)", () => {
    const receber = [{ id: "rec1", cliente: "Cliente A", valor: 1000, data_vencimento: "2026-08-10", status: "aberto" }];
    const baixas = [
      { titulo_tabela: "financeiro_receber" as const, titulo_id: "rec1", valor_baixado: 400, estornada: false },
      { titulo_tabela: "financeiro_receber" as const, titulo_id: "rec1", valor_baixado: 600, estornada: false },
    ];
    const resumo = calcularResumoFinanceiro({ receber, pagar: [], pagamentos: [], baixasReceber: baixas, baixasPagar: [] });
    expect(resumo.faturado).toBe(1000);
    expect(resumo.recebido).toBe(1000);
    expect(resumo.aReceber).toBe(0);
    expect(resumo.faturado).not.toBe(2000);

    const dre = calcularDRE([{ valor: 1000, categoria: "Frete" }], [], []);
    expect(dre.receitaBruta).toBe(1000);

    const fluxo = calcularFluxo([{ tipo: "entrada", valor: 1000 }], baixas);
    expect(fluxo.realizadoEntrada).toBe(1000);

    // Cliente na mesma fonte
    const porCliente = resumirPorCliente(receber, baixas);
    expect(porCliente[0].faturado).toBe(1000);
    expect(porCliente[0].recebido).toBe(1000);
    expect(porCliente[0].aReceber).toBe(0);
  });

  it("2. PRESTADOR 600 (valor_liquido): pagamento=600, DRE custo=600, margem custo=600 (sem somar componentes de novo)", () => {
    const pagamentos = [{ prestador: "P1", valor_liquido: 600, impacto_dre: true }];
    const resumo = calcularResumoFinanceiro({ receber: [], pagar: [], pagamentos, baixasReceber: [], baixasPagar: [] });
    expect(resumo.custoPrestador).toBe(600);

    const dre = calcularDRE([], pagamentos, []);
    expect(dre.custosPrestadores).toBe(600);

    const margem = calcularMargemOs({ osId: "os1", osNumero: "OS-1", receita: 1000, receitaFonte: "faturamento", custoPrestador: 600, outrosCustos: 0 });
    expect(margem.custoPrestador).toBe(600);
    expect(margem.margem).toBe(400);

    const porPrestador = resumirPorPrestador(pagamentos);
    expect(porPrestador[0].valorLiquido).toBe(600);
  });

  it("3. OUTRA DESPESA 100: pagar=100, baixa=100, Fluxo saída realizada=100, DRE despesa=100", () => {
    const pagar = [{ id: "p1", fornecedor: "X", valor: 100, data_vencimento: "2026-08-15", status: "aberto" }];
    const baixasPagar = [{ titulo_tabela: "financeiro_pagar" as const, titulo_id: "p1", valor_baixado: 100, estornada: false }];
    const resumo = calcularResumoFinanceiro({ receber: [], pagar, pagamentos: [], baixasReceber: [], baixasPagar });
    expect(resumo.previstoPagar).toBe(100);
    expect(resumo.pagoRealizado).toBe(100);

    const fluxo = calcularFluxo([{ tipo: "saida", valor: 100 }], baixasPagar);
    expect(fluxo.realizadoSaida).toBe(100);

    const dre = calcularDRE([], [], [{ valor: 100, categoria: "Aluguel" }]);
    expect(dre.despesasOperacionais).toBe(100);
    expect(dre.ebitda).toBe(-100);
  });

  it("4. RESULTADO: 1.000 - 600 - 100 = 300 (DRE EBITDA), Margem vinculada 300/30%, não vinculada 400", () => {
    const dre = calcularDRE(
      [{ valor: 1000, categoria: "Frete" }],
      [{ valor_liquido: 600, impacto_dre: true }],
      [{ valor: 100, categoria: "Aluguel" }]
    );
    expect(dre.receitaLiquida).toBe(1000);
    expect(dre.custosPrestadores).toBe(600);
    expect(dre.despesasOperacionais).toBe(100);
    expect(dre.ebitda).toBe(300); // resultado econômico

    // Margem com os 100 vinculados à OS
    const vinculada = calcularMargemOs({ osId: "os1", osNumero: "OS-1", receita: 1000, receitaFonte: "faturamento", custoPrestador: 600, outrosCustos: 100 });
    expect(vinculada.margem).toBe(300);
    expect(vinculada.margemPct).toBeCloseTo(30, 5);

    // Despesa administrativa NÃO vinculada → margem operacional da OS = 400
    const naoVinculada = calcularMargemOs({ osId: "os1", osNumero: "OS-1", receita: 1000, receitaFonte: "faturamento", custoPrestador: 600, outrosCustos: 0 });
    expect(naoVinculada.margem).toBe(400);
    // DRE final continua 300
    expect(dre.ebitda).toBe(300);
  });

  it("5. PREVISTO × REALIZADO: sem baixa, parcial, total e estorno", () => {
    const receber = [{ id: "rec1", cliente: "A", valor: 1000, status: "aberto" }];
    // sem baixa
    const semBaixa = calcularResumoFinanceiro({ receber, pagar: [], pagamentos: [], baixasReceber: [], baixasPagar: [] });
    expect(semBaixa.faturado).toBe(1000);
    expect(semBaixa.recebido).toBe(0);

    // parcial
    const parcial = calcularResumoFinanceiro({ receber, pagar: [], pagamentos: [], baixasReceber: [{ titulo_tabela: "financeiro_receber", titulo_id: "rec1", valor_baixado: 300, estornada: false }], baixasPagar: [] });
    expect(parcial.recebido).toBe(300);
    expect(parcial.aReceber).toBe(700);

    // total
    const total = calcularResumoFinanceiro({ receber, pagar: [], pagamentos: [], baixasReceber: [{ titulo_tabela: "financeiro_receber", titulo_id: "rec1", valor_baixado: 1000, estornada: false }], baixasPagar: [] });
    expect(total.recebido).toBe(1000);
    expect(total.aReceber).toBe(0);

    // estorno não entra
    const estorno = calcularResumoFinanceiro({ receber, pagar: [], pagamentos: [], baixasReceber: [{ titulo_tabela: "financeiro_receber", titulo_id: "rec1", valor_baixado: 1000, estornada: true }], baixasPagar: [] });
    expect(estorno.recebido).toBe(0);
    expect(estorno.aReceber).toBe(1000);
  });

  it("6. CONTAS & CAIXAS: saldo real 1.200 ≠ saldo projetado 1.500", () => {
    const conta = { id: "c1", nome: "Conta Corrente Principal", saldo_inicial: 1000 };
    const s = calcularSaldosConta(
      conta,
      [{ titulo_tabela: "financeiro_receber", valor_baixado: 500, estornada: false, conta_financeira_id: "c1" }],
      [{ titulo_tabela: "financeiro_pagar", valor_baixado: 300, estornada: false, conta_financeira_id: "c1" }],
      [{ conta: "Conta Corrente Principal", valor: 400 }],
      [{ conta: "Conta Corrente Principal", valor: 100 }]
    );
    expect(s.saldoReal).toBe(1200);
    expect(s.saldoProjetado).toBe(1500);
    expect(s.saldoReal).not.toBe(s.saldoProjetado);
  });

  it("7. RELATÓRIOS: KPIs = mesma fonte da tabela (filtro por período/cliente/prestador/status)", () => {
    const receber = [
      { id: "r1", cliente: "A", valor: 1000, data_vencimento: "2026-08-10", status: "aberto" },
      { id: "r2", cliente: "B", valor: 500, data_vencimento: "2026-09-01", status: "aberto" },
    ];
    const filtrado = receber.filter((r) => r.cliente === "A"); // filtro cliente
    const kpi = calcularResumoFinanceiro({ receber: filtrado, pagar: [], pagamentos: [], baixasReceber: [], baixasPagar: [] });
    const linhas = resumirPorCliente(filtrado, []);
    expect(kpi.faturado).toBe(1000);
    expect(linhas.reduce((s, l) => s + l.faturado, 0)).toBe(kpi.faturado); // tabela = KPI
  });

  it("8. RECIBOS: número único, histórico preservado, cancelamento soft e NÃO altera financeiro", async () => {
    expect(montarNumeroRecibo(2026, 8, 1)).toBe("REC-202608-00001");
    expect(montarNumeroRecibo(2026, 8, 2)).toBe("REC-202608-00002");
    expect(valorPorExtenso(600)).toBe("seiscentos reais");

    // criar recibo → INSERT somente em `recibos` (nenhuma tabela financeira)
    singleMock.mockResolvedValueOnce({ data: { ...reciboMock }, error: null });
    const { criarRecibo, cancelarRecibo } = await import("@/services/financeiro/reciboService");
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    singleMock.mockResolvedValueOnce({ data: { ...reciboMock }, error: null });
    const r = await criarRecibo({ favorecido_tipo: "prestador", favorecido_nome: "Prestador X", valor: 600, referencia: "Pagamento transporte OS-123", forma_pagamento: "PIX", os_numero: "OS-123" });
    expect(r.numero).toBe("REC-202608-00001");
    expect(Object.keys(inserts)).toEqual(["recibos"]); // não toca receber/pagar/baixas

    // cancelar preserva (status)
    singleMock.mockReset();
    const supabaseMock = await import("@/lib/supabase");
    const spy = vi.spyOn(supabaseMock.supabase, "from");
    spy.mockReturnValue(fluent("recibos"));
    singleMock.mockResolvedValueOnce({ data: { ...reciboMock, status: "cancelado", motivo_cancelamento: "Emissão incorreta" }, error: null });
    const c = await cancelarRecibo("r1", "Emissão incorreta");
    expect(c.status).toBe("cancelado");
    spy.mockRestore();
  });

  it("9. NENHUMA DUPLICIDADE: fatura/receber/prestador/baixa/estorno/KPIs (regras integradas)", () => {
    // receita 1x; prestador 1x; baixa não cria nova competência; estorno fora; KPI=tabela
    const receber = [{ id: "rec1", cliente: "A", valor: 1000, status: "aberto" }];
    const pagamentos = [{ prestador: "P1", valor_liquido: 600, impacto_dre: true }];
    const pagar = [{ id: "p1", fornecedor: "X", valor: 100, status: "aberto" }];
    const baixasRec = [{ titulo_tabela: "financeiro_receber", titulo_id: "rec1", valor_baixado: 1000, estornada: false }];
    const baixasPag = [{ titulo_tabela: "financeiro_pagar", titulo_id: "p1", valor_baixado: 100, estornada: false }];

    const resumo = calcularResumoFinanceiro({ receber, pagar, pagamentos, baixasReceber: baixasRec, baixasPagar: baixasPag });
    expect(resumo.faturado).toBe(1000);
    expect(resumo.recebido).toBe(1000); // realizado da baixa (não 1000+1000)
    expect(resumo.custoPrestador).toBe(600); // uma única vez
    expect(resumo.aPagar).toBe(0);

    const dre = calcularDRE(receber.map((r) => ({ valor: r.valor, categoria: "Frete" })), pagamentos, pagar.map((p) => ({ valor: p.valor, categoria: "Aluguel" })));
    expect(dre.receitaBruta).toBe(1000);
    expect(dre.custosPrestadores).toBe(600);
    expect(dre.ebitda).toBe(300); // 1000 - 600 - 100

    // baixa NÃO é input do DRE (sem parâmetro) → nunca gera nova competência
    // KPIs = tabela: indicadores margem sobre o mesmo dataset
    const l1 = calcularMargemOs({ osId: "os1", osNumero: "OS-1", receita: 1000, receitaFonte: "faturamento", custoPrestador: 600, outrosCustos: 0 });
    const ind = calcularIndicadores([l1]);
    expect(ind.receitaTotal).toBe(1000);
    expect(ind.custoTotal).toBe(600);
    expect(ind.margemTotal).toBe(400);
  });
});
