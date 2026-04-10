import { useState } from "react";
import { Search, MapPin, Truck, Target, Users, PlayCircle, BarChart3, ChevronRight, Copy, Check, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const mockOperacoes = [
  { id: 1, nome: "Rota Sul D+1", cliente: "Magazine Luiza", regiao: "SP x Sul", veiculo: "Carreta", valor: 14500, status: "Ativo", captados: 12, aprovados: 3, vagas: 5, lucroMedio: 3800, eficiencia: 92 },
  { id: 2, nome: "Distribuição Capital", cliente: "Amazon", regiao: "São Paulo (Metropolitana)", veiculo: "Van", valor: 650, status: "Ativo", captados: 45, aprovados: 12, vagas: 15, lucroMedio: 150, eficiencia: 88 },
  { id: 3, nome: "Transferência NE", cliente: "Mercado Livre", regiao: "SP x BA", veiculo: "Truck", valor: 8200, status: "Pausado", captados: 8, aprovados: 1, vagas: 2, lucroMedio: 1900, eficiencia: 76 },
];

export function OperacoesRI() {
  const [busca, setBusca] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCopyWapp = (op: any) => {
    const text = `*🚨 NOVA OPERAÇÃO DISPONÍVEL - ${op.nome} 🚨*\n📍 *Rota:* ${op.regiao}\n🚚 *Veículo Exigido:* ${op.veiculo}\n💰 *Valor de Saída:* R$ ${op.valor.toFixed(2)}\n\nInteressados favor responder esta mensagem!`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const operacoesFiltradas = mockOperacoes.filter(o => 
    JSON.stringify(o).toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome, cliente, rota ou veículo..." 
            className="pl-9 bg-card" 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
           <Button variant="outline"><Filter className="w-4 h-4 mr-2"/> Filtros</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {operacoesFiltradas.map((op) => (
          <Dialog key={op.id}>
            <DialogTrigger asChild>
              <Card className="hover:border-primary/50 cursor-pointer transition-colors shadow-sm group">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">{op.nome}</CardTitle>
                      <CardDescription>{op.cliente}</CardDescription>
                    </div>
                    <Badge variant={op.status === "Ativo" ? "default" : "secondary"} className={op.status === "Ativo" ? "bg-green-600 hover:bg-green-700" : ""}>
                      {op.status === "Ativo" ? <PlayCircle className="w-3 h-3 mr-1"/> : null}
                      {op.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pb-3 text-sm space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400"/> {op.regiao}</div>
                    <div className="flex items-center gap-1.5"><Truck className="w-4 h-4 text-slate-400"/> {op.veiculo}</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded flex justify-between items-center text-xs">
                     <span className="font-semibold text-slate-600 dark:text-slate-400">Valor de Saída</span>
                     <span className="text-base font-bold text-slate-800 dark:text-slate-200">R$ {op.valor.toFixed(2)}</span>
                  </div>
                </CardContent>
                <CardFooter className="pt-0 flex justify-between border-t mt-2 flex-col">
                  <div className="flex gap-4 w-full py-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="w-3 h-3"/> {op.captados} Captados</div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Target className="w-3 h-3"/> {op.vagas} Vagas</div>
                  </div>
                </CardFooter>
              </Card>
            </DialogTrigger>

            {/* DASHBOARD DA OPERAÇÃO */}
            <DialogContent className="max-w-[800px] bg-slate-50">
              <DialogHeader>
                <DialogTitle className="text-2xl flex items-center gap-2">
                   {op.nome} <Badge variant="outline" className="text-xs bg-white text-slate-500 font-normal">{op.cliente}</Badge>
                </DialogTitle>
              </DialogHeader>
              
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                 
                 {/* COLUNA 1: INDICADORES OPERACIONAIS */}
                 <div className="lg:col-span-1 space-y-4">
                    <Card className="shadow-sm border-0 border-t-2 border-indigo-500">
                      <CardHeader className="py-3 px-4"><CardTitle className="text-xs text-slate-500 uppercase tracking-wider">Métricas de Captação</CardTitle></CardHeader>
                      <CardContent className="px-4 pb-4 space-y-3">
                         <div className="flex justify-between items-center">
                           <span className="text-sm font-semibold">Vagas Abertas</span>
                           <Badge variant="outline" className="font-mono text-indigo-600 bg-indigo-50">{op.vagas}</Badge>
                         </div>
                         <div className="flex justify-between items-center">
                           <span className="text-sm">Cadastrados (Funil)</span>
                           <span className="font-mono">{op.captados}</span>
                         </div>
                         <div className="flex justify-between items-center">
                           <span className="text-sm">Aprovados</span>
                           <span className="font-mono text-green-600 font-bold">{op.aprovados}</span>
                         </div>
                         <div className="flex justify-between items-center">
                           <span className="text-sm">Reprovados</span>
                           <span className="font-mono text-red-500">{op.captados - op.aprovados}</span>
                         </div>
                      </CardContent>
                    </Card>
                 </div>

                 {/* COLUNA 2: FINANCEIRO E AÇÕES */}
                 <div className="lg:col-span-2 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* CARD INDICADORES FINANCEIROS RESTRITO E VISUAL EXECUTIVO */}
                      <Card className="shadow-sm border border-slate-200 bg-white shadow-sm hover:shadow-md transition">
                        <CardHeader className="py-3 px-4 border-b bg-slate-50/50"><CardTitle className="text-xs text-slate-500 uppercase flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5"/> Desempenho Estimado</CardTitle></CardHeader>
                        <CardContent className="p-4 grid grid-cols-2 gap-4">
                           <div>
                             <p className="text-[10px] text-slate-400 font-bold">LUCRO MÉDIO OP</p>
                             <p className="text-lg font-bold text-emerald-600">R$ {op.lucroMedio.toFixed(2)}</p>
                           </div>
                           <div>
                             <p className="text-[10px] text-slate-400 font-bold">EFICIÊNCIA</p>
                             <p className="text-lg font-bold text-slate-700">{op.eficiencia}%</p>
                           </div>
                           <div className="col-span-2">
                             <p className="text-[10px] text-slate-400 font-bold">CUSTO VS RECEITA</p>
                             <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                               <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${op.eficiencia}%`}}></div>
                             </div>
                           </div>
                        </CardContent>
                      </Card>

                      {/* CARD AÇÕES RÁPIDAS WHATSAPP */}
                      <Card className="shadow-sm border-0 border-t-2 border-emerald-500 bg-emerald-50/30">
                        <CardContent className="p-4 flex flex-col justify-center h-full space-y-3">
                           <p className="text-sm font-semibold text-emerald-800 text-center">Divulgação Rápida WAPP</p>
                           <Button onClick={() => handleCopyWapp(op)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-bold gap-2">
                             {copied ? <Check className="w-4 h-4"/> : <Copy className="w-4 h-4"/>}
                             {copied ? "Template Copiado" : "Gerar Mensagem"}
                           </Button>
                           <p className="text-[10px] text-center text-emerald-600/80">Mensagem otimizada para atração de parceiros, sem vínculo.</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* INFOS GERAIS FOOTER */}
                     <Card className="bg-slate-50 border shadow-sm">
                       <CardContent className="p-3">
                         <div className="flex gap-4 items-center">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600"><MapPin className="w-3.5 h-3.5"/> Carregamento: {op.regiao}</span>
                            <span className="text-slate-300">|</span>
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Truck className="w-3.5 h-3.5"/> Veículo: {op.veiculo}</span>
                            <span className="text-slate-300">|</span>
                            <span className="text-xs font-bold text-slate-700">R$ {op.valor.toFixed(2)} (Ref. Saída)</span>
                         </div>
                       </CardContent>
                     </Card>
                 </div>

              </div>

            </DialogContent>
          </Dialog>
        ))}
        {operacoesFiltradas.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-lg">
             Nenhuma operação encontrada com os filtros atuais.
          </div>
        )}
      </div>
    </div>
  );
}
