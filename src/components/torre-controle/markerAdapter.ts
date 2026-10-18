/**
 * Adaptador de Marcadores — TMS-027 Fase 2
 *
 * Enriquece o modelo MapLocation com dados operacionais completos,
 * estados visuais de GPS e mapeamento de status operacional.
 *
 * Fontes de verdade:
 *   - TMS-027 §1 (Matriz App ↔ Torre)
 *   - TMS-027 §3 (Contrato de Rastreamento)
 *   - TMS-027 §7 (Contrato de Timeline)
 */

import { TrackingPosition } from "@/services/rastreamento/trackingService";

/**
 * MISSÃO A25-L — Contrato Grupo 2 do mapa (alocação ativa SEM OS).
 * Marcadores sem OS usam id "aloc-<uuid>"; o painel (DetalhesOperacaoSheet)
 * converte de volta via extrairIdAlocacaoDeMarcador(). Mantidos em um único
 * lugar para que o round-trip seja testável e não diverja.
 */
export const PREFIXO_MARCADOR_ALOC_SEM_OS = "aloc-";

export function marcadorIdAlocacaoSemOS(alocacaoId: string): string {
  return `${PREFIXO_MARCADOR_ALOC_SEM_OS}${alocacaoId}`;
}

export function extrairIdAlocacaoDeMarcador(markerId: string): string | null {
  if (!markerId || !markerId.startsWith(PREFIXO_MARCADOR_ALOC_SEM_OS)) return null;
  const alocId = markerId.slice(PREFIXO_MARCADOR_ALOC_SEM_OS.length);
  return alocId.length > 0 ? alocId : null;
}

/** Estados operacionais do mapa (mais granulares que MapLocation.status) */
export type MarkerOperationalStatus =
  | "em_deslocamento"
  | "em_coleta"
  | "em_entrega"
  | "parado"
  | "com_ocorrencia"
  | "aguardando_aceite"
  | "finalizado";

/** Estados de qualidade do GPS */
export type GpsState = "atualizado" | "antigo" | "muito_antigo" | "indisponivel" | "sem_rastreamento";

/** Estado de SLA */
export type SlaState = "no_prazo" | "em_risco" | "atrasado" | "sem_previsao" | "concluido";

/** Marcador enriquecido para o mapa operacional */
export interface EnrichedMarker {
  id: string;
  operationId: string;
  orderServiceId: string | null;
  allocationId: string | null;
  driverId: string | null;
  driverName: string | null;
  vehicleType: string | null;
  plate: string | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  lastLocationAt: string | null;
  operationalStatus: MarkerOperationalStatus;
  currentStage: string | null;
  clientName: string | null;
  origin: string | null;
  destination: string | null;
  nextStop: string | null;
  gpsState: GpsState;
  occurrenceState: boolean;
  slaState: SlaState;
  previsaoTermino: string | null;
  osNumero: string | null;
  osStatus: string | null;
  alocStatus: string | null;
}

/** Configuração visual para cada estado operacional */
export const OPERATIONAL_STATUS_CONFIG: Record<MarkerOperationalStatus, {
  color: string;
  icon: string;
  label: string;
  bgClass: string;
}> = {
  em_deslocamento: { color: "#22c55e", icon: "truck", label: "Em Deslocamento", bgClass: "bg-emerald-500" },
  em_coleta: { color: "#0ea5e9", icon: "package", label: "Em Coleta", bgClass: "bg-sky-500" },
  em_entrega: { color: "#f97316", icon: "map-pin", label: "Em Entrega", bgClass: "bg-orange-500" },
  parado: { color: "#f59e0b", icon: "clock", label: "Parado", bgClass: "bg-amber-500" },
  com_ocorrencia: { color: "#ef4444", icon: "alert-triangle", label: "Ocorrência", bgClass: "bg-red-500" },
  aguardando_aceite: { color: "#a855f7", icon: "user-check", label: "Aguard. Aceite", bgClass: "bg-purple-500" },
  finalizado: { color: "#6b7280", icon: "check-circle", label: "Finalizado", bgClass: "bg-gray-500" },
};

/** Configuração visual para cada estado de GPS */
export const GPS_STATE_CONFIG: Record<GpsState, {
  color: string;
  label: string;
  textClass: string;
}> = {
  atualizado: { color: "#22c55e", label: "GPS Atualizado", textClass: "text-emerald-600" },
  antigo: { color: "#f59e0b", label: "GPS Antigo", textClass: "text-amber-600" },
  muito_antigo: { color: "#ef4444", label: "GPS Muito Antigo", textClass: "text-rose-600" },
  indisponivel: { color: "#dc2626", label: "GPS Indisponível", textClass: "text-red-600" },
  sem_rastreamento: { color: "#9ca3af", label: "Sem Rastreamento", textClass: "text-gray-500" },
};

/** Configuração visual para estado de SLA */
export const SLA_STATE_CONFIG: Record<SlaState, {
  color: string;
  label: string;
}> = {
  no_prazo: { color: "#22c55e", label: "No Prazo" },
  em_risco: { color: "#f59e0b", label: "Em Risco" },
  atrasado: { color: "#ef4444", label: "Atrasado" },
  sem_previsao: { color: "#9ca3af", label: "Sem Previsão" },
  concluido: { color: "#3b82f6", label: "Concluído" },
};

/**
 * Determina o estado do GPS baseado no timestamp da última posição.
 */
export function computeGpsState(
  tracking: TrackingPosition | null | undefined,
  alocStatus: string | null
): GpsState {
  if (!tracking) return alocStatus === "em_rota" ? "indisponivel" : "sem_rastreamento";
  const lastUpdate = tracking.captured_at || tracking.created_at;
  if (!lastUpdate) return "sem_rastreamento";
  const minSince = Math.floor((Date.now() - new Date(lastUpdate).getTime()) / 60000);
  if (minSince <= 15) return "atualizado";
  if (minSince <= 60) return "antigo";
  return "muito_antigo";
}

/**
 * Determina o estado operacional baseado no status da alocação e etapa do App.
 */
export function computeOperationalStatus(
  alocStatus: string | null,
  etapaApp: string | null,
  hasOcorrencia: boolean
): MarkerOperationalStatus {
  if (hasOcorrencia) return "com_ocorrencia";
  if (alocStatus === "concluida" || alocStatus === "cancelada" || alocStatus === "recusada") return "finalizado";
  if (alocStatus === "aguardando_aceite") return "aguardando_aceite";

  if (etapaApp) {
    const etapa = etapaApp.toLowerCase();
    if (etapa.includes("coleta") || etapa.includes("carregamento") || etapa.includes("romaneio")) return "em_coleta";
    if (etapa.includes("entrega") || etapa.includes("descarregamento")) return "em_entrega";
    if (etapa.includes("rota") || etapa.includes("deslocamento")) return "em_deslocamento";
    if (etapa.includes("assinatura") || etapa.includes("pod") || etapa.includes("finalizado")) return "em_entrega";
  }

  if (alocStatus === "em_rota") return "em_deslocamento";
  if (alocStatus === "aceita") return "aguardando_aceite";
  return "parado";
}

/**
 * Determina o estado de SLA baseado na previsão de término e status.
 */
export function computeSlaState(
  previsaoTermino: string | null | undefined,
  osStatus: string | null | undefined
): SlaState {
  const concluido = osStatus === "finalizada" || osStatus === "concluida" || osStatus === "entregue";
  if (concluido) return "concluido";
  if (!previsaoTermino) return "sem_previsao";
  if (new Date(previsaoTermino).getTime() < Date.now()) return "atrasado";
  const diffMin = Math.floor((new Date(previsaoTermino).getTime() - Date.now()) / 60000);
  if (diffMin <= 60) return "em_risco";
  return "no_prazo";
}

/**
 * Verifica se uma coordenada é válida (não é 0,0 e está dentro dos limites).
 */
export function isValidCoordinate(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat == null || lng == null) return false;
  if (lat === 0 && lng === 0) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
}

/* ============================================================
 * MISSÃO A25-B — GPS REAL TEM PRIORIDADE SOBRE COORDENADA DA OS
 * ============================================================ */

export interface CoordenadasMarcador {
  lat: number;
  lng: number;
  usandoGPS: boolean;
  gpsState: GpsState;
  posicao: TrackingPosition | null;
}

/**
 * Monta o mapa OS→alocações a partir das posições (os_id + alocacao_id).
 * Permite o match do marcador por alocacao_id (tracking é iniciado por alocação).
 */
export function montarMapaAlocacoesPorOS(
  posicoes: TrackingPosition[]
): Map<string, Set<string>> {
  const mapa = new Map<string, Set<string>>();
  for (const p of posicoes) {
    if (p.os_id && p.alocacao_id) {
      const set = mapa.get(p.os_id) || new Set<string>();
      set.add(p.alocacao_id);
      mapa.set(p.os_id, set);
    }
  }
  return mapa;
}

/**
 * Resolve a posição de um marcador:
 *   1. primário por alocacao_id (tracking é iniciado por alocação);
 *   2. por os_id;
 *   3. por alocacao_id via mapa OS→alocações (fallback quando só há os_id no mapa).
 * Retorna null quando não há correspondência.
 */
export function resolverPosicaoMarcador(
  osId: string,
  posicoes: TrackingPosition[],
  alocacoesPorOS?: Map<string, Set<string>>
): TrackingPosition | null {
  // 1. Match direto por alocacao_id (prioridade — tracking é por alocação)
  const porAlocacaoDireta = posicoes.find((p) => p.alocacao_id === osId);
  if (porAlocacaoDireta) return porAlocacaoDireta;

  // 2. Match por os_id
  const porOs = posicoes.find((p) => p.os_id === osId);
  if (porOs) return porOs;

  // 3. Alocação vinculada a esta OS via mapa OS→alocações
  const alocs = alocacoesPorOS?.get(osId);
  if (alocs && alocs.size) {
    return posicoes.find((p) => p.alocacao_id && alocs.has(p.alocacao_id)) || null;
  }
  return null;
}

/**
 * Prioriza a posição GPS real; senão usa a coordenada estática da OS; se nenhum
 * dos dois existir, retorna null (sem marcador). Aplica o estado de GPS.
 */
export function montarMarcadorGPS(
  osCoords: { lat: number; lng: number } | null,
  posicao: TrackingPosition | null,
  alocStatus: string | null
): CoordenadasMarcador | null {
  const liveLat = posicao?.latitude;
  const liveLng = posicao?.longitude;
  const usandoGPS = isValidCoordinate(liveLat, liveLng);
  const lat = usandoGPS ? liveLat! : osCoords?.lat;
  const lng = usandoGPS ? liveLng! : osCoords?.lng;
  if (!isValidCoordinate(lat, lng)) return null;
  return {
    lat,
    lng,
    usandoGPS,
    gpsState: computeGpsState(posicao, alocStatus),
    posicao: posicao || null,
  };
}

/**
 * Classifica o nível de bateria do dispositivo para exibição na Torre.
 * Bateria ausente (null/undefined/0) nunca é inventada — retorna informada=false.
 */
export function classificarBateria(
  bateria: number | null | undefined
): { informada: boolean; nivel: "normal" | "atencao" | "critico" | null; percentual: number | null } {
  if (bateria == null || bateria <= 0) return { informada: false, nivel: null, percentual: null };
  const pct = Math.min(100, Math.max(0, Math.round(bateria)));
  const nivel = pct >= 20 ? "normal" : pct >= 10 ? "atencao" : "critico";
  return { informada: true, nivel, percentual: pct };
}

/**
 * Indica se uma posição é recente o suficiente para a operação do mapa.
 * Utiliza captured_at prioritariamente e created_at como fallback.
 * Regra coerente com a Torre: "atualizado" ≤15min, "antigo" ≤60min;
 * acima de 60min a posição é considerada não-operacional (não entra no mapa).
 */
export function posicaoRecente(
  posicao: TrackingPosition | null | undefined,
  agora: number = Date.now(),
  maxIdadeMin: number = 60
): boolean {
  if (!posicao) return false;
  const ts = posicao.captured_at || posicao.created_at;
  if (!ts) return false;
  const ms = new Date(ts).getTime();
  if (isNaN(ms)) return false;
  const idadeMin = (agora - ms) / 60000;
  return idadeMin >= 0 && idadeMin <= maxIdadeMin;
}

/* ============================================================
 * MISSÃO A25-D — ALOCAÇÃO OPERACIONAL SEM OS (GRUPO 2 do mapa)
 * ============================================================ */

export interface AlocacaoSemOS {
  id: string;
  status: string;
  prestador_id: string | null;
  prestador_nome?: string | null;
  veiculo_tipo?: string | null;
  placa?: string | null;
  origem?: string | null;
  destino?: string | null;
  numero_os?: string | null;
  romaneio?: string | null;
  etapa_app?: string | null;
  metadata?: Record<string, any>;
}

export interface MarcadorAlocacaoSemOS {
  id: string;
  numero: string;
  latitude: number;
  longitude: number;
  status: "em_rota" | "aguardando" | "ocorrencia" | "atrasado" | "concluida" | "em_coleta" | "em_entrega" | "parado";
  cliente?: string;
  prestador?: string;
  previsao?: string;
  sla?: string;
  vehicleType?: string;
  plate?: string;
  driverName?: string;
  gpsState?: GpsState;
  speed?: number;
  accuracy?: number;
  bateria?: number;
  lastLocationAt?: string;
  osNumero?: string;
  currentStage?: string;
  origin?: string;
  destination?: string;
  alocacaoId?: string;
}

/**
 * Monta um marcador operacional a partir de UMA alocação ativa SEM OS,
 * usando GPS real (prioridade) — sem coordenada estática de OS.
 * Retorna null quando não há tracking recente válido.
 */
export function montarMarcadorAlocacaoSemOS(
  aloc: AlocacaoSemOS,
  posicao: TrackingPosition | null,
  agora: number = Date.now()
): MarcadorAlocacaoSemOS | null {
  if (!posicaoRecente(posicao, agora)) return null;

  const usandoGPS = isValidCoordinate(posicao?.latitude, posicao?.longitude);
  if (!usandoGPS) return null;

  const alocStatus = aloc.status;
  const hasOcorrencia = alocStatus === "ocorrencia";
  const etapaApp = aloc.etapa_app || aloc.metadata?.app_motorista?.etapa_atual || null;
  const operationalStatus = computeOperationalStatus(alocStatus, etapaApp, hasOcorrencia);
  const gpsState = computeGpsState(posicao, alocStatus);

  let mapStatus: MarcadorAlocacaoSemOS["status"] = "aguardando";
  if (operationalStatus === "em_deslocamento") mapStatus = "em_rota";
  else if (operationalStatus === "em_coleta") mapStatus = "em_coleta";
  else if (operationalStatus === "em_entrega") mapStatus = "em_entrega";
  else if (operationalStatus === "parado") mapStatus = "parado";
  else if (operationalStatus === "com_ocorrencia") mapStatus = "ocorrencia";
  else if (operationalStatus === "aguardando_aceite") mapStatus = "aguardando";
  else if (operationalStatus === "finalizado") mapStatus = "concluida";

  const numero = aloc.numero_os || aloc.romaneio || `Alocação ${aloc.id.slice(0, 8)}`;

  return {
    id: marcadorIdAlocacaoSemOS(aloc.id),
    numero,
    latitude: posicao!.latitude!,
    longitude: posicao!.longitude!,
    status: mapStatus,
    cliente: aloc.metadata?.app_motorista?.cliente_nome || undefined,
    prestador: aloc.prestador_nome || undefined,
    previsao: undefined,
    sla: undefined,
    vehicleType: aloc.veiculo_tipo || undefined,
    plate: aloc.placa || undefined,
    driverName: aloc.prestador_nome || undefined,
    gpsState,
    speed: posicao?.velocidade || undefined,
    accuracy: posicao?.precisao || undefined,
    bateria: posicao?.bateria ?? undefined,
    lastLocationAt: posicao?.captured_at || posicao?.created_at || undefined,
    osNumero: aloc.numero_os || undefined,
    currentStage: etapaApp || undefined,
    origin: aloc.origem || undefined,
    destination: aloc.destino || undefined,
    alocacaoId: aloc.id,
  };
}
