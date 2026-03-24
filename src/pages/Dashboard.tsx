import { LayoutDashboard } from "lucide-react";
import PlaceholderPage from "@/components/PlaceholderPage";

const Dashboard = () => (
  <PlaceholderPage
    title="Dashboard"
    description="Visão consolidada de indicadores estratégicos, operacionais, comerciais e financeiros da operação logística."
    icon={LayoutDashboard}
    subModules={[
      { title: "Executivo", description: "KPIs de alto nível com receita, margem, volume e tendências para tomada de decisão estratégica.", status: "development" },
      { title: "Operacional", description: "Monitoramento em tempo real de entregas, coletas, ocorrências e performance operacional.", status: "development" },
      { title: "Comercial", description: "Pipeline de vendas, conversão de orçamentos, novos clientes e ticket médio.", status: "development" },
      { title: "Financeiro", description: "Fluxo de caixa, faturamento, inadimplência e indicadores de rentabilidade.", status: "development" },
      { title: "Alertas", description: "Central de alertas críticos com notificações de SLA, atrasos e pendências.", status: "integration" },
    ]}
  />
);
export default Dashboard;
