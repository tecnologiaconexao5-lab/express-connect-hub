import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Filter, MapPin, Truck, ChevronRight, Clock, FileText, Star, MessageCircle, CheckCircle, Archive, User, Snowflake, Building2, Route } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Candidato {
  id: number;
  nome: string;
  veiculo: string;
  regiao: string;
  status: string;
  score: number;
  semContato: number;
  docsEnviados: number;
  docsTotal: number;
  compatibilidade: number;
  tags: string[];
  ultimaInteracao: string;
  tempoBanco: number;
}

const CANDIDATOS: Candidato[] = [
  { id: 1, nome: "Rafael Almeida", veiculo: "VUC / HR", regiao: "São Paulo - Leste", status: "Em Triagem", score: 88, semContato: 2, docsEnviados: 4, docsTotal: 7, compatibilidade: 92, tags: ["Refrigerado", "Dedicado"], ultimaInteracao: "Enviou docs há 2 dias", tempoBanco: 15 },
  { id: 2, nome: "Silvio Mendes", veiculo: "Carreta LS", regiao: "Campinas", status: "Interessado", score: 65, semContato: 5, docsEnviados: 2, docsTotal: 7, compatibilidade: 45, tags: ["Longa Distância"], ultimaInteracao: "Retorno Wapp há 5 dias", tempoBanco: 30 },
  { id: 3, nome: "Júlio Agregados", veiculo: "3/4 Refrigerado", regiao: "Guarulhos", status: "Documentação", score: 95, semContato: 1, docsEnviados: 6, docsTotal: 7, compatibilidade: 88, tags: ["Refrigerado", "Urbano"], ultimaInteracao: "Enviou docs há 1 dia", tempoBanco: 8 },
  { id: 4, nome: "Marcos Lima", veiculo: "Fiorino", regiao: "ABC Paulista", status: "Aprovado", score: 100, semContato: 8, docsEnviados: 7, docsTotal: 7, compatibilidade: 95, tags: ["Dedicado", "Urbano"], ultimaInteracao: "Aprovado há 8 dias", tempoBanco: 45 },
  { id: 5, nome: "Carlos Souza", veiculo: "Van", regiao: "São Paulo - Oeste", status: "Interessado", score: 72, semContato: 3, docsEnviados: 3, docsTotal: 7, compatibilidade: 67, tags: ["Eventos"], ultimaInteracao: "Nova mensagem há 3 dias", tempoBanco: 12 },
];

const getScoreColor = (score: number) => {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-red-500";
};

const getStatusColor = (status: string) => {
  if (status === "Aprovado") return "bg-emerald-100 text-emerald-800 border-emerald-300";
  if (status === "Interessado") return "bg-blue-100 text-blue-800 border-blue-300";
  if (status === "Documentação") return "bg-orange-100 text-orange-800 border-orange-300";
  return "bg-slate-100 text-slate-600 border-slate-300";
};

const getVeiculoIcon = (veiculo: string) => {
  if (veiculo.includes("Refrigerado")) return <Snowflake className="w-3 h-3 text-blue-500"/>;
  if (veiculo.includes("Fiorino") || veiculo.includes("Van")) return <Building2 className="w-3 h-3 text-orange-500"/>;
  if (veiculo.includes("Carreta")) return <Route className="w-3 h-3 text-purple-500"/>;
  return <Truck className="w-3 h-3 text-slate-500"/>;
};

export function BancoTalentos() {
  const [viewMode, setViewMode] = useState<"table" | "cards">("cards");
  const [selectedCandidato, setSelectedCandidato] = useState<Candidato | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
         <div className="relative w-72">
           <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground"/>
           <Input placeholder="Buscar talento por veículo ou nome" className="pl-9 h-9 text-xs"/>
         </div>
         <div className="flex gap-2 items-center">
           <div className="flex border rounded-md">
             <Button variant={viewMode === "cards" ? "secondary" : "ghost"} size="sm" className="h-8 rounded-r-none" onClick={() => setViewMode("cards")}>Cards</Button>
             <Button variant={viewMode === "table" ? "secondary" : "ghost"} size="sm" className="h-8 rounded-l-none" onClick={() => setViewMode("table")}>Tabela</Button>
           </div>
           <Button variant="outline" size="sm" className="h-9 gap-1"><Filter className="w-4 h-4"/> Filtros</Button>
           <Button size="sm" className="bg-primary text-xs h-9">Sugerir para OS</Button>
         </div>
      </div>

      {viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {CANDIDATOS.map(c => (
            <Card key={c.id} className="hover:shadow-lg transition-all cursor-pointer border-l-4 border-l-primary" onClick={() => setSelectedCandidato(c)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12 border-2 border-white shadow-sm"><AvatarFallback className="font-bold text-slate-600 bg-slate-100">{c.nome.substring(0,2)}</AvatarFallback></Avatar>
                    <div>
                      <p className="font-bold text-sm text-slate-800">{c.nome}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3"/> {c.regiao}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${getStatusColor(c.status)}`}>{c.status}</Badge>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  {getVeiculoIcon(c.veiculo)}
                  <span className="text-xs font-medium">{c.veiculo}</span>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Score de Perfil</span>
                    <span className="font-bold text-primary">{c.score}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className={`h-full ${getScoreColor(c.score)} transition-all`} style={{width: `${c.score}%`}}/>
                  </div>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Compatibilidade</span>
                    <span className={`font-bold ${c.compatibilidade >= 80 ? 'text-green-600' : c.compatibilidade >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{c.compatibilidade}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className={`h-full ${c.compatibilidade >= 80 ? 'bg-green-500' : c.compatibilidade >= 60 ? 'bg-amber-500' : 'bg-red-500'} transition-all`} style={{width: `${c.compatibilidade}%`}}/>
                  </div>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1"><FileText className="w-3 h-3"/> Documentação</span>
                    <span className="font-medium">{c.docsEnviados}/{c.docsTotal}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all" style={{width: `${(c.docsEnviados/c.docsTotal)*100}%`}}/>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {c.tags.map((tag, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] bg-slate-50">{tag}</Badge>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="w-3 h-3"/>
                    <span>há {c.tempoBanco} dias</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7"><MessageCircle className="w-3 h-3 text-green-600"/></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7"><CheckCircle className="w-3 h-3 text-green-600"/></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7"><Archive className="w-3 h-3 text-slate-400"/></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                 <TableRow>
                   <TableHead>Perfil</TableHead>
                   <TableHead>Operação Alvo</TableHead>
                   <TableHead>Compatibilidade</TableHead>
                   <TableHead>Documentos</TableHead>
                   <TableHead>Status</TableHead>
                   <TableHead>Tempo Banco</TableHead>
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
                       <TableCell><Badge variant="outline" className="bg-slate-50 text-slate-700 font-bold border-slate-200 gap-1.5">{getVeiculoIcon(c.veiculo)} {c.veiculo}</Badge></TableCell>
                       <TableCell>
                          <div className="flex items-center gap-2 max-w-[100px]">
                            <span className="text-xs font-bold text-slate-600 w-6">{c.compatibilidade}%</span>
                            <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                               <div className={`h-full ${c.compatibilidade >= 80 ? 'bg-green-500' : c.compatibilidade >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{width: `${c.compatibilidade}%`}}/>
                            </div>
                          </div>
                       </TableCell>
                       <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                               <div className="h-full bg-blue-500" style={{width: `${(c.docsEnviados/c.docsTotal)*100}%`}}/>
                            </div>
                            <span className="text-xs">{c.docsEnviados}/{c.docsTotal}</span>
                          </div>
                       </TableCell>
                       <TableCell>
                          <Badge variant="outline" className={`uppercase text-[10px] tracking-wider py-1 font-black shadow-sm ${getStatusColor(c.status)}`}>{c.status}</Badge>
                       </TableCell>
                       <TableCell>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3"/> {c.tempoBanco} dias</span>
                       </TableCell>
                       <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setSelectedCandidato(c)}><ChevronRight className="w-4 h-4"/></Button>
                       </TableCell>
                    </TableRow>
                 ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* MODAL DETALHE CANDIDATO */}
      <Dialog open={!!selectedCandidato} onOpenChange={() => setSelectedCandidato(null)}>
        <DialogContent className="max-w-2xl">
          {selectedCandidato && (
            <>
              <DialogHeader><DialogTitle>Perfil do Candidato</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-6 py-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-16 h-16"><AvatarFallback className="font-bold text-xl bg-slate-100">{selectedCandidato.nome.substring(0,2)}</AvatarFallback></Avatar>
                    <div>
                      <p className="font-bold text-lg">{selectedCandidato.nome}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="w-4 h-4"/> {selectedCandidato.regiao}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedCandidato.tags.map((tag, i) => <Badge key={i} variant="outline">{tag}</Badge>)}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Última interação</p>
                    <p className="text-sm font-medium">{selectedCandidato.ultimaInteracao}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex justify-between mb-2"><span className="text-sm">Score de Perfil</span><span className="font-bold text-primary">{selectedCandidato.score}</span></div>
                    <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden"><div className={`h-full ${getScoreColor(selectedCandidato.score)}`} style={{width: `${selectedCandidato.score}%`}}/></div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex justify-between mb-2"><span className="text-sm">Compatibilidade</span><span className={`font-bold ${selectedCandidato.compatibilidade >= 80 ? 'text-green-600' : 'text-amber-600'}`}>{selectedCandidato.compatibilidade}%</span></div>
                    <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden"><div className="h-full bg-green-500" style={{width: `${selectedCandidato.compatibilidade}%`}}/></div>
                    <p className="text-[10px] text-muted-foreground mt-1">Baseado em demanda dos últimos 30 dias</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex justify-between mb-2"><span className="text-sm">Documentação</span><span className="font-medium">{selectedCandidato.docsEnviados}/{selectedCandidato.docsTotal}</span></div>
                    <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{width: `${(selectedCandidato.docsEnviados/selectedCandidato.docsTotal)*100}%`}}/></div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" className="gap-2"><Archive className="w-4 h-4"/> Arquivar</Button>
                <Button variant="outline" className="gap-2 text-green-600"><MessageCircle className="w-4 h-4"/> Enviar WhatsApp</Button>
                <Button className="bg-primary gap-2"><CheckCircle className="w-4 h-4"/> Aprovar</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
