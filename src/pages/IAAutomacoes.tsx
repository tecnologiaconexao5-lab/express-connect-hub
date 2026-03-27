import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Sparkles, MessageCircle, Truck, FileText, Activity, ShieldAlert, Cpu, Bot, Key, AlignLeft, BarChart3, Clock, Settings2, Play, Pause, Save, Check } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function IAAutomacoes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "dashboard";
  const handleTabChange = (val: string) => setSearchParams({ tab: val });
  const [iaStatus, setIaStatus] = useState("automático");

  const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-primary" /> Torre de Controle IA & Automações
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">Painel de Orquestração da Inteligência Artificial Operacional (Motor Anthropic Claude-Sonnet).</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-md border border-slate-200 shadow-sm max-w-sm">
           <Button variant={iaStatus === "automático" ? "default" : "ghost"} size="sm" onClick={() => setIaStatus("automático")} className={iaStatus === "automático" ? "bg-green-600 hover:bg-green-700" : ""}><Play className="w-3 h-3 mr-1"/> Automático</Button>
           <Button variant={iaStatus === "semi" ? "default" : "ghost"} size="sm" onClick={() => setIaStatus("semi")} className={iaStatus === "semi" ? "bg-orange-500 hover:bg-orange-600" : ""}><Activity className="w-3 h-3 mr-1"/> Semi-Auto</Button>
           <Button variant={iaStatus === "pausado" ? "default" : "ghost"} size="sm" onClick={() => setIaStatus("pausado")} className={iaStatus === "pausado" ? "bg-red-600 hover:bg-red-700 text-white" : "text-red-500"}><Pause className="w-3 h-3 mr-1"/> Pausar Toda IA</Button>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-card justify-start overflow-x-auto border-b rounded-none w-full">
           <TabsTrigger value="dashboard" className="px-5"><BarChart3 className="w-4 h-4 mr-2"/> Dashboard Executivo</TabsTrigger>
           <TabsTrigger value="whatsapp" className="px-5"><MessageCircle className="w-4 h-4 mr-2"/> Agente WhatsApp</TabsTrigger>
           <TabsTrigger value="cte" className="px-5"><FileText className="w-4 h-4 mr-2"/> Fatorador CT-e (IA)</TabsTrigger>
           <TabsTrigger value="semiauto" className="px-5">
              <ShieldAlert className="w-4 h-4 mr-2"/> Fila de Validação Humana 
              <Badge variant="destructive" className="ml-2 py-0 h-5 px-1.5 text-[10px]">3 Pendentes</Badge>
           </TabsTrigger>
           <TabsTrigger value="config" className="px-5"><Key className="w-4 h-4 mr-2"/> Integrações & Engine</TabsTrigger>
        </TabsList>

        {/* --- DASHBOARD IA --- */}
        <TabsContent value="dashboard" className="pt-4 space-y-4">
           <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
               <Card className="bg-slate-50"><CardContent className="p-4"><p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><Bot className="w-3 h-3"/> Chamados Lidos (Hoje)</p><p className="text-3xl font-black mt-1 text-blue-600">842</p></CardContent></Card>
               <Card className="bg-slate-50 border-green-200"><CardContent className="p-4"><p className="text-[10px] font-bold text-green-700 uppercase flex items-center gap-1"><Check className="w-3 h-3"/> Resolução S/ Humano</p><p className="text-3xl font-black mt-1 text-green-600">92.4%</p></CardContent></Card>
               <Card className="bg-slate-50"><CardContent className="p-4"><p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><Truck className="w-3 h-3"/> Alocações Auto (OS)</p><p className="text-3xl font-black mt-1 text-purple-600">105 Rotas</p></CardContent></Card>
               <Card className="bg-slate-50 border-orange-200"><CardContent className="p-4"><p className="text-[10px] font-bold text-orange-700 uppercase flex items-center gap-1"><Clock className="w-3 h-3"/> Horas Humanas Salvas</p><p className="text-3xl font-black mt-1 text-orange-600">~42h Mês</p></CardContent></Card>
           </div>
           
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
             <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Activity className="w-5 h-5 text-indigo-500"/> Monitor de Anomalias Logísticas (Edge)</CardTitle><CardDescription>Ações autônomas que a IA mitigou nas últimas 24h sem acionar SAC.</CardDescription></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead>Anomalia Identificada</TableHead><TableHead>Ação Corretiva Aplicada (IA)</TableHead><TableHead className="text-right">OS Alvo</TableHead></TableRow></TableHeader>
                    <TableBody>
                       <TableRow>
                          <TableCell className="font-semibold text-sm">OS sem Prestador a 2h do Prazo Inicial</TableCell><TableCell className="text-xs text-muted-foreground">O Agente iniciou 'Alocação Automática' puxando o candidato Rank #1 e enviou Webhook Push.</TableCell>
                          <TableCell className="text-right"><Badge variant="outline" className="font-mono bg-indigo-50 text-indigo-700">OS-8021</Badge></TableCell>
                       </TableRow>
                       <TableRow className="bg-red-50/30">
                          <TableCell className="font-semibold text-sm text-red-700">Risco no SLA (Trânsito Excedendo Tempo)</TableCell><TableCell className="text-xs text-muted-foreground">IA enviou notificação SMS ao cliente atualizando SLA, escalou pro WhatsApp do Setor Torre.</TableCell>
                          <TableCell className="text-right"><Badge variant="outline" className="font-mono bg-red-50 text-red-700 border-red-200">OS-8012</Badge></TableCell>
                       </TableRow>
                       <TableRow>
                          <TableCell className="font-semibold text-sm">Fatura Vencida (3 dias)</TableCell><TableCell className="text-xs text-muted-foreground">Envio de e-mail de lembrete com Boleto 2a via anexo extraído do gateway financeiro.</TableCell>
                          <TableCell className="text-right"><span className="text-xs font-mono font-bold text-slate-400">FAT-990</span></TableCell>
                       </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
             </Card>
             
             <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><FileText className="w-5 h-5 text-green-600"/> Audit Log de Decisões</CardTitle><CardDescription>Registro persistido de requisições enviadas ao modelo Claude-Sonnet-3.5.</CardDescription></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead>Timestamp</TableHead><TableHead>Tipo Ação</TableHead><TableHead>Custo(Tk)</TableHead><TableHead className="text-right">Aval Humana</TableHead></TableRow></TableHeader>
                    <TableBody>
                       <TableRow>
                          <TableCell className="text-xs font-mono">18:14</TableCell><TableCell className="text-xs font-bold text-blue-600">WHATSAPP_RESPONDER</TableCell><TableCell className="font-mono text-xs text-slate-400">142 tks</TableCell>
                          <TableCell className="text-right"><Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200"><Check className="w-3 h-3 mr-1"/> Auto</Badge></TableCell>
                       </TableRow>
                       <TableRow>
                          <TableCell className="text-xs font-mono">17:50</TableCell><TableCell className="text-xs font-bold text-purple-600">SUGERIR_VEICULO</TableCell><TableCell className="font-mono text-xs text-slate-400">89 tks</TableCell>
                          <TableCell className="text-right"><Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200"><Check className="w-3 h-3 mr-1"/> Auto</Badge></TableCell>
                       </TableRow>
                       <TableRow className="bg-orange-50/50">
                          <TableCell className="text-xs font-mono">17:15</TableCell><TableCell className="text-xs font-bold text-orange-600">FECHAR_ORCAMENTO</TableCell><TableCell className="font-mono text-xs text-slate-400">451 tks</TableCell>
                          <TableCell className="text-right"><Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">Aprov. Manual</Badge></TableCell>
                       </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
             </Card>
           </div>
        </TabsContent>

        {/* --- AGENTE WHATSAPP --- */}
        <TabsContent value="whatsapp" className="pt-4 space-y-4">
           <Card>
              <CardHeader><CardTitle>Regras do Agente Conversacional Omnichannel</CardTitle><CardDescription>Customização da personalidade interativa que atende clientes e prestadores.</CardDescription></CardHeader>
              <CardContent className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-4">
                      <div className="space-y-1"><label className="text-sm font-bold">Nome da Persona IA</label><Input defaultValue="ExpressBot (Sentinela)" /></div>
                      <div className="space-y-1"><label className="text-sm font-bold">Tom Direcional de Diálogo</label>
                        <select className="w-full flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
                           <option>Formal e Corporativo (Recomendado Clientes B2B)</option>
                           <option selected>Empático e Casual (Recomendado Prestadores)</option>
                           <option>Técnico Seco</option>
                        </select>
                      </div>
                      <div className="space-y-1"><label className="text-sm font-bold">Mensagem Base Fora do Horário</label>
                         <Textarea rows={3} defaultValue={"Nosso expediente principal encerrou.\nMas eu sou uma IA e estou aqui 24/7! Como posso ajudar na sua Operação?"}/>
                      </div>
                   </div>
                   <div className="space-y-4 bg-slate-50 p-4 rounded border">
                      <p className="font-bold text-slate-800 text-sm mb-2"><Sparkles className="w-4 h-4 inline text-blue-500 mb-1"/> Envios Proativos Habilitados no Motor</p>
                      
                      <div className="flex items-center space-x-2 bg-white p-2 rounded shadow-sm border border-slate-200">
                         <input type="checkbox" checked className="w-4 h-4 text-blue-600" />
                         <label className="text-xs font-medium leading-none cursor-pointer"><b>D-1 Prestador:</b> Re-lembrar prestador 1 dia antes da Coleta.</label>
                      </div>
                      <div className="flex items-center space-x-2 bg-white p-2 rounded shadow-sm border border-slate-200">
                         <input type="checkbox" checked className="w-4 h-4 text-blue-600" />
                         <label className="text-xs font-medium leading-none cursor-pointer"><b>Check-out Financeiro:</b> Notificar prestador assim que pix for despendido.</label>
                      </div>
                      <div className="flex items-center space-x-2 bg-white p-2 rounded shadow-sm border border-slate-200">
                         <input type="checkbox" checked className="w-4 h-4 text-blue-600" />
                         <label className="text-xs font-medium leading-none cursor-pointer"><b>Monitor SLA Rota Livre:</b> Avisar End-user Cliente que "O caminhão saiu".</label>
                      </div>
                      <div className="flex items-center space-x-2 bg-white p-2 rounded shadow-sm border border-slate-200">
                         <input type="checkbox" checked className="w-4 h-4 text-blue-600" />
                         <label className="text-xs font-medium leading-none cursor-pointer"><b>D-0 Ocorrência:</b> Caso OS mude de status pra Pânico/Ocorrência, acalmar Cliente.</label>
                      </div>
                   </div>
                 </div>
                 <Button className="bg-blue-600 hover:bg-blue-700"><Save className="w-4 h-4 mr-2"/> Salvar Regras de Prompting</Button>
              </CardContent>
           </Card>
        </TabsContent>

        {/* --- CTE / OPERACIONAL --- */}
        <TabsContent value="cte" className="pt-4 space-y-4">
           <Card className="bg-slate-50">
              <CardContent className="py-8 px-8 flex justify-between items-center text-slate-600">
                 <div className="text-sm">
                    <p className="font-bold text-slate-800 text-lg flex items-center gap-2"><Cpu className="w-5 h-5 text-indigo-600"/> Robô Emissor Fiscal SEFAZ (CT-e / MDF-e)</p>
                    <p className="max-w-xl text-muted-foreground mt-2">Ao finalizar uma Ordem de Serviço, o motor checa o contrato do Cliente alvo. Se exigir fiscal, o Extrator analisa as regiões (Endereços da OS) define o CFOP (Ex: 6351 ou 5351), o NCM, Peso Bruto e puxa os CNPJs para gerar emissão asíncrona no ambiente.</p>
                 </div>
                 <div className="flex flex-col gap-2">
                   <select className="w-48 flex h-10 items-center justify-between rounded border border-slate-300 bg-white px-3 py-2 text-sm font-bold shadow-sm">
                     <option>Ambiente SEFAZ: HOMOLOGAÇÃO</option>
                     <option>Ambiente SEFAZ: PRODUÇÃO</option>
                   </select>
                   <Button variant="outline" className="border-indigo-600 text-indigo-700 hover:bg-indigo-50 font-bold bg-white text-xs"><Key className="w-3 h-3 mr-2"/> Fazer Upload do A1 (Certificado)</Button>
                 </div>
              </CardContent>
           </Card>
        </TabsContent>

        {/* --- FILA SEMI-AUTO --- */}
        <TabsContent value="semiauto" className="pt-4 space-y-4">
           <Card className="border-orange-500 shadow-orange-100">
              <CardHeader className="bg-orange-50"><CardTitle className="text-orange-900 border-b-orange-200">Caixa de Entrada Logística (Supervisão Humana)</CardTitle><CardDescription className="text-orange-700 font-medium">Você ligou o status [Semi-Auto]. Todas decisões complexas ficarão presas numa "Waiting Room" até você aprovar a sintaxe sugerida pela IA.</CardDescription></CardHeader>
              <CardContent className="p-0">
                 <div className="divide-y relative bg-white">
                    {/* Fila 1 */}
                    <div className="p-6 flex gap-6 hover:bg-slate-50 transition">
                       <div className="mt-1"><div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">1</div></div>
                       <div className="flex-1 space-y-2">
                          <h4 className="font-bold text-slate-800 text-lg">Alocação de Prestador — OS-88401</h4>
                          <p className="text-sm text-slate-600">A IA vasculhou o banco e Rankeou "Transportes ABC" como Top Score (Score: 89, Distância Coleta: 12km). <br/>Motivo do Rankeamento gerado pela IA: <i>[O prestador Transportes ABC possui van refrigerada requisitada pelo orçamento e atua na malha oeste, minimizando passivo.]</i></p>
                          <div className="pt-2 flex gap-2">
                             <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"><Check className="w-4 h-4 mr-1"/> Autorizar Push ao Prestador</Button>
                             <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 border-red-200">Rejeitar (Skipação Manual)</Button>
                          </div>
                       </div>
                    </div>
                    {/* Fila 2 */}
                    <div className="p-6 flex gap-6 hover:bg-slate-50 transition">
                       <div className="mt-1"><div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold">2</div></div>
                       <div className="flex-1 space-y-2">
                          <h4 className="font-bold text-slate-800 text-lg">Envio de Fechamento de Faturas (Proativo)</h4>
                          <p className="text-sm text-slate-600">O robô gerou 14 faturamentos proativos totalizando R$ 84.100,00 lendo os fechamentos de Quinzena (15m). Solicitação para disparar os emails comerciais oficiais com as NFs processadas amarradas.</p>
                          <div className="pt-2 flex gap-2">
                             <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"><Check className="w-4 h-4 mr-1"/> Aprovar Disparo em Lote</Button>
                          </div>
                       </div>
                    </div>
                 </div>
              </CardContent>
           </Card>
        </TabsContent>

        {/* --- CONFIG --- */}
        <TabsContent value="config" className="pt-4 space-y-4">
           <Card className="max-w-2xl mx-auto mt-6">
              <CardHeader className="text-center pb-2"><Key className="w-12 h-12 text-slate-300 mx-auto mb-4"/><CardTitle>Chaves de Integração (Anthropic)</CardTitle><CardDescription>Configure aqui os Tokens essenciais para o motor Claude-Sonnet assumir as funções estruturais.</CardDescription></CardHeader>
              <CardContent className="space-y-4 pt-6">
                 <div>
                    <label className="text-sm font-bold text-slate-700 mb-2 block">API Key Anthropic (sk-ant...)</label>
                    <Input type="password" placeholder="Cole sua chave gerada no Anthropic Console" className="font-mono text-sm h-12" value="sk-ant-api03-P21x9jLq2...mocked..."/>
                 </div>
                 <div>
                    <label className="text-sm font-bold text-slate-700 mb-2 block">Modelo Padrão da Arquitetura</label>
                    <Input value="claude-sonnet-4-20250514" readOnly className="font-mono text-sm bg-slate-50 text-slate-500"/>
                    <p className="text-xs text-muted-foreground mt-2">Recomendamos deixar travado na série Sonnet para equilibrar latência Rápida (Cálculos WhatsApp) com Cognição Densa (CTe).</p>
                 </div>
                 <div className="pt-6">
                    <Button className="w-full h-12 bg-slate-800 text-white font-bold"><Save className="w-5 h-5 mr-2"/> Persistir Tokens no Secret Edge</Button>
                 </div>
              </CardContent>
           </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
