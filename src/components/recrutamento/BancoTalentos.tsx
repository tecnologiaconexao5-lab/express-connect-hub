import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Filter, MapPin, Truck, ChevronRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

interface CandidatoFromDB {
  id: string;
  nome_completo: string;
  tipo_veiculo: string;
  regiao: string;
  status: string;
  telefone: string;
  email: string;
  created_at: string;
}

export function BancoTalentos() {
  const [candidatos, setCandidatos] = useState<CandidatoFromDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    carregarCandidatos();
  }, []);

  const carregarCandidatos = async () => {
    setLoading(true);
    let query = supabase
      .from("candidatos")
      .select("id, nome_completo, tipo_veiculo, regiao, status, telefone, email, created_at")
      .in("status", ["pendente", "triagem", "interessado", "documentacao", "aprovado"])
      .order("created_at", { ascending: false })
      .limit(100);

    if (busca) {
      query = query.or(`nome_completo.ilike.%${busca}%,tipo_veiculo.ilike.%${busca}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[BancoTalentos] Erro ao carregar:", error);
    } else {
      setCandidatos(data || []);
    }
    setLoading(false);
  };

  const STATUS_LABEL: Record<string, string> = {
    pendente: "Pendente",
    triagem: "Em Triagem",
    interessado: "Interessado",
    documentacao: "Documentação",
    aprovado: "Aprovado",
    ativo: "Ativo",
    reprovado: "Reprovado",
  };

  const STATUS_COR: Record<string, string> = {
    pendente: "bg-gray-100 text-gray-700",
    triagem: "bg-blue-100 text-blue-700",
    interessado: "bg-yellow-100 text-yellow-700",
    documentacao: "bg-orange-100 text-orange-700",
    aprovado: "bg-green-100 text-green-700",
    ativo: "bg-green-600 text-white",
    reprovado: "bg-red-100 text-red-700",
  };

  const getScore = (c: CandidatoFromDB): number => {
    let score = 50;
    if (c.tipo_veiculo) score += 20;
    if (c.regiao) score += 15;
    if (c.telefone) score += 10;
    if (c.email) score += 5;
    return Math.min(score, 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
<div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground"/>
            <Input 
              placeholder="Buscar talento por veículo ou nome" 
              className="pl-9 h-9 text-xs"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && carregarCandidatos()}
            />
          </div>
         <div className="flex gap-2">
           <Button variant="outline" size="sm" className="h-9 gap-1"><Filter className="w-4 h-4"/> Filtros Avançados</Button>
           <Button size="sm" className="bg-primary text-xs h-9">Sugerir para OS Furtiva</Button>
         </div>
      </div>

<Card>
        <CardContent className="p-0">
           {candidatos.length === 0 ? (
             <div className="p-12 text-center text-muted-foreground">
               <p className="text-sm">Nenhum candidato encontrado.</p>
               <p className="text-xs mt-1">Candidatos aparecem aqui quando inseridos via captação ou triagem.</p>
             </div>
           ) : (
           <Table>
             <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Operação Alvo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
             </TableHeader>
             <TableBody>
                {candidatos.map(c => {
                  const score = getScore(c);
                  const diasSemContato = c.created_at ? Math.floor((Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                  return (
                   <TableRow key={c.id}>
                      <TableCell>
                         <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10 border shadow-sm"><AvatarFallback className="font-bold text-slate-600 bg-slate-100">{(c.nome_completo || "?").substring(0,2).toUpperCase()}</AvatarFallback></Avatar>
                            <div>
                               <p className="text-sm font-bold text-slate-800">{c.nome_completo || "Sem nome"}</p>
                               <p className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-1"><MapPin className="w-3 h-3"/> {c.regiao || "—"}</p>
                            </div>
                         </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="bg-slate-50 text-slate-700 font-bold border-slate-200 gap-1.5"><Truck className="w-3.5 h-3.5"/> {c.tipo_veiculo || "—"}</Badge></TableCell>
                      <TableCell>
                         <Badge variant="outline" className={`uppercase text-[10px] tracking-wider py-1 font-black shadow-sm ${STATUS_COR[c.status] || "bg-gray-100 text-gray-700"}`}>{STATUS_LABEL[c.status] || c.status}</Badge>
                      </TableCell>
                      <TableCell>
                         <div className="flex items-center gap-2 max-w-[120px]">
                           <span className="text-xs font-bold text-slate-600 w-6">{score}</span>
                           <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div className={`h-full ${score > 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{width: `${score}%`}}/>
                           </div>
                         </div>
                      </TableCell>
                      <TableCell>
                         {diasSemContato > 5 ? <span className="text-[10px] text-red-600 font-bold bg-red-50 px-2 py-1 rounded">Sem contato há {diasSemContato}d</span> : <span className="text-[10px] text-slate-500 font-mono">{c.telefone || "—"}</span>}
                      </TableCell>
                      <TableCell className="text-right">
                         <Button variant="ghost" size="icon" className="h-8 w-8 text-primary"><ChevronRight className="w-4 h-4"/></Button>
                      </TableCell>
                   </TableRow>
                )})}
             </TableBody>
           </Table>
           )}
         </CardContent>
      </Card>
    </div>
  );
}
