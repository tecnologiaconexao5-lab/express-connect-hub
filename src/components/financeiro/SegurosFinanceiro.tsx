import { useState } from "react";
import { Shield, ShieldCheck, AlertTriangle, CheckCircle, FileText, Upload, Plus, Download, BarChart2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function SegurosFinanceiro() {
   const [aba, setAba] = useState("apolices");

   return (
     <div className="space-y-6">
       <div className="flex gap-4 border-b pb-4">
         <Button variant={aba === "apolices" ? "default" : "outline"} onClick={() => setAba("apolices")} className="h-9"><ShieldCheck className="w-4 h-4 mr-2"/> Gestão de Apólices</Button>
         <Button variant={aba === "averbacoes" ? "default" : "outline"} onClick={() => setAba("averbacoes")} className="h-9"><FileText className="w-4 h-4 mr-2"/> Histórico de Averbações</Button>
         <Button variant={aba === "sinistros" ? "default" : "outline"} onClick={() => setAba("sinistros")} className="h-9"><AlertTriangle className="w-4 h-4 mr-2"/> Controle de Sinistros</Button>
         <Button variant={aba === "relatorio" ? "default" : "outline"} onClick={() => setAba("relatorio")} className="h-9"><BarChart2 className="w-4 h-4 mr-2"/> Relatório DRE/Seguro</Button>
       </div>

       {aba === "apolices" && (
          <div className="space-y-4">
            <Card>
               <CardHeader className="flex flex-row justify-between items-center py-4">
                 <div><CardTitle>Apólices Vigentes Corporativas</CardTitle></div>
                 <Button className="bg-blue-600"><Plus className="w-4 h-4 mr-1"/> Nova Apólice</Button>
               </CardHeader>
               <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead>Seguradora</TableHead><TableHead>Nº Apólice</TableHead><TableHead>Tipo Cobertura</TableHead><TableHead>Vigência</TableHead><TableHead className="text-right">Valor Segurado</TableHead><TableHead>Premio (Mês)</TableHead><TableHead>Averbação</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                       <TableRow>
                          <TableCell className="font-bold">Porto Seguro S.A</TableCell><TableCell className="font-mono text-xs text-muted-foreground">14.12.8392.11</TableCell><TableCell>RCTR-C / RCF-DC</TableCell><TableCell>11/2026</TableCell><TableCell className="text-right font-medium">{fmtFin(1500000)}</TableCell><TableCell>{fmtFin(4500)}</TableCell>
                          <TableCell><Badge variant="outline" className="border-green-200 text-green-700 bg-green-50"><CheckCircle className="w-3 h-3 mr-1"/> API Ativa</Badge></TableCell>
                          <TableCell><Badge variant="outline" className="text-green-700">Ativa</Badge></TableCell>
                       </TableRow>
                       <TableRow>
                          <TableCell className="font-bold">Sura Seguros</TableCell><TableCell className="font-mono text-xs text-muted-foreground">99.11.2334.00</TableCell><TableCell>RCF-DC (Desvio)</TableCell><TableCell className="text-orange-600 font-bold">04/2026</TableCell><TableCell className="text-right font-medium">{fmtFin(500000)}</TableCell><TableCell>{fmtFin(1800)}</TableCell>
                          <TableCell><Badge variant="outline" className="border-orange-200 text-orange-700 bg-orange-50"><AlertTriangle className="w-3 h-3 mr-1"/> Manual</Badge></TableCell>
                          <TableCell><Badge variant="outline" className="text-orange-600 border-orange-300">Vencendo</Badge></TableCell>
                       </TableRow>
                    </TableBody>
                  </Table>
               </CardContent>
            </Card>

            <Card className="bg-slate-50 border-dashed border-2">
               <CardContent className="p-8">
                  <h4 className="font-bold text-slate-700 text-center mb-4 text-lg">Cadastro Rápido de Apólice</h4>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                     <div className="space-y-1"><label className="text-xs font-semibold">Seguradora</label><Input placeholder="Ex: Allianz" /></div>
                     <div className="space-y-1"><label className="text-xs font-semibold">Nº Apólice</label><Input placeholder="000.0000..." /></div>
                     <div className="space-y-1"><label className="text-xs font-semibold">Tipo</label><Input placeholder="RCTR-C" /></div>
                     <div className="space-y-1"><label className="text-xs font-semibold">Corretor Contato</label><Input placeholder="(11) 99999-9999" /></div>
                     <div className="space-y-1"><label className="text-xs font-semibold">Valor Cobertura (Limite LMI)</label><Input type="number" placeholder="500000" /></div>
                     <div className="space-y-1"><label className="text-xs font-semibold">Prêmio Mensal/Fixo</label><Input type="number" placeholder="1000" /></div>
                     <div className="space-y-1"><label className="text-xs font-semibold">Franquia (%)</label><Input type="number" placeholder="0" /></div>
                     <div className="col-span-1 lg:col-span-1 flex items-end">
                       <Button variant="outline" className="w-full bg-white"><Upload className="w-4 h-4 mr-2"/> Anexar PDF</Button>
                     </div>
                  </div>
                  <div className="mt-4 pt-4 border-t flex flex-col md:flex-row justify-between items-center gap-4">
                     <div>
                       <p className="font-bold text-sm text-slate-800">Averbação Automática na Geração da OS</p>
                       <p className="text-xs text-muted-foreground">O sistema comunicará o endpoint ATMS via API a cada nota fiscal salva.</p>
                     </div>
                     <div className="flex items-center gap-4">
                        <Input placeholder="CNPJ Averbador" className="w-48 bg-white"/>
                        <Button className="w-32 bg-green-600">Salvar Apólice</Button>
                     </div>
                  </div>
               </CardContent>
            </Card>
          </div>
       )}

       {aba === "averbacoes" && (
          <div className="space-y-4">
            <Card>
               <CardHeader className="py-4">
                 <CardTitle>Histórico de Averbações Sistêmicas ATMS</CardTitle>
                 <CardDescription>Logs de tráfego entre ERP Express Hub e Seguradoras conectadas.</CardDescription>
               </CardHeader>
               <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead>Data/Hora</TableHead><TableHead>OS Vinculada</TableHead><TableHead>Apólice Acionada</TableHead><TableHead className="text-right">Valor Averbado (NF)</TableHead><TableHead>Retorno Seguradora</TableHead></TableRow></TableHeader>
                    <TableBody>
                       <TableRow>
                          <TableCell className="text-xs text-muted-foreground">27/03/2026 14:15</TableCell><TableCell className="font-bold text-sm text-blue-600">OS-202610-8802</TableCell><TableCell className="font-mono text-xs">Porto/14.12.8392.11</TableCell>
                          <TableCell className="text-right font-medium">{fmtFin(84000)}</TableCell>
                          <TableCell><span className="text-green-600 text-xs font-bold uppercase flex gap-1 items-center"><CheckCircle className="w-3 h-3"/> Sucesso (Cod. 200)</span></TableCell>
                       </TableRow>
                       <TableRow className="bg-red-50/40">
                          <TableCell className="text-xs text-muted-foreground">27/03/2026 10:20</TableCell><TableCell className="font-bold text-sm text-blue-600">OS-10450-4411</TableCell><TableCell className="font-mono text-xs">Sura/99.11.2334.00</TableCell>
                          <TableCell className="text-right font-medium">{fmtFin(1500000)}</TableCell>
                          <TableCell><span className="text-red-600 text-xs font-bold uppercase flex gap-1 items-center"><AlertTriangle className="w-3 h-3"/> Rejeitado (Excedeu LMI)</span></TableCell>
                       </TableRow>
                    </TableBody>
                  </Table>
               </CardContent>
            </Card>
          </div>
       )}

       {aba === "sinistros" && (
          <div className="space-y-4">
            <Card>
               <CardHeader className="flex flex-row justify-between items-center py-4">
                 <div><CardTitle>Gerenciamento de Sinistros e Eventos</CardTitle></div>
                 <Button className="bg-red-600 hover:bg-red-700 text-white"><Plus className="w-4 h-4 mr-1"/> Abrir Sinistro</Button>
               </CardHeader>
               <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead>Data Evento</TableHead><TableHead>OS Atingida</TableHead><TableHead>Tipo Sinistro</TableHead><TableHead className="text-right">Estimativa Prejuízo</TableHead><TableHead>Protocolo Susep</TableHead><TableHead>Status Análise</TableHead><TableHead className="text-right">Dossier</TableHead></TableRow></TableHeader>
                    <TableBody>
                       <TableRow>
                          <TableCell className="text-sm">20/03/2026</TableCell><TableCell className="font-bold">OS-10450-3200</TableCell><TableCell><Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">Tombamento</Badge></TableCell>
                          <TableCell className="text-right font-medium text-red-600">{fmtFin(45000)}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">P-923184/26</TableCell>
                          <TableCell><Badge variant="outline" className="text-blue-700 bg-blue-50">Em Análise Técnica</Badge></TableCell>
                          <TableCell className="text-right"><Button variant="ghost" size="sm" className="h-8"><Download className="w-4 h-4 text-slate-500"/></Button></TableCell>
                       </TableRow>
                       <TableRow>
                          <TableCell className="text-sm">05/02/2026</TableCell><TableCell className="font-bold">OS-990-22</TableCell><TableCell><Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Roubo / Assalto</Badge></TableCell>
                          <TableCell className="text-right font-medium text-red-600">{fmtFin(120000)}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">P-011234/26</TableCell>
                          <TableCell><Badge variant="outline" className="text-green-700 bg-green-50 border-green-200">Indenizado (Pago)</Badge></TableCell>
                          <TableCell className="text-right"><Button variant="ghost" size="sm" className="h-8"><Download className="w-4 h-4 text-slate-500"/></Button></TableCell>
                       </TableRow>
                    </TableBody>
                  </Table>
               </CardContent>
            </Card>
          </div>
       )}

       {aba === "relatorio" && (
          <div className="space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
               <Card className="bg-slate-50"><CardContent className="p-4"><p className="text-[10px] font-bold text-slate-500 uppercase">Prêmios Pagos (YTD)</p><p className="text-2xl font-black mt-1 text-slate-800">{fmtFin(18900)}</p></CardContent></Card>
               <Card className="bg-blue-50"><CardContent className="p-4"><p className="text-[10px] font-bold text-blue-500 uppercase">Averbações (Qtd)</p><p className="text-2xl font-black mt-1 text-blue-700">4.102 OS's</p></CardContent></Card>
               <Card className="bg-red-50"><CardContent className="p-4"><p className="text-[10px] font-bold text-red-500 uppercase">Perdas Sinistradas</p><p className="text-2xl font-black mt-1 text-red-700">{fmtFin(45000)}</p></CardContent></Card>
               <Card className="bg-green-50"><CardContent className="p-4"><p className="text-[10px] font-bold text-green-500 uppercase">Indenizações Recuperadas</p><p className="text-2xl font-black mt-1 text-green-700">{fmtFin(120000)}</p></CardContent></Card>
             </div>
             <Card className="border-dashed border-2">
                <CardContent className="py-20 text-center text-muted-foreground flex flex-col items-center">
                   <BarChart2 className="w-12 h-12 mb-3 text-slate-300"/>
                   <h3 className="text-lg font-bold text-slate-700">Custo Percentual do Seguro sobre o Faturamento (Ad Valorem)</h3>
                   <p className="max-w-md text-sm mt-2">No primeiro trimestre, o custo final da proteção veicular representou <b>1.8%</b> do CMV Logístico.</p>
                </CardContent>
             </Card>
          </div>
       )}
     </div>
   );
}
