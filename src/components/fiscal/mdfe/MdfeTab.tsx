import { useEffect, useState } from "react";
import { PlusCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import MdfeGrid from "./MdfeGrid";
import MdfeDetails from "./MdfeDetails";
import SelectCtesModal from "./SelectCtesModal";
import { gerarRascunhoMdfe } from "@/services/fiscal/mdfeService";

export default function MdfeTab() {
  const [mdfes, setMdfes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedMdfe, setSelectedMdfe] = useState<any>(null);
  const [defaultTab, setDefaultTab] = useState("resumo");

  const [showSelectCtes, setShowSelectCtes] = useState(false);

  useEffect(function() { fetchMdfes(); }, []);

  const fetchMdfes = async function() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("fiscal_mdfes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setMdfes(data || []);
    } catch (err: any) {
      toast.error("Nao foi possivel carregar os manifestos.");
    } finally {
      setLoading(false);
    }
  };

  const handleNovoMdfe = function() {
    setShowSelectCtes(true);
  };

  const handleGerarMdfe = async function(cteIds: string[]) {
    toast.info("Gerando MDF-e...");
    const result = await gerarRascunhoMdfe(cteIds);
    if (result.success) {
      toast.success("MDF-e rascunho gerado com sucesso!");
      fetchMdfes();
    } else {
      toast.error("Erro ao gerar MDF-e: " + (result.error || ""));
    }
  };

  const handleGridAction = function(action: string, mdfe: any) {
    setSelectedMdfe(mdfe);
    switch (action) {
      case "Detalhes": setDefaultTab("resumo"); setDetailsOpen(true); break;
      case "XML":
      case "DAMDFE": setDefaultTab("xml"); setDetailsOpen(true); break;
      case "Eventos": setDefaultTab("timeline"); setDetailsOpen(true); break;
      default: toast.info("Acao \"" + action + "\" nao configurada.");
    }
  };

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">MDF-e</h2>
          <p className="text-muted-foreground text-sm">Manifesto Eletronico de Documentos Fiscais.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchMdfes} disabled={loading}>
            <RefreshCw className={"w-4 h-4 mr-2" + (loading ? " animate-spin" : "")} /> Atualizar
          </Button>
          <Button className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm" onClick={handleNovoMdfe}>
            <PlusCircle className="w-4 h-4 mr-2" /> Novo Rascunho MDF-e
          </Button>
        </div>
      </div>

      <MdfeGrid mdfes={mdfes} loading={loading} onAction={handleGridAction} />

      <MdfeDetails mdfe={selectedMdfe} open={detailsOpen} onOpenChange={setDetailsOpen} defaultTab={defaultTab} />

      <SelectCtesModal open={showSelectCtes} onOpenChange={setShowSelectCtes} onConfirm={handleGerarMdfe} />
    </div>
  );
}
