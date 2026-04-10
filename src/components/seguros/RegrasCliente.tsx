import { Search, Filter, ShieldCheck, MailWarning, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const mockRegrasClientes = [
  { id: 1, cliente: "Amazon Logística", tipo: "Cliente DDR", cartaDdr: true, exigeGr: true, rastreamento: true, consultaMotorista: true, risco: "alto" },
  { id: 2, cliente: "Magazine Luiza", tipo: "Transportador", cartaDdr: false, exigeGr: true, rastreamento: true, consultaMotorista: true, risco: "médio" },
  { id: 3, cliente: "Industrias ABC", tipo: "Cliente DDR", cartaDdr: false, exigeGr: false, rastreamento: false, consultaMotorista: false, risco: "baixo" },
  { id: 4, cliente: "Samsung Eletrônicos", tipo: "Transportador", cartaDdr: false, exigeGr: true, rastreamento: true, consultaMotorista: true, risco: "alto" }
];

export default function RegrasCliente() {
  return (
    <div className="space-y-6">
       <div className="flex bg-slate-50 border p-3 rounded-xl justify-between items-center">
          <div className="flex gap-4 items-center w-full max-w-xl">
             <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                <Input placeholder="Buscar por Nome do Cliente ou CNPJ..." className="pl-9 bg-white" />
             </div>
             <Button variant="outline"><Filter className="w-4 h-4 mr-2"/> Filtrar Regras</Button>
          </div>
       </div>

       <Card className="shadow-sm border-t-2 border-indigo-500">
         <CardContent className="p-0">
           <Table>
             <TableHeader className="bg-slate-50">
               <TableRow>
                 <TableHead>Cliente Vinculado</TableHead>
                 <TableHead>De quem é o Risco? (Apólice)</TableHead>
                 <TableHead>Carta DDR</TableHead>
                 <TableHead>Exigências GR Operacionais</TableHead>
                 <TableHead>Nível de Risco Operacional</TableHead>
                 <TableHead className="text-right">Gerenciar Regra</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
                {mockRegrasClientes.map(r => (
                  <TableRow key={r.id}>
                     <TableCell>
                        <p className="font-bold text-slate-800">{r.cliente}</p>
                        <p className="text-[10px] text-muted-foreground">ID CRM: #{Math.floor(Math.random() * 1000)}</p>
                     </TableCell>
                     <TableCell>
                        {r.tipo === "Cliente DDR" ? (
                           <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 uppercase text-[10px]">Apólice do Cliente (DDR)</Badge>
                        ) : (
                           <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-300 uppercase text-[10px]">Apólice Transportador</Badge>
                        )}
                     </TableCell>
                     <TableCell>
                        {r.tipo === "Cliente DDR" && (
                           r.cartaDdr ? (
                              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5"/>  Averbeada</span>
                           ) : (
                              <span className="text-xs font-semibold text-red-600 flex items-center gap-1"><MailWarning className="w-3.5 h-3.5"/> Faltando Carta</span>
                           )
                        )}
                     </TableCell>
                     <TableCell>
                        <div className="flex gap-1">
                           {r.exigeGr && <Badge variant="secondary" className="text-[9px]">GR Obrigatória</Badge>}
                           {r.rastreamento && <Badge variant="secondary" className="text-[9px]"><MapPin className="w-2.5 h-2.5 mr-1"/> Rastreio</Badge>}
                           {r.consultaMotorista && <Badge variant="secondary" className="text-[9px]">Check-Motorista</Badge>}
                        </div>
                     </TableCell>
                     <TableCell>
                        {r.risco === "alto" && <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-none">Alto Risco</Badge>}
                        {r.risco === "médio" && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none">Médio</Badge>}
                        {r.risco === "baixo" && <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none">Baixo</Badge>}
                     </TableCell>
                     <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="text-xs text-indigo-600">Editar Perfil</Button>
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
