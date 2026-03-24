import { BarChart3 } from "lucide-react";
import PlaceholderPage from "@/components/PlaceholderPage";

const Relatorios = () => (
  <PlaceholderPage
    title="Relatórios"
    description="Central de relatórios gerenciais e operacionais com exportação e agendamento."
    icon={BarChart3}
    subModules={[
      { title: "Operacionais", description: "Relatórios de volume, prazo, ocorrências e produtividade operacional.", status: "development" },
      { title: "Comerciais", description: "Relatórios de vendas, orçamentos, clientes ativos e churn.", status: "development" },
      { title: "Financeiros", description: "Relatórios de receita, despesa, margem e análise de rentabilidade.", status: "development" },
      { title: "Fiscais", description: "Relatórios de documentos emitidos, impostos e obrigações acessórias.", status: "development" },
    ]}
  />
);
export default Relatorios;
