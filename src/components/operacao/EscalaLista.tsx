import { useState } from "react";
import { format, addDays, startOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Filter, Search, Plus, MapPin, Truck, Smartphone, Check, ChevronLeft, ChevronRight, MessageCircle, FileText, Download, Wallet, Clock, DollarSign, Percent } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type Periodo = 'semanal' | 'quinzenal' | 'mensal';

interface AlocacaoFinanceiro {
  valorTipo: 'percentual' | 'fixo';
  valorPercentual: number;
  valorFixo: number;
  combustivel: number;
  kmRodados: number;
  valorKm: number;
  pedagio: number;
  pedagioFranquia: number;
  pedagioExcedente: number;
  pedagioCobrarExcedente: boolean;
  diariasAdicionais: number;
  valorDiaria: number;
  segundaSaida: boolean;
  valorSegundaSaida: number;
  terceiraSaida: boolean;
  valorTerceiraSaida: number;
  saidasAdicionais: number;
  valorSaidaAdicional: number;
  ajudantes: number;
  valorAjudante: number;
  desconto: number;
  reembolsosOutros: string;
  valorReembolsoOutros: number;
}

// Mock data
const PRESTADORES = [
  { id: 1, nome: "João Silva", veiculo: "VUC", regiao: "Zona Sul SP", status: "disponivel", avatar: "JS" },
  { id: 2, nome: "Carlos Barros", veiculo: "Fiorino", regiao: "Guarulhos", status: "ocupado", avatar: "CB" },
  { id: 3, nome: "Ana Santos", veiculo: "3/4", regiao: "Campinas", status: "disponivel", avatar: "AS" },
  { id: 4, nome: "Marcos Lima", veiculo: "VUC", regiao: "ABC", status: "inativo", avatar: "ML" },
];

const RESERVAS = [
  { id: 1, prestadorId: 1, data: new Date().toISOString(), turno: "integral", status: "confirmado" },
  { id: 2, prestadorId: 3, data: addDays(new Date(), 1).toISOString(), turno: "manha", status: "aguardando" },
  { id: 3, prestadorId: 2, data: new Date().toISOString(), turno: "integral", status: "operacao" },
];

const CORES_STATUS: any = {
  disponivel: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-300",
  confirmado: "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-300",
  aguardando: "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-300 dashed-border",
  operacao: "bg-orange-500 text-white hover:bg-orange-600 border-orange-600",
  indisponivel: "bg-slate-100 text-slate-500 hover:bg-slate-200 border-slate-200",
};

export default function EscalaLista() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [periodo, setPeriodo] = useState<Periodo>('semanal');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{prestadorId: number, data: Date} | null>(null);
  
  // Form Nova Reserva
  const [novoTurno, setNovoTurno] = useState("integral");
  const [novaOS, setNovaOS] = useState("");
  const [novoTipo, setNovoTipo] = useState("reserva");
  const [horarioInicio, setHorarioInicio] = useState("08:00");
  const [horarioFim, setHorarioFim] = useState("18:00");
  
  // Dados Financeiros
  const [financeiro, setFinanceiro] = useState<AlocacaoFinanceiro>({
    valorTipo: 'percentual',
    valorPercentual: 0,
    valorFixo: 0,
    combustivel: 0,
    kmRodados: 0,
    valorKm: 0,
    pedagio: 0,
    pedagioFranquia: 100,
    pedagioExcedente: 0,
    pedagioCobrarExcedente: false,
    diariasAdicionais: 0,
    valorDiaria: 0,
    segundaSaida: false,
    valorSegundaSaida: 0,
    terceiraSaida: false,
    valorTerceiraSaida: 0,
    saidasAdicionais: 0,
    valorSaidaAdicional: 0,
    ajudantes: 0,
    valorAjudante: 0,
    desconto: 0,
    reembolsosOutros: '',
    valorReembolsoOutros: 0
  });

  // Alocações do período
  const [alocacoes, setAlocacoes] = useState<any[]>(RESERVAS.map(r => ({ ...r, ...financeiro })));

  const getDiasPeriodo = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    if (periodo === 'semanal') {
      return Array.from({length: 6}).map((_, i) => addDays(weekStart, i));
    } else if (periodo === 'quinzenal') {
      return Array.from({length: 15}).map((_, i) => addDays(weekStart, i));
    } else {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      return eachDayOfInterval({ start: monthStart, end: monthEnd });
    }
  };

  const diasPeriodo = getDiasPeriodo();

  const nextPeriodo = () => {
    if (periodo === 'semanal') setCurrentDate(addDays(currentDate, 7));
    else if (periodo === 'quinzenal') setCurrentDate(addDays(currentDate, 15));
    else setCurrentDate(addDays(endOfMonth(currentDate), 1));
  };

  const prevPeriodo = () => {
    if (periodo === 'semanal') setCurrentDate(addDays(currentDate, -7));
    else if (periodo === 'quinzenal') setCurrentDate(addDays(currentDate, -15));
    else setCurrentDate(addDays(startOfMonth(currentDate), -1));
  };

  const handleCellClick = (prestadorId: number, data: Date) => {
    setSelectedCell({prestadorId, data});
    setModalOpen(true);
  };

  const calcularTotalAlocacao = () => {
    const valorBase = financeiro.valorTipo === 'percentual' 
      ? (financeiro.valorPercentual / 100) * 1000 
      : financeiro.valorFixo;
    
    const totalAdicionais = 
      financeiro.combustivel +
      (financeiro.kmRodados * financeiro.valorKm) +
      financeiro.pedagio +
      (financeiro.diariasAdicionais * financeiro.valorDiaria) +
      (financeiro.segundaSaida ? financeiro.valorSegundaSaida : 0) +
      (financeiro.terceiraSaida ? financeiro.valorTerceiraSaida : 0) +
      (financeiro.saidasAdicionais * financeiro.valorSaidaAdicional) +
      (financeiro.ajudantes * financeiro.valorAjudante) +
      financeiro.valorReembolsoOutros;
    
    const totalDescontos = financeiro.desconto;
    
    return {
      valorBase,
      totalAdicionais,
      totalDescontos,
      total: valorBase + totalAdicionais - totalDescontos
    };
  };

  const handleCreateReserva = () => {
     const totals = calcularTotalAlocacao();
     const novaAlocacao = {
       id: Date.now(),
       prestadorId: selectedCell?.prestadorId,
       data: selectedCell?.data.toISOString(),
       turno: novoTurno,
       tipo: novoTipo,
       os: novaOS,
       financeiro,
       totals,
       statusPagamento: 'a pagar'
     };
     setAlocacoes([...alocacoes, novaAlocacao]);
     toast.success("Alocação salva! Valor: R$ " + totals.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
     setModalOpen(false);
  };

  const handleExportPDF = () => {
    toast.success("Gerando PDF da escala do período...");
  };

  const handleIncluirLote = () => {
    toast.success("Alocações incluidas no lote de pagamento!");
  };

  const prestadorAtivo = selectedCell ? PRESTADORES.find(p => p.id === selectedCell.prestadorId) : null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-[calc(100vh-230px)]">
       {/* Sidebar Prestadores */}
       <div className="xl:col-span-1 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
          <div className="p-4 border-b bg-slate-50/50">
             <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4"><Truck className="w-5 h-5 text-primary"/> Prestadores Homologados</h3>
             <div className="relative mb-3">
               <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground"/>
               <Input placeholder="Buscar por placa ou nome..." className="pl-9 text-xs h-9"/>
             </div>
             <div className="flex gap-2">
               <Select defaultValue="todos"><SelectTrigger className="text-xs h-8"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="todos">Qqr Veículo</SelectItem><SelectItem value="vuc">VUC</SelectItem><SelectItem value="fiorino">Fiorino</SelectItem></SelectContent></Select>
               <Button variant="outline" size="sm" className="h-8 px-2"><Filter className="w-4 h-4"/></Button>
             </div>
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-2 custom-scrollbar">
             {PRESTADORES.map(p => (
                <div key={p.id} className="p-3 bg-white border rounded-lg hover:border-primary/40 transition cursor-pointer flex gap-3 items-center group">
                   <Avatar className="w-10 h-10 border shadow-sm"><AvatarFallback className="bg-slate-100 text-slate-600 font-bold">{p.avatar}</AvatarFallback></Avatar>
                   <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-bold text-slate-800 truncate">{p.nome}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{p.veiculo} • {p.regiao}</p>
                   </div>
                   <div className={`w-2 h-2 rounded-full shrink-0 ${p.status === 'disponivel' ? 'bg-green-500' : p.status === 'ocupado' ? 'bg-orange-500' : 'bg-slate-300'}`}/>
                </div>
             ))}
          </div>
       </div>

       {/* Calendário Principal */}
       <div className="xl:col-span-3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col h-full overflow-hidden">
           <div className="p-4 border-b flex justify-between items-center bg-slate-50/50 flex-wrap gap-3">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-primary"/> Escala de Operação</h3>
                <p className="text-xs text-muted-foreground">Arraste ou clique na célula para configurar grade de alocação</p>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                 <div className="flex items-center bg-white border rounded-lg shadow-sm">
                    <Button variant="ghost" size="icon" onClick={prevPeriodo} className="h-9 w-9 rounded-r-none"><ChevronLeft className="w-4 h-4"/></Button>
                    <div className="px-4 text-sm font-bold border-x text-slate-700 min-w-[200px] text-center">
                       {periodo === 'mensal' ? format(currentDate, "MMMM yyyy", { locale: ptBR }) : 
                        `Semana ${format(diasPeriodo[0], "dd/MM")} - ${format(diasPeriodo[diasPeriodo.length-1], "dd/MM")}`}
                    </div>
                    <Button variant="ghost" size="icon" onClick={nextPeriodo} className="h-9 w-9 rounded-l-none"><ChevronRight className="w-4 h-4"/></Button>
                 </div>
                 <div className="flex bg-white border rounded-lg overflow-hidden">
                    <Button variant={periodo === 'semanal' ? 'default' : 'ghost'} size="sm" onClick={() => setPeriodo('semanal')} className="rounded-none h-9 text-xs">Semanal</Button>
                    <Button variant={periodo === 'quinzenal' ? 'default' : 'ghost'} size="sm" onClick={() => setPeriodo('quinzenal')} className="rounded-none h-9 text-xs">Quinzenal</Button>
                    <Button variant={periodo === 'mensal' ? 'default' : 'ghost'} size="sm" onClick={() => setPeriodo('mensal')} className="rounded-none h-9 text-xs">Mensal</Button>
                 </div>
                 <div className="flex gap-2">
                   <Button variant="outline" className="h-9 gap-2" onClick={handleExportPDF}><Download className="w-4 h-4"/> Exportar PDF</Button>
                   <Button variant="outline" className="h-9 gap-2" onClick={handleIncluirLote}><Wallet className="w-4 h-4"/> Incluir em Lote</Button>
                   <Button className="h-9 gap-2" onClick={() => { setSelectedCell(null); setModalOpen(true); }}><Plus className="w-4 h-4"/> Alocar</Button>
                 </div>
              </div>
           </div>

          <div className="flex-1 overflow-auto custom-scrollbar">
             <div className="min-w-[800px]">
                <div className="grid grid-cols-[200px_repeat(6,1fr)] bg-slate-100/50 border-b">
                   <div className="p-3 border-r font-bold text-xs uppercase text-slate-500 flex items-center">Recurso</div>
                   {diasPeriodo.map((d, i) => (
                      <div key={i} className={`p-3 border-r text-center ${isSameDay(d, new Date()) ? 'bg-primary/5 border-b-2 border-b-primary' : ''}`}>
                         <p className="text-[10px] uppercase font-bold text-slate-500">{format(d, "EEEE", {locale: ptBR})}</p>
                         <p className={`text-lg font-black ${isSameDay(d, new Date()) ? 'text-primary' : 'text-slate-800'}`}>{format(d, "dd/MM")}</p>
                      </div>
                   ))}
                </div>
                
                <div className="divide-y">
                   {PRESTADORES.map(p => (
                      <div key={p.id} className="grid grid-cols-[200px_repeat(6,1fr)] hover:bg-slate-50/50 transition">
                         <div className="p-3 border-r flex items-center gap-2 bg-white">
                            <span className="text-xs font-bold text-slate-700 truncate">{p.nome}</span>
                         </div>
                         {diasPeriodo.map((d, i) => {
                            // Find mock reserva
                            const res = RESERVAS.find(r => r.prestadorId === p.id && isSameDay(new Date(r.data), d));
                            let slotStatus = "disponivel";
                            let slotLabel = "Livre";
                            
                            if (p.status === "inativo") { slotStatus = "indisponivel"; slotLabel = "Inativo"; }
                            else if (res) {
                               slotStatus = res.status;
                               slotLabel = res.status === "confirmado" ? "Confirmado" : res.status === "aguardando" ? "Aguard. Conf" : "Em Rota";
                               if (res.turno !== "integral") slotLabel += ` (${res.turno})`;
                            }

                            return (
                               <div key={i} className="p-1 border-r min-h-[60px] cursor-pointer relative group" onClick={() => handleCellClick(p.id, d)}>
                                  <div className="absolute inset-0 group-hover:bg-slate-100/50 z-0"/>
                                  {res || p.status === 'inativo' ? (
                                    <div className={`relative z-10 w-full h-full rounded border flex items-center justify-center p-1 text-center shadow-sm transition ${CORES_STATUS[slotStatus]}`}>
                                       <span className="text-[10px] font-bold uppercase tracking-wider">{slotLabel}</span>
                                    </div>
                                  ) : (
                                    <div className="relative z-10 w-full h-full rounded border border-transparent group-hover:border-dashed group-hover:border-slate-300 flex items-center justify-center transition">
                                       <Plus className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100"/>
                                    </div>
                                  )}
                               </div>
                            )
                         })}
                      </div>
                   ))}
                </div>
             </div>
          </div>
       </div>

        {/* Modal de Reserva */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Gerenciar Alocação de Recurso</DialogTitle>
              <DialogDescription>
                Alocação para <strong className="text-slate-800">{prestadorAtivo?.nome || 'Novo Prestador'}</strong> em <strong className="text-slate-800">{selectedCell?.data ? format(selectedCell.data, "dd/MM/yyyy") : 'Data não selecionada'}</strong>.
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="dados" className="w-full">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="dados" className="text-xs"><FileText className="w-3 h-3 mr-1"/>Dados da Alocação</TabsTrigger>
                <TabsTrigger value="financeiro" className="text-xs"><DollarSign className="w-3 h-3 mr-1"/>Dados Financeiros</TabsTrigger>
                <TabsTrigger value="resumo" className="text-xs"><Check className="w-3 h-3 mr-1"/>Resumo do Dia</TabsTrigger>
              </TabsList>
              
              <TabsContent value="dados" className="space-y-4 py-4">
                <div className="space-y-1">
                   <Label className="text-xs">OS Vinculada</Label>
                   <SearchableSelect table="ordens_servico" labelField="numero" searchFields={["numero"]} value={novaOS} onChange={v => setNovaOS(v||"")} placeholder="Associe uma OS..."/>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <Label className="text-xs">Turno</Label>
                      <Select value={novoTurno} onValueChange={setNovoTurno}>
                         <SelectTrigger><SelectValue/></SelectTrigger>
                         <SelectContent>
                            <SelectItem value="integral">Dia Integral</SelectItem>
                            <SelectItem value="manha">Manhã (06-14)</SelectItem>
                            <SelectItem value="tarde">Tarde (14-22)</SelectItem>
                            <SelectItem value="noite">Noite (22-06)</SelectItem>
                            <SelectItem value="saida">Saída</SelectItem>
                            <SelectItem value="intermediario">Intermediário</SelectItem>
                         </SelectContent>
                      </Select>
                   </div>
                   <div className="space-y-1">
                      <Label className="text-xs">Tipo</Label>
                      <Select value={novoTipo} onValueChange={setNovoTipo}>
                         <SelectTrigger><SelectValue/></SelectTrigger>
                         <SelectContent>
                            <SelectItem value="disponibilidade">Disponibilidade</SelectItem>
                            <SelectItem value="reserva">Reserva Operacional</SelectItem>
                            <SelectItem value="bloqueio">Bloqueio</SelectItem>
                            <SelectItem value="afastamento">Afastamento</SelectItem>
                         </SelectContent>
                      </Select>
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <Label className="text-xs">Horário Início</Label>
                      <Input type="time" value={horarioInicio} onChange={e => setHorarioInicio(e.target.value)} />
                   </div>
                   <div className="space-y-1">
                      <Label className="text-xs">Horário Fim</Label>
                      <Input type="time" value={horarioFim} onChange={e => setHorarioFim(e.target.value)} />
                   </div>
                </div>
                <div className="space-y-1">
                   <Label className="text-xs">Instruções / Observações</Label>
                   <Textarea placeholder="Ex: Necessário chegar 30m antes na base." rows={2}/>
                </div>
              </TabsContent>
              
              <TabsContent value="financeiro" className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <Label className="text-xs">Valor do Prestador</Label>
                      <Select value={financeiro.valorTipo} onValueChange={v => setFinanceiro(f => ({ ...f, valorTipo: v as any }))}>
                         <SelectTrigger><SelectValue/></SelectTrigger>
                         <SelectContent>
                            <SelectItem value="percentual">% sobre tabela</SelectItem>
                            <SelectItem value="fixo">Valor Fixo (R$)</SelectItem>
                         </SelectContent>
                      </Select>
                   </div>
                   {financeiro.valorTipo === 'percentual' ? (
                     <div className="space-y-1">
                        <Label className="text-xs">Percentual (%)</Label>
                        <Input type="number" value={financeiro.valorPercentual} onChange={e => setFinanceiro(f => ({ ...f, valorPercentual: Number(e.target.value) }))} />
                     </div>
                   ) : (
                     <div className="space-y-1">
                        <Label className="text-xs">Valor Fixo (R$)</Label>
                        <Input type="number" value={financeiro.valorFixo} onChange={e => setFinanceiro(f => ({ ...f, valorFixo: Number(e.target.value) }))} />
                     </div>
                   )}
                </div>
                
                <div className="border-t pt-4">
                   <Label className="text-xs font-bold">Adicionais</Label>
                   <div className="grid grid-cols-3 gap-3 mt-2">
                      <div className="space-y-1">
                         <Label className="text-[10px]">Combustível (R$)</Label>
                         <Input type="number" value={financeiro.combustivel} onChange={e => setFinanceiro(f => ({ ...f, combustivel: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-1">
                         <Label className="text-[10px]">Km Rodados</Label>
                         <Input type="number" value={financeiro.kmRodados} onChange={e => setFinanceiro(f => ({ ...f, kmRodados: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-1">
                         <Label className="text-[10px]">R$/km</Label>
                         <Input type="number" value={financeiro.valorKm} onChange={e => setFinanceiro(f => ({ ...f, valorKm: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-1">
                         <Label className="text-[10px]">Pedágio (R$)</Label>
                         <Input type="number" value={financeiro.pedagio} onChange={e => setFinanceiro(f => ({ ...f, pedagio: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-1">
                         <Label className="text-[10px]">Franquia KM</Label>
                         <Input type="number" value={financeiro.pedagioFranquia} onChange={e => setFinanceiro(f => ({ ...f, pedagioFranquia: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-1">
                         <Label className="text-[10px]">Diárias Adic.</Label>
                         <Input type="number" value={financeiro.diariasAdicionais} onChange={e => setFinanceiro(f => ({ ...f, diariasAdicionais: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-1">
                         <Label className="text-[10px]">2ª Saída (R$)</Label>
                         <div className="flex items-center gap-2">
                           <Switch checked={financeiro.segundaSaida} onCheckedChange={v => setFinanceiro(f => ({ ...f, segundaSaida: v }))} />
                           <Input type="number" value={financeiro.valorSegundaSaida} onChange={e => setFinanceiro(f => ({ ...f, valorSegundaSaida: Number(e.target.value) }))} disabled={!financeiro.segundaSaida} />
                         </div>
                      </div>
                      <div className="space-y-1">
                         <Label className="text-[10px]">3ª Saída (R$)</Label>
                         <div className="flex items-center gap-2">
                           <Switch checked={financeiro.terceiraSaida} onCheckedChange={v => setFinanceiro(f => ({ ...f, terceiraSaida: v }))} />
                           <Input type="number" value={financeiro.valorTerceiraSaida} onChange={e => setFinanceiro(f => ({ ...f, valorTerceiraSaida: Number(e.target.value) }))} disabled={!financeiro.terceiraSaida} />
                         </div>
                      </div>
                      <div className="space-y-1">
                         <Label className="text-[10px]">Ajudantes (qtd)</Label>
                         <Input type="number" value={financeiro.ajudantes} onChange={e => setFinanceiro(f => ({ ...f, ajudantes: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-1">
                         <Label className="text-[10px]">R$/Ajudante</Label>
                         <Input type="number" value={financeiro.valorAjudante} onChange={e => setFinanceiro(f => ({ ...f, valorAjudante: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-1">
                         <Label className="text-[10px]">Desconto (R$)</Label>
                         <Input type="number" value={financeiro.desconto} onChange={e => setFinanceiro(f => ({ ...f, desconto: Number(e.target.value) }))} />
                      </div>
                   </div>
                </div>
              </TabsContent>
              
              <TabsContent value="resumo" className="py-4">
                <Card className="bg-slate-50">
                  <CardContent className="p-4 space-y-3">
                     {(() => {
                       const totals = calcularTotalAlocacao();
                       return (
                         <>
                           <div className="flex justify-between text-sm"><span>Valor Base:</span><span className="font-medium">R$ {totals.valorBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                           <div className="flex justify-between text-sm"><span className="text-muted-foreground">+ Adicionais:</span><span className="font-medium">R$ {totals.totalAdicionais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                           <div className="flex justify-between text-sm text-red-500"><span>- Descontos:</span><span className="font-medium">R$ {totals.totalDescontos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                           <hr/>
                           <div className="flex justify-between text-lg font-bold"><span>TOTAL DA ALOCAÇÃO:</span><span className="text-green-600">R$ {totals.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                           <div className="flex justify-between text-sm"><span className="text-muted-foreground">Margem estimada:</span><span className="font-medium text-blue-600">20% (R$ {(totals.total * 0.2).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})</span></div>
                           <div className="flex justify-between text-sm mt-2 pt-2 border-t">
                             <span className="text-muted-foreground">Status pagamento:</span>
                             <Badge variant="outline">A pagar</Badge>
                           </div>
                         </>
                       );
                     })()}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <DialogFooter className="flex justify-between items-center sm:justify-between">
              <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-emerald-50/50 gap-2 font-bold text-xs" onClick={() => toast.success("Mensagem enviada via WhatsApp!")}>
                <MessageCircle className="w-4 h-4"/> Confirmar via WA
              </Button>
              <Button onClick={handleCreateReserva}>Salvar na Grade</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
