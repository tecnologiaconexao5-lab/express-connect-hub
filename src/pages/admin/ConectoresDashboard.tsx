import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { conectoresService } from "@/services/ia/conectoresService";
import {
  Activity, Wifi, WifiOff, Clock, AlertTriangle, RefreshCw,
  CheckCircle2, XCircle, Play, Search, Mail, MessageSquare,
  Database, Download, ArrowUpDown, Shield, Loader2
} from "lucide-react";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import type { IaExecucaoConector } from "@/services/ia/conectoresService";
import { conectorQueueService } from "@/services/ia/conectorQueueService";

type ConnectorStatus = "online" | "falhando" | "pendente" | "simulado";

interface ConectorComSaude {
  id: string;
  codigo_unico: string;
  nome: string;
  tipo: string;
  provedor: string;
  modo_padrao: string;
  ativo: boolean;
  saudacao: ConnectorStatus;
  ultima_execucao: string | null;
}

interface DashboardData {
  conectores: ConectorComSaude[];
  execucoes_hoje: { total: number; concluidas: number; falhas: number; pendentes: number };
  taxa_sucesso: number;
  ultimas_execucoes: IaExecucaoConector[];
  fila_pendentes: number;
  duplicatas_hoje: number;
  tempo_medio_ms: number;
  disponibilidade_percentual: number;
}

function statusBadge(status: string) {
  switch (status) {
    case "CONCLUIDA": return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100"><CheckCircle2 className="w-3 h-3 mr-1" />Concluída</Badge>;
    case "FALHOU": return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100"><XCircle className="w-3 h-3 mr-1" />Falhou</Badge>;
    case "SOLICITADA":
    case "EM_EXECUCAO": return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Pendente</Badge>;
    case "CANCELADA": return <Badge variant="secondary"><XCircle className="w-3 h-3 mr-1" />Cancelada</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

function saudacaoIcon(s: ConnectorStatus) {
  switch (s) {
    case "online": return <Wifi className="w-5 h-5 text-green-500" />;
    case "falhando": return <WifiOff className="w-5 h-5 text-red-500" />;
    case "pendente": return <Clock className="w-5 h-5 text-amber-500" />;
    case "simulado": return <AlertTriangle className="w-5 h-5 text-blue-400" />;
  }
}

function saudacaoBadge(s: ConnectorStatus) {
  switch (s) {
    case "online": return <Badge className="bg-green-100 text-green-700 border-green-200"><Wifi className="w-3 h-3 mr-1" />Online</Badge>;
    case "falhando": return <Badge className="bg-red-100 text-red-700 border-red-200"><WifiOff className="w-3 h-3 mr-1" />Falhando</Badge>;
    case "pendente": return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
    case "simulado": return <Badge className="bg-blue-100 text-blue-700 border-blue-200"><AlertTriangle className="w-3 h-3 mr-1" />Simulado</Badge>;
  }
}

function conectorIcon(tipo: string) {
  switch (tipo) {
    case "EMAIL": return <Mail className="w-5 h-5" />;
    case "WHATSAPP": return <MessageSquare className="w-5 h-5" />;
    default: return <Database className="w-5 h-5" />;
  }
}

function formatDate(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatDuration(ms: number | null) {
  if (ms === null || ms === undefined) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function ConectoresDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState("dashboard");
  const [filtroConector, setFiltroConector] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroBusca, setFiltroBusca] = useState("");
  const [reprocessando, setReprocessando] = useState<string | null>(null);

  const isSuperAdmin = user?.role === "super_admin";

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const d = await conectoresService.obterDashboard();
      setData(d);
    } catch (err) {
      console.error("[ConectoresDashboard] erro:", err);
      toast.error("Erro ao carregar dashboard de conectores");
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const handleReprocessar = async (execId: string) => {
    setReprocessando(execId);
    try {
      const result = await conectoresService.reprocessarExecucao(execId);
      if (result.sucesso) {
        toast.success(result.mensagem);
      } else {
        toast.error(result.mensagem);
      }
      await carregar();
    } catch (err) {
      toast.error("Erro ao reprocessar");
    }
    setReprocessando(null);
  };

  const execsFiltradas = (data?.ultimas_execucoes || []).filter(e => {
    if (filtroConector !== "todos" && e.conector_id !== filtroConector) return false;
    if (filtroStatus !== "todos" && e.status !== filtroStatus) return false;
    if (filtroBusca) {
      const busca = filtroBusca.toLowerCase();
      const nome = (e.conector_nome || "").toLowerCase();
      const acao = (e.acao || "").toLowerCase();
      const erro = (e.erro || "").toLowerCase();
      if (!nome.includes(busca) && !acao.includes(busca) && !erro.includes(busca)) return false;
    }
    return true;
  });

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full px-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="w-8 h-8 text-primary" /> Monitor de Conectores
          </h1>
          <p className="text-muted-foreground">Status, logs e reprocessamento dos conectores de produção assistida</p>
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin && <Badge variant="outline" className="text-purple-600 border-purple-300"><Shield className="w-3 h-3 mr-1" />Super Admin</Badge>}
          <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </div>

      {/* === INDICADORES === */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm text-muted-foreground">Execuções Hoje</CardTitle></CardHeader>
          <CardContent className="pb-3"><p className="text-3xl font-bold">{data?.execucoes_hoje.total || 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm text-muted-foreground">Taxa Sucesso</CardTitle></CardHeader>
          <CardContent className="pb-3">
            <p className={`text-3xl font-bold ${(data?.taxa_sucesso || 100) >= 95 ? "text-green-600" : (data?.taxa_sucesso || 100) >= 80 ? "text-amber-600" : "text-red-600"}`}>
              {data?.taxa_sucesso || 100}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm text-muted-foreground">Disponibilidade</CardTitle></CardHeader>
          <CardContent className="pb-3">
            <p className={`text-3xl font-bold ${(data?.disponibilidade_percentual || 100) >= 95 ? "text-green-600" : (data?.disponibilidade_percentual || 100) >= 80 ? "text-amber-600" : "text-red-600"}`}>
              {data?.disponibilidade_percentual || 100}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm text-muted-foreground">Tempo Médio</CardTitle></CardHeader>
          <CardContent className="pb-3"><p className="text-3xl font-bold">{formatDuration(data?.tempo_medio_ms ?? null)}</p></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm text-muted-foreground">Falhas Hoje</CardTitle></CardHeader>
          <CardContent className="pb-3">
            <p className={`text-3xl font-bold ${(data?.execucoes_hoje.falhas || 0) > 0 ? "text-red-600" : "text-green-600"}`}>
              {data?.execucoes_hoje.falhas || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm text-muted-foreground">Pendências (Fila)</CardTitle></CardHeader>
          <CardContent className="pb-3 flex items-center gap-3">
            <p className={`text-3xl font-bold ${(data?.fila_pendentes || 0) > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
              {data?.fila_pendentes || 0}
            </p>
            {(data?.fila_pendentes || 0) > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const r = await conectorQueueService.processarFila(10);
                    toast.success(`Fila processada: ${r.processadas} concluídas, ${r.falhas} falhas`);
                    await carregar();
                  } catch {
                    toast.error("Erro ao processar fila");
                  }
                }}
              >
                <Play className="w-3 h-3 mr-1" /> Processar
              </Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm text-muted-foreground">Duplicatas Bloqueadas</CardTitle></CardHeader>
          <CardContent className="pb-3">
            <p className={`text-3xl font-bold ${(data?.duplicatas_hoje || 0) > 0 ? "text-purple-600" : "text-muted-foreground"}`}>
              {data?.duplicatas_hoje || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm text-muted-foreground">Conectores</CardTitle></CardHeader>
          <CardContent className="pb-3"><p className="text-3xl font-bold">{data?.conectores?.length || 0}</p></CardContent>
        </Card>
      </div>

      <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
        <TabsList className="bg-card justify-start overflow-x-auto border-b rounded-none w-full">
          <TabsTrigger value="dashboard" className="px-5"><Activity className="w-4 h-4 mr-2" />Dashboard</TabsTrigger>
          <TabsTrigger value="logs" className="px-5"><Database className="w-4 h-4 mr-2" />Logs de Execução</TabsTrigger>
        </TabsList>

        {/* === DASHBOARD === */}
        <TabsContent value="dashboard" className="pt-4 space-y-4">
          {/* Cards de Conectores */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data?.conectores.filter(c => c.ativo).map(con => (
              <Card key={con.id} className={`border-l-4 ${
                con.saudacao === "online" ? "border-l-green-500" :
                con.saudacao === "falhando" ? "border-l-red-500" :
                con.saudacao === "pendente" ? "border-l-amber-500" :
                "border-l-blue-400"
              }`}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${
                        con.saudacao === "online" ? "bg-green-100" :
                        con.saudacao === "falhando" ? "bg-red-100" :
                        con.saudacao === "pendente" ? "bg-amber-100" : "bg-blue-100"
                      }`}>
                        {conectorIcon(con.tipo)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{con.nome}</p>
                        <p className="text-xs text-muted-foreground">{con.provedor} · {con.tipo}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {saudacaoIcon(con.saudacao)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    {saudacaoBadge(con.saudacao)}
                    <Badge variant="outline" className="text-xs">{con.modo_padrao}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Última execução: {formatDate(con.ultima_execucao)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {(!data?.conectores || data.conectores.length === 0) && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Database className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>Nenhum conector ativo encontrado.</p>
                <p className="text-sm">Configure conectores na aba Conectores da Central IA.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* === LOGS === */}
        <TabsContent value="logs" className="pt-4 space-y-4">
          <Card>
            <CardHeader className="py-4">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div><CardTitle>Logs de Execução</CardTitle><CardDescription>Últimas 50 execuções dos conectores</CardDescription></div>
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="relative w-48">
                    <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      className="pl-8 h-9 text-sm"
                      value={filtroBusca}
                      onChange={e => setFiltroBusca(e.target.value)}
                    />
                  </div>
                  <Select value={filtroConector} onValueChange={setFiltroConector}>
                    <SelectTrigger className="h-9 w-40 text-sm"><SelectValue placeholder="Conector" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos conectores</SelectItem>
                      {(data?.conectores || []).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                    <SelectTrigger className="h-9 w-36 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos status</SelectItem>
                      <SelectItem value="CONCLUIDA">Concluída</SelectItem>
                      <SelectItem value="FALHOU">Falhou</SelectItem>
                      <SelectItem value="SOLICITADA">Pendente</SelectItem>
                      <SelectItem value="CANCELADA">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" className="h-9" onClick={() => { setFiltroConector("todos"); setFiltroStatus("todos"); setFiltroBusca(""); }}>
                    Limpar
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Ordenado por data (mais recente)</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {execsFiltradas.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum log encontrado com os filtros atuais.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Data/Hora</TableHead>
                        <TableHead className="text-xs">Conector</TableHead>
                        <TableHead className="text-xs">Ação</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Duração</TableHead>
                        <TableHead className="text-xs">Erro / Detalhe</TableHead>
                        <TableHead className="text-xs text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {execsFiltradas.map(exec => (
                        <TableRow key={exec.id} className={exec.status === "FALHOU" ? "bg-red-50/30 dark:bg-red-950/10" : ""}>
                          <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                            {formatDate(exec.created_at)}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium">{exec.conector_nome || exec.conector_id.slice(0, 8)}</span>
                            {exec.conector_tipo && (
                              <Badge variant="outline" className="ml-1 text-xs">{exec.conector_tipo}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate" title={exec.acao}>
                            {exec.acao}
                          </TableCell>
                          <TableCell>{statusBadge(exec.status)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">{formatDuration(exec.duracao_ms)}</TableCell>
                          <TableCell className="text-xs max-w-[250px]">
                            {exec.erro ? (
                              <span className="text-red-600 truncate block" title={exec.erro}>{exec.erro}</span>
                            ) : exec.status === "CONCLUIDA" ? (
                              <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> OK</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {(exec.status === "FALHOU" || exec.erro) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleReprocessar(exec.id)}
                                disabled={reprocessando === exec.id}
                              >
                                {reprocessando === exec.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                ) : (
                                  <Play className="w-3 h-3 mr-1" />
                                )}
                                Reprocessar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
