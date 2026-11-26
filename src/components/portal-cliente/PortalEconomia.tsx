import { DollarSign, Truck, MapPin, Download, AlertCircle, Loader2, Target, CheckCircle2, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback, type ReactNode } from "react";
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

const fmtBRL = (v: number) =>
  (Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

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
        if (clienteId) setError("Nenhum dado operacional encontrado para este período.");
      }
    } catch {
      setError("Erro ao carregar os indicadores.");
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
    const regioes = metrics.volumePorRegiao
      .map((r) => `- ${r.regiao}: ${r.entregas} entregas • ${r.pesoKg.toLocaleString("pt-BR")} kg`)
      .join("\n");
    const dados = [
      `INDICADORES LOGÍSTICOS - ${clienteNome || "Cliente"} - ${periodLabels[periodoFiltro]}`,
      "=".repeat(50),
      linha("Investimento Logístico Total", fmtBRL(metrics.investimentoTotal)),
      linha("Ticket Médio por Entrega", fmtBRL(metrics.ticketMedio)),
      linha("SLA no Prazo", `${metrics.slaPct}%`),
      linha("Entregas Concluídas", `${metrics.entregasConcluidas} de ${metrics.totalEntregas}`),
      linha("Total Faturado (pago)", fmtBRL(metrics.totalFaturado)),
      linha("Total a Vencer", fmtBRL(metrics.totalAVencer)),
      "",
      "VOLUME POR REGIÃO:",
      regioes || "- sem dados",
      "",
      `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
    ].join("\n");

    const blob = new Blob([dados], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `indicadores_logisticos_${periodoFiltro}_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!clienteId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-200 flex items-center justify-center"><DollarSign className="w-6 h-6 text-slate-400" /></div>
          <div><h2 className="text-2xl font-black text-slate-900 uppercase">Indicadores Logísticos</h2></div>
        </div>
        <Card className="bg-white border-slate-200 rounded-2xl"><CardContent className="p-12 text-center">
          <AlertCircle className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-bold text-slate-500">Selecione um cliente para visualizar os indicadores.</p>
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
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Indicadores Logísticos</h2>
            <p className="text-sm font-bold text-slate-500">Investimento, SLA e volume da sua operação</p>
          </div>
        </div>
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 font-black uppercase px-3 py-1">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
          {metrics ? `${metrics.totalEntregas} entregas` : "Sem dados"}
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
          <p className="text-sm font-bold text-slate-500">Calculando indicadores...</p>
        </CardContent></Card>
      ) : error || !metrics ? (
        <Card className="bg-white border-slate-200 rounded-2xl"><CardContent className="p-12 text-center">
          <AlertCircle className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-bold text-slate-500">{error || "Nenhum dado disponível para este período."}</p>
          <p className="text-xs text-slate-400 mt-2">O período pode não ter movimentação operacional.</p>
        </CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={<DollarSign className="w-8 h-8 text-emerald-600" />}
              value={fmtBRL(metrics.investimentoTotal)}
              label="Investimento Logístico"
              sub="total no período"
            />
            <KpiCard
              icon={<Target className="w-8 h-8 text-orange-600" />}
              value={fmtBRL(metrics.ticketMedio)}
              label="Ticket Médio"
              sub="por entrega"
            />
            <KpiCard
              icon={<CheckCircle2 className="w-8 h-8 text-blue-600" />}
              value={`${metrics.slaPct}%`}
              label="SLA no Prazo"
              sub="entregas concluídas"
            />
            <KpiCard
              icon={<Truck className="w-8 h-8 text-purple-600" />}
              value={`${metrics.entregasConcluidas}/${metrics.totalEntregas}`}
              label="Entregas Concluídas"
              sub="no período"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white border-slate-200 rounded-2xl shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-slate-900 text-sm font-black flex items-center gap-2 uppercase tracking-widest">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  Volume por Região
                </CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.volumePorRegiao.length === 0 ? (
                  <p className="text-sm text-slate-400 font-bold text-center py-6">Sem dados por região</p>
                ) : (
                  <div className="space-y-3">
                    {metrics.volumePorRegiao.slice(0, 8).map((r, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                        <div>
                          <span className="text-sm font-bold text-slate-700">{r.regiao}</span>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{r.entregas} entrega(s)</p>
                        </div>
                        <span className="text-sm font-black text-emerald-600">{r.pesoKg.toLocaleString("pt-BR")} kg</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 rounded-2xl shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-slate-900 text-sm font-black flex items-center gap-2 uppercase tracking-widest">
                  <Package className="w-4 h-4 text-orange-600" />
                  Resumo Financeiro
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <span className="text-sm font-bold text-emerald-800">Total Faturado (pago)</span>
                    <span className="text-sm font-black text-emerald-700">{fmtBRL(metrics.totalFaturado)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <span className="text-sm font-bold text-amber-800">Total a Vencer</span>
                    <span className="text-sm font-black text-amber-700">{fmtBRL(metrics.totalAVencer)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-sm font-bold text-slate-700">Ocupação Média</span>
                    <span className="text-sm font-black text-slate-900">{metrics.ocupacaoMedia}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-slate-50 border-slate-200 rounded-2xl shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs font-bold text-slate-500 leading-relaxed">
                Indicadores calculados exclusivamente a partir das suas Ordens de Serviço, volumes e
                títulos a receber. Não incluem valores internos de custo, repasse ou margem da transportadora.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, value, label, sub }: { icon: ReactNode; value: string; label: string; sub: string }) {
  return (
    <Card className="bg-white border-slate-200 shadow-sm rounded-2xl hover:shadow-md transition-all">
      <CardContent className="p-6 text-center">
        <div className="mb-3 flex justify-center">{icon}</div>
        <p className="text-2xl font-black text-slate-900">{value}</p>
        <p className="text-xs font-black text-emerald-700 uppercase tracking-widest mt-2">{label}</p>
        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{sub}</p>
      </CardContent>
    </Card>
  );
}
