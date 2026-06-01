import { useEffect, useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Truck, FileText, History, Code, SearchX, CheckCircle2, XCircle, ShieldAlert, AlertTriangle, Send, GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import MdfeTimeline from "./MdfeTimeline";
import { alterarStatusFiscalInterno, listarHistoricoStatus } from "@/services/fiscal/fiscalStatusService";

interface MdfeDetailsProps {
  mdfe: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: string;
}

const fmtFin = (v: number) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";

export default function MdfeDetails({ mdfe, open, onOpenChange, defaultTab = "resumo" }: MdfeDetailsProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [showPreEmissao, setShowPreEmissao] = useState(false);
  const [showSimulacao, setShowSimulacao] = useState(false);
  const [simulacaoAcao, setSimulacaoAcao] = useState("");
  const [motivoSimulacao, setMotivoSimulacao] = useState("");
  const [historico, setHistorico] = useState<any[]>([]);

  useEffect(function() {
    if (open) setActiveTab(defaultTab);
  }, [open, defaultTab]);

  useEffect(function() {
    if (open && mdfe?.id && (activeTab === "logs" || activeTab === "fiscal")) fetchLogs();
  }, [open, mdfe?.id, activeTab]);

  const fetchLogs = async function() {
    try {
      setLoadingLogs(true);
      const { data, error } = await supabase
        .from("fiscal_logs")
        .select("*")
        .eq("entidade_tipo", "MDFE")
        .eq("entidade_id", mdfe.id)
        .order("created_at", { ascending: false });
      if (!error && data) setLogs(data);
    } catch (err) {
      console.error("Erro ao carregar logs:", err);
    } finally { setLoadingLogs(false); }
  };

  const handlePreEmissao = async function() {
    setShowPreEmissao(true);
    try {
      await supabase.from("fiscal_logs").insert([{
        entidade_tipo: "MDFE", entidade_id: mdfe.id,
        acao: "PRE_EMISSAO_MDFE_VISUALIZADA",
        request: { mdfe_id: mdfe.id },
        response: { status: "dados_internos_prontos" },
      }]);
    } catch { /* opcional */ }
  };

  const fetchHistorico = async function() {
    if (!mdfe?.id) return;
    const data = await listarHistoricoStatus("MDFE", mdfe.id);
    setHistorico(data);
  };

  const openSimulacao = function(acao: string) {
    setSimulacaoAcao(acao);
    setMotivoSimulacao("");
    setShowSimulacao(true);
  };

  const handleSimular = async function() {
    if (!motivoSimulacao.trim()) { toast.error("Informe o motivo da simulacao."); return; }
    const statusNovo = simulacaoAcao === "cancelar" ? "cancelado_simulado" : simulacaoAcao === "encerrar" ? "encerrado_simulado" : "rejeitado_simulado";
    const result = await alterarStatusFiscalInterno({ documentoTipo:"MDFE",documentoId:mdfe.id,statusNovo,motivo:motivoSimulacao });
    if (result.success) { toast.success("Simulacao concluida: "+simulacaoAcao); setShowSimulacao(false); fetchHistorico(); }
    else toast.error("Erro: "+(result.error||""));
  };

  if (!mdfe) return null;

  const getStatusBadge = function(status: string) {
    switch (status) {
      case "Autorizado": case "Encerrado": return <Badge className="bg-green-50 text-green-700 border-green-200">{status}</Badge>;
      case "Rejeitado": case "Cancelado": return <Badge className="bg-red-50 text-red-700 border-red-200">{status}</Badge>;
      case "Em Processamento": return <Badge className="bg-amber-50 text-amber-700 border-amber-200">{status}</Badge>;
      default: return <Badge className="bg-blue-50 text-blue-700 border-blue-200">{status || "Rascunho"}</Badge>;
    }
  };

  const metadata = mdfe.metadata || {};
  const validacoes = Array.isArray(metadata.validacoes_pendentes) ? metadata.validacoes_pendentes : [];
  const pronto = metadata.pronto_para_emissao;
  const erros = validacoes.filter(function(v: any) { return v.severidade === "erro"; });
  const avisos = validacoes.filter(function(v: any) { return v.severidade === "aviso"; });
  const temErros = erros.length > 0;

  const ctesVinc = metadata.ctes_vinculados || [];
  const ufInicio = metadata.uf_inicio || "-";
  const ufFim = metadata.uf_fim || "-";

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="h-screen top-0 right-0 left-auto mt-0 w-full sm:w-[600px] rounded-none">
        <DrawerHeader className="border-b bg-slate-50/50 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-purple-100 p-2 rounded-lg"><Truck className="w-5 h-5 text-purple-700" /></div>
              <div>
                <DrawerTitle className="text-lg font-bold">MDF-e Nº {mdfe.numero || "Nao gerado"}</DrawerTitle>
                <DrawerDescription className="text-xs font-mono mt-1 text-slate-500">{mdfe.chave_acesso || "Chave de acesso pendente"}</DrawerDescription>
              </div>
            </div>
            <div>{getStatusBadge(mdfe.status)}</div>
          </div>
        </DrawerHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-4 border-b">
            <TabsList className="grid w-full grid-cols-5 bg-slate-100/50">
              <TabsTrigger value="resumo" className="text-xs">Resumo</TabsTrigger>
              <TabsTrigger value="fiscal" className="text-xs">Fiscal</TabsTrigger>
              <TabsTrigger value="timeline" className="text-xs">Timeline</TabsTrigger>
              <TabsTrigger value="xml" className="text-xs">XML</TabsTrigger>
              <TabsTrigger value="logs" className="text-xs">Logs</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 p-6">
            {/* RESUMO */}
            <TabsContent value="resumo" className="mt-0 space-y-6">
              {mdfe.motivo_rejeicao && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 flex gap-3 items-start">
                  <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div><h4 className="text-sm font-semibold text-red-800">Motivo da Rejeicao</h4><p className="text-sm text-red-700 mt-1">{mdfe.motivo_rejeicao}</p></div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                <div><h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</h4><div className="font-medium">{getStatusBadge(mdfe.status)}</div></div>
                <div><h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Data de Emissao</h4><div className="text-sm font-medium text-slate-800">{mdfe.data_emissao ? new Date(mdfe.data_emissao).toLocaleString() : "-"}</div></div>
                <div><h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Cliente</h4><div className="text-sm font-medium text-slate-800">{mdfe.clientes?.nome_fantasia || mdfe.clientes?.razao_social || "Nao vinculado"}</div></div>
                <div><h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">OS Vinculada</h4><div className="text-sm font-medium text-slate-800">{mdfe.ordens_servico?.numero || "Nenhuma OS"}</div></div>
                <div><h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Filial Responsavel</h4><div className="text-sm font-medium text-slate-800">{mdfe.filiais?.nome || "-"}</div></div>
                <div><h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Protocolo SEFAZ</h4><div className="text-sm font-mono text-slate-800 break-all">{mdfe.protocolo || "-"}</div></div>
                <div><h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">UF Origem / Destino</h4><div className="text-sm font-medium text-slate-800 flex items-center gap-2">{ufInicio} <span className="text-slate-400 text-xs">→</span> {ufFim}</div></div>
                <div><h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Valor da Carga</h4><div className="text-sm font-medium text-slate-800">{fmtFin(mdfe.valor)}</div></div>
                <div><h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Veiculo (Placa)</h4><div className="text-sm font-medium text-slate-800">{metadata.veiculo?.placa || "-"}</div></div>
                <div><h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Motorista</h4><div className="text-sm font-medium text-slate-800">{metadata.motorista?.nome || "-"}</div></div>
              </div>
            </TabsContent>

            {/* FISCAL */}
            <TabsContent value="fiscal" className="mt-0 space-y-4">
              <div className={"p-4 rounded-lg border-2 " + (temErros ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200")}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className={"w-5 h-5 " + (temErros ? "text-red-600" : "text-green-600")} />
                    <span className="font-semibold text-sm">STATUS FISCAL</span>
                  </div>
                  <Badge className={temErros ? "bg-red-100 text-red-700 border-red-200" : "bg-green-100 text-green-700 border-green-200"}>
                    {temErros ? "COM PENDENCIA" : "PRONTO INTERNO"}
                  </Badge>
                </div>
              </div>

              <div className="border rounded-lg">
                <div className="p-4 border-b bg-red-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2"><XCircle className="w-4 h-4 text-red-600" /><span className="font-semibold text-sm text-red-800">PENDENCIAS CRITICAS</span></div>
                  <Badge className="bg-red-100 text-red-700 border-red-200">{erros.length}</Badge>
                </div>
                <div className="p-4">
                  {erros.length === 0 ? <p className="text-sm text-muted-foreground text-center py-2">Nenhuma pendencia critica.</p> : (
                    <div className="space-y-2">{erros.map(function(e: any, i: number) { return <div key={i} className="flex items-start gap-2 text-sm"><span className="text-red-500 mt-0.5 shrink-0">X</span><span className="text-red-700">{e.mensagem}</span></div>; })}</div>
                  )}
                </div>
              </div>

              <div className="border rounded-lg">
                <div className="p-4 border-b bg-amber-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /><span className="font-semibold text-sm text-amber-800">AVISOS</span></div>
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200">{avisos.length}</Badge>
                </div>
                <div className="p-4">
                  {avisos.length === 0 ? <p className="text-sm text-muted-foreground text-center py-2">Nenhum aviso.</p> : (
                    <div className="space-y-2">{avisos.map(function(a: any, i: number) { return <div key={i} className="flex items-start gap-2 text-sm"><span className="text-amber-500 mt-0.5 shrink-0">!</span><span className="text-amber-700">{a.mensagem}</span></div>; })}</div>
                  )}
                </div>
              </div>

              <div className="border rounded-lg p-4 bg-slate-50">
                <h4 className="font-semibold text-sm mb-3">Resumo Fiscal</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">MDF-e</span><span className="font-mono">{mdfe.numero || "S/N"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Emitente</span><span className="font-medium truncate ml-2">{metadata.emitente?.nome || "-"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Motorista</span><span>{metadata.motorista?.nome || "-"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Veiculo</span><span>{metadata.veiculo?.placa || "-"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">CT-es vinculados</span><span className="font-semibold">{ctesVinc.length}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">UF Inicio / Fim</span><span>{ufInicio} → {ufFim}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Valor Total</span><span className="font-semibold">{fmtFin(mdfe.valor)}</span></div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between"><span className="text-muted-foreground">Pronto para emissao?</span><span className={"font-semibold " + (temErros ? "text-red-600" : "text-green-600")}>{temErros ? "NAO" : "SIM"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Erros</span><span className="font-semibold text-red-600">{erros.length}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Avisos</span><span className="font-semibold text-amber-600">{avisos.length}</span></div>
                  </div>
                </div>
              </div>

              {/* CICLO DE VIDA INTERNO */}
              <div className="border rounded-lg">
                <div className="p-4 border-b bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2"><GitBranch className="w-4 h-4 text-slate-600" /><span className="font-semibold text-sm text-slate-800">CICLO DE VIDA INTERNO</span></div>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">{mdfe.status}</Badge>
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" className="text-xs" onClick={function(){openSimulacao("encerrar");}}><CheckCircle2 className="w-3 h-3 mr-1" />Simular Encerramento</Button>
                    <Button variant="outline" size="sm" className="text-xs" onClick={function(){openSimulacao("cancelar");}}><XCircle className="w-3 h-3 mr-1" />Simular Cancelamento</Button>
                    <Button variant="outline" size="sm" className="text-xs" onClick={function(){openSimulacao("rejeitar");}}><AlertTriangle className="w-3 h-3 mr-1" />Simular Rejeicao</Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">Estas acoes sao simulacoes internas. Nao comunicam com SEFAZ ou Focus.</p>
                  {historico.length > 0 && <div className="mt-2 pt-2 border-t"><span className="text-xs font-semibold text-muted-foreground">Historico</span><div className="space-y-1 mt-1">{historico.slice(0,3).map(function(h:any,i:number){return <div key={i} className="text-[10px] flex items-center gap-1"><span className="text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span><span className="font-mono">{h.status_anterior}→{h.status_novo}</span><span className="text-muted-foreground truncate">— {h.motivo?.substring(0,30)}</span></div>;})}</div></div>}
                </div>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-full inline-block">
                    <Button className="w-full" disabled={temErros} variant={temErros ? "outline" : "default"} onClick={pronto && !temErros ? handlePreEmissao : undefined}>
                      <Truck className="w-4 h-4 mr-2" /> Pre-emissao MDF-e
                    </Button>
                  </span>
                </TooltipTrigger>
                {temErros && <TooltipContent side="top" className="max-w-[250px] text-center"><p>Corrija as pendencias fiscais antes da emissao.</p></TooltipContent>}
              </Tooltip>

              <Dialog open={showPreEmissao} onOpenChange={setShowPreEmissao}>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Send className="w-5 h-5 text-primary" />Pre-emissao MDF-e</DialogTitle>
                    <DialogDescription>Dados internos prontos para emissao fiscal</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-medium text-green-800">Status: Dados internos prontos</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-xs text-muted-foreground">Emitente</span><p className="font-medium truncate">{metadata.emitente?.nome || "-"}</p></div>
                      <div><span className="text-xs text-muted-foreground">Motorista</span><p className="font-medium">{metadata.motorista?.nome || "-"}</p></div>
                      <div><span className="text-xs text-muted-foreground">Veiculo</span><p className="font-medium">{metadata.veiculo?.placa || "-"}</p></div>
                      <div><span className="text-xs text-muted-foreground">CT-es Vinculados</span><p className="font-medium">{ctesVinc.length} documento(s)</p></div>
                      <div><span className="text-xs text-muted-foreground">UF Inicio / Fim</span><p className="font-medium">{ufInicio} → {ufFim}</p></div>
                      <div><span className="text-xs text-muted-foreground">Valor Total</span><p className="font-medium">{fmtFin(mdfe.valor)}</p></div>
                      <div><span className="text-xs text-muted-foreground">Pendencias</span><Badge className="bg-green-100 text-green-700 border-green-200">0</Badge></div>
                    </div>
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-amber-800">Este MDF-e esta pronto em dados internos, mas a emissao real ainda depende da configuracao Focus NFe, token, certificado digital A1 e ambiente fiscal.</p>
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="flex gap-2">
                    <Button variant="outline" onClick={function() { setShowPreEmissao(false); }}>Fechar</Button>
                    <Button onClick={function() { setShowPreEmissao(false); }}>Entendi, emissao ainda nao disponivel</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Modal Simulacao */}
              <Dialog open={showSimulacao} onOpenChange={setShowSimulacao}>
                <DialogContent className="max-w-sm">
                  <DialogHeader><DialogTitle>Simular {simulacaoAcao==="cancelar"?"Cancelamento":simulacaoAcao==="encerrar"?"Encerramento":"Rejeicao"} — MDF-e</DialogTitle><DialogDescription>Esta acao e uma simulacao interna.</DialogDescription></DialogHeader>
                  <div className="space-y-3 py-2"><div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">Nao comunica com SEFAZ ou Focus NFe.</div><div><Label>Motivo *</Label><Input value={motivoSimulacao} onChange={function(e){setMotivoSimulacao(e.target.value);}} placeholder="Teste de homologacao..." /></div></div>
                  <DialogFooter><Button variant="outline" onClick={function(){setShowSimulacao(false);}}>Cancelar</Button><Button variant="destructive" onClick={handleSimular} disabled={!motivoSimulacao.trim()}>Confirmar Simulacao</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* TIMELINE */}
            <TabsContent value="timeline" className="mt-0"><MdfeTimeline mdfeId={mdfe.id} /></TabsContent>

            {/* XML */}
            <TabsContent value="xml" className="mt-0 h-full">
              {mdfe.xml_url ? (
                <div className="flex flex-col items-center justify-center p-8 bg-slate-50 border border-slate-200 rounded-lg text-center h-full">
                  <div className="bg-green-100 p-4 rounded-full mb-4"><CheckCircle2 className="w-8 h-8 text-green-600" /></div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">XML Autorizado</h3>
                  <p className="text-sm text-slate-600 mb-6 max-w-sm">O arquivo XML deste manifesto eletronico foi gerado e autorizado com sucesso.</p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button className="bg-orange-600 hover:bg-orange-700 text-white shadow-sm" onClick={function() { window.open(mdfe.xml_url, "_blank"); }}><Code className="w-4 h-4 mr-2" />Download XML</Button>
                    {mdfe.pdf_url && <Button variant="outline" onClick={function() { window.open(mdfe.pdf_url, "_blank"); }}><FileText className="w-4 h-4 mr-2" />Imprimir DAMDFE</Button>}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground bg-slate-50 rounded-lg border border-dashed border-slate-200 mt-4 h-full">
                  <div className="bg-slate-100 p-4 rounded-full mb-4"><SearchX className="w-8 h-8 text-slate-400" /></div>
                  <p className="text-sm font-medium text-slate-600">XML Indisponivel</p>
                  <p className="text-xs mt-1 text-slate-500 text-center max-w-[250px]">O arquivo XML ainda nao foi gerado ou o MDF-e nao foi autorizado.</p>
                </div>
              )}
            </TabsContent>

            {/* LOGS */}
            <TabsContent value="logs" className="mt-0">
              {loadingLogs ? (
                <div className="flex flex-col items-center justify-center p-8 text-muted-foreground"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-4"></div><p className="text-sm">Buscando logs de integracao...</p></div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-muted-foreground bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  <div className="bg-slate-100 p-3 rounded-full mb-3"><History className="w-6 h-6 text-slate-400" /></div>
                  <p className="text-sm font-medium text-slate-600">Nenhum log tecnico encontrado.</p>
                  <p className="text-xs mt-1 text-slate-500">Comunicacoes com APIs (Focus NFe) serao listadas aqui.</p>
                </div>
              ) : (
                <div className="space-y-3">{logs.map(function(log) { return (
                  <div key={log.id} className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-slate-300 font-mono text-[11px] overflow-hidden">
                    <div className="flex justify-between items-center border-b border-slate-700 pb-2 mb-2">
                      <span className="text-purple-400 font-bold">[{log.level || "INFO"}] {log.acao}</span>
                      <span className="text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    <div className="break-all whitespace-pre-wrap text-slate-400 max-h-40 overflow-y-auto">{JSON.stringify(log.request || log.response || {})}</div>
                  </div>
                );})}</div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DrawerFooter className="border-t pt-4 pb-6 bg-slate-50">
          <DrawerClose asChild><Button variant="outline" className="w-full">Fechar Painel</Button></DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
