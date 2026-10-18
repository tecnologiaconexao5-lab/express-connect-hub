import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Truck, Clock, MapPin, Package, AlertTriangle, CheckCircle, Search,
  Plus, Filter, Download, RefreshCw, ChevronRight, X, ClipboardList,
  Bell, Gauge, ArrowRight, Pause, Play, LogOut, FileText, Building2,
  Calendar, List, BarChart3, Activity, Navigation, PackageCheck,
  AlertCircle, User,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  listarCheckins, criarCheckin, atualizarStatusCheckin,
  listarDocas, listarUnidades, obterMetricasPatio,
  listarEventos, listarRegras, recalcularFila,
  listarAlertas, resolverAlerta, gerarAlertasAutomaticos,
} from "@/services/patioService";
import type {
  PatioCheckin, PatioDoca, PatioUnidade, PatioStatus,
  PatioEvento, PatioRegraFila, PatioAlerta,
} from "@/types/patio";
import {
  PATIO_STATUS_LABELS, PATIO_DOCA_LABELS,
  PATIO_KANBAN_COLUNAS, PATIO_CRITERIO_LABELS,
} from "@/types/patio";

const fmtHora = (d?: string) => d ? new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
const fmtData = (d?: string) => d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—";
const fmtMin = (min: number) => min < 60 ? `${min}min` : `${Math.floor(min / 60)}h${min % 60}min`;

export default function ControlePatio() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("kanban");
  const [checkins, setCheckins] = useState<PatioCheckin[]>([]);
  const [docas, setDocas] = useState<PatioDoca[]>([]);
  const [unidades, setUnidades] = useState<PatioUnidade[]>([]);
  const [eventos, setEventos] = useState<PatioEvento[]>([]);
  const [regras, setRegras] = useState<PatioRegraFila[]>([]);
  const [alertas, setAlertas] = useState<PatioAlerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroUnidade, setFiltroUnidade] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCheckin, setSelectedCheckin] = useState<PatioCheckin | null>(null);
  const [selectedCheckinEventos, setSelectedCheckinEventos] = useState<PatioEvento[]>([]);
  const [metricas, setMetricas] = useState<any>({ totalHoje: 0, aguardando: 0, emCarregamento: 0, concluidosHoje: 0, tempoMedioEspera: 0, tempoMedioCarregamento: 0, noShows: 0, docasOcupadas: 0 });

  // Check-in form state
  const [checkinForm, setCheckinForm] = useState({
    veiculo_placa: "", motorista_nome: "", veiculo_tipo: "truck",
    tipo_carga: "carga_geral", cliente_nome: "", prestador_nome: "",
    origem: "", destino: "", numero_os: "", observacao: "",
    documento: "", unidade_id: "", horario_previsto: "",
  });

  const carregarDados = useCallback(async () => {
    setLoading(true);
    const [c, d, u, m] = await Promise.all([
      listarCheckins({ busca: busca || undefined, status: filtroStatus !== "todos" ? filtroStatus as PatioStatus : undefined }),
      listarDocas(filtroUnidade !== "todas" ? filtroUnidade : undefined),
      listarUnidades(),
      obterMetricasPatio(filtroUnidade !== "todas" ? filtroUnidade : undefined),
    ]);
    setCheckins(c);
    setDocas(d);
    setUnidades(u);
    setMetricas(m);
    const r = await listarRegras(filtroUnidade !== "todas" ? filtroUnidade : undefined);
    setRegras(r);
    const a = await listarAlertas(true);
    setAlertas(a);
    setLoading(false);
  }, [busca, filtroUnidade, filtroStatus]);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const handleCriarCheckin = async () => {
    if (!checkinForm.veiculo_placa.trim()) return;
    await criarCheckin({
      ...checkinForm,
      unidade_id: checkinForm.unidade_id || unidades[0]?.id,
      status: "chegou_ao_patio",
      checkin_origem: "operacao",
    });
    setShowCheckinModal(false);
    setCheckinForm({
      veiculo_placa: "", motorista_nome: "", veiculo_tipo: "truck",
      tipo_carga: "carga_geral", cliente_nome: "", prestador_nome: "",
      origem: "", destino: "", numero_os: "", observacao: "",
      documento: "", unidade_id: "", horario_previsto: "",
    });
    carregarDados();
  };

  const handleMudarStatus = async (checkinId: string, novoStatus: PatioStatus) => {
    await atualizarStatusCheckin(checkinId, novoStatus, {
      unidade_id: selectedCheckin?.unidade_id || unidades[0]?.id,
    });
    carregarDados();
  };

  const handleChamarDoca = async (checkinId: string, docaId: string, docaNome: string) => {
    await atualizarStatusCheckin(checkinId, "chamado_para_doca", {
      doca_id: docaId,
      doca_nome: docaNome,
      unidade_id: checkins.find(c => c.id === checkinId)?.unidade_id,
    });
    await supabase.from("patio_docas").update({ status: "ocupada", veiculo_atual_id: checkinId }).eq("id", docaId);
    carregarDados();
  };

  const handleRecalcular = async () => {
    await recalcularFila(filtroUnidade !== "todas" ? filtroUnidade : undefined);
    carregarDados();
  };

  const verDetalhes = async (c: PatioCheckin) => {
    setSelectedCheckin(c);
    const evts = await listarEventos(c.id);
    setSelectedCheckinEventos(evts);
    setShowDetailModal(true);
  };

  const agrupadosPorColuna = (coluna: PatioStatus) =>
    checkins.filter(c => {
      if (coluna === "previsto") return c.status === "previsto" || c.status === "checkin_realizado";
      if (coluna === "aguardando_fila") return ["aguardando_fila", "aguardando_liberacao", "aguardando_checkin"].includes(c.status);
      return c.status === coluna;
    });

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E7EB] sticky top-0 z-30">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-[#F97316]" />
                <span className="text-[10px] font-black text-[#F97316] uppercase tracking-[0.2em]">Operacao</span>
              </div>
              <h1 className="text-2xl font-extrabold text-[#0F172A]">Controle de Patio</h1>
              <p className="text-sm text-[#475569]">Gestao de chegada, fila, carregamento e saida de veiculos</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={carregarDados}>
                <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
              </Button>
              <Button size="sm" className="rounded-xl bg-[#F97316] hover:bg-[#EA580C]" onClick={() => setShowCheckinModal(true)}>
                <Plus className="w-4 h-4 mr-1" /> Novo Check-in
              </Button>
            </div>
          </div>

          {/* Metricas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-4">
            {[
              { label: "Hoje", value: metricas.totalHoje, cor: "bg-[#F97316]/10 text-[#F97316]" },
              { label: "Aguardando", value: metricas.aguardando, cor: "bg-amber-50 text-amber-700" },
              { label: "Carregando", value: metricas.emCarregamento, cor: "bg-orange-50 text-orange-700" },
              { label: "Concluidos", value: metricas.concluidosHoje, cor: "bg-emerald-50 text-emerald-700" },
              { label: "No-Show", value: metricas.noShows, cor: "bg-red-50 text-red-700" },
              { label: "Docas Ocup.", value: metricas.docasOcupadas, cor: "bg-blue-50 text-blue-700" },
              { label: "T.M. Espera", value: fmtMin(metricas.tempoMedioEspera || 0), cor: "bg-slate-50 text-slate-700" },
              { label: "T.M. Carga", value: fmtMin(metricas.tempoMedioCarregamento || 0), cor: "bg-slate-50 text-slate-700" },
            ].map((m, i) => (
              <div key={i} className={`rounded-xl p-3 ${m.cor} text-center`}>
                <p className="text-[10px] font-black uppercase tracking-wider opacity-70">{m.label}</p>
                <p className="text-xl font-extrabold">{m.value}</p>
              </div>
            ))}
          </div>

          {/* Filtros + Busca */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
              <Input placeholder="Buscar placa, OS..." className="pl-10 rounded-xl bg-[#F8FAFC] border-[#E5E7EB]" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
              <SelectTrigger className="w-40 rounded-xl bg-[#F8FAFC] border-[#E5E7EB]"><SelectValue placeholder="Unidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {unidades.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={handleRecalcular}>
              <RefreshCw className="w-3 h-3 mr-1" /> Recalcular Fila
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => gerarAlertasAutomaticos().then(carregarDados)}>
              <Bell className="w-3 h-3 mr-1" /> Verificar Alertas
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 bg-white rounded-xl p-1 border border-[#E5E7EB]">
            <TabsTrigger value="kanban" className="rounded-lg data-[state=active]:bg-[#F97316] data-[state=active]:text-white">Kanban</TabsTrigger>
            <TabsTrigger value="docas" className="rounded-lg data-[state=active]:bg-[#F97316] data-[state=active]:text-white">Docas</TabsTrigger>
            <TabsTrigger value="regras" className="rounded-lg data-[state=active]:bg-[#F97316] data-[state=active]:text-white">Regras</TabsTrigger>
            <TabsTrigger value="alertas" className="rounded-lg data-[state=active]:bg-[#F97316] data-[state=active]:text-white">
              Alertas {alertas.length > 0 && <span className="ml-1 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center">{alertas.length}</span>}
            </TabsTrigger>
          </TabsList>

          {/* KANBAN */}
          <TabsContent value="kanban" className="mt-0">
            <div className="flex gap-4 overflow-x-auto pb-4" style={{ scrollSnapType: "x mandatory" }}>
              {PATIO_KANBAN_COLUNAS.map(coluna => {
                const items = agrupadosPorColuna(coluna.id);
                return (
                  <div key={coluna.id} className="flex-shrink-0 w-72" style={{ scrollSnapAlign: "start" }}>
                    <div className={`bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden`}>
                      <div className={`px-4 py-3 border-l-4 ${coluna.cor} bg-[#F8FAFC]`}>
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-extrabold text-[#0F172A]">{coluna.titulo}</h3>
                          <span className="text-xs font-bold text-[#64748B] bg-white px-2 py-0.5 rounded-full border">{items.length}</span>
                        </div>
                      </div>
                      <ScrollArea className="h-[calc(100vh-340px)]">
                        <div className="p-2 space-y-2">
                          <AnimatePresence>
                            {items.map(checkin => (
                              <motion.div
                                key={checkin.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="bg-white border border-[#E5E7EB] rounded-xl p-3 cursor-pointer hover:shadow-md hover:border-orange-200 transition-all group"
                                onClick={() => verDetalhes(checkin)}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-xs font-black text-[#0F172A]">{checkin.veiculo_placa}</span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${PATIO_STATUS_LABELS[checkin.status]?.cor || "bg-slate-100 text-slate-600"}`}>
                                    {PATIO_STATUS_LABELS[checkin.status]?.label || checkin.status}
                                  </span>
                                </div>
                                <p className="text-[11px] text-[#64748B] truncate mb-1">
                                  {checkin.cliente_nome || "—"} · {checkin.veiculo_tipo || "—"}
                                </p>
                                <div className="flex items-center gap-2 text-[10px] text-[#94A3B8]">
                                  {checkin.posicao_fila > 0 && (
                                    <span className="font-black text-[#F97316]">#{checkin.posicao_fila}</span>
                                  )}
                                  <Clock className="w-3 h-3" />
                                  <span>{fmtHora(checkin.horario_chegada)}</span>
                                  {checkin.doca_nome && <span className="text-[#64748B]">· {checkin.doca_nome}</span>}
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                          {items.length === 0 && (
                            <div className="text-center py-8 text-[10px] text-[#94A3B8] font-medium">Nenhum veiculo</div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* DOCAS */}
          <TabsContent value="docas" className="mt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {docas.map(doca => {
                const ocupante = checkins.find(c => c.doca_id === doca.id && ["em_doca", "carregamento_iniciado", "carregamento_pausado"].includes(c.status));
                return (
                  <Card key={doca.id} className={`rounded-2xl border-2 ${doca.status === "disponivel" ? "border-emerald-200" : doca.status === "ocupada" ? "border-orange-200" : "border-slate-200"} shadow-sm`}>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-extrabold text-[#0F172A]">{doca.nome}</h3>
                        <Badge className={PATIO_DOCA_LABELS[doca.status]?.cor}>{PATIO_DOCA_LABELS[doca.status]?.label}</Badge>
                      </div>
                      {ocupante ? (
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-[#0F172A]">{ocupante.veiculo_placa}</p>
                          <p className="text-[10px] text-[#64748B]">{ocupante.cliente_nome || "—"} · {fmtHora(ocupante.carregamento_inicio)}</p>
                          <div className="h-1.5 bg-slate-100 rounded-full">
                            <div className="h-full bg-orange-500 rounded-full" style={{ width: `${Math.min(100, ((ocupante.tempo_carregando_min || 0) / 60) * 100)}%` }} />
                          </div>
                          <p className="text-[10px] text-[#94A3B8]">{fmtMin(ocupante.tempo_carregando_min || 0)} de carregamento</p>
                        </div>
                      ) : (
                        <p className="text-xs text-[#94A3B8]">Doca disponivel</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* REGRAS */}
          <TabsContent value="regras" className="mt-0">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">Regras de Ordenacao da Fila</CardTitle>
                <CardDescription>Criterios ativos para ordenacao dos veiculos na fila de carregamento</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {regras.map(regra => (
                    <div key={regra.id} className="flex items-center justify-between p-3 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB]">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${regra.ativo ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                          <Gauge className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#0F172A]">{PATIO_CRITERIO_LABELS[regra.criterio] || regra.criterio}</p>
                          <p className="text-[10px] text-[#94A3B8]">Ordem {regra.ordem} · {regra.ativo ? "Ativo" : "Inativo"}</p>
                        </div>
                      </div>
                      <Badge variant={regra.ativo ? "default" : "secondary"} className="rounded-full">
                        {regra.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  ))}
                  {regras.length === 0 && (
                    <div className="text-center py-8 text-sm text-[#94A3B8]">Nenhuma regra configurada</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ALERTAS */}
          <TabsContent value="alertas" className="mt-0">
            <Card className="rounded-2xl">
              <CardContent className="p-6">
                <div className="space-y-2">
                  {alertas.map(alerta => (
                    <div key={alerta.id} className="flex items-center justify-between p-3 rounded-xl border border-red-200 bg-red-50/50">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-red-800">{alerta.mensagem}</p>
                          <p className="text-[10px] text-red-500">{new Date(alerta.criado_em).toLocaleTimeString("pt-BR")}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-100 rounded-xl"
                        onClick={() => resolverAlerta(alerta.id).then(carregarDados)}>
                        Resolver
                      </Button>
                    </div>
                  ))}
                  {alertas.length === 0 && (
                    <div className="text-center py-8">
                      <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                      <p className="text-sm font-bold text-emerald-700">Nenhum alerta ativo</p>
                      <p className="text-xs text-emerald-500">Todas as operacoes estao dentro dos parametros</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal: Novo Check-in */}
      <Dialog open={showCheckinModal} onOpenChange={setShowCheckinModal}>
        <DialogContent className="max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Novo Check-in</DialogTitle>
            <DialogDescription>Registre a chegada de um veiculo ao patio</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Placa *</Label>
                <Input className="rounded-xl" value={checkinForm.veiculo_placa} onChange={e => setCheckinForm({...checkinForm, veiculo_placa: e.target.value.toUpperCase()})} placeholder="ABC1234" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Tipo Veiculo</Label>
                <Select value={checkinForm.veiculo_tipo} onValueChange={v => setCheckinForm({...checkinForm, veiculo_tipo: v})}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="van">Van</SelectItem>
                    <SelectItem value="toco">Toco</SelectItem>
                    <SelectItem value="truck">Truck</SelectItem>
                    <SelectItem value="carreta">Carreta</SelectItem>
                    <SelectItem value="bitrem">Bitrem</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Motorista</Label>
                <Input className="rounded-xl" value={checkinForm.motorista_nome} onChange={e => setCheckinForm({...checkinForm, motorista_nome: e.target.value})} placeholder="Nome do motorista" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cliente</Label>
                <Input className="rounded-xl" value={checkinForm.cliente_nome} onChange={e => setCheckinForm({...checkinForm, cliente_nome: e.target.value})} placeholder="Nome do cliente" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Origem</Label>
                <Input className="rounded-xl" value={checkinForm.origem} onChange={e => setCheckinForm({...checkinForm, origem: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Destino</Label>
                <Input className="rounded-xl" value={checkinForm.destino} onChange={e => setCheckinForm({...checkinForm, destino: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">OS</Label>
                <Input className="rounded-xl" value={checkinForm.numero_os} onChange={e => setCheckinForm({...checkinForm, numero_os: e.target.value})} placeholder="OS-123" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Documento</Label>
                <Input className="rounded-xl" value={checkinForm.documento} onChange={e => setCheckinForm({...checkinForm, documento: e.target.value})} placeholder="NF, CT-e..." />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Observacao</Label>
              <Textarea className="rounded-xl min-h-[60px]" value={checkinForm.observacao} onChange={e => setCheckinForm({...checkinForm, observacao: e.target.value})} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setShowCheckinModal(false)}>Cancelar</Button>
            <Button className="rounded-xl bg-[#F97316] hover:bg-[#EA580C]" onClick={handleCriarCheckin}>Registrar Check-in</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Detalhes + Timeline */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold flex items-center gap-2">
              <Truck className="w-5 h-5 text-[#F97316]" />
              {selectedCheckin?.veiculo_placa}
            </DialogTitle>
            <DialogDescription>
              {selectedCheckin?.cliente_nome || "—"} · {selectedCheckin?.motorista_nome || "Motorista nao informado"}
            </DialogDescription>
          </DialogHeader>
          {selectedCheckin && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ["Status", PATIO_STATUS_LABELS[selectedCheckin.status]?.label],
                  ["Chegada", fmtHora(selectedCheckin.horario_chegada)],
                  ["Posicao Fila", selectedCheckin.posicao_fila > 0 ? `#${selectedCheckin.posicao_fila}` : "—"],
                  ["Doca", selectedCheckin.doca_nome || "—"],
                  ["Tempo Aguardando", fmtMin(selectedCheckin.tempo_aguardando_min)],
                  ["Tempo Carregando", fmtMin(selectedCheckin.tempo_carregando_min)],
                  ["Origem", selectedCheckin.origem || "—"],
                  ["Destino", selectedCheckin.destino || "—"],
                ].map(([k, v], i) => (
                  <div key={i} className="p-2 rounded-lg bg-[#F8FAFC]">
                    <p className="text-[10px] text-[#94A3B8] uppercase font-bold">{k}</p>
                    <p className="text-sm font-bold text-[#0F172A]">{v}</p>
                  </div>
                ))}
              </div>

              {/* Timeline */}
              <div>
                <h4 className="text-xs font-black text-[#0F172A] uppercase tracking-wider mb-3">Timeline do Patio</h4>
                <div className="space-y-1">
                  {selectedCheckinEventos.map((evt, i) => (
                    <div key={evt.id} className="flex items-start gap-3 py-2 border-l-2 border-[#E5E7EB] pl-3 ml-1.5">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        i === 0 ? "bg-[#F97316]" : "bg-slate-300"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#0F172A]">
                          {PATIO_STATUS_LABELS[evt.status_novo]?.label || evt.status_novo}
                        </p>
                        <p className="text-[10px] text-[#94A3B8]">{evt.descricao || ""}</p>
                        <p className="text-[10px] text-[#94A3B8] mt-0.5">{new Date(evt.created_at).toLocaleTimeString("pt-BR")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Acoes rapidas */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-[#E5E7EB]">
                {selectedCheckin.status === "chegou_ao_patio" && (
                  <Button size="sm" className="rounded-xl" onClick={() => handleMudarStatus(selectedCheckin.id, "aguardando_fila")}>
                    Enviar para Fila
                  </Button>
                )}
                {selectedCheckin.status === "aguardando_fila" && (
                  <Button size="sm" className="rounded-xl bg-[#F97316]" onClick={() => {
                    const docaDisponivel = docas.find(d => d.status === "disponivel");
                    if (docaDisponivel) handleChamarDoca(selectedCheckin.id, docaDisponivel.id, docaDisponivel.nome);
                  }}>
                    Chamar para Doca
                  </Button>
                )}
                {selectedCheckin.status === "chamado_para_doca" && (
                  <>
                    <Button size="sm" className="rounded-xl bg-[#F97316]" onClick={() => handleMudarStatus(selectedCheckin.id, "em_doca")}>Em Doca</Button>
                    <Button size="sm" className="rounded-xl bg-[#F97316]" onClick={() => handleMudarStatus(selectedCheckin.id, "carregamento_iniciado")}>Iniciar Carregamento</Button>
                  </>
                )}
                {selectedCheckin.status === "em_doca" && (
                  <Button size="sm" className="rounded-xl bg-[#F97316]" onClick={() => handleMudarStatus(selectedCheckin.id, "carregamento_iniciado")}>Iniciar Carregamento</Button>
                )}
                {selectedCheckin.status === "carregamento_iniciado" && (
                  <>
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => handleMudarStatus(selectedCheckin.id, "carregamento_pausado")}>
                      <Pause className="w-3 h-3 mr-1" /> Pausar
                    </Button>
                    <Button size="sm" className="rounded-xl bg-emerald-600" onClick={() => handleMudarStatus(selectedCheckin.id, "carregamento_concluido")}>
                      <CheckCircle className="w-3 h-3 mr-1" /> Concluir Carregamento
                    </Button>
                  </>
                )}
                {selectedCheckin.status === "carregamento_pausado" && (
                  <Button size="sm" className="rounded-xl" onClick={() => handleMudarStatus(selectedCheckin.id, "carregamento_iniciado")}>
                    <Play className="w-3 h-3 mr-1" /> Retomar
                  </Button>
                )}
                {selectedCheckin.status === "carregamento_concluido" && (
                  <Button size="sm" className="rounded-xl bg-emerald-600" onClick={() => handleMudarStatus(selectedCheckin.id, "aguardando_documentacao")}>
                    Aguardar Documentacao
                  </Button>
                )}
                {selectedCheckin.status === "aguardando_documentacao" && (
                  <Button size="sm" className="rounded-xl bg-emerald-600" onClick={() => handleMudarStatus(selectedCheckin.id, "liberado_para_saida")}>
                    Liberar Saida
                  </Button>
                )}
                {selectedCheckin.status === "liberado_para_saida" && (
                  <Button size="sm" className="rounded-xl" onClick={() => handleMudarStatus(selectedCheckin.id, "saiu_do_patio")}>
                    <LogOut className="w-3 h-3 mr-1" /> Registrar Saida
                  </Button>
                )}
                <Button size="sm" variant="outline" className="rounded-xl text-red-500" onClick={() => handleMudarStatus(selectedCheckin.id, "cancelado")}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
