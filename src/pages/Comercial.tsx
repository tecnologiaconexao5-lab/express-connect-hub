import { useSearchParams } from "react-router-dom";
import { Briefcase, Users, Calculator, BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlaceholderPage from "@/components/PlaceholderPage";
import OrcamentosLista from "@/components/comercial/OrcamentosLista";

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

        <TabsContent value="crm">
          <PlaceholderPage
            title="CRM"
            description="Gerenciamento de leads, oportunidades e relacionamento com clientes prospects."
            icon={Users}
            subModules={[
              { title: "Pipeline", description: "Visualização do funil de vendas e oportunidades em andamento.", status: "development" },
              { title: "Leads", description: "Cadastro e qualificação de leads com scoring automático.", status: "development" },
              { title: "Atividades", description: "Registro de visitas, ligações e follow-ups comerciais.", status: "development" },
            ]}
          />
        </TabsContent>

        <TabsContent value="orcamentos">
          <OrcamentosLista />
        </TabsContent>

        <TabsContent value="tabela">
          <PlaceholderPage
            title="Tabela de Valores"
            description="Gestão de tabelas de preço por região, tipo de serviço e faixa de peso."
            icon={Calculator}
            subModules={[
              { title: "Tabelas Vigentes", description: "Consulta e edição de tabelas de preço ativas.", status: "development" },
              { title: "Histórico", description: "Versões anteriores e comparativo de valores.", status: "development" },
            ]}
          />
        </TabsContent>

        <TabsContent value="simulador">
          <PlaceholderPage
            title="Simulador de Frete"
            description="Simulação de frete com cálculo automático baseado em tabelas vigentes."
            icon={BarChart3}
            subModules={[
              { title: "Simulação Rápida", description: "Cálculo de frete com base em origem, destino e carga.", status: "integration" },
              { title: "Comparativo", description: "Comparação entre fornecedores e modalidades.", status: "integration" },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Comercial;
