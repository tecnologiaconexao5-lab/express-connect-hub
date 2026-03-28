import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Filter, MapPin, Truck, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";

const CANDIDATOS = [
  { id: 1, nome: "Rafael Almeida", veiculo: "VUC / HR", regiao: "São Paulo - Leste", status: "Em Triagem", score: 88, semContato: 2 },
  { id: 2, nome: "Silvio Mendes", veiculo: "Carreta LS", regiao: "Campinas", status: "Interessado", score: 65, semContato: 5 },
  { id: 3, nome: "Júlio Agregados", veiculo: "3/4 Refrigerado", regiao: "Guarulhos", status: "Documentação", score: 95, semContato: 1 },
  { id: 4, nome: "Marcos Lima", veiculo: "Fiorino", regiao: "ABC Paulista", status: "Aprovado", score: 100, semContato: 8 },
];

export function BancoTalentos() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
         <div className="relative w-72">
           <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground"/>
           <Input placeholder="Buscar talento por veículo ou nome" className="pl-9 h-9 text-xs"/>
         </div>
         <div className="flex gap-2">
           <Button variant="outline" size="sm" className="h-9 gap-1"><Filter className="w-4 h-4"/> Filtros Avançados</Button>
           <Button size="sm" className="bg-primary text-xs h-9">Sugerir para OS Furtiva</Button>
         </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
               <TableRow>
                 <TableHead>Perfil</TableHead>
                 <TableHead>Operação Alvo</TableHead>
                 <TableHead>Jornada / Status</TableHead>
                 <TableHead>Score Perfil</TableHead>
                 <TableHead>Contato</TableHead>
                 <TableHead className="text-right">Ação</TableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {CANDIDATOS.map(c => (
                  <TableRow key={c.id}>
                     <TableCell>
                        <div className="flex items-center gap-3">
                           <Avatar className="w-10 h-10 border shadow-sm"><AvatarFallback className="font-bold text-slate-600 bg-slate-100">{c.nome.substring(0,2)}</AvatarFallback></Avatar>
                           <div>
                              <p className="text-sm font-bold text-slate-800">{c.nome}</p>
                              <p className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-1"><MapPin className="w-3 h-3"/> {c.regiao}</p>
                           </div>
                        </div>
                     </TableCell>
                     <TableCell><Badge variant="outline" className="bg-slate-50 text-slate-700 font-bold border-slate-200 gap-1.5"><Truck className="w-3.5 h-3.5"/> {c.veiculo}</Badge></TableCell>
                     <TableCell>
                        <Badge variant="outline" className={`uppercase text-[10px] tracking-wider py-1 font-black shadow-sm ${c.status === 'Aprovado' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : c.status === 'Interessado' ? 'bg-slate-100 text-slate-600 border-slate-300' : 'bg-orange-100 text-orange-800 border-orange-300'}`}>{c.status}</Badge>
                     </TableCell>
                     <TableCell>
                        <div className="flex items-center gap-2 max-w-[120px]">
                          <span className="text-xs font-bold text-slate-600 w-6">{c.score}</span>
                          <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                             <div className={`h-full ${c.score > 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{width: `${c.score}%`}}/>
                          </div>
                        </div>
                     </TableCell>
                     <TableCell>
                        {c.semContato > 5 ? <span className="text-[10px] text-red-600 font-bold bg-red-50 px-2 py-1 rounded">Sem interação há {c.semContato}d</span> : <span className="text-[10px] text-slate-500 font-mono">Contato há {c.semContato} dia(s)</span>}
                     </TableCell>
                     <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary"><ChevronRight className="w-4 h-4"/></Button>
                     </TableCell>
                  </TableRow>
               ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
