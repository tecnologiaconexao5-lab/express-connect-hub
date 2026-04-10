import { Search, Plus, Filter, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const mockSinistros = [
  { id: "SIN-2026-001", data: "2026-03-15", tipo: "Roubo/Furto", cliente: "Samsung Eletrônicos", motorista: "Carlos Souza", veiculo: "Carreta LS - ABC1234", valorCarga: 850000, valorPrejuizo: 850000, status: "Aprovado" },
  { id: "SIN-2026-002", data: "2026-04-02", tipo: "Avaria (Tombamento)", cliente: "Amazon Logística", motorista: "João Mendes", veiculo: "Truck - XYZ9876", valorCarga: 120000, valorPrejuizo: 35000, status: "Em Análise" },
  { id: "SIN-2025-018", data: "2025-11-20", tipo: "Acidente C/ Perda Total", cliente: "Magazine Luiza", motorista: "Roberto Alves", veiculo: "Van - KKK5555", valorCarga: 45000, valorPrejuizo: 45000, status: "Negado" },
];

export default function HistoricoSinistros() {
  return (
    <div className="space-y-6">
       <div className="flex bg-slate-50 border p-3 rounded-xl justify-between items-center">
          <div className="flex gap-4 items-center w-full max-w-xl">
             <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                <Input placeholder="Buscar Sinistro por Protocolo, Cliente ou Placa..." className="pl-9 bg-white" />
             </div>
             <Button variant="outline"><Filter className="w-4 h-4 mr-2"/> Filtros Avançados</Button>
          </div>
          <Button className="bg-red-600 hover:bg-red-700 font-bold gap-2"><Plus className="w-4 h-4"/> Declarar Novo Sinistro</Button>
       </div>

       <Card className="shadow-sm border-t-2 border-red-500">
         <CardContent className="p-0">
           <Table>
             <TableHeader className="bg-slate-50">
               <TableRow>
                 <TableHead>Protocolo / Data</TableHead>
                 <TableHead>Tipo Incidente</TableHead>
                 <TableHead>Cliente & Envolvidos</TableHead>
                 <TableHead>Perda Financeira</TableHead>
                 <TableHead>Status Correteja</TableHead>
                 <TableHead className="text-right">Ações</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
                {mockSinistros.map(s => (
                  <TableRow key={s.id}>
                     <TableCell>
                        <p className="font-bold text-slate-800">{s.id}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(s.data).toLocaleDateString('pt-BR')}</p>
                     </TableCell>
                     <TableCell>
                        <Badge variant="outline" className="border-slate-300 text-slate-700 bg-slate-50 font-bold uppercase text-[10px]">{s.tipo}</Badge>
                     </TableCell>
                     <TableCell>
                        <div className="text-xs">
                           <p className="font-bold">{s.cliente}</p>
                           <p className="text-slate-500">Mot: {s.motorista}</p>
                           <p className="text-slate-500">Veículo: {s.veiculo}</p>
                        </div>
                     </TableCell>
                     <TableCell>
                        <div className="font-mono text-xs text-right w-fit">
                           <p className="text-slate-500 line-through">NF: R$ {s.valorCarga.toLocaleString()}</p>
                           <p className="text-red-600 font-bold">Perda: R$ {s.valorPrejuizo.toLocaleString()}</p>
                        </div>
                     </TableCell>
                     <TableCell>
                        {s.status === "Aprovado" && <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none gap-1"><CheckCircle className="w-3 h-3"/> Indenizado</Badge>}
                        {s.status === "Em Análise" && <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-none gap-1"><Clock className="w-3 h-3"/> Em Regulação</Badge>}
                        {s.status === "Negado" && <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-none gap-1"><AlertTriangle className="w-3 h-3"/> Recusado</Badge>}
                     </TableCell>
                     <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="text-xs text-indigo-600 font-bold">Ver Autos</Button>
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
