import { useCallback, useRef, useEffect } from "react";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Activity, Target, Users, TrendingUp, AlertTriangle,
  Play, RefreshCw, Zap, Search, BarChart3, DollarSign,
  Settings, Shield, MessageSquare, Brain, Gauge, Volume2, Database, Globe,
} from "lucide-react";
import { useComercialIA } from "@/services/ia/useComercialIA";
import { TEMPERATURA_CONFIG } from "@/components/comercial/crm/crmTypes";

interface Props { roboId?: string }

export default function ComercialIADashboard({ roboId }: Props) {
  const {
    workerStatus, dashboard, metricasAprendizado,
    ultimasExecucoes, ultimosResultados, loading,
    carregarDados, worker, config,
  } = useComercialIA(roboId);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleForcarCiclo = useCallback(async () => {
    await worker.forcarCiclo();
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => carregarDados(), 3000);
  }, [worker, carregarDados]);

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="w-8 h-8 animate-pulse text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  const getTemperaturaBadge = (temp?: string) => {
    if (!temp) return null;
    const cfg = TEMPERATURA_CONFIG[temp as keyof typeof TEMPERATURA_CONFIG];
    if (!cfg) return null;
    return <Badge variant="outline" className={cfg.cor}>{cfg.emoji} {cfg.label}</Badge>;
  };

  const estrategia = config?.estrategia;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Comercial IA — Hunter SDR</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={workerStatus.rodando ? "default" : "secondary"}>
                {workerStatus.rodando ? "Ativo" : "Parado"}
              </Badge>
              <Button variant="outline" size="sm" onClick={handleForcarCiclo}>
                <Play className="w-4 h-4 mr-1" /> Executar Ciclo
              </Button>
              <Button variant="outline" size="sm" onClick={() => carregarDados()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <CardDescription>
            Ultimo ciclo: {workerStatus.ultimo_ciclo
              ? new Date(workerStatus.ultimo_ciclo).toLocaleString("pt-BR")
              : "Nunca executado"}
            {workerStatus.ultimo_resultado && ` — ${workerStatus.ultimo_resultado}`}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Sumario da Estrategia Ativa */}
      {estrategia && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm">Estrategia Ativa</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground flex items-center gap-1"><Target className="w-3 h-3" /> Alvos:</span>
                <span className="font-medium">{(estrategia.segmentos_alvo || []).slice(0, 3).join(", ")}{(estrategia.segmentos_alvo?.length || 0) > 3 ? "..." : ""}</span>
              </div>
              <div>
                <span className="text-muted-foreground flex items-center gap-1"><Shield className="w-3 h-3" /> Score min:</span>
                <span className="font-medium">{estrategia.descarte?.score_minimo_auto ?? 20} / Lead quente: {estrategia.lead_quente?.score_minimo ?? 80}+</span>
              </div>
              <div>
                <span className="text-muted-foreground flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Canais:</span>
                <span className="font-medium">
                  {Object.entries(estrategia.canais || {})
                    .filter(([k, v]) => k !== "ordem_prioridade" && v)
                    .map(([k]) => k).join(", ")}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground flex items-center gap-1"><Volume2 className="w-3 h-3" /> Tom:</span>
                <span className="font-medium">{estrategia.tom_voz?.estilo} / {estrategia.tom_voz?.formalidade}</span>
              </div>
              <div>
                <span className="text-muted-foreground flex items-center gap-1"><Brain className="w-3 h-3" /> IA:</span>
                <span className="font-medium">{estrategia.ia?.provider} / {estrategia.ia?.model}</span>
              </div>
              <div>
                <span className="text-muted-foreground flex items-center gap-1"><Gauge className="w-3 h-3" /> Limites:</span>
                <span className="font-medium">{estrategia.limites?.leads_por_dia ?? 10} leads/dia, {(estrategia.limites?.prospeccoes_por_ciclo ?? 20)} prospeccoes</span>
              </div>
              <div>
                <span className="text-muted-foreground flex items-center gap-1"><DollarSign className="w-3 h-3" /> Orcamento:</span>
                <span className="font-medium">US${estrategia.orcamento?.diario ?? 10}/dia</span>
              </div>
              <div>
                <span className="text-muted-foreground flex items-center gap-1"><Activity className="w-3 h-3" /> Modo:</span>
                <Badge variant={config?.modo === "automatico" ? "default" : "secondary"} className="text-xs">
                  {config?.modo === "automatico" ? "Auto" : config?.modo === "assistido" ? "Assistido" : "Manual"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Search className="w-4 h-4" /> Empresas Encontradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{dashboard.total_encontradas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" /> Leads Criados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{dashboard.total_leads}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Descartados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{dashboard.total_descartados}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Zap className="w-4 h-4" /> Duplicatas Evitadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{dashboard.total_duplicatas}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Taxa Conversao
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{metricasAprendizado.taxa_conversao_percent}%</div>
            <p className="text-xs text-muted-foreground">{metricasAprendizado.total} interacoes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lead Quentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{dashboard.leads_quentes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Execucoes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{dashboard.execucoes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Respostas Positivas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {metricasAprendizado.respondeu + metricasAprendizado.orcamento + metricasAprendizado.virou_cliente + metricasAprendizado.fechou}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Confianca Baixa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">{dashboard.total_confianca_baixa}</div>
          </CardContent>
        </Card>
      </div>

      {/* Metricas por Provider */}
      {Object.keys(dashboard.por_provider).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm">Leads por Provider</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(dashboard.por_provider).map(([provider, metrics]) => (
                <div key={provider} className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className="w-3 h-3 text-muted-foreground" />
                    <span className="text-sm font-medium">{provider}</span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between"><span>Leads:</span><span className="font-medium text-green-600">{metrics.leads}</span></div>
                    <div className="flex justify-between"><span>Descartados:</span><span className="font-medium text-yellow-600">{metrics.descartados}</span></div>
                    <div className="flex justify-between"><span>Duplicatas:</span><span className="font-medium text-blue-600">{metrics.duplicatas}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ultimos Resultados</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Temperatura</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ultimosResultados.slice(0, 10).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.empresa}</TableCell>
                  <TableCell>{r.segmento || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={r.score_ia >= (config?.estrategia?.lead_quente?.score_minimo || 80) ? "default" : "secondary"}>
                      {r.score_ia}
                    </Badge>
                  </TableCell>
                  <TableCell>{getTemperaturaBadge(r.temperatura)}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "lead_criado" ? "default" : r.status === "descartado" ? "destructive" : r.status === "duplicado" ? "secondary" : "outline"}>
                      {r.status === "lead_criado" ? "Lead" : r.status === "descartado" ? "Descartado" : r.status === "duplicado" ? "Duplicata" : r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))}
              {ultimosResultados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum resultado encontrado. Execute o primeiro ciclo.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Respondeu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{metricasAprendizado.respondeu}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Ignorou</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{metricasAprendizado.ignorou}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Recusou</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{metricasAprendizado.recusou}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Fechou</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-600">{metricasAprendizado.fechou}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
