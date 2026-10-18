import { TrendingDown, TrendingUp, DollarSign, Truck, MapPin, Download, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { buscarEconomiaCliente, type EconomiaMetrics } from "@/services/portalCliente/portalClienteService";

interface PortalEconomiaProps {
  clienteId?: string;
  clienteNome?: string;
}

type PeriodFilter = "hoje" | "7dias" | "30dias" | "mes_atual";

const periodLabels: Record<PeriodFilter, string> = {
  hoje: "Hoje",
  "7dias": "7 Dias",
  "30dias": "30 Dias",
  mes_atual: "Mês Atual",
};

export function PortalEconomia({ clienteId, clienteNome }: PortalEconomiaProps) {
  const [periodoFiltro, setPeriodoFiltro] = useState<PeriodFilter>("30dias");
  const [metrics, setMetrics] = useState<EconomiaMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await buscarEconomiaCliente(clienteId, periodoFiltro);
      if (data) {
        setMetrics(data);
      } else {
        setMetrics(null);
        if (clienteId) setError("Nenhum dado financeiro encontrado para este período.");
      }
    } catch {
      setError("Erro ao carregar dados econômicos.");
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [clienteId, periodoFiltro]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const handleExportar = () => {
    if (!metrics) return;
    const linha = (label: string, val: string) => `${label}: ${val}\n`;
    const detalhes = metrics.detalhamento.map((d) => `- ${d.label}: R$ ${d.valor.toLocaleString("pt-BR")}/mês`).join("\n");
    const dados = [
      `RELATÓRIO ECONÔMICO - ${clienteNome || "Cliente"} - ${periodLabels[periodoFiltro]}`,
      "=".repeat(50),
      linha("Economia vs Frota Própria", `R$ ${metrics.economiaVsFrotaPropria.toLocaleString("pt-BR")}`),
      linha("Produtividade", `${metrics.produtividade}%`),
      linha("Redução de Custo", `${metrics.reducaoCusto}%`),
      linha("Km Otimizados", `${metrics.kmOtimizados} km`),
      linha("Ocupação Média", `${metrics.ocupacaoMedia}%`),
      linha("Economia Combustível", `R$ ${metrics.economiaCombustivel.toLocaleString("pt-BR")}`),
      linha("Entregas Consolidadas", String(metrics.entregasConsolidadas)),
      linha("Meta de Economia", `R$ ${metrics.metaEconomia.toLocaleString("pt-BR")}`),
      "",
      "DETALHAMENTO:",
      detalhes,
      "",
      `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
    ].join("\n");

    const blob = new Blob([dados], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_economia_${periodoFiltro}_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!clienteId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-200 flex items-center justify-center"><DollarSign className="w-6 h-6 text-slate-400" /></div>
          <div><h2 className="text-2xl font-black text-slate-900 uppercase">Economia Operacional</h2></div>
        </div>
        <Card className="bg-white border-slate-200 rounded-2xl"><CardContent className="p-12 text-center">
          <AlertCircle className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-bold text-slate-500">Selecione um cliente para visualizar dados econômicos.</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Economia Operacional</h2>
            <p className="text-sm font-bold text-slate-500">Análise financeira e produtividade</p>
          </div>
        </div>
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 font-black uppercase px-3 py-1">
          <TrendingDown className="w-3.5 h-3.5 mr-1.5" />
          {metrics && metrics.economiaVsFrotaPropria > 0 ? "Em economia" : "Sem dados"}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(Object.keys(periodLabels) as PeriodFilter[]).map((periodo) => (
          <Button
            key={periodo}
            variant={periodoFiltro === periodo ? "default" : "outline"}
            size="sm"
            className={periodoFiltro === periodo ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-emerald-200 text-emerald-700 bg-white"}
            onClick={() => setPeriodoFiltro(periodo)}
          >
            {periodLabels[periodo]}
          </Button>
        ))}
        <Button
          variant="outline" size="sm" className="border-emerald-200 text-emerald-700 bg-white ml-auto"
          onClick={handleExportar} disabled={!metrics || loading}
        >
          <Download className="w-3 h-3 mr-1" />
          Exportar Relatório
        </Button>
      </div>

      {loading ? (
        <Card className="bg-white border-slate-200 rounded-2xl"><CardContent className="p-12 text-center">
          <Loader2 className="w-8 h-8 mx-auto text-emerald-500 animate-spin mb-3" />
          <p className="text-sm font-bold text-slate-500">Calculando indicadores econômicos...</p>
        </CardContent></Card>
      ) : error || !metrics ? (
        <Card className="bg-white border-slate-200 rounded-2xl"><CardContent className="p-12 text-center">
          <AlertCircle className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-bold text-slate-500">{error || "Nenhum dado disponível para este período."}</p>
          <p className="text-xs text-slate-400 mt-2">Financeiro do cliente pode estar vazio ou período sem movimentação.</p>
        </CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={<DollarSign className="w-8 h-8 text-emerald-600" />}
              value={`R$ ${(metrics.economiaVsFrotaPropria / 1000).toFixed(1)}k`}
              label="Economia Total"
              sub="vs frota própria"
              valueColor="text-slate-900"
            />
            <KpiCard
              icon={<TrendingDown className="w-8 h-8 text-orange-600" />}
              value={`${metrics.reducaoCusto}%`}
              label="Redução Custo"
              sub="mensal"
              valueColor="text-slate-900"
            />
            <KpiCard
              icon={<MapPin className="w-8 h-8 text-blue-600" />}
              value={String(metrics.kmOtimizados)}
              label="km Otimizados"
              sub="este período"
              valueColor="text-slate-900"
            />
            <KpiCard
              icon={<Truck className="w-8 h-8 text-purple-600" />}
              value={`${metrics.ocupacaoMedia}%`}
              label="Ocupação Média"
              sub="da frota"
              valueColor="text-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white border-slate-200 rounded-2xl shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-slate-900 text-sm font-black flex items-center gap-2 uppercase tracking-widest">
                  <TrendingDown className="w-4 h-4 text-emerald-600" />
                  Meta de Economia
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MetaProgressBar
                  atual={metrics.economiaVsFrotaPropria}
                  meta={metrics.metaEconomia}
                />
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 rounded-2xl shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-slate-900 text-sm font-black flex items-center gap-2 uppercase tracking-widest">
                  <DollarSign className="w-4 h-4 text-orange-600" />
                  Detalhamento Economia
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metrics.detalhamento.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <div>
                        <span className="text-sm font-bold text-slate-700">{item.label}</span>
                        {item.descricao && (
                          <p className="text-[10px] font-medium text-slate-400 mt-0.5">{item.descricao}</p>
                        )}
                      </div>
                      <span className="text-sm font-black text-emerald-600">R$ {item.valor.toLocaleString("pt-BR")}/mês</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-emerald-50 border-emerald-100 rounded-2xl shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-emerald-900 uppercase tracking-tight">Valor percebido pelo cliente</p>
                  <p className="text-xs font-medium text-emerald-700 mt-1 leading-relaxed">
                    {metrics.reducaoCusto > 0
                      ? `Você economizou R$ ${metrics.economiaVsFrotaPropria.toLocaleString("pt-BR")} neste período ao invés de operar frota própria — uma redução de ${metrics.reducaoCusto}% nos custos de transporte.`
                      : "A cada R$ 1 investido na Conexão Express, você economiza em comparação com operação própria."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, value, label, sub, valueColor }: { icon: React.ReactNode; value: string; label: string; sub: string; valueColor: string }) {
  return (
    <Card className="bg-white border-slate-200 shadow-sm rounded-2xl hover:shadow-md transition-all">
      <CardContent className="p-6 text-center">
        <div className="mb-3 flex justify-center">{icon}</div>
        <p className={`text-4xl font-black ${valueColor}`}>{value}</p>
        <p className="text-xs font-black text-emerald-700 uppercase tracking-widest mt-2">{label}</p>
        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{sub}</p>
      </CardContent>
    </Card>
  );
}

function MetaProgressBar({ atual, meta }: { atual: number; meta: number }) {
  const progresso = meta > 0 ? Math.min((atual / meta) * 100, 100) : 0;
  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-slate-500 uppercase">Progresso mensal</span>
        <span className="text-sm font-black text-emerald-600">{progresso.toFixed(0)}%</span>
      </div>
      <div className="h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner">
        <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all" style={{ width: `${progresso}%` }} />
      </div>
      <div className="flex items-center justify-between mt-4 text-[10px] font-black text-slate-400 uppercase tracking-tight">
        <span>R$ {atual.toLocaleString("pt-BR")} atingido</span>
        <span>R$ {meta.toLocaleString("pt-BR")} meta</span>
      </div>
    </>
  );
}