import { useState, useEffect, useCallback } from "react";
import {
  BrainCircuit, Activity, AlertTriangle, CheckCircle2, XCircle,
  Pause, Play, RefreshCw, Loader2, ArrowUpDown, Shield,
} from "lucide-react";
import { TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useDiretorVirtual } from "@/services/ia/useDiretorVirtual";
import type { DecisaoDiretor, ImpactoDecisao, AcaoDecisao, TipoDecisao } from "@/services/ia/diretorVirtualService";

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

const STATUS_DIRETOR_CORES: Record<string, string> = {
  inativo: "bg-gray-100 text-gray-600",
  analisando: "bg-blue-100 text-blue-800",
  ativo: "bg-green-100 text-green-800",
  erro: "bg-red-100 text-red-800",
};

const MODO_LABELS: Record<string, string> = {
  auto: "Automático",
  semi_auto: "Semi-Automático",
  manual: "Manual",
};

function fmtData(d: string | null | undefined) {
  if (!d) return "-";
  try { return new Date(d).toLocaleString("pt-BR"); } catch { return d; }
}

export function DiretorVirtualTab() {
  const {
    workerStatus, config, decisoes, metricas,
    iniciarWorker, forcarCiclo, atualizarConfig,
    aprovarDecisao, rejeitarDecisao, recarregar,
  } = useDiretorVirtual();

  const [aprovando, setAprovando] = useState<string | null>(null);

  useEffect(() => {
    iniciarWorker(45000);
  }, [iniciarWorker]);

  const handleModoChange = useCallback(async (modo: string) => {
    await atualizarConfig({ modo_operacao: modo as any });
    toast.success(`Modo alterado para ${MODO_LABELS[modo] || modo}`);
  }, [atualizarConfig]);

  const handleAprovar = useCallback(async (id: string) => {
    setAprovando(id);
    try {
      await aprovarDecisao(id);
      toast.success("Decisão executada");
      recarregar();
    } finally { setAprovando(null); }
  }, [aprovarDecisao, recarregar]);

  const handleRejeitar = useCallback(async (id: string) => {
    await rejeitarDecisao(id);
    toast.success("Decisão rejeitada");
    recarregar();
  }, [rejeitarDecisao, recarregar]);

  const pendentes = decisoes.filter((d) => d.status === "pending" || !d.executado);
  const executadas = decisoes.filter((d) => d.executado);
  const criticalCount = decisoes.filter((d) => d.impacto === "critical" && d.status !== "rejected").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-purple-600" />
            Diretor Virtual IA
          </h2>
          <Badge variant="outline" className={`${STATUS_DIRETOR_CORES[workerStatus.estado] || ""} flex items-center gap-1`}>
            <span className={`h-2 w-2 rounded-full ${
              workerStatus.estado === "ativo" ? "bg-green-500" :
              workerStatus.estado === "analisando" ? "bg-blue-500" :
              workerStatus.estado === "erro" ? "bg-red-500" : "bg-gray-400"
            }`} />
            {workerStatus.estado === "analisando" ? "Analisando..." :
             workerStatus.estado === "ativo" ? "Ativo" :
             workerStatus.estado === "erro" ? "Erro" : "Inativo"}
          </Badge>
          {criticalCount > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />{criticalCount} críticas
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {pendentes.length} pendentes · {executadas.length} executadas
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Modo:</Label>
            <Select value={config?.modo_operacao || "semi_auto"} onValueChange={handleModoChange}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automático</SelectItem>
                <SelectItem value="semi_auto">Semi-Automático</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" className="h-8" onClick={async () => {
            const decisoesNovas = await forcarCiclo();
            toast.success(`Ciclo: ${decisoesNovas.length} decisões geradas`);
            recarregar();
          }}>
            <RefreshCw className="mr-1 h-3 w-3" />Forçar Ciclo
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Robôs Monitorados</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{metricas.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Decisões Hoje</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{workerStatus.totalDecisoes}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Ações Automáticas</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{workerStatus.totalAcoes}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Última Análise</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-bold">{fmtData(workerStatus.ultimaAnalise)}</p></CardContent>
        </Card>
      </div>

      {/* MÉTRICAS POR ROBÔ */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" />Métricas por Robô</CardTitle></CardHeader>
        <CardContent>
          {metricas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma métrica disponível</p>
          ) : (
            <div className="space-y-3">
              {metricas.map((m) => (
                <div key={m.robo_id} className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.robo_nome || m.robo_id}</p>
                    <p className="text-xs text-muted-foreground">{m.robo_setor || "-"}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <div className="text-center">
                      <p className="font-medium">{m.rotinas_ativas}</p>
                      <p className="text-muted-foreground">ativas</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-orange-600">{m.rotinas_atrasadas}</p>
                      <p className="text-muted-foreground">atrasadas</p>
                    </div>
                    <div className="text-center">
                      <p className={`font-medium ${m.falhas_24h > 0 ? "text-red-600" : ""}`}>{m.falhas_24h}</p>
                      <p className="text-muted-foreground">falhas</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium">{m.execucoes_24h}</p>
                      <p className="text-muted-foreground">execuções</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-16 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${m.carga_percentual > 80 ? "bg-red-500" : m.carga_percentual > 50 ? "bg-yellow-500" : "bg-green-500"}`}
                            style={{ width: `${Math.min(100, m.carga_percentual)}%` }}
                          />
                        </div>
                        <span className={`font-medium ${m.carga_percentual > 80 ? "text-red-600" : ""}`}>{Math.round(m.carga_percentual)}%</span>
                      </div>
                      <p className="text-muted-foreground">carga</p>
                    </div>
                    <Badge className={`text-[10px] ${
                      m.risco_score > 70 ? "bg-red-100 text-red-800" :
                      m.risco_score > 40 ? "bg-yellow-100 text-yellow-800" :
                      "bg-green-100 text-green-800"
                    }`}>
                      Risco {Math.round(m.risco_score)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* DECISÕES PENDENTES */}
      {pendentes.length > 0 && (
        <Card className="border-amber-300">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-4 w-4" />Decisões Pendentes ({pendentes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendentes.map((d) => (
              <div key={d.id} className="flex items-start justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-[10px] ${IMPACTO_CORES[d.impacto] || ""}`}>{d.impacto}</Badge>
                    <Badge variant="outline" className="text-[10px]">{TIPO_LABELS[d.tipo] || d.tipo}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{ACAO_LABELS[d.acao] || d.acao}</Badge>
                    {d.robo_id && <span className="text-xs text-muted-foreground">Robô: {d.robo_id.substring(0, 8)}</span>}
                  </div>
                  <p className="text-sm mt-1">{d.descricao}</p>
                  <p className="text-xs text-muted-foreground mt-1">{fmtData(d.created_at)}</p>
                </div>
                <div className="flex items-center gap-1 ml-3 shrink-0">
                  <Button variant="default" size="sm" className="h-7 text-xs" disabled={aprovando === d.id} onClick={() => handleAprovar(d.id)}>
                    {aprovando === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                    Aprovar
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleRejeitar(d.id)}>
                    <XCircle className="h-3 w-3 mr-1" />Rejeitar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* HISTÓRICO DE DECISÕES */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />Histórico de Decisões
            <Button variant="ghost" size="sm" className="h-6 text-xs ml-auto" onClick={recarregar}>
              <RefreshCw className="h-3 w-3 mr-1" />Atualizar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {decisoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma decisão registrada</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {decisoes.map((d) => (
                <div key={d.id} className="flex items-start gap-3 p-2 bg-muted rounded text-xs">
                  <div className="flex items-center gap-1 mt-0.5">
                    {d.status === "executed" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    ) : d.status === "rejected" ? (
                      <XCircle className="h-3.5 w-3.5 text-red-500" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <Badge className={`text-[10px] ${IMPACTO_CORES[d.impacto] || ""}`}>{d.impacto}</Badge>
                      <Badge variant="outline" className="text-[10px]">{TIPO_LABELS[d.tipo] || d.tipo}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{ACAO_LABELS[d.acao] || d.acao}</Badge>
                      <span className="text-muted-foreground">{fmtData(d.created_at)}</span>
                      {d.executado_em && <span className="text-green-600">Executado: {fmtData(d.executado_em)}</span>}
                    </div>
                    <p className="mt-0.5">{d.descricao}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
