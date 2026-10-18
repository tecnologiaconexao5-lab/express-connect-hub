import { useState, useEffect, useCallback } from "react";
import {
  Briefcase, RefreshCw, AlertTriangle, BarChart3,
  Play, Pause, XCircle, ArrowUpRight, Filter,
  Save, Edit3, Plus, Clock,
} from "lucide-react";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { workforceOrchestratorService, type IaTrabalho, type IaFilaTrabalho, type IaHistoricoTrabalho, type PrioridadeTrabalho, type StatusTrabalho } from "@/services/ia/workforceOrchestratorService";
import { workforceOrchestratorWorker, onWorkforceStatusChange, type WorkforceWorkerStatus } from "@/services/ia/workforceOrchestratorWorker";

const PRIORIDADE_CORES: Record<string, string> = {
  baixa: "bg-green-100 text-green-800",
  normal: "bg-blue-100 text-blue-800",
  alta: "bg-orange-100 text-orange-800",
  critica: "bg-red-100 text-red-800",
};

const STATUS_CORES: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-800",
  em_andamento: "bg-blue-100 text-blue-800",
  concluida: "bg-green-100 text-green-800",
  falhou: "bg-red-100 text-red-800",
  cancelada: "bg-gray-100 text-gray-500",
  escalada: "bg-purple-100 text-purple-800",
};

function fmtData(d: string | null | undefined) {
  if (!d) return "-";
  try { return new Date(d).toLocaleString("pt-BR"); } catch { return d; }
}

function fmtDataCurta(d: string | null | undefined) {
  if (!d) return "-";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
}

export function TrabalhoTab() {
  const [trabalhos, setTrabalhos] = useState<IaTrabalho[]>([]);
  const [fila, setFila] = useState<(IaFilaTrabalho & { trabalho?: IaTrabalho })[]>([]);
  const [historico, setHistorico] = useState<IaHistoricoTrabalho[]>([]);
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [workerStatus, setWorkerStatus] = useState<WorkforceWorkerStatus>(workforceOrchestratorWorker.getStatus());
  const [loading, setLoading] = useState(true);
  const [filtroTab, setFiltroTab] = useState<"fila" | "historico" | "produtividade">("fila");
  const [filtroStatus, setFiltroStatus] = useState<string>("all");
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>("all");
  const [criando, setCriando] = useState(false);
  const [novoTrabalho, setNovoTrabalho] = useState({
    titulo: "", descricao: "", tipo: "outro", prioridade: "normal" as PrioridadeTrabalho,
    origem: "manual", robo_id: "", data_vencimento: "",
  });
  const [editTrabalho, setEditTrabalho] = useState<IaTrabalho | null>(null);
  const [redistribuindo, setRedistribuindo] = useState<string | null>(null);
  const [roboRedistribuir, setRoboRedistribuir] = useState("");
  const [robos, setRobos] = useState<{ id: string; nome: string }[]>([]);
  const [produtividade, setProdutividade] = useState<Record<string, { total: number; concluidas: number; taxa: number; tempoMedio: number }>>({});

  async function carregarRobos() {
    const { supabase } = await import("@/lib/supabase");
    const { data } = await supabase.from("automacoes_robos").select("id, nome").eq("ativo", true);
    setRobos((data || []) as { id: string; nome: string }[]);
  }

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [trabalhosData, filaData, historicoData, statsData] = await Promise.all([
        workforceOrchestratorService.listarTrabalhos({ limite: 50 }),
        workforceOrchestratorService.listarFila({ limite: 50 }),
        workforceOrchestratorService.listarHistorico({ limite: 30 }),
        workforceOrchestratorService.obterEstatisticas(),
      ]);
      setTrabalhos(trabalhosData);
      setFila(filaData);
      setHistorico(historicoData);
      setStats(statsData as unknown as Record<string, unknown>);

      const prod: Record<string, { total: number; concluidas: number; taxa: number; tempoMedio: number }> = {};
      if (robos.length > 0) {
        for (const robo of robos) {
          const p = await workforceOrchestratorService.obterProdutividadeRobo(robo.id);
          prod[robo.id] = { total: p.total, concluidas: p.concluidas, taxa: p.taxa_conclusao, tempoMedio: p.tempo_medio_execucao_segundos };
        }
      }
      setProdutividade(prod);
    } finally {
      setLoading(false);
    }
  }, [robos]);

  useEffect(() => {
    carregarRobos();
    const unsub = onWorkforceStatusChange(() => {
      setWorkerStatus(workforceOrchestratorWorker.getStatus());
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (robos.length > 0) carregar();
  }, [robos, carregar]);

  const filtrados = trabalhos.filter((t) => {
    if (filtroStatus !== "all" && t.status !== filtroStatus) return false;
    if (filtroPrioridade !== "all" && t.prioridade !== filtroPrioridade) return false;
    return true;
  });

  async function criarTrabalhoHandler() {
    if (!novoTrabalho.titulo.trim()) { toast.error("Título é obrigatório"); return; }
    setCriando(true);
    try {
      await workforceOrchestratorService.criarTrabalho({
        titulo: novoTrabalho.titulo,
        descricao: novoTrabalho.descricao || undefined,
        tipo: novoTrabalho.tipo,
        prioridade: novoTrabalho.prioridade,
        origem: novoTrabalho.origem,
        robo_id: novoTrabalho.robo_id || undefined,
        data_vencimento: novoTrabalho.data_vencimento || undefined,
      });
      toast.success("Trabalho criado");
      setNovoTrabalho({ titulo: "", descricao: "", tipo: "outro", prioridade: "normal", origem: "manual", robo_id: "", data_vencimento: "" });
      carregar();
    } finally {
      setCriando(false);
    }
  }

  async function cancelarTrabalhoHandler(id: string) {
    await workforceOrchestratorService.cancelarTrabalho(id, "Cancelado pelo gestor");
    toast.success("Trabalho cancelado");
    carregar();
  }

  async function escalarTrabalhoHandler(id: string) {
    await workforceOrchestratorService.escalarTrabalho(id, "Escalado pelo gestor para revisão");
    toast.success("Trabalho escalado");
    carregar();
  }

  async function redistribuirHandler() {
    if (!redistribuindo || !roboRedistribuir) { toast.error("Selecione um robô"); return; }
    await workforceOrchestratorService.redistribuirTrabalho(redistribuindo, roboRedistribuir);
    toast.success("Trabalho redistribuído");
    setRedistribuindo(null);
    setRoboRedistribuir("");
    carregar();
  }

  const filaParaExecutar = fila.filter((f) => f.status === "pendente");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Orquestrador de Trabalho</h2>
          <Badge variant={workerStatus.rodando ? "default" : "secondary"} className="ml-2">
            {workerStatus.rodando ? "Ativo" : "Inativo"}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-2 h-4 w-4" />Novo Trabalho</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Novo Trabalho</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>Título *</Label>
                  <Input value={novoTrabalho.titulo} onChange={(e) => setNovoTrabalho({ ...novoTrabalho, titulo: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Descrição</Label>
                  <Textarea value={novoTrabalho.descricao} onChange={(e) => setNovoTrabalho({ ...novoTrabalho, descricao: e.target.value })} className="min-h-[60px]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Tipo</Label>
                    <Select value={novoTrabalho.tipo} onValueChange={(v) => setNovoTrabalho({ ...novoTrabalho, tipo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prospeccao">Prospecção</SelectItem>
                        <SelectItem value="followup">Follow-up</SelectItem>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="cobranca">Cobrança</SelectItem>
                        <SelectItem value="analise">Análise</SelectItem>
                        <SelectItem value="relatorio">Relatório</SelectItem>
                        <SelectItem value="comunicacao">Comunicação</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Prioridade</Label>
                    <Select value={novoTrabalho.prioridade} onValueChange={(v) => setNovoTrabalho({ ...novoTrabalho, prioridade: v as PrioridadeTrabalho })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="critica">Crítica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Robô</Label>
                    <Select value={novoTrabalho.robo_id} onValueChange={(v) => setNovoTrabalho({ ...novoTrabalho, robo_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Sem robô" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Sem robô</SelectItem>
                        {robos.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Vencimento</Label>
                    <Input type="date" value={novoTrabalho.data_vencimento} onChange={(e) => setNovoTrabalho({ ...novoTrabalho, data_vencimento: e.target.value })} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                  <Button onClick={criarTrabalhoHandler} disabled={criando}><Save className="mr-2 h-4 w-4" />Criar</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={carregar}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <Card className="col-span-1">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{(stats as { total?: number }).total ?? 0}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="col-span-1 border-yellow-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{(stats as { pendentes?: number }).pendentes ?? 0}</p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>
        <Card className="col-span-1 border-green-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{(stats as { concluidas?: number }).concluidas ?? 0}</p>
            <p className="text-xs text-muted-foreground">Concluídas</p>
          </CardContent>
        </Card>
        <Card className="col-span-1 border-red-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{(stats as { atrasadas?: number }).atrasadas ?? 0}</p>
            <p className="text-xs text-muted-foreground">Atrasadas</p>
          </CardContent>
        </Card>
        <Card className="col-span-1 border-purple-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{(stats as { escaladas?: number }).escaladas ?? 0}</p>
            <p className="text-xs text-muted-foreground">Escaladas</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 border-b pb-2">
        <Button variant={filtroTab === "fila" ? "default" : "ghost"} size="sm" onClick={() => setFiltroTab("fila")}>Fila de Trabalho</Button>
        <Button variant={filtroTab === "historico" ? "default" : "ghost"} size="sm" onClick={() => setFiltroTab("historico")}>Histórico</Button>
        <Button variant={filtroTab === "produtividade" ? "default" : "ghost"} size="sm" onClick={() => setFiltroTab("produtividade")}>Produtividade</Button>
      </div>

      {filtroTab === "fila" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
                <SelectItem value="falhou">Falhou</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
                <SelectItem value="escalada">Escalada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Prioridade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="critica">Crítica</SelectItem>
              </SelectContent>
            </Select>
            {filaParaExecutar.length > 0 && (
              <Badge className="bg-blue-100 text-blue-800">{filaParaExecutar.length} pronto(s) para executar</Badge>
            )}
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filtrados.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum trabalho encontrado.</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%]">Título</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Robô</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="w-[120px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((t) => (
                    <TableRow key={t.id} className={t.status === "concluida" ? "opacity-60" : ""}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1">
                          <span className="text-sm">{t.titulo}</span>
                          {t.data_vencimento && new Date(t.data_vencimento) < new Date() && t.status !== "concluida" && t.status !== "cancelada" && (
                            <AlertTriangle className="h-3 w-3 text-red-500" />
                          )}
                        </div>
                        {t.descricao && <p className="text-xs text-muted-foreground truncate max-w-[300px]">{t.descricao}</p>}
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{t.tipo}</Badge></TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${PRIORIDADE_CORES[t.prioridade]}`}>{t.prioridade}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${STATUS_CORES[t.status]}`}>{t.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.robo_id ? t.robo_id.slice(0, 8) : "-"}</TableCell>
                      <TableCell className="text-xs">{fmtDataCurta(t.data_vencimento)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {t.status === "pendente" && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => cancelarTrabalhoHandler(t.id)} title="Cancelar">
                                <XCircle className="h-3 w-3 text-red-500" />
                              </Button>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm" onClick={() => { setRedistribuindo(t.id); }} title="Redistribuir">
                                    <ArrowUpRight className="h-3 w-3" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-sm">
                                  <DialogHeader><DialogTitle>Redistribuir Trabalho</DialogTitle></DialogHeader>
                                  <div className="space-y-3">
                                    <div className="space-y-1">
                                      <Label>Robô destino</Label>
                                      <Select value={roboRedistribuir} onValueChange={setRoboRedistribuir}>
                                        <SelectTrigger><SelectValue placeholder="Selecionar robô" /></SelectTrigger>
                                        <SelectContent>
                                          {robos.filter((r) => r.id !== t.robo_id).map((r) => (
                                            <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="flex justify-end gap-2 pt-2">
                                      <Button variant="outline" size="sm" onClick={() => setRedistribuindo(null)}>Cancelar</Button>
                                      <Button size="sm" onClick={redistribuirHandler}>Redistribuir</Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                              <Button variant="ghost" size="sm" onClick={() => escalarTrabalhoHandler(t.id)} title="Escalar">
                                <AlertTriangle className="h-3 w-3 text-purple-500" />
                              </Button>
                            </>
                          )}
                          {t.status === "em_andamento" && (
                            <Button variant="ghost" size="sm" onClick={async () => {
                              try { await workforceOrchestratorService.concluirTrabalho(t.id); toast.success("Trabalho concluído"); } catch { toast.error("Erro ao concluir trabalho"); }
                              carregar();
                            }} title="Concluir">
                              <Play className="h-3 w-3 text-green-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {filtroTab === "historico" && (
        <div className="space-y-2">
          {historico.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum registro no histórico.</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Robô</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="text-xs">{fmtData(h.created_at)}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{h.acao}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{h.robo_id ? h.robo_id.slice(0, 8) : "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                        {Object.keys(h.detalhes || {}).length > 0 ? JSON.stringify(h.detalhes).slice(0, 100) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {filtroTab === "produtividade" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {robos.map((robo) => {
              const p = produtividade[robo.id];
              return (
                <Card key={robo.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{robo.nome}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {p ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Total:</span>
                          <span className="font-medium">{p.total}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Concluídas:</span>
                          <span className="font-medium text-green-600">{p.concluidas}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Taxa de conclusão:</span>
                          <span className={`font-medium ${p.taxa >= 80 ? "text-green-600" : p.taxa >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                            {p.taxa}%
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Tempo médio:</span>
                          <span className="font-medium">{p.tempoMedio > 60 ? `${Math.round(p.tempoMedio / 60)}min` : `${p.tempoMedio}s`}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
                          <div
                            className={`h-2 rounded-full ${p.taxa >= 80 ? "bg-green-500" : p.taxa >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                            style={{ width: `${Math.min(100, p.taxa)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sem dados</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Status do Worker
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">Estado:</span>
                <Badge className={`ml-1 ${workerStatus.estado === "ativo" ? "bg-green-100 text-green-800" : workerStatus.estado === "erro" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>
                  {workerStatus.estado}
                </Badge>
              </div>
              <div><span className="text-muted-foreground">Processados:</span> <span className="font-medium">{workerStatus.totalProcessados}</span></div>
              <div><span className="text-muted-foreground">Redistribuídos:</span> <span className="font-medium">{workerStatus.totalRedistribuidos}</span></div>
              <div><span className="text-muted-foreground">Gargalos:</span> <span className="font-medium">{workerStatus.totalGargalos}</span></div>
              <div><span className="text-muted-foreground">Erros:</span> <span className="font-medium text-red-600">{workerStatus.totalErros}</span></div>
              <div><span className="text-muted-foreground">Fila pendente:</span> <span className="font-medium">{workerStatus.filaPendente}</span></div>
              <div><span className="text-muted-foreground">Último:</span> <span className="font-medium">{fmtData(workerStatus.ultimoProcessamento)}</span></div>
              <div>
                <span className="text-muted-foreground">Worker:</span>
                <Button variant="ghost" size="sm" className="ml-1 h-6" onClick={() => {
                  if (workerStatus.rodando) workforceOrchestratorWorker.parar();
                  else workforceOrchestratorWorker.iniciar();
                }}>
                  {workerStatus.rodando ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Estatísticas por Prioridade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 text-xs">
                {["baixa", "normal", "alta", "critica"].map((p) => (
                  <div key={p} className="flex items-center gap-1">
                    <Badge className={PRIORIDADE_CORES[p]}>{p}</Badge>
                    <span className="font-medium">{(stats as Record<string, Record<string, number>>).por_prioridade?.[p] ?? 0}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default TrabalhoTab;
