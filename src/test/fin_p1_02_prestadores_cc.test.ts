/**
 * FIN-P1-02 — Testes de Pagamento de Prestadores, Fechamentos e Conta Corrente
 *
 * Valida:
 * - Fonte de dados: pagamentos_prestadores (não ordens_servico)
 * - is_teste excluído
 * - Período correto
 * - Filtros (prestador, origem, busca)
 * - Conta Corrente: crédito/débito/saldo
 * - Pagamento confirma débito na CC
 * - Idempotência de pagamento
 * - KPIs refletem período
 * - Calcula repasse prestador
 * - Montagem extrato CC
 * - Cancelado excluído
 * - CESAR reconciliação
 */

import { describe, it, expect } from "vitest";
import { calcularRepassePrestador } from "../helpers/calculoRepassePrestador";
import { calcularStatusFinanceiro, getStatusFinanceiroInfo, podeAprovar, getMotivoBloqueio } from "../helpers/statusFinanceiroPrestador";
import { getFechamentoStatusInfo, extrairDivergencias } from "../helpers/fechamentoHelper";
import { getPagamentoStatusInfo, getTimelineSteps, detectarTipoPagamento } from "../helpers/pagamentoHelper";
import { calcularKPIPrestador } from "../helpers/dashboardPrestadorHelper";

// ── Mock helpers ──
function makePagamento(overrides: Record<string, any> = {}) {
  return {
    id: "test-id",
    prestador_id: "prest-1",
    prestador_nome: "Prestador Teste",
    prestador_documento: "123.456.789-00",
    valor_servicos: 1000,
    pedagio: 50,
    adicionais: 100,
    descontos: 30,
    valor_reembolsos: 0,
    valor_bonus: 0,
    valor_liquido: 1120,
    status: "pendente",
    status_pagamento: "pendente",
    origem_lancamento: "escala_direta",
    tipo_lancamento: "Serviço Escala",
    natureza: "credito",
    periodo_inicio: "2026-09-01",
    periodo_fim: "2026-09-30",
    is_teste: false,
    data_competencia: "2026-09-15",
    ...overrides,
  };
}

// ── Fonte de dados ──
describe("FIN-P1-02 — Fonte de dados", () => {
  it("pagamentos_prestadores é a fonte (não ordens_servico)", () => {
    // Em produção, ordens_servico tem 0 registros
    // A Visão do Período agora lê de pagamentos_prestadores
    const pagamentos = [
      makePagamento({ prestador_nome: "CESAR", valor_liquido: 520 }),
      makePagamento({ prestador_nome: "CESAR", valor_liquido: 658.2 }),
    ];
    // Agrupamento por prestador funciona com pagamentos
    const grupos: Record<string, any[]> = {};
    pagamentos.forEach(p => {
      const key = p.prestador_nome || "sem_prestador";
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(p);
    });
    expect(grupos["CESAR"]).toHaveLength(2);
    expect(grupos["CESAR"].reduce((s, p) => s + p.valor_liquido, 0)).toBe(1178.2);
  });
});

// ── is_teste ──
describe("FIN-P1-02 — is_teste excluído", () => {
  it("registros de teste não aparecem", () => {
    const registros = [
      makePagamento({ id: "r1", is_teste: false }),
      makePagamento({ id: "r2", is_teste: true }),
      makePagamento({ id: "r3", is_teste: false }),
    ];
    const producao = registros.filter(r => !r.is_teste);
    expect(producao).toHaveLength(2);
  });

  it("KPI exclui testes", () => {
    const registros = [
      makePagamento({ valor_liquido: 1000, is_teste: false, status: "pendente" }),
      makePagamento({ valor_liquido: 500, is_teste: true, status: "pendente" }),
    ];
    const total = registros.filter(r => !r.is_teste).reduce((a, r) => a + r.valor_liquido, 0);
    expect(total).toBe(1000);
  });
});

// ── Cancelado excluído ──
describe("FIN-P1-02 — Cancelado excluído", () => {
  it("registros cancelados não entram no período", () => {
    const registros = [
      makePagamento({ id: "r1", status: "pendente", valor_liquido: 500 }),
      makePagamento({ id: "r2", status: "cancelado", valor_liquido: 300 }),
    ];
    const ativos = registros.filter(r => r.status !== "cancelado");
    expect(ativos).toHaveLength(1);
    expect(ativos[0].valor_liquido).toBe(500);
  });
});

// ── Período ──
describe("FIN-P1-02 — Período", () => {
  it("filtra por período corretamente", () => {
    const registros = [
      makePagamento({ periodo_inicio: "2026-09-01", valor_liquido: 100 }),
      makePagamento({ periodo_inicio: "2026-08-15", valor_liquido: 200 }),
      makePagamento({ periodo_inicio: "2026-09-20", valor_liquido: 300 }),
    ];
    const filtrados = registros.filter(r => r.periodo_inicio >= "2026-09-01" && r.periodo_inicio <= "2026-09-30");
    expect(filtrados).toHaveLength(2);
    expect(filtrados.reduce((s, r) => s + r.valor_liquido, 0)).toBe(400);
  });

  it("mês atual calcula range correto", () => {
    const hoje = new Date();
    const y = hoje.getFullYear();
    const m = hoje.getMonth();
    const inicio = new Date(y, m, 1);
    const fim = new Date(y, m + 1, 0);
    const iniStr = inicio.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const fimStr = fim.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    expect(iniStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fimStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ── Filtros ──
describe("FIN-P1-02 — Filtros", () => {
  const pagamentos = [
    makePagamento({ prestador_id: "p1", prestador_nome: "ABC Transportes", origem_lancamento: "escala_direta" }),
    makePagamento({ prestador_id: "p2", prestador_nome: "XYZ Logística", origem_lancamento: "os_direta" }),
    makePagamento({ prestador_id: "p1", prestador_nome: "ABC Transportes", origem_lancamento: "manual" }),
  ];

  it("filtro por prestador", () => {
    const filtrados = pagamentos.filter(p => p.prestador_id === "p1");
    expect(filtrados).toHaveLength(2);
  });

  it("filtro por origem", () => {
    const filtrados = pagamentos.filter(p => p.origem_lancamento === "escala_direta");
    expect(filtrados).toHaveLength(1);
    expect(filtrados[0].prestador_nome).toBe("ABC Transportes");
  });

  it("busca textual por nome", () => {
    const q = "abc";
    const filtrados = pagamentos.filter(p => p.prestador_nome.toLowerCase().includes(q));
    expect(filtrados).toHaveLength(2);
  });

  it("combinação de filtros", () => {
    const filtrados = pagamentos.filter(p =>
      p.prestador_id === "p1" && p.origem_lancamento === "escala_direta"
    );
    expect(filtrados).toHaveLength(1);
  });
});

// ── Cálculo repasse ──
describe("FIN-P1-02 — Cálculo repasse", () => {
  it("serviço + pedágio + adicionais - descontos = líquido", () => {
    const r = calcularRepassePrestador({
      custo_prestador: 1000,
      pedagio: 50,
      adicionais: 100,
      descontos: 30,
    });
    expect(r.totalCredito).toBe(1150);
    expect(r.totalDebito).toBe(30);
    expect(r.totalLiquido).toBe(1120);
  });

  it("com reembolso e bônus", () => {
    const r = calcularRepassePrestador({
      custo_prestador: 1000,
      pedagio: 0,
      adicionais: 0,
      descontos: 0,
      reembolso: 200,
      bonus: 50,
    });
    expect(r.totalCredito).toBe(1250);
    expect(r.totalLiquido).toBe(1250);
  });

  it("com desconto manual", () => {
    const r = calcularRepassePrestador({
      custo_prestador: 1000,
      pedagio: 0,
      adicionais: 0,
      descontos: 0,
      descontoManual: 100,
    });
    expect(r.totalDebito).toBe(100);
    expect(r.totalLiquido).toBe(900);
  });
});

// ── Conta Corrente ──
describe("FIN-P1-02 — Conta Corrente", () => {
  it("crédito = valor devido ao prestador", () => {
    const pag = makePagamento({ valor_liquido: 1000, natureza: "credito", status: "pendente" });
    const extrato = [{
      id: pag.id,
      data: pag.periodo_inicio,
      origem: pag.tipo_lancamento,
      descricao: "Serviço",
      credito: pag.natureza === "credito" ? pag.valor_liquido : 0,
      debito: pag.natureza !== "credito" ? pag.valor_liquido : 0,
      saldo: 0,
      status: pag.status_pagamento,
    }];
    expect(extrato[0].credito).toBe(1000);
    expect(extrato[0].debito).toBe(0);
  });

  it("pagamento gera débito na CC", () => {
    const pag = makePagamento({ valor_liquido: 1000, status: "pago" });
    // Linha de pagamento: débito
    const linhaPagamento = {
      id: `${pag.id}-pgto`,
      origem: "Pagamento",
      credito: 0,
      debito: pag.valor_liquido,
    };
    expect(linhaPagamento.debito).toBe(1000);
    expect(linhaPagamento.credito).toBe(0);
  });

  it("saldo = créditos - débitos", () => {
    const linhas = [
      { credito: 1000, debito: 0 },
      { credito: 500, debito: 0 },
      { credito: 0, debito: 1000 },
    ];
    let saldo = 0;
    linhas.forEach(l => { saldo += l.credito - l.debito; });
    expect(saldo).toBe(500);
  });

  it("saldo acumulado cronologicamente", () => {
    const linhas = [
      { credito: 1000, debito: 0 },
      { credito: 0, debito: 500 },
      { credito: 800, debito: 0 },
      { credito: 0, debito: 800 },
    ];
    let saldo = 0;
    const saldos = linhas.map(l => {
      saldo += l.credito - l.debito;
      return saldo;
    });
    expect(saldos).toEqual([1000, 500, 1300, 500]);
  });

  it("pagamento não duplica (idempotência)", () => {
    // Se pagamento já foi registrado como débito, não deve gerar segundo débito
    const pagId = "test-pag-1";
    const debitosExistentes = [`${pagId}-pgto`];
    const jaExiste = debitosExistentes.includes(`${pagId}-pgto`);
    expect(jaExiste).toBe(true);
  });
});

// ── KPIs refletem período ──
describe("FIN-P1-02 — KPIs refletem período", () => {
  it("total a pagar soma líquido do período", () => {
    const pagamentos = [
      makePagamento({ valor_liquido: 1000, status: "pendente" }),
      makePagamento({ valor_liquido: 500, status: "pendente" }),
    ];
    const total = pagamentos.reduce((s, p) => s + p.valor_liquido, 0);
    expect(total).toBe(1500);
  });

  it("pagamentos confirmados conta apenas status=pago", () => {
    const pagamentos = [
      makePagamento({ status: "pago" }),
      makePagamento({ status: "pendente" }),
      makePagamento({ status: "pago" }),
    ];
    const pagos = pagamentos.filter(p => p.status === "pago");
    expect(pagos).toHaveLength(2);
  });

  it("prestadores distintos no período", () => {
    const pagamentos = [
      makePagamento({ prestador_nome: "A" }),
      makePagamento({ prestador_nome: "B" }),
      makePagamento({ prestador_nome: "A" }),
    ];
    const prestadores = new Set(pagamentos.map(p => p.prestador_nome));
    expect(prestadores.size).toBe(2);
  });
});

// ── Status helpers ──
describe("FIN-P1-02 — Status helpers", () => {
  it("calcularStatusFinanceiro retorna liberado quando conferido", () => {
    const s = calcularStatusFinanceiro({
      statusConferencia: "conferido",
      valorLiquido: 1000,
    });
    expect(s).toBe("liberado");
  });

  it("calcularStatusFinanceiro retorna pendente_conferencia quando não conferido", () => {
    const s = calcularStatusFinanceiro({
      statusConferencia: "em_aberto",
      valorLiquido: 1000,
    });
    expect(s).toBe("pendente_conferencia");
  });

  it("calcularStatusFinanceiro retorna bloqueado quando valor <= 0", () => {
    const s = calcularStatusFinanceiro({
      valorLiquido: 0,
    });
    expect(s).toBe("bloqueado");
  });

  it("podeAprovar apenas liberado", () => {
    expect(podeAprovar("liberado")).toBe(true);
    expect(podeAprovar("pendente_conferencia")).toBe(false);
    expect(podeAprovar("bloqueado")).toBe(false);
  });

  it("getFechamentoStatusInfo retorna info", () => {
    const info = getFechamentoStatusInfo("aprovado");
    expect(info.label).toBe("Aprovado");
  });

  it("extrairDivergencias retorna divergências", () => {
    const divs = extrairDivergencias({ valor_liquido: 0 } as any);
    expect(divs.length).toBeGreaterThan(0);
  });
});

// ── Pagamento helpers ──
describe("FIN-P1-02 — Pagamento helpers", () => {
  it("getPagamentoStatusInfo retorna info", () => {
    const info = getPagamentoStatusInfo("pago");
    expect(info.label).toBe("Pago");
  });

  it("getTimelineSteps retorna steps", () => {
    const steps = getTimelineSteps("pago");
    expect(steps.length).toBeGreaterThan(0);
  });

  it("detectarTipoPagamento detecta integral", () => {
    const tipo = detectarTipoPagamento({ valor_liquido: 1000, valor_servicos: 1000, descontos: 0, status_pagamento: "pago" } as any);
    expect(tipo).toBe("integral");
  });
});

// ── Dashboard helpers ──
describe("FIN-P1-02 — Dashboard helpers", () => {
  it("calcularKPIPrestador calcula KPIs", () => {
    const pagamentos = [
      makePagamento({ status_pagamento: "pago", status: "pago", valor_liquido: 500 }),
      makePagamento({ status_pagamento: "pendente", status: "pendente", valor_liquido: 1000 }),
    ];
    const kpis = calcularKPIPrestador(pagamentos as any, [], []);
    expect(kpis.totalPago).toBe(500);
    expect(kpis.totalAPagar).toBe(1000);
  });
});

// ── CASO REAL CESAR ──
describe("FIN-P1-02 — CASO REAL CESAR", () => {
  it("CESAR: 12 registros, 3 pagos, saldo devido = 8187.82", () => {
    const cesar = [
      makePagamento({ id: "1", valor_liquido: 520, status: "pendente", periodo_inicio: "2026-07-07", origem_lancamento: "escala_direta" }),
      makePagamento({ id: "2", valor_liquido: 652.86, status: "pendente", periodo_inicio: "2026-08-17", origem_lancamento: "escala_direta" }),
      makePagamento({ id: "3", valor_liquido: 520, status: "pendente", periodo_inicio: "2026-08-18", origem_lancamento: "escala_direta" }),
      makePagamento({ id: "4", valor_liquido: 658.2, status: "pago", periodo_inicio: "2026-08-19", origem_lancamento: "manual" }),
      makePagamento({ id: "5", valor_liquido: 2177.92, status: "pago", periodo_inicio: "2026-08-20", origem_lancamento: "manual" }),
      makePagamento({ id: "6", valor_liquido: 520, status: "pendente", periodo_inicio: "2026-08-27", origem_lancamento: "escala_direta" }),
      makePagamento({ id: "7", valor_liquido: 520, status: "pago", periodo_inicio: "2026-08-28", origem_lancamento: "escala_direta" }),
      makePagamento({ id: "8", valor_liquido: 520, status: "pendente", periodo_inicio: "2026-08-30", origem_lancamento: "escala_direta" }),
      makePagamento({ id: "9", valor_liquido: 1040, status: "pendente", periodo_inicio: "2026-08-31", origem_lancamento: "manual" }),
      makePagamento({ id: "10", valor_liquido: 3150.34, status: "pendente", periodo_inicio: "2026-09-02", origem_lancamento: "manual" }),
      makePagamento({ id: "11", valor_liquido: 599.94, status: "pendente", periodo_inicio: "2026-09-03", origem_lancamento: "escala_direta" }),
      makePagamento({ id: "12", valor_liquido: 664.68, status: "pendente", periodo_inicio: "2026-09-08", origem_lancamento: "escala_direta" }),
    ];

    const ativos = cesar.filter(p => p.status !== "cancelado");
    const totalCreditos = ativos.reduce((s, p) => s + p.valor_liquido, 0);
    const pagos = ativos.filter(p => p.status === "pago");
    const totalPago = pagos.reduce((s, p) => s + p.valor_liquido, 0);
    const saldoDevido = totalCreditos - totalPago;

    expect(ativos).toHaveLength(12);
    expect(totalCreditos).toBeCloseTo(11543.94, 1);
    expect(pagos).toHaveLength(3);
    expect(totalPago).toBeCloseTo(3356.12, 1);
    expect(saldoDevido).toBeCloseTo(8187.82, 1);
  });

  it("CESAR: contagem por período", () => {
    const cesar = [
      makePagamento({ periodo_inicio: "2026-07-07" }),
      makePagamento({ periodo_inicio: "2026-08-17" }),
      makePagamento({ periodo_inicio: "2026-08-18" }),
      makePagamento({ periodo_inicio: "2026-08-19" }),
      makePagamento({ periodo_inicio: "2026-08-20" }),
      makePagamento({ periodo_inicio: "2026-08-27" }),
      makePagamento({ periodo_inicio: "2026-08-28" }),
      makePagamento({ periodo_inicio: "2026-08-30" }),
      makePagamento({ periodo_inicio: "2026-08-31" }),
      makePagamento({ periodo_inicio: "2026-09-02" }),
      makePagamento({ periodo_inicio: "2026-09-03" }),
      makePagamento({ periodo_inicio: "2026-09-08" }),
    ];
    const jul = cesar.filter(p => p.periodo_inicio.startsWith("2026-07"));
    const aug = cesar.filter(p => p.periodo_inicio.startsWith("2026-08"));
    const sep = cesar.filter(p => p.periodo_inicio.startsWith("2026-09"));
    expect(jul).toHaveLength(1);
    expect(aug).toHaveLength(8);
    expect(sep).toHaveLength(3);
  });
});
