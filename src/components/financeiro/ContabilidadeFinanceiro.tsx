import { useState } from "react";
import { BookOpen, Search, Download, Plus, FileSpreadsheet, Lock, AlignJustify, UploadCloud, Banknote, Briefcase, CheckCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ContabilidadeFinanceiro() {
   const [aba, setAba] = useState("plano");

   return (
     <div className="space-y-6">
       <div className="flex gap-4 border-b pb-4 overflow-x-auto">
         <Button variant={aba === "plano" ? "default" : "outline"} onClick={() => setAba("plano")} className="h-9"><AlignJustify className="w-4 h-4 mr-2"/> Plano de Contas</Button>
         <Button variant={aba === "lancamentos" ? "default" : "outline"} onClick={() => setAba("lancamentos")} className="h-9"><BookOpen className="w-4 h-4 mr-2"/> Livro Diário</Button>
         <Button variant={aba === "dre_societaria" ? "default" : "outline"} onClick={() => setAba("dre_societaria")} className="h-9"><FileSpreadsheet className="w-4 h-4 mr-2"/> DRE Societária</Button>
         <Button variant={aba === "conciliacao" ? "default" : "outline"} onClick={() => setAba("conciliacao")} className="h-9"><Banknote className="w-4 h-4 mr-2"/> Conciliação OFX</Button>
         <Button variant={aba === "centros" ? "default" : "outline"} onClick={() => setAba("centros")} className="h-9"><Briefcase className="w-4 h-4 mr-2"/> Centros de Custos</Button>
         <Button variant={aba === "fechamento" ? "default" : "outline"} onClick={() => setAba("fechamento")} className="h-9"><Lock className="w-4 h-4 mr-2"/> Fechamento e SPED</Button>
       </div>

       {aba === "plano" && (
          <div className="space-y-4">
             <Card>
                <CardHeader className="flex flex-row justify-between items-center py-4">
                  <div><CardTitle>Plano de Contas Gerencial</CardTitle><CardDescription>Estrutura hierárquica baseada em DRE para rateio de despesas e receitas.</CardDescription></div>
                  <div className="flex gap-2">
                     <Button variant="outline" className="h-9"><UploadCloud className="w-4 h-4 mr-1"/> Importar CSV Base</Button>
                     <Button className="h-9 bg-purple-600 hover:bg-purple-700 text-white"><Plus className="w-4 h-4 mr-1"/> Nova Conta</Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                   <Table>
                     <TableHeader><TableRow><TableHead>Código ERP</TableHead><TableHead>Nome da Conta</TableHead><TableHead>Grupo Contábil</TableHead><TableHead>Natureza</TableHead><TableHead>Lancto. Direto</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader>
                     <TableBody>
                        <TableRow className="bg-slate-50 font-bold">
                           <TableCell className="font-mono">1.0.00</TableCell><TableCell>RECEITAS OPERACIONAIS</TableCell><TableCell><Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Receita</Badge></TableCell><TableCell>Credora</TableCell><TableCell>Não</TableCell>
                           <TableCell className="text-right text-green-600 text-xs">Ativo</TableCell>
                        </TableRow>
                        <TableRow>
                           <TableCell className="font-mono pl-6">1.1.01</TableCell><TableCell>Receita Bruta - Frete Rodoviário Carga Seca</TableCell><TableCell><Badge variant="outline" className="border-blue-200 bg-transparent text-slate-500">Subconta</Badge></TableCell><TableCell>Credora</TableCell><TableCell>Sim</TableCell>
                           <TableCell className="text-right text-green-600 text-xs">Ativo</TableCell>
                        </TableRow>
                        <TableRow className="bg-slate-50 font-bold">
                           <TableCell className="font-mono">2.0.00</TableCell><TableCell>CUSTOS DIRETOS (CMV Logístico)</TableCell><TableCell><Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">Despesa</Badge></TableCell><TableCell>Devedora</TableCell><TableCell>Não</TableCell>
                           <TableCell className="text-right text-green-600 text-xs">Ativo</TableCell>
                        </TableRow>
                        <TableRow>
                           <TableCell className="font-mono pl-6">2.1.01</TableCell><TableCell>Pagamentos a Prestadores Autônomos (RPA/NF)</TableCell><TableCell><Badge variant="outline" className="border-orange-200 bg-transparent text-slate-500">Subconta</Badge></TableCell><TableCell>Devedora</TableCell><TableCell>Sim</TableCell>
                           <TableCell className="text-right text-green-600 text-xs">Ativo</TableCell>
                        </TableRow>
                     </TableBody>
                   </Table>
                </CardContent>
             </Card>
          </div>
       )}

       {aba === "lancamentos" && (
          <div className="space-y-4">
             <div className="flex gap-4 mb-4">
               <div className="relative flex-1">
                 <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                 <Input placeholder="Buscar por valor, C.C, Tipo ou Descrição do Fato..." className="pl-9 bg-white" />
               </div>
               <Button variant="outline"><Plus className="w-4 h-4 mr-2"/> Lançamento Manual Partida Dobrada</Button>
             </div>
             <Card>
                <CardContent className="p-0">
                   <Table>
                     <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Lançamento ID</TableHead><TableHead>Histórico e Partidas</TableHead><TableHead>Débito</TableHead><TableHead>Crédito</TableHead><TableHead>Centro Custo</TableHead><TableHead>Origem</TableHead></TableRow></TableHeader>
                     <TableBody>
                        <TableRow>
                           <TableCell className="text-xs">27/03/2026</TableCell><TableCell className="font-mono text-[10px] text-muted-foreground">LC-88401</TableCell>
                           <TableCell className="text-sm"><p className="font-bold">Emissão CTe: Indústria ABC</p><p className="text-[10px] text-muted-foreground mt-0.5 font-mono">D: (Ativo/Bancos) / C: (1.1.01 Receita Bruta)</p></TableCell>
                           <TableCell className="font-medium text-orange-600">{fmtFin(8500)}</TableCell><TableCell className="font-medium text-blue-600">{fmtFin(8500)}</TableCell>
                           <TableCell><Badge variant="secondary" className="bg-slate-100 text-[10px]">C.C MATRIZ</Badge></TableCell>
                           <TableCell><span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 px-1 py-0.5 rounded">ERP Fiscal</span></TableCell>
                        </TableRow>
                        <TableRow>
                           <TableCell className="text-xs">26/03/2026</TableCell><TableCell className="font-mono text-[10px] text-muted-foreground">LC-88390</TableCell>
                           <TableCell className="text-sm"><p className="font-bold">Baixa Folha Pgto. ADM (DP)</p><p className="text-[10px] text-muted-foreground mt-0.5 font-mono">D: (Despesas Fixas) / C: (Passivo/Salários a Pagar)</p></TableCell>
                           <TableCell className="font-medium text-orange-600">{fmtFin(24000)}</TableCell><TableCell className="font-medium text-blue-600">{fmtFin(24000)}</TableCell>
                           <TableCell><Badge variant="secondary" className="bg-purple-100 text-purple-700 text-[10px]">C.C RH / ADULTA</Badge></TableCell>
                           <TableCell><span className="text-[10px] font-bold text-purple-600 uppercase bg-purple-50 px-1 py-0.5 rounded border border-purple-200">Manual Contábil</span></TableCell>
                        </TableRow>
                     </TableBody>
                   </Table>
                </CardContent>
             </Card>
          </div>
       )}

       {aba === "dre_societaria" && (
          <div className="space-y-4">
             <Card className="bg-slate-900 border-none shadow-xl text-white">
                <CardHeader className="pb-4 border-b border-slate-700"><CardTitle className="text-purple-400">Demonstrativo de Resultado Abrangente (Sintético)</CardTitle><CardDescription className="text-slate-400">Layout Societário Oficial / Competência 03/2026</CardDescription></CardHeader>
                <CardContent className="space-y-4 pt-6 font-mono text-sm max-w-4xl">
                   <div className="flex justify-between items-center"><span className="text-blue-300 font-bold">1. RECEITA OPERACIONAL BRUTA</span><span className="font-bold text-lg">{fmtFin(458000)}</span></div>
                   <div className="flex justify-between items-center pl-8 text-slate-400"><span>(-) Impostos s/ Serviços (ICMS, ISS, PIS/COFINS)</span><span>({fmtFin(61000)})</span></div>
                   <div className="flex justify-between items-center border-t border-slate-700 pt-2"><span className="text-blue-300 font-bold">2. RECEITA OPERACIONAL LÍQUIDA</span><span className="font-bold">{fmtFin(397000)}</span></div>
                   <div className="flex justify-between items-center pl-8 text-slate-400 mt-4"><span>(-) CPV (Custos Prestadores, Combustível, Pedágio)</span><span className="text-red-300">({fmtFin(210000)})</span></div>
                   <div className="flex justify-between items-center border-t border-slate-700 pt-2"><span className="text-green-400 font-bold">3. LUCRO BRUTO GERENCIAL</span><span className="font-bold">{fmtFin(187000)}</span></div>
                   
                   <div className="flex justify-between items-center pl-8 text-slate-400 mt-4"><span>(-) Despesas Administrativas e Ocupação</span><span>({fmtFin(48000)})</span></div>
                   <div className="flex justify-between items-center pl-8 text-slate-400"><span>(-) Despesas Comerciais e Marketing</span><span>({fmtFin(14000)})</span></div>
                   
                   <div className="flex justify-between items-center border-t border-slate-700 pt-2"><span className="text-purple-300 font-bold">4. L.A.J.I.D.A (EBITDA)</span><span className="font-bold">{fmtFin(125000)}</span></div>
                   
                   <div className="flex justify-between items-center pl-8 text-slate-400 mt-4"><span>(-) Depreciação e Amortização de Frotas</span><span>({fmtFin(35000)})</span></div>
                   <div className="flex justify-between items-center border-t border-slate-700 pt-2"><span className="text-slate-300 font-bold">5. L.A.J.I (EBIT)</span><span className="font-bold">{fmtFin(90000)}</span></div>
                   
                   <div className="flex justify-between items-center pl-8 text-slate-400 mt-4"><span>(+/-) Resultado Financeiro Líquido (Taxas, Juros)</span><span>({fmtFin(12000)})</span></div>
                   <div className="flex justify-between items-center pl-8 text-slate-400"><span>(-) IRPJ e CSLL Corrente</span><span>({fmtFin(26000)})</span></div>
                   
                   <div className="flex justify-between items-center border-t border-slate-500 pt-4"><span className="text-emerald-400 font-black text-lg">6. RESULTADO LÍQUIDO DO PERÍODO</span><span className="font-black text-xl text-emerald-400">{fmtFin(52000)}</span></div>
                </CardContent>
             </Card>
          </div>
       )}

       {aba === "conciliacao" && (
          <div className="space-y-4">
             <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
                   <div>
                     <CardTitle>Conciliação de Extrato API / OFX</CardTitle>
                     <CardDescription>Matching automático de compensações vs ERP System.</CardDescription>
                   </div>
                   <Button className="bg-emerald-600 hover:bg-emerald-700 text-white"><UploadCloud className="w-4 h-4 mr-2"/> Fazer Upload Extrato (.OFX/.CSV)</Button>
                </CardHeader>
                <CardContent className="p-0">
                   <div className="grid grid-cols-2 p-4 text-center text-xs font-bold text-slate-500 uppercase bg-slate-50">
                      <div>Extrato Banco Itaú</div><div>Movimento Contábil ERP</div>
                   </div>
                   <div className="divide-y relative">
                      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-200"></div>
                      
                      {/* Match Perfeito */}
                      <div className="grid grid-cols-2">
                         <div className="p-4 bg-green-50/20 pr-8 relative">
                           <div className="absolute right-[-10px] top-1/2 -mt-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white z-10 border-2 border-white"><CheckCircle className="w-3 h-3"/></div>
                           <p className="font-bold text-sm">Transferência Cta Corrente API</p><p className="text-xs text-muted-foreground">14/03 - TED Emitido PG Prestador</p>
                           <p className="font-medium text-red-600 mt-1">-{fmtFin(3500)}</p>
                         </div>
                         <div className="p-4 bg-green-50/20 pl-8">
                           <p className="font-bold text-sm text-slate-700">Baixa (Pagar) — Doc NF-8544</p><p className="text-xs text-muted-foreground">Prestador Carlos — Lançamento C.C Operacional</p>
                           <p className="font-medium text-orange-600 mt-1">Db. {fmtFin(3500)}</p>
                         </div>
                      </div>

                      {/* Not Found no ERP */}
                      <div className="grid grid-cols-2">
                         <div className="p-4 bg-red-50/20 pr-8 relative">
                           <div className="absolute right-[-10px] top-1/2 -mt-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white z-10 border-2 border-white"><AlertTriangle className="w-3 h-3"/></div>
                           <p className="font-bold text-sm">Tarifa Manutenção Conta Mensal</p><p className="text-xs text-muted-foreground">15/03 - Débito Banco Itaú S.A</p>
                           <p className="font-medium text-red-600 mt-1">-{fmtFin(189.50)}</p>
                         </div>
                         <div className="p-4 pl-8 flex items-center justify-start opacity-70">
                            <div>
                               <p className="text-sm font-bold text-slate-400 mb-1">Registro ERP não Encontrado!</p>
                               <Button size="sm" variant="outline" className="h-7 text-[10px] border-red-200 text-red-600">Lançar Manualmente Tarifa agora</Button>
                            </div>
                         </div>
                      </div>

                   </div>
                </CardContent>
             </Card>
          </div>
       )}

       {aba === "centros" && (
          <div className="space-y-4">
             <Card>
                <CardHeader><CardTitle>Custeio por Centros de Custo Operacionais (Absorption)</CardTitle></CardHeader>
                <CardContent className="p-0">
                   <Table>
                     <TableHeader><TableRow><TableHead>Código do Centro Custo (C.C)</TableHead><TableHead className="text-right">Orçamento Mês P/ Rateio</TableHead><TableHead className="text-right">Realizado Absoluto</TableHead><TableHead className="text-right">% Consumido</TableHead></TableRow></TableHeader>
                     <TableBody>
                        <TableRow>
                           <TableCell className="font-bold">C.C Comercial / Vendas</TableCell>
                           <TableCell className="text-right font-medium">{fmtFin(20000)}</TableCell><TableCell className="text-right font-medium">{fmtFin(14000)}</TableCell>
                           <TableCell className="text-right text-green-600 font-bold">70%</TableCell>
                        </TableRow>
                        <TableRow>
                           <TableCell className="font-bold">C.C Frota e Manutenção Oficina</TableCell>
                           <TableCell className="text-right font-medium">{fmtFin(35000)}</TableCell><TableCell className="text-right font-medium text-red-600">{fmtFin(45800)}</TableCell>
                           <TableCell className="text-right text-red-600 font-bold">130% (Estouro)</TableCell>
                        </TableRow>
                        <TableRow>
                           <TableCell className="font-bold">C.C Matriz Administrativo (Overhead)</TableCell>
                           <TableCell className="text-right font-medium">{fmtFin(50000)}</TableCell><TableCell className="text-right font-medium">{fmtFin(48000)}</TableCell>
                           <TableCell className="text-right text-blue-600 font-bold">96%</TableCell>
                        </TableRow>
                     </TableBody>
                   </Table>
                </CardContent>
             </Card>
          </div>
       )}

       {aba === "fechamento" && (
          <div className="space-y-4 max-w-4xl mx-auto pt-6">
             <Card className="text-center shadow-lg border-2 border-slate-100">
                <CardContent className="py-16 px-8 flex flex-col items-center">
                   <Lock className="w-16 h-16 text-slate-300 mb-6" />
                   <h2 className="text-2xl font-black text-slate-800 mb-2">Travar Período Competência: "Março 2026"</h2>
                   <p className="text-muted-foreground mb-8 max-w-lg">Ao efetuar o fechamento contábil, edições reativas serão rejeitadas pelo sistema. Diários e Razões farão o congelamento estrutural (Ready-Only).</p>
                   <Button className="w-64 h-12 bg-red-600 hover:bg-red-700 font-bold text-white shadow"><Lock className="w-5 h-5 mr-2"/> Autorizar Tranca de Período</Button>
                </CardContent>
             </Card>
             <Card className="bg-slate-50 border-dashed border-2">
                <CardContent className="py-8 px-8 flex justify-between items-center text-slate-600">
                   <div className="text-sm">
                      <p className="font-bold text-slate-800 text-lg">Central de SPED Contábil Fiscal (ECD/ECF)</p>
                      <p>Extração do Bloco de Lançamentos Formatado nos padrões RFB PGD.</p>
                   </div>
                   <Button variant="outline" className="border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100"><Download className="w-4 h-4 mr-2"/> Gerar TXT RFB</Button>
                </CardContent>
             </Card>
          </div>
       )}
     </div>
   );
}
