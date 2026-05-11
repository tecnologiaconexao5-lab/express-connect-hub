import { useSearchParams } from "react-router-dom";
import { Briefcase, Users, Calculator, BarChart3, FileText, Megaphone } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlaceholderPage from "@/components/PlaceholderPage";
import OrcamentosLista from "@/components/comercial/OrcamentosLista";
import TabelasValoresLista from "@/components/comercial/TabelasValoresLista";
import SimuladorFrete from "@/components/comercial/SimuladorFrete";
import CrmBase from "@/components/comercial/crm/CrmBase";
import PropostasMain from "@/components/comercial/propostas/PropostasMain";
import MarketingMain from "@/components/comercial/marketing/MarketingMain";
import LeadsLista from "@/components/comercial/crm/LeadsLista";
import DashboardComercial from "@/components/comercial/crm/DashboardComercial";
import { Zap } from "lucide-react";
import { MonitoramentoCombustivelCard } from "@/components/financeiro/MonitoramentoCombustivel";

const Comercial = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "orcamentos";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Briefcase className="w-6 h-6 text-primary" /> Comercial
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Gestão comercial completa com CRM, orçamentos e simulações de frete.</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v })}>
        <TabsList className="mb-4">
          <TabsTrigger value="orcamentos" className="gap-2"><Briefcase className="w-4 h-4"/>Orçamentos</TabsTrigger>
          <TabsTrigger value="crm" className="gap-2"><Users className="w-4 h-4"/>CRM</TabsTrigger>
          <TabsTrigger value="marketing" className="gap-2"><Megaphone className="w-4 h-4"/>Marketing</TabsTrigger>
          <TabsTrigger value="propostas" className="gap-2"><FileText className="w-4 h-4"/>Propostas</TabsTrigger>
          <TabsTrigger value="tabela" className="gap-2"><Calculator className="w-4 h-4"/>Tabela de Valores</TabsTrigger>
          <TabsTrigger value="simulador" className="gap-2"><BarChart3 className="w-4 h-4"/>Simulador</TabsTrigger>
          <TabsTrigger value="automacao" className="gap-2"><Zap className="w-4 h-4"/>Automação</TabsTrigger>
        </TabsList>

        <TabsContent value="orcamentos">
          <OrcamentosLista />
        </TabsContent>

        <TabsContent value="crm" className="mt-0 pt-2">
          <CrmBase />
        </TabsContent>

        <TabsContent value="marketing" className="mt-0 pt-2">
          <MarketingMain />
        </TabsContent>

        <TabsContent value="propostas">
          <PropostasMain />
        </TabsContent>

        <TabsContent value="tabela" className="space-y-4">
          <MonitoramentoCombustivelCard />
          <TabelasValoresLista />
        </TabsContent>

        <TabsContent value="simulador">
          <SimuladorFrete />
        </TabsContent>

        <TabsContent value="automacao" className="mt-0 pt-2 space-y-4">
          <DashboardComercial />
          <LeadsLista />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Comercial;
