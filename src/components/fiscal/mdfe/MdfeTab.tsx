import { useEffect, useState } from "react";
import { PlusCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import MdfeGrid from "./MdfeGrid";
import MdfeDetails from "./MdfeDetails";

export default function MdfeTab() {
  const [mdfes, setMdfes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados do drawer
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedMdfe, setSelectedMdfe] = useState<any>(null);
  const [defaultTab, setDefaultTab] = useState("resumo");

  useEffect(() => {
    fetchMdfes();
  }, []);

  const fetchMdfes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("fiscal_mdfes")
        .select(`
          *,
          clientes (
            nome_fantasia,
            razao_social
          ),
          ordens_servico (
            numero
          ),
          filiais (
            nome
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar MDF-es:", error);
        toast.error("Não foi possível carregar os manifestos.");
        return;
      }

      setMdfes(data || []);
    } catch (err) {
      console.error("Exceção ao buscar MDF-es:", err);
      toast.error("Falha na conexão com o servidor ao buscar manifestos.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmitirMdfe = () => {
    toast.info("Emissão de MDF-e será habilitada via Focus NFe.");
  };

  const handleGridAction = (action: string, mdfe: any) => {
    setSelectedMdfe(mdfe);
    
    switch (action) {
      case "Detalhes":
        setDefaultTab("resumo");
        setDetailsOpen(true);
        break;
      case "XML":
      case "DAMDFE":
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
        <div>
          <h2 className="text-2xl font-bold tracking-tight">MDF-e</h2>
          <p className="text-muted-foreground text-sm">
            Manifesto Eletrônico de Documentos Fiscais.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchMdfes} disabled={loading} title="Atualizar lista">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm" onClick={handleEmitirMdfe}>
            <PlusCircle className="w-4 h-4 mr-2" />
            Novo MDF-e
          </Button>
        </div>
      </div>

      <MdfeGrid mdfes={mdfes} loading={loading} onAction={handleGridAction} />

      <MdfeDetails
        mdfe={selectedMdfe}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        defaultTab={defaultTab}
      />
    </div>
  );
}
