import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface EntregaUpdate {
  id: string;
  status: string;
  sla: number;
  data_previsao?: string;
}

interface NotificacaoUpdate {
  id: string;
  titulo: string;
  tipo: string;
  created_at: string;
}

interface OcorrenciaUpdate {
  id: string;
  tipo: string;
  descricao: string;
  status: string;
  created_at: string;
}

interface UsePortalRealtimeOptions {
  onEntregaUpdate?: (entrega: EntregaUpdate) => void;
  onNotificacao?: (notificacao: NotificacaoUpdate) => void;
  onOcorrencia?: (ocorrencia: OcorrenciaUpdate) => void;
  enabled?: boolean;
  clienteId?: string;
}

export function usePortalRealtime(options: UsePortalRealtimeOptions = {}) {
  const { onEntregaUpdate, onNotificacao, onOcorrencia, enabled = true, clienteId } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (!enabled || !clienteId) return;

    const subscriptions: any[] = [];

    const setupSubscriptions = async () => {
      try {
        const ordensChannel = supabase
          .channel("portal-ordens-realtime")
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "ordens_servico",
              filter: `cliente_id=eq.${clienteId}`,
            },
            (payload) => {
              const entrega = payload.new as EntregaUpdate;
              onEntregaUpdate?.(entrega);
              setLastUpdate(new Date());
            }
          )
          .subscribe((status) => {
            if (status === "subscribed") setIsConnected(true);
          });

        subscriptions.push(ordensChannel);

        const notificacoesChannel = supabase
          .channel("portal-notificacoes-realtime")
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "notificacoes",
              filter: `cliente_id=eq.${clienteId}`,
            },
            (payload) => {
              const notificacao = payload.new as NotificacaoUpdate;
              onNotificacao?.(notificacao);
              setLastUpdate(new Date());
            }
          )
          .subscribe();

        subscriptions.push(notificacoesChannel);

        const ocurrenciasChannel = supabase
          .channel("portal-ocorrencias-realtime")
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "ocorrencias",
              filter: `cliente_id=eq.${clienteId}`,
            },
            (payload) => {
              const ocorrencia = payload.new as OcorrenciaUpdate;
              onOcorrencia?.(ocorrencia);
              setLastUpdate(new Date());
            }
          )
          .subscribe();

        subscriptions.push(ocurrenciasChannel);
      } catch {
        setIsConnected(false);
      }
    };

    setupSubscriptions();

    return () => {
      subscriptions.forEach((sub) => {
        if (sub) supabase.removeChannel(sub);
      });
    };
  }, [enabled, clienteId, onEntregaUpdate, onNotificacao, onOcorrencia]);

  return {
    isConnected,
    lastUpdate,
    reconnect: () => setIsConnected(false),
  };
}

export function useEntregaRealtime(
  entregaId: string | null,
  onUpdate?: (status: string, sla: number) => void,
  clienteId?: string
) {
  const [status, setStatus] = useState<string>("");
  const [sla, setSla] = useState<number>(100);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (!entregaId || !clienteId) return;

    const channel = supabase
      .channel(`entrega-${entregaId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ordens_servico",
          filter: `id=eq.${entregaId},cliente_id=eq.${clienteId}`,
        },
        (payload) => {
          const novaEntrega = payload.new as any;
          setStatus(novaEntrega.status || "");
          setSla(novaEntrega.sla || 100);
          onUpdate?.(novaEntrega.status, novaEntrega.sla);
          setIsLive(true);
          setTimeout(() => setIsLive(false), 2000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [entregaId, clienteId, onUpdate]);

  return { status, sla, isLive };
}

export function useNotificacoesRealtime(
  onNew?: (notificacao: NotificacaoUpdate) => void,
  clienteId?: string
) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!clienteId) return;

    const channel = supabase
      .channel("portal-notificacoes-live")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificacoes",
          filter: `cliente_id=eq.${clienteId}`,
        },
        (payload) => {
          const nova = payload.new as NotificacaoUpdate;
          setCount((prev) => prev + 1);
          onNew?.(nova);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clienteId, onNew]);

  const clearCount = useCallback(() => setCount(0), []);

  return { count, clearCount };
}