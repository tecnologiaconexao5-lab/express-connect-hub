import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Network, CheckCircle2, XCircle, Clock, Eye, RefreshCw, Key, ShieldAlert, BadgeInfo, BellRing, Database, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";

export default function MonitorIntegracoes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "monitor";
  const handleTabChange = (val: string) => setSearchParams({ tab: val });

  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase.from("integration_logs").select("*").order("created_at", { ascending: false }).limit(50);
      if (data && data.length > 0) {
        setLogs(data);
      } else {
        // Mock se tabela vazia/nao preenchida
        setLogs([
          { id: 1, created_at: new Date().toISOString(), integration_name: "SEFAZ_CTE", endpoint: "https://api.sefaz.gov.br/cte", method: "POST", status_code: 200, latency_ms: 1542 },
          { id: 2, created_at: new Date(Date.now() - 60000).toISOString(), integration_name: "ANTT_CIOT", endpoint: "https://api.efrete.com.br/ciot", method: "POST", status_code: 403, error_message: "Bloqueio ANTT: RNTRC suspenso.", latency_ms: 910 },
          { id: 3, created_at: new Date(Date.now() - 360000).toISOString(), integration_name: "WS_PREFEITURA_NFSE", endpoint: "https://api.prefeitura.gov.br/3550308/nfse", method: "POST", status_code: 504, error_message: "Gateway Timeout Prefecture 3550308", latency_ms: 29050 },
          { id: 4, created_at: new Date(Date.now() - 860000).toISOString(), integration_name: "SEGURO_ATMS", endpoint: "https://ws.portoseguro.com.br/averbacoes", method: "POST", status_code: 200, latency_ms: 602 },
        ]);
      }
    } catch { /* erro ignorado */ }
  };

  const getStatusBadge = (code: number) => {
    if (code >= 200 && code < 300) return <Badge variant="outline" className="text-green-700 bg-green-50 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1"/> Sucesso</Badge>;
    if (code >= 500) return <Badge variant="outline" className="text-orange-700 bg-orange-50 border-orange-200"><Clock className="w-3 h-3 mr-1"/> Intermitente</Badge>;
    return <Badge variant="outline" className="text-red-700 bg-red-50 border-red-200"><XCircle className="w-3 h-3 mr-1"/> Erro/Recusado</Badge>;
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Network className="w-8 h-8 text-primary" /> API & Integrações
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">Monitoramento de tráfego (SEFAZ, ANTT, Seguros, PM/NFSe) e certificados A1.</p>
        </div>
        <div className="flex flex-col gap-1 items-end">
           <Badge variant="secondary" className="bg-red-50 text-red-600 border border-red-200"><BellRing className="w-3 h-3 mr-1"/> 1 Alerta de Integração Crítica (ANTT falhando freq.)</Badge>
           <Badge variant="secondary" className="bg-orange-50 text-orange-600 border border-orange-200"><Key className="w-3 h-3 mr-1"/> Certificado A1 expira em 22 Dias (24/10/2026)</Badge>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-card justify-start overflow-x-auto border-b rounded-none w-full">
           <TabsTrigger value="monitor" className="px-5"><Activity className="w-4 h-4 mr-2"/> Monitor de Requisições Ao Vivo</TabsTrigger>
           <TabsTrigger value="sefaz" className="px-5"><ShieldAlert className="w-4 h-4 mr-2"/> Configuração SEFAZ / CTe</TabsTrigger>
           <TabsTrigger value="ciot" className="px-5"><Database className="w-4 h-4 mr-2"/> ANTT / EFRETE (CIOT)</TabsTrigger>
           <TabsTrigger value="nfse" className="px-5"><BadgeInfo className="w-4 h-4 mr-2"/> Webservice Prefeituras</TabsTrigger>
        </TabsList>

        <TabsContent value="monitor" className="pt-4 space-y-4">
           <Card>
              <CardHeader className="flex flex-row justify-between items-center py-4 border-b">
                 <div>
                   <CardTitle className="flex gap-2 items-center"><Activity className="w-5 h-5 text-indigo-500 animate-pulse"/> Log de Tráfego API</CardTitle>
                   <CardDescription>Respostas e latências dos endpoints externos das últimas 24h.</CardDescription>
                 </div>
                 <Button variant="outline" size="sm" onClick={fetchLogs}><RefreshCw className="w-4 h-4 mr-2"/> Atualizar Painel</Button>
              </CardHeader>
              <CardContent className="p-0">
                 <Table>
                   <TableHeader><TableRow><TableHead>Data / Hora</TableHead><TableHead>Sistema Alvo / API</TableHead><TableHead>Endpoint (URL)</TableHead><TableHead className="text-center">Método</TableHead><TableHead className="text-right">Latência (ms)</TableHead><TableHead>Status Code</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader>
                   <TableBody>
                      {logs.map((log, i) => (
                         <TableRow key={i} className={log.status_code >= 400 ? "bg-red-50/20" : ""}>
                            <TableCell className="text-xs text-muted-foreground font-mono">{new Date(log.created_at).toLocaleTimeString()}</TableCell>
                            <TableCell className="font-bold text-sm text-slate-800">{log.integration_name}</TableCell>
                            <TableCell className="font-mono text-xs text-slate-500">{log.endpoint}</TableCell>
                            <TableCell className="text-center"><Badge variant="outline" className="bg-slate-50">{log.method}</Badge></TableCell>
                            <TableCell className="text-right font-mono text-xs">{log.latency_ms} ms</TableCell>
                            <TableCell>{getStatusBadge(log.status_code)} {log.error_message && <p className="text-[10px] text-red-600 font-bold overflow-hidden text-ellipsis whitespace-nowrap max-w-[180px]" title={log.error_message}>{log.error_message}</p>}</TableCell>
                            <TableCell className="text-right flex items-center justify-end gap-1">
                               <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" title="Ver Payload Request/Response"><Eye className="w-4 h-4"/></Button>
                               {log.status_code >= 400 && <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-600 bg-orange-50 hover:bg-orange-100" title="Reprocessar Fila / Tentar Novamente"><RefreshCw className="w-4 h-4"/></Button>}
                            </TableCell>
                         </TableRow>
                      ))}
                   </TableBody>
                 </Table>
              </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="sefaz" className="pt-4 space-y-4">
           {/* Form configs da SEFAZ - UI Mock */}
           <Card className="max-w-3xl">
              <CardHeader><CardTitle>Parâmetros Nacionais (Emissão de CT-e / MDF-e)</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                 <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg mb-4 flex justify-between items-center">
                    <div>
                       <p className="font-bold text-indigo-900 border-b border-indigo-200 pb-1 mb-2">Certificado Digital Instalado (A1)</p>
                       <p className="text-sm font-mono text-indigo-700">CNPJ: 14.888.111/0001-99</p>
                       <p className="text-sm text-indigo-700">Válido até: <b>24/10/2026</b></p>
                    </div>
                    <Button variant="outline" className="bg-white text-indigo-700 border-indigo-300">Renovar .PFX</Button>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-600">Ambiente SEFAZ</label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                         <option>Homologação (Testes)</option><option selected>Produção</option>
                      </select>
                    </div>
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-600">UF Remetente (Padrão)</label><Input defaultValue="SP" /></div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-600">Série do CT-e Operacional</label><Input defaultValue="1" /></div>
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-600">Numeração Atual (Próximo CT-e)</label><Input defaultValue="145892" type="number" /></div>
                 </div>
                 
                 <Button className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700">Salvar Parametrização Fiscal</Button>
              </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="ciot" className="pt-4 space-y-4">
           <Card className="max-w-3xl">
              <CardHeader><CardTitle>Parâmetros da ANTT (Gerador de CIOT)</CardTitle><CardDescription>Gateway de homologação bancária (eFrete / Repom / Pamcary).</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                 <div className="space-y-1"><label className="text-xs font-bold text-slate-600">Parceiro IPEF (Instituição de Pagamento Eletrônico)</label>
                   <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option>eFrete S.A.</option><option>Pamcard (Pamcary)</option><option>Repom (Edenred)</option>
                   </select>
                 </div>
                 <div className="space-y-1"><label className="text-xs font-bold text-slate-600">Token Credencial ANTT (Partner API)</label><Input type="password" defaultValue="token12345" /></div>
                 <div className="space-y-1"><label className="text-xs font-bold text-slate-600">RNTRC da Transportadora Emitente</label><Input defaultValue="1429811" /></div>
                 <Button className="w-full mt-4">Validar Credencial CIOT</Button>
              </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="nfse" className="pt-4 space-y-4">
           <Card className="max-w-3xl">
              <CardHeader><CardTitle>Prefeitura Municipal (NFS-e ISSQN)</CardTitle><CardDescription>Token webservice de prefeituras base ABRASF / GINFES.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                 <div className="space-y-1"><label className="text-xs font-bold text-slate-600">Município Emissor ERP</label><Input defaultValue="São Paulo / SP (Layout DSF)" readOnly className="bg-slate-50"/></div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-600">Inscrição Municipal (IM)</label><Input defaultValue="8.123.444-2" /></div>
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-600">Alíquota ISS (%) Fixa</label><Input defaultValue="3" type="number" /></div>
                 </div>
                 <div className="space-y-1"><label className="text-xs font-bold text-slate-600">Série do RPS</label><Input defaultValue="RPS" /></div>
                 <Button className="w-full mt-4">Sincronizar Lotes Base</Button>
              </CardContent>
           </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
