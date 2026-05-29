export type StatusPagamentoConciliado =
  | "pendente"
  | "programado"
  | "pago"
  | "divergente"
  | "cancelado";

export interface StatusPagamentoInfo {
  status: StatusPagamentoConciliado;
  label: string;
  cor: string;
  bg: string;
  ordem: number;
}

const PAGAMENTO_STATUS_MAP: Record<string, StatusPagamentoInfo> = {
  pendente: { status: "pendente", label: "Pendente", cor: "text-amber-700", bg: "bg-amber-50", ordem: 0 },
  programado: { status: "programado", label: "Programado", cor: "text-blue-700", bg: "bg-blue-50", ordem: 1 },
  agendado: { status: "programado", label: "Programado", cor: "text-blue-700", bg: "bg-blue-50", ordem: 1 },
  em_lote: { status: "programado", label: "Em Lote", cor: "text-indigo-700", bg: "bg-indigo-50", ordem: 2 },
  pago: { status: "pago", label: "Pago", cor: "text-emerald-700", bg: "bg-emerald-50", ordem: 3 },
  divergente: { status: "divergente", label: "Divergente", cor: "text-red-700", bg: "bg-red-50", ordem: 3 },
  cancelado: { status: "cancelado", label: "Cancelado", cor: "text-gray-500", bg: "bg-gray-100", ordem: 4 },
};

export function getPagamentoStatusInfo(status?: string): StatusPagamentoInfo {
  return PAGAMENTO_STATUS_MAP[status || "pendente"] || PAGAMENTO_STATUS_MAP.pendente;
}

export interface TimelineStep {
  status: StatusPagamentoConciliado;
  label: string;
  ativo: boolean;
  concluido: boolean;
  icone: string;
}

export function getTimelineSteps(statusAtual: string): TimelineStep[] {
  const info = getPagamentoStatusInfo(statusAtual);
  const ordemAtual = info.ordem;

  const steps: { status: StatusPagamentoConciliado; label: string }[] = [
    { status: "pendente", label: "Pendente" },
    { status: "programado", label: "Programado" },
    { status: "pago", label: "Pago" },
    { status: "cancelado", label: "Cancelado" },
  ];

  return steps.map(s => ({
    ...s,
    ativo: s.status === info.status,
    concluido: PAGAMENTO_STATUS_MAP[s.status]!.ordem <= ordemAtual && info.status !== "cancelado",
    icone: s.status === "cancelado" ? "X" : s.status === "pago" ? "Check" : s.status === "programado" ? "Clock" : "Circle",
  }));
}

export function detectarTipoPagamento(pagamento: Record<string, unknown>): "integral" | "divergente" | "pendente" {
  const status = String(pagamento.status_pagamento || pagamento.status || "pendente");
  if (status === "pago") return "integral";
  if (status === "cancelado") return "divergente";
  return "pendente";
}

export function getTipoPagamentoBadge(tipo: "integral" | "divergente" | "pendente"): { label: string; cor: string; bg: string } {
  const map = {
    integral: { label: "Pago Integral", cor: "text-emerald-700", bg: "bg-emerald-50" },
    divergente: { label: "Divergente", cor: "text-red-700", bg: "bg-red-50" },
    pendente: { label: "Pendente", cor: "text-amber-700", bg: "bg-amber-50" },
  };
  return map[tipo];
}
