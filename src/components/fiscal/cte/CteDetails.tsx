import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileSpreadsheet, Download, Terminal, Info, History, AlertTriangle, ShieldAlert, XCircle, Send, CheckCircle2, Eye, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import CteTimeline from "./CteTimeline";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { alterarStatusFiscalInterno, listarHistoricoStatus } from "@/services/fiscal/fiscalStatusService";

interface CteDetailsProps {
  cte: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: string;
}

const fmtFin = (v: number) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";

export default function CteDetails({ cte, open, onOpenChange, defaultTab = "resumo" }: CteDetailsProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [showPreEmissao, setShowPreEmissao] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showSimulacao, setShowSimulacao] = useState(false);
  const [simulacaoAcao, setSimulacaoAcao] = useState("");
  const [motivoSimulacao, setMotivoSimulacao] = useState("");
  const [historico, setHistorico] = useState<any[]>([]);

  useEffect(() => {
    if (open && cte?.id) {
      fetchLogs();
    } else {
      setLogs([]);
    }
  }, [open, cte]);

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const { data, error } = await supabase
        .from("fiscal_logs")
        .select("*")
        .eq("entidade_tipo", "CTE")
        .eq("entidade_id", cte.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error("Erro ao buscar logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handlePreEmissao = async () => {
    setShowPreEmissao(true);
    try {
      await supabase.from("fiscal_logs").insert([{
        entidade_tipo: "CTE",
        entidade_id: cte.id,
        acao: "PRE_EMISSAO_VISUALIZADA",
        request: { cte_id: cte.id },
        response: { status: "dados_internos_prontos" },
      }]);
    } catch { /* log opcional, nao bloqueia */ }
  };

  const fetchHistorico = async function() {
    if (!cte?.id) return;
    const data = await listarHistoricoStatus("CTE", cte.id);
    setHistorico(data);
  };

  const openSimulacao = function(acao: string) {
    setSimulacaoAcao(acao);
    setMotivoSimulacao("");
    setShowSimulacao(true);
  };

  const handleSimular = async function() {
    if (!motivoSimulacao.trim()) { toast.error("Informe o motivo da simulacao."); return; }
    const statusNovo = simulacaoAcao === "cancelar" ? "cancelado_simulado" : "rejeitado_simulado";
    const result = await alterarStatusFiscalInterno({
      documentoTipo: "CTE", documentoId: cte.id, statusNovo, motivo: motivoSimulacao,
    });
    if (result.success) { toast.success("Simulacao concluida: " + simulacaoAcao); setShowSimulacao(false); fetchHistorico(); }
    else toast.error("Erro: " + (result.error||""));
  };

  if (!cte) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[90vw] sm:max-w-[600px] flex flex-col p-0">
        <SheetHeader className="p-6 border-b bg-muted/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <SheetTitle className="text-xl">CT-e {cte.numero || "S/N"}</SheetTitle>
              <SheetDescription className="font-mono text-xs mt-1">
                {cte.chave_acesso || "Chave não gerada"}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue={defaultTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-4 border-b">
            <TabsList className="w-full justify-start rounded-none border-b-0 bg-transparent p-0 gap-6">
              <TabsTrigger value="resumo" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 shadow-none">
                <Info className="w-4 h-4 mr-2" /> Resumo
              </TabsTrigger>
              <TabsTrigger value="timeline" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 shadow-none">
                <History className="w-4 h-4 mr-2" /> Timeline
              </TabsTrigger>
              <TabsTrigger value="xml" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 shadow-none">
                <FileSpreadsheet className="w-4 h-4 mr-2" /> XML / DACTE
              </TabsTrigger>
              <TabsTrigger value="fiscal" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 shadow-none">
                <ShieldAlert className="w-4 h-4 mr-2" /> Fiscal
              </TabsTrigger>
              <TabsTrigger value="logs" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 shadow-none">
                <Terminal className="w-4 h-4 mr-2" /> Logs
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 p-6">
            {/* Aba Resumo */}
            <TabsContent value="resumo" className="m-0 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Status Atual</span>
                  <div>
                    <Badge variant="outline" className="font-medium bg-slate-50">{cte.status || "Rascunho"}</Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Data de Emissão</span>
                  <div className="text-sm font-medium">
                    {cte.data_emissao ? new Date(cte.data_emissao).toLocaleString() : "-"}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Valor Total</span>
                  <div className="text-sm font-medium">{fmtFin(cte.valor)}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Protocolo</span>
                  <div className="text-sm font-mono">{cte.protocolo || "-"}</div>
                </div>
                <div className="col-span-2 space-y-1">
                  <span className="text-xs text-muted-foreground">Cliente (Tomador)</span>
                  <div className="text-sm font-medium">
                    {cte.clientes?.nome_fantasia || cte.clientes?.razao_social || "Não vinculado"}
                  </div>
                </div>
                <div className="col-span-2 space-y-1">
                  <span className="text-xs text-muted-foreground">Ordem de Serviço</span>
                  <div className="text-sm font-medium">
                    {cte.ordens_servico?.numero || "Nenhuma OS vinculada"}
                  </div>
                </div>
                {cte.motivo_rejeicao && (
                  <div className="col-span-2 space-y-1 mt-2 p-3 bg-red-50 border border-red-100 rounded-md">
                    <span className="text-xs font-semibold text-red-700">Motivo da Rejeição / Cancelamento</span>
                    <div className="text-sm text-red-600">{cte.motivo_rejeicao}</div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Aba Timeline */}
            <TabsContent value="timeline" className="m-0">
              <CteTimeline cteId={cte.id} />
            </TabsContent>

            {/* Aba XML */}
            <TabsContent value="xml" className="m-0 space-y-4">
              {cte.xml_url || cte.pdf_url ? (
                <div className="flex flex-col gap-3">
                  {cte.xml_url && (
                    <Button variant="outline" className="justify-start h-12">
                      <Download className="w-4 h-4 mr-3 text-orange-500" />
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium">Download XML Autorizado</span>
                        <span className="text-xs text-muted-foreground font-mono truncate max-w-[300px]">{cte.xml_url}</span>
                      </div>
                    </Button>
                  )}
                  {cte.pdf_url && (
                    <Button variant="outline" className="justify-start h-12">
                      <Download className="w-4 h-4 mr-3 text-red-500" />
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium">Download DACTE (PDF)</span>
                        <span className="text-xs text-muted-foreground font-mono truncate max-w-[300px]">{cte.pdf_url}</span>
                      </div>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg text-muted-foreground">
                  <FileSpreadsheet className="w-10 h-10 mb-2 opacity-20" />
                  <p className="text-sm font-medium">Arquivos não disponíveis</p>
                  <p className="text-xs text-center mt-1 max-w-[250px]">O XML e o DACTE estarão disponíveis aqui após a autorização do documento na Sefaz.</p>
                </div>
              )}
            </TabsContent>

            {/* Aba Fiscal */}
            <TabsContent value="fiscal" className="m-0 space-y-4">
              {(() => {
                const validacoes: any[] = Array.isArray(cte?.metadata?.validacoes_pendentes)
                  ? cte.metadata.validacoes_pendentes
                  : [];
                const pronto = cte?.metadata?.pronto_para_emissao;
                const erros = validacoes.filter((v: any) => v.severidade === "erro");
                const avisos = validacoes.filter((v: any) => v.severidade === "aviso");
                const temErros = erros.length > 0;

                return (
                  <>
                    {/* Card STATUS FISCAL */}
                    <div className={`p-4 rounded-lg border-2 ${temErros ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className={`w-5 h-5 ${temErros ? "text-red-600" : "text-green-600"}`} />
                          <span className="font-semibold text-sm">STATUS FISCAL</span>
                        </div>
                        <Badge className={temErros ? "bg-red-100 text-red-700 border-red-200" : "bg-green-100 text-green-700 border-green-200"}>
                          {temErros ? "COM PENDENCIA" : "PRONTO INTERNO"}
                        </Badge>
                      </div>
                    </div>

                    {/* PENDÊNCIAS CRÍTICAS */}
                    <div className="border rounded-lg">
                      <div className="p-4 border-b bg-red-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span className="font-semibold text-sm text-red-800">PENDÊNCIAS CRÍTICAS</span>
                        </div>
                        <Badge className="bg-red-100 text-red-700 border-red-200">{erros.length}</Badge>
                      </div>
                      <div className="p-4">
                        {erros.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-2">Nenhuma pendência crítica.</p>
                        ) : (
                          <div className="space-y-2">
                            {erros.map((e: any, i: number) => (
                              <div key={i} className="flex items-start gap-2 text-sm">
                                <span className="text-red-500 mt-0.5 shrink-0">❌</span>
                                <span className="text-red-700">{e.mensagem}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AVISOS */}
                    <div className="border rounded-lg">
                      <div className="p-4 border-b bg-amber-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <span className="font-semibold text-sm text-amber-800">AVISOS</span>
                        </div>
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200">{avisos.length}</Badge>
                      </div>
                      <div className="p-4">
                        {avisos.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-2">Nenhum aviso.</p>
                        ) : (
                          <div className="space-y-2">
                            {avisos.map((a: any, i: number) => (
                              <div key={i} className="flex items-start gap-2 text-sm">
                                <span className="text-amber-500 mt-0.5 shrink-0">⚠</span>
                                <span className="text-amber-700">{a.mensagem}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* CICLO DE VIDA INTERNO */}
                    <div className="border rounded-lg">
                      <div className="p-4 border-b bg-slate-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-2"><GitBranch className="w-4 h-4 text-slate-600" /><span className="font-semibold text-sm text-slate-800">CICLO DE VIDA INTERNO</span></div>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">{cte.status}</Badge>
                      </div>
                      <div className="p-3 space-y-2">
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="text-xs" onClick={function(){openSimulacao("cancelar");}}><XCircle className="w-3 h-3 mr-1" />Simular Cancelamento</Button>
                          <Button variant="outline" size="sm" className="text-xs" onClick={function(){openSimulacao("rejeitar");}}><AlertTriangle className="w-3 h-3 mr-1" />Simular Rejeicao</Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">Estas acoes sao simulacoes internas. Nao comunicam com SEFAZ ou Focus.</p>
                        {historico.length > 0 && (
                          <div className="mt-2 pt-2 border-t">
                            <span className="text-xs font-semibold text-muted-foreground">Historico</span>
                            <div className="space-y-1 mt-1">
                              {historico.slice(0,3).map(function(h:any,i:number){return <div key={i} className="text-[10px] flex items-center gap-1"><span className="text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span><span className="font-mono">{h.status_anterior}→{h.status_novo}</span><span className="text-muted-foreground truncate">— {h.motivo?.substring(0,30)}</span></div>;})}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* RESUMO FISCAL */}
                    <div className="border rounded-lg p-4 bg-slate-50">
                      <h4 className="font-semibold text-sm mb-3">Resumo Fiscal</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">CT-e</span>
                          <span className="font-mono">{cte?.numero || "S/N"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Pronto para emissão?</span>
                          <span className={`font-semibold ${temErros ? "text-red-600" : "text-green-600"}`}>
                            {temErros ? "NÃO" : "SIM"}
                          </span>
                        </div>
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Erros</span>
                            <span className="font-semibold text-red-600">{erros.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Avisos</span>
                            <span className="font-semibold text-amber-600">{avisos.length}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* BOTÃO EMITIR CT-e */}
                    <div className="flex gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex-1 inline-block">
                          <Button
                            className="w-full"
                            disabled={temErros}
                            variant={temErros ? "outline" : "default"}
                            onClick={pronto && !temErros ? handlePreEmissao : undefined}
                          >
                            <FileSpreadsheet className="w-4 h-4 mr-2" />
                            Pre-emissao CT-e
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {temErros && (
                        <TooltipContent side="top" className="max-w-[250px] text-center">
                          <p>Corrija as pendências fiscais antes da emissão.</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                      <Button variant="outline" size="icon" className="h-10 w-10 flex-shrink-0" onClick={function(){setShowPreview(true);}} title="Visualizar Previa"><Eye className="w-4 h-4" /></Button>
                    </div>

                    {/* Modal Pré-Emissão */}
                    <Dialog open={showPreEmissao} onOpenChange={setShowPreEmissao}>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Send className="w-5 h-5 text-primary" />
                            Pre-emissao CT-e
                          </DialogTitle>
                          <DialogDescription>
                            Dados internos prontos para emissao fiscal
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 py-2">
                          <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                            <span className="text-sm font-medium text-green-800">Status: Dados internos prontos</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {(() => {
                              const pf = cte?.metadata?.payload_focus || {};
                              return (
                                <>
                                  <div>
                                    <span className="text-xs text-muted-foreground">Emitente</span>
                                    <p className="font-medium truncate">{pf.emitente?.nome || "-"}</p>
                                    <p className="text-xs text-muted-foreground">{pf.emitente?.cnpj || ""}</p>
                                  </div>
                                  <div>
                                    <span className="text-xs text-muted-foreground">Tomador</span>
                                    <p className="font-medium truncate">{pf.tomador?.nome || "-"}</p>
                                    <p className="text-xs text-muted-foreground">{pf.tomador?.cnpj || ""}</p>
                                  </div>
                                  <div>
                                    <span className="text-xs text-muted-foreground">OS Vinculada</span>
                                    <p className="font-medium">{cte?.ordens_servico?.numero || "S/N"}</p>
                                  </div>
                                  <div>
                                    <span className="text-xs text-muted-foreground">NF-e Vinculada</span>
                                    <p className="font-medium">{pf.documentos_vinculados?.length || 0} documento(s)</p>
                                  </div>
                                  <div>
                                    <span className="text-xs text-muted-foreground">CFOP</span>
                                    <p className="font-medium font-mono">{pf.fiscal?.cfop || pf.carga?.cfop || "-"}</p>
                                  </div>
                                  <div>
                                    <span className="text-xs text-muted-foreground">Natureza Operacao</span>
                                    <p className="font-medium text-xs">{pf.fiscal?.natureza_operacao || pf.carga?.natureza_operacao || "-"}</p>
                                  </div>
                                  <div>
                                    <span className="text-xs text-muted-foreground">Origem</span>
                                    <p className="font-medium">{pf.origem?.cidade || "-"}/{pf.origem?.uf || "-"}</p>
                                  </div>
                                  <div>
                                    <span className="text-xs text-muted-foreground">Destino</span>
                                    <p className="font-medium">{pf.destino?.cidade || "-"}/{pf.destino?.uf || "-"}</p>
                                  </div>
                                  <div>
                                    <span className="text-xs text-muted-foreground">Valor</span>
                                    <p className="font-medium">{fmtFin(pf.valores?.valor_total)}</p>
                                  </div>
                                  <div>
                                    <span className="text-xs text-muted-foreground">Pendencias</span>
                                    <Badge className="bg-green-100 text-green-700 border-green-200">0</Badge>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Ambiente Fiscal</span>
                            <p className="font-medium">Homologacao</p>
                          </div>
                          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-amber-800">
                                Este CT-e esta pronto em dados internos, mas a emissao real ainda depende da configuracao Focus NFe, token, certificado digital A1 e ambiente fiscal.
                              </p>
                            </div>
                          </div>
                        </div>
                        <DialogFooter className="flex gap-2">
                          <Button variant="outline" onClick={function() { setShowPreEmissao(false); }}>
                            Fechar
                          </Button>
                          <Button onClick={function() { setShowPreEmissao(false); }}>
                            Entendi, emissao ainda nao disponivel
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* Modal Prévia */}
                    <Dialog open={showPreview} onOpenChange={setShowPreview}>
                      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                        <DialogHeader><DialogTitle className="flex items-center gap-2"><Eye className="w-5 h-5 text-primary" />Previa — CT-e {cte.numero||"S/N"}</DialogTitle></DialogHeader>
                        <div className="space-y-3 py-2">
                          <div className="p-2 bg-slate-100 border border-slate-300 rounded text-center"><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">DOCUMENTO INTERNO DE HOMOLOGACAO</span></div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {(() => { const pf = cte?.metadata?.payload_focus || {}; return (<>
                            <div><span className="text-xs text-muted-foreground">Emitente</span><p className="font-medium">{pf.emitente?.nome||"-"}</p></div>
                            <div><span className="text-xs text-muted-foreground">Tomador</span><p className="font-medium">{pf.tomador?.nome||"-"}</p></div>
                            <div><span className="text-xs text-muted-foreground">Valor</span><p className="font-medium">{fmtFin(cte.valor)}</p></div>
                            <div><span className="text-xs text-muted-foreground">Status</span><p><Badge className={temErros?"bg-amber-100 text-amber-700":"bg-green-100 text-green-700"}>{temErros?"COM PENDENCIA":"PRONTO INTERNO"}</Badge></p></div>
                            {pf.origem?.cidade && <div><span className="text-xs text-muted-foreground">Origem</span><p>{pf.origem.cidade}/{pf.origem.uf}</p></div>}
                            {pf.destino?.cidade && <div><span className="text-xs text-muted-foreground">Destino</span><p>{pf.destino.cidade}/{pf.destino.uf}</p></div>}
                            {pf.carga?.descricao && <div><span className="text-xs text-muted-foreground">Carga</span><p className="text-xs">{pf.carga.descricao}</p></div>}
                            {pf.fiscal?.cfop && <div><span className="text-xs text-muted-foreground">CFOP</span><p className="font-mono">{pf.fiscal.cfop||pf.carga?.cfop||"-"}</p></div>}
                            {pf.motorista?.nome && <div><span className="text-xs text-muted-foreground">Motorista</span><p>{pf.motorista.nome}</p></div>}
                            {pf.veiculo?.placa && <div><span className="text-xs text-muted-foreground">Veiculo</span><p>{pf.veiculo.placa}</p></div>}
                            <div className="col-span-2"><span className="text-xs text-muted-foreground">Chave</span><p className="text-[10px] font-mono text-muted-foreground">{cte.chave_acesso||"Aguardando integracao fiscal"}</p></div>
                          </> )})()}
                          </div>
                        </div>
                        <DialogFooter><Button variant="outline" onClick={function(){setShowPreview(false);}}>Fechar</Button></DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* Modal Simulacao */}
                    <Dialog open={showSimulacao} onOpenChange={setShowSimulacao}>
                      <DialogContent className="max-w-sm">
                        <DialogHeader><DialogTitle>Simular {simulacaoAcao==="cancelar"?"Cancelamento":"Rejeicao"} — CT-e</DialogTitle><DialogDescription>Esta acao e uma simulacao interna.</DialogDescription></DialogHeader>
                        <div className="space-y-3 py-2">
                          <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">Nao comunica com SEFAZ, prefeitura ou Focus NFe.</div>
                          <div><Label>Motivo *</Label><Input value={motivoSimulacao} onChange={function(e){setMotivoSimulacao(e.target.value);}} placeholder="Teste de homologacao..." /></div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={function(){setShowSimulacao(false);}}>Cancelar</Button>
                          <Button variant="destructive" onClick={handleSimular} disabled={!motivoSimulacao.trim()}>Confirmar Simulacao</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </>
                );
              })()}
            </TabsContent>

            {/* Aba Logs */}
            <TabsContent value="logs" className="m-0 space-y-4">
              {loadingLogs ? (
                <div className="text-sm text-center text-muted-foreground p-4">Buscando logs de integração...</div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                  <Terminal className="w-10 h-10 mb-2 opacity-20" />
                  <p className="text-sm font-medium">Nenhum log técnico encontrado</p>
                  <p className="text-xs mt-1">Requisições via Focus NFe aparecerão aqui.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="bg-slate-950 text-slate-300 p-3 rounded-md text-xs font-mono overflow-hidden">
                      <div className="flex justify-between items-center mb-2 border-b border-slate-800 pb-2">
                        <span className={`font-semibold ${log.status_code >= 400 ? 'text-red-400' : 'text-green-400'}`}>
                          [{log.status_code || "INFO"}] {log.acao}
                        </span>
                        <span className="text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <div className="space-y-1">
                        {log.request && <div><span className="text-slate-500">REQ:</span> {JSON.stringify(log.request)}</div>}
                        {log.response && <div className="text-slate-400"><span className="text-slate-500">RES:</span> {JSON.stringify(log.response)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
