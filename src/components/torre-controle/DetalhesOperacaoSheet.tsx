import { useState, useEffect, useMemo } from "react";
import {
  Package, Truck, MapPin, Clock, AlertTriangle, CheckCircle,
  DollarSign, FileText, Camera, PenTool, ClipboardList,
  Navigation, Calendar, Hash, User, Phone, Mail, Building,
  ArrowRight, Receipt, Gauge, History, XCircle, Loader2, Percent, AlertCircle,
  MessageSquare,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import { fromOSRow, OSRow } from "@/lib/dbMappers";
import { obterPosicaoAtual, obterPosicaoAtualPorAlocacao, TrackingPosition } from "@/services/rastreamento/trackingService";
import { buscarPOD, PODData } from "@/services/podService";
import { obterLabelStatus, obterClasseBadgeStatus } from "@/components/operacao/escalaStatus";
import { TimelineEvent } from "./types";
import { ActionItem, ComprovantePendente, calcularRiscoOperacional } from "@/lib/acoesPrioritarias";
import { extrairIdAlocacaoDeMarcador } from "./markerAdapter";
import { TIMELINE_LABELS, TIMELINE_ICONS, TIMELINE_COLORS, SEVERIDADE_BADGE } from "./timelineVisuals";
import { ChatOperacaoPanel } from "./ChatOperacaoPanel";
import { useAuth } from "@/contexts/AuthContext";
import { podeVerReceitaEMargem } from "@/lib/permissoes";

const fmtFin = (v: number | null | undefined) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Não informado";

const fmtData = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("pt-BR") : "Não informado";

const fmtDataShort = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

const timeAgo = (timestamp: string): string => {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return `${Math.floor(diffH / 24)}d`;
};

interface AlocacaoRow {
  id: string;
  status: string;
  prestador_id: string | null;
  tipo_veiculo: string | null;
  placa: string | null;
  origem: string | null;
  destino: string | null;
  km_previstos: number | null;
  km_realizados: number | null;
  horario_inicio_real: string | null;
  horario_fim_real: string | null;
  data_escala: string | null;
  aceite_prestador: boolean | null;
  data_aceite: string | null;
  finalizada: boolean | null;
  data_finalizacao: string | null;
  valor_frete: number | null;
  valor_repasse: number | null;
  valor_pedagio: number | null;
  valor_ajudante: number | null;
  valor_adicional: number | null;
  valor_desconto: number | null;
  metadata: Record<string, any> | null;
  observacoes: string | null;
  instrucoes_operacionais: string | null;
}

interface ComposicaoFinanceiraRow {
  id: string;
  os_id: string;
  valor_cliente: number | null;
  valor_prestador: number | null;
  impostos: number | null;
  seguro: number | null;
  pedagio: number | null;
  outros: number | null;
  margem_bruta: number | null;
  margem_liquida: number | null;
  percentual_margem_bruta: number | null;
  percentual_margem_liquida: number | null;
  custos_operacionais: number | null;
}

interface DetalhesOperacaoSheetProps {
  osId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedOSData: Record<string, any> | null;
  selectedActionItem: ActionItem | null;
  trackingPositions: Record<string, TrackingPosition>;
  contextualTimelineEvents: TimelineEvent[];
  selectedOSOcorrencia: any | null;
  selectedOSComprovante: ComprovantePendente | null;
  resolverCliente?: (id?: string | null) => string;
  resolverPrestador?: (id?: string | null) => string;
}

export function DetalhesOperacaoSheet({
  osId,
  open,
  onOpenChange,
  selectedOSData,
  selectedActionItem,
  trackingPositions,
  contextualTimelineEvents,
  selectedOSOcorrencia,
  selectedOSComprovante,
  resolverCliente,
  resolverPrestador,
}: DetalhesOperacaoSheetProps) {
  const [tab, setTab] = useState("visao-geral");
  const [loading, setLoading] = useState(false);
  // UPGRADE-REGRAS: receita e margens restritas a admin máximo ("---" para os demais)
  const { user } = useAuth();
  const verReceitaMargem = podeVerReceitaEMargem(user?.role);
  const [alocacoes, setAlocacoes] = useState<AlocacaoRow[]>([]);
  const [pod, setPod] = useState<PODData | null>(null);
  const [tracking, setTracking] = useState<TrackingPosition | null>(null);
  const [composicao, setComposicao] = useState<ComposicaoFinanceiraRow | null>(null);
  const [osFull, setOsFull] = useState<Record<string, any> | null>(null);

  const alocacaoAtiva = useMemo(
    () => alocacoes.find(a => a.status !== "cancelada" && a.status !== "recusada") || alocacoes[0] || null,
    [alocacoes]
  );

  // MISSÃO A25-L — Grupo 2 do mapa (alocação ativa SEM OS):
  // marcadores usam id "aloc-<uuid>". Deriva o uuid real da alocação para
  // resolver o painel por alocacao_id (não existe ordens_servico vinculada).
  const alocSemOSId = osId ? extrairIdAlocacaoDeMarcador(osId) : null;

  useEffect(() => {
    if (!open || !osId) return;
    setLoading(true);
    Promise.all([
      fetchAlocacoes(),
      fetchOSFull(),
    ]).finally(() => setLoading(false));
  }, [open, osId]);

  useEffect(() => {
    if (!alocacaoAtiva) return;
    Promise.all([
      fetchPOD(alocacaoAtiva.id),
      // A25-L: Grupo 2 (sem OS) resolve tracking por alocacao_id; OS normal por os_id
      alocSemOSId
        ? obterPosicaoAtualPorAlocacao(alocSemOSId)
        : obterPosicaoAtual(osId!),
    ]).then(([_, pos]) => { if (pos) setTracking(pos); });
  }, [alocacaoAtiva, alocSemOSId, osId]);

  useEffect(() => {
    if (!alocacaoAtiva) return;
    fetchComposicao();
  }, [alocacaoAtiva]);

  async function fetchAlocacoes() {
    if (!osId) return;
    let query = supabase
      .from("alocacoes_escala")
      .select("*")
      .order("data_escala", { ascending: false });
    // A25-L: id "aloc-<uuid>" → busca a alocação pelo id real
    if (alocSemOSId) query = query.eq("id", alocSemOSId);
    else query = query.eq("ordem_servico_id", osId);
    const { data } = await query;
    if (data) setAlocacoes(data as AlocacaoRow[]);
  }

  async function fetchOSFull() {
    if (!osId || alocSemOSId) return;
    const { data } = await supabase
      .from("ordens_servico")
      .select("*")
      .eq("id", osId)
      .maybeSingle();
    if (data) setOsFull(data);
  }

  async function fetchPOD(alocacaoId: string) {
    const result = await buscarPOD(alocacaoId);
    if (result) setPod(result);
  }

  async function fetchComposicao() {
    if (!osId || alocSemOSId) return;
    const { data } = await supabase
      .from("composicao_financeira_os")
      .select("*")
      .eq("os_id", osId)
      .maybeSingle();
    if (data) setComposicao(data as ComposicaoFinanceiraRow);
  }

  const liveTracking = useMemo(() => {
    if (!osId) return null;
    // A25-L: Grupo 2 (alocação sem OS) — trackingPositions é indexado por alocacao_id
    if (alocSemOSId) {
      const fromMap = Object.values(trackingPositions).find(
        p => p.alocacao_id === alocSemOSId
      );
      return fromMap || tracking;
    }
    const fromMap = Object.values(trackingPositions).find(
      p => p.os_id === osId && p.alocacao_id
    );
    return fromMap || tracking;
  }, [trackingPositions, tracking, osId, alocSemOSId]);

  const osForm = useMemo(() => {
    if (osFull) {
      const base = fromOSRow(osFull as OSRow);
      return {
        ...base,
        cliente: resolverCliente?.(osFull.cliente) || base.cliente || "",
        prestador: resolverPrestador?.(osFull.prestador) || base.prestador || "",
      };
    }
    return selectedOSData || {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [osFull, selectedOSData, resolverCliente, resolverPrestador]);

  const etapaApp = useMemo(() => {
    const meta = alocacaoAtiva?.metadata as any;
    return meta?.app_motorista?.etapa_atual || null;
  }, [alocacaoAtiva]);

  const pendenciaFields = useMemo(() => {
    const pendencias: { label: string; ok: boolean; severity: "alta" | "media" | "baixa" }[] = [];
    const alocAtiva = alocacaoAtiva && alocacaoAtiva.status !== "cancelada" && alocacaoAtiva.status !== "recusada";
    const exigeEvidencias = alocAtiva &&
      (alocacaoAtiva.status === "em_rota" || alocacaoAtiva.status === "ocorrencia" ||
       alocacaoAtiva.status === "concluida" || alocacaoAtiva.finalizada);
    const comprovanteObrigatorio = (osForm as any)?.comprovanteObrigatorio;

    if (exigeEvidencias && !alocacaoAtiva.finalizada) {
      if (comprovanteObrigatorio !== false) {
        pendencias.push({
          label: "Foto de entrega",
          ok: !!pod?.foto_entrega_url,
          severity: "alta",
        });
        pendencias.push({
          label: "Assinatura do recebedor",
          ok: !!pod?.assinatura_url,
          severity: "alta",
        });
      }
      pendencias.push({
        label: "Canhoto",
        ok: !!pod?.foto_canhoto_url,
        severity: "media",
      });
      pendencias.push({
        label: "Nome do recebedor",
        ok: !!pod?.nome_recebedor && pod.nome_recebedor !== "Motorista",
        severity: "media",
      });
    }
    if (alocacaoAtiva && !alocacaoAtiva.km_realizados && alocacaoAtiva.finalizada) {
      pendencias.push({ label: "KM realizado", ok: false, severity: "media" });
    }
    const ocorrResolvida = selectedOSOcorrencia &&
      ((selectedOSOcorrencia as any).status === "resolvida" || (selectedOSOcorrencia as any).status === "concluida" || (selectedOSOcorrencia as any).status === "fechada");
    if (selectedOSOcorrencia && !ocorrResolvida) {
      pendencias.push({ label: "Ocorrência aberta", ok: false, severity: "alta" });
    }
    if (alocacaoAtiva && alocacaoAtiva.status === "em_rota") {
      if (liveTracking) {
        const lastUpdate = liveTracking.captured_at || liveTracking.created_at;
        if (lastUpdate) {
          const minSince = Math.floor((Date.now() - new Date(lastUpdate).getTime()) / 60000);
          pendencias.push({
            label: `GPS (${minSince}min)`,
            ok: minSince < 30,
            severity: minSince > 60 ? "alta" : "media",
          });
        }
      } else {
        pendencias.push({ label: "GPS indisponível", ok: false, severity: "alta" });
      }
    }
    return pendencias;
  }, [alocacaoAtiva, pod, selectedOSOcorrencia, liveTracking, osForm]);

  const pendenciasCount = pendenciaFields.filter(p => !p.ok).length;
  const pendenciasResolvidas = pendenciaFields.length - pendenciasCount;

  const isAtrasada = selectedOSData?.previsaoTermino
    ? new Date(selectedOSData.previsaoTermino).getTime() < Date.now()
    : false;
  const isConcluida = selectedOSData?.status === "finalizada" || selectedOSData?.status === "concluida";

  const gpsBadgeInfo = useMemo(() => {
    if (!liveTracking) return null;
    const lastUpdate = liveTracking.captured_at || liveTracking.created_at;
    const minSince = lastUpdate ? Math.floor((Date.now() - new Date(lastUpdate).getTime()) / 60000) : null;
    if (minSince === null) return { label: "GPS Desconhecido", cls: "bg-slate-400 text-white" };
    if (minSince <= 15) return { label: "GPS Atualizado", cls: "bg-emerald-500 text-white" };
    if (minSince <= 60) return { label: "GPS Antigo", cls: "bg-amber-500 text-white" };
    return { label: "GPS Muito Antigo", cls: "bg-rose-500 text-white" };
  }, [liveTracking]);

  const slaInfo = useMemo(() => {
    if (isConcluida) return { label: "SLA Concluído", cls: "bg-blue-500 text-white" };
    if (isAtrasada) return { label: "SLA Atrasado", cls: "bg-rose-600 text-white" };
    const previsao = selectedOSData?.previsaoTermino;
    if (previsao && calcularRiscoOperacional(previsao, selectedOSData?.status)) {
      return { label: "SLA em Risco", cls: "bg-orange-500 text-white" };
    }
    if (!previsao) return { label: "SLA sem Previsão", cls: "bg-slate-400 text-white" };
    return { label: "SLA no Prazo", cls: "bg-emerald-500 text-white" };
  }, [isConcluida, isAtrasada, selectedOSData]);

  const InfoRow = ({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) => (
    <div className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
      <span className="w-7 h-7 rounded-lg bg-muted/30 flex items-center justify-center text-muted-foreground shrink-0">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={`text-sm font-medium text-foreground truncate ${mono ? "font-mono tabular-nums" : ""}`}>{value}</p>
      </div>
    </div>
  );

  const SectionDivider = ({ title }: { title: string }) => (
    <div className="flex items-center gap-2 py-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">{title}</span>
      <div className="flex-1 h-px bg-border/30" />
    </div>
  );

  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
      <XCircle className="w-8 h-8 mb-2 opacity-30" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );

  const enderecosOS = useMemo(() => {
    const raw = (osForm as any)?.enderecos || (osFull as any)?.enderecos;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try { return JSON.parse(raw); } catch { return []; }
    }
    return [];
  }, [osForm, osFull]);

  if (!osId) return null;

  const etapaLabel: Record<string, string> = {
    viagem_aceita: "Viagem aceita",
    cheguei_coleta: "Chegou na coleta",
    carregamento_iniciado: "Carregamento iniciado",
    carregamento_finalizado: "Carregamento finalizado",
    romaneio_informado: "Romaneio informado",
    foto_romaneio: "Foto do romaneio",
    km_inicial_informado: "KM inicial",
    saiu_em_rota: "Saiu em rota",
    chegou_entrega: "Chegou na entrega",
    descarregamento_iniciado: "Descarga iniciada",
    descarga_finalizada: "Descarga finalizada",
    km_final_informado: "KM final",
    assinatura_capturada: "Assinatura",
    pod_registrado: "POD registrado",
    servico_finalizado: "Serviço finalizado",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl lg:max-w-2xl overflow-y-auto p-0">
        <div className="flex flex-col h-full">
          <SheetHeader className="px-5 pt-5 pb-2 border-b shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-5 h-5 text-indigo-500" />
              <SheetTitle className="text-base">
                {selectedActionItem?.os || osForm?.numero || (alocSemOSId ? `Alocação ${alocSemOSId.slice(0, 8)}` : `OS-${osId.slice(0, 8)}`)}
              </SheetTitle>
              {isConcluida ? (
                <Badge className="bg-emerald-500 text-white text-[10px]">Concluída</Badge>
              ) : isAtrasada ? (
                <Badge className="bg-rose-500 text-white text-[10px]">Atrasada</Badge>
              ) : (
                <Badge className="bg-blue-500 text-white text-[10px]">Em andamento</Badge>
              )}
              {selectedActionItem && (
                <Badge
                  className={`text-[10px] ${
                    selectedActionItem.prioridade === "critica" ? "bg-red-600 text-white"
                    : selectedActionItem.prioridade === "alta" ? "bg-orange-500 text-white"
                    : selectedActionItem.prioridade === "media" ? "bg-yellow-500 text-white"
                    : "bg-slate-400 text-white"
                  }`}
                >
                  {selectedActionItem.prioridade}
                </Badge>
              )}
            </div>
            <SheetDescription className="text-xs flex items-center gap-2 flex-wrap">
              <span>{selectedActionItem?.cliente || osForm?.cliente || "—"}</span>
              {(() => {
                const prestadorNome = selectedActionItem?.prestador && selectedActionItem.prestador !== "—"
                  ? selectedActionItem.prestador
                  : resolverPrestador?.(alocacaoAtiva?.prestador_id);
                if (!prestadorNome || prestadorNome === "—") return null;
                return (
                  <>
                    <span className="text-muted-foreground/40">•</span>
                    <span>{prestadorNome}</span>
                  </>
                );
              })()}
              {alocacaoAtiva?.placa && (
                <>
                  <span className="text-muted-foreground/40">•</span>
                  <span className="font-mono">{alocacaoAtiva.placa}</span>
                </>
              )}
            </SheetDescription>
          </SheetHeader>

          {!loading && (
            <div className="px-5 py-2 border-b bg-muted/20 flex items-center gap-1.5 flex-wrap shrink-0">
              <Badge className={slaInfo.cls}>{slaInfo.label}</Badge>
              {alocacaoAtiva?.status === "em_rota" && (
                gpsBadgeInfo
                  ? <Badge className={gpsBadgeInfo.cls}>{gpsBadgeInfo.label}</Badge>
                  : <Badge className="bg-rose-500 text-white">GPS Offline</Badge>
              )}
              {selectedActionItem?.prioridade && (
                <Badge className={
                  selectedActionItem.prioridade === "critica" ? "bg-rose-600 text-white"
                  : selectedActionItem.prioridade === "alta" ? "bg-orange-500 text-white"
                  : selectedActionItem.prioridade === "media" ? "bg-yellow-500 text-white"
                  : "bg-slate-400 text-white"
                }>
                  {selectedActionItem.prioridade}
                </Badge>
              )}
              <Badge className={pendenciasCount > 0 ? "bg-amber-500 text-white" : "bg-emerald-500 text-white"}>
                {pendenciasCount > 0 ? (
                  <>
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {pendenciasCount} pendência{pendenciasCount > 1 ? "s" : ""}
                  </>
                ) : "Sem pendências"}
              </Badge>
              {alocacaoAtiva?.status === "em_rota" && liveTracking && (
                <Badge className="bg-slate-500 text-white">
                  <Navigation className="w-3 h-3 mr-1" />
                  {liveTracking.velocidade != null && liveTracking.velocidade > 0 ? `${liveTracking.velocidade} km/h` : "Parado"}
                </Badge>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          ) : (
            <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
              <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-5 py-0 h-auto gap-0 shrink-0 overflow-x-auto">
                {[
                  { value: "visao-geral", label: "Geral", icon: Package },
                  { value: "detalhes", label: "Detalhes", icon: Building },
                  { value: "alocacao", label: "Programação", icon: Truck },
                  { value: "rastreamento", label: "GPS", icon: Navigation },
                  { value: "evidencias", label: "Evidências", icon: Camera },
                  { value: "ocorrencias", label: "Ocorrências", icon: AlertTriangle },
                  { value: "financeiro", label: "Financeiro", icon: DollarSign },
                  { value: "timeline", label: "Timeline", icon: History },
                  { value: "mensagens", label: "Mensagens", icon: MessageSquare },
                ].map(t => (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent px-3 py-2.5 text-[11px] font-semibold gap-1.5 shrink-0"
                  >
                    <t.icon className="w-3.5 h-3.5" />
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                {/* TAB 1 — VISÃO GERAL */}
                <TabsContent value="visao-geral" className="mt-0 space-y-5">
                  <div>
                    <SectionDivider title="Resumo Executivo" />
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-muted/10 rounded-lg p-2.5 text-center">
                        <p className="text-xl font-black text-foreground tabular-nums">{pendenciasResolvidas}/{pendenciaFields.length}</p>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Checklist</p>
                      </div>
                      <div className="bg-muted/10 rounded-lg p-2.5 text-center">
                        <p className={`text-xl font-black tabular-nums ${pod ? "text-emerald-500" : "text-rose-500"}`}>{pod ? "OK" : "—"}</p>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">POD</p>
                      </div>
                      <div className="bg-muted/10 rounded-lg p-2.5 text-center">
                        <p className={`text-xl font-black tabular-nums ${gpsBadgeInfo ? (gpsBadgeInfo.cls.includes("emerald") ? "text-emerald-500" : gpsBadgeInfo.cls.includes("amber") ? "text-amber-500" : "text-rose-500") : alocacaoAtiva?.status === "em_rota" ? "text-rose-500" : "text-slate-400"}`}>
                          {gpsBadgeInfo ? gpsBadgeInfo.label.replace("GPS ", "") : alocacaoAtiva?.status === "em_rota" ? "OFF" : "—"}
                        </p>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">GPS</p>
                      </div>
                    </div>
                    {pendenciaFields.length > 0 && (
                      <div className="px-1">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                          <span>Itens de conformidade</span>
                          <span className="font-semibold text-foreground tabular-nums">
                            {Math.round((pendenciasResolvidas / pendenciaFields.length) * 100)}%
                          </span>
                        </div>
                        <Progress value={(pendenciasResolvidas / pendenciaFields.length) * 100} className="h-2" />
                      </div>
                    )}
                  </div>

                  <div>
                    <SectionDivider title="Status da Operação" />
                    <InfoRow icon={<Package className="w-4 h-4" />} label="OS" value={selectedActionItem?.os || osForm?.numero || `OS-${osId.slice(0, 8)}`} />
                    <InfoRow icon={<Gauge className="w-4 h-4" />} label="Status OS" value={osForm?.status || "—"} />
                    {alocacaoAtiva && (
                      <InfoRow icon={<CheckCircle className="w-4 h-4" />} label="Status Programação" value={obterLabelStatus(alocacaoAtiva.status)} />
                    )}
                    {etapaApp && (
                      <InfoRow icon={<ArrowRight className="w-4 h-4" />} label="Etapa no App" value={etapaLabel[etapaApp] || etapaApp} />
                    )}
                    <InfoRow icon={<Hash className="w-4 h-4" />} label="Prioridade" value={osForm?.prioridade || "—"} />
                    <InfoRow icon={<User className="w-4 h-4" />} label="Responsável" value={osForm?.responsavel || "—"} />
                    {selectedOSData?.previsaoTermino && (
                      <InfoRow icon={<Clock className="w-4 h-4" />} label="Previsão de Término" value={fmtData(selectedOSData.previsaoTermino)} />
                    )}
                  </div>

                  <div>
                    <SectionDivider title="Prestador e Veículo" />
                    <InfoRow icon={<User className="w-4 h-4" />} label="Prestador" value={selectedActionItem?.prestador || resolverPrestador?.(alocacaoAtiva?.prestador_id) || "—"} />
                    <InfoRow icon={<Truck className="w-4 h-4" />} label="Tipo de Veículo" value={alocacaoAtiva?.tipo_veiculo || osForm?.veiculoTipo || "—"} />
                    <InfoRow icon={<Hash className="w-4 h-4" />} label="Placa" value={alocacaoAtiva?.placa || "—"} />
                  </div>

                  <div>
                    <SectionDivider title="Datas" />
                    <InfoRow icon={<Calendar className="w-4 h-4" />} label="Data Programada" value={fmtDataShort(osForm?.dataProgramada)} />
                    <InfoRow icon={<Calendar className="w-4 h-4" />} label="Início Real" value={alocacaoAtiva?.horario_inicio_real ? fmtData(alocacaoAtiva.horario_inicio_real) : "Não iniciado"} />
                    <InfoRow icon={<Calendar className="w-4 h-4" />} label="Fim Real" value={alocacaoAtiva?.horario_fim_real ? fmtData(alocacaoAtiva.horario_fim_real) : "—"} />
                    <InfoRow icon={<Gauge className="w-4 h-4" />} label="KM Previsto" value={alocacaoAtiva?.km_previstos != null ? `${alocacaoAtiva.km_previstos} km` : "—"} mono />
                    <InfoRow icon={<Gauge className="w-4 h-4" />} label="KM Realizado" value={alocacaoAtiva?.km_realizados != null ? `${alocacaoAtiva.km_realizados} km` : "—"} mono />
                  </div>

                  <div>
                    <SectionDivider title="Pendências Operacionais" />
                    {pendenciaFields.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">Nenhuma pendência detectada.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {pendenciaFields.map((p, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            {p.ok ? (
                              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                            ) : (
                              <XCircle className={`w-4 h-4 shrink-0 ${p.severity === "alta" ? "text-rose-500" : "text-amber-500"}`} />
                            )}
                            <span className={p.ok ? "text-muted-foreground" : "text-foreground font-medium"}>{p.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {osForm?.observacoesGerais && (
                    <div>
                      <SectionDivider title="Observações" />
                      <p className="text-sm text-muted-foreground bg-muted/20 rounded-lg p-3">{osForm.observacoesGerais}</p>
                    </div>
                  )}
                </TabsContent>

                {/* TAB 2 — DETALHES */}
                <TabsContent value="detalhes" className="mt-0 space-y-5">
                  <div>
                    <SectionDivider title="Origem e Destino" />
                    <InfoRow icon={<MapPin className="w-4 h-4" />} label="Origem" value={alocacaoAtiva?.origem || osForm?.unidade || "—"} />
                    <InfoRow icon={<MapPin className="w-4 h-4" />} label="Destino" value={alocacaoAtiva?.destino || "—"} />
                  </div>

                  {enderecosOS.length > 0 && (
                    <div>
                      <SectionDivider title={`Endereços (${enderecosOS.length})`} />
                      <div className="space-y-2">
                        {enderecosOS.map((end: any, i: number) => (
                          <Card key={i} className="bg-muted/10 border-border/30">
                            <CardContent className="p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-[10px]">
                                  {end.tipo || `Parada ${i + 1}`}
                                </Badge>
                                <span className="text-xs font-semibold">{end.nomeLocal || end.nome_destinatario || "—"}</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {[end.logradouro, end.numero, end.bairro, end.cidade, end.uf]
                                  .filter(Boolean).join(", ") || "Endereço não informado"}
                              </p>
                              {end.cep && <p className="text-[10px] text-muted-foreground mt-0.5">CEP: {end.cep}</p>}
                              {end.responsavel && <p className="text-[10px] text-muted-foreground">Contato: {end.responsavel}</p>}
                              {end.janelaInicio && (
                                <p className="text-[10px] text-muted-foreground">
                                  Janela: {end.janelaInicio} — {end.janelaFim || "—"}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <SectionDivider title="Carga" />
                    <InfoRow icon={<Package className="w-4 h-4" />} label="Tipo de Carga" value={osForm?.cargaTipo || "—"} />
                    <InfoRow icon={<FileText className="w-4 h-4" />} label="Descrição" value={osForm?.cargaDescricao || "—"} />
                    <InfoRow icon={<Hash className="w-4 h-4" />} label="Volumes" value={osForm?.volumes != null ? String(osForm.volumes) : "—"} mono />
                    <InfoRow icon={<Gauge className="w-4 h-4" />} label="Peso (kg)" value={osForm?.peso != null ? String(osForm.peso) : "—"} mono />
                    <InfoRow icon={<Package className="w-4 h-4" />} label="Cubagem (m³)" value={osForm?.cubagem != null ? String(osForm.cubagem) : "—"} mono />
                    <InfoRow icon={<Hash className="w-4 h-4" />} label="Pallets" value={osForm?.pallets != null ? String(osForm.pallets) : "—"} mono />
                    {osForm?.qtdNotas != null && (
                      <InfoRow icon={<Receipt className="w-4 h-4" />} label="Notas Fiscais" value={String(osForm.qtdNotas)} mono />
                    )}
                    <div className="flex flex-wrap gap-1 py-2">
                      {osForm?.cargaRefrigerada && <Badge variant="outline" className="text-[10px]">Refrigerada</Badge>}
                      {osForm?.cargaAjudante && <Badge variant="outline" className="text-[10px]">Ajudante</Badge>}
                      {osForm?.cargaFragil && <Badge variant="outline" className="text-[10px]">Frágil</Badge>}
                      {osForm?.cargaEmpilhavel && <Badge variant="outline" className="text-[10px]">Empilhável</Badge>}
                      {osForm?.cargaRisco && <Badge variant="outline" className="text-[10px]">Carga de Risco</Badge>}
                    </div>
                  </div>

                  {osForm?.instrucoesOperacionaisOS && (
                    <div>
                      <SectionDivider title="Instruções Operacionais" />
                      <p className="text-sm text-muted-foreground bg-muted/20 rounded-lg p-3">{osForm.instrucoesOperacionaisOS}</p>
                    </div>
                  )}
                </TabsContent>

                {/* TAB 3 — ALOCAÇÕES / ESCALA */}
                <TabsContent value="alocacao" className="mt-0 space-y-5">
                  {alocacoes.length === 0 ? (
                    <EmptyState message="Nenhuma alocação encontrada para esta OS" />
                  ) : (
                    alocacoes.map((a) => (
                      <Card key={a.id} className="bg-muted/10 border-border/30">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono text-muted-foreground">{a.id.slice(0, 8)}</span>
                            <Badge className={`text-[10px] ${obterClasseBadgeStatus(a.status)}`}>
                              {obterLabelStatus(a.status)}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase">Veículo</p>
                              <p className="font-medium">{a.tipo_veiculo || "—"} {a.placa ? `/ ${a.placa}` : ""}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase">KM</p>
                              <p className="font-medium font-mono">{a.km_previstos ?? "—"} prev / {a.km_realizados ?? "—"} real</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase">Origem</p>
                              <p className="font-medium truncate">{a.origem || "—"}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase">Destino</p>
                              <p className="font-medium truncate">{a.destino || "—"}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase">Data Programação</p>
                              <p className="font-medium">{fmtDataShort(a.data_escala)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase">Aceite</p>
                              <p className="font-medium">{a.aceite_prestador ? "Sim" : "Não"}{a.data_aceite ? ` (${fmtDataShort(a.data_aceite)})` : ""}</p>
                            </div>
                            {a.horario_inicio_real && (
                              <div>
                                <p className="text-[10px] text-muted-foreground uppercase">Início Real</p>
                                <p className="font-medium">{fmtData(a.horario_inicio_real)}</p>
                              </div>
                            )}
                            {a.horario_fim_real && (
                              <div>
                                <p className="text-[10px] text-muted-foreground uppercase">Fim Real</p>
                                <p className="font-medium">{fmtData(a.horario_fim_real)}</p>
                              </div>
                            )}
                          </div>
                          {a.finalizada && a.data_finalizacao && (
                            <p className="text-[10px] text-emerald-600 font-semibold">Finalizada em {fmtData(a.data_finalizacao)}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                {/* TAB 4 — RASTREAMENTO */}
                <TabsContent value="rastreamento" className="mt-0 space-y-5">
                  {liveTracking ? (
                    <>
                      {(() => {
                        const lastUpdate = liveTracking.captured_at || liveTracking.created_at;
                        const minSince = lastUpdate ? Math.floor((Date.now() - new Date(lastUpdate).getTime()) / 60000) : null;
                        const gpsState =
                          minSince === null ? "desconhecido"
                          : minSince <= 15 ? "atualizado"
                          : minSince <= 60 ? "antigo"
                          : "muito_antigo";

                        const gpsStateConfig = {
                          atualizado: { badge: "bg-emerald-500 text-white", label: "Atualizado", icon: CheckCircle, color: "text-emerald-500" },
                          antigo: { badge: "bg-amber-500 text-white", label: "Desatualizado", icon: Clock, color: "text-amber-500" },
                          muito_antigo: { badge: "bg-rose-500 text-white", label: "Muito antigo", icon: AlertTriangle, color: "text-rose-500" },
                          desconhecido: { badge: "bg-slate-400 text-white", label: "Status desconhecido", icon: AlertCircle, color: "text-slate-400" },
                        }[gpsState];

                        return (
                          <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                            gpsState === "atualizado" ? "bg-emerald-50 border-emerald-200"
                            : gpsState === "antigo" ? "bg-amber-50 border-amber-200"
                            : gpsState === "muito_antigo" ? "bg-rose-50 border-rose-200"
                            : "bg-slate-50 border-slate-200"
                          }`}>
                            <gpsStateConfig.icon className={`w-8 h-8 ${gpsStateConfig.color}`} />
                            <div>
                              <Badge className={`text-[10px] mb-1 ${gpsStateConfig.badge}`}>{gpsStateConfig.label}</Badge>
                              <p className="text-[11px] text-muted-foreground">
                                {minSince !== null ? `Última posição há ${minSince} minutos` : "Sem dados de atualização"}
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                      <div>
                        <SectionDivider title="Última Posição" />
                        <InfoRow icon={<MapPin className="w-4 h-4" />} label="Latitude" value={liveTracking.latitude.toFixed(6)} mono />
                        <InfoRow icon={<MapPin className="w-4 h-4" />} label="Longitude" value={liveTracking.longitude.toFixed(6)} mono />
                        <InfoRow icon={<Gauge className="w-4 h-4" />} label="Velocidade" value={liveTracking.velocidade != null ? `${liveTracking.velocidade} km/h` : "—"} mono />
                        <InfoRow icon={<Navigation className="w-4 h-4" />} label="Precisão GPS" value={liveTracking.precisao != null ? `±${liveTracking.precisao}m` : "—"} mono />
                        <InfoRow icon={<Navigation className="w-4 h-4" />} label="Direção" value={liveTracking.direcao != null ? `${liveTracking.direcao}°` : "—"} mono />
                        <InfoRow icon={<Clock className="w-4 h-4" />} label="Capturado em" value={fmtData(liveTracking.captured_at || liveTracking.created_at)} />
                        {liveTracking.captured_at && (
                          <InfoRow icon={<Clock className="w-4 h-4" />} label="Última atualização" value={`há ${timeAgo(liveTracking.captured_at)}`} />
                        )}
                      </div>
                      <div>
                        <SectionDivider title="Dados do Dispositivo" />
                        <InfoRow icon={<Gauge className="w-4 h-4" />} label="Bateria" value={liveTracking.bateria != null && liveTracking.bateria > 0 ? `${Math.round(liveTracking.bateria)}%` : "Bateria não informada"} mono />
                        <InfoRow icon={<Navigation className="w-4 h-4" />} label="Origem dos dados" value={liveTracking.origem || "app_motorista"} />
                      </div>
                    </>
                  ) : alocacaoAtiva && alocacaoAtiva.status === "em_rota" ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Navigation className="w-10 h-10 mb-3 text-rose-300" />
                      <p className="text-sm font-semibold text-rose-600">GPS Indisponível</p>
                      <p className="text-xs text-muted-foreground mt-1 text-center">
                        O motorista está em rota mas não há posição GPS registrada.
                      </p>
                    </div>
                  ) : (
                    <EmptyState message="Nenhuma posição GPS registrada para esta operação" />
                  )}
                </TabsContent>

                {/* TAB 5 — EVIDÊNCIAS */}
                <TabsContent value="evidencias" className="mt-0 space-y-5">
                  {pod ? (
                    <>
                      <div>
                        <SectionDivider title="Dados do Recebedor" />
                        <InfoRow icon={<User className="w-4 h-4" />} label="Nome" value={pod.nome_recebedor || "—"} />
                        <InfoRow icon={<Hash className="w-4 h-4" />} label="Documento" value={pod.documento_recebedor || "—"} />
                        <InfoRow icon={<Clock className="w-4 h-4" />} label="Data/Hora Entrega" value={fmtData(pod.data_hora_entrega)} />
                        <InfoRow icon={<CheckCircle className="w-4 h-4" />} label="Status POD" value={pod.status || "—"} />
                      </div>

                      {pod.foto_entrega_url && (
                        <div>
                          <SectionDivider title="Foto da Entrega" />
                          <a href={pod.foto_entrega_url} target="_blank" rel="noreferrer" className="block">
                            <img
                              src={pod.foto_entrega_url}
                              alt="Foto da entrega"
                              className="w-full max-h-64 object-cover rounded-lg border"
                              loading="lazy"
                            />
                          </a>
                        </div>
                      )}
                      {pod.foto_canhoto_url && (
                        <div>
                          <SectionDivider title="Canhoto" />
                          <a href={pod.foto_canhoto_url} target="_blank" rel="noreferrer" className="block">
                            <img
                              src={pod.foto_canhoto_url}
                              alt="Canhoto"
                              className="w-full max-h-64 object-cover rounded-lg border"
                              loading="lazy"
                            />
                          </a>
                        </div>
                      )}
                      {pod.assinatura_url && (
                        <div>
                          <SectionDivider title="Assinatura" />
                          <a href={pod.assinatura_url} target="_blank" rel="noreferrer" className="block">
                            <img
                              src={pod.assinatura_url}
                              alt="Assinatura do recebedor"
                              className="w-full max-h-32 object-contain rounded-lg border bg-white p-2"
                              loading="lazy"
                            />
                          </a>
                        </div>
                      )}
                      {pod.observacao && (
                        <div>
                          <SectionDivider title="Observação do Motorista" />
                          <p className="text-sm text-muted-foreground bg-muted/20 rounded-lg p-3">{pod.observacao}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <EmptyState message="Nenhuma evidência registrada para esta operação" />
                  )}
                </TabsContent>

                {/* TAB 6 — OCORRÊNCIAS */}
                <TabsContent value="ocorrencias" className="mt-0 space-y-5">
                  {selectedOSOcorrencia ? (
                    <Card className="border-rose-200 bg-rose-50/50">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-rose-500" />
                          <span className="text-sm font-bold text-rose-700">Ocorrência Registrada</span>
                          <Badge className={`text-[10px] ${
                            (selectedOSOcorrencia as any).severidade === "critica" ? "bg-red-600 text-white" : "bg-amber-500 text-white"
                          }`}>
                            {(selectedOSOcorrencia as any).severidade || "—"}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase">Tipo</p>
                            <p className="font-semibold">{(selectedOSOcorrencia as any).tipo || "—"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase">Status</p>
                            <p className="font-semibold">{(selectedOSOcorrencia as any).status || "pendente"}</p>
                          </div>
                        </div>
                        {(selectedOSOcorrencia as any).descricao && (
                          <p className="text-xs text-muted-foreground">{(selectedOSOcorrencia as any).descricao}</p>
                        )}
                        {(selectedOSOcorrencia as any).created_at && (
                          <p className="text-[10px] text-muted-foreground">
                            Aberta em {fmtData((selectedOSOcorrencia as any).created_at)}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <EmptyState message="Nenhuma ocorrência vinculada a esta OS" />
                  )}
                </TabsContent>

                {/* TAB 7 — FINANCEIRO */}
                <TabsContent value="financeiro" className="mt-0 space-y-5">
                  <div>
                    <SectionDivider title="Valores da Operação" />
                    <InfoRow icon={<DollarSign className="w-4 h-4" />} label="Valor Cliente (Frete)" value={verReceitaMargem ? fmtFin(osForm?.valorCliente) : "---"} mono />
                    <InfoRow icon={<DollarSign className="w-4 h-4" />} label="Valor Prestador (Repasse)" value={fmtFin(alocacaoAtiva?.valor_repasse)} mono />
                    <InfoRow icon={<DollarSign className="w-4 h-4" />} label="Pedágio" value={fmtFin(alocacaoAtiva?.valor_pedagio)} mono />
                    <InfoRow icon={<DollarSign className="w-4 h-4" />} label="Ajudante" value={fmtFin(alocacaoAtiva?.valor_ajudante)} mono />
                    <InfoRow icon={<DollarSign className="w-4 h-4" />} label="Adicional" value={fmtFin(alocacaoAtiva?.valor_adicional)} mono />
                    <InfoRow icon={<DollarSign className="w-4 h-4" />} label="Desconto" value={fmtFin(alocacaoAtiva?.valor_desconto)} mono />
                  </div>

                  {composicao && (
                    <div>
                      <SectionDivider title="Composição Financeira" />
                      <InfoRow icon={<Percent className="w-4 h-4" />} label="Margem Bruta" value={verReceitaMargem ? (composicao.percentual_margem_bruta != null ? `${composicao.percentual_margem_bruta}%` : "—") : "---"} mono />
                      <InfoRow icon={<Percent className="w-4 h-4" />} label="Margem Líquida" value={verReceitaMargem ? (composicao.percentual_margem_liquida != null ? `${composicao.percentual_margem_liquida}%` : "—") : "---"} mono />
                      <InfoRow icon={<DollarSign className="w-4 h-4" />} label="Impostos" value={fmtFin(composicao.impostos)} mono />
                      <InfoRow icon={<DollarSign className="w-4 h-4" />} label="Seguro" value={fmtFin(composicao.seguro)} mono />
                      <InfoRow icon={<DollarSign className="w-4 h-4" />} label="Custos Operacionais" value={fmtFin(composicao.custos_operacionais)} mono />
                    </div>
                  )}
                </TabsContent>

                {/* TAB 8 — TIMELINE */}
                <TabsContent value="timeline" className="mt-0">
                  {contextualTimelineEvents.length === 0 ? (
                    <EmptyState message="Nenhum evento operacional registrado" />
                  ) : (
                    <div className="space-y-1.5">
                      {contextualTimelineEvents.map((event) => {
                        const IconComp = TIMELINE_ICONS[event.tipoEvento] || Clock;
                        const colors = TIMELINE_COLORS[event.tipoEvento] || TIMELINE_COLORS.os_criada;
                        const SeveridadeBadge = SEVERIDADE_BADGE[event.severidade] || SEVERIDADE_BADGE.baixa;
                        return (
                          <div
                            key={event.id}
                            className="flex items-start gap-3 rounded-lg p-2.5 border-l-[3px]"
                            style={{ borderLeftColor: colors.dot, backgroundColor: colors.bg }}
                          >
                            <div
                              className="p-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: colors.bg, color: colors.dot }}
                            >
                              <IconComp className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold truncate">{event.descricao}</span>
                                <span className="text-[10px] text-muted-foreground font-mono tabular-nums shrink-0">
                                  {timeAgo(event.timestamp)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                                <SeveridadeBadge />
                                <span className="font-medium" style={{ color: colors.dot }}>
                                  {TIMELINE_LABELS[event.tipoEvento] || event.stage || "Evento"}
                                </span>
                                {event.cliente !== "—" && <span>• {event.cliente}</span>}
                                {event.prestador !== "—" && <span>• {event.prestador}</span>}
                                {event.source && event.source !== "sistema" && (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                                    {event.source === "app_motorista" ? "App Motorista" : event.source}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
                {/* TAB 9 — MENSAGENS (Chat Operacional A22) */}
                <TabsContent value="mensagens" className="mt-0 h-full">
                  {alocacaoAtiva ? (
                    <ChatOperacaoPanel
                      alocacaoId={alocacaoAtiva.id}
                      prestadorNome={
                        resolverPrestador?.(alocacaoAtiva.prestador_id) ||
                        selectedActionItem?.prestador ||
                        "Motorista"
                      }
                      osNumero={
                        selectedActionItem?.os ||
                        osForm?.numero ||
                        (osFull as any)?.numero ||
                        undefined
                      }
                    />
                  ) : (
                    <EmptyState message="Nenhuma alocação vinculada para abrir o chat da operação" />
                  )}
                </TabsContent>
              </div>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
