import { useState, useEffect, useCallback } from "react";
import {
  BrainCircuit, Activity, AlertTriangle, CheckCircle2, XCircle,
  RefreshCw, Loader2, Shield, Clock, Zap, AlertOctagon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useDiretorVirtualLive } from "@/services/ia/useDiretorVirtualLive";
import type { EventoDiretorLive } from "@/services/ia/diretorVirtualLiveService";
import type { DecisaoDiretor, ImpactoDecisao, AcaoDecisao, TipoDecisao } from "@/services/ia/diretorVirtualService";

const STATUS_ENGINE_CORES: Record<string, string> = {
  inativo: "bg-gray-100 text-gray-600",
  analisando: "bg-blue-100 text-blue-800",
  ativo: "bg-green-100 text-green-800",
  erro: "bg-red-100 text-red-800",
};

const EVENTO_ICONES: Record<string, React.ElementType> = {
  analise: Activity,
  decisao: BrainCircuit,
  acao: Zap,
  erro: AlertOctagon,
};

const EVENTO_CORES: Record<string, string> = {
  analise: "bg-blue-50 border-blue-200 text-blue-700",
  decisao: "bg-purple-50 border-purple-200 text-purple-700",
  acao: "bg-green-50 border-green-200 text-green-700",
  erro: "bg-red-50 border-red-200 text-red-700",
};

const IMPACTO_CORES: Record<string, string> = {
  low: "bg-green-100 text-green-800 border-green-300",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
  high: "bg-orange-100 text-orange-800 border-orange-300",
  critical: "bg-red-100 text-red-800 border-red-300",
};

const TIPO_LABELS: Record<TipoDecisao, string> = {
  priorizacao: "Priorização",
  risco: "Risco",
  falha: "Falha",
  overload: "Sobrecarga",
  oportunidade: "Oportunidade",
};

const ACAO_LABELS: Record<AcaoDecisao, string> = {
  pause: "Pausar",
  resume: "Reativar",
  repriorizar: "Repriorizar",
  redistribuir: "Redistribuir",
  escalar: "Escalar",
};

function fmtData(d: string | null | undefined) {
  if (!d) return "-";
  try { return new Date(d).toLocaleString("pt-BR"); } catch { return d; }
}

export function DiretorVirtualLiveTab() {
  const {
    engineStatus, eventos, decisoes, metricas,
    iniciarEngine, forcarCiclo, recarregar,
  } = useDiretorVirtualLive();

  useEffect(() => {
    iniciarEngine(30000);
  }, [iniciarEngine]);

  const handleForcarCiclo = useCallback(async () => {
    const resultado = await forcarCiclo();
    if (resultado) {
      toast.success(`Ciclo: ${resultado.decisoesGeradas} decisões · ${resultado.acoesExecutadas} ações · ${resultado.duracaoMs}ms`);
    } else {
      toast.warning("Ciclo já em andamento");
    }
    recarregar();
  }, [forcarCiclo, recarregar]);

  const decisoesPendentes = decisoes.filter((d) => d.status === "pending" || !d.executado);
  const eventosRecentes = eventos.slice(0, 30);
  const metricasAltoRisco = metricas.filter((m) => m.risco_score > 40);
  const metricasBaixoRisco = metricas.filter((m) => m.risco_score <= 40);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-purple-600" />
            Diretor Virtual Live
          </h2>
          <Badge variant="outline" className={`${STATUS_ENGINE_CORES[engineStatus.estado] || ""} flex items-center gap-1`}>
            <span className={`h-2 w-2 rounded-full ${
              engineStatus.estado === "ativo" ? "bg-green-500" :
              engineStatus.estado === "analisando" ? "bg-blue-500" :
              engineStatus.estado === "erro" ? "bg-red-500" : "bg-gray-400"
            }`} />
            {engineStatus.estado === "analisando" ? "Analisando..." :
             engineStatus.estado === "ativo" ? "Ativo" :
             engineStatus.estado === "erro" ? "Erro" : "Inativo"}
          </Badge>
          <Badge variant="outline" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />{engineStatus.intervaloMs / 1000}s
          </Badge>
          {engineStatus.ultimoErro && (
            <Badge variant="destructive" className="text-xs flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />{engineStatus.ultimoErro}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8" onClick={handleForcarCiclo} disabled={engineStatus.estado === "analisando"}>
            {engineStatus.estado === "analisando" ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-3 w-3" />
            )}
            Forçar Ciclo
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Ciclos</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{engineStatus.ciclosCompletados}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Decisões</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{engineStatus.totalDecisoes}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Ações</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{engineStatus.totalAcoes}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Erros</CardTitle></CardHeader>
          <CardContent><p className={`text-2xl font-bold ${engineStatus.totalErros > 0 ? "text-red-600" : ""}`}>{engineStatus.totalErros}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Último Ciclo</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-bold text-xs">{fmtData(engineStatus.ultimoCiclo)}</p></CardContent>
        </Card>
      </div>

      {engineStatus.ultimoResultado && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Último Ciclo</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-6 text-xs">
              <span><strong>{engineStatus.ultimoResultado.metricasColetadas}</strong> métricas</span>
              <span><strong>{engineStatus.ultimoResultado.decisoesGeradas}</strong> decisões</span>
              <span><strong>{engineStatus.ultimoResultado.acoesExecutadas}</strong> ações</span>
              <span className={engineStatus.ultimoResultado.erros > 0 ? "text-red-600" : ""}><strong>{engineStatus.ultimoResultado.erros}</strong> erros</span>
              <span><strong>{engineStatus.ultimoResultado.duracaoMs}ms</strong> duração</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* ROBÔS SOB RISCO */}
        <Card className={metricasAltoRisco.length > 0 ? "border-red-300" : ""}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />Robôs Monitorados
              {metricasAltoRisco.length > 0 && (
                <Badge variant="destructive" className="text-[10px]">{metricasAltoRisco.length} em risco</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-80 overflow-y-auto">
            {metricas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum robô monitorado</p>
            ) : (
              <div className="space-y-2">
                {metricas.map((m) => (
                  <div key={m.robo_id} className={`flex items-center gap-3 p-2 rounded-lg text-xs ${
                    m.risco_score > 70 ? "bg-red-50 border border-red-200" :
                    m.risco_score > 40 ? "bg-yellow-50 border border-yellow-200" :
                    "bg-muted"
                  }`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{m.robo_nome || m.robo_id.substring(0, 8)}</span>
                        {m.robo_setor && <span className="text-muted-foreground">({m.robo_setor})</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={m.rotinas_atrasadas > 0 ? "text-orange-600 font-medium" : ""}>{m.rotinas_ativas} ativas</span>
                      <span className={m.falhas_24h > 0 ? "text-red-600 font-medium" : ""}>{m.falhas_24h} falhas</span>
                      <div className="flex items-center gap-1">
                        <div className="h-1.5 w-12 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${m.carga_percentual > 80 ? "bg-red-500" : m.carga_percentual > 50 ? "bg-yellow-500" : "bg-green-500"}`}
                            style={{ width: `${Math.min(100, m.carga_percentual)}%` }} />
                        </div>
                        <span className={m.carga_percentual > 80 ? "text-red-600" : ""}>{Math.round(m.carga_percentual)}%</span>
                      </div>
                      <Badge className={`text-[10px] ${
                        m.risco_score > 70 ? "bg-red-100 text-red-800" :
                        m.risco_score > 40 ? "bg-yellow-100 text-yellow-800" :
                        "bg-green-100 text-green-800"
                      }`}>
                        {Math.round(m.risco_score)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* EVENTOS EM TEMPO REAL */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />Eventos do Sistema
              <Button variant="ghost" size="sm" className="h-6 text-xs ml-auto" onClick={recarregar}>
                <RefreshCw className="h-3 w-3 mr-1" />Atualizar
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-80 overflow-y-auto">
            {eventosRecentes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum evento registrado</p>
            ) : (
              <div className="space-y-1">
                {eventosRecentes.map((ev) => {
                  const Icone = EVENTO_ICONES[ev.tipo_evento] || Activity;
                  return (
                    <div key={ev.id} className={`flex items-start gap-2 p-1.5 rounded text-xs ${EVENTO_CORES[ev.tipo_evento] || "bg-muted"}`}>
                      <Icone className="h-3 w-3 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{ev.descricao}</p>
                        <p className="text-muted-foreground">{fmtData(ev.created_at)}</p>
                      </div>
                      {ev.robo_id && (
                        <Badge variant="outline" className="text-[9px] shrink-0">
                          {ev.robo_id.substring(0, 8)}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* DECISÕES PENDENTES */}
      {decisoesPendentes.length > 0 && (
        <Card className="border-amber-300">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-4 w-4" />Decisões Pendentes ({decisoesPendentes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-60 overflow-y-auto space-y-2">
            {decisoesPendentes.map((d) => (
              <div key={d.id} className="flex items-start gap-3 p-2 bg-amber-50 rounded border border-amber-200 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <Badge className={`text-[9px] ${IMPACTO_CORES[d.impacto] || ""}`}>{d.impacto}</Badge>
                    <Badge variant="outline" className="text-[9px]">{TIPO_LABELS[d.tipo] || d.tipo}</Badge>
                    <Badge variant="secondary" className="text-[9px]">{ACAO_LABELS[d.acao] || d.acao}</Badge>
                    {d.robo_id && <span className="text-muted-foreground">Robô: {d.robo_id.substring(0, 8)}</span>}
                  </div>
                  <p className="mt-0.5">{d.descricao}</p>
                  <p className="text-muted-foreground mt-0.5">{fmtData(d.created_at)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ROTINAS PAUSADAS AUTOMATICAMENTE */}
      {metricas.filter((m) => m.rotinas_ativas === 0 && m.rotinas_atrasadas > 0).length > 0 && (
        <Card className="border-red-200 bg-red-50/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-red-700">
              <AlertOctagon className="h-4 w-4" />Robôs com Todas as Rotinas Pausadas
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            {metricas.filter((m) => m.rotinas_ativas === 0 && m.rotinas_atrasadas > 0).map((m) => (
              <p key={m.robo_id}>- {m.robo_nome || m.robo_id}: {m.rotinas_atrasadas} rotinas atrasadas</p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
