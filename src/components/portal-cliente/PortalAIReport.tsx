import { LucideIcon, FileText, TrendingUp, TrendingDown, Clock, AlertTriangle, CheckCircle, MapPin, DollarSign, Lightbulb, Sparkles, Download, Calendar, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AIReportData {
  periodo: string;
  slaGeral: number;
  slaMeta: number;
  totalEntregas: number;
  entregasConcluidas: number;
  atrasos: number;
  economiaGerada: number;
  melhorRegiao: { nome: string; sla: number };
  piorRegiao: { nome: string; sla: number };
  resumoSemana: string;
  sugestoes: string[];
  alertas: string[];
}

interface PortalAIReportProps {
  data?: AIReportData;
}

const defaultData: AIReportData = {
  periodo: "Maio 2026",
  slaGeral: 96,
  slaMeta: 95,
  totalEntregas: 1250,
  entregasConcluidas: 1200,
  atrasos: 12,
  economiaGerada: 18400,
  melhorRegiao: { nome: "Zona Sul", sla: 98 },
  piorRegiao: { nome: "Zona Leste", sla: 91 },
  resumoSemana: "Sua operação manteve excelente desempenho com SLA acima da meta. A Zona Sul se destaque com 98% de entregas no prazo. Houve uma leve Increase nas ocorrências na Zona Leste que merece atenção.",
  sugestoes: [
    "Considere redistribuir volume para a Zona Sul que tem capacidade adicional",
    "Revisar processos de coleta na Zona Leste para reduzir atrasos",
    "Implementar verificação de documentos antes da coleta",
    "Adicionar Veículo extra para picos de segunda-feira",
  ],
  alertas: [
    "Zona Leste abaixo da meta (91% vs 95%)",
    "2 veículos com manutenção pendente",
  ],
};

export function PortalAIReport({ data = defaultData }: PortalAIReportProps) {
  const tendenciaSla = data.slaGeral >= data.slaMeta ? "up" : "down";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F97316] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#111827]">Relatório IA</h2>
            <p className="text-sm text-[#475569]">Análise inteligente do seu desempenho</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-[#F97316]/10 text-[#F97316]">
            <Sparkles className="w-3 h-3 mr-1" />
            IA Ativa
          </Badge>
          <Button variant="outline" className="bg-white border-[#E5E7EB] text-[#475569]">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="bg-[#F97316]/10 border-[#F97316]/20">
          <CardContent className="p-4 text-center">
            <Target className="w-6 h-6 mx-auto text-[#F97316] mb-2" />
            <p className="text-3xl font-bold text-[#111827]">{data.slaGeral}%</p>
            <p className="text-xs text-[#F97316]">SLA Geral</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-6 h-6 mx-auto text-emerald-600 mb-2" />
            <p className="text-3xl font-bold text-[#111827]">{data.entregasConcluidas}</p>
            <p className="text-xs text-emerald-600">Concluídas</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 mx-auto text-amber-600 mb-2" />
            <p className="text-3xl font-bold text-[#111827]">{data.atrasos}</p>
            <p className="text-xs text-amber-600">Atrasos</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 text-center">
            <DollarSign className="w-6 h-6 mx-auto text-green-600 mb-2" />
            <p className="text-3xl font-bold text-[#111827]">R$ {(data.economiaGerada / 1000).toFixed(1)}k</p>
            <p className="text-xs text-green-600">Economia</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-6 h-6 mx-auto text-blue-600 mb-2" />
            <p className="text-3xl font-bold text-[#111827]">{data.totalEntregas}</p>
            <p className="text-xs text-blue-600">Total OS</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-6 h-6 mx-auto text-orange-600 mb-2" />
            <p className="text-3xl font-bold text-[#111827]">{data.alertas.length}</p>
            <p className="text-xs text-orange-600">Alertas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[#111827] text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#F97316]" />
              Resumo da Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[#475569] leading-relaxed">{data.resumoSemana}</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[#111827] text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#F97316]" />
              Performance por Região
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg border border-emerald-200">
              <span className="text-sm text-[#111827]">🟢 {data.melhorRegiao.nome}</span>
              <span className="text-sm font-bold text-emerald-600">{data.melhorRegiao.sla}%</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-amber-50 rounded-lg border border-amber-200">
              <span className="text-sm text-[#111827]">🟡 {data.piorRegiao.nome}</span>
              <span className="text-sm font-bold text-amber-600">{data.piorRegiao.sla}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-[#111827] text-sm flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-[#F97316]" />
            Sugestões Inteligentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.sugestoes.map((sugestao, idx) => (
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

      {data.alertas.length > 0 && (
        <Card className="bg-red-50 border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-red-800 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              Alertas Importantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.alertas.map((alerta, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
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
          <span className="text-sm text-[#475569]">Relatório gerado automaticamente</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#475569]">
          <Calendar className="w-3 h-3" />
          {data.periodo}
        </div>
      </div>
    </div>
  );
}

function Target(props: any) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
}
