import { useState } from "react";
import { CopyPlus, ArrowRightLeft, ShieldCheck, CheckSquare, Search, Lock, Link, RefreshCcw, BellRing, Link2Off, SplitSquareHorizontal } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ConciliacaoAvancada() {
  const [matchingStatus, setMatchingStatus] = useState("pendente");

  const [diferencas, setDiferencas] = useState([
     { id: 1, banco_data: "14/03/2026", banco_desc: "TARIFA DE MANUTENCAO C/C", banco_valor: -128.50, erp_encontrado: null, status: "Sem Lançamento", acao_sugerida: "Despesa Fixa Banco Itaú" },
     { id: 2, banco_data: "18/03/2026", banco_desc: "RECEB. PIX CCEE LTDA", banco_valor: 4500.00, erp_encontrado: "Fatura FAT-301 R$ 4.500,00", status: "Sugerido (Data Diferente)", acao_sugerida: "Vincular Automático" },
     { id: 3, banco_data: "21/03/2026", banco_desc: "PAGTO TED PRESTADOR D", banco_valor: -3200.00, erp_encontrado: "Baixa OS-40A2 (R$ 3.200,00)", status: "Match Exato", acao_sugerida: "Confirmado" },
  ]);

  const baterMatrix = () => {
    setMatchingStatus("processando");
    setTimeout(() => {
       setMatchingStatus("sucesso");
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4 border-b pb-4">
         <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-800"><ArrowRightLeft className="w-6 h-6"/> Conciliador Avançado (Parser OFX/CSV)</h2>
            <p className="text-sm text-muted-foreground">Cruzamento entre as notas de débito/crédito bancárias reais versus os lançamentos do Contas a Pagar/Receber.</p>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="bg-white border-dashed border-2">
            <CardContent className="p-8 flex items-center justify-center text-center flex-col cursor-pointer hover:bg-slate-50 transition">
               <CopyPlus className="w-10 h-10 text-slate-300 mb-2" />
               <p className="font-bold text-slate-700">Importar Extrato Oficial (.OFX / .TXT)</p>
               <p className="text-xs text-muted-foreground">Arraste os arquivos baixados do Bankline para que a IA deduza entradas/saídas.</p>
            </CardContent>
          </Card>
          <Card className="bg-indigo-50 border-indigo-200 shadow-sm flex flex-col justify-center">
             <CardContent className="p-8 pb-4 text-center space-y-2">
                <Button onClick={baterMatrix} disabled={matchingStatus !== 'pendente'} className={`h-14 font-black text-lg w-full ${matchingStatus === 'sucesso' ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'} shadow-lg text-white`}>
                   {matchingStatus === "pendente" && <><RefreshCcw className="w-5 h-5 mr-3"/> Iniciar Comparação Matrix (D vs C)</>}
                   {matchingStatus === "processando" && <><RefreshCcw className="w-5 h-5 w-5 h-5 mr-3 animate-spin"/> Varrendo Array...</>}
                   {matchingStatus === "sucesso" && <><ShieldCheck className="w-5 h-5 mr-3"/> Upload Match Finalizado</>}
                </Button>
                {matchingStatus === "sucesso" && <p className="text-xs text-green-700 font-bold uppercase tracking-wider">Resultado: 8 Pagamentos Matchados | 2 Divergências</p>}
             </CardContent>
          </Card>
      </div>

      <Card>
         <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
            <CardTitle>Painel de Divergências Encontradas</CardTitle>
            <div className="relative w-[300px]">
               <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
               <Input placeholder="Buscar por valor ou string OFX..." className="pl-9 h-9 text-sm bg-slate-50" />
            </div>
         </CardHeader>
         <CardContent className="p-0">
            <Table>
               <TableHeader><TableRow><TableHead>Extrato Banco Central</TableHead><TableHead className="text-center">Tipo OFX</TableHead><TableHead className="bg-slate-50/50">Lançamento Encontrado (ERP)</TableHead><TableHead className="text-right">Acoplamento / IA</TableHead></TableRow></TableHeader>
               <TableBody>
                  {diferencas.map(d => (
                     <TableRow key={d.id} className={d.status === 'Match Exato' ? 'bg-green-50/20 opacity-50' : d.status === 'Sem Lançamento' ? 'bg-red-50/20' : ''}>
                        <TableCell>
                           <p className="font-bold text-sm text-slate-800">{d.banco_desc}</p>
                           <p className="text-xs text-muted-foreground font-mono mt-0.5">{d.banco_data}</p>
                           <p className={`text-sm font-black mt-1 ${d.banco_valor > 0 ? 'text-blue-600' : 'text-red-600'}`}>{fmtFin(d.banco_valor)}</p>
                        </TableCell>
                        <TableCell className="text-center">
                           <Badge variant="outline" className={`font-mono text-[10px] ${d.banco_valor > 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700 border-red-200'}`}>
                              {d.banco_valor > 0 ? 'CREDIT' : 'DEBIT'}
                           </Badge>
                        </TableCell>
                        <TableCell className="bg-slate-50/50">
                           {d.erp_encontrado ? (
                             <div className="text-sm font-bold text-slate-700 flex items-center gap-2"><Lock className="w-4 h-4 text-green-600"/> {d.erp_encontrado}</div>
                           ) : (
                             <div className="text-sm font-bold text-red-600 flex items-center gap-2"><Link2Off className="w-4 h-4"/> Não localizado no Financeiro</div>
                           )}
                           <p className="text-xs text-muted-foreground font-mono mt-0">{d.status}</p>
                        </TableCell>
                        <TableCell className="text-right">
                           {d.status === "Match Exato" && <Badge variant="secondary" className="bg-green-100 text-green-800">Vinculado Automaticamente</Badge>}
                           {d.status === "Sugerido (Data Diferente)" && <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700"><Link className="w-4 h-4 mr-2"/> Forçar Vínculo Lote</Button>}
                           {d.status === "Sem Lançamento" && <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"><SplitSquareHorizontal className="w-4 h-4 mr-2"/> Lançar como <br className="hidden"/> {d.acao_sugerida}</Button>}
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
