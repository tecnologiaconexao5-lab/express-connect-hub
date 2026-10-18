import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Save, RefreshCw, Trash2, Bot, Wrench, Clock, CheckCircle, AlertTriangle, XCircle, Edit3, Ban, Play, BarChart3 } from "lucide-react";
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
import { actionEngineService, type IaFerramenta, type IaRoboFerramenta, type IaExecucaoFerramenta, type CategoriaFerramenta, type NivelAutonomiaFerramenta, type StatusExecucaoFerramenta } from "@/services/ia/actionEngineService";
import { centralIaService, type AutomacaoRobo } from "@/services/centralIaService";

const CATEGORIA_LABELS: Record<CategoriaFerramenta, string> = {
  COMUNICACAO: "Comunicação", MARKETING: "Marketing", FINANCEIRO: "Financeiro",
  OPERACIONAL: "Operacional", COMERCIAL: "Comercial", DOCUMENTOS: "Documentos",
  AUTOMACAO_WEB: "Automação Web", INTEGRACOES: "Integrações", RECRUTAMENTO: "Recrutamento",
};

const STATUS_EXEC_LABELS: Record<StatusExecucaoFerramenta, string> = {
  SOLICITADA: "Solicitada", AGUARDANDO_APROVACAO: "Aguardando Aprovação",
  APROVADA: "Aprovada", EM_EXECUCAO: "Em Execução",
  CONCLUIDA: "Concluída", FALHOU: "Falhou", CANCELADA: "Cancelada",
};

const STATUS_EXEC_COLORS: Record<StatusExecucaoFerramenta, string> = {
  SOLICITADA: "bg-blue-100 text-blue-800", AGUARDANDO_APROVACAO: "bg-yellow-100 text-yellow-800",
  APROVADA: "bg-green-100 text-green-800", EM_EXECUCAO: "bg-purple-100 text-purple-800",
  CONCLUIDA: "bg-green-100 text-green-800", FALHOU: "bg-red-100 text-red-800",
  CANCELADA: "bg-gray-100 text-gray-500",
};

const CATEGORIA_CORES: Record<string, string> = {
  COMUNICACAO: "#3b82f6", MARKETING: "#ec4899", FINANCEIRO: "#10b981",
  OPERACIONAL: "#f59e0b", COMERCIAL: "#22c55e", DOCUMENTOS: "#8b5cf6",
  AUTOMACAO_WEB: "#06b6d4", INTEGRACOES: "#6366f1", RECRUTAMENTO: "#f97316",
};

function StatusBadge({ status }: { status: StatusExecucaoFerramenta }) {
  return <Badge className={STATUS_EXEC_COLORS[status] || ""}>{STATUS_EXEC_LABELS[status] || status}</Badge>;
}

function fmtData(d: string | null | undefined) {
  if (!d) return "-";
  try { return new Date(d).toLocaleString("pt-BR"); } catch { return d; }
}

export function FerramentasTab() {
  const [robos, setRobos] = useState<AutomacaoRobo[]>([]);
  const [ferramentas, setFerramentas] = useState<IaFerramenta[]>([]);
  const [permissoes, setPermissoes] = useState<IaRoboFerramenta[]>([]);
  const [execucoes, setExecucoes] = useState<IaExecucaoFerramenta[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("catalogo");

  // Dialog states
  const [ferramentaDialogOpen, setFerramentaDialogOpen] = useState(false);
  const [editFerramenta, setEditFerramenta] = useState<IaFerramenta | null>(null);
  const [formFerramenta, setFormFerramenta] = useState({
    codigo_unico: "", nome: "", descricao: "", categoria: "COMUNICACAO" as CategoriaFerramenta,
    precisa_aprovacao: true, risco_operacional: "baixo", custo_estimado: "", limite_execucoes_dia: 10,
  });

  const [permissaoDialogOpen, setPermissaoDialogOpen] = useState(false);
  const [editPermissao, setEditPermissao] = useState<IaRoboFerramenta | null>(null);
  const [formPermissao, setFormPermissao] = useState({
    robo_id: "", ferramenta_id: "", nivel_autonomia: "EXECUTAR_COM_APROVACAO" as NivelAutonomiaFerramenta,
    limite_diario: "", horario_inicio: "", horario_fim: "",
  });

  // Filters
  const [searchFerramenta, setSearchFerramenta] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("todas");
  const [filterRobo, setFilterRobo] = useState("todos");
  const [filterStatusExec, setFilterStatusExec] = useState("todos");

  const loadRobos = useCallback(async () => {
    const data = await centralIaService.listarRobos();
    setRobos(data);
  }, []);

  const loadFerramentas = useCallback(async () => {
    const data = await actionEngineService.listarFerramentas();
    setFerramentas(data);
  }, []);

  const loadPermissoes = useCallback(async () => {
    const data = await actionEngineService.listarPermissoes();
    setPermissoes(data);
  }, []);

  const loadExecucoes = useCallback(async () => {
    setLoading(true);
    const data = await actionEngineService.listarHistorico({ limite: 100 });
    setExecucoes(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadRobos(); loadFerramentas(); loadPermissoes(); }, [loadRobos, loadFerramentas, loadPermissoes]);
  useEffect(() => { if (activeTab === "historico") loadExecucoes(); }, [activeTab, loadExecucoes]);

  // ==================== FERRAMENTAS CRUD ====================
  function resetFormFerramenta() {
    setFormFerramenta({
      codigo_unico: "", nome: "", descricao: "", categoria: "COMUNICACAO",
      precisa_aprovacao: true, risco_operacional: "baixo", custo_estimado: "", limite_execucoes_dia: 10,
    });
  }

  function abrirNovaFerramenta() {
    setEditFerramenta(null);
    resetFormFerramenta();
    setFerramentaDialogOpen(true);
  }

  function abrirEditarFerramenta(f: IaFerramenta) {
    setEditFerramenta(f);
    setFormFerramenta({
      codigo_unico: f.codigo_unico, nome: f.nome, descricao: f.descricao || "",
      categoria: f.categoria, precisa_aprovacao: f.precisa_aprovacao,
      risco_operacional: f.risco_operacional, custo_estimado: f.custo_estimado || "",
      limite_execucoes_dia: f.limite_execucoes_dia,
    });
    setFerramentaDialogOpen(true);
  }

  async function handleSalvarFerramenta() {
    if (!formFerramenta.nome.trim() || !formFerramenta.codigo_unico.trim()) {
      toast.error("Nome e Código são obrigatórios"); return;
    }
    if (editFerramenta) {
      await actionEngineService.atualizarFerramenta(editFerramenta.id, {
        nome: formFerramenta.nome, descricao: formFerramenta.descricao || null,
        categoria: formFerramenta.categoria, precisa_aprovacao: formFerramenta.precisa_aprovacao,
        risco_operacional: formFerramenta.risco_operacional, custo_estimado: formFerramenta.custo_estimado || null,
        limite_execucoes_dia: formFerramenta.limite_execucoes_dia,
      } as IaFerramenta);
      toast.success("Ferramenta atualizada");
    } else {
      await actionEngineService.criarFerramenta({
        codigo_unico: formFerramenta.codigo_unico, nome: formFerramenta.nome,
        descricao: formFerramenta.descricao, categoria: formFerramenta.categoria,
        precisa_aprovacao: formFerramenta.precisa_aprovacao,
        risco_operacional: formFerramenta.risco_operacional, custo_estimado: formFerramenta.custo_estimado,
        limite_execucoes_dia: formFerramenta.limite_execucoes_dia,
      });
      toast.success("Ferramenta criada");
    }
    setFerramentaDialogOpen(false);
    setEditFerramenta(null);
    loadFerramentas();
  }

  // ==================== PERMISSÕES CRUD ====================
  function resetFormPermissao() {
    setFormPermissao({
      robo_id: "", ferramenta_id: "", nivel_autonomia: "EXECUTAR_COM_APROVACAO",
      limite_diario: "", horario_inicio: "", horario_fim: "",
    });
  }

  function abrirNovaPermissao() {
    setEditPermissao(null);
    resetFormPermissao();
    setPermissaoDialogOpen(true);
  }

  function abrirEditarPermissao(p: IaRoboFerramenta) {
    setEditPermissao(p);
    setFormPermissao({
      robo_id: p.robo_id, ferramenta_id: p.ferramenta_id,
      nivel_autonomia: p.nivel_autonomia,
      limite_diario: p.limite_diario?.toString() || "",
      horario_inicio: p.horario_inicio || "",
      horario_fim: p.horario_fim || "",
    });
    setPermissaoDialogOpen(true);
  }

  async function handleSalvarPermissao() {
    if (!formPermissao.robo_id || !formPermissao.ferramenta_id) {
      toast.error("Selecione robô e ferramenta"); return;
    }
    if (editPermissao) {
      await actionEngineService.atualizarPermissao(editPermissao.id, {
        nivel_autonomia: formPermissao.nivel_autonomia,
        limite_diario: formPermissao.limite_diario ? parseInt(formPermissao.limite_diario) : null,
        horario_inicio: formPermissao.horario_inicio || null,
        horario_fim: formPermissao.horario_fim || null,
      } as IaRoboFerramenta);
      toast.success("Permissão atualizada");
    } else {
      await actionEngineService.vincularFerramenta({
        robo_id: formPermissao.robo_id,
        ferramenta_id: formPermissao.ferramenta_id,
        nivel_autonomia: formPermissao.nivel_autonomia,
        limite_diario: formPermissao.limite_diario ? parseInt(formPermissao.limite_diario) : undefined,
        horario_inicio: formPermissao.horario_inicio || undefined,
        horario_fim: formPermissao.horario_fim || undefined,
      });
      toast.success("Ferramenta vinculada ao robô");
    }
    setPermissaoDialogOpen(false);
    setEditPermissao(null);
    loadPermissoes();
  }

  // ==================== EXECUÇÕES ====================
  async function handleSolicitarExecucao(ferramentaId: string) {
    const roboId = filterRobo !== "todos" ? filterRobo : robos[0]?.id;
    if (!roboId) { toast.error("Selecione um robô"); return; }
    const ferramenta = ferramentas.find(f => f.id === ferramentaId);
    if (!ferramenta) return;
    const result = await actionEngineService.solicitarAcao({
      robo_id: roboId,
      ferramenta_id: ferramentaId,
      solicitacao: `Execução de ${ferramenta.nome} solicitada via painel`,
      contexto: { origem: "central_ia_painel", solicitado_por: "gestor" },
    });
    if (result.sucesso) {
      toast.success(`Ação solicitada: ${ferramenta.nome}`);
      loadExecucoes();
    } else {
      toast.error(result.motivo || "Erro ao solicitar ação");
    }
  }

  async function handleAprovarExecucao(id: string) {
    await actionEngineService.aprovarExecucao(id);
    toast.success("Execução aprovada");
    loadExecucoes();
  }

  async function handleCancelarExecucao(id: string) {
    await actionEngineService.cancelarExecucao(id);
    toast.success("Execução cancelada");
    loadExecucoes();
  }

  async function handleExecutarAgora(id: string) {
    const ok = await actionEngineService.executarAcao(id);
    if (ok) toast.success("Execução concluída");
    else toast.error("Erro na execução");
    loadExecucoes();
  }

  // ==================== FILTERS ====================
  const ferramentasFiltradas = ferramentas.filter(f => {
    if (searchFerramenta && !f.nome.toLowerCase().includes(searchFerramenta.toLowerCase()) && !f.codigo_unico.toLowerCase().includes(searchFerramenta.toLowerCase())) return false;
    if (filterCategoria !== "todas" && f.categoria !== filterCategoria) return false;
    return true;
  });

  const permissoesFiltradas = filterRobo !== "todos"
    ? permissoes.filter(p => p.robo_id === filterRobo)
    : permissoes;

  const execucoesFiltradas = execucoes.filter(e => {
    if (filterRobo !== "todos" && e.robo_id !== filterRobo) return false;
    if (filterStatusExec !== "todos" && e.status !== filterStatusExec) return false;
    return true;
  });

  // ==================== STATS ====================
  const stats = {
    total_ferramentas: ferramentas.length,
    total_permissoes: permissoes.length,
    total_execucoes: execucoes.length,
    concluidas: execucoes.filter(e => e.status === "CONCLUIDA").length,
    falhas: execucoes.filter(e => e.status === "FALHOU").length,
    pendentes: execucoes.filter(e => ["SOLICITADA", "AGUARDANDO_APROVACAO", "APROVADA"].includes(e.status)).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wrench className="h-6 w-6 text-primary" />
            Action Engine — Ferramentas dos Funcionários Digitais
          </h2>
          <p className="text-muted-foreground">Catálogo de capacidades, permissões e histórico de execuções</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Ferramentas</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{stats.total_ferramentas}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Permissões</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-blue-600">{stats.total_permissoes}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Execuções</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-purple-600">{stats.total_execucoes}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Concluídas</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-green-600">{stats.concluidas}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pendentes</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-yellow-600">{stats.pendentes}</div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="catalogo"><Wrench className="h-4 w-4 mr-1" />Catálogo</TabsTrigger>
          <TabsTrigger value="permissoes"><Bot className="h-4 w-4 mr-1" />Permissões</TabsTrigger>
          <TabsTrigger value="historico"><Clock className="h-4 w-4 mr-1" />Histórico</TabsTrigger>
        </TabsList>

        {/* ==================== ABA 1: CATÁLOGO ==================== */}
        <TabsContent value="catalogo" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2 items-center">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9 w-64" placeholder="Buscar ferramenta..." value={searchFerramenta} onChange={e => setSearchFerramenta(e.target.value)} />
              </div>
              <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas categorias</SelectItem>
                  {Object.entries(CATEGORIA_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={abrirNovaFerramenta}><Plus className="h-4 w-4 mr-1" />Nova Ferramenta</Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {ferramentasFiltradas.map((f) => (
              <Card key={f.id} className={`${!f.ativo ? "opacity-60" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CATEGORIA_CORES[f.categoria] || "#6366f1" }} />
                        <span className="font-semibold text-sm">{f.nome}</span>
                        <Badge variant="outline" className="text-[10px] font-mono">{f.codigo_unico}</Badge>
                      </div>
                      <Badge className="text-[10px] mt-1" style={{ backgroundColor: `${CATEGORIA_CORES[f.categoria] || "#6366f1"}20`, color: CATEGORIA_CORES[f.categoria] || "#6366f1" }}>
                        {CATEGORIA_LABELS[f.categoria] || f.categoria}
                      </Badge>
                      {f.descricao && <p className="text-xs text-muted-foreground mt-2">{f.descricao}</p>}
                      <div className="flex gap-2 mt-2 text-[10px] text-muted-foreground">
                        <span className={`${f.risco_operacional === "critico" || f.risco_operacional === "alto" ? "text-red-500 font-medium" : ""}`}>
                          Risco: {f.risco_operacional}
                        </span>
                        <span>Limite: {f.limite_execucoes_dia}/dia</span>
                        {f.precisa_aprovacao && <span className="text-amber-600">Precisa aprovação</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => abrirEditarFerramenta(f)}>
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleSolicitarExecucao(f.id)} title="Solicitar execução">
                        <Play className="h-3.5 w-3.5 text-green-600" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {ferramentasFiltradas.length === 0 && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma ferramenta encontrada.</CardContent></Card>
          )}
        </TabsContent>

        {/* ==================== ABA 2: PERMISSÕES ==================== */}
        <TabsContent value="permissoes" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2 items-center">
              <Select value={filterRobo} onValueChange={setFilterRobo}>
                <SelectTrigger className="w-52"><SelectValue placeholder="Filtrar por robô" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos robôs</SelectItem>
                  {robos.map(r => (<SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={loadPermissoes}><RefreshCw className="h-4 w-4 mr-1" />Atualizar</Button>
            </div>
            <Button size="sm" onClick={abrirNovaPermissao}><Plus className="h-4 w-4 mr-1" />Vincular Ferramenta</Button>
          </div>

          {permissoesFiltradas.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma permissão configurada. Vincule ferramentas aos robôs.</CardContent></Card>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Robô</TableHead>
                  <TableHead>Ferramenta</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Autonomia</TableHead>
                  <TableHead>Limite Dia</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissoesFiltradas.map((p) => (
                  <TableRow key={p.id} className={!p.ativo ? "opacity-60" : ""}>
                    <TableCell className="font-medium">{p.robo_nome || p.robo_id.slice(0, 8)}</TableCell>
                    <TableCell>{p.ferramenta_nome || "-"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{p.ferramenta_categoria || "-"}</Badge></TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${
                        p.nivel_autonomia === "EXECUTAR_AUTONOMO" ? "bg-green-100 text-green-800" :
                        p.nivel_autonomia === "EXECUTAR_COM_APROVACAO" ? "bg-yellow-100 text-yellow-800" :
                        "bg-blue-100 text-blue-800"
                      }`}>
                        {p.nivel_autonomia === "EXECUTAR_AUTONOMO" ? "Autônomo" :
                         p.nivel_autonomia === "EXECUTAR_COM_APROVACAO" ? "Com Aprovação" : "Consulta"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{p.limite_diario || "Ilimitado"}</TableCell>
                    <TableCell className="text-xs">{p.horario_inicio && p.horario_fim ? `${p.horario_inicio}-${p.horario_fim}` : "Livre"}</TableCell>
                    <TableCell><Badge className={p.ativo ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}>{p.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => abrirEditarPermissao(p)}>
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        {p.ativo && (
                          <Button variant="ghost" size="sm" onClick={() => { actionEngineService.desvincularFerramenta(p.id); toast.success("Permissão removida"); loadPermissoes(); }}>
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

        {/* ==================== ABA 3: HISTÓRICO ==================== */}
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
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma execução registrada. Solicite uma ação para testar.</CardContent></Card>
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
                          <Wrench className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-medium">{e.ferramenta_nome || e.ferramenta_id.slice(0, 8)}</span>
                          <StatusBadge status={e.status} />
                          <span className="text-[10px] text-muted-foreground">{fmtData(e.created_at)}</span>
                        </div>
                        <p className="text-xs mt-1">{e.solicitacao}</p>
                        {e.status === "CONCLUIDA" && e.resultado && (
                          <p className="text-[10px] text-green-600 mt-1">{(e.resultado as Record<string, unknown>)?.mensagem as string || "Executado"}</p>
                        )}
                        {e.erro && <p className="text-[10px] text-red-500 mt-1">Erro: {e.erro}</p>}
                        {e.aprovado_por && <p className="text-[10px] text-muted-foreground mt-1">Aprovado por: {e.aprovado_por}</p>}
                      </div>
                      <div className="flex gap-1 ml-2 shrink-0">
                        {e.status === "SOLICITADA" && (
                          <Button variant="ghost" size="sm" onClick={() => handleAprovarExecucao(e.id)} title="Aprovar">
                            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                        )}
                        {e.status === "APROVADA" && (
                          <Button variant="ghost" size="sm" onClick={() => handleExecutarAgora(e.id)} title="Executar agora">
                            <Play className="h-3.5 w-3.5 text-blue-600" />
                          </Button>
                        )}
                        {(e.status === "SOLICITADA" || e.status === "AGUARDANDO_APROVACAO") && (
                          <Button variant="ghost" size="sm" onClick={() => handleCancelarExecucao(e.id)} title="Cancelar">
                            <XCircle className="h-3.5 w-3.5 text-red-500" />
                          </Button>
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

      {/* ==================== DIALOG FERRAMENTA ==================== */}
      <Dialog open={ferramentaDialogOpen} onOpenChange={setFerramentaDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editFerramenta ? "Editar Ferramenta" : "Nova Ferramenta"}</DialogTitle>
            <DialogDescription>Cadastre uma nova capacidade para os funcionários digitais.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Código Único *</Label><Input value={formFerramenta.codigo_unico} onChange={e => setFormFerramenta({ ...formFerramenta, codigo_unico: e.target.value.toUpperCase().replace(/\s/g, "_") })} placeholder="EX: COM_ENVIAR_EMAIL" /></div>
              <div><Label>Nome *</Label><Input value={formFerramenta.nome} onChange={e => setFormFerramenta({ ...formFerramenta, nome: e.target.value })} placeholder="Ex: Enviar E-mail" /></div>
            </div>
            <div><Label>Descrição</Label><Textarea value={formFerramenta.descricao} onChange={e => setFormFerramenta({ ...formFerramenta, descricao: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Categoria</Label>
                <Select value={formFerramenta.categoria} onValueChange={(v: CategoriaFerramenta) => setFormFerramenta({ ...formFerramenta, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIA_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Risco Operacional</Label>
                <Select value={formFerramenta.risco_operacional} onValueChange={v => setFormFerramenta({ ...formFerramenta, risco_operacional: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixo">Baixo</SelectItem>
                    <SelectItem value="medio">Médio</SelectItem>
                    <SelectItem value="alto">Alto</SelectItem>
                    <SelectItem value="critico">Crítico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Custo Estimado</Label><Input value={formFerramenta.custo_estimado} onChange={e => setFormFerramenta({ ...formFerramenta, custo_estimado: e.target.value })} placeholder="Ex: R$ 0,50 por envio" /></div>
              <div><Label>Limite Execuções/Dia</Label><Input type="number" min={1} value={formFerramenta.limite_execucoes_dia} onChange={e => setFormFerramenta({ ...formFerramenta, limite_execucoes_dia: parseInt(e.target.value) || 10 })} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formFerramenta.precisa_aprovacao} onCheckedChange={v => setFormFerramenta({ ...formFerramenta, precisa_aprovacao: v })} />
              <Label>Precisa de Aprovação Humana</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFerramentaDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSalvarFerramenta}><Save className="h-4 w-4 mr-1" />{editFerramenta ? "Atualizar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DIALOG PERMISSÃO ==================== */}
      <Dialog open={permissaoDialogOpen} onOpenChange={setPermissaoDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editPermissao ? "Editar Permissão" : "Vincular Ferramenta ao Robô"}</DialogTitle>
            <DialogDescription>Configure o que o robô pode fazer com esta ferramenta.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Robô *</Label>
                <Select value={formPermissao.robo_id} onValueChange={v => setFormPermissao({ ...formPermissao, robo_id: v })} disabled={!!editPermissao}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {robos.map(r => (<SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Ferramenta *</Label>
                <Select value={formPermissao.ferramenta_id} onValueChange={v => setFormPermissao({ ...formPermissao, ferramenta_id: v })} disabled={!!editPermissao}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {ferramentas.filter(f => f.ativo).map(f => (<SelectItem key={f.id} value={f.id}>{f.nome} ({f.codigo_unico})</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Nível de Autonomia</Label>
              <Select value={formPermissao.nivel_autonomia} onValueChange={(v: NivelAutonomiaFerramenta) => setFormPermissao({ ...formPermissao, nivel_autonomia: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONSULTA">Consulta — Apenas leitura</SelectItem>
                  <SelectItem value="EXECUTAR_COM_APROVACAO">Executar com Aprovação — Precisa de humano</SelectItem>
                  <SelectItem value="EXECUTAR_AUTONOMO">Executar Autônomo — Ação automática</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Limite Diário</Label><Input type="number" min={0} value={formPermissao.limite_diario} onChange={e => setFormPermissao({ ...formPermissao, limite_diario: e.target.value })} placeholder="Ilimitado" /></div>
              <div><Label>Horário Início</Label><Input type="time" value={formPermissao.horario_inicio} onChange={e => setFormPermissao({ ...formPermissao, horario_inicio: e.target.value })} /></div>
              <div><Label>Horário Fim</Label><Input type="time" value={formPermissao.horario_fim} onChange={e => setFormPermissao({ ...formPermissao, horario_fim: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissaoDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSalvarPermissao}><Save className="h-4 w-4 mr-1" />{editPermissao ? "Atualizar" : "Vincular"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
