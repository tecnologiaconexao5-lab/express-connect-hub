import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Save, RefreshCw, Trash2, Bot, Target, Calendar, BarChart3, Edit3, Ban, Play, AlertTriangle, Trophy, Clock, Shield, ListTodo } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { gestaoFuncionariosService, type IaMissao, type IaMeta, type IaIndicador, type IaAgendaTrabalho, type IaAgendaAtividade, type IaLimiteOperacional, type PrioridadeMissao, type StatusMissao, type StatusMeta, type PeriodicidadeMeta, type DiaSemana, type TipoAtividadeAgenda } from "@/services/ia/gestaoFuncionariosService";
import { centralIaService, type AutomacaoRobo } from "@/services/centralIaService";

const PRIORIDADE_LABELS: Record<PrioridadeMissao, string> = {
  baixa: "Baixa", media: "Média", alta: "Alta", critica: "Crítica",
};

const PRIORIDADE_CORES: Record<PrioridadeMissao, string> = {
  baixa: "bg-green-100 text-green-800", media: "bg-blue-100 text-blue-800",
  alta: "bg-orange-100 text-orange-800", critica: "bg-red-100 text-red-800",
};

const STATUS_MISSAO_LABELS: Record<StatusMissao, string> = {
  ativa: "Ativa", pausada: "Pausada", concluida: "Concluída", cancelada: "Cancelada", rascunho: "Rascunho",
};

const STATUS_MISSAO_CORES: Record<StatusMissao, string> = {
  ativa: "bg-green-100 text-green-800", pausada: "bg-yellow-100 text-yellow-800",
  concluida: "bg-blue-100 text-blue-800", cancelada: "bg-red-100 text-red-800", rascunho: "bg-gray-100 text-gray-500",
};

const STATUS_META_LABELS: Record<StatusMeta, string> = {
  ativa: "Ativa", pausada: "Pausada", atingida: "Atingida", nao_atingida: "Não Atingida", cancelada: "Cancelada",
};

const STATUS_META_CORES: Record<StatusMeta, string> = {
  ativa: "bg-blue-100 text-blue-800", pausada: "bg-yellow-100 text-yellow-800",
  atingida: "bg-green-100 text-green-800", nao_atingida: "bg-red-100 text-red-800", cancelada: "bg-gray-100 text-gray-500",
};

const PERIODICIDADE_LABELS: Record<PeriodicidadeMeta, string> = {
  diaria: "Diária", semanal: "Semanal", quinzenal: "Quinzenal", mensal: "Mensal",
  bimestral: "Bimestral", trimestral: "Trimestral", semestral: "Semestral", anual: "Anual",
};

const DIAS_SEMANA: DiaSemana[] = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
const DIAS_LABELS: Record<DiaSemana, string> = {
  domingo: "Domingo", segunda: "Segunda", terca: "Terça", quarta: "Quarta",
  quinta: "Quinta", sexta: "Sexta", sabado: "Sábado",
};

const TIPO_ATIVIDADE_LABELS: Record<TipoAtividadeAgenda, string> = {
  prospeccao: "Prospecção", followup: "Follow-up", email: "E-mail", cobranca: "Cobrança",
  analise: "Análise", relatorio: "Relatório", reuniao: "Reunião", treinamento: "Treinamento",
  comunicacao: "Comunicação", outro: "Outro",
};

function PriorityBadge({ prioridade }: { prioridade: PrioridadeMissao }) {
  return <Badge className={PRIORIDADE_CORES[prioridade] || ""}>{PRIORIDADE_LABELS[prioridade] || prioridade}</Badge>;
}

function StatusBadge({ status, tipo }: { status: string; tipo: "missao" | "meta" }) {
  const cores = tipo === "missao" ? STATUS_MISSAO_CORES : STATUS_META_CORES;
  const labels = tipo === "missao" ? STATUS_MISSAO_LABELS : STATUS_META_LABELS;
  const s = status as StatusMissao & StatusMeta;
  return <Badge className={cores[s] || ""}>{labels[s] || status}</Badge>;
}

function fmtData(d: string | null | undefined) {
  if (!d) return "-";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
}

export function MissoesDesempenhoTab() {
  const [robos, setRobos] = useState<AutomacaoRobo[]>([]);
  const [missoes, setMissoes] = useState<IaMissao[]>([]);
  const [metas, setMetas] = useState<IaMeta[]>([]);
  const [indicadores, setIndicadores] = useState<IaIndicador[]>([]);
  const [agenda, setAgenda] = useState<(IaAgendaTrabalho & { atividades: IaAgendaAtividade[] })[]>([]);
  const [limites, setLimites] = useState<IaLimiteOperacional[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("missoes");
  const [searchTerm, setSearchTerm] = useState("");

  const [missaoDialogOpen, setMissaoDialogOpen] = useState(false);
  const [editMissao, setEditMissao] = useState<IaMissao | null>(null);
  const [formMissao, setFormMissao] = useState({ robo_id: "", nome_missao: "", descricao: "", objetivo_estrategico: "", prioridade: "media" as PrioridadeMissao, status: "rascunho" as StatusMissao, inicio_vigencia: "", fim_vigencia: "" });

  const [metaDialogOpen, setMetaDialogOpen] = useState(false);
  const [editMeta, setEditMeta] = useState<IaMeta | null>(null);
  const [formMeta, setFormMeta] = useState({ missao_id: "", robo_id: "", nome_meta: "", descricao: "", tipo: "", valor_meta: 0, unidade: "unidades", periodicidade: "mensal" as PeriodicidadeMeta, peso: 1.0, data_referencia_inicio: "", data_referencia_fim: "" });
  const [selectedMissaoMetas, setSelectedMissaoMetas] = useState<string | null>(null);

  const [atividadeDialogOpen, setAtividadeDialogOpen] = useState(false);
  const [editAtividade, setEditAtividade] = useState<IaAgendaAtividade | null>(null);
  const [formAtividade, setFormAtividade] = useState({ agenda_id: "", robo_id: "", horario_inicio: "08:00", horario_fim: "09:00", tipo_atividade: "outro" as TipoAtividadeAgenda, descricao: "", prioridade: "media" as PrioridadeMissao });

  const [limiteDialogOpen, setLimiteDialogOpen] = useState(false);
  const [editLimite, setEditLimite] = useState<IaLimiteOperacional | null>(null);
  const [formLimite, setFormLimite] = useState({ robo_id: "", acao_tipo: "", limite_quantidade: 0, periodo: "diario", horario_permitido_inicio: "00:00", horario_permitido_fim: "23:59", limite_financeiro: 0, alerta_quando_atingir: 80 });

  const [desempenho, setDesempenho] = useState<{ robo_id: string; robo_nome: string; desempenho: number; tendencia: string }[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [robosData, missoesData] = await Promise.all([
        centralIaService.listarRobos(),
        gestaoFuncionariosService.listarMissoes(),
      ]);
      setRobos(robosData);
      setMissoes(missoesData);

      if (missoesData.length > 0) {
        const metasData = await gestaoFuncionariosService.listarMetas();
        setMetas(metasData);
      }

      const indicadoresData = await gestaoFuncionariosService.listarIndicadores();
      setIndicadores(indicadoresData);
    } catch (err) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadAgenda = useCallback(async (roboId: string) => {
    try {
      const data = await gestaoFuncionariosService.listarAgenda(roboId);
      setAgenda(data);
    } catch {
      toast.error("Erro ao carregar agenda");
    }
  }, []);

  const loadLimites = useCallback(async (roboId?: string) => {
    try {
      const data = await gestaoFuncionariosService.listarLimites(roboId);
      setLimites(data);
    } catch {
      toast.error("Erro ao carregar limites");
    }
  }, []);

  const loadDesempenho = useCallback(async () => {
    try {
      const dados = await gestaoFuncionariosService.listarDesempenhoGeral();
      setDesempenho(dados.map(d => ({ robo_id: d.robo_id, robo_nome: d.robo_nome, desempenho: d.desempenho_geral, tendencia: d.tendencia_geral })));
    } catch {
      // not critical
    }
  }, []);

  // ========== MISSÃO CRUD ==========
  const openCriarMissao = () => {
    setEditMissao(null);
    setFormMissao({ robo_id: robos[0]?.id || "", nome_missao: "", descricao: "", objetivo_estrategico: "", prioridade: "media", status: "rascunho", inicio_vigencia: "", fim_vigencia: "" });
    setMissaoDialogOpen(true);
  };

  const openEditarMissao = (m: IaMissao) => {
    setEditMissao(m);
    setFormMissao({
      robo_id: m.robo_id,
      nome_missao: m.nome_missao,
      descricao: m.descricao || "",
      objetivo_estrategico: m.objetivo_estrategico || "",
      prioridade: m.prioridade,
      status: m.status,
      inicio_vigencia: m.inicio_vigencia ? m.inicio_vigencia.split("T")[0] : "",
      fim_vigencia: m.fim_vigencia ? m.fim_vigencia.split("T")[0] : "",
    });
    setMissaoDialogOpen(true);
  };

  const salvarMissao = async () => {
    if (!formMissao.robo_id || !formMissao.nome_missao) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    try {
      if (editMissao) {
        await gestaoFuncionariosService.atualizarMissao(editMissao.id, formMissao);
        toast.success("Missão atualizada");
      } else {
        await gestaoFuncionariosService.criarMissao(formMissao);
        toast.success("Missão criada");
      }
      setMissaoDialogOpen(false);
      loadData();
    } catch {
      toast.error("Erro ao salvar missão");
    }
  };

  const deletarMissao = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta missão?")) return;
    try {
      await gestaoFuncionariosService.deletarMissao(id);
      toast.success("Missão excluída");
      loadData();
    } catch {
      toast.error("Erro ao excluir missão");
    }
  };

  // ========== META CRUD ==========
  const openCriarMeta = (missaoId?: string) => {
    setEditMeta(null);
    const missao = missoes.find(m => m.id === (missaoId || selectedMissaoMetas));
    setFormMeta({
      missao_id: missaoId || missao?.id || "",
      robo_id: missao?.robo_id || robos[0]?.id || "",
      nome_meta: "", descricao: "", tipo: "", valor_meta: 0,
      unidade: "unidades", periodicidade: "mensal", peso: 1.0,
      data_referencia_inicio: "", data_referencia_fim: "",
    });
    setMetaDialogOpen(true);
  };

  const openEditarMeta = (m: IaMeta) => {
    setEditMeta(m);
    setFormMeta({
      missao_id: m.missao_id,
      robo_id: m.robo_id,
      nome_meta: m.nome_meta,
      descricao: m.descricao || "",
      tipo: m.tipo || "",
      valor_meta: m.valor_meta,
      unidade: m.unidade,
      periodicidade: m.periodicidade,
      peso: m.peso,
      data_referencia_inicio: m.data_referencia_inicio ? m.data_referencia_inicio.split("T")[0] : "",
      data_referencia_fim: m.data_referencia_fim ? m.data_referencia_fim.split("T")[0] : "",
    });
    setMetaDialogOpen(true);
  };

  const salvarMeta = async () => {
    if (!formMeta.missao_id || !formMeta.nome_meta || formMeta.valor_meta <= 0) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    try {
      if (editMeta) {
        await gestaoFuncionariosService.atualizarMeta(editMeta.id, formMeta);
        toast.success("Meta atualizada");
      } else {
        await gestaoFuncionariosService.criarMeta(formMeta);
        toast.success("Meta criada");
      }
      setMetaDialogOpen(false);
      loadData();
    } catch {
      toast.error("Erro ao salvar meta");
    }
  };

  const deletarMeta = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta meta?")) return;
    try {
      await gestaoFuncionariosService.deletarMeta(id);
      toast.success("Meta excluída");
      loadData();
    } catch {
      toast.error("Erro ao excluir meta");
    }
  };

  const atualizarValorMeta = async (id: string, valor: number) => {
    try {
      await gestaoFuncionariosService.atualizarValorMeta(id, valor);
      toast.success("Valor da meta atualizado");
      loadData();
    } catch {
      toast.error("Erro ao atualizar valor");
    }
  };

  // ========== AGENDA ==========
  const openCriarAtividade = (agendaId: string, roboId: string) => {
    setEditAtividade(null);
    setFormAtividade({ agenda_id: agendaId, robo_id: roboId, horario_inicio: "08:00", horario_fim: "09:00", tipo_atividade: "outro", descricao: "", prioridade: "media" });
    setAtividadeDialogOpen(true);
  };

  const salvarAtividade = async () => {
    if (!formAtividade.agenda_id || !formAtividade.descricao) {
      toast.error("Preencha descrição da atividade");
      return;
    }
    try {
      if (editAtividade) {
        await gestaoFuncionariosService.atualizarAtividade(editAtividade.id, formAtividade);
        toast.success("Atividade atualizada");
      } else {
        await gestaoFuncionariosService.criarAtividade(formAtividade);
        toast.success("Atividade criada");
      }
      setAtividadeDialogOpen(false);
      loadAgenda(formAtividade.robo_id);
    } catch {
      toast.error("Erro ao salvar atividade");
    }
  };

  const deletarAtividade = async (id: string, roboId: string) => {
    if (!confirm("Excluir atividade?")) return;
    try {
      await gestaoFuncionariosService.deletarAtividade(id);
      toast.success("Atividade excluída");
      loadAgenda(roboId);
    } catch {
      toast.error("Erro ao excluir");
    }
  };

  // ========== LIMITES ==========
  const salvarLimite = async () => {
    if (!formLimite.robo_id || !formLimite.acao_tipo || formLimite.limite_quantidade <= 0) {
      toast.error("Preencha todos os campos");
      return;
    }
    try {
      if (editLimite) {
        await gestaoFuncionariosService.atualizarLimite(editLimite.id, formLimite);
        toast.success("Limite atualizado");
      } else {
        await gestaoFuncionariosService.criarLimite(formLimite);
        toast.success("Limite criado");
      }
      setLimiteDialogOpen(false);
      loadLimites(formLimite.robo_id);
    } catch {
      toast.error("Erro ao salvar limite");
    }
  };

  // ========== RENDER ==========
  const missoesFiltradas = missoes.filter(m =>
    !searchTerm || m.nome_missao.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.robo_nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const metasDaMissao = (missaoId: string) => metas.filter(m => m.missao_id === missaoId);

  const indicadoresDaMeta = (metaId: string) => indicadores.filter(i => i.meta_id === metaId);

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="missoes"><Target className="mr-2 h-4 w-4" />Missões</TabsTrigger>
          <TabsTrigger value="metas"><Trophy className="mr-2 h-4 w-4" />Metas</TabsTrigger>
          <TabsTrigger value="agenda"><Calendar className="mr-2 h-4 w-4" />Agenda</TabsTrigger>
          <TabsTrigger value="limites"><Shield className="mr-2 h-4 w-4" />Limites</TabsTrigger>
          <TabsTrigger value="desempenho"><BarChart3 className="mr-2 h-4 w-4" />Desempenho</TabsTrigger>
        </TabsList>

        {/* ==================== MISSÕES ==================== */}
        <TabsContent value="missoes" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar missões..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Button onClick={openCriarMissao}><Plus className="mr-2 h-4 w-4" />Nova Missão</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {missoesFiltradas.map(m => (
              <Card key={m.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{m.nome_missao}</CardTitle>
                      <CardDescription>{m.robo_nome} • {m.robo_setor}</CardDescription>
                    </div>
                    <StatusBadge status={m.status} tipo="missao" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{m.descricao || "Sem descrição"}</p>
                  <div className="flex items-center gap-2 mb-2">
                    <PriorityBadge prioridade={m.prioridade} />
                    {m.inicio_vigencia && <span className="text-xs text-muted-foreground">{fmtData(m.inicio_vigencia)} → {fmtData(m.fim_vigencia)}</span>}
                  </div>
                  {m.objetivo_estrategico && (
                    <p className="text-xs text-muted-foreground italic">"{m.objetivo_estrategico}"</p>
                  )}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    <Button variant="outline" size="sm" onClick={() => openEditarMissao(m)}><Edit3 className="h-3 w-3 mr-1" />Editar</Button>
                    <Button variant="outline" size="sm" onClick={() => {
                      setSelectedMissaoMetas(m.id);
                      setActiveTab("metas");
                    }}><ListTodo className="h-3 w-3 mr-1" />Metas</Button>
                    <Button variant="destructive" size="sm" onClick={() => deletarMissao(m.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {missoesFiltradas.length === 0 && (
              <p className="text-muted-foreground col-span-full text-center py-8">Nenhuma missão encontrada</p>
            )}
          </div>
        </TabsContent>

        {/* ==================== METAS ==================== */}
        <TabsContent value="metas" className="mt-6">
          <div className="flex items-center gap-4 mb-4">
            <Select value={selectedMissaoMetas || ""} onValueChange={v => setSelectedMissaoMetas(v || null)}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Filtrar por missão..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as missões</SelectItem>
                {missoes.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.nome_missao} ({m.robo_nome})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => openCriarMeta()} disabled={missoes.length === 0}><Plus className="mr-2 h-4 w-4" />Nova Meta</Button>
          </div>

          <div className="space-y-4">
            {(selectedMissaoMetas ? missoes.filter(m => m.id === selectedMissaoMetas) : missoes).map(missao => {
              const metasList = metas.filter(mm => mm.missao_id === missao.id);
              if (metasList.length === 0) return null;
              return (
                <Card key={missao.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="h-4 w-4" />{missao.nome_missao}
                      <span className="text-xs text-muted-foreground font-normal">{missao.robo_nome}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Meta</TableHead>
                          <TableHead>Progresso</TableHead>
                          <TableHead>Periodicidade</TableHead>
                          <TableHead>Peso</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {metasList.map(meta => {
                          const perc = meta.valor_meta > 0 ? Math.round((meta.valor_atual / meta.valor_meta) * 100) : 0;
                          return (
                            <TableRow key={meta.id}>
                              <TableCell className="font-medium">{meta.nome_meta}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${perc >= 100 ? "bg-green-500" : perc >= 50 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${Math.min(100, perc)}%` }} />
                                  </div>
                                  <span className="text-xs">{meta.valor_atual}/{meta.valor_meta} {meta.unidade}</span>
                                  <span className="text-xs font-bold">{perc}%</span>
                                </div>
                              </TableCell>
                              <TableCell>{PERIODICIDADE_LABELS[meta.periodicidade]}</TableCell>
                              <TableCell>{meta.peso}</TableCell>
                              <TableCell><StatusBadge status={meta.status} tipo="meta" /></TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => openEditarMeta(meta)}><Edit3 className="h-3 w-3" /></Button>
                                  <Button variant="ghost" size="sm" onClick={() => {
                                    const novo = prompt(`Novo valor de "${meta.nome_meta}" (atual: ${meta.valor_atual}):`, String(meta.valor_atual));
                                    if (novo !== null) atualizarValorMeta(meta.id, Number(novo));
                                  }}><Play className="h-3 w-3" /></Button>
                                  <Button variant="ghost" size="sm" onClick={() => deletarMeta(meta.id)}><Trash2 className="h-3 w-3" /></Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })}
            {metas.length === 0 && (
              <p className="text-muted-foreground text-center py-8">Nenhuma meta cadastrada</p>
            )}
          </div>
        </TabsContent>

        {/* ==================== AGENDA ==================== */}
        <TabsContent value="agenda" className="mt-6">
          <div className="mb-4">
            <Select onValueChange={v => loadAgenda(v)} value={agenda[0]?.robo_id || ""}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Selecione um robô..." />
              </SelectTrigger>
              <SelectContent>
                {robos.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.nome} ({r.setor})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {agenda.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agenda.map(dia => (
                <Card key={dia.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{DIAS_LABELS[dia.dia_semana]}</CardTitle>
                      <Badge variant={dia.ativo ? "default" : "secondary"}>{dia.ativo ? "Ativo" : "Inativo"}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {dia.atividades.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma atividade</p>
                    ) : (
                      <div className="space-y-2">
                        {dia.atividades.map(ativ => (
                          <div key={ativ.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                            <div>
                              <span className="font-medium">{ativ.horario_inicio.slice(0, 5)}-{ativ.horario_fim.slice(0, 5)}</span>
                              <span className="ml-2">{TIPO_ATIVIDADE_LABELS[ativ.tipo_atividade]}: {ativ.descricao}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <PriorityBadge prioridade={ativ.prioridade} />
                              <Button variant="ghost" size="sm" onClick={() => deletarAtividade(ativ.id, ativ.robo_id)}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => openCriarAtividade(dia.id, dia.robo_id)}><Plus className="h-3 w-3 mr-1" />Atividade</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">Selecione um robô para ver a agenda</p>
          )}
        </TabsContent>

        {/* ==================== LIMITES ==================== */}
        <TabsContent value="limites" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <Select onValueChange={v => loadLimites(v || undefined)}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Filtrar por robô..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os robôs</SelectItem>
                {robos.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => {
              setEditLimite(null);
              setFormLimite({ robo_id: robos[0]?.id || "", acao_tipo: "", limite_quantidade: 0, periodo: "diario", horario_permitido_inicio: "00:00", horario_permitido_fim: "23:59", limite_financeiro: 0, alerta_quando_atingir: 80 });
              setLimiteDialogOpen(true);
            }}><Plus className="mr-2 h-4 w-4" />Novo Limite</Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Robô</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Limite</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Financeiro</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {limites.map(l => (
                <TableRow key={l.id}>
                  <TableCell>{robos.find(r => r.id === l.robo_id)?.nome || l.robo_id}</TableCell>
                  <TableCell className="font-medium">{l.acao_tipo}</TableCell>
                  <TableCell>{l.limite_quantidade}/{l.periodo}</TableCell>
                  <TableCell>{l.periodo}</TableCell>
                  <TableCell>{l.horario_permitido_inicio.slice(0, 5)}-{l.horario_permitido_fim.slice(0, 5)}</TableCell>
                  <TableCell>{l.limite_financeiro ? `R$ ${l.limite_financeiro}` : "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => {
                        setEditLimite(l);
                        setFormLimite({
                          robo_id: l.robo_id, acao_tipo: l.acao_tipo, limite_quantidade: l.limite_quantidade,
                          periodo: l.periodo, horario_permitido_inicio: l.horario_permitido_inicio.slice(0, 5),
                          horario_permitido_fim: l.horario_permitido_fim.slice(0, 5),
                          limite_financeiro: l.limite_financeiro || 0, alerta_quando_atingir: l.alerta_quando_atingir,
                        });
                        setLimiteDialogOpen(true);
                      }}><Edit3 className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="sm" onClick={async () => {
                        if (!confirm("Excluir limite?")) return;
                        await gestaoFuncionariosService.deletarLimite(l.id);
                        loadLimites();
                        toast.success("Limite excluído");
                      }}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {limites.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum limite configurado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        {/* ==================== DESEMPENHO ==================== */}
        <TabsContent value="desempenho" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Desempenho dos Funcionários Digitais</h3>
            <Button variant="outline" onClick={() => { loadDesempenho(); loadData(); }}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {missoes.length > 0 && (
              <>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Missões Ativas</CardTitle></CardHeader>
                  <CardContent><p className="text-3xl font-bold text-blue-600">{missoes.filter(m => m.status === "ativa").length}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Missões Concluídas</CardTitle></CardHeader>
                  <CardContent><p className="text-3xl font-bold text-green-600">{missoes.filter(m => m.status === "concluida").length}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Metas Atingidas</CardTitle></CardHeader>
                  <CardContent><p className="text-3xl font-bold text-emerald-600">{metas.filter(m => m.status === "atingida").length}/{metas.length}</p></CardContent>
                </Card>
              </>
            )}
          </div>

          {desempenho.length > 0 && (
            <div className="space-y-3">
              {desempenho.map(d => (
                <Card key={d.robo_id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{d.robo_nome}</p>
                        <p className="text-xs text-muted-foreground">Tendência: {d.tendencia}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${d.desempenho >= 80 ? "text-green-600" : d.desempenho >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                            {d.desempenho}%
                          </p>
                        </div>
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${d.desempenho >= 80 ? "bg-green-500" : d.desempenho >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                            style={{ width: `${d.desempenho}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {desempenho.length === 0 && (
            <p className="text-muted-foreground text-center py-8">Configure missões e metas para ver o desempenho</p>
          )}

          {/* INDICADORES RECENTES */}
          {indicadores.length > 0 && (
            <Card className="mt-6">
              <CardHeader><CardTitle className="text-sm">Indicadores Recentes</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Meta</TableHead>
                      <TableHead>Planejado</TableHead>
                      <TableHead>Realizado</TableHead>
                      <TableHead>%</TableHead>
                      <TableHead>Tendência</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {indicadores.slice(0, 20).map(ind => (
                      <TableRow key={ind.id}>
                        <TableCell>{ind.meta_nome || ind.meta_id.slice(0, 8)}</TableCell>
                        <TableCell>{ind.valor_planejado}</TableCell>
                        <TableCell>{ind.valor_realizado}</TableCell>
                        <TableCell>
                          <span className={`font-bold ${ind.percentual_atingido >= 100 ? "text-green-600" : ind.percentual_atingido >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                            {ind.percentual_atingido}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={ind.tendencia === "crescente" ? "default" : ind.tendencia === "decrescente" ? "destructive" : "secondary"}>
                            {ind.tendencia}
                          </Badge>
                        </TableCell>
                        <TableCell>{fmtData(ind.data_apuracao)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ==================== DIALOG MISSÃO ==================== */}
      <Dialog open={missaoDialogOpen} onOpenChange={setMissaoDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editMissao ? "Editar" : "Nova"} Missão</DialogTitle>
            <DialogDescription>Defina a missão do funcionário digital</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Robô *</Label>
              <Select value={formMissao.robo_id} onValueChange={v => setFormMissao(p => ({ ...p, robo_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {robos.map(r => <SelectItem key={r.id} value={r.id}>{r.nome} ({r.setor})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome da Missão *</Label>
              <Input value={formMissao.nome_missao} onChange={e => setFormMissao(p => ({ ...p, nome_missao: e.target.value }))} placeholder="Ex: Prospecção de novos leads" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={formMissao.descricao} onChange={e => setFormMissao(p => ({ ...p, descricao: e.target.value }))} placeholder="Descreva a missão..." />
            </div>
            <div>
              <Label>Objetivo Estratégico</Label>
              <Textarea value={formMissao.objetivo_estrategico} onChange={e => setFormMissao(p => ({ ...p, objetivo_estrategico: e.target.value }))} placeholder="Ex: Aumentar base de clientes em 20%" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prioridade</Label>
                <Select value={formMissao.prioridade} onValueChange={v => setFormMissao(p => ({ ...p, prioridade: v as PrioridadeMissao }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORIDADE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={formMissao.status} onValueChange={v => setFormMissao(p => ({ ...p, status: v as StatusMissao }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_MISSAO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Início Vigência</Label>
                <Input type="date" value={formMissao.inicio_vigencia} onChange={e => setFormMissao(p => ({ ...p, inicio_vigencia: e.target.value }))} />
              </div>
              <div>
                <Label>Fim Vigência</Label>
                <Input type="date" value={formMissao.fim_vigencia} onChange={e => setFormMissao(p => ({ ...p, fim_vigencia: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMissaoDialogOpen(false)}>Cancelar</Button>
            <Button onClick={salvarMissao}><Save className="mr-2 h-4 w-4" />Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DIALOG META ==================== */}
      <Dialog open={metaDialogOpen} onOpenChange={setMetaDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editMeta ? "Editar" : "Nova"} Meta</DialogTitle>
            <DialogDescription>Defina metas mensuráveis para o funcionário digital</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Missão *</Label>
                <Select value={formMeta.missao_id} onValueChange={v => {
                  const missao = missoes.find(m => m.id === v);
                  setFormMeta(p => ({ ...p, missao_id: v, robo_id: missao?.robo_id || p.robo_id }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {missoes.map(m => <SelectItem key={m.id} value={m.id}>{m.nome_missao}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Robô</Label>
                <Input value={robos.find(r => r.id === formMeta.robo_id)?.nome || formMeta.robo_id} disabled />
              </div>
            </div>
            <div>
              <Label>Nome da Meta *</Label>
              <Input value={formMeta.nome_meta} onChange={e => setFormMeta(p => ({ ...p, nome_meta: e.target.value }))} placeholder="Ex: Novos leads por dia" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={formMeta.descricao} onChange={e => setFormMeta(p => ({ ...p, descricao: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Valor Meta *</Label>
                <Input type="number" value={formMeta.valor_meta} onChange={e => setFormMeta(p => ({ ...p, valor_meta: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Unidade</Label>
                <Input value={formMeta.unidade} onChange={e => setFormMeta(p => ({ ...p, unidade: e.target.value }))} placeholder="unidades" />
              </div>
              <div>
                <Label>Peso</Label>
                <Input type="number" step="0.1" value={formMeta.peso} onChange={e => setFormMeta(p => ({ ...p, peso: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Periodicidade</Label>
                <Select value={formMeta.periodicidade} onValueChange={v => setFormMeta(p => ({ ...p, periodicidade: v as PeriodicidadeMeta }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PERIODICIDADE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Input value={formMeta.tipo} onChange={e => setFormMeta(p => ({ ...p, tipo: e.target.value }))} placeholder="Ex: leads, vendas" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Início Referência</Label>
                <Input type="date" value={formMeta.data_referencia_inicio} onChange={e => setFormMeta(p => ({ ...p, data_referencia_inicio: e.target.value }))} />
              </div>
              <div>
                <Label>Fim Referência</Label>
                <Input type="date" value={formMeta.data_referencia_fim} onChange={e => setFormMeta(p => ({ ...p, data_referencia_fim: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMetaDialogOpen(false)}>Cancelar</Button>
            <Button onClick={salvarMeta}><Save className="mr-2 h-4 w-4" />Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DIALOG ATIVIDADE ==================== */}
      <Dialog open={atividadeDialogOpen} onOpenChange={setAtividadeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editAtividade ? "Editar" : "Nova"} Atividade</DialogTitle>
            <DialogDescription>Configure uma atividade na agenda de trabalho</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Descrição *</Label>
              <Input value={formAtividade.descricao} onChange={e => setFormAtividade(p => ({ ...p, descricao: e.target.value }))} placeholder="Ex: Procurar novos clientes" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Horário Início</Label>
                <Input type="time" value={formAtividade.horario_inicio} onChange={e => setFormAtividade(p => ({ ...p, horario_inicio: e.target.value }))} />
              </div>
              <div>
                <Label>Horário Fim</Label>
                <Input type="time" value={formAtividade.horario_fim} onChange={e => setFormAtividade(p => ({ ...p, horario_fim: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select value={formAtividade.tipo_atividade} onValueChange={v => setFormAtividade(p => ({ ...p, tipo_atividade: v as TipoAtividadeAgenda }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_ATIVIDADE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={formAtividade.prioridade} onValueChange={v => setFormAtividade(p => ({ ...p, prioridade: v as PrioridadeMissao }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORIDADE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAtividadeDialogOpen(false)}>Cancelar</Button>
            <Button onClick={salvarAtividade}><Save className="mr-2 h-4 w-4" />Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DIALOG LIMITE ==================== */}
      <Dialog open={limiteDialogOpen} onOpenChange={setLimiteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editLimite ? "Editar" : "Novo"} Limite Operacional</DialogTitle>
            <DialogDescription>Defina limites de operação para o funcionário digital</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Robô *</Label>
              <Select value={formLimite.robo_id} onValueChange={v => setFormLimite(p => ({ ...p, robo_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {robos.map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de Ação *</Label>
              <Select value={formLimite.acao_tipo} onValueChange={v => setFormLimite(p => ({ ...p, acao_tipo: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="enviar_email">Envio de E-mail</SelectItem>
                  <SelectItem value="enviar_whatsapp">Envio de WhatsApp</SelectItem>
                  <SelectItem value="ligacao">Ligação</SelectItem>
                  <SelectItem value="prospeccao">Prospecção</SelectItem>
                  <SelectItem value="cobranca">Cobrança</SelectItem>
                  <SelectItem value="relatorio">Relatório</SelectItem>
                  <SelectItem value="analise">Análise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Limite Quantidade *</Label>
                <Input type="number" value={formLimite.limite_quantidade} onChange={e => setFormLimite(p => ({ ...p, limite_quantidade: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Período</Label>
                <Select value={formLimite.periodo} onValueChange={v => setFormLimite(p => ({ ...p, periodo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diario">Diário</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Horário Permitido Início</Label>
                <Input type="time" value={formLimite.horario_permitido_inicio} onChange={e => setFormLimite(p => ({ ...p, horario_permitido_inicio: e.target.value }))} />
              </div>
              <div>
                <Label>Horário Permitido Fim</Label>
                <Input type="time" value={formLimite.horario_permitido_fim} onChange={e => setFormLimite(p => ({ ...p, horario_permitido_fim: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Limite Financeiro (R$)</Label>
                <Input type="number" step="0.01" value={formLimite.limite_financeiro} onChange={e => setFormLimite(p => ({ ...p, limite_financeiro: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Alerta em (%)</Label>
                <Input type="number" value={formLimite.alerta_quando_atingir} onChange={e => setFormLimite(p => ({ ...p, alerta_quando_atingir: Number(e.target.value) }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLimiteDialogOpen(false)}>Cancelar</Button>
            <Button onClick={salvarLimite}><Save className="mr-2 h-4 w-4" />Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
