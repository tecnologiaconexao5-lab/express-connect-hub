import { useState } from "react";
import { UserCheck, AlertTriangle, ShieldCheck, Clock, X, Check, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export default function PendenciasCadastro() {
  const [pendencias, setPendencias] = useState([
     { id: 1, prestador: "Carlos Silva Logística", origem: "App do Motorista", data: "Hoje, 09:30", tipo: "Alteração de Domicílio Bancário", novoDado: "Banco Inter, Ag: 0001, Cc: 3451-2", dadoAntigo: "Nubank, Ag: 0001, Cc: 99432-1", status: "Aguardando", field: "banco" },
     { id: 2, prestador: "Transportadora XYZ", origem: "Novo Cadastro Web", data: "Ontem, 16:20", tipo: "Primeira Homologação", novoDado: "CNPJ e Conta vincula em nome diferente (Divergência). Diferente de CPF.", dadoAntigo: "-", status: "Aguardando", field: "fraude" },
  ]);

  const [ativo, setAtivo] = useState<any>(null);

  const removerDaFila = (id: number) => {
     setPendencias(prev => prev.filter(p => p.id !== id));
     setAtivo(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
         <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-red-700"><ShieldCheck className="w-6 h-6"/> Central de Conformidade Cadastral (Compliance)</h2>
            <p className="text-sm text-muted-foreground">Analise as alterações bancárias e de risco solicitadas pelos prestadores.</p>
         </div>
         <Badge variant="destructive" className="bg-red-600 font-bold px-3 py-1 shadow-md animate-pulse">{pendencias.length} Pendências Ativas na Fila</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Lista Pendentes */}
         <Card>
            <CardHeader><CardTitle className="text-lg">Fila de Triagem</CardTitle></CardHeader>
            <CardContent className="p-0">
               <Table>
                 <TableHeader><TableRow><TableHead>Fornecedor (Favorecido)</TableHead><TableHead>Origem</TableHead><TableHead>Tipo Alerta</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader>
                 <TableBody>
                    {pendencias.map(p => (
                       <TableRow key={p.id} className={ativo?.id === p.id ? "bg-red-50" : ""}>
                          <TableCell className="font-bold text-sm text-slate-800">{p.prestador} <br/> <span className="text-xs text-slate-400 font-mono">{p.data}</span></TableCell>
                          <TableCell><Badge variant="outline" className="bg-slate-100">{p.origem}</Badge></TableCell>
                          <TableCell>
                             <p className={`text-xs font-bold flex items-center gap-1 ${p.field === 'fraude' ? 'text-red-600' : 'text-orange-600'}`}>
                                <AlertTriangle className="w-3 h-3"/> {p.tipo}
                             </p>
                          </TableCell>
                          <TableCell className="text-right">
                             <Button size="sm" variant={ativo?.id === p.id ? "default" : "outline"} onClick={() => setAtivo(p)} className="bg-white hover:bg-red-50 text-red-700 border-red-200">Verificar Dados</Button>
                          </TableCell>
                       </TableRow>
                    ))}
                    {pendencias.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-10 font-bold text-slate-400">Nenhuma requisição pendente no momento 🚀</TableCell></TableRow>}
                 </TableBody>
               </Table>
            </CardContent>
         </Card>

         {/* Painel Diff Side By Side */}
         {ativo ? (
            <Card className="border-red-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
               <div className="bg-red-700 p-4 text-white flex justify-between items-center">
                  <div>
                    <h3 className="font-bold flex items-center gap-2"><UserCheck className="w-5 h-5"/> Autorização de Cadastro</h3>
                    <p className="text-xs text-red-200">{ativo.prestador}</p>
                  </div>
                  <Badge variant="outline" className="border-red-400 bg-red-800/50">{ativo.data}</Badge>
               </div>
               <CardContent className="p-6 space-y-6 bg-red-50/20">
                  <div className="flex gap-4">
                     {/* Antes */}
                     <div className="flex-1 bg-red-50 p-4 rounded-lg border border-red-100 opacity-60">
                        <p className="text-xs font-bold text-red-500 uppercase mb-2">Informação Anterior / Oficial</p>
                        <p className="text-sm font-medium text-slate-600 line-through decoration-red-400">{ativo.dadoAntigo}</p>
                     </div>
                     {/* Depois */}
                     <div className="flex-1 bg-green-50 p-4 rounded-lg border border-green-200 shadow-sm relative">
                        <div className="absolute top-2 right-2 w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
                        <p className="text-xs font-bold text-green-700 uppercase mb-2">Novo Dado Solicitado</p>
                        <p className="text-lg font-black text-green-900">{ativo.novoDado}</p>
                     </div>
                  </div>

                  {ativo.field === 'fraude' && (
                     <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 text-sm text-yellow-800">
                        <b>Aviso de Risco CNAB 240:</b> Pagamentos de frete só são emitidos caso o titular da conta bancária seja o MESMO do CPF/CNPJ cadastrado e presente no emissor CT-e.
                     </div>
                  )}

                  <div className="pt-4 border-t flex justify-end gap-3 flex-wrap">
                     <Button variant="outline" size="lg" className="border-slate-300 hover:bg-slate-100" onClick={() => removerDaFila(ativo.id)}><X className="w-4 h-4 mr-2"/> Rejeitar e Notificar</Button>
                     <Button size="lg" className="bg-green-600 hover:bg-green-700 shadow-lg text-white font-bold" onClick={() => removerDaFila(ativo.id)}><Check className="w-5 h-5 mr-2"/> Aprovar Subscrição</Button>
                  </div>
               </CardContent>
            </Card>
         ) : (
            <div className="border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-center p-10 h-full bg-slate-50 opacity-60">
               <ShieldCheck className="w-16 h-16 text-slate-300 mb-4"/>
               <h3 className="font-bold text-slate-500 text-lg">Selecione uma pendência</h3>
               <p className="text-sm text-muted-foreground mt-2 max-w-sm">Use o inspetor de Compliance lado-a-lado para confirmar os riscos de alterações bancárias.</p>
            </div>
         )}
      </div>
    </div>
  );
}
