import { useState } from "react";
import { Phone, Mail, MapPin, Presentation, CalendarDays, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CrmAtividades() {
  const [atividades] = useState([
    { id: 1, tipo: "call", titulo: "Alinhamento Tabelas VUC", cliente: "Tech Nova S.A.", hora: "Hoje, 14:00", responsavel: "Diego", icon: Phone, cor: "bg-blue-100 text-blue-600" },
    { id: 2, tipo: "visita", titulo: "Apresentação ECH Comercial", cliente: "Indústria Gamma", hora: "Amanhã, 09:30", responsavel: "Diego", icon: MapPin, cor: "bg-purple-100 text-purple-600" },
    { id: 3, tipo: "email", titulo: "Envio de Proposta", cliente: "Distribuidora Beta", hora: "Sexta, 11:00", responsavel: "Admin", icon: Mail, cor: "bg-orange-100 text-orange-600" }
  ]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
       <Card className="min-h-[400px]">
          <div className="p-4 border-b bg-slate-50 rounded-t-xl flex justify-between items-center">
             <h3 className="font-bold text-slate-800 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-primary"/> Agenda Semanal</h3>
             <Button size="sm" className="h-8 text-xs">Agendar Tarefa</Button>
          </div>
          <CardContent className="p-0 border-r border-slate-100 flex-1">
             <div className="p-8 text-center text-slate-400 border-b border-dashed">
                <p className="text-sm font-medium">Visualização Rápida de Calendário Interativo</p>
                <p className="text-xs mt-1">Nenhum evento sobreposto para hoje.</p>
             </div>
             <div className="p-4 space-y-3">
               <h4 className="text-xs uppercase font-bold text-slate-500 mb-2">Próximos Follow-ups</h4>
               {atividades.map((a) => (
                  <div key={a.id} className="flex gap-3 items-start group">
                     <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${a.cor}`}>
                        <a.icon className="w-4 h-4"/>
                     </div>
                     <div className="flex-1 bg-white border border-slate-100 p-2.5 rounded-lg shadow-sm group-hover:border-primary/30 transition">
                        <div className="flex justify-between items-start mb-1">
                           <p className="text-sm font-bold text-slate-800">{a.titulo}</p>
                           <p className="text-[10px] font-mono font-bold bg-slate-100 px-1.5 rounded text-slate-600">{a.hora}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">C/ {a.cliente}</p>
                        <div className="flex gap-2">
                           <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 uppercase tracking-wide gap-1 text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200">
                             <CheckCircle2 className="w-3 h-3"/> Concluir
                           </Button>
                        </div>
                     </div>
                  </div>
               ))}
             </div>
          </CardContent>
       </Card>
       <Card className="bg-slate-50 border-dashed justify-center items-center flex">
          <div className="text-center p-8 opacity-70">
             <Presentation className="w-16 h-16 text-slate-300 mx-auto mb-4"/>
             <h4 className="font-bold text-slate-600">Analytics de Performance</h4>
             <p className="text-sm text-slate-500 mt-2">Visão integrada do desempenho comercial: ligações totais, conversões em visitas e taxa de fechamento. </p>
          </div>
       </Card>
    </div>
  )
}
