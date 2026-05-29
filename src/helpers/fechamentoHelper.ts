export type StatusFechamento = "aberto" | "em_conferencia" | "aprovado" | "pago";

export interface FechamentoStatusInfo {
  status: StatusFechamento;
  label: string;
  cor: string;
  bg: string;
}

const FECHAMENTO_STATUS_MAP: Record<string, FechamentoStatusInfo> = {
  pendente: { status: "aberto", label: "Aberto", cor: "text-amber-700", bg: "bg-amber-50" },
  aberto: { status: "aberto", label: "Aberto", cor: "text-amber-700", bg: "bg-amber-50" },
  em_conferencia: { status: "em_conferencia", label: "Em Conferência", cor: "text-blue-700", bg: "bg-blue-50" },
  aprovado: { status: "aprovado", label: "Aprovado", cor: "text-emerald-700", bg: "bg-emerald-50" },
  pago: { status: "pago", label: "Pago", cor: "text-green-700", bg: "bg-green-50" },
  cancelado: { status: "aberto", label: "Cancelado", cor: "text-red-700", bg: "bg-red-50" },
};

export function getFechamentoStatusInfo(status?: string): FechamentoStatusInfo {
  return FECHAMENTO_STATUS_MAP[status || "pendente"] || FECHAMENTO_STATUS_MAP.pendente;
}

export interface DivergenciaFechamento {
  tipo: "sem_comprovante" | "valor_zerado" | "sem_conferencia";
  label: string;
  descricao: string;
}

export interface FechamentoDetalhado {
  id: string;
  prestadorNome: string;
  periodo: string;
  quantidadeOs: number;
  valorServicos: number;
  valorReembolsos: number;
  valorBonus: number;
  valorDescontos: number;
  valorAdiantamentos: number;
  valorPedagio: number;
  valorLiquido: number;
  status: StatusFechamento;
  divergencias: DivergenciaFechamento[];
  podeAprovar: boolean;
}

export function extrairDivergencias(pagamento: Record<string, unknown>): DivergenciaFechamento[] {
  const divs: DivergenciaFechamento[] = [];

  const valorLiquido = Number(pagamento.valor_liquido ?? 0);
  if (valorLiquido <= 0) {
    divs.push({ tipo: "valor_zerado", label: "Valor Zerado", descricao: "Valor líquido menor ou igual a zero" });
  }

  return divs;
}
