import { supabase } from "@/lib/supabase";
import { normalizarEvento, type EventoNormalizado } from "@/components/torre-controle/eventAdapter";

// ============================================================================
// A31-H — Tempos operacionais a partir dos eventos REAIS do App Motorista.
// Fonte única: eventos_oficiais (event_type do App). A Escala NÃO deve manter
// contabilização manual concorrente quando os eventos reais existirem.
// ============================================================================

export interface TemposOperacionaisReais {
  origem: "app_eventos";
  chegadaOrigem: string | null;
  inicioCarregamento: string | null;
  fimCarregamento: string | null;
  saidaRota: string | null;
  chegadaDestino: string | null;
  finalizacao: string | null;
  tempoAguardandoMin: number | null;
  tempoCarregamentoMin: number | null;
  tempoEmRotaMin: number | null;
  tempoTotalMin: number | null;
}

const LABEL_EVENTO: Record<string, string> = {
  arrived_pickup: "Chegou na coleta",
  loading_started: "Carregamento iniciado",
  loading_finished: "Carregamento finalizado",
  route_started: "Saiu em rota",
  arrived_delivery: "Chegou na entrega",
  operation_finished: "Serviço finalizado",
};

export function formatarDuracaoMin(min: number | null): string {
  if (min === null || isNaN(min) || min < 0) return "—";
  const hrs = Math.floor(min / 60);
  const mins = Math.round(min % 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins} min`;
}

export function derivarTemposDeEventos(eventos: EventoNormalizado[]): TemposOperacionaisReais {
  const ts = (ev?: EventoNormalizado): string | null => (ev?.occurredAt ? ev.occurredAt : null);

  const chegadaOrigem = eventos.find((e) => e.eventType === "arrived_pickup");
  const inicioCarregamento = eventos.find((e) => e.eventType === "loading_started");
  const fimCarregamento = eventos.find((e) => e.eventType === "loading_finished");
  const saidaRota = eventos.find((e) => e.eventType === "route_started");
  const chegadaDestino = eventos.find((e) => e.eventType === "arrived_delivery");
  const finalizacao = eventos.find((e) => e.eventType === "operation_finished");

  const diffMin = (t1: string | null, t2: string | null): number | null => {
    if (!t1 || !t2) return null;
    const d1 = new Date(t1).getTime();
    const d2 = new Date(t2).getTime();
    if (isNaN(d1) || isNaN(d2)) return null;
    return (d2 - d1) / 60000;
  };

  return {
    origem: "app_eventos",
    chegadaOrigem: ts(chegadaOrigem),
    inicioCarregamento: ts(inicioCarregamento),
    fimCarregamento: ts(fimCarregamento),
    saidaRota: ts(saidaRota),
    chegadaDestino: ts(chegadaDestino),
    finalizacao: ts(finalizacao),
    tempoAguardandoMin: diffMin(ts(chegadaOrigem), ts(inicioCarregamento)),
    tempoCarregamentoMin: diffMin(ts(inicioCarregamento), ts(fimCarregamento)),
    tempoEmRotaMin: diffMin(ts(saidaRota), ts(finalizacao) || ts(chegadaDestino)),
    tempoTotalMin: diffMin(ts(chegadaOrigem), ts(finalizacao)),
  };
}

/** Busca eventos reais do App para uma alocação (eventos_oficiais, entity_id = alocação). */
export async function buscarTemposReaisAlocacao(alocacaoId: string): Promise<TemposOperacionaisReais | null> {
  if (!alocacaoId) return null;
  try {
    const { data } = await supabase
      .from("eventos_oficiais")
      .select("id, event_type, entity_id, entity_number, payload, metadata, created_at, source")
      .eq("entity_id", alocacaoId)
      .eq("source", "app_motorista")
      .order("created_at", { ascending: true })
      .limit(100);

    if (!data || data.length === 0) return null;
    const eventos = (data as Record<string, unknown>[]).map((ev) => normalizarEvento(ev));
    return derivarTemposDeEventos(eventos);
  } catch {
    return null;
  }
}

export { LABEL_EVENTO };
