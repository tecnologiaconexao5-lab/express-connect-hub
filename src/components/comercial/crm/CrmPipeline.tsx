import { useState, useMemo } from "react";
import {
  Plus, Building, Clock, DollarSign, Phone, Mail, MessageSquare,
  Calendar, FileText, User, Edit, Send, Trash2, ChevronRight,
  X, Check, Brain, Zap, Star, MapPin, AlertTriangle, Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Lead, LeadEstagio, ESTAGIOS_CONFIG, TEMPERATURA_CONFIG, SEGMENTOS,
  TIPOS_SERVICO, REGIOES_BRASIL, TIPOS_VEICULOS, TEMPLATES_MENSAGEM,
  gerarSugestaoIA, calcularProbabilidade, LeadOrigem, LeadTemperatura, LeadUrgencia
} from "./crmTypes";

interface CrmPipelineProps {
  leads: Lead[];
  onLeadsChange: (leads: Lead[]) => void;
}

const ORDEM_ESTAGIOS: LeadEstagio[] = [
  "lead_novo", "contato_iniciado", "qualificado", "diagnostico",
  "proposta_enviada", "negociacao", "fechado_ganho", "fechado_perdido"
];

const TIPOS_INTERACAO = [
  { value: "ligacao", label: "Ligação realizada" },
  { value: "email", label: "E-mail enviado" },
  { value: "whatsapp", label: "WhatsApp enviado" },
  { value: "reuniao", label: "Reunião realizada" },
  { value: "proposta", label: "Proposta enviada" },
  { value: "visita", label: "Visita realizada" },
  { value: "obs", label: "Observação" },
];

export default function CrmPipeline({ leads, onLeadsChange }: CrmPipelineProps) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [drawerNovo, setDrawerNovo] = useState(false);
  const [detalheOpen, setDetalheOpen] = useState(false);
  const [leadSelecionado, setLeadSelecionado] = useState<Lead | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [novaInteracao, setNovaInteracao] = useState({ tipo: "obs", descricao: "" });
  const [novoLembrete, setNovoLembrete] = useState<{ tipo: string; descricao: string; data: string }>({
    tipo: "ligacao", descricao: "", data: ""
  });
  const [form, setForm] = useState<Partial<Lead>>({
    estagio: "lead_novo", urgencia: "media", temperatura: "morno", origem: "inbound"
  });

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtInitials = (name: string) => name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  // Agrupa leads por estágio
  const leadsPorEstagio = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    ORDEM_ESTAGIOS.forEach(e => { map[e] = []; });
    leads.forEach(l => {
      if (map[l.estagio]) map[l.estagio].push(l);
    });
    return map;
  }, [leads]);

  const handleDragStart = (id: string) => setDragging(id);
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (estagio: LeadEstagio, e: React.DragEvent) => {
    e.preventDefault();
    if (!dragging) return;
    onLeadsChange(leads.map(l => l.id === dragging
      ? {
        ...l,
        estagio,
        diasNaEtapa: 0,
        atualizadoEm: new Date(),
        probabilidadeFechamento: calcularProbabilidade({ ...l, estagio }),
        timeline: [...(l.timeline || []), {
          id: `t${Date.now()}`,
          data: new Date(),
          tipo: "atualizacao" as const,
          descricao: `Movido para: ${ESTAGIOS_CONFIG[estagio].label}`,
          responsavel: "Você"
        }]
      } : l));
    toast.success(`Movido para: ${ESTAGIOS_CONFIG[estagio].label}`);
    setDragging(null);
  };

  const salvarLead = () => {
    if (!form.empresa) return toast.error("Informe o nome da empresa.");
    const novo: Lead = {
      id: String(Date.now()),
      empresa: form.empresa || "",
      nomeContato: form.nomeContato || "",
      telefone: form.telefone || "",
      whatsapp: form.whatsapp || "",
      email: form.email || "",
      segmento: form.segmento || "",
      regiao: form.regiao || "",
      origem: (form.origem as LeadOrigem) || "outro",
      responsavel: form.responsavel || "Você",
      tipoServico: form.tipoServico || "",
      estagio: "lead_novo",
      urgencia: (form.urgencia as LeadUrgencia) || "media",
      temperatura: (form.temperatura as LeadTemperatura) || "morno",
      valorEstimadoMensal: Number(form.valorEstimadoMensal) || 0,
      probabilidadeFechamento: 10,
      diasNaEtapa: 0,
      timeline: [{
        id: `t${Date.now()}`,
        data: new Date(),
        tipo: "criacao",
        descricao: "Lead cadastrado no CRM",
        responsavel: "Você"
      }],
      lembretes: [],
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    };
    novo.probabilidadeFechamento = calcularProbabilidade(novo);
    onLeadsChange([...leads, novo]);
    setDrawerNovo(false);
    setForm({ estagio: "lead_novo", urgencia: "media", temperatura: "morno", origem: "inbound" });
    toast.success("Lead cadastrado com sucesso!");
  };

  const abrirDetalhe = (lead: Lead) => {
    setLeadSelecionado(lead);
    setDetalheOpen(true);
  };

  const adicionarInteracao = () => {
    if (!novaInteracao.descricao || !leadSelecionado) return;
    const interacao = {
      id: `t${Date.now()}`,
      data: new Date(),
      tipo: novaInteracao.tipo as any,
      descricao: novaInteracao.descricao,
      responsavel: "Você"
    };
    const updated = {
      ...leadSelecionado,
      timeline: [...(leadSelecionado.timeline || []), interacao],
      atualizadoEm: new Date(),
      diasNaEtapa: 0
    };
    setLeadSelecionado(updated);
    onLeadsChange(leads.map(l => l.id === leadSelecionado.id ? updated : l));
    setNovaInteracao({ tipo: "obs", descricao: "" });
    toast.success("Interação registrada!");
  };

  const adicionarLembrete = () => {
    if (!novoLembrete.descricao || !leadSelecionado) return;
    const lembrete = {
      id: `l${Date.now()}`,
      data: novoLembrete.data ? new Date(novoLembrete.data) : new Date(),
      tipo: novoLembrete.tipo as any,
      descricao: novoLembrete.descricao,
      responsavel: "Você",
      status: "pendente" as const
    };
    const updated = {
      ...leadSelecionado,
      lembretes: [...(leadSelecionado.lembretes || []), lembrete]
    };
    setLeadSelecionado(updated);
    onLeadsChange(leads.map(l => l.id === leadSelecionado.id ? updated : l));
    setNovoLembrete({ tipo: "ligacao", descricao: "", data: "" });
    toast.success("Lembrete agendado!");
  };

  const moverLead = (estagio: LeadEstagio) => {
    if (!leadSelecionado) return;
    const updated = {
      ...leadSelecionado,
      estagio,
      diasNaEtapa: 0,
      atualizadoEm: new Date(),
      probabilidadeFechamento: calcularProbabilidade({ ...leadSelecionado, estagio }),
      timeline: [...(leadSelecionado.timeline || []), {
        id: `t${Date.now()}`,
        data: new Date(),
        tipo: "atualizacao" as const,
        descricao: `Movido para: ${ESTAGIOS_CONFIG[estagio].label}`,
        responsavel: "Você"
      }]
    };
    setLeadSelecionado(updated);
    onLeadsChange(leads.map(l => l.id === leadSelecionado.id ? updated : l));
    toast.success(`Movido para: ${ESTAGIOS_CONFIG[estagio].label}`);
  };

  const converterEmCliente = () => {
    if (!leadSelecionado) return;
    toast.success(`🎉 ${leadSelecionado.empresa} convertido em cliente! Redirecionando para cadastro...`);
    moverLead("fechado_ganho");
  };

  const getTimelineIcon = (tipo: string) => {
    const icons: Record<string, React.ReactNode> = {
      criacao: <Plus className="w-3 h-3" />,
      ligacao: <Phone className="w-3 h-3" />,
      email: <Mail className="w-3 h-3" />,
      whatsapp: <MessageSquare className="w-3 h-3" />,
      reuniao: <Calendar className="w-3 h-3" />,
      proposta: <FileText className="w-3 h-3" />,
      visita: <MapPin className="w-3 h-3" />,
    };
    return icons[tipo] || <Edit className="w-3 h-3" />;
  };

  const sugestaoIA = leadSelecionado ? gerarSugestaoIA(leadSelecionado) : null;

  return (
    <div className="flex flex-col h-[calc(100vh-260px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Pipeline de Vendas Inteligente</h3>
          <p className="text-xs text-muted-foreground">Arraste os cards ou clique para ver detalhes e ações de IA.</p>
        </div>
        <Button onClick={() => setDrawerNovo(true)} className="gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> Novo Lead
        </Button>
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-3 h-full min-w-max pb-4">
          {ORDEM_ESTAGIOS.map(estagio => {
            const cfg = ESTAGIOS_CONFIG[estagio];
            const items = leadsPorEstagio[estagio] || [];
            const totalValor = items.reduce((a, l) => a + l.valorEstimadoMensal, 0);

            return (
              <div
                key={estagio}
                className={`w-72 flex flex-col rounded-xl border-2 transition-all duration-200 ${dragging ? "border-primary/40 bg-primary/5" : "border-slate-100 bg-slate-50/40"}`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(estagio, e)}
              >
                {/* Coluna Header */}
                <div className={`px-3 py-2.5 border-b-2 rounded-t-xl flex items-center justify-between ${cfg.corBg} ${cfg.cor}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider">{cfg.label}</span>
                    <span className="bg-white/60 text-slate-700 text-xs rounded-full px-1.5 py-0.5 font-bold">{items.length}</span>
                  </div>
                  <span className="text-xs font-black opacity-70">{fmt(totalValor)}</span>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[200px]">
                  {items.map(lead => {
                    const tempCfg = TEMPERATURA_CONFIG[lead.temperatura];
                    const isAtRisk = lead.diasNaEtapa > 5;
                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={() => handleDragStart(lead.id)}
                        onClick={() => abrirDetalhe(lead)}
                        className={`bg-white rounded-lg p-2.5 border shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/30 transition-all group ${isAtRisk ? "border-red-200" : "border-slate-100"}`}
                      >
                        <div className="flex items-start justify-between mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-sm font-bold text-slate-800 truncate">{lead.empresa}</span>
                          </div>
                          <span className="text-base shrink-0 ml-1" title={tempCfg.label}>{tempCfg.emoji}</span>
                        </div>

                        <p className="text-xs text-muted-foreground mb-2 truncate">{lead.nomeContato || "Sem contato"}</p>

                        <div className="flex flex-wrap gap-1 mb-2">
                          <Badge variant="outline" className={`text-[10px] border-0 ${lead.urgencia === "alta" || lead.urgencia === "critica" ? "bg-red-100 text-red-700" : lead.urgencia === "media" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                            {lead.urgencia}
                          </Badge>
                          {isAtRisk && (
                            <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-0">
                              <AlertTriangle className="w-2.5 h-2.5 mr-0.5" /> {lead.diasNaEtapa}d
                            </Badge>
                          )}
                          {!isAtRisk && (
                            <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500 border-0">
                              <Clock className="w-2.5 h-2.5 mr-0.5" /> {lead.diasNaEtapa}d
                            </Badge>
                          )}
                        </div>

                        <div className="border-t pt-2 flex justify-between items-center">
                          <span className="text-xs font-bold text-emerald-600 flex items-center">
                            <DollarSign className="w-3 h-3 mr-0.5" />
                            {lead.valorEstimadoMensal.toLocaleString("pt-BR")}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <div className="flex items-center gap-1">
                              <Progress value={lead.probabilidadeFechamento} className="w-10 h-1" />
                              <span className="text-[10px] font-bold text-primary">{lead.probabilidadeFechamento}%</span>
                            </div>
                            <Avatar className="w-5 h-5 border border-white shadow">
                              <AvatarFallback className="text-[8px] bg-primary text-primary-foreground font-bold">
                                {fmtInitials(lead.responsavel)}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {items.length === 0 && (
                    <div className="border-2 border-dashed border-slate-200 rounded-lg h-20 flex items-center justify-center text-xs text-slate-400">
                      Solte um card aqui
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ====== DRAWER NOVO LEAD ====== */}
      <Sheet open={drawerNovo} onOpenChange={setDrawerNovo}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2"><Plus className="w-4 h-4" /> Novo Lead / Oportunidade</SheetTitle>
            <SheetDescription>Cadastre um novo lead no funil de vendas.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1">
              <Label className="text-xs">Empresa *</Label>
              <Input value={form.empresa || ""} onChange={e => setForm(p => ({ ...p, empresa: e.target.value }))} placeholder="Ex: Logística Alpha S.A." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome do Contato</Label>
                <Input value={form.nomeContato || ""} onChange={e => setForm(p => ({ ...p, nomeContato: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cargo</Label>
                <Input placeholder="Gerente, Diretor..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Telefone / WhatsApp</Label>
                <Input value={form.telefone || ""} onChange={e => setForm(p => ({ ...p, telefone: e.target.value, whatsapp: e.target.value }))} placeholder="(11) 99999-9999" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">E-mail</Label>
                <Input type="email" value={form.email || ""} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Segmento</Label>
                <Select value={form.segmento || ""} onValueChange={v => setForm(p => ({ ...p, segmento: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{SEGMENTOS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Região</Label>
                <Select value={form.regiao || ""} onValueChange={v => setForm(p => ({ ...p, regiao: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{REGIOES_BRASIL.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Origem do Lead</Label>
                <Select value={form.origem || "inbound"} onValueChange={v => setForm(p => ({ ...p, origem: v as LeadOrigem }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indicacao">Indicação</SelectItem>
                    <SelectItem value="inbound">Inbound</SelectItem>
                    <SelectItem value="outbound">Outbound</SelectItem>
                    <SelectItem value="evento">Evento</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="site">Site</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email_mkt">E-mail Mkt</SelectItem>
                    <SelectItem value="parceiro">Parceiro</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo de Serviço</Label>
                <Select value={form.tipoServico || ""} onValueChange={v => setForm(p => ({ ...p, tipoServico: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{TIPOS_SERVICO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Valor Estimado/mês</Label>
                <Input type="number" value={form.valorEstimadoMensal || ""} onChange={e => setForm(p => ({ ...p, valorEstimadoMensal: Number(e.target.value) }))} placeholder="50000" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Urgência</Label>
                <Select value={form.urgencia || "media"} onValueChange={v => setForm(p => ({ ...p, urgencia: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">🟢 Baixa</SelectItem>
                    <SelectItem value="media">🟡 Média</SelectItem>
                    <SelectItem value="alta">🔴 Alta</SelectItem>
                    <SelectItem value="critica">🚨 Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Temperatura</Label>
                <Select value={form.temperatura || "morno"} onValueChange={v => setForm(p => ({ ...p, temperatura: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="frio">🧊 Frio</SelectItem>
                    <SelectItem value="morno">🌤️ Morno</SelectItem>
                    <SelectItem value="quente">🔥 Quente</SelectItem>
                    <SelectItem value="em_chamas">🚀 Em Chamas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Responsável Interno</Label>
              <Input value={form.responsavel || ""} onChange={e => setForm(p => ({ ...p, responsavel: e.target.value }))} placeholder="Seu nome" />
            </div>
            <Button className="w-full mt-2" onClick={salvarLead}>
              <Plus className="w-4 h-4 mr-2" /> Cadastrar Lead
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ====== DETALHE DO LEAD ====== */}
      <Sheet open={detalheOpen} onOpenChange={setDetalheOpen}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          {leadSelecionado && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Building className="w-5 h-5 text-primary" />
                  {leadSelecionado.empresa}
                </SheetTitle>
                <SheetDescription className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${ESTAGIOS_CONFIG[leadSelecionado.estagio].corBg} ${ESTAGIOS_CONFIG[leadSelecionado.estagio].cor}`}>
                    {ESTAGIOS_CONFIG[leadSelecionado.estagio].label}
                  </span>
                  <span className="text-base">{TEMPERATURA_CONFIG[leadSelecionado.temperatura].emoji}</span>
                  <Badge variant="outline" className="text-xs">{leadSelecionado.probabilidadeFechamento}% probabilidade</Badge>
                </SheetDescription>
              </SheetHeader>

              {/* Sugestão IA */}
              {sugestaoIA && (
                <div className={`mt-4 p-3 rounded-lg border flex items-start gap-2 text-xs ${sugestaoIA.tipo === "urgente" ? "bg-red-50 border-red-200" : sugestaoIA.tipo === "alerta" ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200"}`}>
                  <Brain className={`w-4 h-4 shrink-0 mt-0.5 ${sugestaoIA.tipo === "urgente" ? "text-red-500" : sugestaoIA.tipo === "alerta" ? "text-amber-500" : "text-blue-500"}`} />
                  <div>
                    <p className="font-bold text-slate-800">IA Comercial: {sugestaoIA.mensagem}</p>
                    <p className="text-primary mt-0.5">→ {sugestaoIA.acao}</p>
                  </div>
                </div>
              )}

              <Tabs defaultValue="resumo" className="mt-4">
                <TabsList className="w-full">
                  <TabsTrigger value="resumo" className="flex-1 text-xs">Resumo</TabsTrigger>
                  <TabsTrigger value="timeline" className="flex-1 text-xs">Histórico</TabsTrigger>
                  <TabsTrigger value="agenda" className="flex-1 text-xs">Agenda</TabsTrigger>
                  <TabsTrigger value="mover" className="flex-1 text-xs">Mover</TabsTrigger>
                </TabsList>

                {/* RESUMO */}
                <TabsContent value="resumo" className="space-y-4 mt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Valor Estimado/mês</p><p className="font-bold text-emerald-600 text-sm">{fmt(leadSelecionado.valorEstimadoMensal)}</p></CardContent></Card>
                    <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Probabilidade</p><div className="flex items-center gap-2 mt-1"><Progress value={leadSelecionado.probabilidadeFechamento} className="flex-1 h-2" /><span className="text-xs font-bold text-primary">{leadSelecionado.probabilidadeFechamento}%</span></div></CardContent></Card>
                    <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Dias na etapa</p><p className="font-bold text-sm">{leadSelecionado.diasNaEtapa} dias</p></CardContent></Card>
                    <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Temperatura</p><p className="font-bold text-sm">{TEMPERATURA_CONFIG[leadSelecionado.temperatura].emoji} {TEMPERATURA_CONFIG[leadSelecionado.temperatura].label}</p></CardContent></Card>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2"><User className="w-4 h-4 text-muted-foreground" /><span className="font-medium">{leadSelecionado.nomeContato}</span></div>
                    {leadSelecionado.telefone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /><span>{leadSelecionado.telefone}</span></div>}
                    {leadSelecionado.email && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /><span className="text-xs truncate">{leadSelecionado.email}</span></div>}
                    {leadSelecionado.segmento && <div className="flex items-center gap-2"><Star className="w-4 h-4 text-muted-foreground" /><span>{leadSelecionado.segmento} · {leadSelecionado.regiao}</span></div>}
                  </div>

                  <div className="flex gap-2 mt-2">
                    <Button variant="outline" size="sm" className="flex-1 text-xs gap-1 text-green-700 border-green-300 bg-green-50 hover:bg-green-100">
                      <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 text-xs gap-1 text-blue-700 border-blue-300 bg-blue-50 hover:bg-blue-100">
                      <Mail className="w-3.5 h-3.5" /> E-mail
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 text-xs gap-1">
                      <Phone className="w-3.5 h-3.5" /> Ligar
                    </Button>
                  </div>

                  <Button variant="outline" size="sm" className="w-full text-xs gap-1 text-violet-700 border-violet-300 bg-violet-50 hover:bg-violet-100" onClick={() => setTemplateOpen(true)}>
                    <Brain className="w-3.5 h-3.5" /> Ver Templates de Mensagem IA
                  </Button>

                  {leadSelecionado.estagio === "fechado_ganho" && (
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2" onClick={converterEmCliente}>
                      <User className="w-4 h-4" /> Converter em Cliente + Criar Rota
                    </Button>
                  )}
                </TabsContent>

                {/* HISTÓRICO */}
                <TabsContent value="timeline" className="space-y-4 mt-3">
                  <Card>
                    <CardHeader className="py-2 px-3"><CardTitle className="text-xs font-bold uppercase text-muted-foreground">Registrar nova interação</CardTitle></CardHeader>
                    <CardContent className="p-3 space-y-2">
                      <Select value={novaInteracao.tipo} onValueChange={v => setNovaInteracao(p => ({ ...p, tipo: v }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{TIPOS_INTERACAO.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Textarea placeholder="Descrição da interação..." value={novaInteracao.descricao} onChange={e => setNovaInteracao(p => ({ ...p, descricao: e.target.value }))} className="h-16 text-xs resize-none" />
                      <Button size="sm" className="w-full text-xs gap-1" onClick={adicionarInteracao}><Send className="w-3.5 h-3.5" /> Registrar</Button>
                    </CardContent>
                  </Card>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {[...(leadSelecionado.timeline || [])].reverse().map(t => (
                      <div key={t.id} className="flex gap-2.5 text-xs">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                          {getTimelineIcon(t.tipo)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{t.descricao}</p>
                          <p className="text-muted-foreground">{new Date(t.data).toLocaleDateString("pt-BR")} · {t.responsavel}</p>
                        </div>
                      </div>
                    ))}
                    {!leadSelecionado.timeline?.length && <p className="text-xs text-muted-foreground text-center py-4">Nenhuma interação registrada.</p>}
                  </div>
                </TabsContent>

                {/* AGENDA */}
                <TabsContent value="agenda" className="space-y-4 mt-3">
                  <Card>
                    <CardHeader className="py-2 px-3"><CardTitle className="text-xs font-bold uppercase text-muted-foreground">Agendar lembrete</CardTitle></CardHeader>
                    <CardContent className="p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Select value={novoLembrete.tipo} onValueChange={v => setNovoLembrete(p => ({ ...p, tipo: v }))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ligacao" className="text-xs">Ligação</SelectItem>
                            <SelectItem value="reuniao" className="text-xs">Reunião</SelectItem>
                            <SelectItem value="email" className="text-xs">E-mail</SelectItem>
                            <SelectItem value="whatsapp" className="text-xs">WhatsApp</SelectItem>
                            <SelectItem value="retorno" className="text-xs">Retorno</SelectItem>
                            <SelectItem value="prazo" className="text-xs">Prazo</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input type="datetime-local" value={novoLembrete.data} onChange={e => setNovoLembrete(p => ({ ...p, data: e.target.value }))} className="h-8 text-xs" />
                      </div>
                      <Input placeholder="Descrição..." value={novoLembrete.descricao} onChange={e => setNovoLembrete(p => ({ ...p, descricao: e.target.value }))} className="h-8 text-xs" />
                      <Button size="sm" className="w-full text-xs gap-1" onClick={adicionarLembrete}><Calendar className="w-3.5 h-3.5" /> Agendar</Button>
                    </CardContent>
                  </Card>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {(leadSelecionado.lembretes || []).map(l => (
                      <div key={l.id} className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs ${l.status === "pendente" && new Date(l.data) < new Date() ? "bg-red-50 border-red-200" : "bg-white border-slate-200"}`}>
                        {l.tipo === "reuniao" ? <Calendar className="w-4 h-4 shrink-0" /> : l.tipo === "ligacao" ? <Phone className="w-4 h-4 shrink-0" /> : <Clock className="w-4 h-4 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 truncate">{l.descricao}</p>
                          <p className="text-muted-foreground">{new Date(l.data).toLocaleString("pt-BR") || "Sem data"}</p>
                        </div>
                        <Badge variant={l.status === "realizado" ? "default" : "outline"} className="text-[10px]">{l.status}</Badge>
                      </div>
                    ))}
                    {!leadSelecionado.lembretes?.length && <p className="text-xs text-muted-foreground text-center py-4">Nenhum lembrete agendado.</p>}
                  </div>
                </TabsContent>

                {/* MOVER ETAPA */}
                <TabsContent value="mover" className="mt-3">
                  <p className="text-xs text-muted-foreground mb-3">Mova este lead para outra etapa do funil:</p>
                  <div className="space-y-2">
                    {ORDEM_ESTAGIOS.map(e => {
                      const cfg = ESTAGIOS_CONFIG[e];
                      const isAtual = e === leadSelecionado.estagio;
                      return (
                        <button
                          key={e}
                          disabled={isAtual}
                          onClick={() => moverLead(e)}
                          className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs font-medium flex items-center justify-between transition-all ${isAtual ? `${cfg.corBg} ${cfg.cor} border-current` : "bg-white border-slate-200 hover:border-primary/40 hover:bg-primary/5"}`}
                        >
                          {cfg.label}
                          {isAtual ? <span className="text-[10px] opacity-60">Etapa atual</span> : <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
                        </button>
                      );
                    })}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ====== MODAL TEMPLATES IA ====== */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-violet-500" /> Templates de Mensagem — IA Comercial
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {Object.entries(TEMPLATES_MENSAGEM).map(([key, tpl]) => {
              const msg = tpl.texto
                .replace("{{nome}}", leadSelecionado?.nomeContato || "Lead")
                .replace("{{empresa}}", leadSelecionado?.empresa || "empresa")
                .replace("{{segmento}}", leadSelecionado?.segmento || "segmento");
              return (
                <Card key={key} className="border-slate-200">
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      {tpl.titulo}
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(msg); toast.success("Copiado!"); }}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 leading-relaxed">{msg}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
