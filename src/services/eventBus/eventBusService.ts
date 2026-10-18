import { supabase } from "@/lib/supabase";
import type {
  EventoOficial,
  PublicarEventoParams,
  BuscarEventosParams,
  EventosResultado,
  EventoUnicoResultado,
  EventBusRetryResultado,
} from "@/types/events";
import { gerarCorrelationId } from "./dedup";

export async function publicarEvento(
  params: PublicarEventoParams
): Promise<EventoUnicoResultado> {
  try {
    const correlationId = gerarCorrelationId(
      params.event_type,
      params.entity_type,
      params.entity_id
    );

    const insertPayload: Record<string, any> = {
      event_type: params.event_type,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      entity_number: params.entity_number || null,
      status: params.status || "active",
      source: params.source || "service",
      created_by: params.created_by || null,
      visibility: params.visibility || "internal",
      payload: params.payload || {},
      metadata: {
        ...(params.metadata || {}),
        correlation_id: correlationId,
        published_at: new Date().toISOString(),
      },
    };

    const { data, error } = await supabase
      .from("eventos_oficiais")
      .insert([insertPayload])
      .select()
      .single();

    if (error) {
      console.error("[EventBus] Erro ao publicar evento:", error.message);
      return { sucesso: false, erro: error.message };
    }

    return { sucesso: true, dado: data as EventoOficial };
  } catch (err: any) {
    console.error("[EventBus] Exceção ao publicar evento:", err);
    return { sucesso: false, erro: err.message || "Erro desconhecido" };
  }
}

export async function buscarEventos(
  params: BuscarEventosParams = {}
): Promise<EventosResultado> {
  try {
    let query = supabase
      .from("eventos_oficiais")
      .select("*", { count: "exact" });

    if (params.event_types && params.event_types.length > 0) {
      const tipos = params.event_types.filter(Boolean);
      if (tipos.length === 1) {
        query = query.eq("event_type", tipos[0]);
      } else {
        query = query.in("event_type", tipos);
      }
    }

    if (params.entity_type) {
      query = query.eq("entity_type", params.entity_type);
    }
    if (params.entity_id) {
      query = query.eq("entity_id", params.entity_id);
    }
    if (params.tenant_id) {
      query = query.eq("tenant_id", params.tenant_id);
    }
    if (params.status) {
      query = query.eq("status", params.status);
    }
    if (params.source) {
      query = query.eq("source", params.source);
    }
    if (params.visibility) {
      query = query.eq("visibility", params.visibility);
    }
    if (params.dataInicio) {
      query = query.gte("created_at", params.dataInicio);
    }
    if (params.dataFim) {
      query = query.lte("created_at", params.dataFim + "T23:59:59");
    }

    const limit = params.limit || 50;
    const offset = params.offset || 0;

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("[EventBus] Erro ao buscar eventos:", error.message);
      return { sucesso: false, erro: error.message };
    }

    return {
      sucesso: true,
      dados: data as EventoOficial[],
      total: count || undefined,
    };
  } catch (err: any) {
    console.error("[EventBus] Exceção ao buscar eventos:", err);
    return { sucesso: false, erro: err.message || "Erro desconhecido" };
  }
}

export async function buscarTimeline(
  entityType: string,
  entityId: string,
  limit: number = 50
): Promise<EventosResultado> {
  return buscarEventos({
    entity_type: entityType,
    entity_id: entityId,
    limit,
  });
}

export async function buscarPorEntidade(
  entityType: string,
  entityId: string,
  eventTypes?: string[]
): Promise<EventosResultado> {
  return buscarEventos({
    entity_type: entityType,
    entity_id: entityId,
    event_types: eventTypes as any,
    limit: 100,
  });
}

export async function buscarPorPeriodo(
  dataInicio: string,
  dataFim: string,
  eventTypes?: string[]
): Promise<EventosResultado> {
  return buscarEventos({
    dataInicio,
    dataFim,
    event_types: eventTypes as any,
    limit: 200,
  });
}

export async function buscarPorTipo(
  eventType: string,
  limit: number = 50
): Promise<EventosResultado> {
  return buscarEventos({
    event_types: [eventType],
    limit,
  });
}

export async function registrarErro(
  eventoId: string,
  erro: string
): Promise<EventBusRetryResultado> {
  try {
    const { data, error } = await supabase
      .from("eventos_oficiais")
      .update({
        status: "erro",
        metadata: supabase.rpc("jsonb_set", {
          target: "metadata",
          path: ["erro"],
          value: JSON.stringify(erro),
        }) as any,
      })
      .eq("id", eventoId)
      .select()
      .single();

    if (error) {
      return { sucesso: false, erro: error.message };
    }

    return { sucesso: true, evento: data as EventoOficial };
  } catch (err: any) {
    return { sucesso: false, erro: err.message || "Erro desconhecido" };
  }
}

export async function registrarRetry(
  eventoId: string
): Promise<EventBusRetryResultado> {
  try {
    const { data: current, error: fetchError } = await supabase
      .from("eventos_oficiais")
      .select("retry_count, metadata")
      .eq("id", eventoId)
      .single();

    if (fetchError || !current) {
      return { sucesso: false, erro: fetchError?.message || "Evento não encontrado" };
    }

    const newRetry = (current.retry_count || 0) + 1;

    const { data, error } = await supabase
      .from("eventos_oficiais")
      .update({
        status: "active",
        retry_count: newRetry,
        metadata: {
          ...((current.metadata as Record<string, any>) || {}),
          retry_at: new Date().toISOString(),
          retry_count: newRetry,
        },
      })
      .eq("id", eventoId)
      .select()
      .single();

    if (error) {
      return { sucesso: false, erro: error.message };
    }

    return { sucesso: true, evento: data as EventoOficial };
  } catch (err: any) {
    return { sucesso: false, erro: err.message || "Erro desconhecido" };
  }
}
