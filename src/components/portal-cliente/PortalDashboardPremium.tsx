import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, TrendingUp, TrendingDown, BarChart3, Clock, CheckCircle2, AlertTriangle,
  AlertCircle, Package, Truck, FileText, DollarSign, Calendar, RefreshCw, ChevronRight,
  Percent, Target, Zap, MapPin, Users, Eye, TrendingEqual,
  ChevronDown, Filter, ArrowUp, ArrowDown, X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PortalEmptyState, PortalKpiCard, PortalInsightCard, PortalSectionCard } from "@/components/portal-cliente";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, Cell } from "recharts";

type PeriodoKey = "hoje" | "7d" | "30d" | "90d" | "personalizado";

interface PortalDashboardPremiumProps {
  entregas: any[];
  faturas: any[];
  ocorrencias: any[];
  comprovantes: any[];
  clienteData: any;
  operacaoStatus: "saudavel" | "atencao" | "critico";
  onSetActiveTab: (tab: string) => void;
  onRefresh: () => void;
  getSaudacao: () => string;
  user?: any;
  insights: any[];
  patioData: any[];
  buscouPatio: boolean;
}

const fmtFin = (v: number | null | undefined) => {
  if (v === null || v === undefined || isNaN(v)) return "R$ 0,00";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const fmtHora = (d: string | null | undefined) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
};

const fmtData = (d: string | null | undefined) => {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return "—";
    return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return "—"; }
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-800 text-white p-3 rounded-xl shadow-xl">
        <p className="text-xs font-bold text-slate-400 mb-1.5">{label}</p>
        {payload.map((item: any) => (
          <div key={item.name} className="flex items-center justify-between gap-4 text-xs my-0.5">
            <span className="flex items-center gap-1 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}:
            </span>
            <span className="font-bold" style={{ color: item.color }}>{item.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function PortalDashboardPremium({
  entregas, faturas, ocorrencias, comprovantes, clienteData,
  operacaoStatus, onSetActiveTab, onRefresh, getSaudacao, user,
  insights, patioData, buscouPatio,
}: PortalDashboardPremiumProps) {
  const [periodo, setPeriodo] = useState<PeriodoKey>("30d");
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split("T")[0];
  });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().split("T")[0]);

  const dataCorte = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999);
    if (periodo === "hoje") {
      const d = new Date(); d.setHours(0, 0, 0, 0); return d;
    }
    if (periodo === "personalizado") return new Date(dataInicio + "T00:00:00");
    const dias = { "7d": 7, "30d": 30, "90d": 90 }[periodo] || 30;
    const d = new Date(); d.setDate(d.getDate() - dias); d.setHours(0, 0, 0, 0);
    return d;
  }, [periodo, dataInicio]);

  const periodoAnterior = useMemo(() => {
    const diff = periodo === "hoje" ? 1 : periodo === "7d" ? 7 : periodo === "30d" ? 30 : periodo === "90d" ? 90 : 30;
    return {
      inicio: new Date(dataCorte.getTime() - diff * 86400000),
      fim: new Date(dataCorte.getTime() - 86400000),
    };
  }, [dataCorte, periodo]);

  const dataFimPeriodo = useMemo(() => {
    if (periodo === "personalizado") return new Date(dataFim + "T23:59:59");
    const hoje = new Date(); hoje.setHours(23, 59, 59, 999); return hoje;
  }, [periodo, dataFim]);

  const stats = useMemo(() => {
    const filtradas = entregas.filter(e => {
      const d = e.created_at ? new Date(e.created_at) : null;
      if (!d) return false;
      return d >= dataCorte && d <= dataFimPeriodo;
    });

    const statsAnteriores = entregas.filter(e => {
      const d = e.created_at ? new Date(e.created_at) : null;
      if (!d) return false;
      return d >= periodoAnterior.inicio && d <= periodoAnterior.fim;
    });

    const total = filtradas.length;
    const emAndamento = filtradas.filter(e => e.status !== "entregue" && e.status !== "cancelada" && e.status !== "atrasada").length;
    const concluidas = filtradas.filter(e => e.status === "entregue").length;
    const atrasadas = filtradas.filter(e => e.status === "atrasada" || e.status === "problema").length;
    const sla = total > 0 ? Math.round(((total - atrasadas) / total) * 100) : 100;
    const ocorrenciasCount = ocorrencias.filter(o => {
      const d = o.created_at ? new Date(o.created_at) : null;
      if (!d) return false;
      return d >= dataCorte && d <= dataFimPeriodo;
    }).length;
    const comprovPendentes = comprovantes.length;

    const totalAnterior = statsAnteriores.length;
    const concluidasAnterior = statsAnteriores.filter(e => e.status === "entregue").length;

    const tendenciaTotal = totalAnterior > 0 ? Math.round(((total - totalAnterior) / totalAnterior) * 100) : total > 0 ? 100 : 0;
    const tendenciaConcluidas = concluidasAnterior > 0 ? Math.round(((concluidas - concluidasAnterior) / concluidasAnterior) * 100) : concluidas > 0 ? 100 : 0;

    return { total, emAndamento, concluidas, atrasadas, sla, ocorrenciasCount, comprovPendentes, tendenciaTotal, tendenciaConcluidas, totalAnterior, concluidasAnterior };
  }, [entregas, ocorrencias, comprovantes, dataCorte, dataFimPeriodo, periodoAnterior]);

  const needAttention = useMemo(() => {
    const items: { icon: any; tipo: string; desc: string; prioridade: string; acao: string }[] = [];
    if (stats.atrasadas > 0) items.push({ icon: AlertTriangle, tipo: "Operacional", desc: `${stats.atrasadas} operação(oes) com atraso`, prioridade: "alta", acao: "pedidos" });
    if (stats.ocorrenciasCount > 0) items.push({ icon: AlertCircle, tipo: "Ocorrência", desc: `${stats.ocorrenciasCount} ocorrência(s) ativa(s)`, prioridade: stats.ocorrenciasCount > 3 ? "alta" : "media", acao: "ocorrencias" });
    if (stats.sla < 85) items.push({ icon: Clock, tipo: "SLA", desc: `SLA médio de ${stats.sla}% — abaixo do esperado`, prioridade: "alta", acao: "relatorios" });
    return items;
  }, [stats]);

  const graficoData = useMemo(() => {
    const diffDays = Math.ceil((dataFimPeriodo.getTime() - dataCorte.getTime()) / 86400000);
    const pontos = Math.min(diffDays, 14);
    const dates = Array.from({ length: pontos }, (_, i) => {
      const d = new Date(dataCorte);
      d.setDate(d.getDate() + Math.floor((diffDays / Math.max(1, pontos - 1)) * i));
      return d;
    });

    return dates.map(date => {
      const dateStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      const dateKey = date.toDateString();
      const diaEntregas = entregas.filter(e => {
        if (!e.created_at) return false;
        return new Date(e.created_at).toDateString() === dateKey;
      });
      return {
        name: dateStr,
        Entregas: diaEntregas.length,
        Concluídas: diaEntregas.filter(e => e.status === "entregue").length,
        Atrasos: diaEntregas.filter(e => e.status === "atrasada" || e.status === "problema").length,
      };
    });
  }, [entregas, dataCorte, dataFimPeriodo]);

  const periodoLabel = useMemo(() => {
    const labels: Record<PeriodoKey, string> = {
      hoje: "Hoje",
      "7d": "Últimos 7 dias",
      "30d": "Últimos 30 dias",
      "90d": "Últimos 90 dias",
      personalizado: `${dataInicio} a ${dataFim}`,
    };
    return labels[periodo];
  }, [periodo, dataInicio, dataFim]);

  if (entregas.length === 0 && !buscouPatio) {
    return (
      <PortalEmptyState
        type="sem-dados"
        title="Bem-vindo ao Centro de Controle"
        description="Assim que houver operações registradas para sua empresa, elas aparecerão aqui. Entre em contato com nossa equipe para iniciar."
        icon={Activity}
      />
    );
  }

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-[#E5E7EB] shadow-sm p-6 lg:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50/60 rounded-full blur-3xl -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-50/30 rounded-full blur-2xl -ml-8 -mb-8" />

        <div className="relative z-10 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
                <span className="text-[10px] font-black text-[#F97316] uppercase tracking-[0.2em]">Centro de Controle Operacional</span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                {getSaudacao()}, {user?.name || "Bem-vindo novamente"}
              </h1>
              <p className="text-[#64748B] text-sm mt-0.5 font-medium">
                {clienteData?.nome_fantasia || clienteData?.razao_social || "Cliente Corporativo"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border ${
                operacaoStatus === "saudavel" ? "bg-emerald-50 border-emerald-200" :
                operacaoStatus === "atencao" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  operacaoStatus === "saudavel" ? "bg-emerald-500" : operacaoStatus === "atencao" ? "bg-amber-500" : "bg-red-500"
                }`} />
                <span className={`text-xs font-black uppercase tracking-wider ${
                  operacaoStatus === "saudavel" ? "text-emerald-700" : operacaoStatus === "atencao" ? "text-amber-700" : "text-red-700"
                }`}>
                  {operacaoStatus === "saudavel" ? "Operação Saudável" : operacaoStatus === "atencao" ? "Em Atenção" : "Operação Crítica"}
                </span>
              </div>
            </div>
          </div>

          {/* Período Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mr-1">Período:</span>
            {(["hoje", "7d", "30d", "90d"] as PeriodoKey[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  periodo === p ? "bg-[#F97316] text-white shadow-md shadow-orange-500/20" : "bg-[#F8FAFC] text-[#64748B] border border-[#E5E7EB] hover:border-[#CBD5E1]"
                }`}
              >
                {p === "hoje" ? "Hoje" : p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "90 dias"}
              </button>
            ))}
            <button
              onClick={() => setPeriodo("personalizado")}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${
                periodo === "personalizado" ? "bg-[#F97316] text-white shadow-md shadow-orange-500/20" : "bg-[#F8FAFC] text-[#64748B] border border-[#E5E7EB] hover:border-[#CBD5E1]"
              }`}
            >
              <Calendar className="w-3 h-3" /> Personalizado
            </button>
            {periodo === "personalizado" && (
              <div className="flex items-center gap-2 ml-1">
                <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="h-8 w-[140px] rounded-full bg-white border-[#E5E7EB] text-xs" />
                <span className="text-xs text-[#64748B]">a</span>
                <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-8 w-[140px] rounded-full bg-white border-[#E5E7EB] text-xs" />
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] text-[#94A3B8] font-medium">{periodoLabel}</span>
              <button onClick={onRefresh} className="text-xs font-bold text-[#F97316] hover:text-[#EA580C] transition-colors flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Atualizar
              </button>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { label: "Total", value: stats.total, icon: Package, color: "text-[#F97316] bg-orange-50", border: "border-l-[#F97316]" },
              { label: "Em Andamento", value: stats.emAndamento, icon: Truck, color: "text-blue-600 bg-blue-50", border: "border-l-blue-500" },
              { label: "Concluídas", value: stats.concluidas, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50", border: "border-l-emerald-500" },
              { label: "Atrasadas", value: stats.atrasadas, icon: AlertTriangle, color: "text-red-600 bg-red-50", border: "border-l-red-500" },
              { label: "SLA Médio", value: `${stats.sla}%`, icon: Target, color: stats.sla >= 95 ? "text-emerald-600 bg-emerald-50" : stats.sla >= 80 ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50", border: `border-l-${stats.sla >= 95 ? "emerald-500" : stats.sla >= 80 ? "amber-500" : "red-500"}` },
              { label: "Ocorrências", value: stats.ocorrenciasCount, icon: AlertCircle, color: "text-purple-600 bg-purple-50", border: "border-l-purple-500" },
              { label: "Comprovantes", value: stats.comprovPendentes, icon: FileText, color: "text-cyan-600 bg-cyan-50", border: "border-l-cyan-500" },
              { label: "Faturamento", value: fmtFin(faturas.filter(f => f.status === "paga").reduce((a: number, f: any) => a + (f.valor || 0), 0)), icon: DollarSign, color: "text-emerald-600 bg-emerald-50", border: "border-l-emerald-500" },
            ].map((m, i) => (
              <motion.div
                key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`bg-[#F8FAFC] rounded-2xl border-l-4 ${m.border} border border-[#E5E7EB] p-3.5 hover:shadow-md transition-all`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">{m.label}</p>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${m.color}`}>
                    <m.icon className="w-3.5 h-3.5" />
                  </div>
                </div>
                <p className="text-xl font-extrabold text-[#0F172A] tabular-nums">{m.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Resumo Executivo */}
          <div className="flex items-start gap-3 px-5 py-4 rounded-2xl bg-[#F8FAFC] border border-[#E5E7EB]">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              operacaoStatus === "saudavel" ? "bg-emerald-50 text-emerald-600" :
              operacaoStatus === "atencao" ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
            }`}>
              {operacaoStatus === "saudavel" ? <CheckCircle2 className="w-4 h-4" /> :
               operacaoStatus === "atencao" ? <AlertTriangle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            </div>
            <div className="flex-1">
              <p className="text-xs font-black text-[#64748B] uppercase tracking-wider mb-1">Resumo Executivo</p>
              <p className="text-sm text-[#334155] leading-relaxed font-medium">
                {operacaoStatus === "saudavel"
                  ? `Operação saudável no período — ${stats.concluidas} entregas concluídas com SLA de ${stats.sla}%.`
                  : operacaoStatus === "atencao"
                    ? `${stats.atrasadas} atraso(s) e ${stats.ocorrenciasCount} ocorrência(s) no período. SLA em ${stats.sla}%.`
                    : `Operação crítica — ${stats.atrasadas} atraso(s) detectados. SLA de ${stats.sla}% requer atenção imediata.`
                }
                {stats.tendenciaConcluidas !== 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs font-bold">
                    {stats.tendenciaConcluidas > 0 ? (
                      <><ArrowUp className="w-3 h-3 text-emerald-500" /><span className="text-emerald-600">{stats.tendenciaConcluidas}% vs período anterior</span></>
                    ) : (
                      <><ArrowDown className="w-3 h-3 text-red-500" /><span className="text-red-600">{Math.abs(stats.tendenciaConcluidas)}% vs período anterior</span></>
                    )}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Tendência */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Concluídas", atual: stats.concluidas, anterior: stats.concluidasAnterior, tendencia: stats.tendenciaConcluidas, icon: TrendingUp },
              { label: "Total Operações", atual: stats.total, anterior: stats.totalAnterior, tendencia: stats.tendenciaTotal, icon: BarChart3 },
              { label: "SLA", atual: stats.sla, anterior: 100, tendencia: stats.sla - 100, icon: Percent, isPct: true },
              { label: "Atrasos", atual: stats.atrasadas, anterior: 0, tendencia: stats.atrasadas > 0 ? 100 : 0, icon: TrendingDown, invert: true },
            ].map((m, i) => (
              <div key={i} className="bg-white rounded-xl border border-[#E5E7EB] p-3">
                <div className="flex items-center gap-1.5 text-[10px] text-[#64748B] font-bold uppercase tracking-wider mb-1">
                  <m.icon className="w-3 h-3" /> {m.label}
                </div>
                <p className="text-lg font-extrabold text-[#0F172A]">{m.isPct ? `${m.atual}%` : m.atual}</p>
                {m.tendencia !== 0 && (
                  <div className={`flex items-center gap-1 text-[10px] font-bold mt-0.5 ${(!m.invert && m.tendencia > 0) || (m.invert && m.tendencia < 0) ? "text-emerald-600" : "text-red-500"}`}>
                    {(!m.invert && m.tendencia > 0) || (m.invert && m.tendencia < 0) ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    {Math.abs(m.tendencia)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* REQUER ATENÇÃO */}
      {needAttention.length > 0 && (
        <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="pb-2 border-b border-[#F1F5F9]">
            <CardTitle className="text-sm font-extrabold text-[#0F172A] flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              </div>
              Requer Atenção
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-1.5">
              {needAttention.map((item, i) => (
                <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all hover:shadow-sm ${
                  item.prioridade === "alta" ? "bg-red-50/40 border-red-100 hover:border-red-200" : "bg-amber-50/40 border-amber-100 hover:border-amber-200"
                }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    item.prioridade === "alta" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                  }`}>
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#94A3B8]">{item.tipo}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${item.prioridade === "alta" ? "text-red-500" : "text-amber-600"}`}>
                        {item.prioridade === "alta" ? "Urgente" : "Atenção"}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[#334155] mt-0.5">{item.desc}</p>
                  </div>
                  <Button size="sm" variant="ghost" className={`text-[11px] font-bold rounded-lg ${
                    item.prioridade === "alta" ? "text-red-600 hover:bg-red-50" : "text-amber-600 hover:bg-amber-50"
                  }`} onClick={() => onSetActiveTab(item.acao)}>
                    Ver <ChevronRight className="w-3 h-3 ml-0.5" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* GRÁFICO + RESUMO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2 bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-[#F1F5F9]">
            <div>
              <CardTitle className="text-sm font-extrabold text-[#0F172A]">Evolução de Entregas</CardTitle>
              <CardDescription className="text-xs text-[#94A3B8]">{periodoLabel}</CardDescription>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold">
              <span className="flex items-center gap-1.5 text-[#F97316]"><span className="w-2.5 h-2.5 rounded-full bg-[#F97316]" />Entregas</span>
              <span className="flex items-center gap-1.5 text-emerald-600"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Concluídas</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full pt-4">
              {graficoData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={graficoData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorEntregas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F97316" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#F97316" stopOpacity={0.01}/>
                      </linearGradient>
                      <linearGradient id="colorConcluidas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.01}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} dy={8} />
                    <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} dx={-8} allowDecimals={false} />
                    <ChartTooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="Entregas" stroke="#F97316" strokeWidth={3} fillOpacity={1} fill="url(#colorEntregas)" />
                    <Area type="monotone" dataKey="Concluídas" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorConcluidas)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <PortalEmptyState type="sem-dados" title="Sem dados no período" description="Nenhuma entrega registrada no período selecionado." />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cards de Resumo */}
        <div className="space-y-3">
          <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
            <CardHeader className="pb-3 border-b border-[#F1F5F9]">
              <CardTitle className="text-sm font-extrabold text-[#0F172A] flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-orange-50 flex items-center justify-center">
                  <BarChart3 className="w-3.5 h-3.5 text-[#F97316]" />
                </div>
                Resumo da Operação
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                {[
                  { label: "Concluídas", value: stats.concluidas, total: Math.max(stats.total, 1), color: "bg-emerald-500", pct: stats.total > 0 ? Math.round((stats.concluidas / stats.total) * 100) : 0 },
                  { label: "Dentro do SLA", value: `${stats.sla}%`, total: 100, color: stats.sla >= 95 ? "bg-[#F97316]" : stats.sla >= 80 ? "bg-amber-500" : "bg-red-500", pct: stats.sla },
                  { label: "Ocorrências", value: stats.ocorrenciasCount, total: 0, color: stats.ocorrenciasCount > 0 ? "bg-red-500" : "bg-slate-200", pct: stats.ocorrenciasCount > 0 ? 100 : 0 },
                ].map((item, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#475569]">{item.label}</span>
                      <span className="text-xs font-extrabold text-[#0F172A] tabular-nums">{item.value}</span>
                    </div>
                    <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${item.color}`} style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
            <CardHeader className="pb-3 border-b border-[#F1F5F9]">
              <CardTitle className="text-sm font-extrabold text-[#0F172A] flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center">
                  <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                </div>
                Indicadores Financeiros
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#F8FAFC] rounded-xl p-3">
                  <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-wider mb-1">Faturado</p>
                  <p className="text-base font-extrabold text-[#0F172A]">{fmtFin(faturas.filter((f: any) => f.status === "paga").reduce((a: number, f: any) => a + (f.valor || 0), 0))}</p>
                </div>
                <div className="bg-[#F8FAFC] rounded-xl p-3">
                  <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-wider mb-1">A Receber</p>
                  <p className="text-base font-extrabold text-[#0F172A]">{fmtFin(faturas.filter((f: any) => f.status !== "paga").reduce((a: number, f: any) => a + (f.valor || 0), 0))}</p>
                </div>
                <div className="bg-[#F8FAFC] rounded-xl p-3">
                  <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-wider mb-1">Ticket Médio</p>
                  <p className="text-base font-extrabold text-[#0F172A]">{fmtFin(entregas.length > 0 ? entregas.reduce((a: number, e: any) => a + (e.valor_frete || 0), 0) / entregas.length : 0)}</p>
                </div>
                <div className="bg-[#F8FAFC] rounded-xl p-3">
                  <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-wider mb-1">Volumes</p>
                  <p className="text-base font-extrabold text-[#0F172A]">{entregas.reduce((a: number, e: any) => a + (e.volumes || 0), 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* INSIGHTS */}
      {insights.length > 0 && (
        <PortalSectionCard title="Análise Operacional" description="Recomendações baseadas no histórico operacional">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {insights.slice(0, 6).map((insight, idx) => (
              <PortalInsightCard key={idx} type={insight.type} title={insight.title} description={insight.description} priority={insight.priority} metric={insight.metric} suggestion={insight.suggestion} />
            ))}
          </div>
        </PortalSectionCard>
      )}

      {/* FOOTER */}
      <div className="flex items-center justify-between text-[11px] text-[#94A3B8] font-medium">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          Atualizado {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
        <span>{entregas.length} entregas registradas · {periodoLabel}</span>
      </div>
    </div>
  );
}
