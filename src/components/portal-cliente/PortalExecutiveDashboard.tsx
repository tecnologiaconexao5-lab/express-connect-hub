import { LucideIcon, TrendingUp, TrendingDown, Activity, DollarSign, Package, Truck, Clock, Users, MapPin, AlertTriangle, CheckCircle, BarChart3, Target, Zap, Calendar, Award, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";

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
  crescendo: { text: "text-emerald-700", icon: TrendingUp },
  estavel: { text: "text-slate-500", icon: Activity },
  declinando: { text: "text-red-700", icon: TrendingDown },
};

const periodLabels: Record<PeriodFilter, string> = {
  hoje: "Hoje",
  "7dias": "7 Dias",
  "30dias": "30 Dias",
  mes_atual: "Mês Atual",
  personalizado: "Personalizado",
};

const defaultMetrics: ExecutiveMetrics = {
  slaGeral: 96,
  slaMeta: 95,
  produtividade: 94,
  custoPorEntrega: 45.80,
  custoPorRegiao: [
    { regiao: "Zona Sul", custo: 12500, entrega: 280 },
    { regiao: "Centro", custo: 9800, entrega: 220 },
    { regiao: "Zona Oeste", custo: 8700, entrega: 190 },
    { regiao: "Zona Leste", custo: 6300, entrega: 140 },
  ],
  economiaOperacional: 18400,
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
    { unidade: "Matriz SP", posicao: 1, score: 98, tendencia: "+5%" },
    { unidade: "CD Interlagos", posicao: 2, score: 94, tendencia: "+2%" },
    { unidade: "Filial Mooca", posicao: 3, score: 91, tendencia: "-1%" },
    { unidade: "Filial ABC", posicao: 4, score: 87, tendencia: "+3%" },
    { unidade: "Zona Sul", posicao: 5, score: 85, tendencia: "+1%" },
  ],
  rankingRegioes: [
    { regiao: "Centro", posicao: 1, volume: 450 },
    { regiao: "Zona Sul", posicao: 2, volume: 380 },
    { regiao: "Zona Oeste", posicao: 3, volume: 290 },
    { regiao: "Zona Leste", posicao: 4, volume: 220 },
    { regiao: "ABC", posicao: 5, volume: 180 },
  ],
  devolucoes: 8,
  devolucoesMeta: 10,
  urgencias: 12,
  volumeTransportado: 45000,
  volumeUnidade: "kg",
  tendencia7dias: 5.2,
  tendencia30dias: 12.8,
  previsaoProxSemana: 1550,
};

export function PortalExecutiveDashboard({ metrics = defaultMetrics }: PortalExecutiveDashboardProps) {
  const [periodoFiltro, setPeriodoFiltro] = useState<PeriodFilter>("30dias");
  const trend = trendColors[metrics.tendenciaOperacional];

  const handleExportar = () => {
    const dados = `DASHBOARD EXECUTIVO - PERÍODO: ${periodLabels[periodoFiltro]}
===============================================
SLA Geral: ${metrics.slaGeral}%
SLA Meta: ${metrics.slaMeta}%
Produtividade: ${metrics.produtividade}%
Custo por Entrega: R$ ${metrics.custoPorEntrega.toFixed(2)}
Economia Operacional: R$ ${metrics.economiaOperacional.toLocaleString()}
Devoluções: ${metrics.devolucoes}
Urgências: ${metrics.urgencias}
Volume Transportado: ${metrics.volumeTransportado} ${metrics.volumeUnidade}

REGIÕES:
${metrics.custoPorRegiao.map(r => `- ${r.regiao}: R$ ${r.custo.toLocaleString()} (${r.entrega} entregas)`).join('\n')}

RANKING UNIDADES:
${metrics.rankingUnidades.map(u => `- ${u.unidade}: Score ${u.score} (${u.tendencia})`).join('\n')}

Gerado em: ${new Date().toLocaleString("pt-BR")}`;

    const blob = new Blob([dados], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_executivo_${periodoFiltro}_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const maxVolume = Math.max(...metrics.heatmap.map(h => h.volume));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F97316] flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#111827]">Dashboard Executivo</h2>
            <p className="text-sm text-[#475569]">Visão geral da operação</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
            <Zap className="w-3 h-3 mr-1" />
            Tempo Real
          </Badge>
          <Badge className="bg-blue-50 text-blue-700 border-blue-200">
            Período: {periodLabels[periodoFiltro]}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(Object.keys(periodLabels) as PeriodFilter[]).map((periodo) => (
          <Button
            key={periodo}
            variant={periodoFiltro === periodo ? "default" : "outline"}
            size="sm"
            className={periodoFiltro === periodo ? "bg-[#F97316] hover:bg-[#EA580C] text-white" : "border-[#E5E7EB] text-[#475569] bg-white"}
            onClick={() => setPeriodoFiltro(periodo)}
          >
            {periodLabels[periodo]}
          </Button>
        ))}
        <Button variant="outline" size="sm" className="border-[#E5E7EB] text-[#475569] bg-white ml-auto" onClick={handleExportar}>
          <Download className="w-3 h-3 mr-1" />
          Exportar Relatório
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="bg-[#F97316]/10 border-[#F97316]/20">
          <CardContent className="p-4 text-center">
            <Target className="w-6 h-6 mx-auto text-[#F97316] mb-2" />
            <p className="text-3xl font-bold text-[#111827]">{metrics.slaGeral}%</p>
            <p className="text-xs text-[#F97316]">SLA Geral</p>
            <p className="text-[10px] text-[#64748B]">Meta: {metrics.slaMeta}%</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4 text-center">
            <Activity className="w-6 h-6 mx-auto text-emerald-700 mb-2" />
            <p className="text-3xl font-bold text-[#111827]">{metrics.produtividade}%</p>
            <p className="text-xs text-emerald-700">Produtividade</p>
            <p className="text-[10px] text-[#64748B]">+{metrics.tendencia7dias}% 7d</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 text-center">
            <DollarSign className="w-6 h-6 mx-auto text-blue-700 mb-2" />
            <p className="text-3xl font-bold text-[#111827]">R$ {metrics.custoPorEntrega.toFixed(2)}</p>
            <p className="text-xs text-blue-700">Custo/Entrega</p>
            <p className="text-[10px] text-[#64748B]">Média mensal</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 text-center">
            <TrendingDown className="w-6 h-6 mx-auto text-amber-700 mb-2" />
            <p className="text-3xl font-bold text-[#111827]">R$ {(metrics.economiaOperacional / 1000).toFixed(1)}k</p>
            <p className="text-xs text-amber-700">Economia</p>
            <p className="text-[10px] text-[#64748B]">vs frota própria</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-6 h-6 mx-auto text-red-700 mb-2" />
            <p className="text-3xl font-bold text-[#111827]">{metrics.devolucoes}</p>
            <p className="text-xs text-red-700">Devoluções</p>
            <p className="text-[10px] text-[#64748B]">Meta: {metrics.devolucoesMeta}</p>
          </CardContent>
        </Card>
        <Card className="bg-cyan-50 border-cyan-200">
          <CardContent className="p-4 text-center">
            <Zap className="w-6 h-6 mx-auto text-cyan-700 mb-2" />
            <p className="text-3xl font-bold text-[#111827]">{metrics.urgencias}</p>
            <p className="text-xs text-cyan-700">Urgências</p>
            <p className="text-[10px] text-[#64748B]">Hoje</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[#111827] text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#F97316]" />
              Tendência Operacional
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-4">
              <div className="text-center">
                <trend.icon className={`w-12 h-12 mx-auto mb-2 ${trend.text}`} />
                <p className="text-lg font-bold text-[#111827]">{trend.label}</p>
                <p className="text-sm text-[#64748B] mt-1">
                  Previsão próxima semana: <span className="text-emerald-700 font-medium">{metrics.previsaoProxSemana} entregas</span>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="p-2 bg-[#F8FAFC] rounded text-center">
                <p className="text-xs text-[#64748B]">7 dias</p>
                <p className={`text-sm font-bold ${metrics.tendencia7dias >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {metrics.tendencia7dias >= 0 ? "+" : ""}{metrics.tendencia7dias}%
                </p>
              </div>
              <div className="p-2 bg-[#F8FAFC] rounded text-center">
                <p className="text-xs text-[#64748B]">30 dias</p>
                <p className={`text-sm font-bold ${metrics.tendencia30dias >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {metrics.tendencia30dias >= 0 ? "+" : ""}{metrics.tendencia30dias}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[#111827] text-sm flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-600" />
              Ranking Unidades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.rankingUnidades.map((u, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-[#F8FAFC] rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      u.posicao === 1 ? "bg-amber-100 text-amber-600" :
                      u.posicao === 2 ? "bg-slate-100 text-slate-600" :
                      u.posicao === 3 ? "bg-orange-100 text-orange-600" :
                      "bg-slate-50 text-slate-500"
                    }`}>
                      {u.posicao}
                    </span>
                    <span className="text-sm text-[#111827]">{u.unidade}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-[#111827]">{u.score}</span>
                    <span className={`text-[10px] ml-1 ${u.tendencia.startsWith("+") ? "text-emerald-700" : "text-red-700"}`}>
                      {u.tendencia}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[#111827] text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#F97316]" />
              Custo por Região
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.custoPorRegiao.map((r, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#475569]">{r.regiao}</span>
                    <span className="text-[#111827] font-medium">R$ {(r.custo / 1000).toFixed(1)}k</span>
                  </div>
                  <div className="h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#F97316] to-[#EA580C]"
                      style={{ width: `${(r.custo / 15000) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[#111827] text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#F97316]" />
              Comparativo Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between h-32 gap-2">
              {metrics.comparativoMensal.map((m, idx) => {
                const maxVal = Math.max(...metrics.comparativoMensal.flatMap(x => [x.atual, x.anterior]));
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex gap-1 h-28 items-end">
                      <div
                        className="flex-1 bg-[#F97316]/60 rounded-t"
                        style={{ height: `${(m.atual / maxVal) * 100}%` }}
                        title={`Atual: ${m.atual}`}
                      />
                      <div
                        className="flex-1 bg-[#E5E7EB]/80 rounded-t"
                        style={{ height: `${(m.anterior / maxVal) * 100}%` }}
                        title={`Anterior: ${m.anterior}`}
                      />
                    </div>
                    <span className="text-xs text-[#64748B]">{m.mes}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-[#64748B]">
              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-[#F97316] rounded" /> Atual</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-[#E5E7EB] rounded" /> Anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[#111827] text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-[#F97316]" />
              Volume por Região
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.rankingRegioes.map((r, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded bg-slate-50 flex items-center justify-center text-[10px] text-[#64748B]">
                    {r.posicao}
                  </span>
                  <span className="flex-1 text-sm text-[#111827]">{r.regiao}</span>
                  <span className="text-sm font-bold text-[#F97316]">{r.volume}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#F8FAFC] border-[#E5E7EB] border-dashed">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-[#F97316]" />
            <span className="text-sm text-[#64748B]">Última atualização: Agora</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-[#E5E7EB] text-[#64748B]">
              {metrics.comparativoFiliais.length} unidades analisadas
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
