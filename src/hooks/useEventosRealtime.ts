import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { EventoOficial, EventType, EventVisibility } from "@/types/events";

interface UseEventosRealtimeOptions {
  eventTypes?: EventType[];
  visibility?: EventVisibility;
  entityType?: string;
  entityId?: string;
  limit?: number;
  enableRealtime?: boolean;
}

interface UseEventosRealtimeResult {
  eventos: EventoOficial[];
  loading: boolean;
  erro: string | null;
  refresh: () => Promise<void>;
  lastEvento: EventoOficial | null;
}

export function useEventosRealtime(
  options: UseEventosRealtimeOptions = {}
): UseEventosRealtimeResult {
  const {
    eventTypes,
    visibility,
    entityType,
    entityId,
    limit = 50,
    enableRealtime = true,
  } = options;

  const [eventos, setEventos] = useState<EventoOficial[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [lastEvento, setLastEvento] = useState<EventoOficial | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchEventos = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("eventos_oficiais")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(limit);

      if (eventTypes && eventTypes.length > 0) {
        if (eventTypes.length === 1) {
          query = query.eq("event_type", eventTypes[0]);
        } else {
          query = query.in("event_type", eventTypes);
        }
      }
      if (visibility) query = query.eq("visibility", visibility);
      if (entityType) query = query.eq("entity_type", entityType);
      if (entityId) query = query.eq("entity_id", entityId);

      const { data, error } = await query;

      if (error) {
        setErro(error.message);
      } else {
        setEventos((data || []) as EventoOficial[]);
        setErro(null);
      }
    } catch (err: any) {
      setErro(err.message || "Erro ao buscar eventos");
    } finally {
      setLoading(false);
    }
  }, [eventTypes?.join(","), visibility, entityType, entityId, limit]);

  useEffect(() => {
    fetchEventos();
  }, [fetchEventos]);

  useEffect(() => {
    if (!enableRealtime) return;

    const channel = supabase
      .channel("eventos_oficiais_realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "eventos_oficiais",
        },
        (payload) => {
          const novo = payload.new as EventoOficial;

          let matches = true;
          if (visibility && novo.visibility !== visibility) matches = false;
          if (entityType && novo.entity_type !== entityType) matches = false;
          if (entityId && novo.entity_id !== entityId) matches = false;
          if (eventTypes && eventTypes.length > 0 && !eventTypes.includes(novo.event_type as EventType))
            matches = false;

          if (matches) {
            setLastEvento(novo);
            setEventos((prev) => [novo, ...prev].slice(0, limit));
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enableRealtime, visibility, entityType, entityId, eventTypes?.join(","), limit]);

  return { eventos, loading, erro, refresh: fetchEventos, lastEvento };
}
