import type { EventoOficial } from "@/types/events";

export interface FiscalTimelineEvent {
  id: string;
  documentoId: string;
  documentoNumero?: string;
  documentoTipo: "CTE" | "MDFE" | "NFSE";
  eventoTipo: string;
  descricao: string;
  dataEvento: string;
  metadata?: Record<string, any>;
  icone?: "check" | "alert" | "error" | "clock" | "history";
}

const fiscalEventTypeMap: Record<string, { tipo: string; icone: FiscalTimelineEvent["icone"] }> = {
  "fiscal.cte.emitido": { tipo: "EMISSAO", icone: "check" },
  "fiscal.nfse.emitida": { tipo: "EMISSAO", icone: "check" },
  "os.ordem_servico.finalizada": { tipo: "FINALIZACAO", icone: "check" },
  "os.ordem_servico.cancelada": { tipo: "CANCELAMENTO", icone: "error" },
};

export function toFiscalTimelineEvent(
  evento: EventoOficial
): FiscalTimelineEvent | null {
  const mapping = fiscalEventTypeMap[evento.event_type];
  if (!mapping) return null;

  const p = evento.payload || {};
  let documentoTipo: "CTE" | "MDFE" | "NFSE" = "CTE";
  if (evento.event_type.includes("nfse")) documentoTipo = "NFSE";
  else if (evento.entity_type?.toLowerCase().includes("mdfe")) documentoTipo = "MDFE";

  return {
    id: evento.id,
    documentoId: evento.entity_id,
    documentoNumero: evento.entity_number || p.numero || undefined,
    documentoTipo,
    eventoTipo: mapping.tipo,
    descricao: p.descricao || p.observacoes || `${documentoTipo} ${mapping.tipo.toLowerCase()}`,
    dataEvento: evento.created_at,
    metadata: { ...(evento.metadata || {}), payload: p },
    icone: mapping.icone,
  };
}

export function fiscalEventsToTimeline(
  eventos: EventoOficial[]
): FiscalTimelineEvent[] {
  return eventos
    .map(toFiscalTimelineEvent)
    .filter((e): e is FiscalTimelineEvent => e !== null)
    .sort((a, b) => new Date(b.dataEvento).getTime() - new Date(a.dataEvento).getTime());
}
