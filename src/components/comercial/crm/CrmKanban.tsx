import { useState, useMemo } from "react";
import { Plus, MoreHorizontal, Clock, DollarSign, Building, Calendar, Phone, Mail, MessageSquare, CheckCircle, XCircle, AlertCircle, FileText, User, MapPin, Edit, Trash2, Send, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

type Opportunity = {
  id: string;
  empresa: string;
  contato: string;
  valorEstimado: number;
  estagio: string;
  responsavel: string;
  dias: number;
  urgencia: "alta" | "media" | "baixa";
  valorContrato?: number;
  qtdVeiculos?: number;
  tiposVeiculo?: string[];
  regioes?: string[];
  volumeMensal?: number;
  timeline?: TimelineItem[];
  lembretes?: LembretesItem[];
};

type TimelineItem = {
  id: string;
  data: Date;
  tipo: "criacao" | "atualizacao" | "proposta" | "ligacao" | "reuniao" | "email" | "whatsapp" | "obs";
  descricao: string;
  responsavel: string;
};

type LembretesItem = {
  id: string;
  data: Date;
  tipo: "reuniao" | "ligacao" | "retorno" | "email" | "whatsapp" | "prazo";
  descricao: string;
  responsavel: string;
  status: "pendente" | "realizado" | "cancelado";
  local?: string;
  participantes?: string[];
};

const INITIAL_DATA: Opportunity[] = [
  { id: "1", empresa: "Logística Alpha", contato: "Carlos", valorEstimado: 15000, estagio: "prospeccao", responsavel: "DB", dias: 2, urgencia: "media", valorContrato: 12000, qtdVeiculos: 3, tiposVeiculo: ["VUC", "Van"], regioes: ["SP Capital"], volumeMensal: 45 },
  { id: "2", empresa: "Distribuidora Beta", contato: "Ana", valorEstimado: 45000, estagio: "qualificacao", responsavel: "JS", dias: 5, urgencia: "alta", valorContrato: 38000, qtdVeiculos: 8, tiposVeiculo: ["Truck", "Carreta"], regioes: ["SP", "RJ", "MG"], volumeMensal: 120 },
  { id: "3", empresa: "Indústria Gamma", contato: "Roberto", valorEstimado: 120000, estagio: "proposta", responsavel: "DB", dias: 12, urgencia: "alta", valorContrato: 95000, qtdVeiculos: 15, tiposVeiculo: ["Carreta", "Bitrem"], regioes: ["SP", "PR", "SC"], volumeMensal: 280 },
  { id: "4", empresa: "Comércio Delta", contato: "Mariana", valorEstimado: 8000, estagio: "negociacao", responsavel: "AM", dias: 20, urgencia: "baixa", valorContrato: 6500, qtdVeiculos: 2, tiposVeiculo: ["Utilitário"], regioes: ["SP Capital"], volumeMensal: 25, timeline: [
    { id: "t1", data: new Date(2026, 2, 20), tipo: "criacao", descricao: "Oportunidade criada", responsavel: "DB" },
    { id: "t2", data: new Date(2026, 2, 22), tipo: "ligacao", descricao: "Primeiro contato realizado", responsavel: "AM" },
    { id: "t3", data: new Date(2026, 2, 25), tipo: "proposta", descricao: "Proposta enviada por email", responsavel: "AM" },
  ]},
];

const COLUNAS = [
  { id: "prospeccao", nome: "Prospecção", cor: "bg-slate-200 text-slate-700 border-slate-300" },
  { id: "qualificacao", nome: "Qualificação", cor: "bg-blue-100 text-blue-700 border-blue-200" },
  { id: "proposta", nome: "Proposta", cor: "bg-orange-100 text-orange-700 border-orange-200" },
  { id: "negociacao", nome: "Negociação", cor: "bg-purple-100 text-purple-700 border-purple-200" },
  { id: "ganho", nome: "Ganho", cor: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { id: "perdido", nome: "Perdido", cor: "bg-red-100 text-red-800 border-red-200" }
];

const tiposVeiculos = ["Van", "VUC", "Truck", "Toco", "Carreta", "Bitrem", "Rodotrem"];
const regioes = ["SP Capital", "SP Interior", "RJ", "MG", "PR", "SC", "RS", "BH", "Centro-Oeste", "Norte", "Nordeste"];
const tiposInteracao = [
  { value: "proposta", label: "Proposta enviada" },
  { value: "ligacao", label: "Ligação realizada" },
  { value: "reuniao", label: "Reunião agendada" },
  { value: "email", label: "E-mail enviado" },
  { value: "whatsapp", label: "WhatsApp enviado" },
  { value: "obs", label: "Observação registrada" },
];

export default function CrmKanban() {
  const [oportunidades, setOportunidades] = useState<Opportunity[]>(INITIAL_DATA);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detalheOpen, setDetalheOpen] = useState(false);
  const [oportunidadeSelecionada, setOportunidadeSelecionada] = useState<Opportunity | null>(null);
  const [novoLead, setNovoLead] = useState<Partial<Opportunity>>({ estagio: "prospeccao", urgencia: "media" });
  const [novaInteracao, setNovaInteracao] = useState({ tipo: "obs", descricao: "" });
  const [novoLembrete, setNovoLembrete] = useState<Partial<LembretesItem>>({ tipo: "ligacao", status: "pendente" });

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleDragStart = (id: string, e: React.DragEvent) => {
    setDraggedItem(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (estagio: string, e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedItem) return;
    setOportunidades(prev => prev.map(o => o.id === draggedItem ? { 
      ...o, 
      estagio,
      timeline: [...(o.timeline || []), {
        id: `t${Date.now()}`,
        data: new Date(),
        tipo: "atualizacao",
        descricao: `Moved to ${COLUNAS.find(c => c.id === estagio)?.nome}`,
        responsavel: "DB"
      }]
    } : o));
    setDraggedItem(null);
    toast.success(`Movido para ${COLUNAS.find(c => c.id === estagio)?.nome}`);
  };

  const saveOportunidade = () => {
    if (!novoLead.empresa || !novoLead.valorEstimado) return toast.error("Preencha empresa e valor estimado.");
    setOportunidades(prev => [...prev, {
      id: String(Date.now()),
      empresa: novoLead.empresa || "",
      contato: novoLead.contato || "N/A",
      valorEstimado: Number(novoLead.valorEstimado) || 0,
      estagio: "prospeccao",
      responsavel: "DB",
      dias: 0,
      urgencia: novoLead.urgencia as any || "media",
      timeline: [{
        id: `t${Date.now()}`,
        data: new Date(),
        tipo: "criacao",
        descricao: "Oportunidade criada",
        responsavel: "DB"
      }]
    }]);
    setDrawerOpen(false);
    toast.success("Oportunidade criada com sucesso.");
  };

  const openDetalhe = (opp: Opportunity) => {
    setOportunidadeSelecionada(opp);
    setDetalheOpen(true);
  };

  const adicionarInteracao = () => {
    if (!novaInteracao.descricao || !oportunidadeSelecionada) return;
    
    const interacao: TimelineItem = {
      id: `t${Date.now()}`,
      data: new Date(),
      tipo: novaInteracao.tipo as any,
      descricao: novaInteracao.descricao,
      responsavel: "DB"
    };
    
    setOportunidades(prev => prev.map(o => {
      if (o.id === oportunidadeSelecionada.id) {
        setOportunidadeSelecionada({...o, timeline: [...(o.timeline || []), interacao]});
        return {...o, timeline: [...(o.timeline || []), interacao]};
      }
      return o;
    }));
    
    setNovaInteracao({ tipo: "obs", descricao: "" });
    toast.success("Interação registrada.");
  };

  const adicionarLembrete = () => {
    if (!novoLembrete.descricao || !oportunidadeSelecionada) return;
    
    const lembrete: LembretesItem = {
      id: `l${Date.now()}`,
      data: novoLembrete.data || new Date(),
      tipo: novoLembrete.tipo as any,
      descricao: novoLembrete.descricao || "",
      responsavel: "DB",
      status: "pendente",
      local: novoLembrete.local,
    };
    
    setOportunidades(prev => prev.map(o => {
      if (o.id === oportunidadeSelecionada.id) {
        const updated = {...o, lembretes: [...(o.lembretes || []), lembrete]};
        setOportunidadeSelecionada(updated);
        return updated;
      }
      return o;
    }));
    
    setNovoLembrete({ tipo: "ligacao", status: "pendente" });
    toast.success("Lembrete agendado.");
  };

  const converterEmCliente = () => {
    if (!oportunidadeSelecionada) return;
    toast.success(`Convertendo ${oportunidadeSelecionada.empresa} em cliente... Redirecionando para cadastro.`);
    setDetalheOpen(false);
  };

  const getTimelineIcon = (tipo: string) => {
    switch (tipo) {
      case "criacao": return <Plus className="w-3 h-3" />;
      case "proposta": return <FileText className="w-3 h-3" />;
      case "ligacao": return <Phone className="w-3 h-3" />;
      case "reuniao": return <Calendar className="w-3 h-3" />;
      case "email": return <Mail className="w-3 h-3" />;
      case "whatsapp": return <MessageSquare className="w-3 h-3" />;
      default: return <Edit className="w-3 h-3" />;
    }
  };

  return (
    <div className="h-[calc(100vh-220px)] flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Pipeline de Vendas</h3>
          <p className="text-xs text-muted-foreground">Arraste os cards para atualizar o estágio no funil.</p>
        </div>
        <Button onClick={() => { setNovoLead({}); setDrawerOpen(true); }} className="bg-primary shadow gap-2">
          <Plus className="w-4 h-4" /> Nova Oportunidade
        </Button>
      </div>

      <div className="flex flex-1 gap-4 overflow-x-auto pb-4 items-start">
        {COLUNAS.map(col => {
          const colItems = oportunidades.filter(o => o.estagio === col.id);
          const colTotal = colItems.reduce((acc, curr) => acc + curr.valorEstimado, 0);

          return (
            <div 
              key={col.id} 
              className={`flex-shrink-0 w-80 max-h-full flex flex-col rounded-xl border-2 ${draggedItem && colItems ? 'border-primary/50 bg-slate-50/50' : 'border-slate-100 bg-slate-50/30'}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(col.id, e)}
            >
              <div className={`p-3 border-b-2 font-bold flex justify-between items-center rounded-t-lg ${col.cor} border-b-slate-200/50`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm uppercase tracking-wider">{col.nome}</span>
                  <Badge variant="secondary" className="bg-white/50 text-slate-800 rounded-full">{colItems.length}</Badge>
                </div>
                <span className="text-xs font-black">{fmt(colTotal)}</span>
              </div>

              <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar min-h-[150px]">
                {colItems.map(item => (
                  <div 
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(item.id, e)}
                    onClick={() => openDetalhe(item)}
                    className="bg-white border rounded-lg p-3 shadow-sm hover:shadow-md hover:border-primary/40 cursor-grab active:cursor-grabbing transition-all group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-1.5 text-slate-800 font-bold text-sm truncate">
                        <Building className="w-3.5 h-3.5 text-slate-400 shrink-0"/> {item.empresa}
                      </div>
                      <Button variant="ghost" size="icon" className="w-6 h-6 opacity-0 group-hover:opacity-100"><MoreHorizontal className="w-4 h-4"/></Button>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{item.contato}</p>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge variant="outline" className={`text-[10px] uppercase font-bold border-0 bg-opacity-20 ${item.urgencia === 'alta' ? 'bg-red-500 text-red-700' : item.urgencia === 'media' ? 'bg-orange-500 text-orange-700' : 'bg-green-500 text-green-700'}`}>
                        {item.urgencia}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-mono bg-slate-50"><Clock className="w-3 h-3 mr-1"/> {item.dias} dias</Badge>
                    </div>

                    <div className="border-t pt-2 flex justify-between items-center mt-1">
                      <span className="text-xs font-black text-emerald-600 flex items-center"><DollarSign className="w-3.5 h-3.5 mr-0.5"/> {item.valorEstimado.toLocaleString('pt-BR')}</span>
                      <Avatar className="w-6 h-6 border-2 border-white shadow-sm">
                        <AvatarFallback className="text-[9px] bg-primary text-primary-foreground font-bold">{item.responsavel}</AvatarFallback>
                      </Avatar>
                    </div>
                  </div>
                ))}
                {colItems.length === 0 && (
                  <div className="border-2 border-dashed border-slate-200 rounded-lg h-24 flex items-center justify-center text-xs text-slate-400 font-medium">
                    Solte o card aqui
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal Nova Oportunidade */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Nova Oportunidade / Lead</SheetTitle>
            <SheetDescription>Inicie um novo ciclo de venda cadastrando a prospecção.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 my-6">
            <div className="space-y-1">
              <Label className="text-xs">Empresa/Cliente</Label>
              <SearchableSelect table="clientes" labelField="nome_fantasia" valueField="nome_fantasia" searchFields={["nome_fantasia", "razao_social"]} value={novoLead.empresa} onChange={(v) => setNovoLead(p => ({...p, empresa: v || ""}))} placeholder="Busque ou digite o nome..."/>
              <p className="text-[10px] text-muted-foreground">Digite para criar como lead ou selecione cliente existente</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label className="text-xs">Contato Chave</Label><Input value={novoLead.contato || ""} onChange={e => setNovoLead(p => ({...p, contato: e.target.value}))}/></div>
              <div className="space-y-1"><Label className="text-xs">Urgência</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={novoLead.urgencia} onChange={e => setNovoLead(p => ({...p, urgencia: e.target.value as any}))}>
                  <option value="alta">Alta</option>
                  <option value="media">Média</option>
                  <option value="baixa">Baixa</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Valor Estimado (R$)</Label>
              <Input type="number" value={novoLead.valorEstimado || ""} onChange={e => setNovoLead(p => ({...p, valorEstimado: Number(e.target.value)}))} placeholder="Ex: 50000"/>
            </div>
            <Button className="w-full mt-4" onClick={saveOportunidade}>Salvar Oportunidade</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet de Detalhes */}
      <Sheet open={detalheOpen} onOpenChange={setDetalheOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              {oportunidadeSelecionada?.empresa}
            </SheetTitle>
            <SheetDescription>
              Oportunidade - {COLUNAS.find(c => c.id === oportunidadeSelecionada?.estagio)?.nome}
            </SheetDescription>
          </SheetHeader>

          <Tabs defaultValue="resumo" className="mt-4">
            <TabsList className="w-full">
              <TabsTrigger value="resumo" className="flex-1">Resumo</TabsTrigger>
              <TabsTrigger value="timeline" className="flex-1">Histórico</TabsTrigger>
              <TabsTrigger value="lembretes" className="flex-1">Agenda</TabsTrigger>
            </TabsList>

            {/* ABA RESUMO */}
            <TabsContent value="resumo" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Valor Estimado</p><p className="font-bold text-emerald-600">{fmt(oportunidadeSelecionada?.valorEstimado || 0)}</p></CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Volume Mensal</p><p className="font-bold">{oportunidadeSelecionada?.volumeMensal || 0} OS/mês</p></CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Contrato</p><p className="font-bold">{fmt(oportunidadeSelecionada?.valorContrato || 0)}/mês</p></CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Veículos</p><p className="font-bold">{oportunidadeSelecionada?.qtdVeiculos || 0}</p></CardContent></Card>
              </div>

              <div>
                <Label className="text-xs">Tipos de Veículo</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {oportunidadeSelecionada?.tiposVeiculo?.map(v => (
                    <Badge key={v} variant="outline" className="text-xs">{v}</Badge>
                  )) || <span className="text-xs text-muted-foreground">Não informado</span>}
                </div>
              </div>

              <div>
                <Label className="text-xs">Regiões Atendidas</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {oportunidadeSelecionada?.regioes?.map(r => (
                    <Badge key={r} variant="outline" className="text-xs bg-blue-50">{r}</Badge>
                  )) || <span className="text-xs text-muted-foreground">Não informado</span>}
                </div>
              </div>

              {oportunidadeSelecionada?.estagio === "ganho" && (
                <Button className="w-full bg-green-600 hover:bg-green-700" onClick={converterEmCliente}>
                  <User className="w-4 h-4 mr-2" /> Converter em Cliente
                </Button>
              )}
            </TabsContent>

            {/* ABA TIMELINE */}
            <TabsContent value="timeline" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Linha do Tempo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {oportunidadeSelecionada?.timeline?.length ? (
                    oportunidadeSelecionada.timeline.map(t => (
                      <div key={t.id} className="flex gap-3 text-sm">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                          {getTimelineIcon(t.tipo)}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{t.descricao}</p>
                          <p className="text-xs text-muted-foreground">
                            {t.data.toLocaleDateString("pt-BR")} - {t.responsavel}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma interação registrada.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Registrar Interação</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Select value={novaInteracao.tipo} onValueChange={(v) => setNovaInteracao({...novaInteracao, tipo: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {tiposInteracao.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Textarea placeholder="Descrição da interação..." value={novaInteracao.descricao} onChange={(e) => setNovaInteracao({...novaInteracao, descricao: e.target.value})} />
                  <Button className="w-full" onClick={adicionarInteracao}><Send className="w-4 h-4 mr-2" /> Registrar</Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ABA LEMBRETES */}
            <TabsContent value="lembretes" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Próximas Ações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {oportunidadeSelecionada?.lembretes?.length ? (
                    oportunidadeSelecionada.lembretes.map(l => (
                      <div key={l.id} className={`flex items-center justify-between p-2 rounded border ${l.status === "pendente" && new Date(l.data) < new Date() ? "bg-red-50 border-red-200" : "bg-white"}`}>
                        <div className="flex items-center gap-2">
                          {l.tipo === "reuniao" ? <Calendar className="w-4 h-4" /> : l.tipo === "ligacao" ? <Phone className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                          <div>
                            <p className="text-sm font-medium">{l.descricao}</p>
                            <p className="text-xs text-muted-foreground">{l.data.toLocaleString("pt-BR")}</p>
                          </div>
                        </div>
                        <Badge variant={l.status === "realizado" ? "default" : l.status === "cancelado" ? "secondary" : "outline"} className={l.status === "pendente" ? "bg-yellow-100 text-yellow-800" : ""}>
                          {l.status}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum lembrete agendado.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Agendar Lembrete</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={novoLembrete.tipo} onValueChange={(v) => setNovoLembrete({...novoLembrete, tipo: v as any})}>
                      <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reuniao">Reunião</SelectItem>
                        <SelectItem value="ligacao">Ligação</SelectItem>
                        <SelectItem value="retorno">Retorno</SelectItem>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="prazo">Prazo interno</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="datetime-local" value={novoLembrete.data?.toISOString().slice(0, 16) || ""} onChange={(e) => setNovoLembrete({...novoLembrete, data: new Date(e.target.value)})} />
                  </div>
                  <Input placeholder="Descrição da ação..." value={novoLembrete.descricao || ""} onChange={(e) => setNovoLembrete({...novoLembrete, descricao: e.target.value})} />
                  <Button className="w-full" onClick={adicionarLembrete}><Calendar className="w-4 h-4 mr-2" /> Agendar</Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}
