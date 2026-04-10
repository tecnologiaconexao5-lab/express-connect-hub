import { useState } from "react";
import { MessageSquare, Send, Users, ClipboardCopy, CheckCircle2, History, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function DisparosWhatsApp() {
  const [mensagem, setMensagem] = useState("");
  const [numeros, setNumeros] = useState("");
  const [enviado, setEnviado] = useState(false);

  const handleDisparoManual = () => {
    if (!mensagem || !numeros) return;
    // Simulação do envio
    setEnviado(true);
    setTimeout(() => {
      setEnviado(false);
      setMensagem("");
      setNumeros("");
    }, 3000);
  };

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-green-600" />
          Disparos e Automação (WhatsApp)
        </h2>
        <p className="text-sm text-muted-foreground">Central de comunicação oficial para divulgação de operações, captação e alertas.</p>
      </div>

      <Tabs defaultValue="manual" className="w-full">
        <TabsList className="bg-muted/50 mb-6 w-full justify-start border-b rounded-none pb-px">
          <TabsTrigger value="manual" className="px-6 data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-green-600 rounded-t-md"><MessageSquare className="w-4 h-4 mr-2"/> Modo Manual (Avulso)</TabsTrigger>
          <TabsTrigger value="banco" className="px-6 data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-green-600 rounded-t-md"><Users className="w-4 h-4 mr-2"/> Disparo em Base (Célula)</TabsTrigger>
          <TabsTrigger value="log" className="px-6 data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-green-600 rounded-t-md"><History className="w-4 h-4 mr-2"/> Status / Relatórios</TabsTrigger>
        </TabsList>

        {/* MODO 1: MANUAL */}
        <TabsContent value="manual">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             <Card className="shadow-sm border-t-4 border-t-green-500">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><ClipboardCopy className="w-4 h-4 text-green-600"/> Envio Rápido em Lote</CardTitle>
                  <CardDescription>Cole os números e redija a sua mensagem para envio em massa padronizado.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="space-y-2">
                     <Label>Lista de Contatos / Números</Label>
                     <Textarea 
                       placeholder="Cole os números aqui. Separe por linha ou vírgula.\nEx:\n11999999999\n11888888888" 
                       rows={4}
                       className="font-mono text-sm resize-none"
                       value={numeros}
                       onChange={(e) => setNumeros(e.target.value)}
                     />
                     <p className="text-[10px] text-muted-foreground flex justify-end">Formatos aceitos: DDD + Número</p>
                   </div>
                   <div className="space-y-2">
                     <Label>Conteúdo da Mensagem</Label>
                     <Textarea 
                       placeholder="Redija a mensagem ou cole o template da operação gerado anteriormente..." 
                       rows={6}
                       value={mensagem}
                       onChange={(e) => setMensagem(e.target.value)}
                       className="resize-none border-green-200 focus-visible:ring-green-500"
                     />
                   </div>
                </CardContent>
                <CardFooter className="bg-slate-50/50 justify-between border-t mt-2 flex items-center py-3">
                   <div className="text-xs text-muted-foreground font-semibold">
                      {numeros ? numeros.split(/[\n,]+/).filter(n => n.trim().length > 0).length : 0} contatos identificados
                   </div>
                   <Button 
                     onClick={handleDisparoManual} 
                     disabled={!numeros || !mensagem || enviado} 
                     className="bg-green-600 hover:bg-green-700 text-white font-bold gap-2"
                   >
                     {enviado ? <CheckCircle2 className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                     {enviado ? "Disparos Iniciados!" : "Enviar Lote WhatsApp"}
                   </Button>
                </CardFooter>
             </Card>

             {/* PREVIEW */}
             <div className="bg-[#E5DDD5] rounded-xl border border-slate-200 h-[500px] max-w-[350px] mx-auto w-full flex flex-col shadow-inner relative overflow-hidden">
                <div className="bg-[#075E54] w-full h-[60px] flex items-center px-4 text-white gap-3 shadow-md z-10 sticky top-0">
                   <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center"><Users className="w-4 h-4 text-white"/></div>
                   <div>
                     <p className="font-bold text-sm">Prévia da Mensagem</p>
                     <p className="text-[10px] text-white/70">Conta: Conexão Express Bot</p>
                   </div>
                </div>
                <div className="flex-1 p-4 overflow-y-auto space-y-4" style={{ backgroundImage: "url('https://i.pinimg.com/736x/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg')", backgroundSize: 'cover', backgroundBlendMode: 'overlay', backgroundColor: 'rgba(229, 221, 213, 0.8)' }}>
                   {mensagem ? (
                     <div className="bg-[#DCF8C6] p-3 rounded-lg rounded-tr-none w-[90%] ml-auto text-sm shadow-sm relative text-slate-800 break-words whitespace-pre-wrap font-sans">
                        {mensagem}
                        <div className="text-[9px] text-slate-400 absolute bottom-1 right-2 w-full text-right h-3">12:00 ✓✓</div>
                        <div className="h-2"></div>
                     </div>
                   ) : (
                     <div className="bg-white/80 p-3 rounded-xl text-center text-xs text-slate-500 font-semibold my-20 mx-4 border border-white/40 shadow-sm backdrop-blur-sm">
                        O preview em tempo real aparecerá aqui conforme você digita.
                     </div>
                   )}
                </div>
             </div>
          </div>
        </TabsContent>

        {/* MODO 2: BANCO CELULA DE TALENTOS */}
        <TabsContent value="banco">
          <Card className="shadow-sm border-0">
             <CardHeader className="border-b bg-slate-50/50 pb-4">
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                   <div className="flex-1 space-y-1">
                      <Label>Filtrar Base (Veículo Exigido)</Label>
                      <Select>
                        <SelectTrigger><SelectValue placeholder="Qualquer veículo"/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todas">Qualquer veículo</SelectItem>
                          <SelectItem value="carreta">Carreta / LS</SelectItem>
                          <SelectItem value="truck">Truck</SelectItem>
                          <SelectItem value="toco">Toco</SelectItem>
                          <SelectItem value="util">Utilitários / Van</SelectItem>
                        </SelectContent>
                      </Select>
                   </div>
                   <div className="flex-1 space-y-1">
                      <Label>Região (Base do Parceiro)</Label>
                      <Input placeholder="Ex: SP, MG, RJ..." />
                   </div>
                   <div className="flex-1 space-y-1">
                      <Label>Campanha Ativa para Disparo</Label>
                      <Select>
                        <SelectTrigger><SelectValue placeholder="Selecione Operação"/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="op1">Rota Sul D+1</SelectItem>
                          <SelectItem value="op2">Distribuição Capital</SelectItem>
                        </SelectContent>
                      </Select>
                   </div>
                   <Button className="bg-indigo-600 hover:bg-indigo-700">Filtrar Profissionais</Button>
                </div>
             </CardHeader>
             <CardContent className="pt-6">
                <div className="flex items-center justify-center p-12 py-20 flex-col text-muted-foreground border-2 border-dashed rounded-lg bg-slate-50/30">
                   <Users className="w-12 h-12 text-slate-300 mb-3" />
                   <p className="font-semibold text-slate-600">Nenhum filtro aplicado</p>
                   <p className="text-sm">Selecione o filtro acima para puxar os contatos da Célula de Talentos e realizar disparos automáticos.</p>
                </div>
             </CardContent>
          </Card>
        </TabsContent>

        {/* MODO 3: RELATÓRIOS / LOGS */}
        <TabsContent value="log">
          <Card className="shadow-sm border-0">
             <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4 text-slate-500" /> Logs Recentes</CardTitle>
             </CardHeader>
             <CardContent className="pt-4">
               <div className="space-y-4">
                  {/* Mock Logs */}
                  <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                     <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <div>
                           <p className="text-sm font-semibold text-slate-700">Lote Manual (45 contatos)</p>
                           <p className="text-xs text-slate-400">10/04/2026 14:32 • Operador: Admin</p>
                        </div>
                     </div>
                     <Badge className="bg-green-100 text-green-800 border-none">Concluído</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                     <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-yellow-500 animate-pulse" />
                        <div>
                           <p className="text-sm font-semibold text-slate-700">Base Ativa: Rota Sul (112 contatos)</p>
                           <p className="text-xs text-slate-400">10/04/2026 15:45 • Operador: Sistema_Wapp</p>
                        </div>
                     </div>
                     <Badge className="bg-yellow-100 text-yellow-800 border-none">Processando (48/112)</Badge>
                  </div>
               </div>
             </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
