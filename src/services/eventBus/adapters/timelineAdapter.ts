import type { EventoOficial } from "@/types/events";

export interface TimelineEventAdapter {
  id: string;
  timestamp: string;
  label: string;
  description?: string;
  tipoEvento: string;
  severidade?: "baixa" | "media" | "alta" | "critica";
  cliente?: string;
  prestador?: string;
  os?: string;
  status?: "completed" | "current" | "pending" | "warning";
  done?: boolean;
  icone?: string;
}

export function toTimelineEvent(
  evento: EventoOficial
): TimelineEventAdapter {
  const p = evento.payload;

  const labelMap: Record<string, string> = {
    "os.ordem_servico.criada": "OS criada",
    "os.ordem_servico.finalizada": "OS finalizada",
    "os.ordem_servico.cancelada": "OS cancelada",
    "escala.alocacao.criada": "Alocação criada",
    "escala.alocacao.aceita": "Motorista aceitou",
    "escala.alocacao.concluida": "Operação concluída",
    "escala.alocacao.cancelada": "Alocação cancelada",
  };

  return {
    id: evento.id,
    timestamp: evento.created_at,
    label: labelMap[evento.event_type] || evento.event_type,
    description: p?.observacoes || p?.descricao || undefined,
    tipoEvento: evento.event_type,
    cliente: p?.cliente_nome || undefined,
    prestador: p?.prestador_nome || undefined,
    os: p?.os_numero || evento.entity_number || undefined,
    status: evento.status === "active" ? "completed" : "pending",
  };
}
