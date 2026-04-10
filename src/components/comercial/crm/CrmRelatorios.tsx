import { useState, useMemo } from "react";
import {
  BarChart2, TrendingUp, TrendingDown, Users, Target, DollarSign,
  AlertTriangle, Clock, Award, CheckCircle, XCircle, Calendar,
  ArrowUp, ArrowDown, Minus, PieChart, Activity, BookOpen, Filter
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Lead, ESTAGIOS_CONFIG, MotivoPerda, SEGMENTOS } from "./crmTypes";

interface CrmRelatoriosProps {
  leads: Lead[];
}

const MOTIVOS_PERDA_LABELS: Record<MotivoPerda, string> = {
  preco: "Preço alto",
  sem_interesse: "Sem interesse",
  concorrente: "Concorrente escolhido",
  demora: "Demora no retorno",
  sem_volume: "Sem volume suficiente",
  outro: "Outro"
};

export default function CrmRelatorios({ leads }: CrmRelatoriosProps) {
  const [periodo, setPeriodo] = useState("30dias");
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const stats = useMemo(() => {
    const ativos = leads.filter(l => l.estagio !== "fechado_ganho" && l.estagio !== "fechado_perdido");
    const ganhos = leads.filter(l => l.estagio === "fechado_ganho");
    const perdidos = leads.filter(l => l.estagio === "fechado_perdido");

    // Por segmento
    const porSegmento = SEGMENTOS.map(seg => ({
      segmento: seg,
      total: leads.filter(l => l.segmento === seg).length,
      valor: leads.filter(l => l.segmento === seg).reduce((a, l) => a + l.valorEstimadoMensal, 0),
      ganhos: leads.filter(l => l.segmento === seg && l.estagio === "fechado_ganho").length,
    })).filter(s => s.total > 0).sort((a, b) => b.total - a.total);

    // Por responsável
    const responsaveis = [...new Set(leads.map(l => l.responsavel))];
    const porResponsavel = responsaveis.map(resp => ({
      responsavel: resp,
      total: leads.filter(l => l.responsavel === resp).length,
      ganhos: leads.filter(l => l.responsavel === resp && l.estagio === "fechado_ganho").length,
      valor: leads.filter(l => l.responsavel === resp).reduce((a, l) => a + l.valorEstimadoMensal, 0),
      taxa: leads.filter(l => l.responsavel === resp).length > 0
        ? (leads.filter(l => l.responsavel === resp && l.estagio === "fechado_ganho").length / leads.filter(l => l.responsavel === resp).length) * 100
        : 0
    })).sort((a, b) => b.ganhos - a.ganhos);

    // Motivos de perda
    const motivosPerdaCount: Record<string, number> = {};
    perdidos.forEach(l => {
      if (l.motivoPerda) {
        motivosPerdaCount[l.motivoPerda] = (motivosPerdaCount[l.motivoPerda] || 0) + 1;
      }
    });

    // Por origem
    const origens = [...new Set(leads.map(l => l.origem))];
    const porOrigem = origens.map(origem => ({
      origem,
      total: leads.filter(l => l.origem === origem).length,
      ganhos: leads.filter(l => l.origem === origem && l.estagio === "fechado_ganho").length,
    })).sort((a, b) => b.total - a.total);

    return {
      totalLeads: leads.length,
      leadsAtivos: ativos.length,
      ganhos: ganhos.length,
      perdidos: perdidos.length,
      taxaConversao: (ganhos.length + perdidos.length) > 0
        ? ((ganhos.length / (ganhos.length + perdidos.length)) * 100)
        : 0,
      receitaTotal: ganhos.reduce((a, l) => a + l.valorEstimadoMensal, 0),
      receitaPotencial: ativos.reduce((a, l) => a + l.valorEstimadoMensal, 0),
      ticketMedio: ganhos.length > 0 ? ganhos.reduce((a, l) => a + l.valorEstimadoMensal, 0) / ganhos.length : 0,
      porSegmento,
      porResponsavel,
      motivosPerdaCount,
      porOrigem,
    };
  }, [leads]);

  const melhorNicho = stats.porSegmento[0];
  const melhorVendedor = stats.porResponsavel[0];
  const melhorOrigem = stats.porOrigem[0];

  return (
    <div className="space-y-6">
      {/* Header + Período */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-primary" />
            Relatórios e Inteligência de Negócio
          </h3>
          <p className="text-xs text-muted-foreground">Análise completa do desempenho comercial.</p>
        </div>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7dias" className="text-xs">Últimos 7 dias</SelectItem>
            <SelectItem value="30dias" className="text-xs">Últimos 30 dias</SelectItem>
            <SelectItem value="90dias" className="text-xs">Últimos 90 dias</SelectItem>
            <SelectItem value="ano" className="text-xs">Este ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total de Leads", valor: stats.totalLeads, icon: Users, cor: "text-blue-600", bg: "bg-blue-50", delta: "+5 vs mês ant." },
          { label: "Taxa de Conversão", valor: `${stats.taxaConversao.toFixed(1)}%`, icon: Target, cor: "text-emerald-600", bg: "bg-emerald-50", delta: "Meta: 35%" },
          { label: "Receita Confirmada", valor: fmt(stats.receitaTotal), icon: DollarSign, cor: "text-violet-600", bg: "bg-violet-50", delta: "/mês" },
          { label: "Ticket Médio", valor: fmt(stats.ticketMedio), icon: Award, cor: "text-amber-600", bg: "bg-amber-50", delta: "/cliente" },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center mb-2`}>
                <kpi.icon className={`w-4 h-4 ${kpi.cor}`} />
              </div>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className={`text-xl font-black mt-0.5 ${kpi.cor}`}>{kpi.valor}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{kpi.delta}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Inteligência: Melhor Nicho, Canal e Vendedor */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">🏆 Melhor Nicho</CardTitle>
          </CardHeader>
          <CardContent>
            {melhorNicho ? (
              <div>
                <p className="text-xl font-black text-emerald-700">{melhorNicho.segmento}</p>
                <p className="text-xs text-muted-foreground mt-1">{melhorNicho.total} leads · {melhorNicho.ganhos} fechados</p>
                <p className="text-sm font-bold text-slate-700 mt-1">{fmt(melhorNicho.valor)}</p>
                <p className="text-[10px] text-muted-foreground">potencial/mês</p>
              </div>
            ) : <p className="text-xs text-muted-foreground">Sem dados suficientes.</p>}
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">📡 Melhor Canal</CardTitle>
          </CardHeader>
          <CardContent>
            {melhorOrigem ? (
              <div>
                <p className="text-xl font-black text-blue-700 capitalize">{melhorOrigem.origem.replace("_", " ")}</p>
                <p className="text-xs text-muted-foreground mt-1">{melhorOrigem.total} leads captados</p>
                <p className="text-sm font-bold text-slate-700 mt-1">{melhorOrigem.ganhos} fechamentos</p>
                <p className="text-[10px] text-muted-foreground">originados por este canal</p>
              </div>
            ) : <p className="text-xs text-muted-foreground">Sem dados suficientes.</p>}
          </CardContent>
        </Card>

        <Card className="border-violet-200 bg-violet-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">🥇 Melhor Vendedor</CardTitle>
          </CardHeader>
          <CardContent>
            {melhorVendedor ? (
              <div>
                <p className="text-xl font-black text-violet-700">{melhorVendedor.responsavel}</p>
                <p className="text-xs text-muted-foreground mt-1">{melhorVendedor.total} leads · {melhorVendedor.ganhos} fechados</p>
                <p className="text-sm font-bold text-slate-700 mt-1">{melhorVendedor.taxa.toFixed(1)}% conversão</p>
                <p className="text-[10px] text-muted-foreground">{fmt(melhorVendedor.valor)} em carteira</p>
              </div>
            ) : <p className="text-xs text-muted-foreground">Sem dados suficientes.</p>}
          </CardContent>
        </Card>
      </div>

      {/* Performance por Segmento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="w-4 h-4 text-primary" />
              Performance por Segmento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.porSegmento.slice(0, 6).map(seg => (
              <div key={seg.segmento} className="flex items-center gap-3">
                <span className="text-xs text-slate-700 w-28 truncate shrink-0">{seg.segmento}</span>
                <Progress value={(seg.total / stats.totalLeads) * 100} className="flex-1 h-2" />
                <div className="text-right shrink-0 w-20">
                  <span className="text-xs font-bold text-slate-800">{seg.total} leads</span>
                  {seg.ganhos > 0 && <span className="text-[10px] text-emerald-600 block">✓ {seg.ganhos}</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Relatório de Perdas */}
        <Card className="border-red-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              Relatório de Perdas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.perdidos === 0 ? (
              <div className="text-center py-6">
                <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum lead perdido registrado.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl font-black text-red-600">{stats.perdidos}</span>
                  <span className="text-xs text-muted-foreground">leads perdidos</span>
                </div>
                {Object.entries(stats.motivosPerdaCount).sort((a, b) => b[1] - a[1]).map(([motivo, qtd]) => (
                  <div key={motivo} className="flex items-center gap-3">
                    <span className="text-xs text-slate-600 w-36 shrink-0">{MOTIVOS_PERDA_LABELS[motivo as MotivoPerda] || motivo}</span>
                    <Progress value={(qtd / stats.perdidos) * 100} className="flex-1 h-2 [&>div]:bg-red-400" />
                    <span className="text-xs font-bold text-red-600 shrink-0 w-8 text-right">{qtd}x</span>
                  </div>
                ))}
                {Object.keys(stats.motivosPerdaCount).length === 0 && (
                  <p className="text-xs text-muted-foreground">Motivos não registrados nos leads perdidos.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ranking Vendedores */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            Ranking de Performance Comercial
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left py-2 pr-4">#</th>
                  <th className="text-left py-2 pr-4">Vendedor</th>
                  <th className="text-center py-2 pr-4">Leads</th>
                  <th className="text-center py-2 pr-4">Fechamentos</th>
                  <th className="text-center py-2 pr-4">Conversão</th>
                  <th className="text-right py-2">Carteira</th>
                </tr>
              </thead>
              <tbody>
                {stats.porResponsavel.map((r, i) => (
                  <tr key={r.responsavel} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="py-2.5 pr-4">
                      <span className={`text-sm font-black ${i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-orange-600" : "text-slate-400"}`}>
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 font-semibold text-slate-800">{r.responsavel}</td>
                    <td className="py-2.5 pr-4 text-center text-muted-foreground">{r.total}</td>
                    <td className="py-2.5 pr-4 text-center">
                      <span className="font-bold text-emerald-600">{r.ganhos}</span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center justify-center gap-2">
                        <Progress value={r.taxa} className="w-16 h-1.5" />
                        <span className="text-xs font-bold text-primary">{r.taxa.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right text-xs font-bold text-slate-700">{fmt(r.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Playbook por Etapa */}
      <Card className="border-blue-100 bg-blue-50/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            Playbook Comercial — Orientações por Etapa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { estagio: "Lead Novo", acao: "Fazer contato em menos de 2h. Apresentar empresa brevemente. Qualificar volume e região.", urgencia: "🟢" },
              { estagio: "Qualificação", acao: "Entender necessidade real. Identificar dores. Confirmar budget. Agendar diagnóstico.", urgencia: "🟡" },
              { estagio: "Diagnóstico", acao: "Levantar dados operacionais. Calcular volume mensal. Identificar rotas e tipo de veículo.", urgencia: "🟡" },
              { estagio: "Proposta", acao: "Personalizar proposta para o nicho. Enviar em PDF + link. Confirmar recebimento em 4h.", urgencia: "🔴" },
              { estagio: "Negociação", acao: "Não dar desconto sem contrapartida. Oferecer alternativas. Definir prazo máximo de 3 dias.", urgencia: "🔴" },
              { estagio: "Pós-Venda", acao: "Onboarding em 48h. Check-in semanal no primeiro mês. Buscar expansão após 60 dias.", urgencia: "🟢" },
            ].map(item => (
              <div key={item.estagio} className="bg-white rounded-lg p-3 border border-slate-200">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-sm">{item.urgencia}</span>
                  <p className="text-xs font-bold text-slate-800">{item.estagio}</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.acao}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
