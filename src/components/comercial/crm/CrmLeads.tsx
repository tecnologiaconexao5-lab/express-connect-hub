import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Search, Activity } from "lucide-react";

export default function CrmLeads() {
  const [leads] = useState([
    { id: 1, empresa: "Tech Nova S.A.", contato: "Mariana", cargo: "Gerente Logística", fonte: "Inbound Marketing", score: 85, status: "Novo", data: "2024-03-20" },
    { id: 2, empresa: "Agro Sul", contato: "Paulo", cargo: "Diretor", fonte: "Evento", score: 60, status: "Em Contato", data: "2024-03-21" },
    { id: 3, empresa: "Varejo Rápido", contato: "Fernanda", cargo: "Analista", fonte: "Indicação", score: 92, status: "Qualificado", data: "2024-03-22" },
  ]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
           <div>
             <CardTitle className="text-lg">Gestão e Qualificação de Leads</CardTitle>
             <CardDescription>Critério de score termômetro automático. 0-100 pontos.</CardDescription>
           </div>
           <div className="relative w-64">
             <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground"/>
             <Input placeholder="Pesquisar CRM..." className="pl-9 h-9 text-xs"/>
           </div>
        </CardHeader>
        <CardContent>
           <Table>
              <TableHeader>
                 <TableRow className="bg-slate-50">
                    <TableHead>Empresa e Contato</TableHead>
                    <TableHead>Canal / Fonte</TableHead>
                    <TableHead>Score IA</TableHead>
                    <TableHead>Status Lead</TableHead>
                    <TableHead>Última Ação</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                 {leads.map(ld => (
                   <TableRow key={ld.id}>
                      <TableCell>
                         <p className="font-bold text-slate-800 flex items-center gap-2">{ld.empresa}</p>
                         <p className="text-xs text-muted-foreground mt-0.5">{ld.contato} — <span className="text-slate-500">{ld.cargo}</span></p>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{ld.fonte}</Badge></TableCell>
                      <TableCell>
                         <div className="flex items-center gap-2">
                           <Activity className={`w-3.5 h-3.5 ${ld.score >= 80 ? 'text-green-500' : ld.score >= 50 ? 'text-yellow-500' : 'text-red-500'}`}/>
                           <div className="w-16 bg-slate-200 h-2 rounded-full overflow-hidden">
                              <div className={`h-full ${ld.score >= 80 ? 'bg-green-500' : ld.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{width: `${ld.score}%`}}/>
                           </div>
                           <span className="text-xs font-bold text-slate-600">{ld.score}</span>
                         </div>
                      </TableCell>
                      <TableCell>
                         <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${ld.status === 'Qualificado' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{ld.status}</span>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-slate-500">{ld.data}</TableCell>
                      <TableCell className="text-right">
                         <Button variant="outline" size="sm" className="h-8 text-xs font-bold gap-1 text-primary hover:text-primary">Converter <ArrowRight className="w-3.5 h-3.5"/></Button>
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
