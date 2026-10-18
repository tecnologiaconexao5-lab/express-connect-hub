import { useState, useEffect, useRef, useMemo } from "react";
import {
  MapPin, Truck, AlertTriangle, AlertCircle, Clock, CheckCircle, FileX,
  ArrowRight, Activity, Wifi, WifiOff, Navigation, Package,
  DollarSign, ShieldAlert, RefreshCw, Play, MessageSquare, Inbox,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import MapboxMap, { MapLocation } from "@/components/MapboxMap";
import { useTheme } from "@/hooks/useTheme";
import { fromOSRow, OSRow } from "@/lib/dbMappers";
import {
  isOSConcluida,
  calcularRiscoOperacional,
  extrairCoordenadasOS,
  gerarAcoesPrioritarias,
  ActionItem,
  ComprovantePendente,
} from "@/lib/acoesPrioritarias";
import { useEventosRealtime } from "@/hooks/useEventosRealtime";
import { TrackingPosition, buscarUltimasPosicoes } from "@/services/rastreamento/trackingService";
import { buscarPodsPendentes } from "@/services/comprovantes/comprovantesService";
import { contarNaoLidasTorre, inscreverMensagensTorre } from "@/services/operacaoChatService";
import { ChatTorrePanel } from "@/components/torre-controle/ChatTorrePanel";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DetalhesOperacaoSheet } from "@/components/torre-controle/DetalhesOperacaoSheet";
import { APP_EVENT_TYPES, isAppEventType, eventTypeToLabel, eventTypeToCategory } from "@/components/torre-controle/eventAdapter";
import { computeGpsState, computeOperationalStatus, computeSlaState, montarMapaAlocacoesPorOS, resolverPosicaoMarcador, montarMarcadorGPS, montarMarcadorAlocacaoSemOS, type AlocacaoSemOS } from "@/components/torre-controle/markerAdapter";
import { buscarAlocacoesSemOS } from "@/services/rastreamento/trackingService";
import type { TipoEventoTimeline, TimelineEvent } from "@/components/torre-controle/types";
import { TIMELINE_LABELS, TIMELINE_ICONS, TIMELINE_COLORS, SEVERIDADE_BADGE } from "@/components/torre-controle/timelineVisuals";
import { ExecutiveKpis, KpiItem } from "@/components/torre-controle/ExecutiveKpis";
import { CentralAlertas, ResumoAlertas } from "@/components/torre-controle/CentralAlertas";
import { useAuth } from "@/contexts/AuthContext";
import { podeVerReceitaEMargem } from "@/lib/permissoes";

/**
 * REGRA OPERACIONAL — Torre de Controle.
 * A Torre só monitora OPERAÇÕES REAIS, ou seja, OS que já possuem prestador
 * vinculado. OS órfãs (sem prestador/motorista) NÃO entram na Torre: elas são
 * tratadas na Listagem de Ordens de Serviço (alertas + ações de alocação).
 */
function temPrestadorVinculado(item: OSRow): boolean {
  const prestadorUuid = (item.prestador || "").trim();
  const prestadorIdRaw = (item as any).prestador_id;
  const prestadorId = prestadorIdRaw != null ? String(prestadorIdRaw).trim() : "";
  return prestadorUuid !== "" || prestadorId !== "";
}

interface OSRecord {
  id: string;
  numero: string;
  cliente: string;
  unidade: string;
  prestador: string;
  status: string;
  previsaoTermino: string;
  created_at?: string;
  updated_at?: string;
  enderecos?: any[];
  localizacaoEntregaJson?: any;
}

const SEVERIDADE_CRITICA = ["alta", "critica", "crítica", "Altíssima"];

const isOcorrenciaCritica = (severidade: string | undefined | null): boolean => {
  if (!severidade) return false;
  return SEVERIDADE_CRITICA.includes(severidade.toLowerCase());
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (valor: string | null | undefined): boolean =>
  !!valor && UUID_REGEX.test(valor);

const timeAgo = (timestamp: string): string => {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h${diffMin % 60}min`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD}d`;
  return new Date(timestamp).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

interface FiltrosMapaProps {
  mapFilter: string;
  markers: MapLocation[];
  semCoordenadas: any[];
  onFilterChange: (key: string) => void;
}

const FiltrosMapa = ({ mapFilter, markers, semCoordenadas, onFilterChange }: FiltrosMapaProps) => {
  const filtros = [
    { key: "todas", label: "Todas", count: markers.length, color: "bg-slate-500" },
    { key: "em_rota", label: "Em Rota", count: markers.filter(m => m.status === "em_rota" || m.status === "em_coleta" || m.status === "em_entrega").length, color: "bg-green-500" },
    { key: "gps_ativo", label: "GPS Ativo", count: markers.filter(m => m.gpsState === "atualizado").length, color: "bg-emerald-500" },
    { key: "parados", label: "Parados", count: markers.filter(m => m.status === "parado").length, color: "bg-amber-500" },
    { key: "gps_antigo", label: "GPS Antigo", count: markers.filter(m => m.gpsState === "antigo" || m.gpsState === "muito_antigo").length, color: "bg-orange-500" },
    { key: "sem_gps", label: "Sem GPS", count: markers.filter(m => m.gpsState === "indisponivel").length, color: "bg-red-500" },
    { key: "atrasadas", label: "Atrasadas", count: markers.filter(m => m.sla === "atrasado").length, color: "bg-rose-600" },
    { key: "ocorrencias", label: "Ocorrências", count: markers.filter(m => m.status === "ocorrencia").length, color: "bg-red-600" },
    { key: "concluidas", label: "Concluídas", count: markers.filter(m => m.status === "concluida").length, color: "bg-blue-500" },
  ];
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {filtros.map(f => (
        <button
          key={f.key}
          onClick={() => onFilterChange(f.key)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
            mapFilter === f.key
              ? "bg-indigo-600 text-white shadow-md"
              : "bg-card border border-border text-muted-foreground hover:border-indigo-300 hover:text-indigo-600"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${f.color}`} />
          {f.label}
          <span className={`ml-0.5 text-[9px] ${mapFilter === f.key ? "text-white/80" : "text-muted-foreground"}`}>
            ({f.count})
          </span>
        </button>
      ))}
      {semCoordenadas.length > 0 && (
        <span className="text-[10px] text-muted-foreground ml-2">
          {semCoordenadas.length} OS sem coordenadas
        </span>
      )}
    </div>
  );
};

const TorreControle = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  // UPGRADE-REGRAS: valores financeiros (Valor Operacional) restritos a admin máximo
  const { user } = useAuth();
  const verReceitaMargem = podeVerReceitaEMargem(user?.role);
  const [osAtivas, setOsAtivas] = useState<OSRecord[]>([]);
  const [ocorrencias, setOcorrencias] = useState<any[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [comprovantesPendentes, setComprovantesPendentes] = useState<ComprovantePendente[]>([]);
  const [nomeClienteMap, setNomeClienteMap] = useState<Record<string, string>>({});
  const [nomePrestadorMap, setNomePrestadorMap] = useState<Record<string, string>>({});
  const [selectedActionOsId, setSelectedActionOsId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [chatSheetOpen, setChatSheetOpen] = useState(false);
  const [mensagensNaoLidas, setMensagensNaoLidas] = useState(0);
  const [trackingPositions, setTrackingPositions] = useState<Record<string, TrackingPosition>>({});
  const [alocacoesSemOS, setAlocacoesSemOS] = useState<AlocacaoSemOS[]>([]);
  const [lastUpdateAt, setLastUpdateAt] = useState<string>(new Date().toISOString());
  const [stats, setStats] = useState({
    emRota: 0, aguardandoAceite: 0, comOcorrencia: 0, atrasadas: 0, concluidasHoje: 0, semComprovante: 0,
    emRisco: 0, semPrevisao: 0, ocorrenciasCriticas: 0
  });

  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);
  const nomesCarregadosRef = useRef("");

  // Reuso do hook realtime existente — aciona refresh da timeline quando o Event Bus recebe INSERT
  const { lastEvento } = useEventosRealtime({ limit: 1, enableRealtime: true });

  useEffect(() => {
    fetchData();
    carregarPosicoesExistentes();
    carregarAlocacoesSemOS();

    const osChannel = supabase
      .channel("torre-realtime-os")
      .on("postgres_changes", { event: "*", schema: "public", table: "ordens_servico" }, () => fetchData())
      .subscribe();

    const ocChannel = supabase
      .channel("torre-realtime-ocorrencias")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ocorrencias" }, () => {
        fetchOcorrencias();
        fetchTimeline();
      })
      .subscribe();

    const alocChannel = supabase
      .channel("torre-realtime-alocacoes")
      .on("postgres_changes", { event: "*", schema: "public", table: "alocacoes_escala" }, () => {
        fetchData();
        carregarAlocacoesSemOS();
        fetchTimeline();
      })
      .subscribe();

    const escChannel = supabase
      .channel("torre-realtime-escalonamentos")
      .on("postgres_changes", { event: "*", schema: "public", table: "escalonamentos_humanos" }, () => fetchTimeline())
      .subscribe();

    const trackingChannel = supabase
      .channel("torre-realtime-tracking")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "portal_tracking_realtime",
      }, (payload) => {
        if (payload.new) {
          const pos = payload.new as TrackingPosition;
          setTrackingPositions(prev => ({
            ...prev,
            [pos.alocacao_id!]: pos,
          }));
          // MISSÃO A25-D: nova posição pode pertencer a uma alocação sem OS —
          // garante que a alocação esteja na coleção Grupo 2.
          carregarAlocacoesSemOS();
        }
      })
      .subscribe();

    channelsRef.current = [osChannel, ocChannel, alocChannel, escChannel, trackingChannel];

    return () => {
      channelsRef.current.forEach((ch) => ch.unsubscribe());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!lastEvento) return;
    fetchTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEvento]);

  // MISSÃO A24 — contador de mensagens não lidas (chat A22) visível na Torre
  useEffect(() => {
    let ativo = true;
    const refrescar = async () => {
      if (!ativo) return;
      const total = await contarNaoLidasTorre();
      setMensagensNaoLidas(total);
    };
    refrescar();
    const cleanup = inscreverMensagensTorre(() => refrescar());
    const interval = setInterval(refrescar, 30000);
    return () => {
      ativo = false;
      cleanup();
      clearInterval(interval);
    };
  }, []);

  const carregarPosicoesExistentes = async () => {
    const posicoes = await buscarUltimasPosicoes();
    if (posicoes.length === 0) return;
    const map: Record<string, TrackingPosition> = {};
    for (const p of posicoes) {
      const key = p.alocacao_id || p.os_id || p.prestador_id || "";
      if (key) map[key] = p;
    }
    setTrackingPositions(prev => ({ ...prev, ...map }));
  };

  // MISSÃO A25-D — alocações ativas sem OS (Grupo 2 do mapa)
  const carregarAlocacoesSemOS = async () => {
    const lista = await buscarAlocacoesSemOS(50);
    setAlocacoesSemOS(lista);
  };

  const nomeCliente = (id?: string | null): string => {
    if (!id || id === "—") return "—";
    return nomeClienteMap[id] || id;
  };

  const nomePrestador = (id?: string | null): string => {
    if (!id || id === "—") return "—";
    return nomePrestadorMap[id] || id;
  };

  const carregarNomes = async (osLista: OSRecord[]) => {
    const clienteIds = Array.from(new Set(osLista.map(o => o.cliente).filter(isUuid)));
    const prestadorIds = Array.from(new Set(osLista.map(o => o.prestador).filter(isUuid)));
    const sig = [...clienteIds].sort().join(",") + "|" + [...prestadorIds].sort().join(",");
    if (sig === nomesCarregadosRef.current) return;
    nomesCarregadosRef.current = sig;

    const [cliRes, presRes] = await Promise.all([
      clienteIds.length > 0
        ? supabase.from("clientes").select("id, nome_fantasia, razao_social").in("id", clienteIds)
        : Promise.resolve({ data: [] as any[] }),
      prestadorIds.length > 0
        ? supabase.from("prestadores").select("id, nome_completo").in("id", prestadorIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const cliMap: Record<string, string> = {};
    for (const c of (cliRes.data || []) as any[]) {
      cliMap[c.id] = c.nome_fantasia || c.razao_social || c.id;
    }
    const presMap: Record<string, string> = {};
    for (const p of (presRes.data || []) as any[]) {
      presMap[p.id] = p.nome_completo || p.id;
    }
    setNomeClienteMap(cliMap);
    setNomePrestadorMap(presMap);
  };

  const fetchOcorrencias = async () => {
    try {
      const { data, error } = await supabase
        .from("ocorrencias")
        .select("*, ordens_servico(id, numero, cliente, prestador)")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      setOcorrencias(data || []);
    } catch (e) {
      console.error("Erro ao buscar ocorrências:", e);
      setOcorrencias([]);
    }
  };

  const fetchData = async () => {
    try {
      // REGRA OPERACIONAL: a Torre só monitora operações reais (OS com prestador).
      // A exclusão das órfãs é feita AQUI, no próprio Supabase, ANTES do limit(50) —
      // caso contrário as OS órfãs consumiriam a janela de 50 e truncariam operações reais.
      const { data: osData, error } = await supabase
        .from("ordens_servico")
        .select("*")
        .or("prestador.not.is.null,prestador_id.not.is.null")
        .order("numero", { ascending: false })
        .limit(50);
      
      if (error) {
        if (error.code === "42P01") {
          setOsAtivas([]);
          return;
        }
        throw error;
      }
      
      // Guarda final no cliente (cobre edge cases como prestador_id = "" que o PostgREST
      // não distingue de NULL). O corte de órfãs já ocorreu no servidor, portanto não há truncamento.
      const listaOS = osData ? (osData as OSRow[])
        .filter(temPrestadorVinculado)
        .map((item) => ({
          ...fromOSRow(item),
          created_at: item.created_at,
          updated_at: item.updated_at,
          enderecos: (item as any).enderecos,
          localizacaoEntregaJson: (item as any).localizacao_entrega_json,
        })) : [];
      setOsAtivas(listaOS as OSRecord[]);

      carregarNomes(listaOS as OSRecord[]);
      fetchOcorrencias();
      fetchTimeline();

      const today = new Date().toISOString().slice(0, 10);

      // MISSÃO A23-B: POD pendente = operação concluída/finalizada SEM POD real
      // em entregas_protocolo (fonte oficial). NÃO usa comprovante_url da alocação.
      // aceita/em_rota não são tratadas como comprovante atrasado.
      const { total: totalSemComprovante, itens: podsPendentes } = await buscarPodsPendentes();

      const comprovDetalhados: ComprovantePendente[] = podsPendentes
        .filter((p) => p.osId)
        .map((p) => ({
          id: p.id,
          osId: p.osId || p.id,
          osNumero: p.osNumero || p.osId || "—",
          cliente: p.cliente || "—",
          prestador: p.prestador || "—",
        }));

      setComprovantesPendentes(comprovDetalhados);

      const { data: alocStats } = await supabase
        .from("alocacoes_escala")
        .select("status, finalizada, data_finalizacao")
        .not("status", "in", '("cancelada","recusada")');

      const hoje = today;
      const emRotaAloc = (alocStats || []).filter((a: any) => a.status === "em_rota").length;
      const agAceiteAloc = (alocStats || []).filter((a: any) => a.status === "aguardando_aceite").length;
      const ocorrAloc = (alocStats || []).filter((a: any) => a.status === "ocorrencia").length;
      const concluidasHojeAloc = (alocStats || []).filter((a: any) =>
        a.status === "concluida" && a.data_finalizacao?.startsWith(hoje)
      ).length;

      setStats({
        emRota: emRotaAloc || listaOS.filter(o => o.status === "saiu para rota" || o.status === "em operacao").length,
        aguardandoAceite: agAceiteAloc || listaOS.filter(o => o.status === "aguardando parceiro").length,
        comOcorrencia: ocorrAloc || listaOS.filter(o => o.status === "com ocorrencia").length,
        atrasadas: listaOS.filter(o => isOSAtrasada(o.previsaoTermino, o.status)).length || 0,
        concluidasHoje: concluidasHojeAloc || listaOS.filter(o => o.status === "finalizada").length,
        semComprovante: totalSemComprovante ?? 0,
        emRisco: listaOS.filter(o => calcularRiscoOperacional(o.previsaoTermino, o.status)).length || 0,
        semPrevisao: listaOS.filter(o => !o.previsaoTermino && !isOSConcluida(o.status)).length || 0,
        ocorrenciasCriticas: 0,
      });

      setLastUpdateAt(new Date().toISOString());
    } catch (e) {
      console.error(e);
    }
  };

  const isOSAtrasada = (previsaoTermino: string | undefined | null, status: string): boolean => {
    if (!previsaoTermino || isOSConcluida(status)) return false;
    return new Date(previsaoTermino).getTime() < Date.now();
  };

  const fetchTimeline = async () => {
    setTimelineLoading(true);
    try {
      const events: TimelineEvent[] = [];

      // M104: Event Bus como fonte PRIMÁRIA de eventos operacionais
      const { data: eventosOficiais } = await supabase
        .from("eventos_oficiais")
        .select("id, event_type, entity_type, entity_id, entity_number, status, source, created_by, visibility, payload, metadata, created_at, processed_at, version, retry_count")
        .in("event_type", [
          "os.ordem_servico.criada",
          "os.ordem_servico.finalizada",
          "os.ordem_servico.cancelada",
          "os.ordem_servico.status_changed",
          "escala.alocacao.aceita",
          "escala.alocacao.concluida",
          "escala.alocacao.cancelada",
          "escala.alocacao.recusada",
          "escala.alocacao.criada",
          "entrega.comprovante.pod_enviado",
          "portal.ocorrencia.aberta",
          ...APP_EVENT_TYPES,
        ])
        .order("created_at", { ascending: false })
        .limit(100);

      if (eventosOficiais) {
        for (const ev of eventosOficiais as any[]) {
          const p = ev.payload || {};
          const m = ev.metadata || {};
          const isApp = isAppEventType(ev.event_type);
          const cat = eventTypeToCategory(ev.event_type);

          const tipoMap: Record<string, TipoEventoTimeline> = {
            "os.ordem_servico.criada": "os_criada",
            "os.ordem_servico.finalizada": "os_concluida",
            "os.ordem_servico.cancelada": "os_atrasada",
            "os.ordem_servico.status_changed": "os_em_rota",
            "escala.alocacao.aceita": "os_em_rota",
            "escala.alocacao.concluida": "alocacao_concluida",
            "escala.alocacao.cancelada": "os_atrasada",
            "escala.alocacao.recusada": "os_atrasada",
            "escala.alocacao.criada": "os_criada",
            "entrega.comprovante.pod_enviado": "alocacao_concluida",
            "portal.ocorrencia.aberta": "ocorrencia_aberta",
          };

          let tipo: TipoEventoTimeline;
          let sev: "baixa" | "media" | "alta" | "critica";

          if (tipoMap[ev.event_type]) {
            tipo = tipoMap[ev.event_type];
            sev = ev.event_type.includes("cancelada") || ev.event_type.includes("recusada")
              ? "alta" : ev.event_type.includes("aberta")
              ? "critica" : "baixa";
          } else if (isApp) {
            sev = "baixa";
            switch (cat) {
              case "aceite": tipo = "app_aceite"; break;
              case "chegada": tipo = "app_chegada"; break;
              case "coleta": tipo = "app_coleta"; break;
              case "deslocamento": tipo = "app_deslocamento"; break;
              case "entrega": tipo = "app_entrega"; break;
              case "finalizacao": tipo = "app_finalizacao"; break;
              case "evidencia": tipo = "app_evidencia"; break;
              case "assinatura": tipo = "app_assinatura"; break;
              case "documento": tipo = "app_documento"; break;
              case "gps": tipo = "app_gps"; break;
              case "ocorrencia": tipo = "ocorrencia_aberta"; sev = "critica"; break;
              case "insucesso": tipo = "os_atrasada"; sev = "alta"; break;
              default: tipo = "app_generico";
            }
          } else {
            tipo = "app_generico";
            sev = "baixa";
          }

          const descricao = isApp
            ? `[App] ${eventTypeToLabel(ev.event_type)}`
            : `[Event Bus] ${ev.event_type.replace(/\./g, " ")} — ${p.cliente_nome || p.os_numero || "—"}`;

          events.push({
            id: `eb-${ev.id}`,
            timestamp: ev.created_at,
            tipoEvento: tipo,
            severidade: sev,
            cliente: p.cliente_nome || p.cliente_id || m.cliente_nome || "—",
            prestador: p.prestador_nome || p.prestador_id || m.prestador_nome || "—",
            os: p.os_numero || ev.entity_number || m.os_numero || "—",
            descricao,
            source: isApp ? "app_motorista" : (ev.source || "tms"),
            stage: p.etapa || m.etapa || null,
          });
        }
      }

      // M104: Fontes complementares — eventos que ainda não têm trigger no Event Bus
      const { data: ocData } = await supabase
        .from("ocorrencias")
        .select("id, created_at, tipo, severidade, ordens_servico(numero, cliente, prestador)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (ocData) {
        for (const oc of ocData as any[]) {
          const osRef = oc.ordens_servico;
          events.push({
            id: `oc-${oc.id}`,
            timestamp: oc.created_at,
            tipoEvento: "ocorrencia_aberta",
            severidade: isOcorrenciaCritica(oc.severidade) ? "critica" : "alta",
            cliente: osRef?.cliente || "—",
            prestador: osRef?.prestador || "—",
            os: osRef?.numero || "—",
            descricao: oc.tipo ? `Ocorrência: ${oc.tipo}` : "Ocorrência aberta na operação",
          });
        }
      }

      const { data: escData } = await supabase
        .from("escalonamentos_humanos")
        .select("id, titulo, descricao, prioridade, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (escData) {
        for (const esc of escData as any[]) {
          events.push({
            id: `alerta-${esc.id}`,
            timestamp: esc.created_at,
            tipoEvento: "alerta_humano",
            severidade: esc.prioridade === "critica" ? "critica" : esc.prioridade === "alta" ? "alta" : "media",
            cliente: "—",
            prestador: "—",
            os: "—",
            descricao: esc.titulo || "Alerta humano criado",
          });
        }
      }

      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setTimelineEvents(events.slice(0, 100));
    } catch (e) {
      console.error("Erro ao carregar timeline:", e);
    } finally {
      setTimelineLoading(false);
    }
  };

  const APP_EVENT_LABELS_FALLBACK: Record<string, string> = {
    viagem_aceita: "Viagem aceita",
    cheguei_coleta: "Chegou na coleta",
    carregamento_iniciado: "Carregamento",
    carregamento_finalizado: "Carregamento finalizado",
    romaneio_informado: "Romaneio",
    foto_romaneio: "Foto romaneio",
    km_inicial_informado: "KM inicial",
    saiu_em_rota: "Saiu em rota",
    chegou_entrega: "Chegou na entrega",
    descarregamento_iniciado: "Descarga iniciada",
    descarga_finalizada: "Descarga finalizada",
    km_final_informado: "KM final",
    assinatura_capturada: "Assinatura",
    pod_registrado: "POD",
    servico_finalizado: "Finalizado",
  };

  const [mapFilter, setMapFilter] = useState<string>("todas");

  const semCoordenadas = useMemo(
    () => osAtivas.filter(os => !extrairCoordenadasOS(os)),
    [osAtivas]
  );

  const osAtivasResolvidas = useMemo(
    () => osAtivas.map(os => ({
      ...os,
      cliente: nomeCliente(os.cliente),
      prestador: nomePrestador(os.prestador),
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [osAtivas, nomeClienteMap, nomePrestadorMap]
  );

  const markers = useMemo(
    () => {
      const posicoes = Object.values(trackingPositions);
      // MISSÃO A25-B: match por alocacao_id (primário) e os_id (complementar)
      const alocacoesPorOS = montarMapaAlocacoesPorOS(posicoes);

      // GRUPO 1 — OS reais ativas
      const marcadoresOS: MapLocation[] = osAtivasResolvidas
        .map((os): MapLocation | null => {
          const coords = extrairCoordenadasOS(os);
          const posicaoAoVivo = resolverPosicaoMarcador(os.id, posicoes, alocacoesPorOS);

          // GPS REAL TEM PRIORIDADE sobre coordenada estática da OS.
          // Se não houver GPS e nem coords na OS → sem marcador.
          const marcador = montarMarcadorGPS(
            coords,
            posicaoAoVivo || null,
            (os as any).alocStatus || os.status
          );
          if (!marcador) return null;

          const hasOcorrencia = os.status === "com ocorrencia";
          const etapaApp = (os as any).etapaApp || null;
          const alocStatus = (os as any).alocStatus || os.status;

          const operationalStatus = computeOperationalStatus(alocStatus, etapaApp, hasOcorrencia);

          const slaState = computeSlaState(os.previsaoTermino, os.status);

          let mapStatus: MapLocation["status"] = "aguardando";
          if (operationalStatus === "em_deslocamento") mapStatus = "em_rota";
          else if (operationalStatus === "em_coleta") mapStatus = "em_coleta";
          else if (operationalStatus === "em_entrega") mapStatus = "em_entrega";
          else if (operationalStatus === "parado") mapStatus = "parado";
          else if (operationalStatus === "com_ocorrencia") mapStatus = "ocorrencia";
          else if (operationalStatus === "aguardando_aceite") mapStatus = "aguardando";
          else if (operationalStatus === "finalizado") mapStatus = "concluida";

          return {
            id: os.id,
            numero: os.numero || os.id,
            latitude: marcador.lat,
            longitude: marcador.lng,
            status: mapStatus as MapLocation["status"],
            cliente: os.cliente || "—",
            prestador: os.prestador || "—",
            previsao: os.previsaoTermino,
            sla: slaState === "atrasado" ? "atrasado" : undefined,
            vehicleType: (os as any).veiculoTipo || null,
            plate: (os as any).placa || null,
            driverName: os.prestador || null,
            gpsState: marcador.gpsState,
            speed: marcador.posicao?.velocidade || null,
            accuracy: marcador.posicao?.precisao || null,
            bateria: marcador.posicao?.bateria ?? undefined,
            lastLocationAt: marcador.posicao?.captured_at || marcador.posicao?.created_at || null,
            osNumero: os.numero || null,
            currentStage: etapaApp ? APP_EVENT_LABELS_FALLBACK[etapaApp] || etapaApp : null,
            origin: (os as any).origem || null,
            destination: (os as any).destino || null,
          };
        })
        .filter((m): m is NonNullable<typeof m> => m !== null);

      // GRUPO 2 — alocações ativas sem OS com tracking recente (A25-D)
      // Não duplicar: se a alocação já é representada por uma OS real, pula.
      const osIdsPresentes = new Set(marcadoresOS.map((m) => m.id));
      const alocacoesComOS = new Set(
        osAtivasResolvidas
          .map((os) => (os as any).alocacaoIds || [])
          .flat()
          .filter(Boolean) as string[]
      );

      const marcadoresAlocSemOS: MapLocation[] = alocacoesSemOS
        .map((aloc): MapLocation | null => {
          // Dedup: evita representar a mesma operação duas vezes
          if (alocacoesComOS.has(aloc.id) || osIdsPresentes.has(`aloc-${aloc.id}`)) return null;
          const posicao = resolverPosicaoMarcador(aloc.id, posicoes);
          const marcador = montarMarcadorAlocacaoSemOS(aloc, posicao || null);
          if (!marcador) return null;
          return marcador as MapLocation;
        })
        .filter((m): m is NonNullable<typeof m> => m !== null);

      return [...marcadoresOS, ...marcadoresAlocSemOS];
    },
    [osAtivasResolvidas, trackingPositions, alocacoesSemOS]
  );

  const filteredMarkers = useMemo(
    () => markers.filter(m => {
      if (mapFilter === "todas") return true;
      if (mapFilter === "em_rota") return m.status === "em_rota" || m.status === "em_coleta" || m.status === "em_entrega";
      if (mapFilter === "atrasadas") return m.sla === "atrasado";
      if (mapFilter === "ocorrencias") return m.status === "ocorrencia";
      if (mapFilter === "concluidas") return m.status === "concluida";
      if (mapFilter === "gps_ativo") return m.gpsState === "atualizado";
      if (mapFilter === "gps_antigo") return m.gpsState === "antigo" || m.gpsState === "muito_antigo";
      if (mapFilter === "sem_gps") return m.gpsState === "indisponivel";
      if (mapFilter === "parados") return m.status === "parado";
      return true;
    }),
    [markers, mapFilter]
  );

  const mapCounters = useMemo(() => ({
    total: markers.length,
    gpsAtivo: markers.filter(m => m.gpsState === "atualizado").length,
    gpsAntigo: markers.filter(m => m.gpsState === "antigo" || m.gpsState === "muito_antigo").length,
    semGps: markers.filter(m => m.gpsState === "indisponivel").length,
    comOcorrencia: markers.filter(m => m.status === "ocorrencia").length,
    atrasadas: markers.filter(m => m.sla === "atrasado").length,
    parados: markers.filter(m => m.status === "parado").length,
  }), [markers]);

  const comprovantesPendentesResolvidos = useMemo<ComprovantePendente[]>(
    () => comprovantesPendentes.map(cp => ({
      ...cp,
      cliente: nomeCliente(cp.cliente),
      prestador: nomePrestador(cp.prestador),
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [comprovantesPendentes, nomeClienteMap, nomePrestadorMap]
  );

  const acoesPrioritarias: ActionItem[] = useMemo(
    () => gerarAcoesPrioritarias(osAtivasResolvidas, stats.semComprovante, comprovantesPendentesResolvidos),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [osAtivasResolvidas, stats.semComprovante, comprovantesPendentesResolvidos]
  );

  const selectedActionItem = useMemo(
    () => acoesPrioritarias.find(a => a.osId === selectedActionOsId) ?? null,
    [acoesPrioritarias, selectedActionOsId]
  );

  const resumoAlertas = useMemo<ResumoAlertas>(() => ({
    atrasadas: stats.atrasadas,
    emRisco: stats.emRisco,
    ocorrencias: stats.comOcorrencia,
    pendencias: stats.semComprovante,
    criticas: ocorrencias.filter(o => isOcorrenciaCritica(o.severidade)).length,
  }), [stats, ocorrencias]);

  const executiveKpis = useMemo<KpiItem[]>(() => {
    const ativas = osAtivas.filter(o => !isOSConcluida(o.status)).length;
    const emRota = markers.filter(m => m.status === "em_rota").length;
    const emColeta = markers.filter(m => m.status === "em_coleta").length;
    const emEntrega = markers.filter(m => m.status === "em_entrega").length;
    const parados = mapCounters.parados;
    const motoristasOnline = mapCounters.gpsAtivo;
    const gpsOffline = mapCounters.gpsAntigo + mapCounters.semGps;
    const slaEmRisco = stats.emRisco;
    const ocorrenciasKpi = stats.comOcorrencia;
    const pendenciasKpi = stats.semComprovante;
    const concluidasHoje = stats.concluidasHoje;
    const valorOperacional = osAtivas
      .filter(o => !isOSConcluida(o.status))
      .reduce((acc, o) => acc + (Number((o as any).valorCliente) || 0), 0);

    return [
      { key: "ativas", label: "Operações Ativas", value: ativas, icon: Truck, tone: "indigo" as const },
      { key: "online", label: "Motoristas Online", value: motoristasOnline, icon: Wifi, tone: "emerald" as const },
      { key: "emRota", label: "Em Rota", value: emRota, icon: Navigation, tone: "emerald" as const },
      { key: "emColeta", label: "Em Coleta", value: emColeta, icon: Package, tone: "sky" as const },
      { key: "emEntrega", label: "Em Entrega", value: emEntrega, icon: MapPin, tone: "orange" as const },
      { key: "parados", label: "Parados", value: parados, icon: Clock, tone: "amber" as const },
      { key: "gpsOffline", label: "GPS Offline", value: gpsOffline, icon: WifiOff, tone: "red" as const },
      { key: "slaRisco", label: "SLA em Risco", value: slaEmRisco, sub: `${stats.atrasadas} atrasadas`, icon: AlertTriangle, tone: "orange" as const },
      { key: "ocorrencias", label: "Ocorrências", value: ocorrenciasKpi, icon: ShieldAlert, tone: "red" as const },
      { key: "pendencias", label: "PODs Pendentes", value: pendenciasKpi, sub: "entregas concluídas sem POD", icon: FileX, tone: "purple" as const, onClick: () => navigate("/comprovantes") },
      { key: "concluidas", label: "Concluídas Hoje", value: concluidasHoje, icon: CheckCircle, tone: "blue" as const },
      // UPGRADE-REGRAS: soma dos valores de receita (valorCliente) oculta para não-admin
      { key: "valor", label: "Valor Operacional", value: verReceitaMargem ? valorOperacional.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "---", sub: verReceitaMargem ? "OS ativas" : "acesso restrito", icon: DollarSign, tone: verReceitaMargem ? ("emerald" as const) : ("slate" as const) },
    ];
  }, [osAtivas, markers, mapCounters, stats, verReceitaMargem]);

  const timelineEventsResolvidos = useMemo(
    () => timelineEvents.map(e => ({
      ...e,
      cliente: e.cliente && e.cliente !== "—" ? nomeCliente(e.cliente) : "—",
      prestador: e.prestador && e.prestador !== "—" ? nomePrestador(e.prestador) : "—",
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timelineEvents, nomeClienteMap, nomePrestadorMap]
  );

  const contextualTimelineEvents = useMemo(
    () => selectedActionItem
      ? timelineEventsResolvidos.filter(e => e.os === selectedActionItem.os)
      : [],
    [selectedActionItem, timelineEventsResolvidos]
  );

  const selectedOSData = useMemo(
    () => osAtivasResolvidas.find(o => o.id === selectedActionOsId) ?? null,
    [osAtivasResolvidas, selectedActionOsId]
  );

  const selectedOSOcorrencia = useMemo(
    () => selectedActionItem
      ? ocorrencias.find((oc: any) => oc.ordens_servico?.numero === selectedActionItem.os) ?? null
      : null,
    [ocorrencias, selectedActionItem]
  );

  const selectedOSComprovante = useMemo(
    () => comprovantesPendentesResolvidos.find(c => c.osId === selectedActionOsId) ?? null,
    [comprovantesPendentesResolvidos, selectedActionOsId]
  );

  const handleTimelineClick = (event: TimelineEvent) => {
    if (!event.os || event.os === "—") return;
    const os = osAtivas.find(o => o.numero === event.os || o.id === event.os);
    if (os) {
      setSelectedActionOsId(os.id);
      setSheetOpen(true);
    }
  };

  const handleOcorrenciaClick = (oc: any) => {
    const osRef = oc?.ordens_servico;
    if (!osRef?.id) return;
    setSelectedActionOsId(osRef.id);
    setSheetOpen(true);
  };

  const ocorrenciasCriticas = ocorrencias.filter(o => isOcorrenciaCritica(o.severidade)).length;

  return (
    <div className="space-y-5 max-w-[1700px] mx-auto pb-8">
      {/* HEADER EXECUTIVO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-2xl xl:text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent flex items-center gap-3">
             <Activity className="w-7 h-7 xl:w-8 xl:h-8 text-blue-600" />
             Torre de Controle Operacional
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Centro de controle operacional — frota, rotas e ocorrências em tempo real.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wider gap-1.5">
            <RefreshCw className="w-3 h-3" /> Atualizado {timeAgo(lastUpdateAt)}
          </Badge>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card px-3 py-1.5 rounded-full border shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </span>
            Conexões ativas
          </div>
          <Button variant="outline" size="sm" className="gap-2 shadow-sm" onClick={() => fetchData()}>
            <RefreshCw className="w-4 h-4" /> Atualizar
          </Button>
          <Button
            variant={mensagensNaoLidas > 0 ? "default" : "outline"}
            size="sm"
            className="gap-2 shadow-sm relative"
            onClick={() => setChatSheetOpen(true)}
            title="Mensagens / Chat com Prestadores"
          >
            <Inbox className="w-4 h-4" /> Mensagens
            {mensagensNaoLidas > 0 && (
              <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 flex items-center justify-center text-[10px] font-bold text-white bg-[#F97316] rounded-full shadow">
                {mensagensNaoLidas > 99 ? "99+" : mensagensNaoLidas}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* DASHBOARD EXECUTIVO — 12 KPIs reais */}
      <ExecutiveKpis items={executiveKpis} />

      {/* CENTRO — MAPA PROTAGONISTA + CENTRAL DE ALERTAS + TIMELINE */}
      <div className="flex flex-col xl:flex-row gap-4 xl:h-[720px]">
        {/* ESQUERDA — MAPA */}
        <div className="xl:w-[68%] flex flex-col gap-2 xl:h-full min-h-[520px]">
          <FiltrosMapa
            mapFilter={mapFilter}
            markers={markers}
            semCoordenadas={semCoordenadas}
            onFilterChange={setMapFilter}
          />
          <div className="flex items-center gap-2 flex-wrap text-[10px]">
            <span className="text-muted-foreground font-semibold uppercase tracking-wider">Indicadores:</span>
            <Badge variant="outline" className="gap-1 text-[10px] border-emerald-300 text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />GPS Ativo: {mapCounters.gpsAtivo}
            </Badge>
            <Badge variant="outline" className="gap-1 text-[10px] border-orange-300 text-orange-700">
              <span className="w-2 h-2 rounded-full bg-orange-500" />GPS Antigo: {mapCounters.gpsAntigo}
            </Badge>
            <Badge variant="outline" className="gap-1 text-[10px] border-red-300 text-red-700">
              <span className="w-2 h-2 rounded-full bg-red-500" />Sem GPS: {mapCounters.semGps}
            </Badge>
            <Badge variant="outline" className="gap-1 text-[10px] border-amber-300 text-amber-700">
              <span className="w-2 h-2 rounded-full bg-amber-500" />Parados: {mapCounters.parados}
            </Badge>
            <Badge variant="outline" className="gap-1 text-[10px] border-rose-300 text-rose-700">
              <span className="w-2 h-2 rounded-full bg-rose-500" />Ocorrências: {mapCounters.comOcorrencia}
            </Badge>
            <Badge variant="outline" className="gap-1 text-[10px] border-slate-300 text-slate-600">
              Total: {mapCounters.total}
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-blue-800 dark:text-blue-200 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-lg px-3 py-1.5">
            <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="truncate">
              Rastreamento em tempo real ativado quando o prestador aceitar uma OS vinculada no App Conexão Express.
            </span>
          </div>

          <Card className="flex-1 flex flex-col overflow-hidden relative shadow-lg border-muted bg-card">
            <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-start pointer-events-none">
              <div className="pointer-events-auto flex gap-2">
                <Badge className="bg-background/90 text-foreground hover:bg-background border-border shadow-md backdrop-blur-md px-3 py-1 text-xs gap-1.5 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-blue-500" /> Visão Nacional
                </Badge>
                <Badge className="bg-indigo-600/90 text-white border-none shadow-md backdrop-blur-md px-3 py-1 text-xs gap-1.5 font-medium">
                  {filteredMarkers.length} de {markers.length} OS
                </Badge>
              </div>
              <div className="pointer-events-auto">
                 <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-lg px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold">
                   <Play className="w-3 h-3 fill-white" /> Rastreamento Automático
                 </Badge>
              </div>
            </div>

            <div className="flex-1 w-full h-full relative">
              <MapboxMap 
                locations={filteredMarkers}
                style={theme === "dark" ? "dark" : "light"}
                showControls={true}
                showClustering={true}
                title="Torre de Controle - Rastreamento"
                selectedLocationId={selectedActionOsId ?? undefined}
                onMarkerClick={() => setSelectedActionOsId(null)}
                onOpenDetails={(loc) => {
                  setSelectedActionOsId(loc.id);
                  setSheetOpen(true);
                }}
              />
            </div>
            {/* Status indicators of the map */}
            <div className="absolute bottom-4 left-4 z-10 pointer-events-auto flex gap-2">
              <div className="flex items-center gap-1.5 bg-background/90 backdrop-blur-md px-2.5 py-1.5 rounded-md border shadow-sm text-[10px] font-semibold">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div> No Prazo
              </div>
              <div className="flex items-center gap-1.5 bg-background/90 backdrop-blur-md px-2.5 py-1.5 rounded-md border shadow-sm text-[10px] font-semibold">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div> Atrasado
              </div>
            </div>
          </Card>
        </div>

        {/* DIREITA — CENTRAL DE ALERTAS + TIMELINE */}
        <div className="xl:w-[32%] flex flex-col gap-4 xl:h-full">
          <CentralAlertas
            itens={acoesPrioritarias}
            resumo={resumoAlertas}
            selectedOsId={selectedActionOsId}
            onSelect={(osId) => { setSelectedActionOsId(osId); setSheetOpen(true); }}
          />

          <Card className="flex-1 flex flex-col overflow-hidden shadow-lg border-muted min-h-[420px] xl:min-h-0">
            <CardHeader className="py-3 px-5 bg-card border-b shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-600" />
                  <CardTitle className="text-base">Timeline Operacional</CardTitle>
                </div>
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                  {timelineEvents.length} eventos
                </Badge>
              </div>
              <CardDescription className="text-xs mt-1">Clique em um evento para abrir a OS</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0 bg-muted/20 min-h-0">
              {timelineLoading && timelineEvents.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4 mr-2 animate-spin" /> Carregando...
                </div>
              ) : timelineEvents.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  Nenhum evento registrado
                </div>
              ) : (
                <div className="relative">
                  {/* Linha vertical conectando eventos */}
                  <div className="absolute left-[27px] top-0 bottom-0 w-[2px] bg-border/60"></div>
                  {timelineEventsResolvidos.map((event) => {
                    const cores = TIMELINE_COLORS[event.tipoEvento];
                    const Icone = TIMELINE_ICONS[event.tipoEvento];
                    const clicavel = event.os !== "—";
                    return (
                      <button
                        key={event.id}
                        onClick={() => handleTimelineClick(event)}
                        disabled={!clicavel}
                        className={`relative flex items-start gap-3 p-3 pl-5 w-full text-left transition-all duration-200 hover:bg-muted/30 ${cores.bg} ${
                          clicavel ? "cursor-pointer hover:ring-1 hover:ring-indigo-300" : "cursor-default"
                        }`}
                      >
                        {/* Bolinha conectora */}
                        <span className={`relative z-10 mt-0.5 w-[10px] h-[10px] rounded-full border-2 border-background shrink-0 ${cores.dot}`}></span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center justify-between mb-0.5">
                            <span className="flex items-center gap-1.5">
                              <Icone className={`w-3.5 h-3.5 ${cores.icon}`} />
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${cores.label}`}>
                                {TIMELINE_LABELS[event.tipoEvento]}
                              </span>
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono tabular-nums">{timeAgo(event.timestamp)}</span>
                          </span>
                          <span className="text-xs font-medium leading-tight truncate block">{event.descricao}</span>
                          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5 truncate">
                            {event.os !== "—" && <span className="font-semibold">{event.os}</span>}
                            {event.cliente !== "—" && <span>• {event.cliente}</span>}
                            {event.prestador !== "—" && <span>• {event.prestador}</span>}
                            {event.severidade === "critica" && (
                              <span className={`ml-auto text-[9px] font-bold uppercase px-1 py-0.5 rounded ${SEVERIDADE_BADGE.critica}`}>Crítico</span>
                            )}
                            {event.severidade === "alta" && (
                              <span className={`ml-auto text-[9px] font-bold uppercase px-1 py-0.5 rounded ${SEVERIDADE_BADGE.alta}`}>Alto</span>
                            )}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* PAINEL INFERIOR — OCORRÊNCIAS */}
      <Card className="shadow-md border-muted">
        <CardHeader className="py-4 px-6 border-b bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-500/10 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Painel de Ocorrências e Alertas</CardTitle>
                <CardDescription>Resolução prioritária necessária</CardDescription>
              </div>
              {ocorrenciasCriticas > 0 && (
                <Badge className="bg-red-600 text-white text-[10px] gap-1">
                  <AlertCircle className="w-3 h-3" /> {ocorrenciasCriticas} críticas
                </Badge>
              )}
            </div>
            <Button variant="outline" size="sm" className="gap-2 text-xs font-semibold" onClick={() => navigate("/operacao?tab=ocorrencias")}>Ver Todas <ArrowRight className="w-3.5 h-3.5"/></Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
           <Table>
             <TableHeader>
               <TableRow className="bg-muted/40 hover:bg-muted/40">
                 <TableHead className="py-3 px-6 text-xs font-semibold uppercase tracking-wider">Demanda</TableHead>
                 <TableHead className="py-3 text-xs font-semibold uppercase tracking-wider">Tipo de Evento</TableHead>
                 <TableHead className="py-3 text-xs font-semibold uppercase tracking-wider">Motorista/Prestador</TableHead>
                 <TableHead className="py-3 text-xs font-semibold uppercase tracking-wider">Tempo desde alerta</TableHead>
                 <TableHead className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-right">Ação/Status</TableHead>
               </TableRow>
             </TableHeader>
            <TableBody>
               {ocorrencias.map((oc, i) => {
                 const osRef = oc.ordens_servico;
                 const osNumero = osRef?.numero || "—";
                 const cliente = osRef?.cliente ? nomeCliente(osRef.cliente) : "—";
                 const prestador = osRef?.prestador ? nomePrestador(osRef.prestador) : "—";
                 const critica = isOcorrenciaCritica(oc.severidade);
                 const tempoDecorrido = oc.created_at
                   ? (() => {
                       const diffMin = Math.floor((Date.now() - new Date(oc.created_at).getTime()) / 60000);
                       if (diffMin < 60) return `${diffMin} min`;
                       const diffH = Math.floor(diffMin / 60);
                       if (diffH < 24) return `${diffH}h ${diffMin % 60}min`;
                       return `${Math.floor(diffH / 24)}d`;
                     })()
                   : "—";
                 return (
                   <TableRow
                     key={oc.id || i}
                     onClick={() => handleOcorrenciaClick(oc)}
                     className={`group hover:bg-muted/20 transition-colors ${osRef?.id ? "cursor-pointer" : ""}`}
                   >
                     <TableCell className="py-3 px-6">
                       <div className="font-bold text-sm">{osNumero}</div>
                       <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">{cliente}</div>
                     </TableCell>
                     <TableCell className="py-3 text-sm font-semibold text-rose-600">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${critica ? "bg-rose-500 animate-pulse" : "bg-amber-500"} shrink-0`}></div>
                          <span>{oc.tipo || "—"}</span>
                        </div>
                        {oc.severidade && (
                          <div className="text-[10px] text-muted-foreground mt-0.5 font-normal capitalize">{oc.severidade}</div>
                        )}
                     </TableCell>
                     <TableCell className="py-3 text-sm font-medium">{prestador}</TableCell>
                     <TableCell className="py-3 text-sm text-muted-foreground font-mono">{tempoDecorrido}</TableCell>
                     <TableCell className="py-3 px-6 text-right">
                       <Badge variant="outline" className={`px-2.5 py-1 ${(!oc.status || oc.status === "pendente") ? "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"}`}>
                          {oc.status || "pendente"}
                       </Badge>
                     </TableCell>
                   </TableRow>
                 );
               })}
               {ocorrencias.length === 0 && (
                 <TableRow><TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">Operação normalizada. Nenhuma ocorrência registrada no momento.</TableCell></TableRow>
               )}
             </TableBody>
         </Table>
        </CardContent>
      </Card>

      <DetalhesOperacaoSheet
        osId={selectedActionOsId}
        open={sheetOpen}
        onOpenChange={(open) => { setSheetOpen(open); if (!open) setSelectedActionOsId(null); }}
        selectedOSData={selectedOSData}
        selectedActionItem={selectedActionItem}
        trackingPositions={trackingPositions}
        contextualTimelineEvents={contextualTimelineEvents}
        selectedOSOcorrencia={selectedOSOcorrencia}
        selectedOSComprovante={selectedOSComprovante}
        resolverCliente={nomeCliente}
        resolverPrestador={nomePrestador}
      />

      {/* MISSÃO A24 — CHAT PROFISSIONAL E VISÍVEL NA TORRE (reusa A22) */}
      <Sheet open={chatSheetOpen} onOpenChange={setChatSheetOpen}>
        <SheetContent side="right" className="w-full md:w-[62%] sm:max-w-none p-0 flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <SheetTitle className="text-base font-bold flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#F97316]" /> Mensagens / Chat com Prestadores
              </SheetTitle>
              <SheetDescription className="text-[11px]">
                Conversas operacionais vinculadas a OS/Romaneio, prestador e operação.
              </SheetDescription>
            </div>
            {mensagensNaoLidas > 0 && (
              <Badge className="bg-[#F97316] text-white text-[11px] rounded-full">
                {mensagensNaoLidas} não lida(s)
              </Badge>
            )}
          </div>
          <div className="flex-1 min-h-0">
            <ChatTorrePanel
              onTotalNaoLidas={(total) => setMensagensNaoLidas(total)}
              onAbrirOperacao={(conversa) => {
                if (!conversa.osId) return;
                setChatSheetOpen(false);
                setSelectedActionOsId(conversa.osId);
                setSheetOpen(true);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default TorreControle;
