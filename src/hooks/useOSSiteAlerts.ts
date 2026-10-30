// ============================================================
// Alertas de novas OS criadas pela Cotação Express.
//
// Fonte: ordens_servico com `carga.origem_cotacao`.
// - Realtime (INSERT) para aviso imediato;
// - Polling de 30s como fallback (garante entrega mesmo se o
//   Realtime estiver desabilitado para a tabela);
// - Toast persistente (não fecha sozinho) + badge no sino.
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  buscarOSSitePorId,
  listarOSSite,
  type OSSiteResumo,
} from "@/services/operacao/osSiteService";

export interface NotificacaoOSSite {
  id: string;
  osId: string;
  numero: string;
  clienteNome: string;
  mensagem: string;
  detalhe: string;
  agendada: boolean;
  agendamento: string;
  createdAt: string;
  tempo: string;
  lida: boolean;
}

interface Opcoes {
  onAbrirOS: (osId: string) => void;
  habilitado?: boolean;
}

const INTERVALO_POLLING_MS = 30_000;
const JANELA_RECENTE_MS = 15 * 60 * 1000;

const tempoRelativo = (iso: string): string => {
  const criado = new Date(iso).getTime();
  if (!Number.isFinite(criado)) return "";
  const minutos = Math.max(0, Math.floor((Date.now() - criado) / 60_000));
  if (minutos < 1) return "agora";
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas} h`;
  return `${Math.floor(horas / 24)} d`;
};

function montarNotificacao(os: OSSiteResumo, lida: boolean): NotificacaoOSSite {
  const mensagem = os.agendada
    ? `⚠️ CHAMADO AGENDADO - ${os.agendamento}`
    : `🚨 Nova OS de Cliente Recebida! (${os.clienteNome})`;

  return {
    id: `os-site-${os.id}`,
    osId: os.id,
    numero: os.numero,
    clienteNome: os.clienteNome,
    mensagem,
    detalhe: os.agendada
      ? `🚨 Nova OS de Cliente Recebida! (${os.clienteNome}) · OS ${os.numero}`
      : `OS ${os.numero} · ${os.clienteNome}`,
    agendada: os.agendada,
    agendamento: os.agendamento,
    createdAt: os.createdAt,
    tempo: tempoRelativo(os.createdAt),
    lida,
  };
}

export function useOSSiteAlerts({ onAbrirOS, habilitado = true }: Opcoes) {
  const [notificacoes, setNotificacoes] = useState<NotificacaoOSSite[]>([]);
  const vistosRef = useRef<Set<string>>(new Set());
  const inicializadoRef = useRef(false);
  const ultimoPollingRef = useRef<string | null>(null);
  const onAbrirRef = useRef(onAbrirOS);
  onAbrirRef.current = onAbrirOS;

  const registrar = useCallback((os: OSSiteResumo, notificar: boolean) => {
    if (!os.id || vistosRef.current.has(os.id)) return;
    vistosRef.current.add(os.id);

    const lida =
      !notificar && Date.now() - new Date(os.createdAt).getTime() > JANELA_RECENTE_MS;
    const notificacao = montarNotificacao(os, lida);
    setNotificacoes((prev) => [notificacao, ...prev].slice(0, 30));

    if (!notificar) return;

    const acao = {
      label: "Abrir OS",
      onClick: () => onAbrirRef.current(os.id),
    };
    const base = {
      id: notificacao.id,
      description: notificacao.detalhe,
      duration: Infinity,
      closeButton: true,
      action: acao,
      onClick: () => onAbrirRef.current(os.id),
    };

    if (os.agendada) {
      toast.warning(`⚠️ CHAMADO AGENDADO - ${os.agendamento}`, base);
    } else {
      toast.error(`🚨 Nova OS de Cliente Recebida! (${os.clienteNome})`, base);
    }
  }, []);

  const marcarLida = useCallback((id: string) => {
    setNotificacoes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, lida: true } : n)),
    );
  }, []);

  const marcarLidas = useCallback(() => {
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
  }, []);

  useEffect(() => {
    if (!habilitado) return;
    let ativo = true;

    const carregarInicial = async () => {
      const lista = await listarOSSite(30);
      if (!ativo) return;
      lista.forEach((os) => registrar(os, false));
      ultimoPollingRef.current = new Date(Date.now() - 60_000).toISOString();
      inicializadoRef.current = true;
    };

    const polling = async () => {
      if (!inicializadoRef.current) return;
      const desde = ultimoPollingRef.current || new Date(Date.now() - 120_000).toISOString();
      const lista = await listarOSSite(30, desde);
      if (!ativo) return;
      ultimoPollingRef.current = new Date().toISOString();
      lista.forEach((os) => registrar(os, true));
    };

    void carregarInicial();
    const timer = setInterval(() => void polling(), INTERVALO_POLLING_MS);

    const canal = supabase
      .channel("os-site-alertas")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ordens_servico" },
        (payload) => {
          const row = (payload.new || {}) as { id?: string; carga?: { origem_cotacao?: unknown } };
          if (!row.id || !row.carga?.origem_cotacao) return;
          void buscarOSSitePorId(String(row.id)).then((os) => {
            if (ativo && os) registrar(os, true);
          });
        },
      )
      .subscribe();

    return () => {
      ativo = false;
      clearInterval(timer);
      void supabase.removeChannel(canal);
    };
  }, [habilitado, registrar]);

  return {
    notificacoes,
    naoLidas: notificacoes.filter((n) => !n.lida).length,
    marcarLida,
    marcarLidas,
  };
}
