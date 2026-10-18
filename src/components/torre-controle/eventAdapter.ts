/**
 * Adaptador Universal de Eventos — TMS-027 Fase 1B
 *
 * Normaliza eventos de múltiplas fontes (Event Bus, operation_timeline_events,
 * ocorrencias, tracking) para um formato único consumido pela Torre de Controle.
 *
 * Fontes de verdade:
 *   - TMS-027 §2 (Contrato de Eventos Operacionais)
 *   - TMS-027 §3 (Contrato de Rastreamento)
 *   - TMS-027 §5 (Contrato de Ocorrências)
 */

/** Categorias funcionais de evento operacional */
export type CategoriaEvento =
  | "atribuicao"
  | "aceite"
  | "deslocamento"
  | "chegada"
  | "coleta"
  | "entrega"
  | "baixa"
  | "finalizacao"
  | "gps"
  | "evidencia"
  | "assinatura"
  | "documento"
  | "ocorrencia"
  | "devolucao"
  | "insucesso"
  | "financeiro"
  | "sistema";

/** Formato universal de evento para a Torre */
export interface EventoNormalizado {
  id: string;
  operationId: string | null;
  orderServiceId: string | null;
  eventType: string;
  category: CategoriaEvento;
  title: string;
  description: string;
  occurredAt: string;
  source: "app_motorista" | "tms" | "trigger" | "sistema" | string;
  status: string | null;
  stage: string | null;
  driverId: string | null;
  driverName: string | null;
  vehicleId: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  evidenceIds: string[];
  occurrenceId: string | null;
  protocolId: string | null;
  metadata: Record<string, any>;
}

/**
 * Mapeamento completo dos event_types do App Motorista (15 etapas)
 * Conforme TMS-027 §2.2 — Mapeamento Etapa → Event Type
 */
export const APP_EVENT_TYPES = [
  "operation_accepted",
  "arrived_pickup",
  "loading_started",
  "loading_finished",
  "romaneio_informado",
  "romaneio_foto",
  "km_registered",
  "route_started",
  "arrived_delivery",
  "unloading_started",
  "unloading_finished",
  "km_final",
  "signature_captured",
  "pod_sent",
  "operation_finished",
] as const;

export type AppEventType = (typeof APP_EVENT_TYPES)[number];

/** Labels em português para cada etapa do App */
export const APP_EVENT_LABELS: Record<AppEventType, string> = {
  operation_accepted: "Viagem aceita",
  arrived_pickup: "Chegou na coleta",
  loading_started: "Carregamento iniciado",
  loading_finished: "Carregamento finalizado",
  romaneio_informado: "Romaneio informado",
  romaneio_foto: "Foto do romaneio",
  km_registered: "KM registrado",
  route_started: "Saiu em rota",
  arrived_delivery: "Chegou na entrega",
  unloading_started: "Descarga iniciada",
  unloading_finished: "Descarga finalizada",
  km_final: "KM final",
  signature_captured: "Assinatura capturada",
  pod_sent: "POD enviado",
  operation_finished: "Serviço finalizado",
};

/** Categoria para cada event_type do App */
export const APP_EVENT_CATEGORIES: Record<AppEventType, CategoriaEvento> = {
  operation_accepted: "aceite",
  arrived_pickup: "chegada",
  loading_started: "coleta",
  loading_finished: "coleta",
  romaneio_informado: "documento",
  romaneio_foto: "evidencia",
  km_registered: "deslocamento",
  route_started: "deslocamento",
  arrived_delivery: "chegada",
  unloading_started: "entrega",
  unloading_finished: "entrega",
  km_final: "deslocamento",
  signature_captured: "assinatura",
  pod_sent: "evidencia",
  operation_finished: "finalizacao",
};

/** Mapeamento dos event_types que o TMS gera (11 tipos) */
export const TMS_EVENT_TYPES = [
  "os.ordem_servico.criada",
  "os.ordem_servico.finalizada",
  "os.ordem_servico.cancelada",
  "os.ordem_servico.status_changed",
  "escala.alocacao.aceita",
  "escala.alocacao.concluida",
  "escala.alocacao.cancelada",
  "escala.alocacao.recusada",
  "escala.alocacao.criada",
  "entrega.comprovante.pod_enviado",
  "portal.ocorrencia.aberta",
] as const;

/** Todos os event_types que a Torre deve consultar — união App + TMS */
export const ALL_TIMELINE_EVENT_TYPES = [...TMS_EVENT_TYPES, ...APP_EVENT_TYPES];

/** Verifica se um event_type é do App Motorista */
export function isAppEventType(type: string): type is AppEventType {
  return (APP_EVENT_TYPES as readonly string[]).includes(type);
}

/** Verifica se um event_type é do TMS */
export function isTMSEventType(type: string): boolean {
  return (TMS_EVENT_TYPES as readonly string[]).includes(type);
}

/**
 * Converte um event_type (App ou TMS) para categoria funcional
 */
export function eventTypeToCategory(type: string): CategoriaEvento {
  if (isAppEventType(type)) return APP_EVENT_CATEGORIES[type];

  if (type.startsWith("os.ordem_servico")) return "atribuicao";
  if (type.startsWith("escala.alocacao")) {
    if (type.includes("aceita")) return "aceite";
    if (type.includes("recusada") || type.includes("cancelada")) return "insucesso";
    if (type.includes("concluida")) return "finalizacao";
    return "atribuicao";
  }
  if (type.startsWith("entrega.comprovante")) return "evidencia";
  if (type.includes("ocorrencia")) return "ocorrencia";
  if (type.includes("tracking") || type.includes("gps")) return "gps";
  if (type.includes("financeiro")) return "financeiro";

  return "sistema";
}

/**
 * Label amigável para qualquer event_type
 */
export function eventTypeToLabel(type: string): string {
  if (isAppEventType(type)) return APP_EVENT_LABELS[type];

  const tmsLabels: Record<string, string> = {
    "os.ordem_servico.criada": "OS Criada",
    "os.ordem_servico.finalizada": "OS Finalizada",
    "os.ordem_servico.cancelada": "OS Cancelada",
    "os.ordem_servico.status_changed": "Status Alterado",
    "escala.alocacao.aceita": "Alocação Aceita",
    "escala.alocacao.concluida": "Alocação Concluída",
    "escala.alocacao.cancelada": "Alocação Cancelada",
    "escala.alocacao.recusada": "Alocação Recusada",
    "escala.alocacao.criada": "Alocação Criada",
    "entrega.comprovante.pod_enviado": "POD Enviado",
    "portal.ocorrencia.aberta": "Ocorrência Aberta",
  };
  return tmsLabels[type] || type.replace(/\./g, " ");
}

/**
 * Normaliza um evento bruto do Supabase (eventos_oficiais, ocorrencias, tracking)
 * para o formato EventoNormalizado universal.
 *
 * Aceita campos ausentes e formatos antigos.
 * Eventos desconhecidos viram categoria "sistema" — nunca são descartados.
 */
export function normalizarEvento(raw: Record<string, any>): EventoNormalizado {
  const eventType = raw.event_type || raw.tipo || raw.type || "desconhecido";
  const payload = raw.payload || {};
  const meta = raw.metadata || {};

  const category = eventTypeToCategory(eventType);
  const title = eventTypeToLabel(eventType);

  const occurredAt = raw.created_at || raw.occurred_at || raw.captured_at || new Date().toISOString();

  return {
    id: raw.id || `${raw.source || "ev"}-${Date.now()}`,
    operationId: raw.entity_id || payload.alocacao_id || meta.alocacao_id || meta.operation_id || raw.alocacao_id || payload.operation_id || null,
    orderServiceId: raw.entity_number || payload.os_id || meta.os_id || raw.os_id || payload.orderServiceId || payload.os_numero || null,
    eventType,
    category,
    title,
    description: raw.descricao || payload.descricao || payload.observacao || raw.titulo || `${title} — ${raw.entity_number || payload.cliente_nome || "—"}`,
    occurredAt,
    source: raw.source || raw.origem || "sistema",
    status: raw.status || payload.status || meta.status || null,
    stage: payload.etapa || meta.etapa_atual || meta.stage || null,
    driverId: raw.created_by || raw.prestador_id || payload.prestador_id || meta.prestador_id || null,
    driverName: payload.prestador_nome || meta.prestador_nome || raw.driver_name || null,
    vehicleId: payload.veiculo_id || meta.veiculo_id || raw.veiculo_id || null,
    latitude: payload.latitude || meta.latitude || raw.latitude || null,
    longitude: payload.longitude || meta.longitude || raw.longitude || null,
    accuracy: payload.precisao || payload.gps_accuracy || meta.gps_accuracy || raw.precisao || null,
    evidenceIds: Array.isArray(payload.evidence_ids) ? payload.evidence_ids : [],
    occurrenceId: raw.ocorrencia_id || payload.ocorrencia_id || null,
    protocolId: payload.protocolo_id || meta.protocolo_id || raw.protocol_id || null,
    metadata: { ...meta, ...payload },
  };
}

/**
 * Deduplica eventos com mesmo idempotency_key ou mesma combinação (type + timestamp),
 * mantendo o primeiro registro encontrado.
 */
export function deduplicarEventos(eventos: EventoNormalizado[]): EventoNormalizado[] {
  const seen = new Set<string>();
  return eventos.filter((ev) => {
    const dedupKey = ev.metadata.idempotency_key || `${ev.eventType}::${ev.occurredAt}`;
    if (seen.has(dedupKey)) return false;
    seen.add(dedupKey);
    return true;
  });
}
