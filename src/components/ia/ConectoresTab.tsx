import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Save, RefreshCw, Trash2, Bot, Plug, Clock, CheckCircle, AlertTriangle, XCircle, Edit3, Ban, Play, Globe, Shield, Key, TestTube, Mail } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { conectoresService, type IaConector, type IaConectorRobo, type IaExecucaoConector, type TipoConector, type ModoConector, type StatusExecucaoConector } from "@/services/ia/conectoresService";
import { centralIaService, type AutomacaoRobo } from "@/services/centralIaService";
import { ZohoConnectPanel } from "./ZohoConnectPanel";

const TIPO_LABELS: Record<TipoConector, string> = {
  EMAIL: "E-mail", WHATSAPP: "WhatsApp", CRM: "CRM", IA: "Inteligência Artificial",
  AUTOMACAO_WEB: "Automação Web", REDE_SOCIAL: "Rede Social",
  PLATAFORMA_VAGAS: "Plataforma de Vagas", FINANCEIRO: "Financeiro", OUTRO: "Outro",
};

const MODO_LABELS: Record<ModoConector, string> = {
  HOMOLOGACAO: "Homologação (Simulado)",
  PRODUCAO_ASSISTIDA: "Produção Assistida",
  PRODUCAO: "Produção",
  PRODUCAO_AUTONOMA: "Produção Autônoma",
};

const MODO_COLORS: Record<ModoConector, string> = {
  HOMOLOGACAO: "bg-yellow-100 text-yellow-800",
  PRODUCAO_ASSISTIDA: "bg-blue-100 text-blue-800",
  PRODUCAO: "bg-green-100 text-green-800",
  PRODUCAO_AUTONOMA: "bg-purple-100 text-purple-800",
};

const STATUS_EXEC_LABELS: Record<StatusExecucaoConector, string> = {
  SOLICITADA: "Solicitada", AGUARDANDO_APROVACAO: "Aguardando Aprovação",
  APROVADA: "Aprovada", EM_EXECUCAO: "Em Execução",
  CONCLUIDA: "Concluída", FALHOU: "Falhou", CANCELADA: "Cancelada",
};

const STATUS_EXEC_COLORS: Record<StatusExecucaoConector, string> = {
  SOLICITADA: "bg-blue-100 text-blue-800", AGUARDANDO_APROVACAO: "bg-yellow-100 text-yellow-800",
  APROVADA: "bg-green-100 text-green-800", EM_EXECUCAO: "bg-purple-100 text-purple-800",
  CONCLUIDA: "bg-green-100 text-green-800", FALHOU: "bg-red-100 text-red-800",
  CANCELADA: "bg-gray-100 text-gray-500",
};

const TIPO_CORES: Record<string, string> = {
  EMAIL: "#3b82f6", WHATSAPP: "#22c55e", CRM: "#8b5cf6", IA: "#ec4899",
  AUTOMACAO_WEB: "#06b6d4", REDE_SOCIAL: "#f97316", PLATAFORMA_VAGAS: "#f59e0b",
  FINANCEIRO: "#10b981", OUTRO: "#6366f1",
};

function StatusBadge({ status }: { status: StatusExecucaoConector }) {
  return <Badge className={STATUS_EXEC_COLORS[status] || ""}>{STATUS_EXEC_LABELS[status] || status}</Badge>;
}

function ModoBadge({ modo }: { modo: ModoConector }) {
  return <Badge className={MODO_COLORS[modo] || ""}>{MODO_LABELS[modo] || modo}</Badge>;
}

function fmtData(d: string | null | undefined) {
  if (!d) return "-";
  try { return new Date(d).toLocaleString("pt-BR"); } catch { return d; }
}

export function ConectoresTab() {
  const [robos, setRobos] = useState<AutomacaoRobo[]>([]);
  const [conectores, setConectores] = useState<IaConector[]>([]);
  const [vinculos, setVinculos] = useState<IaConectorRobo[]>([]);
  const [execucoes, setExecucoes] = useState<IaExecucaoConector[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("catalogo");

  const [conectorDialogOpen, setConectorDialogOpen] = useState(false);
  const [editConector, setEditConector] = useState<IaConector | null>(null);
  const [formConector, setFormConector] = useState({
    codigo_unico: "", nome: "", descricao: "", tipo: "OUTRO" as TipoConector,
    provedor: "", modo_padrao: "HOMOLOGACAO" as ModoConector,
    url_base: "", instrucoes_conexao: "", limite_uso_dia: 100,
  });

  const [vinculoDialogOpen, setVinculoDialogOpen] = useState(false);
  const [editVinculo, setEditVinculo] = useState<IaConectorRobo | null>(null);
  const [formVinculo, setFormVinculo] = useState({
    robo_id: "", conector_id: "", modo: "HOMOLOGACAO" as ModoConector,
  });

  const [searchConector, setSearchConector] = useState("");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [filterRobo, setFilterRobo] = useState("todos");
  const [filterStatusExec, setFilterStatusExec] = useState("todos");

  const loadRobos = useCallback(async () => {
    const data = await centralIaService.listarRobos();
    setRobos(data);
  }, []);

  const loadConectores = useCallback(async () => {
    const data = await conectoresService.listarConectores();
    setConectores(data);
  }, []);

  const loadVinculos = useCallback(async () => {
    const data = await conectoresService.listarVinculos();
    setVinculos(data);
  }, []);

  const loadExecucoes = useCallback(async () => {
    setLoading(true);
    const data = await conectoresService.listarHistorico({ limite: 100 });
    setExecucoes(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadRobos(); loadConectores(); loadVinculos(); }, [loadRobos, loadConectores, loadVinculos]);
  useEffect(() => { if (activeTab === "historico") loadExecucoes(); }, [activeTab, loadExecucoes]);

  function resetFormConector() {
    setFormConector({
      codigo_unico: "", nome: "", descricao: "", tipo: "OUTRO",
      provedor: "", modo_padrao: "HOMOLOGACAO", url_base: "", instrucoes_conexao: "", limite_uso_dia: 100,
    });
  }

  function abrirNovoConector() {
    setEditConector(null);
    resetFormConector();
    setConectorDialogOpen(true);
  }

  function abrirEditarConector(c: IaConector) {
    setEditConector(c);
    setFormConector({
      codigo_unico: c.codigo_unico, nome: c.nome, descricao: c.descricao || "",
      tipo: c.tipo, provedor: c.provedor, modo_padrao: c.modo_padrao,
      url_base: c.url_base || "", instrucoes_conexao: c.instrucoes_conexao || "",
      limite_uso_dia: c.limite_uso_dia ?? 100,
    });
    setConectorDialogOpen(true);
  }

  async function handleSalvarConector() {
    if (!formConector.nome.trim() || !formConector.codigo_unico.trim()) {
      toast.error("Nome e Código são obrigatórios"); return;
    }
    if (editConector) {
      await conectoresService.atualizarConector(editConector.id, {
        nome: formConector.nome, descricao: formConector.descricao || null,
        tipo: formConector.tipo, provedor: formConector.provedor,
        modo_padrao: formConector.modo_padrao, url_base: formConector.url_base || null,
        instrucoes_conexao: formConector.instrucoes_conexao || null,
        limite_uso_dia: formConector.limite_uso_dia,
      } as IaConector);
      toast.success("Conector atualizado");
    } else {
      await conectoresService.criarConector({
        codigo_unico: formConector.codigo_unico, nome: formConector.nome,
        descricao: formConector.descricao, tipo: formConector.tipo,
        provedor: formConector.provedor, modo_padrao: formConector.modo_padrao,
        url_base: formConector.url_base, instrucoes_conexao: formConector.instrucoes_conexao,
        limite_uso_dia: formConector.limite_uso_dia,
      });
      toast.success("Conector criado");
    }
    setConectorDialogOpen(false);
    setEditConector(null);
    loadConectores();
  }

  function resetFormVinculo() {
    setFormVinculo({
      robo_id: "", conector_id: "", modo: "HOMOLOGACAO",
    });
  }

  function abrirNovoVinculo() {
    setEditVinculo(null);
    resetFormVinculo();
    setVinculoDialogOpen(true);
  }

  function abrirEditarVinculo(v: IaConectorRobo) {
    setEditVinculo(v);
    setFormVinculo({
      robo_id: v.robo_id, conector_id: v.conector_id, modo: v.modo,
    });
    setVinculoDialogOpen(true);
  }

  async function handleSalvarVinculo() {
    if (!formVinculo.robo_id || !formVinculo.conector_id) {
      toast.error("Selecione robô e conector"); return;
    }
    if (editVinculo) {
      await conectoresService.atualizarVinculo(editVinculo.id, {
        modo: formVinculo.modo,
      } as IaConectorRobo);
      toast.success("Vínculo atualizado");
    } else {
      await conectoresService.vincularRobo({
        robo_id: formVinculo.robo_id,
        conector_id: formVinculo.conector_id,
        modo: formVinculo.modo,
      });
      toast.success("Conector vinculado ao robô");
    }
    setVinculoDialogOpen(false);
    setEditVinculo(null);
    loadVinculos();
  }

  async function handleTestarConector(conectorId: string) {
    const roboId = filterRobo !== "todos" ? filterRobo : robos[0]?.id;
    if (!roboId) { toast.error("Selecione um robô"); return; }
    const conector = conectores.find(c => c.id === conectorId);
    if (!conector) return;

    const exec = await conectoresService.registrarExecucao({
      robo_id: roboId,
      conector_id: conectorId,
      acao: `Teste de conexão: ${conector.nome}`,
      payload: { tipo: "health_check", origem: "central_ia_painel" },
      modo: "HOMOLOGACAO",
    });

    if (exec) {
      const ok = await conectoresService.executarConector(exec.id);
      if (ok) toast.success(`Teste do conector ${conector.nome} concluído (simulado)`);
      else toast.error("Erro ao testar conector");
      loadExecucoes();
    }
  }

  const conectoresFiltrados = conectores.filter(c => {
    if (searchConector && !c.nome.toLowerCase().includes(searchConector.toLowerCase()) && !c.codigo_unico.toLowerCase().includes(searchConector.toLowerCase())) return false;
    if (filterTipo !== "todos" && c.tipo !== filterTipo) return false;
    return true;
  });

  const vinculosFiltrados = filterRobo !== "todos"
    ? vinculos.filter(v => v.robo_id === filterRobo)
    : vinculos;

  const execucoesFiltradas = execucoes.filter(e => {
    if (filterRobo !== "todos" && e.robo_id !== filterRobo) return false;
    if (filterStatusExec !== "todos" && e.status !== filterStatusExec) return false;
    return true;
  });

  const stats = {
    total_conectores: conectores.length,
    total_vinculos: vinculos.filter(v => v.ativo).length,
    total_execucoes: execucoes.length,
    concluidas: execucoes.filter(e => e.status === "CONCLUIDA").length,
    falhas: execucoes.filter(e => e.status === "FALHOU").length,
    pendentes: execucoes.filter(e => ["SOLICITADA", "EM_EXECUCAO"].includes(e.status)).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            Conectores Universais
          </h2>
          <p className="text-muted-foreground">Catálogo de integrações externas, vínculos com robôs e histórico de execuções</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Conectores</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{stats.total_conectores}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Vínculos Ativos</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-blue-600">{stats.total_vinculos}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Execuções</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-purple-600">{stats.total_execucoes}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Concluídas</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-green-600">{stats.concluidas}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pendentes</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-yellow-600">{stats.pendentes}</div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="catalogo"><Globe className="h-4 w-4 mr-1" />Catálogo</TabsTrigger>
          <TabsTrigger value="vinculos"><Bot className="h-4 w-4 mr-1" />Vínculos</TabsTrigger>
          <TabsTrigger value="zoho"><Mail className="h-4 w-4 mr-1" />Zoho Mail</TabsTrigger>
          <TabsTrigger value="historico"><Clock className="h-4 w-4 mr-1" />Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="catalogo" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2 items-center">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9 w-64" placeholder="Buscar conector..." value={searchConector} onChange={e => setSearchConector(e.target.value)} />
              </div>
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos tipos</SelectItem>
                  {Object.entries(TIPO_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={abrirNovoConector}><Plus className="h-4 w-4 mr-1" />Novo Conector</Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {conectoresFiltrados.map((c) => (
              <Card key={c.id} className={`${!c.ativo ? "opacity-60" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: TIPO_CORES[c.tipo] || "#6366f1" }} />
                        <span className="font-semibold text-sm">{c.nome}</span>
                        <Badge variant="outline" className="text-[10px] font-mono">{c.codigo_unico}</Badge>
                      </div>
                      <Badge className="text-[10px] mt-1" style={{ backgroundColor: `${TIPO_CORES[c.tipo] || "#6366f1"}20`, color: TIPO_CORES[c.tipo] || "#6366f1" }}>
                        {TIPO_LABELS[c.tipo] || c.tipo}
                      </Badge>
                      <span className="text-[10px] ml-2 text-muted-foreground">{c.provedor}</span>
                      {c.descricao && <p className="text-xs text-muted-foreground mt-2">{c.descricao}</p>}
                      <div className="flex gap-2 mt-2 text-[10px] text-muted-foreground">
                        <ModoBadge modo={c.modo_padrao} />
                        {c.url_base && <span className="truncate max-w-[200px]">{c.url_base}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2 shrink-0">
                      <Button variant="ghost" size="sm" onClick={async () => {
                        toast.loading("Testando conexão...");
                        const result = await conectoresService.testarConexao(c.id);
                        toast.dismiss();
                        if (result.ok) toast.success(result.mensagem);
                        else toast.error(result.mensagem);
                      }} title="Testar conexão real">
                        <TestTube className="h-3.5 w-3.5 text-blue-600" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => abrirEditarConector(c)}>
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleTestarConector(c.id)} title="Executar ação simulada">
                        <Play className="h-3.5 w-3.5 text-green-600" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {conectoresFiltrados.length === 0 && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum conector encontrado.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="vinculos" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2 items-center">
              <Select value={filterRobo} onValueChange={setFilterRobo}>
                <SelectTrigger className="w-52"><SelectValue placeholder="Filtrar por robô" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos robôs</SelectItem>
                  {robos.map(r => (<SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={loadVinculos}><RefreshCw className="h-4 w-4 mr-1" />Atualizar</Button>
            </div>
            <Button size="sm" onClick={abrirNovoVinculo}><Plus className="h-4 w-4 mr-1" />Vincular Conector</Button>
          </div>

          {vinculosFiltrados.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum vínculo configurado. Vincule conectores aos robôs.</CardContent></Card>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Robô</TableHead>
                  <TableHead>Conector</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Provedor</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vinculosFiltrados.map((v) => (
                  <TableRow key={v.id} className={!v.ativo ? "opacity-60" : ""}>
                    <TableCell className="font-medium">{v.robo_nome || v.robo_id.slice(0, 8)}</TableCell>
                    <TableCell>{v.conector_nome || "-"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{v.conector_tipo || "-"}</Badge></TableCell>
                    <TableCell className="text-xs">{v.conector_provedor || "-"}</TableCell>
                    <TableCell><ModoBadge modo={v.modo} /></TableCell>
                    <TableCell><Badge className={v.ativo ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}>{v.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => abrirEditarVinculo(v)}>
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        {v.ativo && (
                          <Button variant="ghost" size="sm" onClick={async () => { try { await conectoresService.desvincularRobo(v.id); toast.success("Vínculo removido"); loadVinculos(); } catch { toast.error("Erro ao remover vínculo"); } }}>
                            <Ban className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="zoho" className="space-y-4 mt-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Configuração Zoho Mail</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Conecte sua conta de email corporativa. O Client Secret permanece no servidor local.
            </p>
            <ZohoConnectPanel />
          </div>
        </TabsContent>

        <TabsContent value="historico" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2 items-center">
              <Select value={filterRobo} onValueChange={setFilterRobo}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Robô" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos robôs</SelectItem>
                  {robos.map(r => (<SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={filterStatusExec} onValueChange={setFilterStatusExec}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos status</SelectItem>
                  {Object.entries(STATUS_EXEC_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={loadExecucoes} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />Atualizar
              </Button>
            </div>
          </div>

          {execucoesFiltradas.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma execução registrada. Teste um conector para começar.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {execucoesFiltradas.map((e) => {
                const robo = robos.find(r => r.id === e.robo_id);
                return (
                  <Card key={e.id} className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-medium">{e.robo_nome || robo?.nome || "Sistema"}</span>
                          <span className="text-xs text-muted-foreground">→</span>
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-medium">{e.conector_nome || e.conector_id.slice(0, 8)}</span>
                          <StatusBadge status={e.status} />
                          <ModoBadge modo={e.modo_executado} />
                          <span className="text-[10px] text-muted-foreground">{fmtData(e.created_at)}</span>
                        </div>
                        <p className="text-xs mt-1">{e.acao}</p>
                        {e.status === "CONCLUIDA" && e.resultado && (
                          <p className="text-[10px] text-green-600 mt-1">{(e.resultado as Record<string, unknown>)?.mensagem as string || "Executado"}</p>
                        )}
                        {e.erro && <p className="text-[10px] text-red-500 mt-1">Erro: {e.erro}</p>}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={conectorDialogOpen} onOpenChange={setConectorDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editConector ? "Editar Conector" : "Novo Conector"}</DialogTitle>
            <DialogDescription>Cadastre uma nova integração externa para os funcionários digitais.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Código Único *</Label><Input value={formConector.codigo_unico} onChange={e => setFormConector({ ...formConector, codigo_unico: e.target.value.toUpperCase().replace(/\s/g, "_") })} placeholder="EX: CON_ZOHO_EMAIL" /></div>
              <div><Label>Nome *</Label><Input value={formConector.nome} onChange={e => setFormConector({ ...formConector, nome: e.target.value })} placeholder="Ex: Zoho Mail" /></div>
            </div>
            <div><Label>Descrição</Label><Textarea value={formConector.descricao} onChange={e => setFormConector({ ...formConector, descricao: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Tipo</Label>
                <Select value={formConector.tipo} onValueChange={(v: TipoConector) => setFormConector({ ...formConector, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Provedor *</Label><Input value={formConector.provedor} onChange={e => setFormConector({ ...formConector, provedor: e.target.value })} placeholder="Ex: Zoho, Evolution API" /></div>
            </div>
            <div><Label>Modo de Segurança</Label>
              <Select value={formConector.modo_padrao} onValueChange={(v: ModoConector) => setFormConector({ ...formConector, modo_padrao: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOMOLOGACAO">
                    <div className="flex items-center gap-2"><Shield className="h-3 w-3 text-yellow-500" /> Homologação — Apenas simula</div>
                  </SelectItem>
                  <SelectItem value="PRODUCAO_ASSISTIDA">
                    <div className="flex items-center gap-2"><Shield className="h-3 w-3 text-blue-500" /> Produção Assistida — Requer aprovação</div>
                  </SelectItem>
                  <SelectItem value="PRODUCAO_AUTONOMA">
                    <div className="flex items-center gap-2"><Shield className="h-3 w-3 text-purple-500" /> Produção Autônoma — Execução automática</div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>URL Base</Label><Input value={formConector.url_base} onChange={e => setFormConector({ ...formConector, url_base: e.target.value })} placeholder="Ex: http://localhost:8080" /></div>
              <div><Label>Limite de Uso / Dia</Label><Input type="number" min={1} value={formConector.limite_uso_dia} onChange={e => setFormConector({ ...formConector, limite_uso_dia: parseInt(e.target.value) || 100 })} placeholder="100" /></div>
            </div>
            <div className="border rounded-md p-3 bg-muted/30">
              <div className="flex items-center gap-2 mb-2 text-sm font-medium"><Key className="h-3.5 w-3.5" /> Credenciais (referência .env)</div>
              <p className="text-xs text-muted-foreground mb-2">As chaves de API são lidas do arquivo .env. Configure as variáveis de ambiente correspondentes.</p>
              {formConector.codigo_unico && (
                <div className="text-xs font-mono bg-background p-2 rounded border">
                  {formConector.tipo === "EMAIL" && "VITE_ZOHO_EMAIL_API_KEY, VITE_ZOHO_EMAIL_API_URL, VITE_ZOHO_EMAIL_FROM"}
                  {formConector.tipo === "WHATSAPP" && "VITE_EVOLUTION_API_KEY, VITE_EVOLUTION_API_URL"}
                  {formConector.tipo === "IA" && "Chaves no Supabase Secrets (proxy-ia)"}
                  {formConector.tipo === "AUTOMACAO_WEB" && "VITE_N8N_API_KEY, VITE_N8N_WEBHOOK_URL"}
                  {formConector.tipo === "PLATAFORMA_VAGAS" && "VITE_VAGAS_API_KEY"}
                  {formConector.tipo === "OUTRO" && formConector.provedor === "Mapbox" && "VITE_MAPBOX_ACCESS_TOKEN"}
                  {formConector.tipo === "OUTRO" && formConector.provedor === "Google Ads" && "VITE_GOOGLE_ADS_CLIENT_ID, VITE_GOOGLE_ADS_CLIENT_SECRET"}
                  {!["EMAIL", "WHATSAPP", "IA", "AUTOMACAO_WEB", "PLATAFORMA_VAGAS"].includes(formConector.tipo) && !(formConector.tipo === "OUTRO" && (formConector.provedor === "Mapbox" || formConector.provedor === "Google Ads")) && "Configure as variáveis de ambiente conforme documentação do provedor"}
                </div>
              )}
            </div>
            <div><Label>Instruções de Conexão</Label><Textarea value={formConector.instrucoes_conexao} onChange={e => setFormConector({ ...formConector, instrucoes_conexao: e.target.value })} rows={2} placeholder="Instruções para configuração, links de documentação, etc." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConectorDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSalvarConector}><Save className="h-4 w-4 mr-1" />{editConector ? "Atualizar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={vinculoDialogOpen} onOpenChange={setVinculoDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editVinculo ? "Editar Vínculo" : "Vincular Conector ao Robô"}</DialogTitle>
            <DialogDescription>Configure qual conector o robô pode usar e em qual modo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Robô *</Label>
                <Select value={formVinculo.robo_id} onValueChange={v => setFormVinculo({ ...formVinculo, robo_id: v })} disabled={!!editVinculo}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {robos.map(r => (<SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Conector *</Label>
                <Select value={formVinculo.conector_id} onValueChange={v => setFormVinculo({ ...formVinculo, conector_id: v })} disabled={!!editVinculo}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {conectores.filter(c => c.ativo).map(c => (<SelectItem key={c.id} value={c.id}>{c.nome} ({c.codigo_unico})</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Modo de Segurança</Label>
              <Select value={formVinculo.modo} onValueChange={(v: ModoConector) => setFormVinculo({ ...formVinculo, modo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOMOLOGACAO">Homologação — Apenas simula, não chama API externa</SelectItem>
                  <SelectItem value="PRODUCAO_ASSISTIDA">Produção Assistida — Executa após aprovação humana</SelectItem>
                  <SelectItem value="PRODUCAO_AUTONOMA">Produção Autônoma — Executa dentro dos limites configurados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVinculoDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSalvarVinculo}><Save className="h-4 w-4 mr-1" />{editVinculo ? "Atualizar" : "Vincular"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
