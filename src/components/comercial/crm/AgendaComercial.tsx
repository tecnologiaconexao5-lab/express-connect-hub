import { useState, useMemo } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Presentation,
  Plus,
  Trash2,
  Clock,
  AlertCircle,
  Bell,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Tarefa {
  id: number;
  tipo: "call" | "visita" | "email" | "reuniao" | "prazo";
  titulo: string;
  cliente: string;
  hora: string;
  responsavel: string;
  status: "pendente" | "concluida" | "cancelada";
  prioridade: "baixa" | "media" | "alta" | "critica";
}

const TAREFAS_INICIAIS: Tarefa[] = [
  {
    id: 1,
    tipo: "call",
    titulo: "Alinhamento Tabelas VUC",
    cliente: "Tech Nova S.A.",
    hora: "Hoje, 14:00",
    responsavel: "Diego",
    status: "pendente",
    prioridade: "alta",
  },
  {
    id: 2,
    tipo: "visita",
    titulo: "Apresentação ECH Comercial",
    cliente: "Indústria Gamma",
    hora: "Amanhã, 09:30",
    responsavel: "Diego",
    status: "pendente",
    prioridade: "media",
  },
  {
    id: 3,
    tipo: "email",
    titulo: "Envio de Proposta",
    cliente: "Distribuidora Beta",
    hora: "Sexta, 11:00",
    responsavel: "Admin",
    status: "pendente",
    prioridade: "alta",
  },
  {
    id: 4,
    tipo: "reuniao",
    titulo: "Negociação Contrato",
    cliente: "Logística Alpha S.A.",
    hora: "Hoje, 16:30",
    responsavel: "Diego",
    status: "pendente",
    prioridade: "critica",
  },
];

const TIPO_CONFIG = {
  call: { icon: Phone, cor: "bg-blue-100 text-blue-600", label: "Ligação" },
  visita: { icon: MapPin, cor: "bg-purple-100 text-purple-600", label: "Visita" },
  email: { icon: Mail, cor: "bg-orange-100 text-orange-600", label: "E-mail" },
  reuniao: { icon: Presentation, cor: "bg-emerald-100 text-emerald-600", label: "Reunião" },
  prazo: { icon: Clock, cor: "bg-red-100 text-red-600", label: "Prazo" },
};

const PRIORIDADE_CONFIG = {
  baixa: { cor: "bg-slate-100 text-slate-600", label: "Baixa" },
  media: { cor: "bg-blue-100 text-blue-600", label: "Média" },
  alta: { cor: "bg-orange-100 text-orange-600", label: "Alta" },
  critica: { cor: "bg-red-100 text-red-600", label: "Crítica" },
};

export default function AgendaComercial() {
  const [tarefas, setTarefas] = useState<Tarefa[]>(TAREFAS_INICIAIS);
  const [filtro, setFiltro] = useState<"todas" | "hoje" | "proximas">("todas");
  const [modalAberto, setModalAberto] = useState(false);
  const [dataSelecionada, setDataSelecionada] = useState<Date | null>(null);
  const [mesVisualizado, setMesVisualizado] = useState(new Date());
  
  const [novaTarefa, setNovaTarefa] = useState({
    titulo: "",
    cliente: "",
    tipo: "call" as "call" | "visita" | "email" | "reuniao" | "prazo",
    prioridade: "media" as "baixa" | "media" | "alta" | "critica",
    data: "",
    hora: "",
    observacoes: "",
  });

  const concluirTarefa = (id: number) => {
    setTarefas((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "concluida" as const } : t))
    );
  };

  const cancelarTarefa = (id: number) => {
    setTarefas((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "cancelada" as const } : t))
    );
  };

  const abrirModal = () => {
    const hoje = new Date();
    setNovaTarefa({
      titulo: "",
      cliente: "",
      tipo: "call",
      prioridade: "media",
      data: hoje.toISOString().split("T")[0],
      hora: "",
      observacoes: "",
    });
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setNovaTarefa({
      titulo: "",
      cliente: "",
      tipo: "call",
      prioridade: "media",
      data: "",
      hora: "",
      observacoes: "",
    });
  };

  const salvarTarefa = () => {
    if (!novaTarefa.titulo.trim() || !novaTarefa.cliente.trim()) {
      return;
    }

    const dataHora = novaTarefa.data && novaTarefa.hora
      ? `${novaTarefa.data}, ${novaTarefa.hora}`
      : novaTarefa.data || novaTarefa.hora || "Hoje";

    const nova: Tarefa = {
      id: Date.now(),
      titulo: novaTarefa.titulo.trim(),
      cliente: novaTarefa.cliente.trim(),
      tipo: novaTarefa.tipo,
      hora: dataHora,
      responsavel: "Diego",
      status: "pendente",
      prioridade: novaTarefa.prioridade,
    };

    setTarefas((prev) => [nova, ...prev]);
    fecharModal();
  };

  const navegarMes = (direcao: number) => {
    setMesVisualizado((prev) => {
      const novo = new Date(prev);
      novo.setMonth(novo.getMonth() + direcao);
      return novo;
    });
  };

  const irParaHoje = () => {
    const hoje = new Date();
    setMesVisualizado(hoje);
    setDataSelecionada(hoje);
  };

  const selecionarDia = (dia: number) => {
    const novaData = new Date(mesVisualizado);
    novaData.setDate(dia);
    setDataSelecionada(novaData);
  };

  const diasDoMes = useMemo(() => {
    const ano = mesVisualizado.getFullYear();
    const mes = mesVisualizado.getMonth();
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const diaSemanaInicio = primeiroDia.getDay();
    const diasNoMes = ultimoDia.getDate();
    
    const dias: (number | null)[] = [];
    for (let i = 0; i < diaSemanaInicio; i++) {
      dias.push(null);
    }
    for (let i = 1; i <= diasNoMes; i++) {
      dias.push(i);
    }
    return dias;
  }, [mesVisualizado]);

  const tarefasFiltradas = tarefas.filter((t) => {
    if (filtro === "hoje") return t.hora.toLowerCase().includes("hoje");
    if (filtro === "proximas") return !t.hora.toLowerCase().includes("hoje");
    return true;
  });

  const tarefasPendentes = tarefasFiltradas.filter((t) => t.status === "pendente");
  const tarefasConcluidas = tarefasFiltradas.filter((t) => t.status === "concluida");

  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const dataHoje = new Date();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Agenda Semanal */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3 border-b bg-slate-50 rounded-t-xl">
          <div className="flex justify-between items-center">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              Agenda Semanal
            </CardTitle>
            <Button size="sm" className="h-8 text-xs gap-1" onClick={abrirModal}>
              <Plus className="w-3.5 h-3.5" />
              Agendar Tarefa
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {/* Mini Calendário */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-700 capitalize">
                {mesVisualizado ? (mesVisualizado.toLocaleString("pt-BR", { month: "long" }) + " " + mesVisualizado.getFullYear()) : ""}
              </h4>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => navegarMes(-1)}>
                  ‹
                </Button>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => navegarMes(1)}>
                  ›
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs ml-1" onClick={irParaHoje}>
                  Hoje
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {diasSemana.map((dia) => (
                <div
                  key={dia}
                  className="text-[10px] font-bold text-slate-500 uppercase py-1"
                >
                  {dia}
                </div>
              ))}
              {diasDoMes.map((dia, i) => {
                const isHoje = dataHoje && dia === dataHoje.getDate() && mesVisualizado?.getMonth() === dataHoje.getMonth() && mesVisualizado?.getFullYear() === dataHoje.getFullYear();
                const isSelecionado = dataSelecionada && dia === dataSelecionada.getDate() && mesVisualizado?.getMonth() === dataSelecionada.getMonth() && mesVisualizado?.getFullYear() === dataSelecionada.getFullYear();
                return (
                  <div
                    key={i}
                    onClick={() => dia && selecionarDia(dia)}
                    className={`text-xs py-1.5 rounded-lg cursor-pointer transition
                      ${!dia ? "invisible" : ""}
                      ${isSelecionado ? "bg-primary text-white font-bold ring-2 ring-primary ring-offset-1" : ""}
                      ${isHoje && !isSelecionado ? "bg-primary text-white font-bold" : ""}
                      ${!isHoje && !isSelecionado && dia ? "hover:bg-slate-100" : ""}
                      ${!dia ? "text-slate-300" : ""}
                    `}
                  >
                    {dia || ""}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Filtros */}
          <div className="flex gap-2 mb-4">
            {[
              { key: "todas", label: "Todas" },
              { key: "hoje", label: "Hoje" },
              { key: "proximas", label: "Próximas" },
            ].map(({ key, label }) => (
              <Button
                key={key}
                variant={filtro === key ? "default" : "outline"}
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => setFiltro(key as any)}
              >
                {label}
              </Button>
            ))}
          </div>

          {/* Próximos Follow-ups */}
          <div className="space-y-3">
            <h4 className="text-xs uppercase font-bold text-slate-500 flex items-center gap-1">
              <Bell className="w-3 h-3" />
              Próximos Follow-ups
            </h4>

            {tarefasPendentes.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium">Nenhuma tarefa pendente</p>
                <p className="text-xs mt-1">Clique em "Agendar Tarefa" para começar</p>
              </div>
            )}

            {tarefasPendentes.map((tarefa) => {
              const config = TIPO_CONFIG[tarefa.tipo];
              const Icon = config.icon;
              const prioridadeConfig = PRIORIDADE_CONFIG[tarefa.prioridade];

              return (
                <div
                  key={tarefa.id}
                  className="flex gap-3 items-start group p-3 bg-white border border-slate-100 rounded-lg hover:border-primary/30 transition"
                >
                  <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${config.cor}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {tarefa.titulo}
                      </p>
                      <div className="flex gap-1 ml-2 shrink-0">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${prioridadeConfig.cor}`}
                        >
                          {prioridadeConfig.label}
                        </Badge>
                        <p className="text-[10px] font-mono font-bold bg-slate-100 px-1.5 rounded text-slate-600">
                          {tarefa.hora}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      C/ {tarefa.cliente} • {config.label}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] px-2 uppercase tracking-wide gap-1 text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
                        onClick={() => concluirTarefa(tarefa.id)}
                      >
                        <CheckCircle2 className="w-3 h-3" /> Concluir
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] px-2 uppercase tracking-wide gap-1 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border-red-200"
                        onClick={() => cancelarTarefa(tarefa.id)}
                      >
                        <Trash2 className="w-3 h-3" /> Cancelar
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {tarefasConcluidas.length > 0 && (
              <>
                <h4 className="text-xs uppercase font-bold text-slate-500 flex items-center gap-1 mt-6">
                  <CheckCircle2 className="w-3 h-3" />
                  Concluídas
                </h4>
                {tarefasConcluidas.map((tarefa) => {
                  const config = TIPO_CONFIG[tarefa.tipo];
                  const Icon = config.icon;
                  return (
                    <div
                      key={tarefa.id}
                      className="flex gap-3 items-start opacity-60 p-3 bg-slate-50 border border-slate-100 rounded-lg"
                    >
                      <div className={`p-1.5 rounded-lg ${config.cor}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-500 line-through">
                          {tarefa.titulo}
                        </p>
                        <p className="text-xs text-slate-400">
                          C/ {tarefa.cliente}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sidebar - Resumo */}
      <Card className="bg-slate-50">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            Resumo do Dia
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="text-center p-6 bg-white rounded-xl border border-slate-200">
            <div className="text-3xl font-bold text-primary mb-1">
              {tarefasPendentes.length}
            </div>
            <p className="text-xs text-slate-500">Tarefas Pendentes</p>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-600 uppercase">Status</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600">Pendentes</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                  {tarefasPendentes.length}
                </Badge>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600">Concluídas</span>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                  {tarefasConcluidas.length}
                </Badge>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600">Total</span>
                <Badge variant="outline">{tarefas.length}</Badge>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200">
            <p className="text-[11px] text-slate-400 text-center">
              Dica: Use o botão "Agendar Tarefa" para criar novos follow-ups e manter o relacionamento com seus leads ativo.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Agendamento */}
      <Dialog open={modalAberto} onOpenChange={(aberto) => !aberto && setModalAberto(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Nova Tarefa
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-3">
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Título *</label>
              <Input
                placeholder="Ex: Ligação de follow-up"
                value={novaTarefa.titulo}
                onChange={(e) => setNovaTarefa((prev) => ({ ...prev, titulo: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Cliente/Lead *</label>
              <Input
                placeholder="Ex: Tech Nova S.A."
                value={novaTarefa.cliente}
                onChange={(e) => setNovaTarefa((prev) => ({ ...prev, cliente: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Tipo</label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={novaTarefa.tipo}
                  onChange={(e) => setNovaTarefa((prev) => ({ ...prev, tipo: e.target.value as any }))}
                >
                  <option value="call">Ligação</option>
                  <option value="visita">Visita</option>
                  <option value="email">E-mail</option>
                  <option value="reuniao">Reunião</option>
                  <option value="prazo">Prazo</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Prioridade</label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={novaTarefa.prioridade}
                  onChange={(e) => setNovaTarefa((prev) => ({ ...prev, prioridade: e.target.value as any }))}
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="critica">Crítica</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Data</label>
                <Input
                  type="date"
                  value={novaTarefa.data}
                  onChange={(e) => setNovaTarefa((prev) => ({ ...prev, data: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Hora</label>
                <Input
                  type="time"
                  value={novaTarefa.hora}
                  onChange={(e) => setNovaTarefa((prev) => ({ ...prev, hora: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Observações</label>
              <Textarea
                placeholder="Detalhes adicionais..."
                rows={2}
                value={novaTarefa.observacoes}
                onChange={(e) => setNovaTarefa((prev) => ({ ...prev, observacoes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={fecharModal}>
              Cancelar
            </Button>
            <Button onClick={salvarTarefa}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
