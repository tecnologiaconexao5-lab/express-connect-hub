import { LucideIcon, Brain, AlertTriangle, TrendingUp, TrendingDown, Clock, Truck, MapPin, Package, Thermometer, Activity, Zap, Target, Lightbulb, CheckCircle, XCircle, Warning, Download, Route, Users, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

interface InsightIA {
  id: string;
  tipo: "alerta" | "previsao" | "sugestao" | "insight";
  titulo: string;
  descricao: string;
  prioridade: "alta" | "media" | "baixa";
  acao?: string;
  metric?: string;
  regiao?: string;
  origem?: string;
}

interface SaudeOperacional {
  score: number;
  status: "saudavel" | "atencao" | "critico";
  sla: number;
  atrasos: number;
  ocorrencias: number;
  ocupacao: number;
  devolucoes: number;
  tendencia: "subindo" | "estavel" | "caindo";
}

interface PortalIAOperacionalProps {
  onAction?: (insightId: string) => void;
  onNavigate?: (tab: string) => void;
}

const tipoConfig = {
  alerta: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", border: "border-red-500" },
  previsao: { icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-500" },
  sugestao: { icon: Lightbulb, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-500" },
  insight: { icon: Brain, color: "text-[#F97316]", bg: "bg-orange-50", border: "border-orange-500" },
};

const prioridadeConfig = {
  alta: { label: "🔴 Alta", color: "text-red-600" },
  media: { label: "🟡 Média", color: "text-amber-600" },
  baixa: { label: "🟢 Baixa", color: "text-emerald-600" },
};

const scoreColors = {
  saudavel: { from: "from-emerald-500", to: "to-emerald-600", text: "text-emerald-600", bg: "bg-emerald-500" },
  atencao: { from: "from-amber-500", to: "to-amber-600", text: "text-amber-600", bg: "bg-amber-500" },
  critico: { from: "from-red-500", to: "to-red-600", text: "text-red-600", bg: "bg-red-500" },
};

export function PortalIAOperacional({ onAction }: PortalIAOperacionalProps) {
  const [showInsightModal, setShowInsightModal] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<InsightIA | null>(null);
  const [showRegistrarModal, setShowRegistrarModal] = useState(false);

  const saude: SaudeOperacional = {
    score: 87,
    status: "saudavel",
    sla: 94,
    atrasos: 3,
    ocorrencias: 2,
    ocupacao: 78,
    devolucoes: 1,
    tendencia: "estavel",
  };

  const insights: InsightIA[] = [
    {
      id: "1",
      tipo: "alerta",
      titulo: "Risco de atraso na Zona Sul",
      descricao: "3 entregas com previsão para as próximas 2h podem atrasar devido ao trânsito",
      prioridade: "alta",
      acao: "Ver rotas",
      regiao: "Zona Sul",
      metric: "3 entregas",
    },
    {
      id: "2",
      tipo: "sugestao",
      titulo: "Veículo extra recomendado",
      descricao: "Para a região Oeste, considere adicionar um veículo Fiorino adicional",
      prioridade: "media",
      acao: "Ver disponibilidade",
      regiao: "Zona Oeste",
    },
    {
      id: "3",
      tipo: "insight",
      titulo: "Filial Mooca acima da média",
      descricao: "Esta unidade está com 15% mais entregas que a média do grupo este mês",
      prioridade: "baixa",
      metric: "+15%",
      origem: "Mooca",
    },
    {
      id: "4",
      tipo: "previsao",
      titulo: "SLA em risco amanhã",
      descricao: "Previsão de chuva na região metropolitana pode impactar 12 entregas",
      prioridade: "alta",
      acao: "Ver previsão",
      metric: "12 entregas",
    },
    {
      id: "5",
      tipo: "insight",
      titulo: "Operação saudável",
      descricao: "Parabéns! Sua operação está mantendo 94% de SLA com apenas 2 ocorrências",
      prioridade: "baixa",
      metric: "94% SLA",
    },
    {
      id: "6",
      tipo: "alerta",
      titulo: "Veículos refrigerados próximos do limite",
      descricao: "2 veículos com carga refrigerada estão em 95% da capacidade",
      prioridade: "media",
      acao: "Ver veículos",
      metric: "2 veículos",
    },
    {
      id: "7",
      tipo: "sugestao",
      titulo: "Otimizar roteiro Centro",
      descricao: "A rota do Centro pode ser otimizada economizando 8km e 25min",
      prioridade: "media",
      acao: "Otimizar",
      metric: "-8km",
      regiao: "Centro",
    },
    {
      id: "8",
      tipo: "previsao",
      titulo: "Pico de entregas sextas-feiras",
      descricao: "Projeção de 40% mais volume para próxima sexta-feira",
      prioridade: "media",
      metric: "+40%",
    },
  ];

  const config = scoreColors[saude.status];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#111827]">Insights Operacionais Inteligentes</h2>
      </div>

      <Card className="bg-white border-[#E5E7EB]">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F97316] to-[#EA580C] flex items-center justify-center shadow-lg">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg font-bold text-[#111827]">Saúde Operacional</span>
                <Badge className={`${config.text} bg-opacity-10`}>
                  {saude.status === "saudavel" ? "🟢 Saudável" :
                   saude.status === "atencao" ? "🟡 Atenção" : "🔴 Crítico"}
                </Badge>
              </div>
              <p className="text-sm text-[#475569]">
                Score: {saude.score}/100 • Tendência: {saude.tendencia === "subindo" ? "📈 Subindo" :
                saude.tendencia === "caindo" ? "📉 Caindo" : "➡️ Estável"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="p-2 bg-[#F8FAFC] rounded-lg text-center">
              <p className="text-xs text-[#475569]">SLA</p>
              <p className={`text-lg font-bold ${saude.sla >= 95 ? "text-emerald-600" : saude.sla >= 85 ? "text-amber-600" : "text-red-600"}`}>
                {saude.sla}%
              </p>
            </div>
            <div className="p-2 bg-[#F8FAFC] rounded-lg text-center">
              <p className="text-xs text-[#475569]">Atrasos</p>
              <p className={`text-lg font-bold ${saude.atrasos <= 3 ? "text-emerald-600" : saude.atrasos <= 5 ? "text-amber-600" : "text-red-600"}`}>
                {saude.atrasos}
              </p>
            </div>
            <div className="p-2 bg-[#F8FAFC] rounded-lg text-center">
              <p className="text-xs text-[#475569]">Ocorrências</p>
              <p className={`text-lg font-bold ${saude.ocorrencias <= 2 ? "text-emerald-600" : saude.ocorrencias <= 4 ? "text-amber-600" : "text-red-600"}`}>
                {saude.ocorrencias}
              </p>
            </div>
            <div className="p-2 bg-[#F8FAFC] rounded-lg text-center">
              <p className="text-xs text-[#475569]">Ocupação</p>
              <p className={`text-lg font-bold ${saude.ocupacao <= 85 ? "text-emerald-600" : saude.ocupacao <= 95 ? "text-amber-600" : "text-red-600"}`}>
                {saude.ocupacao}%
              </p>
            </div>
            <div className="p-2 bg-[#F8FAFC] rounded-lg text-center">
              <p className="text-xs text-[#475569]">Devoluções</p>
              <p className={`text-lg font-bold ${saude.devolucoes <= 1 ? "text-emerald-600" : "text-amber-600"}`}>
                {saude.devolucoes}
              </p>
            </div>
            <div className="p-2 bg-[#F8FAFC] rounded-lg text-center">
              <p className="text-xs text-[#475569]">Score</p>
              <p className={`text-lg font-bold ${config.text}`}>
                {saude.score}
              </p>
            </div>
          </div>

          <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${config.bg}`}
              style={{ width: `${saude.score}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {insights.map((insight) => {
          const tipo = tipoConfig[insight.tipo];
          const prioridade = prioridadeConfig[insight.prioridade];
          const IconComponent = tipo.icon;

          return (
            <Card
              key={insight.id}
              className={`bg-white border-l-4 ${tipo.border} hover:bg-gray-50 transition-all cursor-pointer`}
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
                      <h4 className="text-sm font-medium text-[#111827] truncate">{insight.titulo}</h4>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {insight.metric && (
                          <span className="text-sm font-bold text-[#111827] bg-[#F8FAFC] px-2 py-0.5 rounded">
                            {insight.metric}
                          </span>
                        )}
                        {insight.regiao && (
                          <Badge variant="outline" className="border-[#E5E7EB] text-[#475569] bg-white text-[10px]">
                            <MapPin className="w-2 h-2 mr-1" />
                            {insight.regiao}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-[#64748B] line-clamp-2">{insight.descricao}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-[10px] ${prioridade.color}`}>{prioridade.label}</span>
                      {insight.acao && (
                        <span className="text-xs text-[#F97316] hover:underline">{insight.acao} →</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-white border-[#E5E7EB] border-dashed">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-[#F97316]" />
            <span className="text-sm text-[#64748B]">Última atualização: Agora</span>
          </div>
          <Badge variant="outline" className="border-[#E5E7EB] text-[#64748B]">
            {insights.length} insights analisados
          </Badge>
        </CardContent>
      </Card>

      {/* Modal Detalhes Insight */}
      <Dialog open={showInsightModal} onOpenChange={setShowInsightModal}>
        <DialogContent className="max-w-lg bg-white border-[#E5E7EB] shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-[#111827]">
              {selectedInsight && (() => {
                const tipo = tipoConfig[selectedInsight.tipo];
                const IconComp = tipo?.icon;
                return (
                  <>
                    <div className={`w-10 h-10 rounded-lg ${tipo?.bg} flex items-center justify-center`}>
                      {IconComp && <IconComp className={`w-5 h-5 ${tipo?.color}`} />}
                    </div>
                    <div>
                      <span className="text-lg font-bold">{selectedInsight.titulo}</span>
                      <Badge className={`ml-2 ${prioridadeConfig[selectedInsight.prioridade]?.color} bg-opacity-10 text-xs`}>
                        {prioridadeConfig[selectedInsight.prioridade]?.label}
                      </Badge>
                    </div>
                  </>
                );
              })()}
            </DialogTitle>
          </DialogHeader>
          {selectedInsight && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Análise</p>
                <p className="text-sm text-[#111827]">{selectedInsight.descricao}</p>
              </div>
              {selectedInsight.metric && (
                <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Métrica</p>
                  <p className="text-sm font-bold text-[#111827]">{selectedInsight.metric}</p>
                </div>
              )}
              {selectedInsight.regiao && (
                <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Região</p>
                  <p className="text-sm font-medium text-[#111827]">{selectedInsight.regiao}</p>
                </div>
              )}
              <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Gravidade</p>
                <Badge className={`${prioridadeConfig[selectedInsight.prioridade]?.color} bg-opacity-10`}>
                  {prioridadeConfig[selectedInsight.prioridade]?.label}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="border-[#E5E7EB] text-[#475569]" onClick={() => { onNavigate && onNavigate('roteirizacao'); setShowInsightModal(false); }}>
                  <Route className="w-3 h-3 mr-1" />
                  Ver Rotas
                </Button>
                <Button variant="outline" size="sm" className="border-[#E5E7EB] text-[#475569]" onClick={() => { onNavigate && onNavigate('escala'); setShowInsightModal(false); }}>
                  <Users className="w-3 h-3 mr-1" />
                  Ver Veículos
                </Button>
                <Button size="sm" className="bg-[#F97316] hover:bg-[#EA580C] text-white" onClick={() => { setShowRegistrarModal(true); setShowInsightModal(false); }}>
                  <Plus className="w-3 h-3 mr-1" />
                  Registrar Ação
                </Button>
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" className="bg-white border-[#E5E7EB]" onClick={() => setShowInsightModal(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Registrar Ação */}
      <Dialog open={showRegistrarModal} onOpenChange={setShowRegistrarModal}>
        <DialogContent className="bg-white border-[#E5E7EB] shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#111827]">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              Ação Registrada
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-[#475569]">A ação foi registrada e será acompanhada pela equipe operacional.</p>
          </div>
          <div className="flex justify-end">
            <Button className="bg-[#F97316] hover:bg-[#EA580C] text-white" onClick={() => { onAction?.(selectedInsight?.id || ""); setShowRegistrarModal(false); }}>Confirmar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
