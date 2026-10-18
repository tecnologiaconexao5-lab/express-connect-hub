import { normalizarNumeroFinanceiro } from "./escalaMapper";

// --- Tipo de saída para o App Prestador ---

export interface ItemAppPrestadorEscala {
  id: string;
  numero: string;
  prestadorId: string;
  prestadorNome: string;
  data: string;
  horarioInicio: string;
  cliente: string;
  clienteId: string;
  os: string;
  origem: string;
  destino: string;
  tipoVeiculo: string;
  placa: string;
  status: string;
  statusOriginal: string;
  valorPrevisto: number;
  quantidadeEntregas: number;
}

// --- Mapa de status Escala → App Prestador ---

const MAPA_STATUS_ESCALA_PARA_APP: Record<string, string> = {
  planejada: "escalado",
  aguardando_aceite: "escalado",
  aceita: "aceito",
  recusada: "recusado",
  em_rota: "em_rota",
  concluida: "concluido",
  cancelada: "cancelado",
  ocorrencia: "em_rota",
};

// --- Predicados ---

export function isAlocacaoVisivelParaPrestador(aloc: Record<string, any>): boolean {
  if (!aloc || typeof aloc !== "object") return false;
  const status = String(aloc.status || "").toLowerCase().trim();
  if (status === "cancelada" || status === "cancelado") return false;
  return true;
}

export function isAlocacaoAtivaParaPrestador(aloc: Record<string, any>): boolean {
  if (!isAlocacaoVisivelParaPrestador(aloc)) return false;
  const st = aloc.status;
  if (st === "recusada") return false;
  if (st === "concluida") return false;
  return true;
}

// --- Status mapping ---

export function mapearStatusEscalaParaAppPrestador(status: string): string {
  return MAPA_STATUS_ESCALA_PARA_APP[status] || "escalado";
}

// --- Conversor ---

export function escalaParaItemAppPrestador(aloc: Record<string, any>): ItemAppPrestadorEscala {
  const nf = normalizarNumeroFinanceiro;
  return {
    id: aloc.id || "",
    numero: aloc.os || aloc.numero || `AL-${(aloc.id || "").slice(0, 8)}`,
    prestadorId: aloc.prestadorId || "",
    prestadorNome: aloc.prestadorNome || "",
    data: aloc.data ? String(aloc.data).split("T")[0] : "",
    horarioInicio: aloc.horarioInicio || "",
    cliente: aloc.clienteNome || "",
    clienteId: aloc.clienteId || "",
    os: aloc.os || "",
    origem: aloc.origem || "",
    destino: aloc.destino || aloc.clienteNome || "",
    tipoVeiculo: aloc.prestadorVeiculo?.tipo_veiculo || aloc.tipoVeiculo || "",
    placa: aloc.prestadorVeiculo?.placa || aloc.placa || "",
    status: mapearStatusEscalaParaAppPrestador(aloc.statusOriginal || aloc.status),
    statusOriginal: aloc.statusOriginal || aloc.status || "",
    valorPrevisto: nf(aloc.totals?.total) || nf(aloc.valorRepasse),
    quantidadeEntregas: nf(aloc.quantidadeEntregas),
  };
}
