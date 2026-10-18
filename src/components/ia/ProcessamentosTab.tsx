import { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, Play, XCircle, FileText, BarChart3, Clock, CheckCircle, AlertTriangle, Bot, BookOpen, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { processamentoService, type ProcessamentoFila, type StatusProcessamento } from "@/services/ia/processamentoService";
import { memoriaService, type MemoriaConhecimento, type RaciocinioAuditoria } from "@/services/ia/memoriaService";
import { centralIaService, type AutomacaoRobo } from "@/services/centralIaService";
import { supabase } from "@/lib/supabase";

const STATUS_LABELS: Record<StatusProcessamento, string> = {
  aguardando_processamento: "Aguardando",
  processando: "Processando",
  processado: "Processado",
  erro: "Erro",
  cancelado: "Cancelado",
  reprocessando: "Reprocessando",
};

const STATUS_COLORS: Record<StatusProcessamento, string> = {
  aguardando_processamento: "bg-yellow-100 text-yellow-800 border-yellow-300",
  processando: "bg-blue-100 text-blue-800 border-blue-300",
  processado: "bg-green-100 text-green-800 border-green-300",
  erro: "bg-red-100 text-red-800 border-red-300",
  cancelado: "bg-gray-100 text-gray-500 border-gray-300",
  reprocessando: "bg-purple-100 text-purple-800 border-purple-300",
};

function StatusBadge({ status }: { status: StatusProcessamento }) {
  return <Badge className={STATUS_COLORS[status] || ""}>{STATUS_LABELS[status] || status}</Badge>;
}

function fmtData(d: string | null | undefined) {
  if (!d) return "-";
  try { return new Date(d).toLocaleString("pt-BR"); } catch { return d; }
}

function fmtBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function ProcessamentosTab() {
  const [view, setView] = useState<"fila" | "memoria" | "raciocinio" | "estatisticas">("fila");
  const [fila, setFila] = useState<ProcessamentoFila[]>([]);
  const [robos, setRobos] = useState<AutomacaoRobo[]>([]);
  const [memorias, setMemorias] = useState<MemoriaConhecimento[]>([]);
  const [raciocinios, setRaciocinios] = useState<RaciocinioAuditoria[]>([]);
  const [stats, setStats] = useState<{
    total: number; aguardando: number; processando: number;
    processado: number; erros: number; total_memorias: number;
    robos_aprenderam: string[]; ultimo_aprendizado: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [roboFilter, setRoboFilter] = useState<string>("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [buscaMemoria, setBuscaMemoria] = useState("");
  const [resultadoBusca, setResultadoBusca] = useState<{ fragmentos: MemoriaConhecimento[]; fontes: string[] } | null>(null);

  const loadFila = useCallback(async () => {
    setLoading(true);
    const params: any = {};
    if (statusFilter !== "todos") params.status = statusFilter;
    if (roboFilter !== "todos") params.robo_id = roboFilter;
    const data = await processamentoService.listarFila(params);
    setFila(data);
    setLoading(false);
  }, [statusFilter, roboFilter]);

  const loadRobos = useCallback(async () => {
    const data = await centralIaService.listarRobos();
    setRobos(data);
  }, []);

  const loadMemorias = useCallback(async () => {
    const { data } = await supabase.from("memoria_conhecimento").select("*").order("created_at", { ascending: false }).limit(50);
    setMemorias((data as MemoriaConhecimento[]) || []);
  }, []);

  const loadRaciocinios = useCallback(async () => {
    const data = await memoriaService.listarRaciocinios({ limite: 50 });
    setRaciocinios(data);
  }, []);

  const loadStats = useCallback(async () => {
    const data = await processamentoService.obterEstatisticas();
    setStats(data);
  }, []);

  useEffect(() => { loadRobos(); }, [loadRobos]);
  useEffect(() => {
    if (view === "fila" || view === "estatisticas") { loadFila(); loadStats(); }
    if (view === "memoria") loadMemorias();
    if (view === "raciocinio") loadRaciocinios();
  }, [view, loadFila, loadStats, loadMemorias, loadRaciocinios]);

  async function handleReprocessar(id: string) {
    const ok = await processamentoService.reprocessar(id);
    if (ok) { toast.success("Reprocessamento iniciado"); loadFila(); }
    else toast.error("Erro ao reprocessar");
  }

  async function handleCancelar(id: string) {
    await processamentoService.cancelarProcessamento(id);
    toast.success("Processamento cancelado");
    loadFila();
  }

  async function handleBuscarMemoria() {
    if (!buscaMemoria.trim()) { toast.error("Digite um termo de busca"); return; }
    setLoading(true);
    const resultados = await memoriaService.buscarConhecimentoGlobal(buscaMemoria, 10);
    setResultadoBusca({
      fragmentos: resultados.map(r => r.fragmento),
      fontes: [...new Set(resultados.map(r => r.fragmento.documento_origem))],
    });
    setLoading(false);
  }

  async function handleLimparMemoria(roboId: string) {
    await memoriaService.limparMemoriaRobo(roboId);
    toast.success("Memória limpa");
    loadMemorias();
  }

  const filaFiltrada = fila.filter((item) => {
    if (searchQuery && !item.nome_original.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const robosQueAprenderam = robos.filter(r => stats?.robos_aprenderam.includes(r.id));

  if (view === "estatisticas") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Estatísticas de Processamento</h2>
            <p className="text-muted-foreground">Materiais estudados e conhecimento gerado</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { loadFila(); loadStats(); }}>
            <RefreshCw className="h-4 w-4 mr-1" />Atualizar
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Materiais</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold">{stats?.total || 0}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Processados</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold text-green-600">{stats?.processado || 0}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Fragmentos de Memória</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold text-blue-600">{stats?.total_memorias || 0}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Erros</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold text-red-600">{stats?.erros || 0}</div></CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Status da Fila</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {([
                  { label: "Aguardando", value: stats?.aguardando || 0, color: "text-yellow-600" },
                  { label: "Processando", value: stats?.processando || 0, color: "text-blue-600" },
                  { label: "Processado", value: stats?.processado || 0, color: "text-green-600" },
                  { label: "Erro", value: stats?.erros || 0, color: "text-red-600" },
                ] as const).map((s) => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className="text-sm">{s.label}</span>
                    <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Robôs que Aprenderam</CardTitle></CardHeader>
            <CardContent>
              {robosQueAprenderam.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum robô aprendeu ainda</p>
              ) : (
                <div className="space-y-2">
                  {robosQueAprenderam.map((r) => (
                    <div key={r.id} className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{r.nome}</span>
                    </div>
                  ))}
                </div>
              )}
              {stats?.ultimo_aprendizado && (
                <p className="text-xs text-muted-foreground mt-4">
                  Último aprendizado: {fmtData(stats.ultimo_aprendizado)}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setView("fila")}>
            <FileText className="h-4 w-4 mr-1" />Ver Fila de Processamento
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Processamentos</h2>
          <p className="text-muted-foreground">Fila de processamento dos materiais da Academia IA</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setView("estatisticas")}>
            <BarChart3 className="h-4 w-4 mr-1" />Estatísticas
          </Button>
          <Button variant="outline" size="sm" onClick={() => loadFila()}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""} mr-1`} />Atualizar
          </Button>
        </div>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as "fila" | "memoria" | "raciocinio")}>
        <TabsList>
          <TabsTrigger value="fila"><Clock className="h-4 w-4 mr-1" />Fila</TabsTrigger>
          <TabsTrigger value="memoria"><BookOpen className="h-4 w-4 mr-1" />Memória</TabsTrigger>
          <TabsTrigger value="raciocinio"><AlertTriangle className="h-4 w-4 mr-1" />Raciocínio</TabsTrigger>
        </TabsList>

        <TabsContent value="fila" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar na fila..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={roboFilter} onValueChange={setRoboFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Robô" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos robôs</SelectItem>
                {robos.map(r => (<SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          {filaFiltrada.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhum processamento na fila</p>
              <p className="text-sm mt-1">Os materiais enviados na Academia IA aparecerão aqui automaticamente.</p>
            </CardContent></Card>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Robô</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tentativas</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filaFiltrada.map((item) => {
                  const robo = robos.find(r => r.id === item.robo_id);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">{item.nome_original}</TableCell>
                      <TableCell><Badge variant="outline">{item.tipo_arquivo}</Badge></TableCell>
                      <TableCell className="text-xs">{fmtBytes(item.tamanho_bytes)}</TableCell>
                      <TableCell>{robo?.nome || "-"}</TableCell>
                      <TableCell><StatusBadge status={item.status} /></TableCell>
                      <TableCell className="text-xs">{item.tentativas}/{item.max_tentativas}</TableCell>
                      <TableCell className="text-xs">{fmtData(item.data_envio)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {item.status === "erro" || item.status === "cancelado" ? (
                            <Button variant="ghost" size="sm" onClick={() => handleReprocessar(item.id)} title="Reprocessar">
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          ) : null}
                          {item.status === "aguardando_processamento" && (
                            <Button variant="ghost" size="sm" onClick={() => processamentoService.processarItem(item.id)} title="Processar agora">
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          {(item.status === "aguardando_processamento" || item.status === "reprocessando") && (
                            <Button variant="ghost" size="sm" onClick={() => handleCancelar(item.id)} title="Cancelar">
                              <XCircle className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {filaFiltrada.filter(i => i.erro).length > 0 && (
            <div className="space-y-2">
              {filaFiltrada.filter(i => i.erro).map(i => (
                <Card key={i.id} className="border-red-200 bg-red-50">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium text-red-800">Erro em: {i.nome_original}</p>
                        <p className="text-xs text-red-700 mt-1">{i.erro}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleReprocessar(i.id)}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="memoria" className="space-y-4 mt-4">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar na memória..." value={buscaMemoria} onChange={e => setBuscaMemoria(e.target.value)} onKeyDown={e => e.key === "Enter" && handleBuscarMemoria()} />
            </div>
            <Button size="sm" onClick={handleBuscarMemoria} disabled={loading}>
              <Search className="h-4 w-4 mr-1" />Buscar
            </Button>
          </div>

          {resultadoBusca && (
            <Card className="border-blue-200">
              <CardHeader><CardTitle className="text-sm">Resultados da Busca</CardTitle></CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-2">{resultadoBusca.fragmentos.length} fragmentos encontrados de {resultadoBusca.fontes.length} documento(s)</p>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {resultadoBusca.fragmentos.map((f, i) => (
                    <Card key={f.id} className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold">#{i + 1}</span>
                            <Badge variant="outline" className="text-[10px]">{f.categoria || "geral"}</Badge>
                            <span className="text-[10px] text-muted-foreground truncate">{f.documento_origem}</span>
                          </div>
                          <p className="text-xs mt-1 line-clamp-3">{f.conteudo}</p>
                          {f.tags.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {f.tags.map(t => <Badge key={t} variant="secondary" className="text-[9px]">{t}</Badge>)}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Últimos Fragmentos Armazenados</h3>
            {robos.length > 0 && (
              <Select onValueChange={(v) => { handleLimparMemoria(v); }}>
                <SelectTrigger className="w-[140px] text-xs text-red-500">
                  <Trash2 className="h-4 w-4 mr-1" />Limpar Memória
                </SelectTrigger>
                <SelectContent>
                  {robos.map(r => (<SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>))}
                </SelectContent>
              </Select>
            )}
          </div>

          {memorias.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum fragmento de memória.</CardContent></Card>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {memorias.slice(0, 30).map((m) => {
                const robo = robos.find(r => r.id === m.robo_id);
                return (
                  <Card key={m.id} className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                          <span className="text-xs font-medium truncate">{m.documento_origem}</span>
                          <Badge variant="outline" className="text-[10px]">{m.tipo_arquivo || "?"}</Badge>
                          {robo && <Badge className="text-[10px]">{robo.nome}</Badge>}
                          <span className="text-[10px] text-muted-foreground">score: {m.score_relevancia.toFixed(2)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.conteudo}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="raciocinio" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Registro de Raciocínio da IA</h3>
            <Button variant="outline" size="sm" onClick={loadRaciocinios}>
              <RefreshCw className="h-4 w-4 mr-1" />Atualizar
            </Button>
          </div>

          {raciocinios.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum registro de raciocínio.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {raciocinios.map((r) => {
                const robo = robos.find(rb => rb.id === r.robo_id);
                return (
                  <Card key={r.id} className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-medium">{robo?.nome || "Sistema"}</span>
                          <span className="text-[10px] text-muted-foreground">{fmtData(r.created_at)}</span>
                        </div>
                        {r.pergunta && <p className="text-xs mt-1"><strong>Pergunta:</strong> {r.pergunta}</p>}
                        {r.decisao && <p className="text-xs mt-1"><strong>Decisão:</strong> {r.decisao}</p>}
                        {r.acao_executada && <p className="text-xs mt-1"><strong>Ação:</strong> {r.acao_executada}</p>}
                        {r.documento_utilizado && <p className="text-xs text-muted-foreground mt-1">Documento: {r.documento_utilizado}</p>}
                        {r.trechos_considerados && r.trechos_considerados.length > 0 && (
                          <div className="mt-1">
                            <span className="text-[10px] font-medium text-muted-foreground">Trechos considerados ({r.trechos_considerados.length}):</span>
                            <ul className="list-disc list-inside">
                              {r.trechos_considerados.slice(0, 3).map((t, i) => (
                                <li key={i} className="text-[10px] text-muted-foreground truncate">{t}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
