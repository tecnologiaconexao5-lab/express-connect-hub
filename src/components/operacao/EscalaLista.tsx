import { useState } from "react";
import { Calendar, Plus, CalendarCheck, Users, Search, Truck } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const EscalaLista = () => {
   return (
     <div className="space-y-6">
       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <Card className="bg-primary/5 border-primary/20"><CardContent className="p-4 flex flex-col items-center text-center"><CalendarCheck className="w-8 h-8 text-primary mb-2"/><p className="text-xl font-bold text-primary">Sexta, 27/03</p><p className="text-xs text-muted-foreground uppercase font-semibold">Hoje</p></CardContent></Card>
         <Card><CardContent className="p-4"><p className="text-xs text-slate-500 uppercase font-bold mb-1 mt-2">Disponíveis Hoje (Reserva)</p><p className="text-3xl font-black text-slate-800">14 <span className="text-sm font-medium text-muted-foreground">Prestadores</span></p></CardContent></Card>
         <Card><CardContent className="p-4"><p className="text-xs text-blue-500 uppercase font-bold mb-1 mt-2">Agendados / Confirmados</p><p className="text-3xl font-black text-blue-600">32 <span className="text-sm font-medium text-blue-400">Escalados</span></p></CardContent></Card>
         <Card><CardContent className="p-4"><p className="text-xs text-orange-500 uppercase font-bold mb-1 mt-2">Pendentes de Aceite (App)</p><p className="text-3xl font-black text-orange-600">03 <span className="text-sm font-medium text-orange-400">Avisados</span></p></CardContent></Card>
       </div>

       <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-4 rounded-lg border shadow-sm">
         <div className="flex gap-2 flex-1 w-full max-w-lg">
           <div className="relative flex-1">
             <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
             <Input placeholder="Filtrar por região, veículo ou nome..." className="pl-9 h-10 w-full" />
           </div>
         </div>
         <Button className="bg-blue-600 hover:bg-blue-700 text-white"><Plus className="w-4 h-4 mr-2" /> Nova Reserva de Agenda</Button>
       </div>

       <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
         <div className="p-3 bg-slate-50 border-b flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-700 flex items-center gap-2"><Users className="w-4 h-4 text-primary"/> Quadro Operacional da Semana (D+1, D+2)</h3>
            <div className="flex gap-2 text-xs">
               <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">Confirmados</Badge>
               <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">Pendentes</Badge>
               <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Recusas / Faltas</Badge>
            </div>
         </div>
         <Table>
           <TableHeader>
             <TableRow>
               <TableHead>Prestador Base</TableHead>
               <TableHead>Veículo Principal</TableHead>
               <TableHead className="text-center font-bold">Hoje (27/03)</TableHead>
               <TableHead className="text-center">Sábado (28/03)</TableHead>
               <TableHead className="text-center">Domingo (29/03)</TableHead>
               <TableHead className="text-center">Segunda (30/03)</TableHead>
             </TableRow>
           </TableHeader>
           <TableBody>
             <TableRow>
               <TableCell className="font-bold text-slate-800 text-sm">João Transportes</TableCell>
               <TableCell className="text-xs text-muted-foreground"><Truck className="w-3 h-3 inline mr-1"/> Truck / Refrigerado</TableCell>
               <TableCell className="text-center p-1"><div className="bg-green-100 text-green-800 text-[10px] uppercase font-bold p-1.5 rounded w-full border border-green-200">Em Rota (T1)</div></TableCell>
               <TableCell className="text-center p-1"><div className="bg-green-100 text-green-800 text-[10px] uppercase font-bold p-1.5 rounded w-full border border-green-200">Rota Matinal (Confirmado)</div></TableCell>
               <TableCell className="text-center p-1"><div className="bg-slate-100 text-slate-400 text-[10px] uppercase font-bold p-1.5 rounded w-full border-dashed border">Folga DSR</div></TableCell>
               <TableCell className="text-center p-1"><div className="bg-orange-100 text-orange-800 text-[10px] uppercase font-bold p-1.5 rounded w-full border border-orange-200">Aguardando App</div></TableCell>
             </TableRow>
             <TableRow>
               <TableCell className="font-bold text-slate-800 text-sm">Carlos Agregado</TableCell>
               <TableCell className="text-xs text-muted-foreground"><Truck className="w-3 h-3 inline mr-1"/> Fiorino / Seca</TableCell>
               <TableCell className="text-center p-1"><div className="bg-blue-100 text-blue-800 text-[10px] uppercase font-bold p-1.5 rounded w-full border border-blue-200">Dedicado (Base Cliente)</div></TableCell>
               <TableCell className="text-center p-1"><div className="bg-slate-100 text-slate-400 text-[10px] uppercase font-bold p-1.5 rounded w-full border-dashed border">Alocado c/ Folga</div></TableCell>
               <TableCell className="text-center p-1"><div className="bg-slate-100 text-slate-400 text-[10px] uppercase font-bold p-1.5 rounded w-full border-dashed border">Folga</div></TableCell>
               <TableCell className="text-center p-1"><div className="bg-green-100 text-green-800 text-[10px] uppercase font-bold p-1.5 rounded w-full border border-green-200">Confirmado T1</div></TableCell>
             </TableRow>
             <TableRow>
               <TableCell className="font-bold text-slate-800 text-sm">Pedro Spot 12</TableCell>
               <TableCell className="text-xs text-muted-foreground"><Truck className="w-3 h-3 inline mr-1"/> Van (Geral)</TableCell>
               <TableCell className="text-center p-1"><div className="bg-red-100 text-red-800 text-[10px] uppercase font-bold p-1.5 rounded w-full border border-red-200">Mot. Faltou / Mecânica</div></TableCell>
               <TableCell className="text-center p-1"><div className="bg-orange-100 text-orange-800 text-[10px] uppercase font-bold p-1.5 rounded w-full border border-orange-200">Convocado (Substituição)</div></TableCell>
               <TableCell className="text-center p-1"><div className="bg-slate-100 text-slate-400 text-[10px] uppercase font-bold p-1.5 rounded w-full border-dashed border">No Radar</div></TableCell>
               <TableCell className="text-center p-1"><div className="bg-slate-100 text-slate-400 text-[10px] uppercase font-bold p-1.5 rounded w-full border-dashed border">No Radar</div></TableCell>
             </TableRow>
           </TableBody>
         </Table>
       </div>
     </div>
   );
};

export default EscalaLista;
