import type { EventoOficial } from "@/types/events";

export interface DashboardEventoAdapter {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  timestamp: string;
  resumo: string;
  severidade: "baixa" | "media" | "alta" | "critica";
}

const severidadeMap: Record<string, "baixa" | "media" | "alta" | "critica"> = {
  "os.ordem_servico.criada": "baixa",
  "os.ordem_servico.finalizada": "baixa",
  "os.ordem_servico.cancelada": "media",
  "escala.alocacao.criada": "baixa",
  "escala.alocacao.aceita": "baixa",
  "escala.alocacao.concluida": "baixa",
  "escala.alocacao.cancelada": "alta",
};

export function toDashboardEvent(
  evento: EventoOficial
): DashboardEventoAdapter {
  return {
    id: evento.id,
    event_type: evento.event_type,
    entity_type: evento.entity_type,
    entity_id: evento.entity_id,
    timestamp: evento.created_at,
    resumo: evento.payload?.resumo || evento.event_type.replace(/\./g, " "),
    severidade: severidadeMap[evento.event_type] || "media",
  };
}
