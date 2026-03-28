import { useSearchParams } from "react-router-dom";
import { Briefcase, Users, Calculator, BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlaceholderPage from "@/components/PlaceholderPage";
import OrcamentosLista from "@/components/comercial/OrcamentosLista";
import TabelasValoresLista from "@/components/comercial/TabelasValoresLista";
import SimuladorFrete from "@/components/comercial/SimuladorFrete";
import CrmBase from "@/components/comercial/crm/CrmBase";

const Comercial = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "crm";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Briefcase className="w-6 h-6 text-primary" /> Comercial
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Gestão comercial completa com CRM, orçamentos e simulações de frete.</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v })}>
        <TabsList className="bg-muted">
          <TabsTrigger value="crm"><Users className="w-3.5 h-3.5 mr-1" />CRM</TabsTrigger>
          <TabsTrigger value="orcamentos"><Briefcase className="w-3.5 h-3.5 mr-1" />Orçamentos</TabsTrigger>
          <TabsTrigger value="tabela"><Calculator className="w-3.5 h-3.5 mr-1" />Tabela de Valores</TabsTrigger>
          <TabsTrigger value="simulador"><BarChart3 className="w-3.5 h-3.5 mr-1" />Simulador</TabsTrigger>
        </TabsList>

        <TabsContent value="crm" className="mt-0 pt-2">
          <CrmBase />
        </TabsContent>

        <TabsContent value="orcamentos">
          <OrcamentosLista />
        </TabsContent>

        <TabsContent value="tabela">
          <TabelasValoresLista />
        </TabsContent>

        <TabsContent value="simulador">
          <SimuladorFrete />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Comercial;
