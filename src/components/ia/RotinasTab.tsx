import { useState, useEffect, useCallback } from "react";
import {
  Calendar, Plus, Play, Pause, Trash2, RefreshCw, Clock,
  CheckCircle2, AlertCircle, Loader2, Eye, Pencil,
  Activity, BarChart3, GripVertical, ShieldCheck, UserCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { rotinasMotorService, type RotinaIA, type TipoRotina } from "@/services/ia/rotinasMotorService";
import { useRotinasWorker } from "@/services/ia/useRotinasWorker";

const DIAS_SEMANA = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

const PRIORIDADES = [
  { value: "baixa", label: "Baixa", color: "bg-gray-100 text-gray-700" },
  { value: "normal", label: "Normal", color: "bg-blue-100 text-blue-700" },
  { value: "alta", label: "Alta", color: "bg-orange-100 text-orange-700" },
  { value: "critica", label: "Crítica", color: "bg-red-100 text-red-700" },
];

const STATUS_ROTINA_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  running: "bg-blue-100 text-blue-800 border-blue-300",
  success: "bg-green-100 text-green-800 border-green-300",
  error: "bg-red-100 text-red-800 border-red-300",
  paused: "bg-gray-100 text-gray-500 border-gray-300",
};

const TIPO_LABELS: Record<TipoRotina, string> = {
  scheduled: "Agendado",
  interval: "Intervalo",
  event: "Evento",
  manual: "Manual",
};

const MOTOR_ESTADO_CORES: Record<string, string> = {
  inativo: "bg-gray-100 text-gray-600 border-gray-300",
  ativo: "bg-green-100 text-green-800 border-green-300",
  erro: "bg-red-100 text-red-800 border-red-300",
};

type FerramentaOption = { id: string; codigo_unico: string; nome: string; categoria: string };
type RoboOption = { id: string; nome: string };

function fmtData(d: string | null | undefined) {
  if (!d) return "-";
  try { return new Date(d).toLocaleString("pt-BR"); } catch { return d; }
}

function fmtTempoRestante(proxima: string | null): string {
  if (!proxima) return "-";
  try {
    const diff = new Date(proxima).getTime() - Date.now();
    if (diff <= 0) return "Agora";
    const seg = Math.floor(diff / 1000);
    if (seg < 60) return `${seg}s`;
    const min = Math.floor(seg / 60);
    if (min < 60) return `${min}min ${seg % 60}s`;
    return `${Math.floor(min / 60)}h ${min % 60}min`;
  } catch { return "-"; }
}

function getPrioridadeInfo(p: string) {
  return PRIORIDADES.find((x) => x.value === p) || PRIORIDADES[1];
}

interface RotinasTabProps {
  roboId: string;
}

export function RotinasTab({ roboId }: RotinasTabProps) {
  const [rotinas, setRotinas] = useState<RotinaIA[]>([]);
  const [loading, setLoading] = useState(true);
  const [ferramentas, setFerramentas] = useState<FerramentaOption[]>([]);
  const [robos, setRobos] = useState<RoboOption[]>([]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogData, setDialogData] = useState({
    nome: "", descricao: "", tipo: "interval" as TipoRotina,
    cron_expression: "", interval_seconds: 60,
    prioridade: "normal", aprovacao_necessaria: false,
    responsavel_id: "", ferramenta_id: "",
    dias_semana: [] as number[],
    config_ferramenta: "",
  });

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<RotinaIA | null>(null);

  // Executions
  const [execucoesAbertas, setExecucoesAbertas] = useState<Record<string, RotinaIA[]>>({});
  const [execLoading, setExecLoading] = useState<Record<string, boolean>>({});

  const [stats, setStats] = useState({ total: 0, ativas: 0, executadasHoje: 0, falhasHoje: 0 });

  const { status: motorStatus, executarCicloManual, forcarReinicio, resetarContadores } = useRotinasWorker();

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await rotinasMotorService.listarRotinas(roboId);
      setRotinas(data);
    } finally { setLoading(false); }
  }, [roboId]);

  const carregarAuxiliares = useCallback(async () => {
    try {
      const [fts, rs] = await Promise.all([
        rotinasMotorService.listarFerramentasDisponiveis(),
        rotinasMotorService.listarRobosDisponiveis(),
      ]);
      setFerramentas(fts);
      setRobos(rs);
    } catch { /* silent */ }
  }, []);

  const carregarStats = useCallback(async () => {
    try {
      const s = await rotinasMotorService.obterEstatisticas(roboId);
      setStats(s);
    } catch { /* silent */ }
  }, [roboId]);

  useEffect(() => { carregar(); carregarAuxiliares(); carregarStats(); }, [carregar, carregarAuxiliares, carregarStats]);

  useEffect(() => {
    const interval = setInterval(() => { carregar(); carregarStats(); }, 30000);
    return () => clearInterval(interval);
  }, [carregar, carregarStats]);

  function resetDialog() {
    setDialogData({
      nome: "", descricao: "", tipo: "interval",
      cron_expression: "", interval_seconds: 60,
      prioridade: "normal", aprovacao_necessaria: false,
      responsavel_id: "", ferramenta_id: "",
      dias_semana: [],
      config_ferramenta: "",
    });
    setEditingId(null);
  }

  function openEdit(rotina: RotinaIA) {
    setDialogData({
      nome: rotina.nome,
      descricao: rotina.descricao || "",
      tipo: rotina.tipo,
      cron_expression: rotina.cron_expression || "",
      interval_seconds: rotina.interval_seconds || 60,
      prioridade: rotina.prioridade || "normal",
      aprovacao_necessaria: rotina.aprovacao_necessaria || false,
      responsavel_id: rotina.responsavel_id || "",
      ferramenta_id: rotina.ferramenta_id || "",
      dias_semana: rotina.dias_semana || [],
      config_ferramenta: JSON.stringify((rotina.config || {}).parametros || {}, null, 2),
    });
    setEditingId(rotina.id);
    setDialogOpen(true);
  }

  function openCreate() {
    resetDialog();
    setDialogOpen(true);
  }

  async function salvarRotina() {
    if (!dialogData.nome) { toast.error("Nome é obrigatório"); return; }

    const config: Record<string, unknown> = {};
    if (dialogData.config_ferramenta) {
      try { config.parametros = JSON.parse(dialogData.config_ferramenta); }
      catch { toast.error("Parâmetros JSON inválidos"); return; }
    }

    const payload = {
      robo_id: roboId,
      nome: dialogData.nome,
      descricao: dialogData.descricao || undefined,
      tipo: dialogData.tipo,
      cron_expression: dialogData.tipo === "scheduled" ? dialogData.cron_expression || undefined : undefined,
      interval_seconds: dialogData.tipo === "interval" ? dialogData.interval_seconds || undefined : undefined,
      prioridade: dialogData.prioridade,
      aprovacao_necessaria: dialogData.aprovacao_necessaria,
      responsavel_id: dialogData.responsavel_id || undefined,
      ferramenta_id: dialogData.ferramenta_id || undefined,
      dias_semana: dialogData.dias_semana.length > 0 ? dialogData.dias_semana : undefined,
      config,
    };
    try {
      if (editingId) {
        await rotinasMotorService.atualizarRotina(editingId, payload as unknown as Partial<RotinaIA>);
        toast.success("Rotina atualizada");
      } else {
        await rotinasMotorService.criarRotina(payload);
        toast.success("Rotina criada");
      }
      setDialogOpen(false);
      resetDialog();
      carregar();
      carregarStats();
    } catch { toast.error("Erro ao salvar rotina"); }
  }

  async function toggleRotina(id: string, ativo: boolean) {
    try {
      await rotinasMotorService.toggleRotina(id, ativo);
      toast.success(ativo ? "Rotina ativada" : "Rotina desativada");
      carregar();
    } catch { toast.error("Erro ao alterar rotina"); }
  }

  async function confirmarExclusao() {
    if (!deleteTarget) return;
    try {
      await rotinasMotorService.deletarRotina(deleteTarget.id);
      toast.success("Rotina excluída");
      setDeleteTarget(null);
      carregar();
      carregarStats();
    } catch { toast.error("Erro ao excluir rotina"); }
  }

  async function executarAgora(id: string) {
    try {
      await rotinasMotorService.executarRotina(id);
      toast.success("Rotina executada");
      carregar();
      carregarStats();
    } catch { toast.error("Erro ao executar rotina"); }
  }

  async function verExecucoes(rotinaId: string) {
    if (execucoesAbertas[rotinaId]) {
      setExecucoesAbertas((prev) => { const p = { ...prev }; delete p[rotinaId]; return p; });
      return;
    }
    setExecLoading((prev) => ({ ...prev, [rotinaId]: true }));
    try {
      const execs = await rotinasMotorService.listarExecucoes(rotinaId);
      setExecucoesAbertas((prev) => ({ ...prev, [rotinaId]: execs }));
    } finally { setExecLoading((prev) => ({ ...prev, [rotinaId]: false })); }
  }

  function toggleDiaSemana(dia: number) {
    setDialogData((prev) => ({
      ...prev,
      dias_semana: prev.dias_semana.includes(dia)
        ? prev.dias_semana.filter((d) => d !== dia)
        : [...prev.dias_semana, dia].sort(),
    }));
  }

  const totalRotinasAtivas = rotinas.filter((r) => r.ativo).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />Carregando rotinas...
      </div>
    );
  }

  return (
    <TabsContent value="rotinas" className="space-y-4 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm flex items-center gap-2">
            <span className="text-muted-foreground">Motor:</span>
            <Badge variant="outline" className={`${MOTOR_ESTADO_CORES[motorStatus.estado] || ""} flex items-center gap-1`}>
              <span className={`h-2 w-2 rounded-full inline-block ${
                motorStatus.estado === "ativo" ? "bg-green-500" :
                motorStatus.estado === "erro" ? "bg-red-500" : "bg-gray-400"
              }`} />
              {motorStatus.estado === "ativo" ? "Ativo" :
               motorStatus.estado === "erro" ? "Erro" : "Inativo"}
            </Badge>
          </div>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3" />{totalRotinasAtivas} ativas
            </span>
            <span className="flex items-center gap-1">
              <BarChart3 className="h-3 w-3" />{stats.executadasHoje} hoje
            </span>
            {stats.falhasHoje > 0 && (
              <span className="flex items-center gap-1 text-red-500">
                <AlertCircle className="h-3 w-3" />{stats.falhasHoje} falhas
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {motorStatus.ultimoHeartbeat ? fmtData(motorStatus.ultimoHeartbeat) : "-"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 text-xs" title="Forçar ciclo (debug)"
            onClick={async () => {
              const result = await executarCicloManual();
              toast.success(`Ciclo: ${result.executadas} exec, ${result.erros} erros, ${result.recuperadas} recuperadas`);
              carregar(); carregarStats();
            }}
          >
            <RefreshCw className="mr-1 h-3 w-3" />Ciclo
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" title="Reiniciar motor"
            onClick={() => { forcarReinicio(); toast.success("Motor reiniciado"); }}
          >
            <RefreshCw className="mr-1 h-3 w-3" />Reiniciar
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />Nova Rotina
          </Button>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetDialog(); setDialogOpen(open); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Rotina" : "Nova Rotina"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Altere os parâmetros da rotina do funcionário digital" : "Configure uma nova rotina operacional para o funcionário digital"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={dialogData.nome} onChange={(e) => setDialogData({ ...dialogData, nome: e.target.value })} placeholder="Ex: Buscar leads matinais" />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={dialogData.descricao} onChange={(e) => setDialogData({ ...dialogData, descricao: e.target.value })} placeholder="Descrição da rotina" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={dialogData.tipo} onValueChange={(v) => setDialogData({ ...dialogData, tipo: v as TipoRotina })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Agendado (cron)</SelectItem>
                    <SelectItem value="interval">Intervalo (segundos)</SelectItem>
                    <SelectItem value="event">Evento</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={dialogData.prioridade} onValueChange={(v) => setDialogData({ ...dialogData, prioridade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {dialogData.tipo === "interval" && (
              <div className="space-y-2">
                <Label>Intervalo (segundos)</Label>
                <Input type="number" min={10} value={dialogData.interval_seconds}
                  onChange={(e) => setDialogData({ ...dialogData, interval_seconds: parseInt(e.target.value) || 60 })} />
              </div>
            )}

            {dialogData.tipo === "scheduled" && (
              <>
                <div className="space-y-2">
                  <Label>Expressão Cron</Label>
                  <Input value={dialogData.cron_expression}
                    onChange={(e) => setDialogData({ ...dialogData, cron_expression: e.target.value })}
                    placeholder="Ex: 0 8 * * 1-5 (seg-sex 08:00)" />
                  <p className="text-[10px] text-muted-foreground">
                    Formato: minuto hora dia mês dia_semana. Ex: "0 8 * * 1-5" = 08:00 seg-sex
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Dias da Semana</Label>
                  <div className="flex gap-2 flex-wrap">
                    {DIAS_SEMANA.map((dia) => (
                      <label key={dia.value} className="flex items-center gap-1 text-xs cursor-pointer">
                        <Checkbox checked={dialogData.dias_semana.includes(dia.value)}
                          onCheckedChange={() => toggleDiaSemana(dia.value)} />
                        {dia.label}
                      </label>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Selecione os dias em que esta rotina deve executar (deixe vazio para todos os dias)
                  </p>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Ferramenta</Label>
              <Select value={dialogData.ferramenta_id}
                onValueChange={(v) => setDialogData({ ...dialogData, ferramenta_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar ferramenta..." /></SelectTrigger>
                <SelectContent>
                  {ferramentas.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      <span className="text-xs">{f.categoria} — {f.nome}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {dialogData.ferramenta_id && (
              <div className="space-y-2">
                <Label>Parâmetros da Ferramenta (JSON)</Label>
                <Textarea value={dialogData.config_ferramenta}
                  onChange={(e) => setDialogData({ ...dialogData, config_ferramenta: e.target.value })}
                  placeholder='{"filtro": "novos", "limite": 10}'
                  className="font-mono text-xs" rows={4} />
              </div>
            )}

            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={dialogData.responsavel_id}
                onValueChange={(v) => setDialogData({ ...dialogData, responsavel_id: v })}>
                <SelectTrigger><SelectValue placeholder="Nenhum (automático)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum (automático)</SelectItem>
                  {robos.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm">Aprovação Necessária</Label>
                <p className="text-xs text-muted-foreground">Rotina exige aprovação antes de executar</p>
              </div>
              <Switch checked={dialogData.aprovacao_necessaria}
                onCheckedChange={(v) => setDialogData({ ...dialogData, aprovacao_necessaria: v })} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { resetDialog(); setDialogOpen(false); }}>Cancelar</Button>
              <Button onClick={salvarRotina}>
                <Plus className="mr-2 h-4 w-4" />{editingId ? "Salvar" : "Criar Rotina"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Rotina</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a rotina <strong>{deleteTarget?.nome}</strong>?
              Esta ação não pode ser desfeita. O histórico de execuções também será removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao} className="bg-red-600 hover:bg-red-700">
              <Trash2 className="mr-2 h-4 w-4" />Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rotina List */}
      {rotinas.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8 text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhuma rotina configurada para este robô</p>
            <p className="text-xs mt-1">Crie uma rotina para automatizar tarefas do funcionário digital</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rotinas.map((rotina) => {
            const prio = getPrioridadeInfo(rotina.prioridade || "normal");
            const ferramentaNome = ferramentas.find((f) => f.id === rotina.ferramenta_id)?.nome;
            const responsavelNome = robos.find((r) => r.id === rotina.responsavel_id)?.nome;
            const diasSel = (rotina.dias_semana || []).map((d) => DIAS_SEMANA.find((ds) => ds.value === d)?.label).filter(Boolean).join(", ");

            return (
              <Card key={rotina.id} className={rotina.ativo ? "border-l-4 border-l-primary" : "opacity-60 border-l-4 border-l-gray-300"}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-sm truncate max-w-[180px]">{rotina.nome}</h4>
                        <Badge variant="outline" className="text-[10px]">{TIPO_LABELS[rotina.tipo]}</Badge>
                        <Badge className={`text-[10px] ${prio.color}`}>{prio.label}</Badge>
                        <Badge className={`text-[10px] ${STATUS_ROTINA_COLORS[rotina.status] || ""}`}>
                          {rotina.status === "running" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                          {rotina.status}
                        </Badge>
                        {rotina.aprovacao_necessaria && (
                          <Badge className="text-[10px] bg-purple-100 text-purple-700">
                            <ShieldCheck className="h-3 w-3 mr-1" />Aprovação
                          </Badge>
                        )}
                      </div>
                      {rotina.descricao && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{rotina.descricao}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />Última: {fmtData(rotina.ultima_execucao)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Próxima: {fmtTempoRestante(rotina.proxima_execucao)}
                        </span>
                        {rotina.interval_seconds && (
                          <span className="flex items-center gap-1">
                            <RefreshCw className="h-3 w-3" />A cada {rotina.interval_seconds}s
                          </span>
                        )}
                        {ferramentaNome && (
                          <span className="flex items-center gap-1">
                            <GripVertical className="h-3 w-3" />{ferramentaNome}
                          </span>
                        )}
                        {responsavelNome && (
                          <span className="flex items-center gap-1">
                            <UserCheck className="h-3 w-3" />{responsavelNome}
                          </span>
                        )}
                      </div>
                      {diasSel && (
                        <p className="text-[10px] text-muted-foreground mt-1">Dias: {diasSel}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-4 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Executar agora"
                        onClick={() => executarAgora(rotina.id)}>
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        title={rotina.ativo ? "Desativar" : "Ativar"}
                        onClick={() => toggleRotina(rotina.id, !rotina.ativo)}>
                        {rotina.ativo ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar rotina"
                        onClick={() => openEdit(rotina)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Ver execuções"
                        onClick={() => verExecucoes(rotina.id)}>
                        {execLoading[rotina.id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" title="Excluir"
                        onClick={() => setDeleteTarget(rotina)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {execucoesAbertas[rotina.id] && (
                    <div className="mt-3 border-t pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-xs font-semibold text-muted-foreground">Últimas Execuções</h5>
                        <Button variant="ghost" size="sm" className="h-6 text-xs"
                          onClick={async () => {
                            const execs = await rotinasMotorService.listarExecucoes(rotina.id);
                            setExecucoesAbertas((prev) => ({ ...prev, [rotina.id]: execs }));
                          }}>
                          <RefreshCw className="h-3 w-3 mr-1" />Atualizar
                        </Button>
                      </div>
                      {execucoesAbertas[rotina.id].length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">Nenhuma execução ainda</p>
                      ) : (
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {(execucoesAbertas[rotina.id] as unknown as { id: string; status: string; started_at: string; finished_at: string | null; logs: string | null; erro: string | null; output: Record<string, unknown> }[]).map((exec) => (
                            <div key={exec.id} className="text-xs bg-muted p-2 rounded space-y-1">
                              <div className="flex items-center justify-between">
                                <Badge className={`text-[10px] ${
                                  exec.status === "success" ? "bg-green-100 text-green-800" :
                                  exec.status === "error" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
                                }`}>
                                  {exec.status === "success" ? <CheckCircle2 className="h-3 w-3 mr-1" /> :
                                   exec.status === "error" ? <AlertCircle className="h-3 w-3 mr-1" /> :
                                   <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                                  {exec.status}
                                </Badge>
                                <div className="flex gap-2 text-[10px] text-muted-foreground">
                                  <span>Início: {fmtData(exec.started_at)}</span>
                                  {exec.finished_at && <span>Fim: {fmtData(exec.finished_at)}</span>}
                                </div>
                              </div>
                              {exec.logs && (
                                <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap max-h-24 overflow-y-auto leading-relaxed">{exec.logs}</pre>
                              )}
                              {exec.erro && <p className="text-red-600 text-[10px] font-medium">Erro: {exec.erro}</p>}
                              {exec.output && Object.keys(exec.output).length > 0 && (
                                <details className="text-[10px] text-muted-foreground">
                                  <summary className="cursor-pointer hover:text-foreground">Output</summary>
                                  <pre className="mt-1 whitespace-pre-wrap">{JSON.stringify(exec.output, null, 2)}</pre>
                                </details>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </TabsContent>
  );
}
