import { useState } from "react";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Filter, Search, Plus, MapPin, Truck, Smartphone, Check, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
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
import { toast } from "sonner";

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
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{prestadorId: number, data: Date} | null>(null);
  
  // Form Nova Reserva
  const [novoTurno, setNovoTurno] = useState("integral");
  const [novaOS, setNovaOS] = useState("");
  const [novoTipo, setNovoTipo] = useState("reserva");

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const diasSemana = Array.from({length: 6}).map((_, i) => addDays(weekStart, i)); // Seg a Sab

  const nextWeek = () => setCurrentDate(addDays(currentDate, 7));
  const prevWeek = () => setCurrentDate(addDays(currentDate, -7));

  const handleCellClick = (prestadorId: number, data: Date) => {
    setSelectedCell({prestadorId, data});
    setModalOpen(true);
  };

  const handleCreateReserva = () => {
     toast.success("Reserva salva. WhatsApp automático disparado para confirmação!");
     setModalOpen(false);
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
          <div className="p-4 border-b flex justify-between items-center bg-slate-50/50">
             <div>
               <h3 className="font-bold text-slate-800 flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-primary"/> Escala de Operação</h3>
               <p className="text-xs text-muted-foreground">Arraste ou clique na célula para configurar grade de alocação</p>
             </div>
             <div className="flex items-center gap-4">
                <div className="flex items-center bg-white border rounded-lg shadow-sm">
                   <Button variant="ghost" size="icon" onClick={prevWeek} className="h-9 w-9 rounded-r-none"><ChevronLeft className="w-4 h-4"/></Button>
                   <div className="px-4 text-sm font-bold border-x text-slate-700 min-w-[200px] text-center">
                      Semana {format(weekStart, "dd/MM")} - {format(diasSemana[5], "dd/MM")}
                   </div>
                   <Button variant="ghost" size="icon" onClick={nextWeek} className="h-9 w-9 rounded-l-none"><ChevronRight className="w-4 h-4"/></Button>
                </div>
                <Button className="h-9 gap-2"><Plus className="w-4 h-4"/> Alocar</Button>
             </div>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar">
             <div className="min-w-[800px]">
                <div className="grid grid-cols-[200px_repeat(6,1fr)] bg-slate-100/50 border-b">
                   <div className="p-3 border-r font-bold text-xs uppercase text-slate-500 flex items-center">Recurso</div>
                   {diasSemana.map((d, i) => (
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
                         {diasSemana.map((d, i) => {
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
         <DialogContent className="sm:max-w-md">
           <DialogHeader>
             <DialogTitle>Gerenciar Alocação de Recurso</DialogTitle>
             <DialogDescription>
               Defina o bloqueio na Malha Logística para <strong className="text-slate-800">{prestadorAtivo?.nome}</strong> em <strong className="text-slate-800">{selectedCell?.data ? format(selectedCell.data, "dd/MM/yyyy") : ''}</strong>.
             </DialogDescription>
           </DialogHeader>
           
           <div className="space-y-4 py-4">
             <div className="space-y-1">
                <Label className="text-xs">OS Vinculada (Opcional)</Label>
                <SearchableSelect table="ordens_servico" labelField="numero" searchFields={["numero"]} value={novaOS} onChange={v => setNovaOS(v||"")} placeholder="Associe uma OS..."/>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                   <Label className="text-xs">Turno da Alocação</Label>
                   <Select value={novoTurno} onValueChange={setNovoTurno}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                         <SelectItem value="integral">Dia Integral</SelectItem>
                         <SelectItem value="manha">Manhã (06 as 14)</SelectItem>
                         <SelectItem value="tarde">Tarde (14 as 22)</SelectItem>
                      </SelectContent>
                   </Select>
                </div>
                <div className="space-y-1">
                   <Label className="text-xs">Natureza da Reserva</Label>
                   <Select value={novoTipo} onValueChange={setNovoTipo}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                         <SelectItem value="reserva">Reserva Operacional Real</SelectItem>
                         <SelectItem value="bloqueio">Bloqueio Protetivo (Folga)</SelectItem>
                      </SelectContent>
                   </Select>
                </div>
             </div>
             <div className="space-y-1">
                <Label className="text-xs">Instruções Prévias / Observações</Label>
                <Textarea placeholder="Ex: Necessário chegar 30m antes na base para carregar." rows={2}/>
             </div>
           </div>

           <DialogFooter className="flex justify-between items-center sm:justify-between">
             <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-emerald-50/50 gap-2 font-bold text-xs" onClick={() => toast.success("Mensagem reenviada!")}>
               <MessageCircle className="w-4 h-4"/> Confirmar via WA
             </Button>
             <Button onClick={handleCreateReserva}>Salvar na Grade</Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
    </div>
  );
}
