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

export interface ComprovanteUpdate {
  id?: string;
  ordem_servico_id?: string | null;
  alocacao_id?: string | null;
  nome_recebedor?: string | null;
  created_at?: string;
  [key: string]: unknown;
}

export interface UsePortalRealtimeOptions {
  onEntregaUpdate?: (entrega: EntregaUpdate) => void;
  onNotificacao?: (notificacao: NotificacaoUpdate) => void;
  onOcorrencia?: (ocorrencia: OcorrenciaUpdate) => void;
  /** Disparado quando o App Flutter envia/atualiza um comprovante (POD). */
  onComprovanteUpdate?: (comprovante: ComprovanteUpdate) => void;
  enabled?: boolean;
  clienteId?: string;
}

export function usePortalRealtime(options: UsePortalRealtimeOptions = {}) {
  const {
    onEntregaUpdate,
    onNotificacao,
    onOcorrencia,
    onComprovanteUpdate,
    enabled = true,
    clienteId,
  } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (!enabled || !clienteId) return;

    const subscriptions: any[] = [];
    const topic = `portal-realtime-${clienteId}`;

    const setupSubscriptions = async () => {
      try {
        const channel = supabase
          .channel(topic)
          // 1) Status das OS
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "ordens_servico",
              filter: `cliente_id=eq.${clienteId}`,
            },
            (payload) => {
              onEntregaUpdate?.(payload.new as EntregaUpdate);
              setLastUpdate(new Date());
            },
          )
          // 2) Comprovantes (POD) enviados pelo App Flutter
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "entregas_protocolo",
            },
            (payload) => {
              onComprovanteUpdate?.(payload.new as ComprovanteUpdate);
              setLastUpdate(new Date());
            },
          )
          // 3) Ocorrências do portal
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "portal_ocorrencias",
              filter: `cliente_id=eq.${clienteId}`,
            },
            (payload) => {
              onOcorrencia?.(payload.new as OcorrenciaUpdate);
              setLastUpdate(new Date());
            },
          )
          // 4) Notificações do portal
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "portal_notificacoes",
              filter: `cliente_id=eq.${clienteId}`,
            },
            (payload) => {
              onNotificacao?.(payload.new as NotificacaoUpdate);
              setLastUpdate(new Date());
            },
          )
          .subscribe((status) => {
            if (status === "SUBSCRIBED") setIsConnected(true);
          });

        subscriptions.push(channel);
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
  }, [enabled, clienteId, onEntregaUpdate, onNotificacao, onOcorrencia, onComprovanteUpdate]);

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
  _onNew?: (notificacao: NotificacaoUpdate) => void,
  _clienteId?: string
) {
  const [count, setCount] = useState(0);
  const clearCount = useCallback(() => setCount(0), []);
  return { count, clearCount };
}
