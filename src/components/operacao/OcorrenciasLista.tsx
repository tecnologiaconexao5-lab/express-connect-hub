import { useState } from "react";
import { AlertTriangle, Plus, Search, Eye, Camera, PenTool, CheckCircle, Clock } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const OcorrenciasLista = () => {
   const getStatusBadge = (s: string) => {
     switch (s) {
       case "aberta": return <Badge variant="secondary" className="bg-red-100 text-red-800 border border-red-200">Aberta</Badge>;
       case "tratativa": return <Badge variant="secondary" className="bg-orange-100 text-orange-800 border border-orange-200">Em Tratativa</Badge>;
       case "resolvida": return <Badge variant="secondary" className="bg-green-100 text-green-800 border border-green-200">Resolvida</Badge>;
       case "encerrada": return <Badge variant="outline" className="text-slate-500 border-slate-300 bg-slate-50">Encerrada</Badge>;
       default: return <Badge variant="outline">{s}</Badge>;
     }
   };

   return (
     <div className="space-y-4">
       <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
         <div className="relative flex-1 max-w-md">
           <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
           <Input placeholder="Buscar por OS, Prestador ou Tipo..." className="pl-9 h-10 w-full bg-card" />
         </div>
         <Button className="bg-red-600 hover:bg-red-700 text-white shadow-sm"><Plus className="w-4 h-4 mr-2" /> Lançar Ocorrência (SAC)</Button>
       </div>

       <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
         <Table>
           <TableHeader>
             <TableRow>
               <TableHead>Nº OS</TableHead>
               <TableHead>Tipo Incidente</TableHead>
               <TableHead>Data / Hora</TableHead>
               <TableHead>Motorista Envolvido</TableHead>
               <TableHead>Responsável (Culpa)</TableHead>
               <TableHead>SLA Máximo Alvo</TableHead>
               <TableHead>Status Resolução</TableHead>
               <TableHead className="text-right">Ação</TableHead>
             </TableRow>
           </TableHeader>
           <TableBody>
             <TableRow className="hover:bg-red-50/20 transition">
               <TableCell className="font-bold text-slate-800">OS-202610-8802</TableCell>
               <TableCell><Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 rounded">Avaria de Carga</Badge></TableCell>
               <TableCell className="text-xs text-muted-foreground whitespace-nowrap">27/03/2026 14:32</TableCell>
               <TableCell className="text-sm font-medium">Carlos Silva Agregado</TableCell>
               <TableCell className="text-sm">Prestador (Acidente)</TableCell>
               <TableCell className="text-sm"><span className="text-red-500 font-bold flex gap-1 items-center"><Clock className="w-3 h-3"/> -2h (Excedido)</span></TableCell>
               <TableCell>{getStatusBadge("aberta")}</TableCell>
               <TableCell className="text-right flex items-center justify-end gap-1">
                 <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600"><Eye className="w-4 h-4" /></Button>
                 <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-600"><PenTool className="w-4 h-4" /></Button>
               </TableCell>
             </TableRow>
             <TableRow>
               <TableCell className="font-bold text-slate-800">OS-10450-4411</TableCell>
               <TableCell><Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 rounded">Cliente Ausente</Badge></TableCell>
               <TableCell className="text-xs text-muted-foreground whitespace-nowrap">26/03/2026 09:15</TableCell>
               <TableCell className="text-sm font-medium">João Transportes ME</TableCell>
               <TableCell className="text-sm">Cliente Final (Destino)</TableCell>
               <TableCell className="text-sm">24h uteis</TableCell>
               <TableCell>{getStatusBadge("tratativa")}</TableCell>
               <TableCell className="text-right flex items-center justify-end gap-1">
                 <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600"><Eye className="w-4 h-4" /></Button>
                 <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-600"><PenTool className="w-4 h-4" /></Button>
               </TableCell>
             </TableRow>
             <TableRow className="opacity-75 bg-slate-50">
               <TableCell className="font-bold text-slate-800">OS-10450-3200</TableCell>
               <TableCell><Badge variant="outline" className="text-slate-600 border-slate-200 rounded">Dificuldade Acesso</Badge></TableCell>
               <TableCell className="text-xs text-muted-foreground whitespace-nowrap">20/03/2026 11:10</TableCell>
               <TableCell className="text-sm font-medium">Marcos Veículos</TableCell>
               <TableCell className="text-sm">Embraer S.A (Matriz)</TableCell>
               <TableCell className="text-sm">12h</TableCell>
               <TableCell>{getStatusBadge("resolvida")}</TableCell>
               <TableCell className="text-right flex items-center justify-end gap-1">
                 <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600"><CheckCircle className="w-4 h-4" /></Button>
               </TableCell>
             </TableRow>
           </TableBody>
         </Table>
       </div>
     </div>
   );
};

export default OcorrenciasLista;
