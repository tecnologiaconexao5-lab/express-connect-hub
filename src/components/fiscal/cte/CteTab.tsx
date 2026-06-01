import { useState, useEffect, useRef } from "react";
import { FileSpreadsheet, Link as LinkIcon, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import CteGrid from "./CteGrid";
import CteDetails from "./CteDetails";
import SelectOsModal from "./SelectOsModal";
import XmlImportadosList from "./XmlImportadosList";
import { gerarRascunhoCte } from "@/services/fiscal/cteService";
import { importarXmlNfe } from "@/services/fiscal/xmlImportService";
import { Loader2 } from "lucide-react";
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
    toast.info("Selecione a OS para vincular...");
  };

  const handleImportXmlClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".xml")) {
      toast.error("Apenas arquivos XML de NF-e sao aceitos.");
      return;
    }

    try {
      setImportando(true);
      const xmlText = await file.text();

      const result = await importarXmlNfe(xmlText, null);

      if (result.success && result.doc) {
        toast.success(
          `NF-e ${result.doc.numero || "S/N"} importada com sucesso! ` +
          `Valor: ${(result.doc.valor_total ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
        );
        setXmlRefreshKey((k) => k + 1);
      } else {
        toast.error(result.error || "Erro ao importar XML.");
      }
    } catch (err: any) {
      toast.error("Erro ao ler arquivo: " + err.message);
    } finally {
      setImportando(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml,text/xml,application/xml"
            className="hidden"
            onChange={handleFileChange}
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
    </div>
  );
}
