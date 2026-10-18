import type { EventoOficial } from "@/types/events";

export interface NotificacaoAdapter {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  lida: boolean;
  created_at: string;
}

export function toNotificacao(
  evento: EventoOficial
): NotificacaoAdapter {
  const p = evento.payload;

  const tituloMap: Record<string, string> = {
    "os.ordem_servico.criada": "Nova OS criada",
    "os.ordem_servico.finalizada": "OS finalizada",
    "escala.alocacao.aceita": "Motorista aceitou a corrida",
    "escala.alocacao.concluida": "Entrega concluída",
  };

  const mensagemMap: Record<string, string> = {
    "os.ordem_servico.criada": `OS ${p?.os_numero || ""} criada para ${p?.origem || ""} → ${p?.destino || ""}`,
    "os.ordem_servico.finalizada": `OS ${p?.os_numero || ""} finalizada`,
    "escala.alocacao.aceita": `${p?.prestador_nome || "Motorista"} aceitou a OS ${p?.os_numero || ""}`,
    "escala.alocacao.concluida": `Entrega ${p?.os_numero || ""} concluída por ${p?.prestador_nome || "Motorista"}`,
  };

  return {
    id: evento.id,
    titulo: tituloMap[evento.event_type] || "Evento",
    mensagem: mensagemMap[evento.event_type] || evento.event_type,
    tipo: evento.event_type,
    lida: false,
    created_at: evento.created_at,
  };
}
