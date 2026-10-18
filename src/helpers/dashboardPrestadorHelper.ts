import type { StatusFinanceiroPrestador } from "./statusFinanceiroPrestador";

export interface KPIPrestador {
  totalAPagar: number;
  totalPago: number;
  totalPendente: number;
  divergencias: number;
  bloqueados: number;
  qtdPeriodo: number;
  qtdPendentes: number;
  qtdPagos: number;
  qtdDivergentes: number;
  qtdCancelados: number;
}

export interface AlertaFinanceiro {
  tipo: "divergencia_alta" | "pagamento_bloqueado" | "fechamento_incompleto" | "sem_comprovante";
  label: string;
  descricao: string;
  gravidade: "alta" | "media" | "baixa";
  quantidade: number;
}

export interface DadosDashboard {
  kpis: KPIPrestador;
  alertas: AlertaFinanceiro[];
  statusDistribuicao: { status: string; valor: number; quantidade: number }[];
}

export function calcularKPIPrestador(
  pagamentos: Record<string, unknown>[],
  pagamentosManuais: Record<string, unknown>[],
  escalaRepasse: { valorTotal: number; comprovanteStatus: string }[]
): KPIPrestador {
  let totalAPagar = 0;
  let totalPago = 0;
  let totalPendente = 0;
  let divergencias = 0;
  let bloqueados = 0;
  let qtdPeriodo = 0;
  let qtdPendentes = 0;
  let qtdPagos = 0;
  let qtdDivergentes = 0;
  let qtdCancelados = 0;

  const todos = [...pagamentos, ...pagamentosManuais];

  todos.forEach(p => {
    const vl = Number(p.valor_liquido ?? p.valor ?? 0);
    const status = String(p.status_pagamento || p.status || "pendente");
    qtdPeriodo++;

    // Definição única de "bloqueado" (mesma da Caixa de Entrada / normalizarPagamento):
    // sem prestador vinculado (fantasma) OU valor líquido inválido (<= 0).
    const semPrestador = !p.prestador_id;
    if (vl <= 0 || semPrestador) bloqueados++;

    switch (status) {
      case "pago":
        totalPago += vl;
        qtdPagos++;
        break;
      case "cancelado":
        qtdCancelados++;
        break;
      case "divergente":
        divergencias += vl;
        qtdDivergentes++;
        break;
      default:
        totalAPagar += vl;
        totalPendente += vl;
        qtdPendentes++;
        break;
    }
  });

  escalaRepasse.forEach(item => {
    totalAPagar += item.valorTotal;
    qtdPendentes++;
    if (item.comprovanteStatus === "pendente") divergencias++;
  });

  return {
    totalAPagar,
    totalPago,
    totalPendente,
    divergencias,
    bloqueados,
    qtdPeriodo,
    qtdPendentes,
    qtdPagos,
    qtdDivergentes,
    qtdCancelados,
  };
}

export function gerarAlertas(
  kpis: KPIPrestador,
  divergenciasCount: number,
  escalaCount: number
): AlertaFinanceiro[] {
  const alertas: AlertaFinanceiro[] = [];

  if (divergenciasCount > 0) {
    alertas.push({
      tipo: "divergencia_alta",
      label: "Divergências Detectadas",
      descricao: `${divergenciasCount} registro(s) com divergência financeira`,
      gravidade: divergenciasCount > 5 ? "alta" : "media",
      quantidade: divergenciasCount,
    });
  }

  if (kpis.bloqueados > 0) {
    alertas.push({
      tipo: "pagamento_bloqueado",
      label: "Pagamentos Bloqueados",
      descricao: `${kpis.bloqueados} registro(s) com valor inválido ou bloqueado`,
      gravidade: kpis.bloqueados > 3 ? "alta" : "media",
      quantidade: kpis.bloqueados,
    });
  }

  if (escalaCount > 0) {
    alertas.push({
      tipo: "fechamento_incompleto",
      label: "Repasses não Processados",
      descricao: `${escalaCount} repasse(s) da programação pendente(s) de processamento`,
      gravidade: escalaCount > 10 ? "alta" : "baixa",
      quantidade: escalaCount,
    });
  }

  return alertas;
}

export function calcularDistribuicaoStatus(
  pagamentos: Record<string, unknown>[],
  pagamentosManuais: Record<string, unknown>[]
): { status: string; valor: number; quantidade: number }[] {
  const map: Record<string, { valor: number; quantidade: number }> = {};

  const todos = [...pagamentos, ...pagamentosManuais];
  todos.forEach(p => {
    const status = String(p.status_pagamento || p.status || "pendente");
    const vl = Number(p.valor_liquido ?? p.valor ?? 0);
    if (!map[status]) map[status] = { valor: 0, quantidade: 0 };
    map[status].valor += vl;
    map[status].quantidade++;
  });

  return Object.entries(map).map(([status, data]) => ({ status, ...data }));
}
