import { useState, useEffect } from "react";
import { Package, PlusCircle, FileText, DollarSign, LogOut, CheckCircle, Search, Download } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getUser, logout } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PortalCliente() {
  const navigate = useNavigate();
  const user = getUser();
  const [activeTab, setActiveTab] = useState("entregas");
  const [entregas, setEntregas] = useState<any[]>([]);

  useEffect(() => {
    // Mock data fetching using RLS (simulating client-only view)
    setEntregas([
      { id: 1, os: "OS-202610-1045", origem: "São Paulo, SP", destino: "Rio de Janeiro, RJ", status: "Saiu para Rota", prev: "Amanhã, 16:00", step: 3 },
      { id: 2, os: "OS-202610-1033", origem: "Campinas, SP", destino: "Curitiba, PR", status: "Em Programação", prev: "05/11/2026", step: 1 },
      { id: 3, os: "OS-202609-8802", origem: "São Paulo, SP", destino: "Belo Horizonte, MG", status: "Entregue", prev: "20/09/2026", step: 4 },
    ]);
  }, []);

  const handleSair = () => {
    logout();
    navigate("/login");
  };

  const Stepper = ({ step }: { step: number }) => {
    const steps = ["Criado", "Em Viagem", "Em Rota Local", "Concluído"];
    return (
      <div className="flex items-center gap-1 mt-2">
        {steps.map((s, i) => (
          <div key={i} className="flex-1 flex flex-col gap-1">
             <div className={`h-1.5 rounded-full ${i < step ? 'bg-primary' : 'bg-muted'}`} />
             <span className={`text-[9px] font-bold ${i < step ? 'text-primary' : 'text-muted-foreground'}`}>{s}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Topbar Simplificada */}
      <header className="h-16 bg-white border-b flex items-center px-6 justify-between shadow-sm sticky top-0 z-50">
         <div className="flex items-center gap-3">
           <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center font-bold text-white shadow">CE</div>
           <div>
             <h1 className="font-bold text-slate-800 leading-tight">Conexão Express</h1>
             <p className="text-[10px] text-muted-foreground uppercase font-semibold">Portal do Cliente</p>
           </div>
         </div>
         <div className="flex items-center gap-4">
           <div className="hidden md:flex flex-col items-end">
             <span className="text-sm font-semibold">{user?.name || "Cliente Demonstrativo"}</span>
             <span className="text-[10px] text-muted-foreground">CNPJ: 00.123.456/0001-00</span>
           </div>
           <Button variant="ghost" size="icon" onClick={handleSair} className="text-muted-foreground hover:text-red-600 hover:bg-red-50"><LogOut className="w-5 h-5"/></Button>
         </div>
      </header>

      {/* Navegação e Conteúdo */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 lg:p-8">
         <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-white p-1 border shadow-sm w-full justify-start overflow-x-auto h-auto rounded-lg">
               <TabsTrigger value="entregas" className="px-6 py-2.5 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 text-slate-600"><Package className="w-4 h-4 mr-2"/> Minhas Entregas</TabsTrigger>
               <TabsTrigger value="solicitar" className="px-6 py-2.5 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 text-slate-600"><PlusCircle className="w-4 h-4 mr-2"/> Solicitar Coleta</TabsTrigger>
               <TabsTrigger value="documentos" className="px-6 py-2.5 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 text-slate-600"><FileText className="w-4 h-4 mr-2"/> Documentos</TabsTrigger>
               <TabsTrigger value="financeiro" className="px-6 py-2.5 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 text-slate-600"><DollarSign className="w-4 h-4 mr-2"/> Financeiro</TabsTrigger>
            </TabsList>

            {/* ENTREGAS */}
            <TabsContent value="entregas" className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {entregas.filter(e => e.step < 4).map(e => (
                   <Card key={e.id} className="border-t-4 border-t-orange-500 shadow-sm hover:shadow-md transition">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                           <div>
                             <h3 className="font-bold text-slate-800">{e.os}</h3>
                             <p className="text-xs text-muted-foreground">{e.origem} → {e.destino}</p>
                           </div>
                           <Badge variant="secondary" className="bg-orange-100 text-orange-800">{e.status}</Badge>
                        </div>
                        <Stepper step={e.step} />
                        <div className="mt-4 pt-4 border-t flex items-center justify-between">
                           <div>
                             <p className="text-[10px] text-muted-foreground uppercase font-bold">Previsão</p>
                             <p className="text-sm font-semibold">{e.prev}</p>
                           </div>
                           <Button size="sm" variant="outline" className="text-xs border-orange-200 text-orange-700 hover:bg-orange-50 h-8">Acompanhar</Button>
                        </div>
                      </CardContent>
                   </Card>
                 ))}
               </div>

               <Card>
                 <CardHeader><CardTitle className="text-base text-slate-700">Histórico de Movimentações (Entregues)</CardTitle></CardHeader>
                 <CardContent className="p-0">
                    <Table>
                      <TableHeader><TableRow><TableHead>Ordem</TableHead><TableHead>Rota</TableHead><TableHead>Data Conclusão</TableHead><TableHead className="text-right">Comprovante</TableHead></TableRow></TableHeader>
                      <TableBody>
                         {entregas.filter(e => e.step === 4).map(e => (
                           <TableRow key={e.id}>
                             <TableCell className="font-medium text-sm">{e.os}</TableCell>
                             <TableCell className="text-sm">{e.origem} → {e.destino}</TableCell>
                             <TableCell className="text-sm">{e.prev}</TableCell>
                             <TableCell className="text-right">
                               <Button variant="ghost" size="sm" className="h-8 gap-2 text-primary hover:bg-primary/10">
                                 <Download className="w-4 h-4" /> DACTE / Imagem
                               </Button>
                             </TableCell>
                           </TableRow>
                         ))}
                      </TableBody>
                    </Table>
                 </CardContent>
               </Card>
            </TabsContent>

            {/* SOLICITAR COLETA */}
            <TabsContent value="solicitar">
               <Card className="max-w-2xl mx-auto">
                 <CardHeader>
                   <CardTitle className="text-xl">Solicitação Rápida</CardTitle>
                   <CardDescription>Preencha os dados básicos e nossa retaguarda comercial aprovará imediatamente em seu e-mail.</CardDescription>
                 </CardHeader>
                 <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1"><label className="text-xs font-semibold">CEP Origem (Coleta)</label><Input placeholder="00000-000" /></div>
                      <div className="space-y-1"><label className="text-xs font-semibold">CEP Destino (Entrega)</label><Input placeholder="00000-000" /></div>
                      <div className="col-span-2 space-y-1"><label className="text-xs font-semibold">Mercadoria e Valor Aprox.</label><Input placeholder="Ex: Peças automotivas, R$ 10.000,00" /></div>
                      <div className="space-y-1"><label className="text-xs font-semibold">Peso (Kg)</label><Input type="number" placeholder="0" /></div>
                      <div className="space-y-1"><label className="text-xs font-semibold">Volumes</label><Input type="number" placeholder="0" /></div>
                    </div>
                    <Button 
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold h-12 mt-4"
                      onClick={() => alert("Pedido de Coleta #REQ-0932 gerado com sucesso!")}
                    >
                      <CheckCircle className="w-5 h-5 mr-2" /> Emitir Solicitação
                    </Button>
                 </CardContent>
               </Card>
            </TabsContent>

            {/* DOCUMENTOS */}
            <TabsContent value="documentos">
               <Card>
                 <CardHeader className="flex flex-row items-center justify-between">
                   <CardTitle className="text-base">Meus Conhecimentos e Notas Fiscais</CardTitle>
                   <div className="relative max-w-xs">
                     <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                     <Input placeholder="Buscar por chave..." className="pl-9 h-9 text-xs" />
                   </div>
                 </CardHeader>
                 <CardContent className="p-0">
                    <Table>
                      <TableHeader><TableRow><TableHead>Emissão</TableHead><TableHead>Documento</TableHead><TableHead>Chave</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                      <TableBody>
                         <TableRow><TableCell className="text-sm">26/03/2026</TableCell><TableCell className="font-semibold text-sm">CT-e 105001</TableCell><TableCell className="font-mono text-[10px] text-muted-foreground">352610123...4501</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon"><Download className="w-4 h-4 text-slate-600"/></Button></TableCell></TableRow>
                         <TableRow><TableCell className="text-sm">26/03/2026</TableCell><TableCell className="font-semibold text-sm">NFS-e 9002</TableCell><TableCell className="font-mono text-[10px] text-muted-foreground">9002220...8888</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon"><Download className="w-4 h-4 text-slate-600"/></Button></TableCell></TableRow>
                      </TableBody>
                    </Table>
                 </CardContent>
               </Card>
            </TabsContent>

            {/* FINANCEIRO */}
            <TabsContent value="financeiro" className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <Card className="bg-red-50 border-red-100"><CardContent className="p-4"><p className="text-xs font-bold text-red-800 uppercase">Faturas Vencidas</p><p className="text-2xl font-bold text-red-600 mt-1">{fmtFin(0)}</p></CardContent></Card>
                 <Card className="bg-blue-50 border-blue-100"><CardContent className="p-4"><p className="text-xs font-bold text-blue-800 uppercase">A Vencer</p><p className="text-2xl font-bold text-blue-600 mt-1">{fmtFin(14500)}</p></CardContent></Card>
                 <Card className="bg-green-50 border-green-100"><CardContent className="p-4"><p className="text-xs font-bold text-green-800 uppercase">Pagos no Mês</p><p className="text-2xl font-bold text-green-600 mt-1">{fmtFin(35000)}</p></CardContent></Card>
               </div>
               
               <Card>
                 <CardHeader><CardTitle className="text-base">Minhas Faturas</CardTitle></CardHeader>
                 <CardContent className="p-0">
                    <Table>
                      <TableHeader><TableRow><TableHead>Fatura</TableHead><TableHead>Competência</TableHead><TableHead>OS Vinculadas</TableHead><TableHead>Vencimento</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Boleto</TableHead></TableRow></TableHeader>
                      <TableBody>
                         <TableRow>
                           <TableCell className="font-semibold text-sm">FAT-0045</TableCell><TableCell className="text-sm">10/2026</TableCell><TableCell className="text-xs text-muted-foreground">OS-1045, OS-1033</TableCell><TableCell className="text-sm">10/11/2026</TableCell><TableCell className="font-medium text-sm">{fmtFin(14500)}</TableCell>
                           <TableCell><Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">A Vencer</Badge></TableCell>
                           <TableCell className="text-right"><Button variant="outline" size="sm" className="h-7 text-xs border-dashed gap-1">Boletim / PIX</Button></TableCell>
                         </TableRow>
                      </TableBody>
                    </Table>
                 </CardContent>
               </Card>
            </TabsContent>

         </Tabs>
      </main>
    </div>
  );
}
