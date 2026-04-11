import { useState } from "react";
import { Search, Plus, FileText, Star, Copy, Edit, Trash2, LayoutTemplate, Briefcase, ChevronDown, Filter, CalendarDays, BarChart, Tags } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { mockPropostas } from "./mockPropostas";

interface ListaPropostasProps {
  onNovaProposta: (tipo: "modelo" | "personalizada", originModelo?: any) => void;
  onEditar: (proposta: any) => void;
}

export default function ListaPropostas({ onNovaProposta, onEditar }: ListaPropostasProps) {
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "modelo" | "personalizada">("todos");

  const filtradas = mockPropostas.filter((p) => {
    const term = busca.toLowerCase();
    const matchName = p.titulo.toLowerCase().includes(term) || (p.cliente && p.cliente.toLowerCase().includes(term));
    const matchTipo = filtroTipo === "todos" || p.tipo === filtroTipo;
    return matchName && matchTipo;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-card p-4 rounded-xl border shadow-sm">
         <div className="flex-1 w-full max-w-md relative">
           <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
           <Input 
             placeholder="Buscar propostas por título ou cliente..." 
             className="pl-9" 
             value={busca}
             onChange={(e) => setBusca(e.target.value)}
           />
         </div>
         <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
            <Button variant={filtroTipo === "todos" ? "default" : "outline"} onClick={() => setFiltroTipo("todos")} className="whitespace-nowrap"><Filter className="w-4 h-4 mr-2"/> Todas</Button>
            <Button variant={filtroTipo === "modelo" ? "default" : "outline"} onClick={() => setFiltroTipo("modelo")} className="whitespace-nowrap"><LayoutTemplate className="w-4 h-4 mr-2"/> Modelos</Button>
            <Button variant={filtroTipo === "personalizada" ? "default" : "outline"} onClick={() => setFiltroTipo("personalizada")} className="whitespace-nowrap"><Briefcase className="w-4 h-4 mr-2"/> Personalizadas</Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                 <Button className="bg-primary whitespace-nowrap ml-2"><Plus className="w-4 h-4 mr-2" /> Criar Proposta</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                 <DropdownMenuItem onClick={() => onNovaProposta("personalizada")}>
                   <Briefcase className="mr-2 h-4 w-4" />
                   <span>Personalizada (Nova)</span>
                 </DropdownMenuItem>
                 <DropdownMenuItem onClick={() => onNovaProposta("modelo")}>
                   <LayoutTemplate className="mr-2 h-4 w-4" />
                   <span>Criar Novo Modelo</span>
                 </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center gap-4">
             <div className="p-3 bg-primary/10 rounded-lg text-primary"><FileText className="w-6 h-6"/></div>
             <div>
               <p className="text-2xl font-bold">{mockPropostas.length}</p>
               <p className="text-xs text-muted-foreground">Total de Propostas</p>
             </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
             <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><LayoutTemplate className="w-6 h-6"/></div>
             <div>
               <p className="text-2xl font-bold text-blue-700">{mockPropostas.filter(p => p.tipo === 'modelo').length}</p>
               <p className="text-xs text-muted-foreground">Modelos Base</p>
             </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
             <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg"><Briefcase className="w-6 h-6"/></div>
             <div>
               <p className="text-2xl font-bold text-emerald-700">{mockPropostas.filter(p => p.tipo === 'personalizada').length}</p>
               <p className="text-xs text-muted-foreground">Personalizadas (Clientes)</p>
             </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
             <div className="p-3 bg-amber-100 text-amber-600 rounded-lg"><Star className="w-6 h-6"/></div>
             <div>
               <p className="text-2xl font-bold text-amber-700">{mockPropostas.filter(p => p.favorita).length}</p>
               <p className="text-xs text-muted-foreground">Favoritas</p>
             </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="py-4 border-b">
           <CardTitle className="text-lg">Catálogo de Propostas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-[350px]">Identificação</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Classificação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Atualizado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.length === 0 ? (
                 <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma proposta encontrada.</TableCell></TableRow>
              ) : (
                filtradas.map((p) => (
                  <TableRow key={p.id} className="hover:bg-slate-50/50">
                    <TableCell>
                      <div className="flex items-start gap-3">
                         {p.favorita ? <Star className="w-4 h-4 mt-1 text-amber-500 fill-amber-500" /> : <FileText className="w-4 h-4 mt-1 text-slate-400" />}
                         <div>
                            <p className="font-semibold text-slate-800">{p.titulo}</p>
                            <p className="text-xs text-muted-foreground">{p.subtitulo}</p>
                         </div>
                      </div>
                    </TableCell>
                    <TableCell>
                       {p.cliente ? (
                         <span className="font-semibold text-slate-700">{p.cliente}</span>
                       ) : (
                         <span className="text-xs text-slate-400 italic">Genérico (Template)</span>
                       )}
                    </TableCell>
                    <TableCell>
                       <div className="flex flex-col gap-1 items-start">
                         {p.tipo === "modelo" ? (
                           <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1"><LayoutTemplate className="w-3 h-3"/> Modelo Base</Badge>
                         ) : (
                           <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1"><Briefcase className="w-3 h-3"/> Personalizada</Badge>
                         )}
                         <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1"><Tags className="w-3 h-3"/> {p.tipoServico}</span>
                       </div>
                    </TableCell>
                    <TableCell>
                       <Badge variant="secondary" className="capitalize">
                          {p.status}
                       </Badge>
                    </TableCell>
                    <TableCell>
                       <span className="text-xs flex items-center gap-1 text-slate-600"><CalendarDays className="w-3.5 h-3.5"/> {new Date(p.atualizadoEm).toLocaleDateString('pt-BR')}</span>
                    </TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                         <DropdownMenuTrigger asChild>
                           <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4 text-slate-500" /></Button>
                         </DropdownMenuTrigger>
                         <DropdownMenuContent align="end">
                           <DropdownMenuItem onClick={() => onEditar(p)}><Edit className="w-4 h-4 mr-2"/> Editar</DropdownMenuItem>
                           {p.tipo === "modelo" && (
                              <DropdownMenuItem onClick={() => onNovaProposta("personalizada", p)}><Copy className="w-4 h-4 mr-2"/> Criar Personalizada (Deste Modelo)</DropdownMenuItem>
                           )}
                           <DropdownMenuItem><DuplicateIcon className="w-4 h-4 mr-2"/> Duplicar Exatamente</DropdownMenuItem>
                           <DropdownMenuItem><Star className="w-4 h-4 mr-2"/> {p.favorita ? "Desfavoritar" : "Favoritar"}</DropdownMenuItem>
                           <DropdownMenuItem className="text-red-600 focus:text-red-700"><Trash2 className="w-4 h-4 mr-2"/> Arquivar/Excluir</DropdownMenuItem>
                         </DropdownMenuContent>
                       </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

const MoreVertical = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
);
const DuplicateIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
);
