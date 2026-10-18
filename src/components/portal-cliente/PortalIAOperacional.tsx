import { LucideIcon, Brain, AlertTriangle, TrendingUp, TrendingDown, Clock, Truck, MapPin, Package, Activity, Zap, Target, Lightbulb, CheckCircle, Download, AlertCircle, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useEffect, useCallback } from "react";
import { gerarInsightsOperacionais, type InsightOperacional, type SaudeOperacionalReal } from "@/services/portalCliente/portalClienteService";

interface PortalIAOperacionalProps {
  clienteId?: string;
  onAction?: (insightId: string) => void;
  onNavigate?: (tab: string) => void;
}

const tipoConfig: Record<string, { icon: LucideIcon; color: string; bg: string; border: string }> = {
  alerta: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", border: "border-red-500" },
  previsao: { icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-500" },
  sugestao: { icon: Lightbulb, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-500" },
  insight: { icon: Brain, color: "text-[#F97316]", bg: "bg-orange-50", border: "border-orange-500" },
};

const prioridadeConfig: Record<string, { label: string; color: string; border: string }> = {
  critica: { label: "Crítica", color: "text-red-600", border: "border-red-500" },
  alta: { label: "Alta", color: "text-orange-600", border: "border-orange-500" },
  media: { label: "Média", color: "text-amber-600", border: "border-amber-500" },
  informativa: { label: "Informativa", color: "text-blue-600", border: "border-blue-500" },
};

const scoreColors: Record<string, { from: string; to: string; text: string; bg: string }> = {
  saudavel: { from: "from-emerald-500", to: "to-emerald-600", text: "text-emerald-600", bg: "bg-emerald-500" },
  atencao: { from: "from-amber-500", to: "to-amber-600", text: "text-amber-600", bg: "bg-amber-500" },
  critico: { from: "from-red-500", to: "to-red-600", text: "text-red-600", bg: "bg-red-500" },
};

type PeriodFilter = "7dias" | "30dias" | "mes_atual";

const periodLabels: Record<PeriodFilter, string> = {
  "7dias": "Últimos 7 dias",
  "30dias": "Últimos 30 dias",
  "mes_atual": "Mês Atual",
};

export function PortalIAOperacional({ clienteId, onAction }: PortalIAOperacionalProps) {
  const [showInsightModal, setShowInsightModal] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<InsightOperacional | null>(null);
  const [periodoFiltro, setPeriodoFiltro] = useState<PeriodFilter>("30dias");
  const [saude, setSaude] = useState<SaudeOperacionalReal | null>(null);
  const [insights, setInsights] = useState<InsightOperacional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregarDados = useCallback(async () => {
    if (!clienteId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await gerarInsightsOperacionais(clienteId, { periodo: periodoFiltro });
      setSaude(result.saude);
      setInsights(result.insights);
    } catch (err) {
      setError("Erro ao carregar dados operacionais");
      setSaude(null);
      setInsights([]);
    } finally {
      setLoading(false);
    }
  }, [clienteId, periodoFiltro]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  if (!clienteId) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-200 flex items-center justify-center">
            <Brain className="w-6 h-6 text-slate-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase">Insights Operacionais</h2>
          </div>
        </div>
        <Card className="bg-white border-slate-200 rounded-2xl">
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-bold text-slate-500">Selecione um cliente para visualizar insights operacionais.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const config = saude ? scoreColors[saude.status] : scoreColors.saudavel;

  const prioridadeCount = (p: string) => insights.filter((i) => i.prioridade === p).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-600 font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-wider">
              <Activity className="w-3 h-3 mr-1" />
              IA Operacional
            </Badge>
          </div>
          <h1 className="text-2xl font-black text-slate-900">Insights Operacionais</h1>
          <p className="text-sm text-slate-500 font-medium">Análise determinística baseada em dados reais do sistema.</p>
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
          <Button
            variant="outline"
            size="icon"
            className="rounded-2xl border-slate-200 bg-white text-slate-600 shadow-sm"
            onClick={carregarDados}
            disabled={loading}
            title="Atualizar dados"
          >
            <Activity className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Saúde Operacional */}
      <Card className="bg-white border-slate-200">
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8 text-red-500 text-sm font-bold">{error}</div>
          ) : saude ? (
            <>
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${config.from} ${config.to} flex items-center justify-center shadow-lg`}>
                  <Activity className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-bold text-slate-900">Saúde Operacional</span>
                    <Badge className={`${config.text} bg-opacity-10`}>
                      {saude.status === "saudavel" ? "Saudável" :
                       saude.status === "atencao" ? "Atenção" : "Crítico"}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500">
                    Score: {saude.score}/100 • {saude.totalEntregas} operações • Tendência: {saude.tendencia === "subindo" ? "crescendo" : saude.tendencia === "caindo" ? "declinando" : "estável"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg text-center">
                  <p className="text-xs text-slate-500">SLA</p>
                  <p className={`text-lg font-bold ${saude.sla >= 95 ? "text-emerald-600" : saude.sla >= 85 ? "text-amber-600" : "text-red-600"}`}>
                    {saude.sla}%
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg text-center">
                  <p className="text-xs text-slate-500">Atrasos</p>
                  <p className={`text-lg font-bold ${saude.atrasos <= 0 ? "text-emerald-600" : saude.atrasos <= 3 ? "text-amber-600" : "text-red-600"}`}>
                    {saude.atrasos}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg text-center">
                  <p className="text-xs text-slate-500">Ocorrências</p>
                  <p className={`text-lg font-bold ${saude.ocorrencias <= 2 ? "text-emerald-600" : saude.ocorrencias <= 4 ? "text-amber-600" : "text-red-600"}`}>
                    {saude.ocorrencias}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg text-center">
                  <p className="text-xs text-slate-500">Ocupação</p>
                  <p className={`text-lg font-bold ${saude.ocupacao >= 70 ? "text-emerald-600" : saude.ocupacao >= 40 ? "text-amber-600" : "text-red-600"}`}>
                    {saude.ocupacao}%
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg text-center">
                  <p className="text-xs text-slate-500">Devoluções</p>
                  <p className={`text-lg font-bold ${saude.devolucoes <= 5 ? "text-emerald-600" : "text-red-600"}`}>
                    {saude.devolucoes}%
                  </p>
                </div>
              </div>

              <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${config.bg}`} style={{ width: `${saude.score}%` }} />
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Priority summary */}
      {!loading && insights.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {prioridadeCount("critica") > 0 && (
            <Badge className="bg-red-100 text-red-600 border-none font-bold">
              {prioridadeCount("critica")} crítica(s)
            </Badge>
          )}
          {prioridadeCount("alta") > 0 && (
            <Badge className="bg-orange-100 text-orange-600 border-none font-bold">
              {prioridadeCount("alta")} alta(s)
            </Badge>
          )}
          {prioridadeCount("media") > 0 && (
            <Badge className="bg-amber-100 text-amber-600 border-none font-bold">
              {prioridadeCount("media")} média(s)
            </Badge>
          )}
          {prioridadeCount("informativa") > 0 && (
            <Badge className="bg-blue-100 text-blue-600 border-none font-bold">
              {prioridadeCount("informativa")} informativa(s)
            </Badge>
          )}
        </div>
      )}

      {/* Insights list */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : insights.length === 0 ? (
          <Card className="bg-white border-slate-200 border-dashed">
            <CardContent className="p-12 text-center">
              <Info className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-bold text-slate-500">Nenhum insight gerado para este período.</p>
              <p className="text-xs text-slate-400 mt-1">Todos os indicadores operacionais estão dentro da normalidade.</p>
            </CardContent>
          </Card>
        ) : (
          insights.map((insight) => {
            const tipo = tipoConfig[insight.tipo];
            const prioridade = prioridadeConfig[insight.prioridade];
            const IconComponent = tipo.icon;

            return (
              <Card
                key={insight.id}
                className={`bg-white border-l-4 ${prioridade.border} hover:bg-slate-50 transition-all cursor-pointer`}
                onClick={() => {
                  setSelectedInsight(insight);
                  setShowInsightModal(true);
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg ${tipo.bg} flex items-center justify-center flex-shrink-0`}>
                      <IconComponent className={`w-5 h-5 ${tipo.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="text-sm font-bold text-slate-900 truncate">{insight.titulo}</h4>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {insight.metric && (
                            <span className="text-sm font-bold text-slate-900 bg-slate-50 px-2 py-0.5 rounded">
                              {insight.metric}
                            </span>
                          )}
                          {insight.regiao && (
                            <Badge variant="outline" className="border-slate-200 text-slate-500 bg-white text-[10px]">
                              <MapPin className="w-2 h-2 mr-1" />
                              {insight.regiao}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2">{insight.descricao}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-[10px] font-bold ${prioridade.color}`}>{prioridade.label}</span>
                        <span className="text-[10px] text-slate-400">{new Date(insight.data_hora).toLocaleString("pt-BR")}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Footer */}
      <Card className="bg-white border-slate-200 border-dashed">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-[#F97316]" />
            <span className="text-sm text-slate-500">
              {loading ? "Carregando..." : `${insights.length} insights determinísticos gerados`}
            </span>
          </div>
          <Badge variant="outline" className="border-slate-200 text-slate-500">
            Fonte: dados reais
          </Badge>
        </CardContent>
      </Card>

      {/* Modal Detalhes Insight */}
      <Dialog open={showInsightModal} onOpenChange={setShowInsightModal}>
        <DialogContent className="max-w-lg bg-white border-slate-200 shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-slate-900">
              {selectedInsight && (() => {
                const tipo = tipoConfig[selectedInsight.tipo];
                const IconComp = tipo?.icon;
                const prioridade = prioridadeConfig[selectedInsight.prioridade];
                return (
                  <>
                    <div className={`w-10 h-10 rounded-lg ${tipo?.bg} flex items-center justify-center`}>
                      {IconComp && <IconComp className={`w-5 h-5 ${tipo?.color}`} />}
                    </div>
                    <div>
                      <span className="text-lg font-bold">{selectedInsight.titulo}</span>
                      <Badge className={`ml-2 ${prioridade?.color} bg-opacity-10 text-xs`}>
                        {prioridade?.label}
                      </Badge>
                    </div>
                  </>
                );
              })()}
            </DialogTitle>
          </DialogHeader>
          {selectedInsight && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Análise</p>
                <p className="text-sm text-slate-900">{selectedInsight.descricao}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Origem</p>
                  <p className="text-sm font-bold text-slate-900">{selectedInsight.origem}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Prioridade</p>
                  <Badge className={`${prioridadeConfig[selectedInsight.prioridade]?.color} bg-opacity-10`}>
                    {prioridadeConfig[selectedInsight.prioridade]?.label}
                  </Badge>
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Motivo</p>
                <p className="text-sm text-slate-900">{selectedInsight.motivo}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Impacto</p>
                <p className="text-sm text-slate-900">{selectedInsight.impacto}</p>
              </div>
              {selectedInsight.operacao_id && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Operação Relacionada</p>
                  <p className="text-sm font-mono text-slate-900">{selectedInsight.operacao_id}</p>
                </div>
              )}
              {selectedInsight.regiao && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Região</p>
                  <p className="text-sm font-medium text-slate-900">{selectedInsight.regiao}</p>
                </div>
              )}
              {selectedInsight.metric && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Métrica</p>
                  <p className="text-sm font-bold text-slate-900">{selectedInsight.metric}</p>
                </div>
              )}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Data/Hora</p>
                <p className="text-sm font-medium text-slate-900">
                  {new Date(selectedInsight.data_hora).toLocaleString("pt-BR")}
                </p>
              </div>
              {selectedInsight.acao && (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="bg-[#F97316] hover:bg-[#EA580C] text-white"
                    onClick={() => { onAction?.(selectedInsight.id); setShowInsightModal(false); }}
                  >
                    <CheckCircle className="w-3 h-3 mr-1" />
                    {selectedInsight.acao}
                  </Button>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" className="bg-white border-slate-200" onClick={() => setShowInsightModal(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
