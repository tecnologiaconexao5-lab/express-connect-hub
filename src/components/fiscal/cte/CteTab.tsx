import { useState, useEffect, useRef } from "react";
import { FileSpreadsheet, Link as LinkIcon, UploadCloud, FileText, CheckCircle2, XCircle, AlertTriangle, Layers, Send, BarChart3, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import CteGrid from "./CteGrid";
import CteDetails from "./CteDetails";
import SelectOsModal from "./SelectOsModal";
import XmlImportadosList from "./XmlImportadosList";
import GerarLoteCteModal from "./GerarLoteCteModal";
import EnviarLoteFocusModal from "./EnviarLoteFocusModal";
import PainelAssistenteFiscalLote from "./PainelAssistenteFiscalLote";
import PainelFiscalExecutivo from "./PainelFiscalExecutivo";
import ControleRomaneioCalvo from "./ControleRomaneioCalvo";
import EnviarDocumentosClienteModal from "./EnviarDocumentosClienteModal";
import VincularRomaneioOsModal from "./VincularRomaneioOsModal";
import PreviaRomaneioCteModal from "./PreviaRomaneioCteModal";
import { gerarRascunhoCte } from "@/services/fiscal/cteService";
import { importarXmlNfe, importarMultiplosXmlNfe, type ImportacaoXmlResultado } from "@/services/fiscal/xmlImportService";
import { corrigirRascunhosRomaneio, type CorrecaoRomaneioResultado } from "@/services/fiscal/corrigirRascunhosRomaneioService";
import {
  processarUploadRomaneio,
  type ProcessamentoRomaneioResult,
  type CruzamentoResultado,
} from "@/services/fiscal/romaneioCalvoService";
import { Loader2 } from "lucide-react";
import { abrirPreviaCte } from "@/utils/pdfPreviaCteSemValorFiscal";
import type { FiscalDocumentoVinculado } from "@/types/fiscal";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CteTab() {
  const [ctes, setCtes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados do painel
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedCte, setSelectedCte] = useState<any>(null);
  const [defaultTab, setDefaultTab] = useState("resumo");
  
  const [modalOsOpen, setModalOsOpen] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [xmlRefreshKey, setXmlRefreshKey] = useState(0);
  const [vinculandoDoc, setVinculandoDoc] = useState<FiscalDocumentoVinculado | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const romaneioInputRef = useRef<HTMLInputElement>(null);

  const [processandoRomaneio, setProcessandoRomaneio] = useState(false);
  const [resultadoRomaneio, setResultadoRomaneio] = useState<ProcessamentoRomaneioResult | null>(null);
  const [showRomaneioResult, setShowRomaneioResult] = useState(false);
  const [showRomaneioDebug, setShowRomaneioDebug] = useState(false);
  const [debugRomaneio, setDebugRomaneio] = useState<any>(null);
  const [showLoteModal, setShowLoteModal] = useState(false);
  const [showLoteFocusModal, setShowLoteFocusModal] = useState(false);
  const [loteFocusId, setLoteFocusId] = useState<string | null>(null);
  const [showPainelAssistente, setShowPainelAssistente] = useState(false);
  const [painelLoteId, setPainelLoteId] = useState<string | null>(null);
  const [showPainelExecutivo, setShowPainelExecutivo] = useState(false);
  const [showControleRomaneio, setShowControleRomaneio] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showVincularRomaneioModal, setShowVincularRomaneioModal] = useState(false);
  const [showPreviaRomaneioModal, setShowPreviaRomaneioModal] = useState(false);
  const [showImportResult, setShowImportResult] = useState(false);
  const [importResultados, setImportResultados] = useState<ImportacaoXmlResultado[]>([]);
  const [emailCtes, setEmailCtes] = useState<any[]>([]);
  const [emailRomaneio, setEmailRomaneio] = useState("");
  const [emailLoteId, setEmailLoteId] = useState("");
  const [corrigindoRascunhos, setCorrigindoRascunhos] = useState(false);
  const [correcaoResultado, setCorrecaoResultado] = useState<CorrecaoRomaneioResultado | null>(null);
  const [showCorrecaoResult, setShowCorrecaoResult] = useState(false);

  useEffect(() => {
    fetchCtes();
  }, []);

  const fetchCtes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("fiscal_ctes")
        .select(`
          *,
          clientes ( nome_fantasia, razao_social ),
          ordens_servico ( numero ),
          filiais ( nome )
        `)
        .order("data_emissao", { ascending: false });

      if (error) throw error;
      setCtes(data || []);
    } catch (err: any) {
      toast.error(`Erro ao buscar CT-es: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVincularOS = () => {
    setShowVincularRomaneioModal(true);
  };

  const handleImportXmlClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportRomaneioClick = () => {
    romaneioInputRef.current?.click();
  };

  const handleRomaneioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Apenas arquivos PDF sao aceitos para romaneio.");
      return;
    }

    try {
      setProcessandoRomaneio(true);
      const resultado = await processarUploadRomaneio(file);
      setResultadoRomaneio(resultado);
      setShowRomaneioResult(true);
      setXmlRefreshKey((k) => k + 1);

      toast.success(
        `Romaneio processado: ${resultado.cruzaram} de ${resultado.total_itens} itens cruzados com XMLs.`
      );

      if (resultado.pendentes > 0) {
        toast.warning(`${resultado.pendentes} itens ficaram pendentes de cruzamento.`);
      }

      if (resultado.debug) {
        console.log("[Romaneio Debug]", resultado.debug);
        setDebugRomaneio(resultado.debug);
      }
    } catch (err: any) {
      const debug = err.debug;
      if (debug) {
        setDebugRomaneio({ ...debug, arquivo: file.name, erro: err.message });
        setShowRomaneioDebug(true);
      } else {
        setDebugRomaneio({ arquivo: file.name, erro: err.message, texto_previa: "", texto_extraido_caracteres: 0, layout_detectado: "erro", nfs_detectadas: 0, chaves_detectadas: 0, itens_extraidos: 0 });
        setShowRomaneioDebug(true);
      }
      toast.error(err.message || "Erro ao processar romaneio.", { duration: 8000 });
    } finally {
      setProcessandoRomaneio(false);
      if (romaneioInputRef.current) romaneioInputRef.current.value = "";
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const xmlFiles = files.filter((f) => f.name.toLowerCase().endsWith(".xml"));
    const nonXml = files.filter((f) => !f.name.toLowerCase().endsWith(".xml"));
    if (nonXml.length > 0) toast.warning(`${nonXml.length} arquivo(s) ignorado(s): apenas XML aceito.`);
    if (xmlFiles.length === 0) { toast.error("Nenhum arquivo XML selecionado."); return; }

    try {
      setImportando(true);
      const resultados = await importarMultiplosXmlNfe(xmlFiles);
      setImportResultados(resultados);
      setShowImportResult(true);
      setXmlRefreshKey((k) => k + 1);

      const sucessos = resultados.filter((r) => r.sucesso).length;
      const dups = resultados.filter((r) => r.duplicado).length;
      const erros = resultados.filter((r) => !r.sucesso).length;
      toast.success(`${sucessos} XML(s) importado(s)${dups > 0 ? `, ${dups} duplicado(s)` : ""}${erros > 0 ? `, ${erros} erro(s)` : ""}.`);
    } catch (err: any) { toast.error("Erro: " + err.message); }
    finally { setImportando(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const handleVincularDoc = (doc: FiscalDocumentoVinculado) => {
    setVinculandoDoc(doc);
    setModalOsOpen(true);
  };

  const handleModalConfirm = async (osId: string) => {
    if (vinculandoDoc) {
      try {
        const { error } = await supabase
          .from("fiscal_documentos_vinculados")
          .update({
            ordem_servico_id: osId,
            status: "vinculado",
            updated_at: new Date().toISOString(),
          })
          .eq("id", vinculandoDoc.id);

        if (error) throw error;

        toast.success(
          `NF-e ${vinculandoDoc.numero || "S/N"} vinculada a OS!`
        );
        setXmlRefreshKey((k) => k + 1);
      } catch (err: any) {
        toast.error("Erro ao vincular: " + err.message);
      } finally {
        setVinculandoDoc(null);
        setModalOsOpen(false);
      }
    } else {
      await handleConfirmGerarRascunho(osId);
      setModalOsOpen(false);
    }
  };

  const handleModalClose = (open: boolean) => {
    if (!open) setVinculandoDoc(null);
    setModalOsOpen(open);
  };

  const handleConfirmGerarRascunho = async (osId: string) => {
    try {
      setGerando(true);
      const res = await gerarRascunhoCte(osId);
      if (res.success) {
        toast.success("CT-e Rascunho gerado com sucesso!");
        fetchCtes();
        
        // Abrir o drawer imediatamente com os detalhes do novo CT-e (opcional, pode ser feito depois buscando o CTE)
        if (res.cte) {
           setSelectedCte(res.cte);
           setDefaultTab("resumo");
           setDetailsOpen(true);
        }
      } else {
        toast.error(res.error || "Erro ao gerar rascunho");
      }
    } catch (err: any) {
      toast.error("Erro inesperado: " + err.message);
    } finally {
      setGerando(false);
    }
  };

  const handleEmitirCte = () => {
    toast.info("Emissão de CT-e será habilitada via Focus NFe.");
  };

  const handleCorrigirRascunhos = async () => {
    if (!confirm("Corrigir os 16 rascunhos do romaneio 340612?\n\nIsso preenchera tomador, NF-e, CFOP, origem e removera pendencias. Nenhum envio Focus sera feito.")) return;
    try {
      setCorrigindoRascunhos(true);
      const resultado = await corrigirRascunhosRomaneio("340612");
      setCorrecaoResultado(resultado);
      setShowCorrecaoResult(true);
      toast.success(`${resultado.corrigidos} de ${resultado.total} rascunhos corrigidos!`);
      fetchCtes();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setCorrigindoRascunhos(false);
    }
  };

  const handleGridAction = (action: string, cte: any) => {
    setSelectedCte(cte);
    
    switch (action) {
      case "Detalhes":
        setDefaultTab("resumo");
        setDetailsOpen(true);
        break;
      case "XML":
      case "DACTE":
        setDefaultTab("xml");
        setDetailsOpen(true);
        break;
      case "Eventos":
        setDefaultTab("timeline");
        setDetailsOpen(true);
        break;
      case "Download":
        toast.info("Baixando pacotes de arquivos...");
        break;
      case "EnviarFocus":
        setDefaultTab("fiscal");
        setDetailsOpen(true);
        break;
      case "ConsultarFocus":
        setDefaultTab("fiscal");
        setDetailsOpen(true);
        break;
      case "EnviarLoteFocus":
        setLoteFocusId(cte?.metadata?.rateio?.lote_id || cte?.metadata?.lote_id || null);
        setShowLoteFocusModal(true);
        break;
      case "BaixarDocs":
        setDefaultTab("xml");
        setDetailsOpen(true);
        break;
      case "Previa":
        toast.info("Gerando previa sem valor fiscal...");
        abrirPreviaCte(cte);
        break;
      case "AssistenteLote":
        setPainelLoteId(cte?.metadata?.rateio?.lote_id || cte?.metadata?.lote_id || null);
        setShowPainelAssistente(true);
        break;
      default:
        toast.info(`Ação "${action}" não configurada.`);
    }
  };

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex-1"></div>
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <Button variant="outline" onClick={handleVincularOS} className="border-dashed">
            <LinkIcon className="w-4 h-4 mr-2" /> Vincular à OS
          </Button>
          <Button variant="outline" onClick={handleImportXmlClick} disabled={importando}>
            {importando ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <UploadCloud className="w-4 h-4 mr-2" />
            )}
            Importar XML
          </Button>
          <Button variant="outline" onClick={handleImportRomaneioClick} disabled={processandoRomaneio} className="border-orange-300 text-orange-700 hover:bg-orange-50">
            {processandoRomaneio ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 mr-2" />
            )}
            Importar Romaneio
          </Button>
          <Button variant="outline" onClick={() => setShowLoteModal(true)} className="border-green-300 text-green-700 hover:bg-green-50">
            <Layers className="w-4 h-4 mr-2" />
            Gerar CT-es em Lote
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setShowPreviaRomaneioModal(true)} 
            className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
          >
            <Eye className="w-4 h-4 mr-2" />
            Prévia CT-e do Romaneio
          </Button>
          <Button variant="outline" onClick={() => { setLoteFocusId(null); setShowLoteFocusModal(true); }} className="border-purple-300 text-purple-700 hover:bg-purple-50" title="Enviar lote para Focus">
            <Send className="w-4 h-4 mr-2" />
            Enviar Lote Focus
          </Button>
          <Button variant="outline" onClick={() => setShowPainelExecutivo(true)} className="border-indigo-300 text-indigo-700 hover:bg-indigo-50">
            <BarChart3 className="w-4 h-4 mr-2" />
            Painel Executivo
          </Button>
          <Button variant="outline" onClick={() => setShowControleRomaneio(true)} className="border-orange-300 text-orange-700 hover:bg-orange-50">
            <FileText className="w-4 h-4 mr-2" />
            Romaneios
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml,text/xml,application/xml"
            className="hidden"
            multiple
            onChange={handleFileChange}
          />
          <input
            ref={romaneioInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleRomaneioFileChange}
          />
          <Button 
            className="bg-blue-600 hover:bg-blue-700 text-white" 
            onClick={() => setModalOsOpen(true)}
            disabled={gerando}
          >
            {gerando ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 mr-2" />
            )}
            Gerar CT-e Rascunho
          </Button>
        </div>
      </div>

      <CteGrid ctes={ctes} loading={loading} onAction={handleGridAction} />

      <div className="border rounded-lg">
        <div className="p-4 border-b bg-muted/20 flex items-center gap-2">
          <UploadCloud className="w-4 h-4 text-orange-500" />
          <h3 className="font-semibold text-sm">XMLs NF-e Importados</h3>
        </div>
        <div className="p-4">
          <XmlImportadosList refreshKey={xmlRefreshKey} onVincular={handleVincularDoc} />
        </div>
      </div>

      <CteDetails
        cte={selectedCte}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        defaultTab={defaultTab}
      />

      <SelectOsModal
        open={modalOsOpen}
        onOpenChange={handleModalClose}
        onConfirm={handleModalConfirm}
        title={vinculandoDoc ? `Vincular NF-e ${vinculandoDoc.numero || "S/N"} a uma OS` : undefined}
      />

      {/* Modal Resultado Romaneio */}
      <Dialog open={showRomaneioResult} onOpenChange={setShowRomaneioResult}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-600" />
              Resultado da Importacao do Romaneio Calvo
            </DialogTitle>
          </DialogHeader>

          {resultadoRomaneio && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-5 gap-2">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-slate-700">{resultadoRomaneio.total_itens}</p>
                  <p className="text-xs text-slate-600">Total de itens</p>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-700">{resultadoRomaneio.cruzaram}</p>
                  <p className="text-xs text-blue-600">XMLs cruzados</p>
                </div>
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-700">{resultadoRomaneio.enderecos_ok}</p>
                  <p className="text-xs text-green-600">Enderecos OK</p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-amber-700">{resultadoRomaneio.enderecos_pendentes}</p>
                  <p className="text-xs text-amber-600">Enderecos pendentes</p>
                </div>
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-indigo-700">{resultadoRomaneio.prontos_para_cte}</p>
                  <p className="text-xs text-indigo-600">Prontos p/ CT-e</p>
                </div>
              </div>

              {resultadoRomaneio.enderecos_pendentes > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    Existem {resultadoRomaneio.enderecos_pendentes} enderecos pendentes de conferencia.
                    Use o botao "Conferir endereco" em cada item ou acesse Romaneios &gt; {resultadoRomaneio.resultados[0]?.item.numero_romaneio || "..."} para editar.
                    CT-es so podem ser gerados para itens com endereco completo.
                  </span>
                </div>
              )}

              {resultadoRomaneio.prontos_para_cte === 0 && resultadoRomaneio.cruzaram > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                  <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Nenhum item pronto para CT-e. Todos os {resultadoRomaneio.cruzaram} XMLs cruzados precisam de conferencia de endereco antes de gerar CT-e.</span>
                </div>
              )}

              {resultadoRomaneio.debug && (
                <div className="p-3 bg-slate-50 border rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-600">Diagnostico do Parser</p>
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => {
                      setShowRomaneioResult(false);
                      setTimeout(() => setShowRomaneioDebug(true), 100);
                    }}>
                      Debug Completo
                    </Button>
                  </div>
                  <div className="text-slate-500 space-y-0.5">
                    <p>Parser usado: <Badge className="text-[10px]" variant="outline">{resultadoRomaneio.debug.parser_usado || "texto"}</Badge></p>
                    <p>Texto extraido: {resultadoRomaneio.debug.texto_extraido_caracteres} caracteres</p>
                    <p>Layout detectado: {resultadoRomaneio.debug.layout_detectado || "generico"}</p>
                    <p>NF-es detectadas: {resultadoRomaneio.debug.nfs_detectadas}</p>
                    <p>Chaves detectadas: {resultadoRomaneio.debug.chaves_detectadas}</p>
                    <p>Itens extraidos: {resultadoRomaneio.debug.itens_extraidos}</p>
                    {resultadoRomaneio.debug.avisos.length > 0 && (
                      <p className="text-amber-600">Avisos: {resultadoRomaneio.debug.avisos.join("; ")}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="border rounded-lg">
                <div className="p-3 border-b bg-slate-50 font-semibold text-sm flex items-center justify-between">
                  <span>Itens do Romaneio</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {resultadoRomaneio.resultados.filter((r) => r.cruzou).length} XML / {resultadoRomaneio.resultados.filter((r) => r.endereco_ok).length} End. OK / {resultadoRomaneio.resultados.filter((r) => r.endereco_pendente).length} End. pendente
                  </span>
                </div>
                <div className="divide-y max-h-[500px] overflow-y-auto">
                  {resultadoRomaneio.resultados.map((res, idx) => (
                    <div key={idx} className="p-3 text-xs">
                      <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                        <span className="font-medium">
                          NF-e {res.item.numero_nfe || "S/N"}
                          {res.item.numero_romaneio ? ` — Romaneio ${res.item.numero_romaneio}` : ""}
                        </span>
                        <div className="flex items-center gap-1">
                          {/* Badge XML cruzado vs pendente */}
                          {res.cruzou ? (
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">
                              <CheckCircle2 className="w-3 h-3 mr-0.5" />XML cruzado
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">
                              <XCircle className="w-3 h-3 mr-0.5" />XML pendente
                            </Badge>
                          )}
                          {/* Badge endereco OK vs pendente */}
                          {res.cruzou && (
                            res.endereco_ok ? (
                              <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">
                                <CheckCircle2 className="w-3 h-3 mr-0.5" />End. OK
                              </Badge>
                            ) : res.endereco_pendente ? (
                              <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
                                <AlertTriangle className="w-3 h-3 mr-0.5" />Conferir end.
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">
                                <XCircle className="w-3 h-3 mr-0.5" />End. ausente
                              </Badge>
                            )
                          )}
                        </div>
                      </div>

                      {/* Endereco extraido */}
                      {res.item.endereco_real_entrega && (
                        <div className={`ml-2 border-l-2 pl-2 mt-1 ${res.endereco_ok ? "border-green-300" : "border-amber-300"}`}>
                          <span className={`font-medium ${res.endereco_ok ? "text-green-700" : "text-amber-700"}`}>Endereco entrega:</span>{" "}
                          <span className={res.endereco_ok ? "text-green-800" : "text-amber-800"}>
                            {[
                              res.item.endereco_real_entrega.logradouro,
                              res.item.endereco_real_entrega.numero ? `, ${res.item.endereco_real_entrega.numero}` : "",
                              res.item.endereco_real_entrega.complemento || "",
                              res.item.endereco_real_entrega.bairro ? `, ${res.item.endereco_real_entrega.bairro}` : "",
                              res.item.endereco_real_entrega.municipio,
                              res.item.endereco_real_entrega.uf ? `/${res.item.endereco_real_entrega.uf}` : "",
                              res.item.endereco_real_entrega.cep ? ` CEP ${res.item.endereco_real_entrega.cep}` : "",
                            ].filter(Boolean).join(" ")}
                          </span>
                        </div>
                      )}

                      {/* Motivos de validacao */}
                      {res.item.endereco_validacao_motivos && res.item.endereco_validacao_motivos.length > 0 && (
                        <div className="ml-2 mt-1 flex flex-wrap gap-1">
                          {res.item.endereco_validacao_motivos.map((motivo, mi) => (
                            <span key={mi} className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{motivo}</span>
                          ))}
                        </div>
                      )}

                      {res.item.municipio_entrega && res.item.uf_entrega && !res.item.endereco_real_entrega?.logradouro && (
                        <div className="text-slate-500 ml-2 mt-0.5">
                          Destino: {res.item.municipio_entrega}/{res.item.uf_entrega}
                          {res.item.bairro_entrega ? ` — ${res.item.bairro_entrega}` : ""}
                        </div>
                      )}

                      {!res.cruzou && res.motivo_falha && (
                        <div className="text-red-500 ml-2 mt-1">{res.motivo_falha}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRomaneioResult(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <GerarLoteCteModal
        open={showLoteModal}
        onOpenChange={setShowLoteModal}
        onLoteGerado={fetchCtes}
      />
      <EnviarLoteFocusModal
        open={showLoteFocusModal}
        onOpenChange={setShowLoteFocusModal}
        loteId={loteFocusId}
        onLoteProcessado={fetchCtes}
      />
      <PainelAssistenteFiscalLote
        open={showPainelAssistente}
        onOpenChange={setShowPainelAssistente}
        loteId={painelLoteId}
        onAtualizar={fetchCtes}
      />
      <PainelFiscalExecutivo
        open={showPainelExecutivo}
        onOpenChange={setShowPainelExecutivo}
      />
      <ControleRomaneioCalvo
        open={showControleRomaneio}
        onOpenChange={setShowControleRomaneio}
      />

      {/* Modal Resumo Importacao XML */}
      <Dialog open={showImportResult} onOpenChange={setShowImportResult}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-blue-600" />
              Importacao de XML — Resultado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-slate-50 border rounded-lg text-center">
                <p className="text-xl font-bold">{importResultados.length}</p>
                <p className="text-xs text-slate-500">Selecionados</p>
              </div>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                <p className="text-xl font-bold text-green-700">{importResultados.filter((r) => r.sucesso).length}</p>
                <p className="text-xs text-green-600">Importados</p>
              </div>
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
                <p className="text-xl font-bold text-red-700">{importResultados.filter((r) => !r.sucesso).length}</p>
                <p className="text-xs text-red-600">Erros/Duplicados</p>
              </div>
            </div>
            <div className="border rounded-md max-h-[350px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 sticky top-0"><tr><th className="p-2 text-left">Arquivo</th><th className="p-2">NF-e</th><th className="p-2">Chave</th><th className="p-2 text-center">Status</th><th className="p-2 text-left">Mensagem</th></tr></thead>
                <tbody className="divide-y">
                  {importResultados.map((r, i) => (
                    <tr key={i} className={r.sucesso ? "bg-green-50" : r.duplicado ? "bg-amber-50" : "bg-red-50"}>
                      <td className="p-2 font-medium text-[10px] truncate max-w-[120px]">{r.arquivo}</td>
                      <td className="p-2 text-center">{r.numeroNfe || "-"}</td>
                      <td className="p-2 text-[10px] font-mono truncate max-w-[100px]">{r.chaveNfe?.substring(0, 16) || "-"}</td>
                      <td className="p-2 text-center">
                        {r.sucesso ? <Badge className="bg-green-100 text-green-700 text-[10px]">OK</Badge> :
                          r.duplicado ? <Badge className="bg-amber-100 text-amber-700 text-[10px]">Duplicado</Badge> :
                          <Badge className="bg-red-100 text-red-700 text-[10px]">Erro</Badge>}
                      </td>
                      <td className="p-2 text-[10px] max-w-[150px] truncate">
                        {r.sucesso ? `Valor: ${(r.valorTotal || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` :
                          r.erro || r.tipoDetectado}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportResult(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Diagnostico Romaneio (erro / debug completo) */}
      <Dialog open={showRomaneioDebug} onOpenChange={setShowRomaneioDebug}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Diagnostico da Importacao do Romaneio
            </DialogTitle>
          </DialogHeader>
          {debugRomaneio && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-4 gap-2 text-sm">
                <div><span className="text-xs text-muted-foreground">Arquivo</span><p className="font-medium text-xs truncate">{debugRomaneio.arquivo}</p></div>
                <div><span className="text-xs text-muted-foreground">Caracteres extraidos</span><p className="font-medium">{debugRomaneio.texto_extraido_caracteres}</p></div>
                <div><span className="text-xs text-muted-foreground">Parser usado</span><p className="font-medium text-xs"><Badge variant="outline" className="text-[10px]">{debugRomaneio.parser_usado || "texto"}</Badge></p></div>
                <div><span className="text-xs text-muted-foreground">Layout detectado</span><p className="font-medium text-xs">{debugRomaneio.layout_detectado || "Nao reconhecido"}</p></div>
                <div><span className="text-xs text-muted-foreground">NF-es detectadas</span><p className="font-medium">{debugRomaneio.nfs_detectadas}</p></div>
                <div><span className="text-xs text-muted-foreground">Chaves detectadas</span><p className="font-medium">{debugRomaneio.chaves_detectadas}</p></div>
                <div><span className="text-xs text-muted-foreground">Itens extraidos</span><p className="font-medium">{debugRomaneio.itens_extraidos}</p></div>
                <div><span className="text-xs text-muted-foreground">Colunas detectadas</span><p className="font-medium">{debugRomaneio.colunas_detectadas?.length || 0}</p></div>
              </div>

              {debugRomaneio.erro && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <span className="font-semibold">Erro:</span> {debugRomaneio.erro}
                </div>
              )}

              {(debugRomaneio.avisos || []).length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  {(debugRomaneio.avisos || []).map((a: string, i: number) => <div key={i} className="flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />{a}</div>)}
                </div>
              )}

              {/* Colunas detectadas */}
              {(debugRomaneio.colunas_detectadas || []).length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold">Colunas detectadas (por X)</span>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(debugRomaneio.colunas_detectadas, null, 2));
                      toast.success("Debug das colunas copiado.");
                    }}>
                      Copiar debug colunas
                    </Button>
                  </div>
                  <div className="p-3 bg-slate-950 text-green-400 rounded-lg text-[11px] font-mono whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                    {debugRomaneio.colunas_detectadas.map((c: any, i: number) =>
                      `Col ${i}: "${c.nome}"  X:[${Math.round(c.xMin)}..${Math.round(c.xMax)}]`
                    ).join("\n")}
                  </div>
                </div>
              )}

              {/* Linhas reconstruidas por Y */}
              {(debugRomaneio.linhas_reconstruidas || []).length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold">Linhas reconstruidas por Y ({debugRomaneio.linhas_reconstruidas.length} linhas)</span>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(debugRomaneio.linhas_reconstruidas, null, 2));
                      toast.success("Debug das linhas copiado.");
                    }}>
                      Copiar debug linhas
                    </Button>
                  </div>
                  <div className="p-3 bg-slate-950 text-green-400 rounded-lg text-[11px] font-mono whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                    {debugRomaneio.linhas_reconstruidas.map((l: any, i: number) =>
                      `[Y=${l.y}] ${l.textoLinha}`
                    ).join("\n")}
                  </div>
                </div>
              )}

              {debugRomaneio.texto_previa ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold">Texto extraido do PDF (previa)</span>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                      navigator.clipboard.writeText(debugRomaneio.texto_previa);
                      toast.success("Texto extraido copiado.");
                    }}>
                      Copiar texto extraido
                    </Button>
                  </div>
                  <div className="p-3 bg-slate-950 text-green-400 rounded-lg text-[11px] font-mono whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                    {debugRomaneio.texto_previa}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                  O PDF nao possui texto extraivel suficiente. Pode ser PDF escaneado/imagem.
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRomaneioDebug(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VincularRomaneioOsModal
        open={showVincularRomaneioModal}
        onOpenChange={setShowVincularRomaneioModal}
        onVinculado={() => {
          setXmlRefreshKey((k) => k + 1);
          fetchCtes();
        }}
      />

      <PreviaRomaneioCteModal
        open={showPreviaRomaneioModal}
        onOpenChange={setShowPreviaRomaneioModal}
        onLoteGerado={() => {
          fetchCtes();
        }}
      />

      {/* Modal Resultado Correcao Rascunhos */}
      <Dialog open={showCorrecaoResult} onOpenChange={setShowCorrecaoResult}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {correcaoResultado?.falhas === 0 ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              )}
              Correcão dos Rascunhos — Romaneio {correcaoResultado?.romaneio || "340612"}
            </DialogTitle>
            <DialogDescription>
              {correcaoResultado?.corrigidos} de {correcaoResultado?.total} rascunhos corrigidos com sucesso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-slate-50 border rounded-lg text-center">
                <p className="text-xl font-bold">{correcaoResultado?.total || 0}</p>
                <p className="text-xs text-slate-500">Total rascunhos</p>
              </div>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                <p className="text-xl font-bold text-green-700">{correcaoResultado?.corrigidos || 0}</p>
                <p className="text-xs text-green-600">Corrigidos</p>
              </div>
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
                <p className="text-xl font-bold text-red-700">{correcaoResultado?.falhas || 0}</p>
                <p className="text-xs text-red-600">Falhas</p>
              </div>
            </div>

            {correcaoResultado?.erros && correcaoResultado.erros.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {correcaoResultado.erros.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}

            <div className="border rounded-lg max-h-[350px] overflow-y-auto">
              <div className="p-3 border-b bg-slate-50 font-semibold text-xs sticky top-0">
                Resultados por CT-e
              </div>
              <div className="divide-y">
                {(correcaoResultado?.resultados || []).map((r, i) => (
                  <div key={i} className="p-2 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">CT-e {r.numeroCte} — NF-e {r.nfeNumero}</span>
                      <Badge className={r.corrigido ? "bg-green-100 text-green-700 text-[10px]" : "bg-red-100 text-red-700 text-[10px]"}>
                        {r.corrigido ? "OK" : "FALHA"}
                      </Badge>
                    </div>
                    {r.alteracoes.length > 0 && (
                      <div className="flex flex-wrap gap-1 ml-2">
                        {r.alteracoes.map((a, j) => (
                          <Badge key={j} variant="outline" className="text-[9px]">{a}</Badge>
                        ))}
                      </div>
                    )}
                    {r.erros.length > 0 && (
                      <div className="text-red-500 ml-2 mt-1">{r.erros.join("; ")}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCorrecaoResult(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
