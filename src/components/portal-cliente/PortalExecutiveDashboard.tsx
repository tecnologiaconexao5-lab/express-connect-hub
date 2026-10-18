import { TrendingUp, TrendingDown, Activity, DollarSign, Target, Package, Truck, Clock, MapPin, AlertTriangle, Award, Calendar, Sparkles, Download, ArrowUpRight, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { PortalKpiCard } from "./PortalKpiCard";
import { buscarExecutiveDashboard, type ExecutiveDashboardData } from "@/services/portalCliente/portalClienteService";

interface PortalExecutiveDashboardProps {
  clienteId?: string;
}

type PeriodFilter = "7dias" | "30dias" | "mes_atual";

const periodLabels: Record<PeriodFilter, string> = {
  "7dias": "Últimos 7 dias",
  "30dias": "Últimos 30 dias",
  mes_atual: "Mês Atual",
};

const statusLabels: Record<string, string> = {
  programacao: "Programado",
  coleta: "Em Coleta",
  saiu_para_rota: "Saiu para Rota",
  em_rota: "Em Rota",
  entregue: "Entregue",
  atrasada: "Atrasado",
  problema: "Com Problema",
  finalizada: "Finalizada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const statusColors: Record<string, string> = {
  programacao: "bg-slate-100 text-slate-600",
  coleta: "bg-blue-100 text-blue-600",
  saiu_para_rota: "bg-orange-100 text-orange-600",
  em_rota: "bg-amber-100 text-amber-600",
  entregue: "bg-emerald-100 text-emerald-600",
  atrasada: "bg-rose-100 text-rose-600",
  problema: "bg-red-100 text-red-600",
  finalizada: "bg-emerald-100 text-emerald-600",
  concluida: "bg-emerald-100 text-emerald-600",
  cancelada: "bg-slate-100 text-slate-600",
};

export function PortalExecutiveDashboard({ clienteId }: PortalExecutiveDashboardProps) {
  const [periodoFiltro, setPeriodoFiltro] = useState<PeriodFilter>("30dias");
  const [data, setData] = useState<ExecutiveDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const carregarDados = useCallback(async () => {
    if (!clienteId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await buscarExecutiveDashboard(clienteId);
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const handleExportar = () => {
    if (!data) return;
    const linhas = [
      `RELATÓRIO EXECUTIVO DE PERFORMANCE`,
      "=".repeat(50),
      `SLA Geral: ${data.slaGeral}% (meta: ${data.slaMeta}%)`,
      `Total de Entregas: ${data.totalEntregas}`,
      `Concluídas: ${data.entregasConcluidas}`,
      `Atrasadas: ${data.entregasAtrasadas}`,
      `Em Andamento: ${data.emAndamento}`,
      `Produtividade: ${data.produtividade}%`,
      `Volume Transportado: ${data.volumeTransportado} kg`,
      `Valor Médio por Entrega: R$ ${data.valorMedioEntrega.toLocaleString("pt-BR")}`,
      `Economia Operacional: R$ ${data.economiaOperacional.toLocaleString("pt-BR")}`,
      `Devoluções: ${data.devolucoes}%`,
      `Urgências: ${data.urgencias}`,
      "",
      `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
    ].join("\n");

    const blob = new Blob([linhas], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_executivo_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!clienteId) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-200 flex items-center justify-center"><Activity className="w-6 h-6 text-slate-400" /></div>
          <div><h2 className="text-2xl font-black text-slate-900 uppercase">Performance Operacional</h2></div>
        </div>
        <Card className="bg-white border-slate-200 rounded-2xl"><CardContent className="p-12 text-center">
          <AlertTriangle className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-bold text-slate-500">Selecione um cliente para visualizar dados executivos.</p>
        </CardContent></Card>
      </div>
    );
  }

  const maxChartValue = data && data.comparativoMensal.length > 0
    ? Math.max(...data.comparativoMensal.flatMap((m) => [m.atual, m.anterior]), 1)
    : 1;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-600 font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-wider">
              <Sparkles className="w-3 h-3 mr-1" />
              Executive Insights
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
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${periodoFiltro === periodo ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-900"}`}
              >
                {periodLabels[periodo]}
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" className="rounded-2xl border-slate-200 bg-white text-slate-600 shadow-sm">
            <Filter className="w-4 h-4" />
          </Button>
          <Button
            className="rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 shadow-lg shadow-orange-500/20"
            onClick={handleExportar}
            disabled={loading || !data}
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <PortalKpiCard
          title="SLA de Entrega"
          value={loading ? "..." : `${data?.slaGeral ?? 0}%`}
          subtitle={`Meta estabelecida: ${data?.slaMeta ?? 95}%`}
          icon={Target}
          trend={data ? Math.round((data.slaGeral - data.slaMeta) * 10) / 10 : undefined}
          status={!data ? undefined : data.slaGeral >= data.slaMeta ? "saudavel" : "atencao"}
          loading={loading}
        />
        <PortalKpiCard
          title="Volume Total"
          value={loading ? "..." : `${data?.totalEntregas ?? 0} entregas`}
          subtitle={`${(data?.volumeTransportado ?? 0).toLocaleString("pt-BR")} kg transportados`}
          icon={Package}
          trend={data?.tendencia30dias}
          loading={loading}
        />
        <PortalKpiCard
          title="Produtividade"
          value={loading ? "..." : `${data?.produtividade ?? 0}%`}
          subtitle={`${data?.entregasConcluidas ?? 0} de ${data?.totalEntregas ?? 0} concluídas`}
          icon={Activity}
          trend={data?.tendencia7dias}
          status={!data ? undefined : data.produtividade >= 80 ? "saudavel" : data.produtividade >= 50 ? "atencao" : "critico"}
          loading={loading}
        />
        <PortalKpiCard
          title="Economia Operacional"
          value={loading ? "..." : `R$ ${((data?.economiaOperacional ?? 0) / 1000).toFixed(1)}k`}
          subtitle="vs. custo de mercado"
          icon={DollarSign}
          trend={data && data.economiaOperacional > 0 ? 5 : -5}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 bg-white border-slate-200 shadow-sm rounded-[2rem] overflow-hidden">
          <CardHeader className="p-8 border-b border-slate-50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-black text-slate-900">Comparativo Mensal</CardTitle>
                <CardDescription className="text-slate-500 font-medium">Volume de entregas atual vs. período anterior</CardDescription>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span className="text-xs font-bold text-slate-500">Atual</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-slate-200" />
                  <span className="text-xs font-bold text-slate-500">Anterior</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            {loading ? (
              <div className="h-[280px] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : data && data.comparativoMensal.length > 0 ? (
              <div className="h-[280px] w-full flex items-end justify-between gap-6">
                {data.comparativoMensal.map((m, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-4 group">
                    <div className="w-full flex gap-2 h-[220px] items-end px-2">
                      <div
                        className="flex-1 bg-gradient-to-t from-orange-600 to-orange-400 rounded-2xl shadow-lg shadow-orange-500/10 transition-all duration-500 group-hover:scale-105"
                        style={{ height: `${(m.atual / maxChartValue) * 100}%` }}
                        title={`${m.mes}: ${m.atual} entregas`}
                      />
                      <div
                        className="flex-1 bg-slate-100 rounded-2xl transition-all duration-500 group-hover:bg-slate-200"
                        style={{ height: `${(m.anterior / maxChartValue) * 100}%` }}
                        title={`${m.mes} (anterior): ${m.anterior} entregas`}
                      />
                    </div>
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{m.mes}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-sm text-slate-400 font-bold">
                Sem dados mensais para exibir
              </div>
            )}
          </CardContent>
        </Card>

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
              <p className="text-slate-400 text-sm font-medium mb-8">Baseado no seu histórico dos últimos 7 dias.</p>
              <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-4xl font-black text-white">{loading ? "..." : data?.previsaoProxSemana ?? 0}</span>
                  <span className="text-slate-400 font-bold mb-1">entregas</span>
                </div>
                {data && data.tendencia30dias !== 0 && (
                  <div className={`flex items-center gap-2 ${data.tendencia30dias > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    <ArrowUpRight className={`w-4 h-4 ${data.tendencia30dias < 0 ? "rotate-90" : ""}`} />
                    <span className="text-xs font-bold">{data.tendencia30dias > 0 ? "+" : ""}{data.tendencia30dias}% vs. período anterior</span>
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm rounded-[2rem] p-8">
            <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              Performance por Filial
            </h3>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-slate-50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : data && data.performanceFiliais.length > 0 ? (
              <div className="space-y-4">
                {data.performanceFiliais.slice(0, 5).map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${idx === 0 ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-600"}`}>
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">{f.filial}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{f.entregas} entregas</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900">{f.sla}%</p>
                      <p className="text-[10px] font-bold text-slate-400">SLA</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 font-bold text-center py-4">Sem dados de filiais</p>
            )}
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="bg-white border-slate-200 shadow-sm rounded-[2rem] p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-orange-500" />
              Custo por Região
            </h3>
            <Badge className="bg-slate-100 text-slate-600 border-none font-bold">
              Total: R$ {((data?.custoPorRegiao ?? []).reduce((a, r) => a + r.custo, 0) / 1000).toFixed(1)}k
            </Badge>
          </div>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-slate-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : data && data.custoPorRegiao.length > 0 ? (
            <div className="space-y-6">
              {data.custoPorRegiao.slice(0, 6).map((r, idx) => {
                const maxCusto = Math.max(...data.custoPorRegiao.map((x) => x.custo), 1);
                return (
                  <div key={idx} className="space-y-3 group">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-black uppercase tracking-widest">{r.regiao}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-slate-400 font-bold">{r.entregas} entregas</span>
                        <span className="text-slate-900 font-black">R$ {(r.custo / 1000).toFixed(1)}k</span>
                      </div>
                    </div>
                    <div className="h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full shadow-inner transition-all duration-1000"
                        style={{ width: `${(r.custo / maxCusto) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400 font-bold text-center py-8">Sem dados por região</p>
          )}
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm rounded-[2rem] p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              Incidências e Devoluções
            </h3>
            <Badge className={data && data.devolucoes <= data.devolucoesMeta ? "bg-emerald-100 text-emerald-600 border-none font-bold" : "bg-rose-100 text-rose-600 border-none font-bold"}>
              {data && data.devolucoes <= data.devolucoesMeta ? "Dentro da Meta" : "Acima da Meta"}
            </Badge>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center py-6">
                <div className="relative">
                  <svg className="w-40 h-40 transform -rotate-90">
                    <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-50" />
                    <circle
                      cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent"
                      strokeDasharray={440}
                      strokeDashoffset={440 - (440 * Math.min((data?.devolucoes ?? 0) / (data?.devolucoesMeta ?? 5), 1))}
                      className={`transition-all duration-1000 ${data && data.devolucoes <= data.devolucoesMeta ? "text-emerald-500" : "text-rose-500"}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-slate-900">{data?.devolucoes ?? 0}%</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Atrasos</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Atrasos</p>
                  <p className="text-lg font-black text-slate-900">{data?.devolucoes ?? 0}%</p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Meta Máx.</p>
                  <p className="text-lg font-black text-slate-900">{data?.devolucoesMeta ?? 5}%</p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Urgências</p>
                  <p className="text-lg font-black text-slate-900">{data?.urgencias ?? 0}</p>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-white border-slate-200 shadow-sm rounded-[2rem] p-6">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Truck className="w-4 h-4 text-slate-500" />
            Distribuição por Status
          </h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 bg-slate-50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : data && data.distribuicaoStatus.length > 0 ? (
            <div className="space-y-2">
              {data.distribuicaoStatus.slice(0, 8).map((s, idx) => {
                const maxQtd = Math.max(...data.distribuicaoStatus.map((x) => x.quantidade), 1);
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <Badge className={`${statusColors[s.status] || "bg-slate-100 text-slate-600"} border-none text-[10px] font-bold px-2 py-0.5 w-28 text-center`}>
                      {statusLabels[s.status] || s.status}
                    </Badge>
                    <div className="flex-1 h-5 bg-slate-50 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${s.status === "entregue" || s.status === "finalizada" || s.status === "concluida" ? "bg-emerald-500" : s.status === "atrasada" || s.status === "problema" ? "bg-rose-500" : "bg-orange-400"}`}
                        style={{ width: `${(s.quantidade / maxQtd) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-500 w-8 text-right">{s.quantidade}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400 font-bold text-center py-4">Sem dados de status</p>
          )}
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm rounded-[2rem] p-6">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            Resumo do Período
          </h3>
          {loading ? (
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-16 bg-slate-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <SummaryItem label="Total Entregas" value={String(data?.totalEntregas ?? 0)} />
              <SummaryItem label="Concluídas" value={String(data?.entregasConcluidas ?? 0)} />
              <SummaryItem label="Atrasadas" value={String(data?.entregasAtrasadas ?? 0)} />
              <SummaryItem label="Em Andamento" value={String(data?.emAndamento ?? 0)} />
              <SummaryItem label="Entregas Hoje" value={String(data?.entregasHoje ?? 0)} />
              <SummaryItem label="Valor Médio" value={`R$ ${(data?.valorMedioEntrega ?? 0).toLocaleString("pt-BR")}`} />
            </div>
          )}
        </Card>
      </div>

      <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-200 border-dashed">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-500">
            {loading
              ? "Carregando dados..."
              : data
                ? `Dados sincronizados — ${data.totalEntregas} entregas processadas nos últimos 60 dias`
                : "Sem dados disponíveis"}
          </span>
        </div>
        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
          {data ? `${data.entregasConcluidas} concluídas` : "---"}
        </span>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-lg font-black text-slate-900">{value}</p>
    </div>
  );
}
