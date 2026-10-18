import { useState, useEffect, useCallback } from "react";
import {
  BrainCircuit, Bot, UserCheck, ListTodo,
  CheckCircle2, XCircle, MessageSquare, AlertTriangle,
  RefreshCw, Search, Calendar, FileText, Logs,
  Activity, Clock, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { roboRecrutamentoMonitorService, type MonitorResumo, type ExecucaoResumo, type DetalhesExecucao } from "@/services/centralIa/roboRecrutamentoMonitorService";

const ACCOES_TIMELINE: Record<string, string> = {
  candidato_detectado: "Candidato detectado",
  robo_encontrado: "Robô acionado",
  robo_validado: "Robô validado",
  contexto_montado: "Contexto carregado",
  recomendacao_gerada: "Recomendação gerada",
  tarefa_criada: "Tarefa criada",
  aprovacao_criada: "Aprovação criada",
  simulacao_comunicacao: "Comunicação simulada",
  processamento_finalizado: "Processamento finalizado",
  falha_processamento: "Falha no processamento",
  tarefa_ja_existente: "Tarefa já existente",
};

const STATUS_BADGE: Record<string, string> = {
  sucesso: "bg-emerald-100 text-emerald-700",
  erro: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
  aviso: "bg-amber-100 text-amber-700",
};

export default function RoboRecrutamentoMonitor() {
  const [resumo, setResumo] = useState<MonitorResumo | null>(null);
  const [execucoes, setExecucoes] = useState<ExecucaoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [detalhes, setDetalhes] = useState<DetalhesExecucao | null>(null);
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);
  const [candidatoDetalheId, setCandidatoDetalheId] = useState<string | null>(null);
  const [filtroPeriodo, setFiltroPeriodo] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroCandidato, setFiltroCandidato] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await roboRecrutamentoMonitorService.obterResumo();
      setResumo(r);

      const filtros: Record<string, string> = {};
      if (filtroPeriodo === "hoje") {
        filtros.periodoInicio = new Date().toISOString().split("T")[0];
      } else if (filtroPeriodo === "7d") {
        const d = new Date(); d.setDate(d.getDate() - 7);
        filtros.periodoInicio = d.toISOString();
      } else if (filtroPeriodo === "30d") {
        const d = new Date(); d.setDate(d.getDate() - 30);
        filtros.periodoInicio = d.toISOString();
      }
      if (filtroStatus !== "todos") {
        filtros.status = filtroStatus;
      }

      const e = await roboRecrutamentoMonitorService.listarExecucoes(filtros as any);

      let filtradas = e;
      if (filtroCandidato.trim()) {
        const busca = filtroCandidato.toLowerCase();
        filtradas = e.filter(ex => ex.candidato_nome.toLowerCase().includes(busca));
      }

      setExecucoes(filtradas);
    } catch (err) {
      console.error("Erro ao carregar monitor:", err);
      toast.error("Erro ao carregar dados do monitor");
    } finally {
      setLoading(false);
    }
  }, [filtroPeriodo, filtroStatus, filtroCandidato]);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirDetalhes = async (candidatoId: string) => {
    setCandidatoDetalheId(candidatoId);
    setDetalhesAbertos(true);
    setDetalhes(null);
    try {
      const d = await roboRecrutamentoMonitorService.obterDetalhesExecucao(candidatoId);
      setDetalhes(d);
    } catch (err) {
      console.error("Erro ao carregar detalhes:", err);
      toast.error("Erro ao carregar detalhes da execução");
    }
  };

  const CardMetrica = ({ titulo, valor, icone, cor }: { titulo: string; valor: number; icone: React.ReactNode; cor: string }) => (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold">{valor}</p>
            <p className="text-xs text-muted-foreground">{titulo}</p>
          </div>
          <div className={`p-2 rounded-lg ${cor}`}>{icone}</div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <BrainCircuit className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Monitor - Robô de Recrutamento IA</h1>
            <p className="text-sm text-muted-foreground">Acompanhamento e auditoria do funcionário digital de recrutamento</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
          <RefreshCw className={`mr-2 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {resumo && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <CardMetrica titulo="Execuções" valor={resumo.total_execucoes} icone={<Activity className="w-5 h-5 text-blue-600" />} cor="bg-blue-100" />
          <CardMetrica titulo="Candidatos" valor={resumo.total_candidatos_processados} icone={<UserCheck className="w-5 h-5 text-indigo-600" />} cor="bg-indigo-100" />
          <CardMetrica titulo="Tarefas" valor={resumo.total_tarefas_criadas} icone={<ListTodo className="w-5 h-5 text-violet-600" />} cor="bg-violet-100" />
          <CardMetrica titulo="Aprov. Pend." valor={resumo.total_aprovacoes_pendentes} icone={<Clock className="w-5 h-5 text-amber-600" />} cor="bg-amber-100" />
          <CardMetrica titulo="Aprovadas" valor={resumo.total_aprovacoes_aprovadas} icone={<CheckCircle2 className="w-5 h-5 text-emerald-600" />} cor="bg-emerald-100" />
          <CardMetrica titulo="Rejeitadas" valor={resumo.total_aprovacoes_rejeitadas} icone={<XCircle className="w-5 h-5 text-red-600" />} cor="bg-red-100" />
          <CardMetrica titulo="Comunicações" valor={resumo.total_comunicacoes_simuladas} icone={<MessageSquare className="w-5 h-5 text-teal-600" />} cor="bg-teal-100" />
          <CardMetrica titulo="Erros" valor={resumo.total_erros} icone={<AlertTriangle className="w-5 h-5 text-rose-600" />} cor="bg-rose-100" />
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Execuções</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                <SelectTrigger className="w-32 h-8 text-xs"><Calendar className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="sucesso">Sucesso</SelectItem>
                  <SelectItem value="erro">Erro</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="aviso">Aviso</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Buscar candidato..."
                  value={filtroCandidato}
                  onChange={e => setFiltroCandidato(e.target.value)}
                  className="w-48 h-8 pl-7 text-xs"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Data</TableHead>
                <TableHead className="text-xs">Candidato</TableHead>
                <TableHead className="text-xs">Execução</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Recomendação</TableHead>
                <TableHead className="text-xs">Tarefa</TableHead>
                <TableHead className="text-xs">Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Carregando...
                  </TableCell>
                </TableRow>
              ) : execucoes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <Bot className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                    Nenhuma execução encontrada
                  </TableCell>
                </TableRow>
              ) : (
                execucoes.map((exec, idx) => (
                  <TableRow key={`${exec.id}-${idx}`}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(exec.data).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{exec.candidato_nome}</TableCell>
                    <TableCell className="text-[10px] font-mono text-muted-foreground">
                      {exec.execucao_id ? `${exec.execucao_id.slice(0, 6)}...` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${STATUS_BADGE[exec.status] || "bg-gray-100 text-gray-700"}`}>
                        {exec.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{exec.recomendacao || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {exec.tarefa_id ? (
                        <span className="font-mono text-[10px] text-muted-foreground">{exec.tarefa_id.slice(0, 8)}...</span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => abrirDetalhes(exec.candidato_id)}>
                        <FileText className="w-3 h-3 mr-1" />Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={detalhesAbertos} onOpenChange={setDetalhesAbertos}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-primary" />
              Detalhes da Execução
            </DialogTitle>
          </DialogHeader>

          {!detalhes ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <div className="space-y-4">
              {detalhes.execucao_id && (
                <div className="text-center mb-2">
                  <Badge className="bg-slate-100 text-slate-600 text-[10px] font-mono">
                    Execução: {detalhes.execucao_id.slice(0, 8)}...{detalhes.execucao_id.slice(-4)}
                  </Badge>
                </div>
              )}

              {detalhes.candidato && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Candidato</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p><strong>Nome:</strong> {detalhes.candidato.nome_completo as string}</p>
                    {detalhes.candidato.cpf && <p><strong>CPF:</strong> {(detalhes.candidato.cpf as string).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.***.***-$4")}</p>}
                    {detalhes.candidato.tipo_veiculo && <p><strong>Veículo:</strong> {detalhes.candidato.tipo_veiculo as string}</p>}
                    {detalhes.candidato.regiao && <p><strong>Região:</strong> {detalhes.candidato.regiao as string}</p>}
                    <p><strong>Status:</strong> {detalhes.candidato.status as string}</p>
                    <p><strong>Cadastro:</strong> {new Date(detalhes.candidato.created_at as string).toLocaleString("pt-BR")}</p>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Contexto Carregado da Central IA</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-blue-50 rounded">
                      <p className="text-[10px] text-blue-600 font-semibold uppercase">Instrução</p>
                      <p className="text-xs font-medium">{detalhes.contexto.instrucao_nome || `v${detalhes.contexto.instrucao_versao || "—"}`}</p>
                      {detalhes.contexto.instrucao_versao && <p className="text-[10px] text-blue-400">Versão {detalhes.contexto.instrucao_versao}</p>}
                    </div>
                    <div className="p-2 bg-indigo-50 rounded">
                      <p className="text-[10px] text-indigo-600 font-semibold uppercase">Conhecimentos</p>
                      <p className="text-xs font-medium">{detalhes.contexto.conhecimentos_count} itens</p>
                      {detalhes.contexto.conhecimentos_nomes.length > 0 && (
                        <p className="text-[10px] text-indigo-400 truncate" title={detalhes.contexto.conhecimentos_nomes.join(", ")}>
                          {detalhes.contexto.conhecimentos_nomes.slice(0, 2).join(", ")}
                          {detalhes.contexto.conhecimentos_nomes.length > 2 ? "..." : ""}
                        </p>
                      )}
                    </div>
                    <div className="p-2 bg-violet-50 rounded">
                      <p className="text-[10px] text-violet-600 font-semibold uppercase">Regras</p>
                      <p className="text-xs font-medium">{detalhes.contexto.regras_count} ativas</p>
                      {detalhes.contexto.regras_descricoes.length > 0 && (
                        <p className="text-[10px] text-violet-400 truncate" title={detalhes.contexto.regras_descricoes.join(", ")}>
                          {detalhes.contexto.regras_descricoes.slice(0, 2).join(", ")}
                          {detalhes.contexto.regras_descricoes.length > 2 ? "..." : ""}
                        </p>
                      )}
                    </div>
                    <div className="p-2 bg-teal-50 rounded">
                      <p className="text-[10px] text-teal-600 font-semibold uppercase">Gatilhos</p>
                      <p className="text-xs font-medium">{detalhes.contexto.gatilhos_count} ativos</p>
                      {detalhes.contexto.gatilhos_nomes.length > 0 && (
                        <p className="text-[10px] text-teal-400 truncate" title={detalhes.contexto.gatilhos_nomes.join(", ")}>
                          {detalhes.contexto.gatilhos_nomes.slice(0, 2).join(", ")}
                          {detalhes.contexto.gatilhos_nomes.length > 2 ? "..." : ""}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {detalhes.logs.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Timeline</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-0">
                      {detalhes.logs.map((log, idx) => (
                        <div key={log.id || idx} className="flex gap-3 pb-2 last:pb-0">
                          <div className="flex flex-col items-center">
                            <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${
                              log.status === "erro" ? "bg-red-500" :
                              log.status === "sucesso" ? "bg-emerald-500" :
                              log.status === "aviso" ? "bg-amber-500" : "bg-blue-500"
                            }`} />
                            {idx < detalhes.logs.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                          </div>
                          <div className="flex-1 min-w-0 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">
                                {ACCOES_TIMELINE[log.acao] || log.acao}
                              </span>
                              <Badge className={`text-[10px] ${STATUS_BADGE[log.status] || "bg-gray-100 text-gray-700"}`}>
                                {log.status}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {new Date(log.criado_em).toLocaleString("pt-BR")}
                            </p>
                            {log.erro && (
                              <p className="text-[10px] text-red-600 mt-0.5">{log.erro}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {detalhes.tarefa && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Tarefa</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p><strong>Título:</strong> {detalhes.tarefa.titulo as string}</p>
                    <p><strong>Status:</strong> {detalhes.tarefa.status as string}</p>
                    <p><strong>Prioridade:</strong> {detalhes.tarefa.prioridade as string}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">ID: {detalhes.tarefa.id as string}</p>
                  </CardContent>
                </Card>
              )}

              {detalhes.aprovacao && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Aprovação</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p><strong>Status:</strong> {detalhes.aprovacao.status as string}</p>
                    <p><strong>Tipo:</strong> {detalhes.aprovacao.tipo_aprovacao as string}</p>
                    {detalhes.aprovacao.aprovado_por && <p><strong>Aprovado por:</strong> {detalhes.aprovacao.aprovado_por as string}</p>}
                    {detalhes.aprovacao.aprovado_em && <p><strong>Em:</strong> {new Date(detalhes.aprovacao.aprovado_em as string).toLocaleString("pt-BR")}</p>}
                    <p className="font-mono text-[10px] text-muted-foreground">ID: {detalhes.aprovacao.id as string}</p>
                  </CardContent>
                </Card>
              )}

              {detalhes.mensagem && (
                <Card className="border-amber-200">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4 text-amber-500" />Comunicação Simulada</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <div className="grid grid-cols-2 gap-2">
                      <p><strong>Destinatário:</strong> {detalhes.mensagem.destinatario_nome as string || "N/A"}</p>
                      <p><strong>Canal:</strong> {detalhes.mensagem.canal as string}</p>
                      <p><strong>Status:</strong> {detalhes.mensagem.status as string}</p>
                      <p><strong>Modo Seguro:</strong> {String(detalhes.mensagem.modo_seguro)}</p>
                      <p><strong>Provider Msg ID:</strong> {(detalhes.mensagem.provider_message_id as string) || <span className="text-emerald-600 font-semibold">null (simulado)</span>}</p>
                      <p><strong>Assunto:</strong> {detalhes.mensagem.assunto as string || "N/A"}</p>
                    </div>
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded text-xs whitespace-pre-wrap max-h-32 overflow-y-auto text-gray-700">
                      {detalhes.mensagem.conteudo as string}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge className="bg-amber-100 text-amber-700 text-[10px]">🔒 Modo Simulado</Badge>
                      <Badge className="bg-blue-100 text-blue-700 text-[10px]">Nenhum envio externo</Badge>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
