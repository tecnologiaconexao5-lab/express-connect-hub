import { useState, useEffect } from "react";
import { FileSpreadsheet, Link as LinkIcon, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import CteGrid from "./CteGrid";
import CteDetails from "./CteDetails";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CteTab() {
  const [ctes, setCtes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados do painel
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedCte, setSelectedCte] = useState<any>(null);
  const [defaultTab, setDefaultTab] = useState("resumo");

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
    toast.info("Importação de XML será ativada na integração real.");
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
          <Button variant="outline" onClick={handleImportXmlClick}>
            <UploadCloud className="w-4 h-4 mr-2" /> Importar XML
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleEmitirCte}>
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Emitir CT-e
          </Button>
        </div>
      </div>

      <CteGrid ctes={ctes} loading={loading} onAction={handleGridAction} />

      <CteDetails
        cte={selectedCte}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        defaultTab={defaultTab}
      />
    </div>
  );
}
