import { supabase } from "@/lib/supabase";

const DEDUP_WINDOW_MS = 5000;

export function gerarCorrelationId(
  eventType: string,
  entityType: string,
  entityId: string
): string {
  const raw = `${eventType}:${entityType}:${entityId}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const chr = raw.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return `${Math.abs(hash).toString(36)}`;
}

export async function verificarDuplicata(
  correlationId: string
): Promise<boolean> {
  const cincoMinAtras = new Date(
    Date.now() - DEDUP_WINDOW_MS
  ).toISOString();

  const { data } = await supabase
    .from("eventos_oficiais")
    .select("id")
    .eq("metadata->>correlation_id", correlationId)
    .gte("created_at", cincoMinAtras)
    .limit(1);

  return (data?.length ?? 0) > 0;
}

export function dedupPayload(
  eventType: string,
  entityType: string,
  entityId: string,
  payload: Record<string, any> = {}
): { payload: Record<string, any>; metadata: Record<string, any> } {
  const correlationId = gerarCorrelationId(eventType, entityType, entityId);
  return {
    payload,
    metadata: {
      correlation_id: correlationId,
      dedup_at: new Date().toISOString(),
    },
  };
}
