import type { StatusComprovante } from "./statusComprovante";

export type StatusFinanceiroPrestador =
  | "liberado"
  | "pendente_comprovante"
  | "pendente_conferencia"
  | "bloqueado";

export interface StatusFinanceiroInfo {
  status: StatusFinanceiroPrestador;
  label: string;
  cor: string;
  bg: string;
  borda: string;
  descricao: string;
}

const STATUS_MAP: Record<StatusFinanceiroPrestador, StatusFinanceiroInfo> = {
  liberado: {
    status: "liberado",
    label: "Liberado",
    cor: "text-emerald-700",
    bg: "bg-emerald-50",
    borda: "border-emerald-200",
    descricao: "Aprovação liberada",
  },
  pendente_comprovante: {
    status: "pendente_comprovante",
    label: "Pend. Comprovante",
    cor: "text-amber-700",
    bg: "bg-amber-50",
    borda: "border-amber-200",
    descricao: "Aguardando comprovante de entrega",
  },
  pendente_conferencia: {
    status: "pendente_conferencia",
    label: "Pend. Conferência",
    cor: "text-blue-700",
    bg: "bg-blue-50",
    borda: "border-blue-200",
    descricao: "Aguardando conferência financeira",
  },
  bloqueado: {
    status: "bloqueado",
    label: "Bloqueado",
    cor: "text-red-700",
    bg: "bg-red-50",
    borda: "border-red-200",
    descricao: "Valor inválido ou inconsistente",
  },
};

export function getStatusFinanceiroInfo(
  status?: StatusFinanceiroPrestador
): StatusFinanceiroInfo {
  return STATUS_MAP[status || "pendente_conferencia"] || STATUS_MAP.pendente_conferencia;
}

export interface DadosStatusFinanceiro {
  comprovanteStatus?: StatusComprovante;
  statusConferencia?: string;
  statusAprovacao?: string;
  valorLiquido?: number;
}

export function calcularStatusFinanceiro(
  dados: DadosStatusFinanceiro
): StatusFinanceiroPrestador {
  const valorLiquido = dados.valorLiquido ?? 0;
  if (valorLiquido <= 0) return "bloqueado";

  const comprovanteStatus = dados.comprovanteStatus || "pendente";
  if (comprovanteStatus === "pendente") return "pendente_comprovante";

  const conferencia = dados.statusConferencia || "em_aberto";
  if (conferencia !== "conferido") return "pendente_conferencia";

  return "liberado";
}

export function podeAprovar(status: StatusFinanceiroPrestador): boolean {
  return status === "liberado";
}

export function getMotivoBloqueio(status: StatusFinanceiroPrestador): string {
  const map: Record<StatusFinanceiroPrestador, string> = {
    liberado: "",
    pendente_comprovante: "Comprovante de entrega pendente",
    pendente_conferencia: "Conferência financeira pendente",
    bloqueado: "Valor líquido inválido (menor ou igual a zero)",
  };
  return map[status];
}
