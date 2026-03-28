import { useState, useMemo } from "react";
import { Plus, MoreHorizontal, Clock, DollarSign, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type Opportunity = {
  id: string;
  empresa: string;
  contato: string;
  valorEstimado: number;
  estagio: string;
  responsavel: string;
  dias: number;
  urgencia: "alta" | "media" | "baixa";
};

const INITIAL_DATA: Opportunity[] = [
  { id: "1", empresa: "Logística Alpha", contato: "Carlos", valorEstimado: 15000, estagio: "prospeccao", responsavel: "DB", dias: 2, urgencia: "media" },
  { id: "2", empresa: "Distribuidora Beta", contato: "Ana", valorEstimado: 45000, estagio: "qualificacao", responsavel: "JS", dias: 5, urgencia: "alta" },
  { id: "3", empresa: "Indústria Gamma", contato: "Roberto", valorEstimado: 120000, estagio: "proposta", responsavel: "DB", dias: 12, urgencia: "alta" },
  { id: "4", empresa: "Comércio Delta", contato: "Mariana", valorEstimado: 8000, estagio: "negociacao", responsavel: "AM", dias: 20, urgencia: "baixa" },
];

const COLUNAS = [
  { id: "prospeccao", nome: "Prospecção", cor: "bg-slate-200 text-slate-700 border-slate-300" },
  { id: "qualificacao", nome: "Qualificação", cor: "bg-blue-100 text-blue-700 border-blue-200" },
  { id: "proposta", nome: "Proposta", cor: "bg-orange-100 text-orange-700 border-orange-200" },
  { id: "negociacao", nome: "Negociação", cor: "bg-purple-100 text-purple-700 border-purple-200" },
  { id: "ganho", nome: "Ganho", cor: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { id: "perdido", nome: "Perdido", cor: "bg-red-100 text-red-800 border-red-200" }
];

export default function CrmKanban() {
  const [oportunidades, setOportunidades] = useState<Opportunity[]>(INITIAL_DATA);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  
  // Drawer States
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [novoLead, setNovoLead] = useState<Partial<Opportunity>>({ estagio: "prospeccao", urgencia: "media" });

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // HTML5 Drag and Drop Handlers
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
    setOportunidades(prev => prev.map(o => o.id === draggedItem ? { ...o, estagio } : o));
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
      urgencia: novoLead.urgencia as any || "media"
    }]);
    setDrawerOpen(false);
    toast.success("Oportunidade criada com sucesso.");
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

       <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent className="sm:max-w-md">
             <SheetHeader>
                <SheetTitle>Nova Oportunidade / Lead</SheetTitle>
                <SheetDescription>Inicie um novo ciclo de venda cadastrando a prospecção.</SheetDescription>
             </SheetHeader>
             <div className="space-y-4 my-6">
                <div className="space-y-1">
                  <Label className="text-xs">Empresa Real</Label>
                  <SearchableSelect table="clientes" labelField="nome_fantasia" valueField="nome_fantasia" searchFields={["nome_fantasia", "razao_social"]} value={novoLead.empresa} onChange={(v) => setNovoLead(p => ({...p, empresa: v || ""}))} placeholder="Busque ou digite a empresa..."/>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1"><Label className="text-xs">Contato Chave</Label><Input value={novoLead.contato || ""} onChange={e => setNovoLead(p => ({...p, contato: e.target.value}))}/></div>
                   <div className="space-y-1"><Label className="text-xs">Urgência Comercial</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={novoLead.urgencia} onChange={e => setNovoLead(p => ({...p, urgencia: e.target.value as any}))}>
                         <option value="alta">Alta Demanda</option><option value="media">Média</option><option value="baixa">Baixa (Fria)</option>
                      </select>
                   </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Potencial de Fechamento Monetário (R$)</Label>
                  <Input type="number" value={novoLead.valorEstimado || ""} onChange={e => setNovoLead(p => ({...p, valorEstimado: Number(e.target.value)}))} placeholder="Ex: 50000"/>
                </div>
                <Button className="w-full mt-4" onClick={saveOportunidade}>Salvar Oportunidade</Button>
             </div>
          </SheetContent>
       </Sheet>
    </div>
  );
}
