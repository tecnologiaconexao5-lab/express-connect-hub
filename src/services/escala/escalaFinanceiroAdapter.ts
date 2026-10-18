import { isStatusCancelado } from "@/components/operacao/escalaStatus";
import { normalizarNumeroFinanceiro } from "./escalaMapper";
import { detectarStatusComprovante, type StatusComprovante } from "@/helpers/statusComprovante";
import { derivarStatusComprovanteFinanceiro } from "@/services/comprovantes/comprovantesService";

// --- Tipos de saída do adapter ---

export interface ItemFaturamentoEscala {
  alocacaoId: string;
  os: string;
  clienteId: string;
  clienteNome: string;
  data: string;
  valorFrete: number;
  status: string;
  statusPagamento: string;
}

export interface ItemRepasseEscala {
  alocacaoId: string;
  os: string;
  prestadorId: string;
  prestadorNome: string;
  data: string;
  valorBase: number;
  valorAdicionais: number;
  valorDescontos: number;
  valorTotal: number;
  quantidadeEntregas: number;
  status: string;
  statusPagamento: string;
  comprovanteStatus: StatusComprovante;
}

export interface DadosRelatorioPagamentoEscala {
  prestadorNome: string;
  veiculo: string;
  placa: string;
  os: string;
  clienteNome: string;
  data: string;
  horarioInicio: string;
  temposOperacionais: {
    chegadaPatio: string;
    inicioCarregamento: string;
    fimCarregamento: string;
    saidaRua: string;
    finalizacaoEntregas: string;
  };
  km: {
    inicial: number;
    final: number;
    rodados: number;
  };
  financeiro: {
    valorBase: number;
    adicionais: number;
    descontos: number;
    total: number;
  };
}

// --- Predicado ---

export function isAlocacaoFaturavel(aloc: Record<string, any>): boolean {
  if (!aloc || typeof aloc !== "object") return false;
  if (isStatusCancelado(aloc.status)) return false;
  if (aloc.statusPagamento === "cancelado") return false;
  return true;
}

// --- Conversores ---

export function escalaParaItemFaturamento(aloc: Record<string, any>): ItemFaturamentoEscala {
  const nf = normalizarNumeroFinanceiro;
  return {
    alocacaoId: aloc.id || "",
    os: aloc.osNumero || aloc.os || "",
    clienteId: aloc.clienteId || "",
    clienteNome: aloc.clienteNome || "",
    data: aloc.data ? String(aloc.data).split("T")[0] : "",
    valorFrete: nf(aloc.valorFrete) || nf(aloc.totals?.total),
    status: aloc.status || "",
    statusPagamento: aloc.statusPagamento || "pendente",
  };
}

export function escalaParaItemRepasse(
  aloc: Record<string, any>,
  podOverride?: unknown
): ItemRepasseEscala {
  const nf = normalizarNumeroFinanceiro;
  return {
    alocacaoId: aloc.id || "",
    os: aloc.osNumero || aloc.os || "",
    prestadorId: aloc.prestadorId || "",
    prestadorNome: aloc.prestadorNome || "",
    data: aloc.data ? String(aloc.data).split("T")[0] : "",
    valorBase: nf(aloc.totals?.valorBase),
    valorAdicionais: nf(aloc.totals?.totalAdicionais),
    valorDescontos: nf(aloc.totals?.totalDescontos),
    valorTotal: nf(aloc.totals?.total) || nf(aloc.valorRepasse),
    quantidadeEntregas: nf(aloc.quantidadeEntregas),
    status: aloc.status || "",
    statusPagamento: aloc.statusPagamento || "pendente",
    // MISSÃO A23-D: comprovanteStatus usa fonte oficial (entregas_protocolo)
    // via podOverride (linha do POD). Quando ausente, mantém o fallback
    // histórico (detectarStatusComprovante sobre a alocação) para não
    // quebrar outros callers.
    comprovanteStatus:
      podOverride !== undefined
        ? derivarStatusComprovanteFinanceiro(podOverride)
        : detectarStatusComprovante(aloc),
  };
}

export function extrairDadosRelatorioPagamento(aloc: Record<string, any>): DadosRelatorioPagamentoEscala {
  const nf = normalizarNumeroFinanceiro;
  return {
    prestadorNome: aloc.prestadorNome || "Não informado",
    veiculo: aloc.prestadorVeiculo?.tipo_veiculo || "Não informado",
    placa: aloc.prestadorVeiculo?.placa || "Não informado",
    os: aloc.osNumero || aloc.os || "Nenhuma",
    clienteNome: aloc.clienteNome || "Nenhum",
    data: aloc.data ? String(aloc.data).split("T")[0] : "",
    horarioInicio: aloc.horarioInicio || "",
    temposOperacionais: {
      chegadaPatio: aloc.tempoChegadaPatio || "",
      inicioCarregamento: aloc.tempoInicioCarregamento || "",
      fimCarregamento: aloc.tempoFimCarregamento || "",
      saidaRua: aloc.tempoSaidaRua || "",
      finalizacaoEntregas: aloc.tempoFinalizacaoEntregas || "",
    },
    km: {
      inicial: nf(aloc.kmInicial),
      final: nf(aloc.kmFinal),
      rodados: nf(aloc.financeiro?.kmRodados) || Math.max(nf(aloc.kmFinal) - nf(aloc.kmInicial), 0),
    },
    financeiro: {
      valorBase: nf(aloc.totals?.valorBase),
      adicionais: nf(aloc.totals?.totalAdicionais),
      descontos: nf(aloc.totals?.totalDescontos),
      total: nf(aloc.totals?.total),
    },
  };
}
