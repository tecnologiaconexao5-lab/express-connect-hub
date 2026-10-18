import { useState, useEffect } from "react";
import { Sparkles, TrendingUp, Clock, AlertTriangle, CheckCircle, FileText, Lightbulb, Calendar, BarChart3, MapPin, Loader2, RefreshCw, Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { gerarRelatorioIA, type AIReportResult } from "@/services/portalCliente/aiReportService";

interface PortalAIReportProps {
  clienteId?: string;
}

export function PortalAIReport({ clienteId }: PortalAIReportProps) {
  const [reportData, setReportData] = useState<AIReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("30dias");

  const loadReport = async (periodoAtual: string) => {
    if (!clienteId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await gerarRelatorioIA(clienteId, periodoAtual);
      setReportData(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport(periodo);
  }, [clienteId, periodo]);

  if (!clienteId) {
    return (
      <div className="flex items-center justify-center h-64 text-[#64748B]">
        <p>Cliente não identificado. Faça login para acessar o relatório.</p>
      </div>
    );
  }

  if (loading && !reportData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-8 h-8 text-[#F97316] animate-spin" />
        <p className="text-sm text-[#64748B]">Gerando relatório inteligente...</p>
      </div>
    );
  }

  if (!reportData || !reportData.sucesso) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
        <p className="text-sm text-[#64748B]">Não foi possível carregar o relatório.</p>
        <Button variant="outline" onClick={() => loadReport(periodo)} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Tentar novamente
        </Button>
      </div>
    );
  }

  const { kpis } = reportData;
  const temDados = kpis.totalEntregas > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F97316] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#111827]">Relatório IA</h2>
            <p className="text-sm text-[#475569]">Análise inteligente do seu desempenho</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={periodo} onValueChange={(v) => setPeriodo(v)}>
            <SelectTrigger className="w-[140px] rounded-full bg-white border-[#E5E7EB] h-9 text-xs font-bold">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7dias">Últimos 7 dias</SelectItem>
              <SelectItem value="30dias">Últimos 30 dias</SelectItem>
              <SelectItem value="90dias">Últimos 90 dias</SelectItem>
              <SelectItem value="mes_atual">Mês atual</SelectItem>
            </SelectContent>
          </Select>
          {reportData.geradoPorIA && (
            <Badge className="bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20">
              <Sparkles className="w-3 h-3 mr-1" />
              IA
            </Badge>
          )}
          {loading && (
            <Loader2 className="w-4 h-4 text-[#F97316] animate-spin" />
          )}
        </div>
      </div>

      {!temDados ? (
        <Card className="bg-white border-[#E5E7EB]">
          <CardContent className="p-12 text-center">
            <BarChart3 className="w-12 h-12 mx-auto text-[#CBD5E1] mb-4" />
            <h3 className="text-lg font-bold text-[#111827] mb-2">Nenhum dado no período</h3>
            <p className="text-sm text-[#475569] max-w-md mx-auto">{reportData.resumoExecutivo}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className={`${kpis.slaGeral >= kpis.slaMeta ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
              <CardContent className="p-4 text-center">
                <TrendingUp className={`w-6 h-6 mx-auto mb-2 ${kpis.slaGeral >= kpis.slaMeta ? "text-emerald-600" : "text-amber-600"}`} />
                <p className="text-3xl font-bold text-[#111827]">{kpis.slaGeral}%</p>
                <p className="text-xs text-[#475569]">SLA Geral</p>
                <p className="text-[10px] text-[#64748B]">Meta {kpis.slaMeta}%</p>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4 text-center">
                <CheckCircle className="w-6 h-6 mx-auto text-blue-600 mb-2" />
                <p className="text-3xl font-bold text-[#111827]">{kpis.totalEntregas}</p>
                <p className="text-xs text-[#475569]">Total de Operações</p>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4 text-center">
                <FileText className="w-6 h-6 mx-auto text-green-600 mb-2" />
                <p className="text-3xl font-bold text-[#111827]">{kpis.entregasConcluidas}</p>
                <p className="text-xs text-[#475569]">Concluídas</p>
              </CardContent>
            </Card>
            <Card className={`${kpis.entregasAtrasadas > 0 ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}>
              <CardContent className="p-4 text-center">
                <Clock className={`w-6 h-6 mx-auto mb-2 ${kpis.entregasAtrasadas > 0 ? "text-red-600" : "text-gray-400"}`} />
                <p className="text-3xl font-bold text-[#111827]">{kpis.entregasAtrasadas}</p>
                <p className="text-xs text-[#475569]">Atrasos</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-[#111827] text-sm flex items-center gap-2">
                  <Brain className="w-4 h-4 text-[#F97316]" />
                  Resumo Executivo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#475569] leading-relaxed">{reportData.resumoExecutivo}</p>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#E5E7EB]">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${kpis.statusSaude === "saudavel" ? "bg-emerald-500" : kpis.statusSaude === "atencao" ? "bg-amber-500" : "bg-red-500"}`} />
                    <span className="text-xs text-[#64748B] capitalize">{kpis.statusSaude === "saudavel" ? "Saudável" : kpis.statusSaude === "atencao" ? "Atenção" : "Crítico"}</span>
                  </div>
                  <span className="text-xs text-[#64748B]">{kpis.scoreSaude}/100</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-[#111827] text-sm flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#F97316]" />
                  Performance por Região
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[200px] overflow-y-auto">
                {kpis.regioes.length === 0 ? (
                  <p className="text-sm text-[#64748B]">Nenhuma região identificada.</p>
                ) : (
                  kpis.regioes.slice(0, 8).map((regiao, idx) => {
                    const acimaMeta = regiao.sla >= kpis.slaMeta;
                    return (
                      <div key={idx} className={`flex items-center justify-between p-2 rounded-lg border ${acimaMeta ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${acimaMeta ? "bg-emerald-500" : "bg-amber-500"}`} />
                          <span className="text-sm text-[#111827] truncate max-w-[160px]">{regiao.nome}</span>
                          <span className="text-[10px] text-[#64748B]">{regiao.entregas} ops</span>
                        </div>
                        <span className={`text-sm font-bold ${acimaMeta ? "text-emerald-600" : "text-amber-600"}`}>{regiao.sla}%</span>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          {reportData.destaquesPositivos.length > 0 && (
            <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-[#111827] text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Destaques Positivos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {reportData.destaquesPositivos.map((item, idx) => (
                    <Badge key={idx} className="bg-emerald-50 text-emerald-700 border-emerald-200 px-3 py-1.5 text-xs">
                      <CheckCircle className="w-3 h-3 mr-1" /> {item}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {reportData.atencaoNecessaria.length > 0 && (
            <Card className="bg-amber-50 border-amber-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-amber-800 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Pontos de Atenção
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {reportData.atencaoNecessaria.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-amber-100/50 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span className="text-sm text-amber-800">{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-[#111827] text-sm flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-[#F97316]" />
                Sugestões Inteligentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {reportData.sugestoes.map((sugestao, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-[#F8FAFC] rounded-lg">
                    <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <Lightbulb className="w-3 h-3 text-amber-600" />
                    </div>
                    <span className="text-sm text-[#475569]">{sugestao}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {reportData.alertas.length > 0 && (
            <Card className="bg-red-50 border-red-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-red-800 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  Alertas Importantes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {reportData.alertas.map((alerta, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-red-100 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <span className="text-sm text-red-800">{alerta}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between p-4 bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#F97316]" />
              <span className="text-sm text-[#475569]">
                {reportData.geradoPorIA ? "Relatório gerado por IA com dados reais" : "Relatório baseado em dados reais"}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#475569]">
              {reportData.provider && (
                <span className="text-[#64748B]">{reportData.provider} / {reportData.model}</span>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {reportData.periodo}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
