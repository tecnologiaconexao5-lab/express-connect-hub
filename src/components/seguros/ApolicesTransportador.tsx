import { useState } from "react";
import { Plus, Search, Verified, AlertCircle, ShieldOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const mockApolices = [
  { id: 1, seguradora: "Porto Seguro S.A", rctrc: "RCT-9988776655", rcdc: "RDC-887755", dataInicio: "2025-01-01", dataFim: "2026-12-31", maxEmbarque: 1500000, indenizacao: 5000000, franquia: 2500, tipoCobertura: "Carga Geral", GR: "Buonny" },
  { id: 2, seguradora: "Tokio Marine", rctrc: "RCT-11223344", rcdc: "RDC-443322", dataInicio: "2024-05-10", dataFim: "2026-05-10", maxEmbarque: 800000, indenizacao: 2500000, franquia: 1000, tipoCobertura: "Fármaco e Sensíveis", GR: "Guepardo" },
  { id: 3, seguradora: "Sompo Seguros", rctrc: "RCT-884433", rcdc: "-", dataInicio: "2023-01-15", dataFim: "2026-04-15", maxEmbarque: 350000, indenizacao: 1000000, franquia: 800, tipoCobertura: "Carga Fracionada Padrão", GR: "Opentech" },
];

export default function ApolicesTransportador() {
  const isVencendo = (date: string) => {
    const timeDiff = new Date(date).getTime() - new Date().getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return daysDiff <= 15 && daysDiff > 0;
  };
  const isVencido = (date: string) => new Date(date).getTime() < new Date().getTime();

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
          <div className="relative w-full max-w-sm">
             <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
             <Input placeholder="Buscar seguradora, RCTR-C..." className="pl-9 bg-card" />
          </div>
          <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700">
             <Plus className="w-4 h-4" /> Nova Apólice
          </Button>
       </div>

       <Card className="shadow-sm border-t-2 border-slate-200">
         <CardContent className="p-0">
           <Table>
             <TableHeader className="bg-slate-50">
                <TableRow>
                   <TableHead>Seguradora</TableHead>
                   <TableHead>Apólices (RCTR-C / RC-DC)</TableHead>
                   <TableHead>Validade</TableHead>
                   <TableHead>Limites (LMI)</TableHead>
                   <TableHead>Gerenciadora (GR)</TableHead>
                   <TableHead>Status</TableHead>
                   <TableHead className="text-right">Ações</TableHead>
                </TableRow>
             </TableHeader>
             <TableBody>
                {mockApolices.map(ap => {
                   const expired = isVencido(ap.dataFim);
                   const warning = isVencendo(ap.dataFim);
                   return (
                     <TableRow key={ap.id}>
                        <TableCell>
                           <p className="font-bold text-slate-800">{ap.seguradora}</p>
                           <p className="text-[10px] text-muted-foreground">{ap.tipoCobertura}</p>
                        </TableCell>
                        <TableCell>
                           <div className="text-xs">
                             <p><span className="font-semibold">RCTR-C:</span> {ap.rctrc}</p>
                             <p><span className="font-semibold">RC-DC:</span> {ap.rcdc}</p>
                           </div>
                        </TableCell>
                        <TableCell>
                           <div className="text-xs">
                             <p>Início: {new Date(ap.dataInicio).toLocaleDateString('pt-BR')}</p>
                             <p className="font-bold">Fim: {new Date(ap.dataFim).toLocaleDateString('pt-BR')}</p>
                           </div>
                        </TableCell>
                        <TableCell>
                           <div className="text-xs font-mono">
                              <p className="text-emerald-700 font-bold">Max Embarque: R$ {(ap.maxEmbarque).toLocaleString()}</p>
                              <p className="text-slate-500">Franquia: R$ {ap.franquia}</p>
                           </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="bg-slate-100">{ap.GR}</Badge></TableCell>
                        <TableCell>
                           {expired ? (
                             <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200 gap-1"><ShieldOff className="w-3 h-3"/> Vencido</Badge>
                           ) : warning ? (
                             <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 gap-1 animate-pulse"><AlertCircle className="w-3 h-3"/> Vencendo</Badge>
                           ) : (
                             <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1"><Verified className="w-3 h-3"/> Ativo</Badge>
                           )}
                        </TableCell>
                        <TableCell className="text-right">
                           <Button variant="ghost" size="sm" className="text-xs">Visualizar</Button>
                        </TableCell>
                     </TableRow>
                   )
                })}
             </TableBody>
           </Table>
         </CardContent>
       </Card>
    </div>
  );
}
