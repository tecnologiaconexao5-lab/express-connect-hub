import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BrainCircuit, CheckCircle2, AlertTriangle,
  Settings2, Play, Pause, Save, RefreshCw,
  FileText, UserCheck, MessageSquare, BarChart3, Search,
  Shield, Ban, Bot, ListTodo, Logs, Edit3, Send, Zap,
  Building2, GraduationCap, Wrench, Plug, Target, Briefcase, Calendar,
  FileSearch, Activity, TrendingUp,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { centralIaService, type AutomacaoRobo, type IaTarefa, type IaAprovacao, type IaLogDecisao, type IaSetor, type ModoOperacao, type AutoTarefa, type AutoAprovacao, type AutoLog, type NivelAutonomia, type ModoAtualRobo, type AutomacaoInstrucao, type IaConhecimento, type StatusInstrucao, type AutomacaoRegraOperacao, type AutomacaoGatilho, type NivelRisco, type TipoAcaoGatilho, type PromptOperacionalRobo } from "@/services/centralIaService";
import { roboOperacionalService } from "@/services/centralIa/roboOperacionalService";
import { enviarWhatsAppHomologacao, mascararTelefone, validarWhatsAppHomologacao, telefoneEstaNaAllowlist } from "@/services/integrations/whatsappHomologService";
import { bibliotecaTreinamentoIaService, type TreinamentoArquivoIa, type StatusArquivoTreinamento } from "@/services/centralIa/bibliotecaTreinamentoService";
import { normalizeRobosState } from "@/services/ia/uiConsolidationService";
import { AuditoriaTab } from "@/components/ia/AuditoriaTab";
import { RotinasTab } from "@/components/ia/RotinasTab";
import { DiretorVirtualTab } from "@/components/ia/DiretorVirtualTab";
import { DiretorVirtualLiveTab } from "@/components/ia/DiretorVirtualLiveTab";
import { ComunicacaoRobosTab } from "@/components/ia/ComunicacaoRobosTab";
import { ConhecimentoCorporativoTab } from "@/components/ia/ConhecimentoCorporativoTab";
import { AcademyTab } from "@/components/ia/AcademyTab";
import { ProcessamentosTab } from "@/components/ia/ProcessamentosTab";
import { FerramentasTab } from "@/components/ia/FerramentasTab";
import { ConectoresTab } from "@/components/ia/ConectoresTab";
import { MissoesDesempenhoTab } from "@/components/ia/MissoesDesempenhoTab";
import { TrabalhoTab } from "@/components/ia/TrabalhoTab";
import { ProgressiveBlocksLoader } from "@/components/ui/ProgressiveBlocksLoader";
import ComercialIADashboard from "@/components/ia/ComercialIADashboard";
import ComercialIAConfigTab from "@/components/ia/ComercialIAConfigTab";
import { comercialIAWorker } from "@/services/ia/comercialIAWorker";
import { supabase } from "@/lib/supabase";
import { rotinasMotorService } from "@/services/ia/rotinasMotorService";
import { rotinasMotorWorker } from "@/services/ia/rotinasMotorWorker";
import { diretorVirtualLiveEngine } from "@/services/ia/diretorVirtualLiveEngine";
import { comunicacaoRobosWorker } from "@/services/ia/comunicacaoRobosWorker";

const MODO_LABELS: Record<ModoOperacao, string> = {
  manual: "Manual",
  assistido: "Assistido",
  automatico_seguro: "Automático Seguro",
};

const MODO_COLORS: Record<ModoOperacao, string> = {
  manual: "bg-yellow-100 text-yellow-800 border-yellow-300",
  assistido: "bg-blue-100 text-blue-800 border-blue-300",
  automatico_seguro: "bg-green-100 text-green-800 border-green-300",
};

const STATUS_COLORS: Record<string, string> = {
  ativo: "bg-green-100 text-green-800",
  inativo: "bg-gray-100 text-gray-500",
  pausado: "bg-yellow-100 text-yellow-800",
  erro: "bg-red-100 text-red-800",
  pendente: "bg-yellow-100 text-yellow-800",
  aprovado: "bg-green-100 text-green-800",
  rejeitado: "bg-red-100 text-red-800",
  assumido: "bg-blue-100 text-blue-800",
  em_execucao: "bg-blue-100 text-blue-800",
  aguardando_aprovacao: "bg-purple-100 text-purple-800",
  concluida: "bg-green-100 text-green-800",
  falhou: "bg-red-100 text-red-800",
  cancelada: "bg-gray-100 text-gray-500",
  editado: "bg-cyan-100 text-cyan-800",
  baixa: "bg-green-100 text-green-800",
  normal: "bg-blue-100 text-blue-800",
  alta: "bg-orange-100 text-orange-800",
  critica: "bg-red-100 text-red-800",
};

const ICONE_MAP: Record<string, React.ElementType> = {
  Bot: Bot, BotMessageSquare: MessageSquare, Truck: FileText,
  UserCheck: UserCheck, DollarSign: BarChart3, FileText: FileText,
  BellRing: AlertTriangle, Headphones: MessageSquare, Smartphone: Bot,
};

const SETOR_CORES: Record<string, string> = {
  Comercial: "#22c55e", Operacional: "#f59e0b", Recrutamento: "#a855f7",
  Financeiro: "#10b981", Fiscal: "#3b82f6", Monitoramento: "#ef4444",
  Cliente: "#06b6d4", "Prestador/Motorista": "#ec4899",
};

function fmtData(d: string | null | undefined) {
  if (!d) return "-";
  try { return new Date(d).toLocaleString("pt-BR"); } catch { return d; }
}

function ModoBadge({ modo }: { modo: ModoOperacao }) {
  return (
    <Badge variant="outline" className={MODO_COLORS[modo] || ""}>
      {MODO_LABELS[modo] || modo}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={STATUS_COLORS[status] || ""}>
      {status}
    </Badge>
  );
}

// ======================== F25E: GATILHOS E ALERTAS TAB ========================
function GatilhosTab({ roboId }: { roboId: string }) {
  const [gatilhos, setGatilhos] = useState<AutomacaoGatilho[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEvento, setFiltroEvento] = useState("all");
  const [filtroPrioridade, setFiltroPrioridade] = useState("all");
  const [editGatilho, setEditGatilho] = useState<Partial<AutomacaoGatilho> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [simulando, setSimulando] = useState<string | null>(null);
  const [resultadoSim, setResultadoSim] = useState<string | null>(null);

  function carregar() {
    setLoading(true);
    centralIaService.listarGatilhos({ robo_id: roboId }).then(setGatilhos).finally(() => setLoading(false));
  }

  useEffect(() => { carregar(); }, [roboId]);

  const eventos = [...new Set(gatilhos.map((g) => g.evento).filter(Boolean))] as string[];

  const filtrados = gatilhos.filter((g) => {
    if (filtroEvento !== "all" && g.evento !== filtroEvento) return false;
    if (filtroPrioridade !== "all" && g.prioridade !== filtroPrioridade) return false;
    return true;
  });

  async function criarGatilhoHandler() {
    setIsCreating(true);
    try {
      const novo = await centralIaService.criarGatilho({
        robo_id: roboId,
        nome: "",
        setor: "",
        evento: "",
        prioridade: "normal",
        tipo_acao: "criar_tarefa",
        nivel_risco: "medio",
      });
      if (novo) setEditGatilho(novo);
      carregar();
    } finally {
      setIsCreating(false);
    }
  }

  async function salvarGatilho() {
    if (!editGatilho) return;
    if (editGatilho.id) {
      await centralIaService.atualizarGatilho(editGatilho.id, editGatilho);
      toast.success("Gatilho atualizado");
    } else {
      await centralIaService.criarGatilho({
        ...editGatilho,
        robo_id: roboId,
      } as any);
      toast.success("Gatilho criado");
    }
    setEditGatilho(null);
    carregar();
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await centralIaService.toggleGatilho(id, ativo);
    toast.success(ativo ? "Gatilho ativado" : "Gatilho desativado");
    carregar();
  }

  async function simularDisparo(gatilhoId: string) {
    setSimulando(gatilhoId);
    setResultadoSim(null);
    try {
      const result = await centralIaService.simularDisparoGatilho(gatilhoId);
      setResultadoSim(result.resultado);
    } finally {
      setSimulando(null);
    }
  }

  if (loading) return <div className="text-center py-4 text-muted-foreground">Carregando gatilhos...</div>;

  return (
    <TabsContent value="gatilhos" className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Select value={filtroEvento} onValueChange={setFiltroEvento}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Todos eventos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos eventos</SelectItem>
              {eventos.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
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
        </div>
        <Button onClick={criarGatilhoHandler} disabled={isCreating} size="sm">
          <AlertTriangle className="mr-2 h-4 w-4" />Novo Gatilho
        </Button>
      </div>

      {resultadoSim && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-green-800">Resultado da Simulação</p>
                <pre className="text-[10px] mt-1 text-green-700 whitespace-pre-wrap">{resultadoSim}</pre>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setResultadoSim(null)}>X</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {editGatilho && (
        <Card className="border-blue-300">
          <CardHeader><CardTitle className="text-sm">{editGatilho.id ? "Editar Gatilho" : "Novo Gatilho"}</CardTitle></CardHeader>
          <CardContent className="space-y-3 max-h-[350px] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome *</Label>
                <Input value={editGatilho.nome || ""} onChange={(e) => setEditGatilho({ ...editGatilho, nome: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Evento *</Label>
                <Input value={editGatilho.evento || ""} onChange={(e) => setEditGatilho({ ...editGatilho, evento: e.target.value })} placeholder="Ex: os_criada, candidato_novo" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Setor</Label>
                <Input value={editGatilho.setor || ""} onChange={(e) => setEditGatilho({ ...editGatilho, setor: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prioridade</Label>
                <Select value={editGatilho.prioridade || "normal"} onValueChange={(v) => setEditGatilho({ ...editGatilho, prioridade: v })}>
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
            <div className="space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Textarea value={editGatilho.descricao || ""} onChange={(e) => setEditGatilho({ ...editGatilho, descricao: e.target.value })} className="min-h-[60px]" />
            </div>
            <div className="border-t pt-3">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">Ação e Segurança</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo de Ação</Label>
                  <Select value={editGatilho.tipo_acao || "criar_tarefa"} onValueChange={(v) => setEditGatilho({ ...editGatilho, tipo_acao: v as TipoAcaoGatilho })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="criar_tarefa">Criar Tarefa</SelectItem>
                      <SelectItem value="criar_aprovacao">Criar Aprovação</SelectItem>
                      <SelectItem value="criar_alerta">Criar Alerta</SelectItem>
                      <SelectItem value="acionar_humano">Acionar Humano</SelectItem>
                      <SelectItem value="executar_robo_simulado">Executar Robô Simulado</SelectItem>
                      <SelectItem value="notificar_setor">Notificar Setor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nível de Risco</Label>
                  <Select value={editGatilho.nivel_risco || "medio"} onValueChange={(v) => setEditGatilho({ ...editGatilho, nivel_risco: v as NivelRisco })}>
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
              <div className="space-y-2 mt-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={!!editGatilho.exige_aprovacao_humana}
                    onCheckedChange={(v) => setEditGatilho({ ...editGatilho, exige_aprovacao_humana: v })}
                  />
                  <Label className="text-xs">Exige Aprovação Humana</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={!!editGatilho.permite_execucao_automatica}
                    onCheckedChange={(v) => setEditGatilho({ ...editGatilho, permite_execucao_automatica: v })}
                  />
                  <Label className="text-xs">Permite Execução Automática</Label>
                </div>
              </div>
            </div>
            <div className="border-t pt-3">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">Condições (opcional)</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Região</Label>
                  <Input value={editGatilho.regiao || ""} onChange={(e) => setEditGatilho({ ...editGatilho, regiao: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Limite de Execuções</Label>
                  <Input type="number" min={0} value={editGatilho.limite_execucoes ?? ""} onChange={(e) => setEditGatilho({ ...editGatilho, limite_execucoes: e.target.value ? parseInt(e.target.value) : 0 })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="space-y-1">
                  <Label className="text-xs">Horário Início</Label>
                  <Input type="time" value={editGatilho.horario_inicio || ""} onChange={(e) => setEditGatilho({ ...editGatilho, horario_inicio: e.target.value || null })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Horário Fim</Label>
                  <Input type="time" value={editGatilho.horario_fim || ""} onChange={(e) => setEditGatilho({ ...editGatilho, horario_fim: e.target.value || null })} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setEditGatilho(null)}>Cancelar</Button>
              <Button size="sm" onClick={salvarGatilho}><Save className="mr-2 h-4 w-4" />Salvar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {filtrados.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">Nenhum gatilho cadastrado.</div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((gatilho) => (
            <Card key={gatilho.id} className={!gatilho.ativo ? "opacity-60" : ""}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{gatilho.nome}</span>
                      <Badge variant="outline" className="text-[10px]">{gatilho.evento}</Badge>
                      <Badge className={`text-[10px] ${
                        gatilho.prioridade === "critica" ? "bg-red-100 text-red-800" :
                        gatilho.prioridade === "alta" ? "bg-orange-100 text-orange-800" :
                        gatilho.prioridade === "normal" ? "bg-blue-100 text-blue-800" :
                        "bg-gray-100 text-gray-600"
                      }`}>{gatilho.prioridade}</Badge>
                      <Badge variant={gatilho.ativo ? "default" : "secondary"} className="text-[10px]">{gatilho.ativo ? "Ativo" : "Inativo"}</Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Ação: {gatilho.tipo_acao} | Risco: {gatilho.nivel_risco}
                      {gatilho.descricao ? ` | ${gatilho.descricao.slice(0, 100)}` : ""}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2 items-center">
                    <Button variant="ghost" size="sm" onClick={() => setEditGatilho(gatilho)}>
                      <Edit3 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => simularDisparo(gatilho.id)}
                      disabled={simulando === gatilho.id}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={gatilho.ativo ? "text-red-600" : "text-green-600"}
                      onClick={() => toggleAtivo(gatilho.id, !gatilho.ativo)}
                    >
                      {gatilho.ativo ? "Desativar" : "Ativar"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </TabsContent>
  );
}

// ======================== F25C: INSTRUÇÕES TAB ========================
function InstrucoesTab({ roboId }: { roboId: string }) {
  const [instrucoes, setInstrucoes] = useState<AutomacaoInstrucao[]>([]);
  const [loading, setLoading] = useState(true);
  const [editInstrucao, setEditInstrucao] = useState<AutomacaoInstrucao | null>(null);
  const [editando, setEditando] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  function carregar() {
    setLoading(true);
    centralIaService.listarInstrucoesRobo(roboId).then(setInstrucoes).finally(() => setLoading(false));
  }

  useEffect(() => { carregar(); }, [roboId]);

  const instrucaoAtiva = instrucoes.find((i) => i.ativo && i.status === "publicado");

  async function criarInstrucao() {
    setIsCreating(true);
    try {
      const nova = await centralIaService.criarInstrucaoRobo({ robo_id: roboId });
      if (nova) {
        setEditInstrucao(nova);
        setEditando(true);
        carregar();
      }
    } finally {
      setIsCreating(false);
    }
  }

  async function salvarRascunho() {
    if (!editInstrucao) return;
    await centralIaService.salvarRascunhoInstrucao(editInstrucao.id, {
      objetivo: editInstrucao.objetivo,
      tom_de_conversa: editInstrucao.tom_de_conversa,
      regras_fixas: editInstrucao.regras_fixas,
      perguntas_obrigatorias: editInstrucao.perguntas_obrigatorias,
      respostas_padrao: editInstrucao.respostas_padrao,
      limites_de_atuacao: editInstrucao.limites_de_atuacao,
      quando_chamar_humano: editInstrucao.quando_chamar_humano,
      proibicoes: editInstrucao.proibicoes,
      exemplos_de_conversa: editInstrucao.exemplos_de_conversa,
      instrucoes_completas: editInstrucao.instrucoes_completas,
    });
    toast.success("Rascunho salvo");
    carregar();
  }

  async function enviarRevisao(id: string) {
    await centralIaService.enviarInstrucaoParaRevisao(id);
    toast.success("Enviado para revisão");
    carregar();
  }

  async function publicar(id: string) {
    const result = await centralIaService.publicarInstrucao(id);
    if (result.sucesso) {
      toast.success("Instrução publicada com sucesso");
    } else {
      toast.error(`Publicação bloqueada: ${result.motivos?.join(", ")}`);
    }
    carregar();
  }

  async function arquivar(id: string) {
    await centralIaService.arquivarInstrucao(id);
    toast.success("Instrução arquivada");
    carregar();
  }

  async function duplicar(id: string) {
    const nova = await centralIaService.duplicarInstrucaoComoNovaVersao(roboId, id);
    if (nova) {
      toast.success(`Nova versão v${nova.versao} criada a partir da v${instrucoes.find(i => i.id === id)?.versao}`);
    }
    carregar();
  }

  if (loading) return <div className="text-center py-4 text-muted-foreground">Carregando instruções...</div>;

  const statusLabel: Record<string, string> = {
    rascunho: "Rascunho", em_revisao: "Em Revisão", publicado: "Publicado", arquivado: "Arquivado",
  };

  if (editando && editInstrucao) {
    return (
      <TabsContent value="instrucoes" className="space-y-4 mt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Editando v{editInstrucao.versao} — <span className={STATUS_COLORS[editInstrucao.status] || ""}>{statusLabel[editInstrucao.status] || editInstrucao.status}</span>
          </h3>
          <Button variant="ghost" size="sm" onClick={() => { setEditando(false); setEditInstrucao(null); }}>
            Voltar
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Objetivo</Label>
            <Textarea value={editInstrucao.objetivo || ""} onChange={(e) => setEditInstrucao({ ...editInstrucao, objetivo: e.target.value })} className="min-h-[60px]" />
          </div>
          <div className="space-y-2">
            <Label>Tom de Conversa</Label>
            <Select value={editInstrucao.tom_de_conversa || ""} onValueChange={(v) => setEditInstrucao({ ...editInstrucao, tom_de_conversa: v || null })}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="profissional">Profissional</SelectItem>
                <SelectItem value="formal">Formal</SelectItem>
                <SelectItem value="amigavel">Amigável</SelectItem>
                <SelectItem value="informal">Informal</SelectItem>
                <SelectItem value="tecnico">Técnico</SelectItem>
                <SelectItem value="consultivo">Consultivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Regras Fixas</Label>
            <Textarea value={editInstrucao.regras_fixas || ""} onChange={(e) => setEditInstrucao({ ...editInstrucao, regras_fixas: e.target.value })} className="min-h-[80px]" />
          </div>
          <div className="space-y-2">
            <Label>Perguntas Obrigatórias</Label>
            <Textarea value={editInstrucao.perguntas_obrigatorias || ""} onChange={(e) => setEditInstrucao({ ...editInstrucao, perguntas_obrigatorias: e.target.value })} className="min-h-[80px]" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Limites de Atuação</Label>
            <Textarea value={editInstrucao.limites_de_atuacao || ""} onChange={(e) => setEditInstrucao({ ...editInstrucao, limites_de_atuacao: e.target.value })} className="min-h-[60px]" />
          </div>
          <div className="space-y-2">
            <Label>Quando Chamar Humano (obrigatório)</Label>
            <Textarea value={editInstrucao.quando_chamar_humano || ""} onChange={(e) => setEditInstrucao({ ...editInstrucao, quando_chamar_humano: e.target.value })} className="min-h-[60px]" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Proibições (obrigatório)</Label>
            <Textarea value={editInstrucao.proibicoes || ""} onChange={(e) => setEditInstrucao({ ...editInstrucao, proibicoes: e.target.value })} className="min-h-[60px]" />
          </div>
          <div className="space-y-2">
            <Label>Respostas Padrão (JSON)</Label>
            <Textarea
              value={typeof editInstrucao.respostas_padrao === "string" ? editInstrucao.respostas_padrao : JSON.stringify(editInstrucao.respostas_padrao || [], null, 2)}
              onChange={(e) => {
                try { setEditInstrucao({ ...editInstrucao, respostas_padrao: JSON.parse(e.target.value) }); }
                catch { setEditInstrucao({ ...editInstrucao, respostas_padrao: e.target.value as unknown as unknown[] }); }
              }}
              className="min-h-[60px] font-mono text-xs"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Exemplos de Conversa (JSON)</Label>
          <Textarea
            value={typeof editInstrucao.exemplos_de_conversa === "string" ? editInstrucao.exemplos_de_conversa : JSON.stringify(editInstrucao.exemplos_de_conversa || [], null, 2)}
            onChange={(e) => {
              try { setEditInstrucao({ ...editInstrucao, exemplos_de_conversa: JSON.parse(e.target.value) }); }
              catch { setEditInstrucao({ ...editInstrucao, exemplos_de_conversa: e.target.value as unknown as unknown[] }); }
            }}
            className="min-h-[80px] font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>Instruções Completas</Label>
          <Textarea value={editInstrucao.instrucoes_completas || ""} onChange={(e) => setEditInstrucao({ ...editInstrucao, instrucoes_completas: e.target.value })} className="min-h-[100px]" />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => { setEditando(false); setEditInstrucao(null); }}>Cancelar</Button>
          {editInstrucao.status === "rascunho" && (
            <Button variant="secondary" onClick={() => enviarRevisao(editInstrucao.id)}>
              Enviar para Revisão
            </Button>
          )}
          {editInstrucao.status === "em_revisao" && (
            <Button onClick={() => publicar(editInstrucao.id)}>
              Publicar
            </Button>
          )}
          <Button onClick={salvarRascunho}><Save className="mr-2 h-4 w-4" />Salvar Rascunho</Button>
        </div>
      </TabsContent>
    );
  }

  return (
    <TabsContent value="instrucoes" className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div>
          {instrucaoAtiva && (
            <Badge className="bg-green-100 text-green-800">
              Versão ativa: v{instrucaoAtiva.versao}
            </Badge>
          )}
          {!instrucaoAtiva && (
            <span className="text-sm text-muted-foreground">Nenhuma instrução publicada</span>
          )}
        </div>
        <Button onClick={criarInstrucao} disabled={isCreating} size="sm">
          <FileText className="mr-2 h-4 w-4" />Nova Instrução
        </Button>
      </div>

      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
        Publicar uma nova versão substitui a instrução ativa anterior, mas mantém o histórico.
      </p>

      {instrucoes.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">Nenhuma instrução criada.</div>
      ) : (
        <div className="space-y-2">
          {instrucoes.map((inst) => (
            <Card key={inst.id} className={`${inst.ativo ? "border-green-400 bg-green-50/30" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold">v{inst.versao}</span>
                    <span className={STATUS_COLORS[inst.status] || ""}>
                      {statusLabel[inst.status] || inst.status}
                    </span>
                    {inst.ativo && <Badge className="bg-green-100 text-green-800">Ativa</Badge>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditInstrucao(inst); setEditando(true); }}>
                      <Edit3 className="h-3.5 w-3.5 mr-1" />Editar
                    </Button>
                    {inst.status === "rascunho" && (
                      <Button variant="ghost" size="sm" onClick={() => enviarRevisao(inst.id)}>
                        Revisão
                      </Button>
                    )}
                    {inst.status === "em_revisao" && (
                      <Button variant="ghost" size="sm" className="text-green-600" onClick={() => publicar(inst.id)}>
                        Publicar
                      </Button>
                    )}
                    {inst.status !== "arquivado" && inst.status !== "publicado" && (
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => arquivar(inst.id)}>
                        Arquivar
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => duplicar(inst.id)} title="Duplicar como nova versão">
                      Duplicar
                    </Button>
                  </div>
                </div>
                {inst.objetivo && <p className="text-xs text-muted-foreground mt-1">{inst.objetivo.slice(0, 200)}</p>}
                <div className="flex gap-2 mt-1">
                  {inst.quando_chamar_humano && <span className="text-[10px] text-muted-foreground">Tem quando_chamar_humano</span>}
                  {inst.proibicoes && <span className="text-[10px] text-muted-foreground">Tem proibições</span>}
                  {inst.publicado_em && <span className="text-[10px] text-muted-foreground">Publicado: {fmtData(inst.publicado_em)}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </TabsContent>
  );
}

// ======================== F25C: CONHECIMENTO TAB ========================
// ======================== F25D: REGRAS OPERACIONAIS TAB ========================
function RegrasOperacionaisTab({ roboId }: { roboId: string }) {
  const [regras, setRegras] = useState<AutomacaoRegraOperacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("all");
  const [editRegra, setEditRegra] = useState<Partial<AutomacaoRegraOperacao> | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  function carregar() {
    setLoading(true);
    centralIaService.listarRegrasOperacao({ robo_id: roboId }).then(setRegras).finally(() => setLoading(false));
  }

  useEffect(() => { carregar(); }, [roboId]);

  const filtrados = regras.filter((r) => {
    if (filtroStatus !== "all" && r.status !== filtroStatus) return false;
    return true;
  });

  async function criarRegra() {
    setIsCreating(true);
    try {
      const nova = await centralIaService.criarRegraOperacao({
        robo_id: roboId,
        nome_operacao: "",
        setor: "",
        status: "rascunho",
      });
      if (nova) setEditRegra(nova);
      carregar();
    } finally {
      setIsCreating(false);
    }
  }

  async function salvarRegra() {
    if (!editRegra) return;
    if (editRegra.id) {
      await centralIaService.atualizarRegraOperacao(editRegra.id, editRegra);
      toast.success("Regra atualizada");
    } else {
      await centralIaService.criarRegraOperacao({
        ...editRegra,
        robo_id: roboId,
      } as any);
      toast.success("Regra criada");
    }
    setEditRegra(null);
    carregar();
  }

  async function desativarRegra(id: string) {
    await centralIaService.desativarRegraOperacao(id);
    toast.success("Regra desativada");
    carregar();
  }

  if (loading) return <div className="text-center py-4 text-muted-foreground">Carregando regras...</div>;

  return (
    <TabsContent value="regras" className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Todos status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={criarRegra} disabled={isCreating} size="sm">
          <FileText className="mr-2 h-4 w-4" />Nova Regra
        </Button>
      </div>

      {editRegra && (
        <Card className="border-blue-300">
          <CardHeader><CardTitle className="text-sm">{editRegra.id ? "Editar Regra" : "Nova Regra"}</CardTitle></CardHeader>
          <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome da Operação *</Label>
                <Input value={editRegra.nome_operacao || ""} onChange={(e) => setEditRegra({ ...editRegra, nome_operacao: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Setor</Label>
                <Input value={editRegra.setor || ""} onChange={(e) => setEditRegra({ ...editRegra, setor: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tipo de Veículo</Label>
                <Input value={editRegra.tipo_veiculo || ""} onChange={(e) => setEditRegra({ ...editRegra, tipo_veiculo: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Capacidade</Label>
                <Input value={editRegra.capacidade || ""} onChange={(e) => setEditRegra({ ...editRegra, capacidade: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Local de Carregamento</Label>
                <Input value={editRegra.local_carregamento || ""} onChange={(e) => setEditRegra({ ...editRegra, local_carregamento: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cidade de Operação</Label>
                <Input value={editRegra.cidade_operacao || ""} onChange={(e) => setEditRegra({ ...editRegra, cidade_operacao: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Horário Início</Label>
                <Input type="time" value={editRegra.horario_inicio || ""} onChange={(e) => setEditRegra({ ...editRegra, horario_inicio: e.target.value || null })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Horário Fim</Label>
                <Input type="time" value={editRegra.horario_fim || ""} onChange={(e) => setEditRegra({ ...editRegra, horario_fim: e.target.value || null })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dias de Operação</Label>
              <Input value={editRegra.dias_operacao || ""} onChange={(e) => setEditRegra({ ...editRegra, dias_operacao: e.target.value })} placeholder="Ex: Seg-Sex, Sábado, etc." />
            </div>
            <div className="border-t pt-3">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">Dados Comerciais</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Valor da Operação (R$)</Label>
                  <Input type="number" step="0.01" min={0} value={editRegra.valor_operacao ?? ""} onChange={(e) => setEditRegra({ ...editRegra, valor_operacao: e.target.value ? parseFloat(e.target.value) : null as any })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Modelo de Pagamento</Label>
                  <Input value={editRegra.modelo_pagamento || ""} onChange={(e) => setEditRegra({ ...editRegra, modelo_pagamento: e.target.value })} placeholder="Ex: Quinzenal, 30 dias" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="space-y-1">
                  <Label className="text-xs">Km Incluso</Label>
                  <Input type="number" min={0} value={editRegra.km_incluso ?? ""} onChange={(e) => setEditRegra({ ...editRegra, km_incluso: e.target.value ? parseInt(e.target.value) : null as any })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor Km Excedente (R$)</Label>
                  <Input type="number" step="0.01" min={0} value={editRegra.valor_km_excedente ?? ""} onChange={(e) => setEditRegra({ ...editRegra, valor_km_excedente: e.target.value ? parseFloat(e.target.value) : null as any })} />
                </div>
              </div>
            </div>
            <div className="border-t pt-3">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">Regras do Processo</h4>
              <div className="space-y-1">
                <Label className="text-xs">Documentos Obrigatórios (separados por vírgula)</Label>
                <Input
                  value={(editRegra.documentos_obrigatorios || []).join(", ")}
                  onChange={(e) => setEditRegra({ ...editRegra, documentos_obrigatorios: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                  placeholder="Ex: CNH, CRLV, ANTT"
                />
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Switch
                  checked={!!editRegra.exige_treinamento}
                  onCheckedChange={(v) => setEditRegra({ ...editRegra, exige_treinamento: v })}
                />
                <Label className="text-xs">Exige Treinamento</Label>
              </div>
              <div className="space-y-1 mt-3">
                <Label className="text-xs">Critérios de Aprovação</Label>
                <Textarea value={editRegra.criterios_aprovacao || ""} onChange={(e) => setEditRegra({ ...editRegra, criterios_aprovacao: e.target.value })} className="min-h-[60px]" />
              </div>
              <div className="space-y-1 mt-3">
                <Label className="text-xs">Critérios de Reprovacão</Label>
                <Textarea value={editRegra.criterios_reprovacao || ""} onChange={(e) => setEditRegra({ ...editRegra, criterios_reprovacao: e.target.value })} className="min-h-[60px]" />
              </div>
              <div className="space-y-1 mt-3">
                <Label className="text-xs">Mensagem Inicial</Label>
                <Textarea value={editRegra.mensagem_inicial || ""} onChange={(e) => setEditRegra({ ...editRegra, mensagem_inicial: e.target.value })} className="min-h-[60px]" />
              </div>
            </div>
            <div className="border-t pt-3">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">Controle</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Validade Início</Label>
                  <Input type="date" value={editRegra.validade_inicio || ""} onChange={(e) => setEditRegra({ ...editRegra, validade_inicio: e.target.value || null })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Validade Fim</Label>
                  <Input type="date" value={editRegra.validade_fim || ""} onChange={(e) => setEditRegra({ ...editRegra, validade_fim: e.target.value || null })} />
                </div>
              </div>
              <div className="space-y-1 mt-3">
                <Label className="text-xs">Status</Label>
                <Select value={editRegra.status || "rascunho"} onValueChange={(v) => setEditRegra({ ...editRegra, status: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setEditRegra(null)}>Cancelar</Button>
              <Button size="sm" onClick={salvarRegra}><Save className="mr-2 h-4 w-4" />Salvar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {filtrados.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">Nenhuma regra operacional cadastrada.</div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((regra) => (
            <Card key={regra.id} className={`${regra.status === "inativo" ? "opacity-60" : ""} ${regra.status === "vencido" ? "border-red-200" : ""}`}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{regra.nome_operacao}</span>
                      <StatusBadge status={regra.status} />
                      {regra.setor && <Badge variant="outline" className="text-[10px]">{regra.setor}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      {regra.tipo_veiculo && <span>Veículo: {regra.tipo_veiculo} | </span>}
                      {regra.cidade_operacao && <span>Cidade: {regra.cidade_operacao} | </span>}
                      {regra.valor_operacao != null && <span>R$ {Number(regra.valor_operacao).toFixed(2)}</span>}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {regra.documentos_obrigatorios?.map((doc) => (
                        <Badge key={doc} variant="secondary" className="text-[9px]">{doc}</Badge>
                      ))}
                      {regra.exige_treinamento && <Badge variant="secondary" className="text-[9px] bg-orange-50">Treinamento</Badge>}
                    </div>
                    {regra.validade_fim && (
                      <span className="text-[10px] text-muted-foreground">Validade: {regra.validade_fim}</span>
                    )}
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditRegra(regra)}>
                      <Edit3 className="h-3 w-3" />
                    </Button>
                    {regra.status !== "inativo" && (
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => desativarRegra(regra.id)}>
                        Desativar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </TabsContent>
  );
}

function ConhecimentoTab({ roboId }: { roboId: string }) {
  const [itens, setItens] = useState<IaConhecimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState("all");
  const [filtroStatus, setFiltroStatus] = useState("all");
  const [editItem, setEditItem] = useState<Partial<IaConhecimento> | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  function carregar() {
    setLoading(true);
    centralIaService.listarConhecimentoRobo(roboId).then(setItens).finally(() => setLoading(false));
  }

  useEffect(() => { carregar(); }, [roboId]);

  const categorias = [...new Set(itens.map((i) => i.categoria).filter(Boolean))] as string[];

  const filtrados = itens.filter((i) => {
    if (filtroCategoria !== "all" && i.categoria !== filtroCategoria) return false;
    if (filtroStatus !== "all" && i.status !== filtroStatus) return false;
    return true;
  });

  async function criarItem() {
    setIsCreating(true);
    try {
      const novo = await centralIaService.criarConhecimento({
        robo_id: roboId,
        titulo: "",
        conteudo: "",
        categoria: "Operação",
        status: "rascunho",
      });
      if (novo) {
        setEditItem(novo);
      }
      carregar();
    } finally {
      setIsCreating(false);
    }
  }

  async function salvarItem() {
    if (!editItem) return;
    if (editItem.id) {
      await centralIaService.atualizarConhecimento(editItem.id, editItem);
      toast.success("Item atualizado");
    } else {
      await centralIaService.criarConhecimento({
        ...editItem,
        robo_id: roboId,
      } as { robo_id?: string; setor_id?: string; categoria?: string; titulo: string; conteudo: string; setor?: string; tags?: string[]; status?: string; validade_inicio?: string; validade_fim?: string });
      toast.success("Item criado");
    }
    setEditItem(null);
    carregar();
  }

  async function arquivarItem(id: string) {
    await centralIaService.arquivarConhecimento(id);
    toast.success("Item arquivado");
    carregar();
  }

  if (loading) return <div className="text-center py-4 text-muted-foreground">Carregando conhecimento...</div>;

  return (
    <TabsContent value="conhecimento" className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Todas categorias" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Todos status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={criarItem} disabled={isCreating} size="sm">
          <FileText className="mr-2 h-4 w-4" />Novo Item
        </Button>
      </div>

      {editItem && (
        <Card className="border-blue-300">
          <CardHeader><CardTitle className="text-sm">{editItem.id ? "Editar Item" : "Novo Item"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Título</Label>
                <Input value={editItem.titulo || ""} onChange={(e) => setEditItem({ ...editItem, titulo: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Categoria</Label>
                <Select value={editItem.categoria || ""} onValueChange={(v) => setEditItem({ ...editItem, categoria: v || null })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {["Operação", "Recrutamento", "Financeiro", "Fiscal", "Cliente", "Prestador", "Valores", "Documentos", "Treinamento", "Procedimentos", "Respostas padrão"].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Conteúdo</Label>
              <Textarea value={editItem.conteudo || ""} onChange={(e) => setEditItem({ ...editItem, conteudo: e.target.value })} className="min-h-[80px]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tags (separadas por vírgula)</Label>
                <Input
                  value={(editItem.tags || []).join(", ")}
                  onChange={(e) => setEditItem({ ...editItem, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={editItem.status || "ativo"} onValueChange={(v) => setEditItem({ ...editItem, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Validade Início</Label>
                <Input type="date" value={editItem.validade_inicio || ""} onChange={(e) => setEditItem({ ...editItem, validade_inicio: e.target.value || null })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Validade Fim</Label>
                <Input type="date" value={editItem.validade_fim || ""} onChange={(e) => setEditItem({ ...editItem, validade_fim: e.target.value || null })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setEditItem(null)}>Cancelar</Button>
              <Button size="sm" onClick={salvarItem}><Save className="mr-2 h-4 w-4" />Salvar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {filtrados.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">Nenhum item de conhecimento.</div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((item) => (
            <Card key={item.id} className={`${item.status === "inativo" ? "opacity-60" : ""} ${item.status === "vencido" ? "border-red-200" : ""}`}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{item.titulo}</span>
                      {item.categoria && <Badge variant="outline" className="text-[10px]">{item.categoria}</Badge>}
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{item.conteudo?.slice(0, 200)}</p>
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {item.tags.map((tag) => <Badge key={tag} variant="secondary" className="text-[9px]">{tag}</Badge>)}
                      </div>
                    )}
                    {item.robo_id && <span className="text-[10px] text-blue-600">Específico do robô</span>}
                    {!item.robo_id && <span className="text-[10px] text-muted-foreground ml-2">Geral do setor</span>}
                    {item.validade_fim && <span className="text-[10px] text-muted-foreground ml-2">Validade: {item.validade_fim}</span>}
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditItem(item)}>
                      <Edit3 className="h-3 w-3" />
                    </Button>
                    {item.status !== "inativo" && (
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => arquivarItem(item.id)}>
                        Arquivar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </TabsContent>
  );
}

// ======================== BIBLIOTECA DE ARQUIVOS (F25FA.3) ========================
function BibliotecaArquivosTab({ roboId }: { roboId: string }) {
  const [arquivos, setArquivos] = useState<TreinamentoArquivoIa[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [searchQuery, setSearchQuery] = useState("");

  function carregar() {
    setLoading(true);
    bibliotecaTreinamentoIaService.listarArquivos(roboId).then(setArquivos).finally(() => setLoading(false));
  }

  useEffect(() => { carregar(); }, [roboId]);

  const tipos = [...new Set(arquivos.map((a) => a.tipo_arquivo))];

  const filtrados = arquivos.filter((a) => {
    if (filtroTipo !== "todos" && a.tipo_arquivo !== filtroTipo) return false;
    if (filtroStatus !== "todos" && a.status !== filtroStatus) return false;
    if (searchQuery && !a.nome_original.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const result = await bibliotecaTreinamentoIaService.uploadArquivo(roboId, file, {
        categoria: "Treinamento",
        tags: ["treinamento", file.name.split(".").pop() || ""],
      });
      if (result) {
        toast.success(`Arquivo enviado: ${file.name}`);
        carregar();
      } else {
        toast.error("Erro ao enviar arquivo");
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string, nome: string) {
    if (!confirm(`Excluir "${nome}"?`)) return;
    await bibliotecaTreinamentoIaService.deletarArquivo(id);
    toast.success("Arquivo excluído");
    carregar();
  }

  async function handleToggleStatus(arquivo: TreinamentoArquivoIa) {
    const novoStatus: StatusArquivoTreinamento = arquivo.status === "ativo" ? "arquivado" : "ativo";
    await bibliotecaTreinamentoIaService.alterarStatus(arquivo.id, novoStatus);
    toast.success(`Arquivo ${novoStatus === "ativo" ? "ativado" : "arquivado"}`);
    carregar();
  }

  return (
    <TabsContent value="biblioteca" className="space-y-4 mt-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2">
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="arquivado">Arquivado</SelectItem>
              <SelectItem value="rascunho">Rascunho</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Buscar arquivo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-48 h-9"
          />
        </div>
        <div>
          <input
            type="file"
            id="upload-treinamento-ia"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = "";
            }}
          />
          <Button size="sm" disabled={uploading} onClick={() => document.getElementById("upload-treinamento-ia")?.click()}>
            {uploading ? "Enviando..." : "Upload Arquivo"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-4">
          <ProgressiveBlocksLoader size="normal" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">Nenhum arquivo de treinamento.</div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((arquivo) => (
            <Card key={arquivo.id} className={`${arquivo.status === "arquivado" ? "opacity-60" : ""}`}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                      <span className="text-xs font-semibold truncate">{arquivo.nome_original}</span>
                      <Badge variant="outline" className="text-[10px]">{arquivo.tipo_arquivo}</Badge>
                      <StatusBadge status={arquivo.status} />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1 space-x-2">
                      <span>{(arquivo.tamanho_bytes / 1024).toFixed(1)} KB</span>
                      <span>v{arquivo.versao}</span>
                      {arquivo.categoria && <span>{arquivo.categoria}</span>}
                      {arquivo.validade_fim && <span>Val: {arquivo.validade_fim}</span>}
                    </div>
                    {arquivo.tags.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {arquivo.tags.map((tag) => <Badge key={tag} variant="secondary" className="text-[9px]">{tag}</Badge>)}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 ml-2 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => {
                      bibliotecaTreinamentoIaService.getPublicUrl(arquivo.caminho_storage).then((url) => {
                        window.open(url, "_blank");
                      });
                    }}>
                      Abrir
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(arquivo)}>
                      {arquivo.status === "ativo" ? "Arquivar" : "Ativar"}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(arquivo.id, arquivo.nome_original)}>
                      Excluir
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </TabsContent>
  );
}

// ======================== TAB ROBÔS ========================
function TabRobos() {
  const [robos, setRobos] = useState<AutomacaoRobo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editRobo, setEditRobo] = useState<AutomacaoRobo | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<string | null>(null);
  const [prodAssistidaLoading, setProdAssistidaLoading] = useState(false);
  const [prodAssistidaResult, setProdAssistidaResult] = useState<string | null>(null);
  const [duplicatasInfo, setDuplicatasInfo] = useState<string | null>(null);

  useEffect(() => {
    centralIaService.listarRobos().then((lista) => {
      const normalizados = normalizeRobosState(lista);
      if (normalizados.length < lista.length) {
        setDuplicatasInfo(`${lista.length - normalizados.length} duplicata(s) de robô removida(s) visualmente`);
      }
      setRobos(normalizados);
    }).finally(() => setLoading(false));
  }, []);

  async function toggleStatus(r: AutomacaoRobo) {
    const novo = r.status === "ativo" ? "pausado" : "ativo";
    await centralIaService.atualizarStatusRobo(r.id, novo);
    setRobos((prev) => prev.map((p) => (p.id === r.id ? { ...p, status: novo as AutomacaoRobo["status"] } : p)));
    toast.success(`Robô ${r.nome} ${novo === "ativo" ? "ativado" : "pausado"}`);
  }

  async function changeMode(r: AutomacaoRobo, modo: ModoOperacao) {
    await centralIaService.atualizarModoRobo(r.id, modo);
    setRobos((prev) => prev.map((p) => (p.id === r.id ? { ...p, modo } : p)));
    toast.success(`Modo de ${r.nome} alterado para ${MODO_LABELS[modo]}`);
  }

  async function salvarRobo() {
    if (!editRobo) return;
    await centralIaService.salvarRobo(editRobo);
    const lista = await centralIaService.listarRobos();
    setRobos(lista);
    setEditRobo(null);
    toast.success("Robô salvo");
  }

  async function executarDryRun() {
    setDryRunLoading(true);
    setDryRunResult(null);
    try {
      const result = await roboOperacionalService.executarRoboOperacionalDryRun();
      setDryRunResult(result.resumo);
      toast.success(`Dry-run concluído: ${result.totalTarefas} tarefas, ${result.totalAprovacoes} aprovações`);
    } catch (err) {
      toast.error("Erro ao executar dry-run");
      console.error(err);
    } finally {
      setDryRunLoading(false);
    }
  }

  async function executarProducaoAssistida() {
    setProdAssistidaLoading(true);
    setProdAssistidaResult(null);
    try {
      const result = await roboOperacionalService.executarRoboProducaoAssistida();
      setProdAssistidaResult(result.resumo);
      toast.success(`Produção assistida: ${result.totalEnviados} enviados, ${result.totalBloqueados} bloqueados`);
    } catch (err) {
      toast.error("Erro ao executar produção assistida");
      console.error(err);
    } finally {
      setProdAssistidaLoading(false);
    }
  }

  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando robôs...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Robôs Digitais por Setor</h2>
          <p className="text-sm text-muted-foreground">Funcionários automatizados com modo manual, assistido ou automático seguro</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={executarDryRun} disabled={dryRunLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${dryRunLoading ? "animate-spin" : ""}`} />
            {dryRunLoading ? "Executando..." : "Executar Dry-Run"}
          </Button>
          <Button variant="default" onClick={executarProducaoAssistida} disabled={prodAssistidaLoading} className="bg-amber-600 hover:bg-amber-700">
            <Send className={`mr-2 h-4 w-4 ${prodAssistidaLoading ? "animate-spin" : ""}`} />
            {prodAssistidaLoading ? "Executando..." : "Produção Assistida"}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditRobo({
                id: "", nome: "", descricao: "", setor: "Operacional", icone: "Bot", cor: "#6366f1",
                modo: "assistido", status: "inativo", acoes_permitidas: [], acoes_bloqueadas: [],
                precisa_aprovacao: [], mensagem_fallback: "Vou direcionar para o responsável pelo setor e já retorno com uma posição.",
                ultima_execucao: null, total_execucoes: 0, total_erros: 0, config: {}, ativo: true,
                criado_em: "", atualizado_em: "",
                canal_principal: "interno", nivel_autonomia: "manual", responsavel_humano_id: null,
                modo_atual: "seguro", setor_responsavel: null, permite_envio_externo: false,
                exige_aprovacao_humana: true, limite_mensagens_dia: 0, horario_inicio: null,
                horario_fim: null, tom_conversa: null, instrucoes_resumo: null,
              } as AutomacaoRobo); setDialogOpen(true); }}><Bot className="mr-2 h-4 w-4" />Novo Robô</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editRobo?.id ? `Configuração: ${editRobo.nome}` : "Novo Robô"}</DialogTitle></DialogHeader>
              {editRobo && (
                <Tabs defaultValue="config" className="mt-4">
                  <TabsList>
                    <TabsTrigger value="config">Configuração</TabsTrigger>
                    {editRobo.id && <TabsTrigger value="instrucoes">Instruções</TabsTrigger>}
                    {editRobo.id && <TabsTrigger value="conhecimento">Base de Conhecimento</TabsTrigger>}
                    {editRobo.id && <TabsTrigger value="regras">Regras Operacionais</TabsTrigger>}
                    {editRobo.id && <TabsTrigger value="gatilhos">Gatilhos e Alertas</TabsTrigger>}
                    {editRobo.id && <TabsTrigger value="biblioteca">Biblioteca</TabsTrigger>}
                    {editRobo.id && <TabsTrigger value="rotinas">Rotinas</TabsTrigger>}
                  </TabsList>

                  <TabsContent value="config" className="space-y-6 mt-4">
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Informações Básicas</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nome</Label>
                          <Input value={editRobo.nome} onChange={(e) => setEditRobo({ ...editRobo, nome: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Setor</Label>
                          <Select value={editRobo.setor} onValueChange={(v) => setEditRobo({ ...editRobo, setor: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.keys(SETOR_CORES).map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Descrição</Label>
                        <Textarea value={editRobo.descricao || ""} onChange={(e) => setEditRobo({ ...editRobo, descricao: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Mensagem de Fallback (obrigatório)</Label>
                        <Textarea value={editRobo.mensagem_fallback} onChange={(e) => setEditRobo({ ...editRobo, mensagem_fallback: e.target.value })} />
                      </div>
                    </div>

                    <div className="border-t pt-4 space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Modo e Autonomia</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Modo Atual</Label>
                          <Select value={editRobo.modo_atual || "seguro"} onValueChange={(v) => setEditRobo({ ...editRobo, modo_atual: v as ModoAtualRobo })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="seguro">Seguro (apenas simulação)</SelectItem>
                              <SelectItem value="homologacao">Homologação (allowlist)</SelectItem>
                              <SelectItem value="producao_assistida">Produção Assistida</SelectItem>
                              <SelectItem value="producao">Produção</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Nível de Autonomia</Label>
                          <Select value={editRobo.nivel_autonomia || "manual"} onValueChange={(v) => setEditRobo({ ...editRobo, nivel_autonomia: v as NivelAutonomia })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="manual">Manual — Tudo precisa de humano</SelectItem>
                              <SelectItem value="assistido">Assistido — IA sugere, humano aprova</SelectItem>
                              <SelectItem value="automatico_seguro">Automático Seguro — Ações seguras automáticas</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Canal Principal</Label>
                          <Select value={editRobo.canal_principal || "interno"} onValueChange={(v) => setEditRobo({ ...editRobo, canal_principal: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="interno">Interno (painel TMS)</SelectItem>
                              <SelectItem value="whatsapp">WhatsApp</SelectItem>
                              <SelectItem value="email">E-mail</SelectItem>
                              <SelectItem value="whatsapp_email">WhatsApp + E-mail</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Setor Responsável</Label>
                          <Select value={editRobo.setor_responsavel || "mesmo_setor"} onValueChange={(v) => setEditRobo({ ...editRobo, setor_responsavel: v === "mesmo_setor" ? null : v })}>
                            <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="mesmo_setor">Mesmo setor do robô</SelectItem>
                              {Object.keys(SETOR_CORES).map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4 space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Segurança e Limites</h3>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Permite Envio Externo</Label>
                          <p className="text-xs text-muted-foreground">Se desligado, nenhum envio externo é executado</p>
                        </div>
                        <Switch
                          checked={!!editRobo.permite_envio_externo}
                          onCheckedChange={(v) => setEditRobo({ ...editRobo, permite_envio_externo: v })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Exige Aprovação Humana</Label>
                          <p className="text-xs text-muted-foreground">Toda mensagem externa precisa de aprovação</p>
                        </div>
                        <Switch
                          checked={!!editRobo.exige_aprovacao_humana}
                          onCheckedChange={(v) => setEditRobo({ ...editRobo, exige_aprovacao_humana: v })}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Limite de Mensagens/Dia</Label>
                          <Input
                            type="number"
                            min={0}
                            value={editRobo.limite_mensagens_dia || 0}
                            onChange={(e) => setEditRobo({ ...editRobo, limite_mensagens_dia: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Horário Início</Label>
                          <Input
                            type="time"
                            value={editRobo.horario_inicio || ""}
                            onChange={(e) => setEditRobo({ ...editRobo, horario_inicio: e.target.value || null })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Horário Fim</Label>
                          <Input
                            type="time"
                            value={editRobo.horario_fim || ""}
                            onChange={(e) => setEditRobo({ ...editRobo, horario_fim: e.target.value || null })}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4 space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Personalidade e Instruções</h3>
                      <div className="space-y-2">
                        <Label>Tom de Conversa</Label>
                        <Select value={editRobo.tom_conversa || ""} onValueChange={(v) => setEditRobo({ ...editRobo, tom_conversa: v || null })}>
                          <SelectTrigger><SelectValue placeholder="Selecionar tom..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="profissional">Profissional</SelectItem>
                            <SelectItem value="formal">Formal</SelectItem>
                            <SelectItem value="amigavel">Amigável</SelectItem>
                            <SelectItem value="informal">Informal</SelectItem>
                            <SelectItem value="tecnico">Técnico</SelectItem>
                            <SelectItem value="consultivo">Consultivo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Instruções Resumidas</Label>
                        <Textarea
                          value={editRobo.instrucoes_resumo || ""}
                          onChange={(e) => setEditRobo({ ...editRobo, instrucoes_resumo: e.target.value })}
                          placeholder="Descreva resumidamente o objetivo e regras principais deste robô..."
                          className="min-h-[80px]"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <Button variant="outline" onClick={() => { setEditRobo(null); setDialogOpen(false); }}>Cancelar</Button>
                      <Button onClick={salvarRobo}><Save className="mr-2 h-4 w-4" />Salvar Configuração</Button>
                    </div>
                  </TabsContent>

                  {editRobo.id && <InstrucoesTab roboId={editRobo.id} />}
                  {editRobo.id && <ConhecimentoTab roboId={editRobo.id} />}
                  {editRobo.id && <RegrasOperacionaisTab roboId={editRobo.id} />}
                  {editRobo.id && <GatilhosTab roboId={editRobo.id} />}
                  {editRobo.id && <BibliotecaArquivosTab roboId={editRobo.id} />}
                  {editRobo.id && <RotinasTab roboId={editRobo.id} />}
                </Tabs>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
      {dryRunResult && (
        <Card>
          <CardHeader><CardTitle className="text-base">Resultado Dry-Run</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-xs whitespace-pre-wrap font-mono bg-muted p-3 rounded">{dryRunResult}</pre>
          </CardContent>
        </Card>
      )}
      {prodAssistidaResult && (
        <Card className="border-amber-300">
          <CardHeader><CardTitle className="text-base">Resultado Produção Assistida</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-xs whitespace-pre-wrap font-mono bg-muted p-3 rounded">{prodAssistidaResult}</pre>
          </CardContent>
        </Card>
      )}
      {duplicatasInfo && (
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="py-2 text-sm text-orange-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {duplicatasInfo}
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {robos.map((robo) => {
          const Icone = ICONE_MAP[robo.icone] || Bot;
          return (
            <Card key={robo.id} className="relative overflow-hidden flex flex-col">
              <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: robo.cor || SETOR_CORES[robo.setor] || "#6366f1" }} />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: `${robo.cor || SETOR_CORES[robo.setor] || "#6366f1"}20` }}>
                      <Icone className="h-5 w-5" style={{ color: robo.cor || SETOR_CORES[robo.setor] || "#6366f1" }} />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{robo.nome}</CardTitle>
                      <CardDescription className="line-clamp-2">{robo.descricao}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <StatusBadge status={robo.status} />
                    <Button variant="ghost" size="icon" onClick={() => { setEditRobo({ ...robo }); setDialogOpen(true); }} title="Configurar">
                      <Settings2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => toggleStatus(robo)} title={robo.status === "ativo" ? "Pausar" : "Ativar"}>
                      {robo.status === "ativo" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Modo</span>
                  <div className="flex items-center gap-2">
                    {robo.modo_atual && (
                      <Badge variant="outline" className={`text-[10px] ${
                        robo.modo_atual === "seguro" ? "bg-green-100 text-green-800 border-green-300" :
                        robo.modo_atual === "homologacao" ? "bg-amber-100 text-amber-800 border-amber-300" :
                        robo.modo_atual === "producao_assistida" ? "bg-purple-100 text-purple-800 border-purple-300" :
                        "bg-blue-100 text-blue-800 border-blue-300"
                      }`}>
                        {robo.modo_atual}
                      </Badge>
                    )}
                    <Select value={robo.modo} onValueChange={(v) => changeMode(robo, v as ModoOperacao)}>
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="assistido">Assistido</SelectItem>
                        <SelectItem value="automatico_seguro">Automático Seguro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {robo.nivel_autonomia && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Autonomia</span>
                    <span>{robo.nivel_autonomia}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Envio externo</span>
                  <Badge variant="outline" className={`text-[10px] ${robo.permite_envio_externo ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {robo.permite_envio_externo ? "Permitido" : "Bloqueado"}
                  </Badge>
                </div>
                {robo.exige_aprovacao_humana && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Aprovação humana</span>
                    <span className="text-amber-600">Obrigatória</span>
                  </div>
                )}
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex gap-4">
                    <span className="text-green-600">{robo.total_execucoes} execuções</span>
                    <span className="text-red-600">{robo.total_erros} erros</span>
                  </div>
                  {robo.ultima_execucao && <span>Última: {fmtData(robo.ultima_execucao)}</span>}
                </div>
              </CardContent>
              <CardFooter className="border-t pt-3 text-xs text-muted-foreground">
                <span className="italic line-clamp-2">"{robo.mensagem_fallback}"</span>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ======================== TAB TAREFAS ========================
function TabTarefas() {
  const [tarefas, setTarefas] = useState<AutoTarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroSetor, setFiltroSetor] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroPrioridade, setFiltroPrioridade] = useState("todos");

  function carregar() {
    setLoading(true);
    centralIaService.listarTarefas({
      setor: filtroSetor === "todos" ? undefined : filtroSetor,
      status: filtroStatus === "todos" ? undefined : filtroStatus as AutoTarefa["status"],
      prioridade: filtroPrioridade === "todos" ? undefined : filtroPrioridade,
    }).then(setTarefas).finally(() => setLoading(false));
  }

  useEffect(() => { carregar(); }, [filtroSetor, filtroStatus, filtroPrioridade]);

  async function cancelarTarefa(id: string) {
    await centralIaService.cancelarTarefa(id);
    carregar();
    toast.success("Tarefa cancelada");
  }

  async function reenfileirar(id: string) {
    await centralIaService.reenfileirarTarefa(id);
    carregar();
    toast.success("Tarefa reenfileirada");
  }

  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando tarefas...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Tarefas</h2>
          <p className="text-sm text-muted-foreground">Tarefas do fluxo de automação da Central IA</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Select value={filtroSetor} onValueChange={setFiltroSetor}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Todos setores" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos setores</SelectItem>
            <SelectItem value="Comercial">Comercial</SelectItem>
            <SelectItem value="Operacional">Operacional</SelectItem>
            <SelectItem value="Recrutamento">Recrutamento</SelectItem>
            <SelectItem value="Financeiro">Financeiro</SelectItem>
            <SelectItem value="Fiscal">Fiscal</SelectItem>
            <SelectItem value="Monitoramento">Monitoramento</SelectItem>
            <SelectItem value="Cliente">Cliente</SelectItem>
            <SelectItem value="Prestador">Prestador</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Todos status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="em_execucao">Em execução</SelectItem>
            <SelectItem value="aguardando_aprovacao">Aguardando aprovação</SelectItem>
            <SelectItem value="concluida">Concluída</SelectItem>
            <SelectItem value="falhou">Falhou</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Todas prioridades" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas prioridades</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="critica">Crítica</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={carregar}><RefreshCw className="mr-2 h-3 w-3" />Atualizar</Button>
      </div>
      {tarefas.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma tarefa encontrada.</CardContent></Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tentativas</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tarefas.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.titulo}</TableCell>
                <TableCell><Badge variant="outline">{t.setor}</Badge></TableCell>
                <TableCell>{t.tipo_tarefa}</TableCell>
                <TableCell><StatusBadge status={t.prioridade} /></TableCell>
                <TableCell><StatusBadge status={t.status} /></TableCell>
                <TableCell className="text-xs">{t.tentativas}/{t.max_tentativas}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {t.status !== "cancelada" && t.status !== "concluida" && (
                      <Button variant="ghost" size="sm" onClick={() => cancelarTarefa(t.id)} title="Cancelar">
                        <Ban className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                    {t.status === "falhou" || t.status === "cancelada" ? (
                      <Button variant="ghost" size="sm" onClick={() => reenfileirar(t.id)} title="Reenfileirar">
                        <RefreshCw className="h-4 w-4 text-blue-500" />
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ======================== TAB APROVAÇÕES ========================
function TabAprovacoes() {
  const [aprovacoes, setAprovacoes] = useState<AutoAprovacao[]>([]);
  const [filtro, setFiltro] = useState<string>("pendente");
  const [loading, setLoading] = useState(true);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editConteudo, setEditConteudo] = useState("");
  const [observacoes, setObservacoes] = useState<Record<string, string>>({});
  const [homologTelefone, setHomologTelefone] = useState<Record<string, string>>({});
  const [homologLoading, setHomologLoading] = useState<Record<string, boolean>>({});
  const [homologResult, setHomologResult] = useState<Record<string, string>>({});

  function carregar() {
    setLoading(true);
    centralIaService.listarAprovacoes({
      status: (filtro === "todas" ? undefined : filtro) as AutoAprovacao["status"] | undefined,
    }).then(setAprovacoes).finally(() => setLoading(false));
  }

  useEffect(() => { carregar(); }, [filtro]);

  async function aprovar(id: string) {
    await centralIaService.aprovarAprovacao(id);
    carregar();
    toast.success("Aprova\u00e7\u00e3o concedida");
  }

  async function rejeitar(id: string) {
    const obs = observacoes[id]?.trim();
    await centralIaService.rejeitarAprovacao(id, obs || undefined);
    setObservacoes(prev => { const next = { ...prev }; delete next[id]; return next; });
    carregar();
    toast.success("Aprova\u00e7\u00e3o rejeitada");
  }

  async function editarEAprovar(id: string) {
    try {
      const editado = JSON.parse(editConteudo);
      await centralIaService.editarAprovacao(id, editado);
      setEditandoId(null);
      setEditConteudo("");
      carregar();
      toast.success("Conte\u00fado editado e aprovado");
    } catch {
      toast.error("JSON inv\u00e1lido. Verifique o formato.");
    }
  }

  async function enviarWhatsAppHomolog(a: AutoAprovacao) {
    const telefone = homologTelefone[a.id]?.trim();
    if (!telefone) {
      toast.error("Informe o telefone de teste para envio.");
      return;
    }
    setHomologLoading((prev) => ({ ...prev, [a.id]: true }));
    setHomologResult((prev) => ({ ...prev, [a.id]: "" }));
    try {
      const mensagem = (a.conteudo_sugerido as Record<string, unknown>)?.mensagem as string || "";
      if (!mensagem) {
        setHomologResult((prev) => ({ ...prev, [a.id]: "Mensagem vazia no conte\u00fado sugerido." }));
        toast.error("Mensagem vazia");
        return;
      }
      const validation = validarWhatsAppHomologacao(telefone, mensagem);
      if (!validation.podeEnviar) {
        setHomologResult((prev) => ({
          ...prev,
          [a.id]: `BLOQUEADO: ${validation.motivo || "Motivo desconhecido"}`,
        }));
        toast.warning(validation.motivo || "Envio bloqueado");
        return;
      }
      const result = await enviarWhatsAppHomologacao({
        telefone,
        mensagem,
        setor: "Central IA",
        origem_tipo: "aprovacao",
        origem_id: a.id,
        aprovacao_id: a.id,
        tarefa_id: a.tarefa_id || "unknown",
        modo_homologacao: true,
      });
      if (result.sucesso) {
        setHomologResult((prev) => ({
          ...prev,
          [a.id]: `ENVIADO via homologa\u00e7\u00e3o. ID: ${result.provider_message_id || "sem ID"}`,
        }));
        toast.success("WhatsApp enviado em modo homologa\u00e7\u00e3o");
      } else {
        setHomologResult((prev) => ({
          ...prev,
          [a.id]: `FALHA: ${result.motivo || "Erro desconhecido"}`,
        }));
        toast.error(result.motivo || "Erro ao enviar");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setHomologResult((prev) => ({ ...prev, [a.id]: `ERRO: ${msg}` }));
      toast.error(msg);
    } finally {
      setHomologLoading((prev) => ({ ...prev, [a.id]: false }));
    }
  }

  const isTipoWhatsApp = (tipo: string) =>
    tipo === "mensagem_cliente" || tipo === "mensagem_prestador" || tipo === "resposta_reclamacao";

  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando aprova\u00e7\u00f5es...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Aprova\u00e7\u00f5es Humanas</h2>
          <p className="text-sm text-muted-foreground">A\u00e7\u00f5es sens\u00edveis que precisam de aprova\u00e7\u00e3o antes de executar</p>
        </div>
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="aprovado">Aprovadas</SelectItem>
            <SelectItem value="rejeitado">Rejeitadas</SelectItem>
            <SelectItem value="editado">Editadas</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {aprovacoes.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma aprova\u00e7\u00e3o encontrada.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {aprovacoes.map((a) => (
            <Card key={a.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {a.tipo_aprovacao.replace(/_/g, " ")}
                    </CardTitle>
                    <CardDescription>
                      <Badge variant="outline" className="mr-2">{fmtData(a.criado_em)}</Badge>
                      {a.aprovado_por && <span className="text-xs">por {a.aprovado_por}</span>}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={a.status} />
                    {isTipoWhatsApp(a.tipo_aprovacao) && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">WhatsApp</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-3 space-y-2">
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Conte\u00fado sugerido:</span>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40 mt-1">
                    {JSON.stringify(a.conteudo_sugerido, null, 2)}
                  </pre>
                </div>
                {a.conteudo_original && Object.keys(a.conteudo_original).length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Conte\u00fado original:</span>
                    <pre className="text-xs bg-muted/50 p-2 rounded overflow-auto max-h-32 mt-1">
                      {JSON.stringify(a.conteudo_original, null, 2)}
                    </pre>
                  </div>
                )}
                {a.observacao && (
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    Observa\u00e7\u00e3o: {a.observacao}
                  </div>
                )}
              </CardContent>
              {editandoId === a.id && (
                <CardContent className="pb-3 border-t pt-3 space-y-2">
                  <Label>Editar Conte\u00fado (JSON)</Label>
                  <Textarea
                    value={editConteudo}
                    onChange={(e) => setEditConteudo(e.target.value)}
                    className="text-xs font-mono min-h-[100px]"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => editarEAprovar(a.id)}>
                      <Save className="mr-2 h-4 w-4" />Salvar e Aprovar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditandoId(null); setEditConteudo(""); }}>
                      Cancelar
                    </Button>
                  </div>
                </CardContent>
              )}
              {a.status === "pendente" && editandoId !== a.id && (
                <CardFooter className="flex gap-2 flex-wrap">
                  <Button size="sm" onClick={() => aprovar(a.id)}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />Aprovar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    setEditandoId(a.id);
                    setEditConteudo(JSON.stringify(a.conteudo_sugerido, null, 2));
                  }}>
                    <Edit3 className="mr-2 h-4 w-4" />Editar
                  </Button>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Observa\u00e7\u00e3o (opcional)"
                      value={observacoes[a.id] || ""}
                      onChange={(e) => setObservacoes(prev => ({ ...prev, [a.id]: e.target.value }))}
                      className="w-48 text-xs"
                    />
                    <Button size="sm" variant="destructive" onClick={() => rejeitar(a.id)}>
                      <Ban className="mr-2 h-4 w-4" />Rejeitar
                    </Button>
                  </div>
                </CardFooter>
              )}
              {a.status === "aprovado" && isTipoWhatsApp(a.tipo_aprovacao) && (
                <CardFooter className="border-t pt-3 flex-col items-start gap-2">
                  <div className="flex items-end gap-2 w-full">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">Telefone de teste (allowlist)</Label>
                      <Input
                        placeholder="5511999999999"
                        value={homologTelefone[a.id] || ""}
                        onChange={(e) => setHomologTelefone((prev) => ({ ...prev, [a.id]: e.target.value }))}
                        className="text-xs"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => enviarWhatsAppHomolog(a)}
                      disabled={homologLoading[a.id]}
                    >
                      <MessageSquare className={`mr-2 h-4 w-4 ${homologLoading[a.id] ? "animate-spin" : ""}`} />
                      {homologLoading[a.id] ? "Enviando..." : "Enviar WhatsApp Homologa\u00e7\u00e3o"}
                    </Button>
                  </div>
                  {homologResult[a.id] && (
                    <div className={`text-xs p-2 rounded w-full ${
                      homologResult[a.id].startsWith("ENVIADO")
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : homologResult[a.id].startsWith("BLOQUEADO")
                        ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                    }`}>
                      {homologResult[a.id]}
                    </div>
                  )}
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ======================== TAB LOGS ========================
function TabLogs() {
  const [logs, setLogs] = useState<AutoLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroAcao, setFiltroAcao] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [busca, setBusca] = useState("");
  const [logExpandido, setLogExpandido] = useState<string | null>(null);

  function carregar() {
    setLoading(true);
    centralIaService.listarLogs({
      acao: filtroAcao === "todas" ? undefined : filtroAcao,
      status: filtroStatus === "todos" ? undefined : filtroStatus,
    }).then(setLogs).finally(() => setLoading(false));
  }

  useEffect(() => { carregar(); }, [filtroAcao, filtroStatus]);

  const logsFiltrados = logs.filter((l) =>
    !busca ||
    l.acao.toLowerCase().includes(busca.toLowerCase()) ||
    l.erro?.toLowerCase().includes(busca.toLowerCase()) ||
    JSON.stringify(l.entrada).toLowerCase().includes(busca.toLowerCase())
  );

  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando logs...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Logs de Automação</h2>
          <p className="text-sm text-muted-foreground">Histórico de ações executadas pelos robôs</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar nos logs..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
        </div>
        <Select value={filtroAcao} onValueChange={setFiltroAcao}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Todas ações" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas ações</SelectItem>
            <SelectItem value="tarefa_criada">Tarefa criada</SelectItem>
            <SelectItem value="tarefa_cancelada">Tarefa cancelada</SelectItem>
            <SelectItem value="tarefa_reenfileirada">Tarefa reenfileirada</SelectItem>
            <SelectItem value="aprovacao_criada">Aprovação criada</SelectItem>
            <SelectItem value="aprovacao_aprovada">Aprovação aprovada</SelectItem>
            <SelectItem value="aprovacao_rejeitada">Aprovação rejeitada</SelectItem>
            <SelectItem value="aprovacao_editada">Aprovação editada</SelectItem>
            <SelectItem value="mensagem_simulada">Mensagem simulada</SelectItem>
            <SelectItem value="whatsapp_homolog_bloqueado">WhatsApp homolog bloqueado</SelectItem>
            <SelectItem value="whatsapp_homolog_enviado">WhatsApp homolog enviado</SelectItem>
            <SelectItem value="whatsapp_homolog_erro">WhatsApp homolog erro</SelectItem>
            <SelectItem value="envio_direto_bloqueado">Envio direto bloqueado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="sucesso">Sucesso</SelectItem>
            <SelectItem value="erro">Erro</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="aviso">Aviso</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={carregar}><RefreshCw className="mr-2 h-3 w-3" />Atualizar</Button>
      </div>
      {logsFiltrados.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum log encontrado.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {logsFiltrados.slice(0, 100).map((l) => (
            <Card key={l.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setLogExpandido(logExpandido === l.id ? null : l.id)}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={l.status} />
                    <span className="text-xs font-mono text-muted-foreground">{fmtData(l.criado_em)}</span>
                    <span className="text-sm font-medium">{l.acao.replace(/_/g, " ")}</span>
                  </div>
                  {l.erro && <span className="text-xs text-red-500 truncate max-w-[200px]">{l.erro}</span>}
                </div>
                {logExpandido === l.id && (
                  <div className="mt-3 space-y-2 border-t pt-2 text-xs">
                    <div>
                      <span className="font-medium text-muted-foreground">Entrada:</span>
                      <pre className="bg-muted p-2 rounded overflow-auto max-h-32 mt-1">
                        {JSON.stringify(l.entrada, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">Saída:</span>
                      <pre className="bg-muted p-2 rounded overflow-auto max-h-32 mt-1">
                        {JSON.stringify(l.saida, null, 2)}
                      </pre>
                    </div>
                    {l.erro && (
                      <div>
                        <span className="font-medium text-red-500">Erro:</span>
                        <p className="text-red-500 mt-1">{l.erro}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ======================== TAB CONFIGURAÇÕES ========================
function RotinasOverview() {
  const [robos, setRobos] = useState<{ id: string; nome: string }[]>([]);
  const [selectedRobo, setSelectedRobo] = useState<string>("todos");
  const [stats, setStats] = useState({ total: 0, ativas: 0, executadasHoje: 0, falhasHoje: 0 });

  useEffect(() => {
    rotinasMotorService.listarRobosDisponiveis().then(setRobos);
    rotinasMotorService.obterEstatisticas().then(setStats);
  }, []);

  return (
    <div className="space-y-4 mt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />Rotinas dos Funcionários Digitais
          </h2>
          <p className="text-sm text-muted-foreground">
            Gerencie todas as rotinas operacionais — {stats.ativas} ativas de {stats.total} total, {stats.executadasHoje} executadas hoje
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedRobo} onValueChange={setSelectedRobo}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filtrar por robô" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os robôs</SelectItem>
              {robos.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {selectedRobo === "todos" ? (
        robos.map((r) => <RotinasTab key={r.id} roboId={r.id} />)
      ) : (
        <RotinasTab roboId={selectedRobo} />
      )}
    </div>
  );
}

function TabConfiguracoes() {
  const [setores, setSetores] = useState<IaSetor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modoGlobal, setModoGlobal] = useState<ModoOperacao>("assistido");

  useEffect(() => {
    centralIaService.listarSetores().then((data) => {
      setSetores(data);
      if (data.length > 0) setModoGlobal("assistido");
    }).finally(() => setLoading(false));
  }, []);

  async function updateModoSetor(id: string, modo: ModoOperacao) {
    await centralIaService.atualizarModoSetor(id, modo);
    setSetores((prev) => prev.map((s) => (s.id === id ? { ...s, modo_operacao: modo } : s)));
    toast.success("Modo do setor atualizado");
  }

  async function updateFallback(id: string, msg: string) {
    await centralIaService.atualizarFallbackSetor(id, msg);
    toast.success("Fallback atualizado");
  }

  if (loading) return <div className="text-center py-8"><ProgressiveBlocksLoader size="normal" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Configurações da Central IA</h2>
        <p className="text-sm text-muted-foreground">Modo de operação global e por setor, fallback e provedores</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Modo de Operação Global</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select value={modoGlobal} onValueChange={(v) => setModoGlobal(v as ModoOperacao)}>
              <SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual — Tudo precisa de humano</SelectItem>
                <SelectItem value="assistido">Assistido — IA sugere, humano aprova</SelectItem>
                <SelectItem value="automatico_seguro">Automático Seguro — Ações seguras automáticas</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline"><Save className="mr-2 h-4 w-4" />Aplicar a todos</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Modo por Setor</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Setor</TableHead>
                <TableHead>Modo</TableHead>
                <TableHead>Mensagem de Fallback</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {setores.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.nome}</TableCell>
                  <TableCell>
                    <Select
                      value={s.modo_operacao || "assistido"}
                      onValueChange={(v) => updateModoSetor(s.id, v as ModoOperacao)}
                    >
                      <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="assistido">Assistido</SelectItem>
                        <SelectItem value="automatico_seguro">Automático Seguro</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="flex items-center gap-2">
                      <Input
                        defaultValue={s.fallback_msg || "Vou direcionar para o responsável pelo setor e já retorno com uma posição."}
                        className="text-xs"
                        onBlur={(e) => updateFallback(s.id, e.target.value)}
                      />
                    </div>
                  </TableCell>
                  <TableCell><ModoBadge modo={s.modo_operacao || "assistido"} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Provedores de IA</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Chaves gerenciadas via Supabase Edge Function (proxy-ia) — backend seguro</p>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              { nome: "Groq (Llama/Mixtral)", modo: "Edge Function Secrets" },
              { nome: "Google Gemini", modo: "Edge Function Secrets" },
              { nome: "Anthropic Claude", modo: "Edge Function Secrets" },
              { nome: "OpenAI", modo: "Edge Function Secrets" },
              { nome: "OpenRouter", modo: "Edge Function Secrets" },
            ].map((p) => (
              <div key={p.nome} className="flex items-center justify-between p-3 border rounded-lg">
                <span className="text-sm font-medium">{p.nome}</span>
                <Badge variant="secondary" className="text-xs">{p.modo}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TabComercialIA() {
  const [roboId, setRoboId] = useState<string | null>(null);
  const workerStarted = useRef(false);

  useEffect(() => {
    supabase
      .from("automacoes_robos")
      .select("id")
      .eq("nome", "Comercial IA")
      .single()
      .then(({ data }) => {
        if (data?.id) {
          setRoboId(data.id);
          if (!workerStarted.current) {
            workerStarted.current = true;
            comercialIAWorker.iniciar();
          }
        }
      });
    return () => {
      if (workerStarted.current) {
        comercialIAWorker.parar();
        workerStarted.current = false;
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Comercial IA — Hunter SDR</h2>
          <p className="text-sm text-muted-foreground">
            Funcionário digital de prospecção comercial
          </p>
        </div>
      </div>
      <ComercialIADashboard roboId={roboId || undefined} />
    </div>
  );
}

// ======================== PÁGINA PRINCIPAL ========================
export default function CentralIA() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "robos";
  const handleTabChange = (val: string) => setSearchParams({ tab: val });
  const motorIniciado = useRef(false);

  useEffect(() => {
    if (motorIniciado.current) return;
    motorIniciado.current = true;
    rotinasMotorWorker.iniciar(15000);
    diretorVirtualLiveEngine.iniciar(30000);
    comunicacaoRobosWorker.iniciar(10000);
    return () => {
      rotinasMotorWorker.parar();
      diretorVirtualLiveEngine.parar();
      comunicacaoRobosWorker.parar();
      motorIniciado.current = false;
    };
  }, []);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BrainCircuit className="h-6 w-6 text-primary" />
            Central IA
          </h1>
          <p className="text-sm text-muted-foreground">
            Centro de controle dos funcionários digitais, automações e aprovações
          </p>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList className="flex-nowrap overflow-x-auto w-full gap-0">
          <TabsTrigger value="comercial-dashboard"><Activity className="mr-1 h-4 w-4 shrink-0" /><span className="whitespace-nowrap">Comercial IA</span></TabsTrigger>
          <TabsTrigger value="comercial-config"><TrendingUp className="mr-1 h-4 w-4 shrink-0" /><span className="whitespace-nowrap">Hunter Config</span></TabsTrigger>
          <TabsTrigger value="robos"><Bot className="mr-1 h-4 w-4 shrink-0" /><span className="whitespace-nowrap">Robôs</span></TabsTrigger>
          <TabsTrigger value="tarefas"><ListTodo className="mr-1 h-4 w-4 shrink-0" /><span className="whitespace-nowrap">Tarefas</span></TabsTrigger>
          <TabsTrigger value="aprovacoes"><Shield className="mr-1 h-4 w-4 shrink-0" /><span className="whitespace-nowrap">Aprovações</span></TabsTrigger>
          <TabsTrigger value="logs"><Logs className="mr-1 h-4 w-4 shrink-0" /><span className="whitespace-nowrap">Logs</span></TabsTrigger>
          <TabsTrigger value="diretor"><BrainCircuit className="mr-1 h-4 w-4 shrink-0" /><span className="whitespace-nowrap">Diretor Virtual</span></TabsTrigger>
          <TabsTrigger value="diretorlive"><Zap className="mr-1 h-4 w-4 shrink-0" /><span className="whitespace-nowrap">Live</span></TabsTrigger>
          <TabsTrigger value="comunicacao"><MessageSquare className="mr-1 h-4 w-4 shrink-0" /><span className="whitespace-nowrap">Comunicação</span></TabsTrigger>
          <TabsTrigger value="rotinas"><Calendar className="mr-1 h-4 w-4 shrink-0" /><span className="whitespace-nowrap">Rotinas</span></TabsTrigger>
          <TabsTrigger value="missoes"><Target className="mr-1 h-4 w-4 shrink-0" /><span className="whitespace-nowrap">Missões</span></TabsTrigger>
          <TabsTrigger value="trabalho"><Briefcase className="mr-1 h-4 w-4 shrink-0" /><span className="whitespace-nowrap">Trabalho</span></TabsTrigger>
          <TabsTrigger value="academia"><GraduationCap className="mr-1 h-4 w-4 shrink-0" /><span className="whitespace-nowrap">Academia</span></TabsTrigger>
          <TabsTrigger value="processamentos"><RefreshCw className="mr-1 h-4 w-4 shrink-0" /><span className="whitespace-nowrap">Processamentos</span></TabsTrigger>
          <TabsTrigger value="ferramentas"><Wrench className="mr-1 h-4 w-4 shrink-0" /><span className="whitespace-nowrap">Ferramentas</span></TabsTrigger>
          <TabsTrigger value="conectores"><Plug className="mr-1 h-4 w-4 shrink-0" /><span className="whitespace-nowrap">Conectores</span></TabsTrigger>
          <TabsTrigger value="corporativo"><Building2 className="mr-1 h-4 w-4 shrink-0" /><span className="whitespace-nowrap">Biblioteca</span></TabsTrigger>
          <TabsTrigger value="auditoria"><FileSearch className="mr-1 h-4 w-4 shrink-0" /><span className="whitespace-nowrap">Auditoria</span></TabsTrigger>
          <TabsTrigger value="config"><Settings2 className="mr-1 h-4 w-4 shrink-0" /><span className="whitespace-nowrap">Configurações</span></TabsTrigger>
        </TabsList>

        <TabsContent value="comercial-dashboard" className="mt-6">
          <TabComercialIA />
        </TabsContent>
        <TabsContent value="comercial-config" className="mt-6">
          <ComercialIAConfigTab onConfigChange={() => {}} />
        </TabsContent>
        <TabsContent value="robos" className="mt-6"><TabRobos /></TabsContent>
        <TabsContent value="tarefas" className="mt-6"><TabTarefas /></TabsContent>
        <TabsContent value="aprovacoes" className="mt-6"><TabAprovacoes /></TabsContent>
        <TabsContent value="logs" className="mt-6"><TabLogs /></TabsContent>
        <TabsContent value="diretor" className="mt-6"><DiretorVirtualTab /></TabsContent>
        <TabsContent value="diretorlive" className="mt-6"><DiretorVirtualLiveTab /></TabsContent>
        <TabsContent value="comunicacao" className="mt-6"><ComunicacaoRobosTab /></TabsContent>
        <TabsContent value="rotinas" className="mt-6">
          <RotinasOverview />
        </TabsContent>
        <TabsContent value="missoes" className="mt-6"><MissoesDesempenhoTab /></TabsContent>
        <TabsContent value="trabalho" className="mt-6"><TrabalhoTab /></TabsContent>
        <TabsContent value="academia" className="mt-6"><AcademyTab /></TabsContent>
        <TabsContent value="processamentos" className="mt-6"><ProcessamentosTab /></TabsContent>
        <TabsContent value="ferramentas" className="mt-6"><FerramentasTab /></TabsContent>
        <TabsContent value="conectores" className="mt-6"><ConectoresTab /></TabsContent>
        <TabsContent value="corporativo" className="mt-6"><ConhecimentoCorporativoTab /></TabsContent>
        <TabsContent value="auditoria" className="mt-6"><AuditoriaTab /></TabsContent>
        <TabsContent value="config" className="mt-6"><TabConfiguracoes /></TabsContent>
      </Tabs>
    </div>
  );
}
