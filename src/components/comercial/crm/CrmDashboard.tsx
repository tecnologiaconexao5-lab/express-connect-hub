import { useMemo } from "react";
import {
  TrendingUp, TrendingDown, Users, DollarSign, Target, AlertTriangle,
  CheckCircle, Clock, Zap, Brain, Award, BarChart2, ArrowUp, ArrowDown,
  Flame, Snowflake, Activity, Bell
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Lead, ESTAGIOS_CONFIG, TEMPERATURA_CONFIG, gerarSugestaoIA } from "./crmTypes";

interface CrmDashboardProps {
  leads: Lead[];
  onAbrirLead: (lead: Lead) => void;
}

export default function CrmDashboard({ leads, onAbrirLead }: CrmDashboardProps) {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const metricas = useMemo(() => {
    const ativos = leads.filter(l => l.estagio !== "fechado_ganho" && l.estagio !== "fechado_perdido");
    const ganhos = leads.filter(l => l.estagio === "fechado_ganho");
    const perdidos = leads.filter(l => l.estagio === "fechado_perdido");
    const totalFechados = ganhos.length + perdidos.length;
    const taxaConversao = totalFechados > 0 ? ((ganhos.length / totalFechados) * 100) : 0;

    const receitaPrevista = ativos.reduce((acc, l) => acc + l.valorEstimadoMensal, 0);
    const receitaPropavel = ativos
      .filter(l => l.probabilidadeFechamento >= 50)
      .reduce((acc, l) => acc + (l.valorEstimadoMensal * l.probabilidadeFechamento / 100), 0);
    const receitaConfirmada = ganhos.reduce((acc, l) => acc + l.valorEstimadoMensal, 0);
    const ticketMedio = ganhos.length > 0
      ? ganhos.reduce((acc, l) => acc + l.valorEstimadoMensal, 0) / ganhos.length
      : ativos.length > 0 ? ativos.reduce((acc, l) => acc + l.valorEstimadoMensal, 0) / ativos.length : 0;

    const leadsEmRisco = leads.filter(l =>
      l.diasNaEtapa > 5 &&
      l.estagio !== "fechado_ganho" &&
      l.estagio !== "fechado_perdido"
    );
    const leadsQuentes = leads.filter(l =>
      (l.temperatura === "quente" || l.temperatura === "em_chamas") &&
      l.estagio !== "fechado_ganho" &&
      l.estagio !== "fechado_perdido"
    );

    return {
      totalLeads: leads.length,
      leadsAtivos: ativos.length,
      taxaConversao: Math.round(taxaConversao),
      receitaPrevista,
      receitaPropavel,
      receitaConfirmada,
      ticketMedio,
      leadsEmRisco,
      leadsQuentes,
      ganhos: ganhos.length,
      perdidos: perdidos.length,
    };
  }, [leads]);

  const distribuicaoEstagio = useMemo(() => {
    return Object.entries(ESTAGIOS_CONFIG).map(([key, cfg]) => ({
      estagio: key,
      label: cfg.label,
      count: leads.filter(l => l.estagio === key).length,
      valor: leads.filter(l => l.estagio === key).reduce((a, l) => a + l.valorEstimadoMensal, 0),
      corBg: cfg.corBg,
      cor: cfg.cor,
    })).filter(e => e.count > 0);
  }, [leads]);

  const alertasIA = useMemo(() => {
    return leads
      .filter(l => l.estagio !== "fechado_ganho" && l.estagio !== "fechado_perdido")
      .map(l => ({ lead: l, sugestao: gerarSugestaoIA(l) }))
      .filter(({ sugestao }) => sugestao.tipo !== "sugestao" || sugestao.mensagem.includes("quente"))
      .slice(0, 5);
  }, [leads]);

  const topLeads = useMemo(() =>
    [...leads]
      .filter(l => l.estagio !== "fechado_perdido")
      .sort((a, b) => b.probabilidadeFechamento - a.probabilidadeFechamento)
      .slice(0, 5),
    [leads]
  );

  return (
    <div className="space-y-6">
      {/* KPIs Principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-5 h-5 opacity-80" />
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Total</span>
            </div>
            <p className="text-3xl font-black">{metricas.totalLeads}</p>
            <p className="text-xs opacity-80 mt-1">{metricas.leadsAtivos} ativos</p>
            <div className="flex items-center gap-1 mt-2 text-xs opacity-70">
              <ArrowUp className="w-3 h-3" /> 12% este mês
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Target className="w-5 h-5 opacity-80" />
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Conversão</span>
            </div>
            <p className="text-3xl font-black">{metricas.taxaConversao}%</p>
            <p className="text-xs opacity-80 mt-1">{metricas.ganhos} fechados / {metricas.perdidos} perdidos</p>
            <div className="flex items-center gap-1 mt-2 text-xs opacity-70">
              <TrendingUp className="w-3 h-3" /> Meta: 35%
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-600 to-violet-700 text-white border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-5 h-5 opacity-80" />
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Receita Prevista</span>
            </div>
            <p className="text-xl font-black">{fmt(metricas.receitaPrevista)}</p>
            <p className="text-xs opacity-80 mt-1">Provável: {fmt(metricas.receitaPropavel)}</p>
            <div className="flex items-center gap-1 mt-2 text-xs opacity-70">
              <CheckCircle className="w-3 h-3" /> Confirmada: {fmt(metricas.receitaConfirmada)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Award className="w-5 h-5 opacity-80" />
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Ticket Médio</span>
            </div>
            <p className="text-xl font-black">{fmt(metricas.ticketMedio)}</p>
            <p className="text-xs opacity-80 mt-1">/mês por cliente</p>
            <div className="flex items-center gap-1 mt-2 text-xs opacity-70">
              <BarChart2 className="w-3 h-3" /> Base: {leads.filter(l => l.estagio === "fechado_ganho").length} clientes
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Funil Visual + Alertas IA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Distribuição por Etapa */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              Distribuição do Funil de Vendas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {distribuicaoEstagio.map(e => (
              <div key={e.estagio} className="flex items-center gap-3">
                <div className={`text-xs font-bold px-2 py-1 rounded-md border ${e.corBg} ${e.cor} w-36 text-center shrink-0`}>
                  {e.label}
                </div>
                <div className="flex-1 relative">
                  <div className="h-6 bg-slate-100 rounded-md overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary/80 to-primary rounded-md transition-all duration-700"
                      style={{ width: `${Math.max((e.count / (leads.length || 1)) * 100, 3)}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 w-28 text-right">
                  <Badge variant="secondary" className="text-xs">{e.count} leads</Badge>
                  <span className="text-xs text-muted-foreground">{fmt(e.valor)}</span>
                </div>
              </div>
            ))}
            {distribuicaoEstagio.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum lead no funil.</p>
            )}
          </CardContent>
        </Card>

        {/* Alertas IA */}
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="w-4 h-4 text-amber-600" />
              Inteligência Comercial
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alertasIA.length === 0 ? (
              <div className="text-center py-4">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Tudo em dia! Nenhum alerta.</p>
              </div>
            ) : (
              alertasIA.map(({ lead, sugestao }) => (
                <div
                  key={lead.id}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer hover:shadow-sm transition-all ${sugestao.tipo === "urgente"
                    ? "bg-red-50 border-red-200"
                    : sugestao.tipo === "alerta"
                      ? "bg-amber-50 border-amber-200"
                      : "bg-blue-50 border-blue-200"
                    }`}
                  onClick={() => onAbrirLead(lead)}
                >
                  <div className="flex items-start gap-1.5">
                    {sugestao.tipo === "urgente"
                      ? <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                      : sugestao.tipo === "alerta"
                        ? <Bell className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        : <Zap className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                    }
                    <div>
                      <p className="font-bold text-slate-800 truncate">{lead.empresa}</p>
                      <p className="text-slate-600 mt-0.5">{sugestao.mensagem}</p>
                      <p className="text-primary mt-1 font-medium">→ {sugestao.acao}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Leads + Temperatura */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Leads por Probabilidade */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              Top Leads — Maior Probabilidade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topLeads.map((lead, i) => (
              <div
                key={lead.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200 transition-all"
                onClick={() => onAbrirLead(lead)}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-slate-100 text-slate-600" : "bg-orange-50 text-orange-600"}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate text-slate-800">{lead.empresa}</p>
                  <p className="text-xs text-muted-foreground truncate">{lead.tipoServico} · {ESTAGIOS_CONFIG[lead.estagio]?.label}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-slate-800">{fmt(lead.valorEstimadoMensal)}</p>
                  <div className="flex items-center gap-1 justify-end mt-0.5">
                    <Progress value={lead.probabilidadeFechamento} className="w-12 h-1.5" />
                    <span className="text-xs font-bold text-primary">{lead.probabilidadeFechamento}%</span>
                  </div>
                </div>
                <span className="text-base shrink-0" title={TEMPERATURA_CONFIG[lead.temperatura]?.label}>
                  {TEMPERATURA_CONFIG[lead.temperatura]?.emoji}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Leads em Risco + Performance Vendedores */}
        <Card className="border-red-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Leads em Risco de Perda
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metricas.leadsEmRisco.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum lead em risco no momento.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {metricas.leadsEmRisco.map(lead => (
                  <div
                    key={lead.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-red-50 border border-red-200 cursor-pointer hover:shadow-sm transition-all"
                    onClick={() => onAbrirLead(lead)}
                  >
                    <Clock className="w-4 h-4 text-red-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-slate-800 truncate">{lead.empresa}</p>
                      <p className="text-xs text-red-600">{lead.diasNaEtapa} dias sem atualização</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-red-700">{fmt(lead.valorEstimadoMensal)}</p>
                      <Badge variant="outline" className="text-[10px] border-red-300 text-red-600 mt-0.5">
                        {ESTAGIOS_CONFIG[lead.estagio]?.label}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Métricas de Temperatura */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Temperatura dos Leads Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(["frio", "morno", "quente", "em_chamas"] as const).map(temp => {
              const cfg = TEMPERATURA_CONFIG[temp];
              const count = leads.filter(l =>
                l.temperatura === temp &&
                l.estagio !== "fechado_ganho" &&
                l.estagio !== "fechado_perdido"
              ).length;
              const valor = leads
                .filter(l => l.temperatura === temp && l.estagio !== "fechado_ganho" && l.estagio !== "fechado_perdido")
                .reduce((a, l) => a + l.valorEstimadoMensal, 0);
              return (
                <div key={temp} className="text-center p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-2xl mb-1">{cfg.emoji}</div>
                  <p className={`text-sm font-bold ${cfg.cor}`}>{cfg.label}</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">{count}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmt(valor)}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
