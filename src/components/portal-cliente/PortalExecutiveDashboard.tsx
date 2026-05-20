import { LucideIcon, TrendingUp, TrendingDown, Activity, DollarSign, Package, Truck, Clock, Users, MapPin, AlertTriangle, CheckCircle, BarChart3, Target, Zap, Calendar, Award, Download, ArrowUpRight, ArrowDownRight, Sparkles, Filter, ChevronDown, Share2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { PortalKpiCard } from "./PortalKpiCard";

interface ExecutiveMetrics {
  slaGeral: number;
  slaMeta: number;
  produtividade: number;
  custoPorEntrega: number;
  custoPorRegiao: { regiao: string; custo: number; entrega: number }[];
  economiaOperacional: number;
  comparativoMensal: { mes: string; atual: number; anterior: number }[];
  comparativoFiliais: { filial: string; produtividade: number; sla: number; tendencia: "up" | "down" | "stable" }[];
  tendenciaOperacional: "crescendo" | "estavel" | "declinando";
  heatmap: { dia: string; hora: number; volume: number }[];
  rankingUnidades: { unidade: string; posicao: number; score: number; tendencia: string }[];
  rankingRegioes: { regiao: string; posicao: number; volume: number }[];
  devolucoes: number;
  devolucoesMeta: number;
  urgencias: number;
  volumeTransportado: number;
  volumeUnidade: string;
  tendencia7dias: number;
  tendencia30dias: number;
  previsaoProxSemana: number;
}

interface PortalExecutiveDashboardProps {
  metrics?: ExecutiveMetrics;
}

type PeriodFilter = "hoje" | "7dias" | "30dias" | "mes_atual" | "personalizado";

const trendColors = {
  crescendo: { text: "text-emerald-600", bg: "bg-emerald-50", icon: TrendingUp, label: "Em Expansão" },
  estavel: { text: "text-slate-500", bg: "bg-slate-50", icon: Activity, label: "Estável" },
  declinando: { text: "text-rose-600", bg: "bg-rose-50", icon: TrendingDown, label: "Retração" },
};

const periodLabels: Record<PeriodFilter, string> = {
  hoje: "Hoje",
  "7dias": "Últimos 7 dias",
  "30dias": "Últimos 30 dias",
  mes_atual: "Mês Atual",
  personalizado: "Personalizado",
};

const defaultMetrics: ExecutiveMetrics = {
  slaGeral: 98.4,
  slaMeta: 95,
  produtividade: 94.2,
  custoPorEntrega: 42.50,
  custoPorRegiao: [
    { regiao: "Zona Sul", custo: 12500, entrega: 280 },
    { regiao: "Centro", custo: 9800, entrega: 220 },
    { regiao: "Zona Oeste", custo: 8700, entrega: 190 },
    { regiao: "Zona Leste", custo: 6300, entrega: 140 },
  ],
  economiaOperacional: 22450.80,
  comparativoMensal: [
    { mes: "Jan", atual: 1250, anterior: 1100 },
    { mes: "Fev", atual: 1380, anterior: 1150 },
    { mes: "Mar", atual: 1450, anterior: 1200 },
  ],
  comparativoFiliais: [
    { filial: "Matriz SP", produtividade: 96, sla: 98, tendencia: "up" as const },
    { filial: "Filial Mooca", produtividade: 92, sla: 95, tendencia: "stable" as const },
    { filial: "Filial ABC", produtividade: 89, sla: 93, tendencia: "down" as const },
    { filial: "CD Interlagos", produtividade: 94, sla: 96, tendencia: "up" as const },
  ],
  tendenciaOperacional: "crescendo",
  heatmap: Array.from({ length: 7 }, (_, d) => ({
    dia: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][d],
    hora: Math.floor(Math.random() * 24),
    volume: Math.floor(Math.random() * 100) + 20,
  })),
  rankingUnidades: [
    { unidade: "Matriz SP", posicao: 1, score: 98.5, tendencia: "+4.2%" },
    { unidade: "CD Interlagos", posicao: 2, score: 94.8, tendencia: "+1.8%" },
    { unidade: "Filial Mooca", posicao: 3, score: 91.2, tendencia: "-0.5%" },
    { unidade: "Filial ABC", posicao: 4, score: 87.5, tendencia: "+2.1%" },
    { unidade: "Zona Sul", posicao: 5, score: 85.0, tendencia: "+0.8%" },
  ],
  rankingRegioes: [
    { regiao: "Centro", posicao: 1, volume: 450 },
    { regiao: "Zona Sul", posicao: 2, volume: 380 },
    { regiao: "Zona Oeste", posicao: 3, volume: 290 },
    { regiao: "Zona Leste", posicao: 4, volume: 220 },
    { regiao: "ABC", posicao: 5, volume: 180 },
  ],
  devolucoes: 0.8,
  devolucoesMeta: 1.5,
  urgencias: 14,
  volumeTransportado: 52400,
  volumeUnidade: "kg",
  tendencia7dias: 4.8,
  tendencia30dias: 11.5,
  previsaoProxSemana: 1620,
};

export function PortalExecutiveDashboard({ metrics = defaultMetrics }: PortalExecutiveDashboardProps) {
  const [periodoFiltro, setPeriodoFiltro] = useState<PeriodFilter>("30dias");
  const trend = trendColors[metrics.tendenciaOperacional];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Executive Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-600 font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-wider">
              <Sparkles className="w-3 h-3 mr-1" />
              Executive Insights Active
            </Badge>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Performance Operacional</h1>
          <p className="text-slate-500 font-medium">Relatórios consolidados e métricas estratégicas da sua conta.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white border border-slate-200 p-1 rounded-2xl flex items-center shadow-sm">
            {(["7dias", "30dias", "mes_atual"] as PeriodFilter[]).map((periodo) => (
              <button
                key={periodo}
                onClick={() => setPeriodoFiltro(periodo)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  periodoFiltro === periodo 
                    ? "bg-slate-900 text-white shadow-md" 
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {periodLabels[periodo]}
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" className="rounded-2xl border-slate-200 bg-white text-slate-600 shadow-sm">
            <Share2 className="w-4 h-4" />
          </Button>
          <Button className="rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 shadow-lg shadow-orange-500/20">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <PortalKpiCard
          label="SLA de Entrega"
          value={`${metrics.slaGeral}%`}
          trend={{ value: "+2.4%", isPositive: true }}
          icon={Target}
          description={`Meta estabelecida: ${metrics.slaMeta}%`}
          color="orange"
        />
        <PortalKpiCard
          label="Volume Total"
          value={metrics.volumeTransportado.toLocaleString()}
          trend={{ value: "+11.5%", isPositive: true }}
          icon={Package}
          description={`${metrics.volumeUnidade.toUpperCase()} transportados`}
          color="slate"
        />
        <PortalKpiCard
          label="Produtividade"
          value={`${metrics.produtividade}%`}
          trend={{ value: "+4.8%", isPositive: true }}
          icon={Activity}
          description="Otimização de rotas ativa"
          color="emerald"
        />
        <PortalKpiCard
          label="Economia Acumulada"
          value={`R$ ${(metrics.economiaOperacional / 1000).toFixed(1)}k`}
          trend={{ value: "-R$ 2.4k", isPositive: false }}
          icon={DollarSign}
          description="vs. custo de mercado"
          color="blue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart Area (Visual Representation) */}
        <Card className="lg:col-span-2 bg-white border-slate-200 shadow-sm rounded-[2rem] overflow-hidden">
          <CardHeader className="p-8 border-b border-slate-50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-black text-slate-900">Comparativo Mensal</CardTitle>
                <CardDescription className="text-slate-500 font-medium">Análise de volume atual vs. período anterior</CardDescription>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span className="text-xs font-bold text-slate-500">2026</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-slate-200" />
                  <span className="text-xs font-bold text-slate-500">2025</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-[280px] w-full flex items-end justify-between gap-6">
              {metrics.comparativoMensal.map((m, idx) => {
                const maxVal = Math.max(...metrics.comparativoMensal.flatMap(x => [x.atual, x.anterior]));
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-4 group">
                    <div className="w-full flex gap-2 h-[220px] items-end px-2">
                      <div
                        className="flex-1 bg-gradient-to-t from-orange-600 to-orange-400 rounded-2xl shadow-lg shadow-orange-500/10 transition-all duration-500 group-hover:scale-105"
                        style={{ height: `${(m.atual / maxVal) * 100}%` }}
                      />
                      <div
                        className="flex-1 bg-slate-100 rounded-2xl transition-all duration-500 group-hover:bg-slate-200"
                        style={{ height: `${(m.anterior / maxVal) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{m.mes}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar Insights */}
        <div className="space-y-8">
          <Card className="bg-slate-900 text-white border-none shadow-xl rounded-[2rem] p-8 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl -mr-16 -mt-16" />
             <div className="relative z-10">
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-2 bg-orange-500 rounded-xl">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest text-orange-400">Smart Forecast</span>
                </div>
                
                <h3 className="text-2xl font-black mb-2 leading-tight">Previsão para a Próxima Semana</h3>
                <p className="text-slate-400 text-sm font-medium mb-8">Baseado no seu histórico, estimamos um aumento na demanda.</p>
                
                <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-4xl font-black text-white">{metrics.previsaoProxSemana}</span>
                    <span className="text-slate-400 font-bold mb-1">entregas</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-400">
                    <ArrowUpRight className="w-4 h-4" />
                    <span className="text-xs font-bold">+12.4% vs. média</span>
                  </div>
                </div>
             </div>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm rounded-[2rem] p-8">
            <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              Ranking de Unidades
            </h3>
            <div className="space-y-6">
              {metrics.rankingUnidades.slice(0, 3).map((u, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                      idx === 0 ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-600"
                    }`}>
                      {u.posicao}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900">{u.unidade}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{u.tendencia} de crescimento</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">{u.score}</p>
                    <p className="text-[10px] font-bold text-slate-400">Score</p>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-6 rounded-2xl text-xs font-black text-slate-400 hover:text-slate-900 group">
              Ver Ranking Completo
              <ChevronDown className="w-4 h-4 ml-2 transition-transform group-hover:translate-y-1" />
            </Button>
          </Card>
        </div>
      </div>

      {/* Regional & Efficiency Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="bg-white border-slate-200 shadow-sm rounded-[2rem] p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-orange-500" />
              Custo por Região
            </h3>
            <Badge className="bg-slate-100 text-slate-600 border-none font-bold">Total: R$ 37.3k</Badge>
          </div>
          <div className="space-y-6">
            {metrics.custoPorRegiao.map((r, idx) => (
              <div key={idx} className="space-y-3 group">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-black uppercase tracking-widest">{r.regiao}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-slate-400 font-bold">{r.entrega} entregas</span>
                    <span className="text-slate-900 font-black">R$ {(r.custo / 1000).toFixed(1)}k</span>
                  </div>
                </div>
                <div className="h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full shadow-inner transition-all duration-1000"
                    style={{ width: `${(r.custo / 15000) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm rounded-[2rem] p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              Incidências e Devoluções
            </h3>
            <Badge className="bg-emerald-100 text-emerald-600 border-none font-bold">Abaixo da Meta</Badge>
          </div>
          <div className="flex items-center justify-center py-6">
            <div className="relative">
              <svg className="w-40 h-40 transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="transparent"
                  className="text-slate-50"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="transparent"
                  strokeDasharray={440}
                  strokeDashoffset={440 - (440 * metrics.devolucoes) / metrics.devolucoesMeta}
                  className="text-rose-500 transition-all duration-1000"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-slate-900">{metrics.devolucoes}%</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Devoluções</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Taxa Atual</p>
              <p className="text-lg font-black text-slate-900">{metrics.devolucoes}%</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Meta Máxima</p>
              <p className="text-lg font-black text-slate-900">{metrics.devolucoesMeta}%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-200 border-dashed">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-500">Dados sincronizados em tempo real com a Torre de Controle</span>
        </div>
        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">ID Operação: {Math.random().toString(36).substring(7).toUpperCase()}</span>
      </div>
    </div>
  );
}
