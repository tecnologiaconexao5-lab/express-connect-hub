import { useState, useEffect, useRef, useMemo } from "react";
import { MapPin, Truck, AlertTriangle, AlertCircle, Clock, CheckCircle, FileX, Filter, EyeOff, ArrowRight, Play, Activity, Bell, LucideIcon } from "lucide-react";
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
  PESO_PRIORIDADE,
  STATUS_CONCLUIDO,
} from "@/lib/acoesPrioritarias";

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

type TipoEventoTimeline =
  | "os_criada" | "os_em_rota" | "os_atrasada" | "os_concluida"
  | "ocorrencia_aberta" | "alerta_humano" | "comprovante_pendente" | "alocacao_concluida";

interface TimelineEvent {
  id: string;
  timestamp: string;
  tipoEvento: TipoEventoTimeline;
  severidade: "baixa" | "media" | "alta" | "critica";
  cliente: string;
  prestador: string;
  os: string;
  descricao: string;
}

const LABEL_EVENTO: Record<TipoEventoTimeline, string> = {
  os_criada: "OS Criada",
  os_em_rota: "Em Rota",
  os_atrasada: "Atrasada",
  os_concluida: "Concluída",
  ocorrencia_aberta: "Ocorrência",
  alerta_humano: "Alerta",
  comprovante_pendente: "Pendência",
  alocacao_concluida: "Alocação",
};

const ICONE_EVENTO: Record<TipoEventoTimeline, LucideIcon> = {
  os_criada: Play,
  os_em_rota: Truck,
  os_atrasada: AlertTriangle,
  os_concluida: CheckCircle,
  ocorrencia_aberta: AlertCircle,
  alerta_humano: Bell,
  comprovante_pendente: FileX,
  alocacao_concluida: CheckCircle,
};

const COR_EVENTO: Record<TipoEventoTimeline, { bg: string; icon: string; label: string; dot: string }> = {
  os_criada: { bg: "bg-blue-50/60 dark:bg-blue-950/20", icon: "text-blue-500", label: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500" },
  os_em_rota: { bg: "bg-indigo-50/60 dark:bg-indigo-950/20", icon: "text-indigo-500", label: "text-indigo-700 dark:text-indigo-400", dot: "bg-indigo-500" },
  os_atrasada: { bg: "bg-rose-50/60 dark:bg-rose-950/20", icon: "text-rose-500", label: "text-rose-700 dark:text-rose-400", dot: "bg-rose-500" },
  os_concluida: { bg: "bg-emerald-50/60 dark:bg-emerald-950/20", icon: "text-emerald-500", label: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  ocorrencia_aberta: { bg: "bg-amber-50/60 dark:bg-amber-950/20", icon: "text-amber-500", label: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  alerta_humano: { bg: "bg-yellow-50/60 dark:bg-yellow-950/20", icon: "text-yellow-500", label: "text-yellow-700 dark:text-yellow-400", dot: "bg-yellow-500" },
  comprovante_pendente: { bg: "bg-purple-50/60 dark:bg-purple-950/20", icon: "text-purple-500", label: "text-purple-700 dark:text-purple-400", dot: "bg-purple-500" },
  alocacao_concluida: { bg: "bg-teal-50/60 dark:bg-teal-950/20", icon: "text-teal-500", label: "text-teal-700 dark:text-teal-400", dot: "bg-teal-500" },
};

const isOSAtrasada = (previsaoTermino: string | undefined | null, status: string): boolean => {
  if (!previsaoTermino || isOSConcluida(status)) return false;
  return new Date(previsaoTermino).getTime() < Date.now();
};

type StatusSLA = "no_prazo" | "em_risco" | "atrasada" | "concluida" | "sem_previsao";

const calcularStatusSLA = (previsaoTermino: string | undefined | null, status: string): StatusSLA => {
  if (isOSConcluida(status)) return "concluida";
  if (!previsaoTermino) return "sem_previsao";
  if (new Date(previsaoTermino).getTime() < Date.now()) return "atrasada";
  if (calcularRiscoOperacional(previsaoTermino, status)) return "em_risco";
  return "no_prazo";
};

const SEVERIDADE_CRITICA = ["alta", "critica", "crítica", "Altíssima"];

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

const isOcorrenciaCritica = (severidade: string | undefined | null): boolean => {
  if (!severidade) return false;
  return SEVERIDADE_CRITICA.includes(severidade.toLowerCase());
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
    { key: "em_rota", label: "Em Rota", count: markers.filter(m => m.status === "em_rota").length, color: "bg-green-500" },
    { key: "atrasadas", label: "Atrasadas", count: markers.filter(m => m.status === "atrasado").length, color: "bg-red-500" },
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

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  colorClass: string;
  borderClass: string;
  bgLight: string;
}

const StatCard = ({ title, value, icon: Icon, colorClass, borderClass, bgLight }: StatCardProps) => (
  <Card className={`overflow-hidden relative group transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${borderClass}`}>
    <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 transition-transform group-hover:scale-150 duration-500 bg-current ${colorClass}`}></div>
    <CardContent className="p-5 flex items-center justify-between relative z-10">
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">{title}</p>
        <p className={`text-3xl font-black ${colorClass} drop-shadow-sm`}>{value}</p>
      </div>
      <div className={`p-4 rounded-2xl ${bgLight} flex items-center justify-center transform transition-transform group-hover:rotate-6`}>
        <Icon className={`w-6 h-6 ${colorClass}`} />
      </div>
    </CardContent>
  </Card>
);

const TorreControle = () => {
  const { theme } = useTheme();
  const [osAtivas, setOsAtivas] = useState<OSRecord[]>([]);
  const [ocorrencias, setOcorrencias] = useState<any[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [comprovantesPendentes, setComprovantesPendentes] = useState<ComprovantePendente[]>([]);
  const [selectedActionOsId, setSelectedActionOsId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    emRota: 0, aguardandoAceite: 0, comOcorrencia: 0, atrasadas: 0, concluidasHoje: 0, semComprovante: 0,
    emRisco: 0, semPrevisao: 0, ocorrenciasCriticas: 0
  });

  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);

  useEffect(() => {
    fetchData();

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
        fetchTimeline();
      })
      .subscribe();

    const escChannel = supabase
      .channel("torre-realtime-escalonamentos")
      .on("postgres_changes", { event: "*", schema: "public", table: "escalonamentos_humanos" }, () => fetchTimeline())
      .subscribe();

    channelsRef.current = [osChannel, ocChannel, alocChannel, escChannel];

    return () => {
      channelsRef.current.forEach((ch) => ch.unsubscribe());
    };
  }, []);

  const fetchOcorrencias = async () => {
    try {
      const { data, error } = await supabase
        .from("ocorrencias")
        .select("*, ordens_servico(numero, cliente, prestador)")
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
      const { data: osData, error } = await supabase.from("ordens_servico").select("*").order("numero", { ascending: false }).limit(50);
      
      if (error) {
        if (error.code === "42P01") {
          setOsAtivas([]);
          return;
        }
        throw error;
      }
      
      const listaOS = osData ? (osData as OSRow[]).map((item) => ({
        ...fromOSRow(item),
        created_at: item.created_at,
        updated_at: item.updated_at,
        enderecos: (item as any).enderecos,
        localizacaoEntregaJson: (item as any).localizacao_entrega_json,
      })) : [];
      setOsAtivas(listaOS as OSRecord[]);

      fetchOcorrencias();
      fetchTimeline();

      const { count: totalSemComprovante } = await supabase
        .from("alocacoes_escala")
        .select("id", { count: "exact", head: true })
        .is("comprovante_url", null);

      const { data: comprovPendData } = await supabase
        .from("alocacoes_escala")
        .select("id, ordem_servico_id, ordens_servico!inner(numero, cliente, prestador)")
        .is("comprovante_url", null)
        .limit(50);

      const comprovDetalhados: ComprovantePendente[] = comprovPendData
        ? comprovPendData
            .filter((r: any) => r.ordens_servico)
            .map((r: any) => ({
              id: r.id,
              osId: r.ordem_servico_id || r.id,
              osNumero: r.ordens_servico.numero || r.ordem_servico_id || "—",
              cliente: r.ordens_servico.cliente || "—",
              prestador: r.ordens_servico.prestador || "—",
            }))
        : [];

      setComprovantesPendentes(comprovDetalhados);

      setStats({
        emRota: listaOS.filter(o => o.status === "saiu para rota" || o.status === "em operacao").length || 0,
        aguardandoAceite: listaOS.filter(o => o.status === "aguardando parceiro").length || 0,
        comOcorrencia: listaOS.filter(o => o.status === "com ocorrencia").length || 0,
        atrasadas: listaOS.filter(o => isOSAtrasada(o.previsaoTermino, o.status)).length || 0,
        concluidasHoje: listaOS.filter(o => o.status === "finalizada").length || 0,
        semComprovante: totalSemComprovante ?? 0,
        emRisco: listaOS.filter(o => calcularRiscoOperacional(o.previsaoTermino, o.status)).length || 0,
        semPrevisao: listaOS.filter(o => !o.previsaoTermino && !isOSConcluida(o.status)).length || 0,
        ocorrenciasCriticas: 0,
      });

    } catch (e) {
      console.error(e);
    }
  };

  const fetchTimeline = async () => {
    setTimelineLoading(true);
    try {
      const events: TimelineEvent[] = [];

      const { data: osData } = await supabase
        .from("ordens_servico")
        .select("id, numero, cliente, prestador, status, previsao_termino, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (osData) {
        for (const os of osData as any[]) {
          if (os.created_at) {
            events.push({
              id: `os-criada-${os.id}`,
              timestamp: os.created_at,
              tipoEvento: "os_criada",
              severidade: "baixa",
              cliente: os.cliente || "—",
              prestador: os.prestador || "—",
              os: os.numero || os.id,
              descricao: `OS ${os.numero || os.id} criada para ${os.cliente || "—"}`,
            });
          }
          if (["saiu para rota", "em operacao", "em_rota"].includes(os.status) && os.updated_at) {
            events.push({
              id: `os-rota-${os.id}`,
              timestamp: os.updated_at,
              tipoEvento: "os_em_rota",
              severidade: "baixa",
              cliente: os.cliente || "—",
              prestador: os.prestador || "—",
              os: os.numero || os.id,
              descricao: `OS ${os.numero || os.id} em rota`,
            });
          }
          if (isOSAtrasada(os.previsao_termino, os.status)) {
            events.push({
              id: `os-atraso-${os.id}`,
              timestamp: os.previsao_termino,
              tipoEvento: "os_atrasada",
              severidade: "critica",
              cliente: os.cliente || "—",
              prestador: os.prestador || "—",
              os: os.numero || os.id,
              descricao: `OS ${os.numero || os.id} atrasada — previsão excedida`,
            });
          }
          if (isOSConcluida(os.status)) {
            events.push({
              id: `os-concluida-${os.id}`,
              timestamp: os.updated_at || os.created_at,
              tipoEvento: "os_concluida",
              severidade: "baixa",
              cliente: os.cliente || "—",
              prestador: os.prestador || "—",
              os: os.numero || os.id,
              descricao: `OS ${os.numero || os.id} concluída`,
            });
          }
        }
      }

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

      const { data: alocPendData } = await supabase
        .from("alocacoes_escala")
        .select("id, updated_at, created_at")
        .is("comprovante_url", null)
        .order("updated_at", { ascending: false })
        .limit(50);

      if (alocPendData) {
        for (const al of alocPendData as any[]) {
          events.push({
            id: `pendencia-${al.id}`,
            timestamp: al.updated_at || al.created_at,
            tipoEvento: "comprovante_pendente",
            severidade: "media",
            cliente: "—",
            prestador: "—",
            os: "—",
            descricao: "Comprovante de alocação pendente",
          });
        }
      }

      const { data: alocConcData } = await supabase
        .from("alocacoes_escala")
        .select("id, data_finalizacao")
        .eq("finalizada", true)
        .not("data_finalizacao", "is", null)
        .order("data_finalizacao", { ascending: false })
        .limit(50);

      if (alocConcData) {
        for (const al of alocConcData as any[]) {
          events.push({
            id: `aloc-concluida-${al.id}`,
            timestamp: al.data_finalizacao,
            tipoEvento: "alocacao_concluida",
            severidade: "baixa",
            cliente: "—",
            prestador: "—",
            os: "—",
            descricao: "Alocação de escala concluída",
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

  const [mapFilter, setMapFilter] = useState<string>("todas");

  const semCoordenadas = useMemo(
    () => osAtivas.filter(os => !extrairCoordenadasOS(os)),
    [osAtivas]
  );

  const markers = useMemo(
    () => osAtivas
      .map((os) => {
        const coords = extrairCoordenadasOS(os);
        if (!coords) return null;
        const slaStatus = calcularStatusSLA(os.previsaoTermino, os.status);
        let mapStatus: MapLocation["status"] = "aguardando";
        if (slaStatus === "atrasada") mapStatus = "atrasado";
        else if (os.status === "com ocorrencia") mapStatus = "ocorrencia";
        else if (isOSConcluida(os.status)) mapStatus = "concluida";
        else if (["saiu para rota", "em operacao", "em_rota"].includes(os.status)) mapStatus = "em_rota";
        return {
          id: os.id,
          numero: os.numero || os.id,
          latitude: coords.lat,
          longitude: coords.lng,
          status: mapStatus as MapLocation["status"],
          cliente: os.cliente || "—",
          prestador: os.prestador || "—",
          previsao: os.previsaoTermino,
          sla: slaStatus === "atrasada" ? "atrasado" : undefined,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null),
    [osAtivas]
  );

  const filteredMarkers = useMemo(
    () => markers.filter(m => {
      if (mapFilter === "todas") return true;
      if (mapFilter === "em_rota") return m.status === "em_rota";
      if (mapFilter === "atrasadas") return m.status === "atrasado";
      if (mapFilter === "ocorrencias") return m.status === "ocorrencia";
      if (mapFilter === "concluidas") return m.status === "concluida";
      return true;
    }),
    [markers, mapFilter]
  );

  const acoesPrioritarias: ActionItem[] = useMemo(
    () => gerarAcoesPrioritarias(osAtivas, stats.semComprovante, comprovantesPendentes),
    [osAtivas, stats.semComprovante, comprovantesPendentes]
  );

  const selectedActionItem = useMemo(
    () => acoesPrioritarias.find(a => a.osId === selectedActionOsId) ?? null,
    [acoesPrioritarias, selectedActionOsId]
  );

  const selectedActionTemCoordenada = useMemo(() => {
    if (!selectedActionOsId) return false;
    const os = osAtivas.find(o => o.id === selectedActionOsId);
    return os ? !!extrairCoordenadasOS(os) : false;
  }, [selectedActionOsId, osAtivas]);

  const contextualTimelineEvents = useMemo(
    () => selectedActionItem
      ? timelineEvents.filter(e => e.os === selectedActionItem.os)
      : [],
    [selectedActionItem, timelineEvents]
  );

  const selectedOSData = useMemo(
    () => osAtivas.find(o => o.id === selectedActionOsId) ?? null,
    [osAtivas, selectedActionOsId]
  );

  const selectedOSOcorrencia = useMemo(
    () => selectedActionItem
      ? ocorrencias.find((oc: any) => oc.ordens_servico?.numero === selectedActionItem.os) ?? null
      : null,
    [ocorrencias, selectedActionItem]
  );

  const selectedOSComprovante = useMemo(
    () => comprovantesPendentes.find(c => c.osId === selectedActionOsId) ?? null,
    [comprovantesPendentes, selectedActionOsId]
  );

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto pb-8">
      {/* HEADER TÍTULO E CONTROLE */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent flex items-center gap-3">
             <Activity className="w-8 h-8 text-blue-600" />
             Torre de Controle Operacional
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Monitoramento em tempo real da frota e ocorrências.</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card px-3 py-1.5 rounded-full border shadow-sm">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              Conexões ativas
           </div>
           <Button variant="outline" size="sm" className="gap-2 shadow-sm">
             <Filter className="w-4 h-4"/> Filtros
           </Button>
        </div>
      </div>

      {/* 6 Realtime Counters - Melhor hierarquia visual */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="Em Rota" value={stats.emRota} icon={Truck} colorClass="text-emerald-600" borderClass="border-b-4 border-emerald-500" bgLight="bg-emerald-100 dark:bg-emerald-500/10" />
        <StatCard title="Aguard. Aceite" value={stats.aguardandoAceite} icon={Clock} colorClass="text-amber-500" borderClass="border-b-4 border-amber-400" bgLight="bg-amber-100 dark:bg-amber-500/10" />
        <StatCard title="Atrasadas" value={stats.atrasadas} icon={Clock} colorClass="text-rose-600" borderClass="border-b-4 border-rose-500" bgLight="bg-rose-100 dark:bg-rose-500/10" />
        <StatCard title="Com Ocorrência" value={stats.comOcorrencia} icon={AlertTriangle} colorClass="text-orange-500" borderClass="border-b-4 border-orange-500" bgLight="bg-orange-100 dark:bg-orange-500/10" />
        <StatCard title="Sem Comprovante" value={stats.semComprovante} icon={FileX} colorClass="text-purple-600" borderClass="border-b-4 border-purple-500" bgLight="bg-purple-100 dark:bg-purple-500/10" />
        <StatCard title="Concluídas Hoje" value={stats.concluidasHoje} icon={CheckCircle} colorClass="text-blue-600" borderClass="border-b-4 border-blue-500" bgLight="bg-blue-100 dark:bg-blue-500/10" />
      </div>

      {/* PAINEL DE RISCO OPERACIONAL */}
      <Card className="shadow-sm border-muted">
        <CardHeader className="py-3 px-5 border-b bg-card">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-rose-500" />
            <CardTitle className="text-sm font-bold">Painel de Risco Operacional</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <div className="flex items-center gap-3 bg-rose-50 dark:bg-rose-950/20 rounded-lg p-3 border border-rose-200 dark:border-rose-800">
              <AlertTriangle className="w-8 h-8 text-rose-500 shrink-0" />
              <div>
                <p className="text-xl font-black text-rose-600">{stats.atrasadas}</p>
                <p className="text-[10px] font-semibold text-rose-700 dark:text-rose-400 uppercase leading-tight">Atenção imediata</p>
                <p className="text-[10px] text-muted-foreground">atrasadas</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg p-3 border border-orange-200 dark:border-orange-800">
              <Clock className="w-8 h-8 text-orange-500 shrink-0" />
              <div>
                <p className="text-xl font-black text-orange-600">{stats.emRisco}</p>
                <p className="text-[10px] font-semibold text-orange-700 dark:text-orange-400 uppercase leading-tight">Monitorar</p>
                <p className="text-[10px] text-muted-foreground">em risco de atraso</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/20 rounded-lg p-3 border border-red-200 dark:border-red-800">
              <AlertCircle className="w-8 h-8 text-red-500 shrink-0" />
              <div>
                <p className="text-xl font-black text-red-600">{ocorrencias.filter(o => isOcorrenciaCritica(o.severidade)).length}</p>
                <p className="text-[10px] font-semibold text-red-700 dark:text-red-400 uppercase leading-tight">Atenção imediata</p>
                <p className="text-[10px] text-muted-foreground">ocorrências críticas</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/30 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
              <EyeOff className="w-8 h-8 text-slate-500 shrink-0" />
              <div>
                <p className="text-xl font-black text-slate-600">{stats.semPrevisao}</p>
                <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase leading-tight">Sem previsão cadastrada</p>
                <p className="text-[10px] text-muted-foreground">OS sem previsão</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
              <FileX className="w-8 h-8 text-purple-500 shrink-0" />
              <div>
                <p className="text-xl font-black text-purple-600">{stats.semComprovante}</p>
                <p className="text-[10px] font-semibold text-purple-700 dark:text-purple-400 uppercase leading-tight">Pendência documental</p>
                <p className="text-[10px] text-muted-foreground">sem comprovante</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AÇÕES PRIORITÁRIAS */}
      {acoesPrioritarias.length > 0 && (
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="py-3 px-5 flex flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="bg-red-100 dark:bg-red-900/40 p-1.5 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">Ações Prioritárias</CardTitle>
                <CardDescription className="text-[10px]">Fila operacional — {acoesPrioritarias.length} item(ns)</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-700">
              priorizadas por criticidade
            </Badge>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="space-y-2">
              {acoesPrioritarias.map(item => {
                const COR_PRIORIDADE = {
                  critica: { badge: "bg-red-600 text-white", label: "Crítica", border: "border-red-300 dark:border-red-700", bg: "bg-red-50/60 dark:bg-red-950/20" },
                  alta: { badge: "bg-orange-500 text-white", label: "Alta", border: "border-orange-300 dark:border-orange-700", bg: "bg-orange-50/60 dark:bg-orange-950/20" },
                  media: { badge: "bg-yellow-500 text-white", label: "Média", border: "border-yellow-300 dark:border-yellow-700", bg: "bg-yellow-50/60 dark:bg-yellow-950/20" },
                  baixa: { badge: "bg-slate-400 text-white", label: "Baixa", border: "border-slate-300 dark:border-slate-600", bg: "bg-slate-50/60 dark:bg-slate-950/20" },
                }[item.prioridade];
                return item.osId ? (
                  <button
                    key={item.id}
                    onClick={() => setSelectedActionOsId(item.osId!)}
                    className={`w-full flex items-center gap-3 rounded-lg border text-left transition-all hover:ring-2 hover:ring-indigo-400 ${COR_PRIORIDADE.border} ${selectedActionOsId === item.osId ? "ring-2 ring-indigo-500 shadow-md" : ""} ${COR_PRIORIDADE.bg} p-3`}
                  >
                    <span className={`shrink-0 text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${COR_PRIORIDADE.badge}`}>
                      {COR_PRIORIDADE.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{item.motivo}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        OS {item.os} · {item.cliente} · {item.prestador}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-700">
                      {item.acaoSugerida}
                    </span>
                  </button>
                ) : (
                  <div key={item.id} className={`flex items-center gap-3 rounded-lg border ${COR_PRIORIDADE.border} ${COR_PRIORIDADE.bg} p-3 opacity-80`}>
                    <span className={`shrink-0 text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${COR_PRIORIDADE.badge}`}>
                      {COR_PRIORIDADE.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{item.motivo}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        OS {item.os} · {item.cliente} · {item.prestador}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-700">
                      {item.acaoSugerida}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedActionItem && (
        <Card className="border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/15">
          <CardHeader className="py-3 px-5 flex flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-100 dark:bg-indigo-900/40 p-1.5 rounded-lg">
                <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">Painel Operacional</CardTitle>
                <CardDescription className="text-[10px]">{selectedActionItem.tipo.replace(/_/g, " ")}</CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedActionOsId(null)} className="text-xs gap-1 h-7">
              Limpar seleção
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-3">
            {/* Grid: Prioridade + OS + Cliente + Prestador + Previsao */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-white dark:bg-slate-900/50 rounded-lg p-2.5 border border-indigo-100 dark:border-indigo-900/30">
                <p className="text-[9px] font-semibold text-muted-foreground uppercase mb-0.5">Prioridade</p>
                <span className={`inline-block text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                  selectedActionItem.prioridade === "critica" ? "bg-red-600 text-white" :
                  selectedActionItem.prioridade === "alta" ? "bg-orange-500 text-white" :
                  selectedActionItem.prioridade === "media" ? "bg-yellow-500 text-white" :
                  "bg-slate-400 text-white"
                }`}>{selectedActionItem.prioridade}</span>
              </div>
              <div className="bg-white dark:bg-slate-900/50 rounded-lg p-2.5 border border-indigo-100 dark:border-indigo-900/30">
                <p className="text-[9px] font-semibold text-muted-foreground uppercase mb-0.5">OS</p>
                <p className="text-xs font-bold truncate">{selectedActionItem.os}</p>
              </div>
              <div className="bg-white dark:bg-slate-900/50 rounded-lg p-2.5 border border-indigo-100 dark:border-indigo-900/30">
                <p className="text-[9px] font-semibold text-muted-foreground uppercase mb-0.5">Cliente</p>
                <p className="text-xs font-medium truncate">{selectedActionItem.cliente}</p>
              </div>
              <div className="bg-white dark:bg-slate-900/50 rounded-lg p-2.5 border border-indigo-100 dark:border-indigo-900/30">
                <p className="text-[9px] font-semibold text-muted-foreground uppercase mb-0.5">Prestador</p>
                <p className="text-xs font-medium truncate">{selectedActionItem.prestador}</p>
              </div>
              <div className="bg-white dark:bg-slate-900/50 rounded-lg p-2.5 border border-indigo-100 dark:border-indigo-900/30">
                <p className="text-[9px] font-semibold text-muted-foreground uppercase mb-0.5">Previsão</p>
                <p className="text-xs font-medium truncate">{selectedOSData?.previsaoTermino ? new Date(selectedOSData.previsaoTermino).toLocaleString("pt-BR") : "—"}</p>
              </div>
            </div>

            {/* Badges: SLA, risco, ocorrência, comprovante */}
            {selectedOSData && (
              <div className="flex items-center gap-2 flex-wrap">
                {(() => {
                  const slaStatus = calcularStatusSLA(selectedOSData.previsaoTermino, selectedOSData.status);
                  if (slaStatus === "atrasada") return <Badge className="bg-red-600 text-white text-[10px]">Atrasada</Badge>;
                  if (slaStatus === "em_risco") return <Badge className="bg-orange-500 text-white text-[10px]">SLA em risco</Badge>;
                  if (slaStatus === "sem_previsao") return <Badge className="bg-slate-400 text-white text-[10px]">Sem previsão</Badge>;
                  if (slaStatus === "concluida") return <Badge className="bg-blue-500 text-white text-[10px]">Concluída</Badge>;
                  return <Badge className="bg-green-500 text-white text-[10px]">No prazo</Badge>;
                })()}
                {selectedOSOcorrencia && <Badge className="bg-red-600 text-white text-[10px]">Ocorrência crítica</Badge>}
                {selectedOSComprovante && <Badge className="bg-purple-500 text-white text-[10px]">Comprovante pendente</Badge>}
                {selectedActionTemCoordenada
                  ? <Badge variant="outline" className="text-[10px] text-green-600 border-green-200 bg-green-50">Com coordenada</Badge>
                  : selectedActionItem.osId ? <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-200">Sem coordenada</Badge>
                  : null}
              </div>
            )}

            {/* Motivo + Ação */}
            <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900/30 rounded-lg p-2.5 border border-indigo-100 dark:border-indigo-900/30">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold">Motivo:</span>
                <span className="text-muted-foreground">{selectedActionItem.motivo}</span>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-700 px-2.5 py-0.5 shrink-0">
                {selectedActionItem.acaoSugerida}
              </Badge>
            </div>

            {/* Ocorrência vinculada */}
            <div className="bg-white dark:bg-slate-900/30 rounded-lg p-2.5 border border-indigo-100 dark:border-indigo-900/30">
              <p className="text-[9px] font-semibold text-muted-foreground uppercase mb-1.5">Ocorrência Vinculada</p>
              {selectedOSOcorrencia ? (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="text-xs font-medium">{(selectedOSOcorrencia as any).tipo || "Ocorrência"}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    isOcorrenciaCritica((selectedOSOcorrencia as any).severidade)
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {(selectedOSOcorrencia as any).severidade || "—"}
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground italic">Nenhuma ocorrência vinculada a esta OS</p>
              )}
            </div>

            {/* Comprovante */}
            <div className="bg-white dark:bg-slate-900/30 rounded-lg p-2.5 border border-indigo-100 dark:border-indigo-900/30">
              <p className="text-[9px] font-semibold text-muted-foreground uppercase mb-1.5">Comprovante</p>
              {selectedOSComprovante ? (
                <div className="flex items-center gap-2">
                  <FileX className="w-4 h-4 text-purple-500 shrink-0" />
                  <span className="text-xs font-medium">Pendente — alocação {selectedOSComprovante.id.slice(0, 8)}</span>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground italic">Nenhum comprovante pendente para esta OS</p>
              )}
            </div>

            {/* SLA / Risco */}
            {selectedOSData && (
              <div className="bg-white dark:bg-slate-900/30 rounded-lg p-2.5 border border-indigo-100 dark:border-indigo-900/30">
                <p className="text-[9px] font-semibold text-muted-foreground uppercase mb-1.5">Status SLA</p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-medium">Status:</span>
                  <span>{calcularStatusSLA(selectedOSData.previsaoTermino, selectedOSData.status).replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-medium">Risco:</span>
                  <span>{calcularRiscoOperacional(selectedOSData.previsaoTermino, selectedOSData.status) ? "Em risco (≤ 60 min)" : isOSAtrasada(selectedOSData.previsaoTermino, selectedOSData.status) ? "Atrasada" : "Normal"}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedActionItem && (
        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader className="py-3 px-5 flex flex-row items-center gap-2">
            <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg">
              <Clock className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold">Timeline Contextual</CardTitle>
              <CardDescription className="text-[10px]">
                Eventos operacionais de {selectedActionItem.os}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {contextualTimelineEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <Clock className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-xs font-medium">Nenhum evento operacional encontrado</p>
                <p className="text-[10px]">Esta OS pode estar sem registros de timeline ou o vínculo é indireto</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                {contextualTimelineEvents.map(event => {
                  const Icon = ICONE_EVENTO[event.tipoEvento];
                  const cores = COR_EVENTO[event.tipoEvento];
                  return (
                    <div key={event.id} className={`flex items-start gap-3 rounded-lg p-2.5 ${cores.bg}`}>
                      <div className={`p-1.5 rounded-full ${cores.icon} shrink-0`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[11px] font-semibold ${cores.label}`}>
                            {LABEL_EVENTO[event.tipoEvento]}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono tabular-nums shrink-0">
                            {timeAgo(event.timestamp)}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{event.descricao}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <CardContent className="py-3 px-4 flex items-center gap-3">
          <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-full">
            <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Rastreamento em tempo real disponível após ativação do App/PWA do Prestador</p>
            <p className="text-xs text-blue-700 dark:text-blue-300">O rastreamento será habilitado automaticamente quando o prestador ativar o App Conexão Express, permitir geolocalização e aceitar uma ordem de serviço vinculada.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col xl:flex-row gap-6 h-[650px]">
        {/* ESQUERDA - MAPA (65%) */}
        <div className="xl:w-[65%] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <FiltrosMapa
              mapFilter={mapFilter}
              markers={markers}
              semCoordenadas={semCoordenadas}
              onFilterChange={setMapFilter}
            />
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
                 <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-lg px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
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

        {/* DIREITA - TIMELINE OPERACIONAL (35%) */}
        <div className="xl:w-[35%] flex flex-col">
          <Card className="flex-1 flex flex-col overflow-hidden shadow-lg border-muted">
            <CardHeader className="py-4 px-5 bg-card border-b sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-600" />
                  <CardTitle className="text-base">Timeline Operacional</CardTitle>
                </div>
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                  {timelineEvents.length} eventos
                </Badge>
              </div>
              <CardDescription className="text-xs mt-1">Eventos consolidados em tempo real</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0 bg-muted/20">
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
                  {timelineEvents.map((event) => {
                    const cores = COR_EVENTO[event.tipoEvento];
                    const Icone = ICONE_EVENTO[event.tipoEvento];
                    return (
                      <div key={event.id} className={`relative flex items-start gap-3 p-3 pl-5 transition-all duration-200 hover:bg-muted/30 ${cores.bg}`}>
                        {/* Bolinha conectora */}
                        <div className={`relative z-10 mt-0.5 w-[10px] h-[10px] rounded-full border-2 border-background shrink-0 ${cores.dot}`}></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <div className="flex items-center gap-1.5">
                              <Icone className={`w-3.5 h-3.5 ${cores.icon}`} />
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${cores.label}`}>
                                {LABEL_EVENTO[event.tipoEvento]}
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono tabular-nums">{timeAgo(event.timestamp)}</span>
                          </div>
                          <p className="text-xs font-medium leading-tight truncate">{event.descricao}</p>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5 truncate">
                            {event.os !== "—" && <span className="font-semibold">{event.os}</span>}
                            {event.cliente !== "—" && <span>• {event.cliente}</span>}
                            {event.prestador !== "—" && <span>• {event.prestador}</span>}
                            {event.severidade === "critica" && (
                              <span className="ml-auto text-[9px] font-bold uppercase text-rose-600 bg-rose-100 dark:bg-rose-900/40 dark:text-rose-400 px-1 py-0.5 rounded">Crítico</span>
                            )}
                            {event.severidade === "alta" && (
                              <span className="ml-auto text-[9px] font-bold uppercase text-amber-600 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400 px-1 py-0.5 rounded">Alto</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* PAINEL INFERIOR - OCORRÊNCIAS */}
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
            </div>
            <Button variant="outline" size="sm" className="gap-2 text-xs font-semibold">Ver Todas <ArrowRight className="w-3.5 h-3.5"/></Button>
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
                   const cliente = osRef?.cliente || "—";
                   const prestador = osRef?.prestador || "—";
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
                     <TableRow key={oc.id || i} className="group hover:bg-muted/20 transition-colors">
                       <TableCell className="py-3 px-6">
                         <div className="font-bold text-sm">{osNumero}</div>
                         <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">{cliente}</div>
                       </TableCell>
                       <TableCell className="py-3 text-sm font-semibold text-rose-600">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0"></div>
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
    </div>
  );
};

export default TorreControle;
