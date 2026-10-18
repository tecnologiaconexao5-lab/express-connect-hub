import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileSpreadsheet, Download, Terminal, Info, History, AlertTriangle, ShieldAlert, XCircle, Send, CheckCircle2, Eye, GitBranch, Loader2, RefreshCw, MapPin, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import CteTimeline from "./CteTimeline";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { abrirPreviaCte } from "@/utils/pdfPreviaCteSemValorFiscal";
import { alterarStatusFiscalInterno, listarHistoricoStatus } from "@/services/fiscal/fiscalStatusService";
import { enviarCteParaFocus, consultarStatusCteFocus, baixarDocumentosCteFocus, gerarUrlDocumentoFiscalCte, enviarCteParaFocusProducao } from "@/services/fiscal/focusService";

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
  const [enviandoFocus, setEnviandoFocus] = useState(false);
  const [focusResult, setFocusResult] = useState<any>(null);
  const [showFocusResult, setShowFocusResult] = useState(false);
  const [consultandoFocus, setConsultandoFocus] = useState(false);
  const [baixandoDocs, setBaixandoDocs] = useState(false);
  const [showProducaoModal, setShowProducaoModal] = useState(false);
  const [confirmacaoProducao, setConfirmacaoProducao] = useState("");
  const [enviandoProducao, setEnviandoProducao] = useState(false);

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

  const handleEnviarFocus = async function() {
    if (!cte?.id) return;
    setEnviandoFocus(true);
    setFocusResult(null);

    try {
      const res = await enviarCteParaFocus(cte.id);
      setFocusResult(res);
      setShowFocusResult(true);

      if (res.ok) {
        toast.success(res.mensagem || "CT-e enviado para Focus com sucesso!");
        fetchLogs();
      } else {
        toast.error(res.erro || res.motivo || "Erro ao enviar para Focus.");
      }
    } catch (err: any) {
      toast.error("Erro inesperado: " + err.message);
    } finally {
      setEnviandoFocus(false);
    }
  };

  const podeEnviarFocus = function() {
    if (!cte) return false;
    if (cte.status !== "rascunho") return false;
    const meta = cte.metadata || {};
    if (!meta.pronto_para_emissao) return false;
    if (meta.pendente_conferencia_endereco === true) return false;
    if (!meta.payload_focus) return false;
    const docs = meta.payload_focus?.documentos_vinculados || [];
    if (docs.length === 0) return false;
    return true;
  };

  const podeConsultarFocus = function() {
    if (!cte) return false;
    const statusConsulta = ["processando", "rejeitado", "erro_emissao"];
    if (!statusConsulta.includes(cte.status)) return false;
    const meta = cte.metadata || {};
    if (!meta.focus_response) return false;
    return true;
  };

  const handleConsultarFocus = async function() {
    if (!cte?.id) return;
    setConsultandoFocus(true);
    setFocusResult(null);

    try {
      const res = await consultarStatusCteFocus(cte.id);
      setFocusResult(res);
      setShowFocusResult(true);

      if (res.ok) {
        if (res.autorizado) {
          toast.success("CT-e autorizado na Focus!");
        } else if (res.rejeitado) {
          toast.warning("CT-e rejeitado pela SEFAZ. Verifique o motivo.");
        } else {
          toast.info(res.mensagem || "Consulta realizada.");
        }
        fetchLogs();
      } else {
        toast.error(res.erro || "Erro ao consultar Focus.");
      }
    } catch (err: any) {
      toast.error("Erro inesperado: " + err.message);
    } finally {
      setConsultandoFocus(false);
    }
  };

  const handleBaixarDocumentos = async function(docs: ("xml" | "dacte")[] = ["xml", "dacte"]) {
    if (!cte?.id) return;
    setBaixandoDocs(true);
    setFocusResult(null);

    try {
      toast.info("Baixando documentos fiscais...");
      const res = await baixarDocumentosCteFocus(cte.id, docs);
      setFocusResult(res);
      setShowFocusResult(true);

      if (res.ok && res.resultados) {
        const xmlOk = res.resultados.xml?.salvo;
        const dacteOk = res.resultados.dacte?.salvo;
        if (xmlOk && dacteOk) toast.success("XML e DACTE salvos no Storage!");
        else if (xmlOk) toast.success("XML salvo no Storage!");
        else if (dacteOk) toast.success("DACTE salvo no Storage!");
        else toast.warning(res.mensagem || "Nenhum documento foi salvo.");
        fetchLogs();
      } else {
        toast.error(res.erro || "Erro ao baixar documentos.");
      }
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setBaixandoDocs(false);
    }
  };

  const handleEnviarProducao = async function() {
    if (confirmacaoProducao !== "EMITIR PRODUCAO") {
      toast.error('Digite exatamente "EMITIR PRODUCAO" para confirmar.');
      return;
    }
    setEnviandoProducao(true);
    try {
      const res = await enviarCteParaFocusProducao(cte.id, confirmacaoProducao);
      setFocusResult(res);
      setShowFocusResult(true);
      if (res.ok) { toast.success("CT-e enviado para producao!"); fetchLogs(); }
      else { toast.error(res.erro || "Erro na emissao producao."); }
    } catch (e: any) { toast.error(e.message); }
    finally { setEnviandoProducao(false); setShowProducaoModal(false); setConfirmacaoProducao(""); }
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
              <TabsTrigger value="resumo" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent px-0 pb-2 shadow-none font-medium">
                <Info className="w-4 h-4 mr-2" /> Resumo
              </TabsTrigger>
              <TabsTrigger value="timeline" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent px-0 pb-2 shadow-none font-medium">
                <History className="w-4 h-4 mr-2" /> Timeline
              </TabsTrigger>
              <TabsTrigger value="xml" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent px-0 pb-2 shadow-none font-medium">
                <FileSpreadsheet className="w-4 h-4 mr-2" /> XML / DACTE
              </TabsTrigger>
              <TabsTrigger value="fiscal" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent px-0 pb-2 shadow-none font-medium">
                <ShieldAlert className="w-4 h-4 mr-2" /> Fiscal
              </TabsTrigger>
              <TabsTrigger value="logs" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent px-0 pb-2 shadow-none font-medium">
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

                {/* Origem operacional + Romaneio */}
                <div className="col-span-2 space-y-1">
                  <span className="text-xs text-muted-foreground">Origem Operacional</span>
                  <div className="text-sm font-medium flex items-center gap-2">
                    {cte.ordem_servico_id ? (
                      <Badge className="bg-green-50 text-green-700 text-xs">OS {cte.ordens_servico?.numero || cte.ordem_servico_id?.slice(0,8)}</Badge>
                    ) : (cte.metadata?.origem_cte === "romaneio_faturamento") ? (
                      <Badge className="bg-blue-50 text-blue-700 text-xs">Romaneio/Faturamento</Badge>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                    {cte.metadata?.romaneio_numero && (
                      <Badge variant="outline" className="text-[10px] font-mono">Romaneio {cte.metadata.romaneio_numero}</Badge>
                    )}
                  </div>
                </div>

                {/* Origem CT-e */}
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Origem (Municipio)</span>
                  <div className="text-sm font-medium flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {(() => {
                      const meta = cte.metadata || {};
                      const pf = meta.payload_focus || {};
                      const cidade = pf.origem?.cidade || meta.origem_municipio || (meta.origem_cte === "romaneio_faturamento" ? "GUARULHOS" : null);
                      const uf = pf.origem?.uf || meta.origem_uf || (meta.origem_cte === "romaneio_faturamento" ? "SP" : null);
                      return cidade ? `${cidade}${uf ? `/${uf}` : ""}` : "-";
                    })()}
                  </div>
                </div>

                {/* NF-e */}
                {cte.metadata?.nfe_numero && (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">NF-e</span>
                    <div className="text-sm font-medium font-mono">{cte.metadata.nfe_numero}</div>
                  </div>
                )} {!cte.metadata?.nfe_numero && (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">NF-e</span>
                    <div className="text-sm font-medium text-slate-400">-</div>
                  </div>
                )}

                {/* Destino */}
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Destino</span>
                  <div className="text-sm font-medium flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {cte.metadata?.payload_focus?.destino?.cidade || cte.metadata?.endereco_real_entrega_usado?.municipio || "-"}
                    {cte.metadata?.payload_focus?.destino?.uf ? `/${cte.metadata.payload_focus.destino.uf}` : ""}
                  </div>
                </div>

                <div className="col-span-2 space-y-1">
                  <span className="text-xs text-muted-foreground">Cliente / Tomador</span>
                  <div className="text-sm font-medium">
                    {(() => {
                      const meta = cte.metadata || {};
                      const nome = cte.clientes?.nome_fantasia || cte.clientes?.razao_social || meta.tomador_nome || meta.cliente_nome || meta.payload_focus?.tomador?.nome;
                      if (nome) return nome;
                      if (meta.origem_cte === "romaneio_faturamento" && meta.romaneio_numero) return "CALVO COML IMP. E EXP. LTDA.";
                      return "Nao vinculado";
                    })()}
                  </div>
                </div>

                {/* Observação */}
                {cte.metadata?.observacao_cte && (
                  <div className="col-span-2 space-y-1">
                    <span className="text-xs text-muted-foreground">Observação CT-e</span>
                    <div className="text-xs font-mono bg-slate-50 border rounded p-2 whitespace-pre-wrap">{cte.metadata.observacao_cte}</div>
                  </div>
                )}

                <div className="col-span-2 space-y-1">
                  <span className="text-xs text-muted-foreground">Ordem de Serviço</span>
                  <div className="text-sm font-medium">
                    {cte.ordens_servico?.numero || (cte.metadata?.operacao_tipo === "fixa_calvo" ? "Não obrigatória (operação fixa)" : "Nenhuma OS vinculada")}
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
              <CteTimeline cteId={cte.id} cteMetadata={cte.metadata} />
            </TabsContent>

            {/* Aba XML */}
            <TabsContent value="xml" className="m-0 space-y-4">
              {/* Rascunho nao autorizado */}
              {cte.status !== "Autorizado" && cte.status !== "autorizado" && cte.status !== "Encerrado" && (
                <div className="space-y-3">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                    <FileText className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-blue-700">CT-e em Rascunho</p>
                    <p className="text-xs text-blue-600 mt-1">
                      XML e DACTE do CT-e serao disponibilizados apos autorizacao pela SEFAZ/Focus.
                    </p>
                  </div>

                  {/* NF-e original vinculada */}
                  {cte.metadata?.nfe_numero && (
                    <div className="border rounded-lg">
                      <div className="p-3 border-b bg-emerald-50/50 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-600" />
                        <span className="font-semibold text-sm text-emerald-800">XML da NF-e original importado</span>
                      </div>
                      <div className="p-3 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">NF-e Numero:</span>
                          <span className="font-mono font-medium">{cte.metadata.nfe_numero || "-"}</span>
                        </div>
                        {cte.metadata.nfe_chave && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Chave:</span>
                            <span className="font-mono text-[10px] break-all max-w-[200px] truncate">{cte.metadata.nfe_chave}</span>
                          </div>
                        )}
                        {cte.metadata.nfe_serie && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Serie:</span>
                            <span className="font-mono">{cte.metadata.nfe_serie}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Lote:</span>
                          <span className="font-mono">{cte.metadata.romaneio_numero || "-"}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {!cte.metadata?.nfe_numero && (
                    <div className="p-3 bg-slate-50 border rounded-lg text-xs text-slate-500 text-center">
                      Nenhuma NF-e original vinculada a este CT-e.
                    </div>
                  )}

                  {cte.metadata?.payload_focus && (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => { toast.info("Gerando previa sem valor fiscal..."); abrirPreviaCte(cte); }}>
                      <Eye className="w-4 h-4 mr-2" />
                      Previa sem valor fiscal
                    </Button>
                  )}
                </div>
              )}

              {/* Autorizado */}
              {(cte.status === "Autorizado" || cte.status === "autorizado") && (
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-green-800">CT-e Autorizado — Documentos Disponiveis</span>
                  </div>

                  {cte.metadata?.documentos_storage?.xml?.salvo ? (
                    <Button variant="outline" className="justify-start h-12 w-full" onClick={async () => {
                      toast.info("Gerando link temporario...");
                      const res = await gerarUrlDocumentoFiscalCte(cte.id, "xml");
                      if (res.ok && res.signedUrl) {
                        window.open(res.signedUrl, "_blank");
                        toast.success(`Link gerado. Valido por ${(res.expiresIn || 600) / 60} minutos.`);
                      } else {
                        toast.error(res.erro || "Erro ao gerar link.");
                      }
                    }}>
                      <Download className="w-4 h-4 mr-3 text-green-500" />
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium">Abrir XML</span>
                        <span className="text-xs text-muted-foreground">Link temporario gerado sob demanda</span>
                      </div>
                    </Button>
                  ) : (
                    <Button variant="outline" className="justify-start h-12 w-full" onClick={() => handleBaixarDocumentos(["xml"])} disabled={baixandoDocs}>
                      {baixandoDocs ? <Loader2 className="w-4 h-4 mr-3 animate-spin" /> : <Download className="w-4 h-4 mr-3 text-orange-500" />}
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium">Baixar XML da Focus</span>
                        <span className="text-xs text-muted-foreground">Download e armazenamento no Storage</span>
                      </div>
                    </Button>
                  )}

                  {cte.metadata?.documentos_storage?.dacte?.salvo ? (
                    <Button variant="outline" className="justify-start h-12 w-full" onClick={async () => {
                      toast.info("Gerando link temporario...");
                      const res = await gerarUrlDocumentoFiscalCte(cte.id, "dacte");
                      if (res.ok && res.signedUrl) {
                        window.open(res.signedUrl, "_blank");
                        toast.success(`Link gerado. Valido por ${(res.expiresIn || 600) / 60} minutos.`);
                      } else {
                        toast.error(res.erro || "Erro ao gerar link.");
                      }
                    }}>
                      <Download className="w-4 h-4 mr-3 text-red-500" />
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium">Abrir DACTE</span>
                        <span className="text-xs text-muted-foreground">Link temporario gerado sob demanda</span>
                      </div>
                    </Button>
                  ) : (
                    <Button variant="outline" className="justify-start h-12 w-full" onClick={() => handleBaixarDocumentos(["dacte"])} disabled={baixandoDocs}>
                      {baixandoDocs ? <Loader2 className="w-4 h-4 mr-3 animate-spin" /> : <Download className="w-4 h-4 mr-3 text-red-500" />}
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium">Baixar DACTE da Focus</span>
                        <span className="text-xs text-muted-foreground">Download e armazenamento no Storage</span>
                      </div>
                    </Button>
                  )}

                  {(!cte.metadata?.documentos_storage?.xml?.salvo || !cte.metadata?.documentos_storage?.dacte?.salvo) && (
                    <Button variant="default" className="w-full" onClick={() => handleBaixarDocumentos(["xml", "dacte"])} disabled={baixandoDocs}>
                      {baixandoDocs ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                      Baixar XML/DACTE
                    </Button>
                  )}

                  {(cte.metadata?.documentos_storage?.xml?.salvo || cte.metadata?.documentos_storage?.dacte?.salvo) && (
                    <Button variant="outline" size="sm" className="w-full text-amber-600 hover:bg-amber-50" onClick={() => {
                      if (confirm("Tem certeza que deseja reprocessar os documentos? Os arquivos serao baixados novamente da Focus e sobrescritos no Storage.")) {
                        handleBaixarDocumentos(["xml", "dacte"]);
                      }
                    }}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reprocessar XML/DACTE
                    </Button>
                  )}

                  {cte.chave_acesso && (
                    <div className="p-3 bg-slate-50 border rounded-lg text-xs">
                      <span className="text-muted-foreground">Chave:</span>{" "}
                      <span className="font-mono text-[10px] break-all">{cte.chave_acesso}</span>
                    </div>
                  )}

                  {cte.metadata?.documentos_storage?.xml?.salvo && (
                    <div className="p-2 bg-slate-50 border rounded text-[10px] text-slate-500">
                      <span className="font-medium">XML:</span>{" "}
                      {(cte.metadata.documentos_storage.xml.tamanho_bytes / 1024).toFixed(1)} KB — salvo em{" "}
                      {cte.metadata.documentos_storage.xml.salvo_em ? new Date(cte.metadata.documentos_storage.xml.salvo_em).toLocaleDateString() : "-"}
                    </div>
                  )}
                  {cte.metadata?.documentos_storage?.dacte?.salvo && (
                    <div className="p-2 bg-slate-50 border rounded text-[10px] text-slate-500">
                      <span className="font-medium">DACTE:</span>{" "}
                      {(cte.metadata.documentos_storage.dacte.tamanho_bytes / 1024).toFixed(1)} KB — salvo em{" "}
                      {cte.metadata.documentos_storage.dacte.salvo_em ? new Date(cte.metadata.documentos_storage.dacte.salvo_em).toLocaleDateString() : "-"}
                    </div>
                  )}
                </div>
              )}

              {/* XML URLs diretos (legado) */}
              {(cte.status !== "Autorizado" && cte.status !== "autorizado" && cte.status !== "rascunho") && (cte.xml_url || cte.pdf_url) && (
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
              )}

              {/* Fallback sem status conhecido */}
              {(cte.status !== "Autorizado" && cte.status !== "autorizado" && cte.status !== "rascunho") && !cte.xml_url && !cte.pdf_url && (
                <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg text-muted-foreground">
                  <FileSpreadsheet className="w-10 h-10 mb-2 opacity-20" />
                  <p className="text-sm font-medium">Arquivos nao disponiveis</p>
                  <p className="text-xs text-center mt-1 max-w-[250px]">O XML e o DACTE estarao disponiveis aqui apos a autorizacao do documento na Sefaz.</p>
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
                        {(() => {
                          const cfop = cte?.metadata?.payload_focus?.fiscal?.cfop || cte?.metadata?.payload_focus?.carga?.cfop || cte?.metadata?.cfop || null;
                          const natureza = cte?.metadata?.payload_focus?.fiscal?.natureza_operacao || cte?.metadata?.payload_focus?.carga?.natureza_operacao || cte?.metadata?.natureza_operacao || null;
                          const destinoCidade = cte?.metadata?.payload_focus?.destino?.cidade || cte?.metadata?.endereco_real_entrega_usado?.municipio || null;
                          const destinoUf = cte?.metadata?.payload_focus?.destino?.uf || cte?.metadata?.endereco_real_entrega_usado?.uf || null;
                          const codIbgeDestino = cte?.metadata?.endereco_real_entrega_usado?.codigo_ibge || (cte?.metadata?.payload_focus?.destino as any)?.codigo_municipio || null;
                          return (
                            <>
                              {cfop && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">CFOP</span>
                                  <span className="font-mono font-semibold">{cfop}</span>
                                </div>
                              )}
                              {natureza && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Natureza Operacao</span>
                                  <span className="text-xs">{natureza}</span>
                                </div>
                              )}
                              {destinoCidade && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Municipio Destino</span>
                                  <span className="font-medium">{destinoCidade}{destinoUf ? `/${destinoUf}` : ""}</span>
                                </div>
                              )}
                              {codIbgeDestino && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Codigo IBGE</span>
                                  <span className="font-mono">{codIbgeDestino}</span>
                                </div>
                              )}
                              {cte?.valor != null && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Valor Prestacao</span>
                                  <span className="font-semibold">{fmtFin(cte.valor)}</span>
                                </div>
                              )}
                            </>
                          );
                        })()}
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Pronto para emissao?</span>
                            <span className={`font-semibold ${temErros ? "text-red-600" : "text-green-600"}`}>
                              {temErros ? "NAO" : "SIM"}
                            </span>
                          </div>
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

                    {/* BOTÃO ENVIAR FOCUS HOMOLOGAÇÃO */}
                    <div className="flex gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex-1 inline-block">
                            <Button
                              className="w-full bg-blue-600 hover:bg-blue-700"
                              disabled={!podeEnviarFocus() || enviandoFocus}
                              onClick={handleEnviarFocus}
                            >
                              {enviandoFocus ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4 mr-2" />
                              )}
                              Enviar Focus Homologação
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {!podeEnviarFocus() && (
                          <TooltipContent side="top" className="max-w-[250px] text-center">
                            <p className="text-xs">
                              {cte?.status !== "rascunho"
                                ? "CT-e precisa estar em rascunho."
                                : cte?.metadata?.pendente_conferencia_endereco
                                ? "Endereco real de entrega pendente de conferencia."
                                : !cte?.metadata?.pronto_para_emissao
                                ? "Corrija as pendencias fiscais antes da emissao."
                                : "Payload Focus ou NF-e vinculada ausente."}
                            </p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                      <Button variant="outline" size="icon" className="h-10 w-10 flex-shrink-0" onClick={function(){setShowPreview(true);}} title="Visualizar Previa"><Eye className="w-4 h-4" /></Button>
                    </div>

                    {/* Botao Producao (apenas para rascunho pronto) */}
                    {cte.status === "rascunho" && cte.metadata?.pronto_para_emissao && !cte.metadata?.pendente_conferencia_endereco && (
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-red-300 text-red-700 hover:bg-red-50"
                          onClick={() => { setConfirmacaoProducao(""); setShowProducaoModal(true); }}
                        >
                          <Send className="w-4 h-4 mr-2" />
                          Emitir em Producao (Individual)
                        </Button>
                      </div>
                    )}

                    {/* Modal Confirmacao Producao */}
                    <Dialog open={showProducaoModal} onOpenChange={setShowProducaoModal}>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2 text-red-700">
                            <AlertTriangle className="w-5 h-5" />
                            Confirmar Emissao em Producao
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 py-2">
                          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                            Esta acao emitira um <strong>CT-e real</strong> em ambiente de <strong>producao</strong>.
                          </div>
                          <div className="text-xs text-slate-600 space-y-1">
                            <p>Confirme que:</p>
                            <ul className="list-disc ml-4 space-y-0.5">
                              <li>Contador/fiscal aprovou CFOP, CST, ICMS e tomador</li>
                              <li>Focus confirmou serie e numeracao de producao</li>
                              <li>Certificado A1 valido em producao</li>
                              <li>Responsavel autorizou explicitamente</li>
                            </ul>
                          </div>
                          <div>
                            <Label className="text-xs">Digite EMITIR PRODUCAO para confirmar:</Label>
                            <Input
                              value={confirmacaoProducao}
                              onChange={(e) => setConfirmacaoProducao(e.target.value)}
                              placeholder="EMITIR PRODUCAO"
                              className="mt-1 font-mono"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowProducaoModal(false)}>Cancelar</Button>
                          <Button
                            variant="destructive"
                            onClick={handleEnviarProducao}
                            disabled={confirmacaoProducao !== "EMITIR PRODUCAO" || enviandoProducao}
                          >
                            {enviandoProducao ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                            Emitir CT-e Producao
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* BOTÃO CONSULTAR STATUS FOCUS */}
                    {podeConsultarFocus() && (
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant="outline"
                          className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
                          disabled={consultandoFocus}
                          onClick={handleConsultarFocus}
                        >
                          {consultandoFocus ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-2" />
                          )}
                          Consultar Status Focus
                        </Button>
                      </div>
                    )}

                    {/* Modal Resultado Focus */}
                    <Dialog open={showFocusResult} onOpenChange={setShowFocusResult}>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            {focusResult?.autorizado
                              ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                              : focusResult?.rejeitado
                              ? <XCircle className="w-5 h-5 text-red-600" />
                              : focusResult?.resultados
                              ? <Download className="w-5 h-5 text-blue-600" />
                              : focusResult?.ok
                              ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                              : <XCircle className="w-5 h-5 text-red-600" />}
                            Resultado — {focusResult?.resultados ? "Documentos Fiscais" : focusResult?.autorizado ? "CT-e Autorizado" : focusResult?.rejeitado ? "CT-e Rejeitado" : focusResult?.modo === "consulta" ? "Consulta Focus" : "Envio Focus Homologação"}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 py-2">
                          {/* Resultado de Documentos */}
                          {focusResult?.resultados && (
                            <>
                              {(focusResult.resultados.xml || focusResult.resultados.dacte) && (
                                <div className="space-y-2">
                                  {focusResult.resultados.xml && (
                                    <div className={`p-3 border rounded-lg ${focusResult.resultados.xml.salvo ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                                      <div className="flex items-center gap-2">
                                        {focusResult.resultados.xml.salvo ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
                                        <span className="text-sm font-medium">{focusResult.resultados.xml.salvo ? "XML salvo no Storage" : "XML nao salvo"}</span>
                                      </div>
                                      {focusResult.resultados.xml.salvo && (
                                        <div className="mt-1 text-xs text-slate-600">
                                          {focusResult.resultados.xml.ja_existia && <Badge className="bg-blue-100 text-blue-700 text-[10px] mr-1">Ja existia</Badge>}
                                          {focusResult.resultados.xml.tamanho_bytes && <span>{(focusResult.resultados.xml.tamanho_bytes / 1024).toFixed(1)} KB</span>}
                                        </div>
                                      )}
                                      {!focusResult.resultados.xml.salvo && focusResult.resultados.xml.erro && (
                                        <p className="text-xs text-red-600 mt-1">{focusResult.resultados.xml.erro}</p>
                                      )}
                                    </div>
                                  )}
                                  {focusResult.resultados.dacte && (
                                    <div className={`p-3 border rounded-lg ${focusResult.resultados.dacte.salvo ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                                      <div className="flex items-center gap-2">
                                        {focusResult.resultados.dacte.salvo ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
                                        <span className="text-sm font-medium">{focusResult.resultados.dacte.salvo ? "DACTE salvo no Storage" : "DACTE nao salvo"}</span>
                                      </div>
                                      {focusResult.resultados.dacte.salvo && (
                                        <div className="mt-1 text-xs text-slate-600">
                                          {focusResult.resultados.dacte.ja_existia && <Badge className="bg-blue-100 text-blue-700 text-[10px] mr-1">Ja existia</Badge>}
                                          {focusResult.resultados.dacte.tamanho_bytes && <span>{(focusResult.resultados.dacte.tamanho_bytes / 1024).toFixed(1)} KB</span>}
                                        </div>
                                      )}
                                      {!focusResult.resultados.dacte.salvo && focusResult.resultados.dacte.erro && (
                                        <p className="text-xs text-red-600 mt-1">{focusResult.resultados.dacte.erro}</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}

                          {focusResult?.ok && !focusResult?.resultados ? (
                            <>
                              {focusResult.autorizado ? (
                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                    <span className="text-sm font-medium text-green-800">CT-e Autorizado na SEFAZ</span>
                                  </div>
                                </div>
                              ) : focusResult.rejeitado ? (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                  <div className="flex items-start gap-2">
                                    <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
                                    <div>
                                      <p className="text-sm font-semibold text-red-800">CT-e Rejeitado</p>
                                      <p className="text-xs text-red-600 mt-1">{focusResult.focusResponse?.motivo || focusResult.mensagem || "Motivo nao informado"}</p>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                                  <span className="text-sm font-medium text-green-800">
                                    {focusResult.mensagem || "Operacao concluida!"}
                                  </span>
                                </div>
                              )}

                              {focusResult.chave_acesso && (
                                <div className="p-3 bg-slate-50 border rounded-lg text-xs">
                                  <div className="flex justify-between py-1">
                                    <span className="text-muted-foreground">Chave de Acesso:</span>
                                    <span className="font-mono text-[10px] break-all">{focusResult.chave_acesso}</span>
                                  </div>
                                </div>
                              )}

                              {focusResult.protocolo && (
                                <div className="flex justify-between py-1 px-3 text-xs">
                                  <span className="text-muted-foreground">Protocolo:</span>
                                  <span className="font-mono text-[10px]">{focusResult.protocolo}</span>
                                </div>
                              )}

                              {focusResult.focusResponse && !focusResult.autorizado && !focusResult.rejeitado && (
                                <div className="p-3 bg-slate-50 border rounded-lg text-xs">
                                  <div className="flex justify-between py-1">
                                    <span className="text-muted-foreground">Status SEFAZ:</span>
                                    <span className="font-medium">{focusResult.focusResponse.status_sefaz || focusResult.focusResponse.status || "processando"}</span>
                                  </div>
                                </div>
                              )}

                              {(focusResult.xml_url || focusResult.pdf_url) && (
                                <div className="flex gap-2">
                                  {focusResult.xml_url && (
                                    <Button variant="outline" size="sm" className="text-xs gap-1" asChild>
                                      <a href={focusResult.xml_url} target="_blank" rel="noopener noreferrer">
                                        <Download className="w-3 h-3" /> Baixar XML
                                      </a>
                                    </Button>
                                  )}
                                  {focusResult.pdf_url && (
                                    <Button variant="outline" size="sm" className="text-xs gap-1" asChild>
                                      <a href={focusResult.pdf_url} target="_blank" rel="noopener noreferrer">
                                        <Download className="w-3 h-3" /> Baixar DACTE
                                      </a>
                                    </Button>
                                  )}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                              <div className="flex items-start gap-2">
                                <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
                                <div>
                                  <p className="text-sm font-semibold text-red-800">Erro</p>
                                  <p className="text-xs text-red-600 mt-1">{focusResult?.erro || focusResult?.motivo || "Erro desconhecido"}</p>
                                </div>
                              </div>
                              {focusResult?.focusResponse && (
                                <div className="mt-2 p-2 bg-white rounded border border-red-100 text-xs">
                                  <pre className="whitespace-pre-wrap break-all text-red-700">{JSON.stringify(focusResult.focusResponse, null, 2)}</pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowFocusResult(false)}>Fechar</Button>
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
