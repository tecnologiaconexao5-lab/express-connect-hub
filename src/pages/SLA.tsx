import { Award } from "lucide-react";
import PlaceholderPage from "@/components/PlaceholderPage";

const SLA = () => (
  <PlaceholderPage
    title="SLA e Qualidade"
    description="Indicadores de nível de serviço, satisfação do cliente e performance operacional."
    icon={Award}
    subModules={[
      { title: "SLA por Cliente", description: "Acompanhamento de acordos de nível de serviço por cliente com metas e resultados.", status: "development" },
      { title: "NPS", description: "Pesquisa de satisfação com Net Promoter Score e análise de feedback.", status: "integration" },
      { title: "Taxa de Entrega", description: "Indicadores de sucesso de entrega na primeira tentativa e motivos de insucesso.", status: "development" },
      { title: "Performance", description: "Ranking de performance por região, parceiro logístico e tipo de operação.", status: "development" },
    ]}
  />
);
export default SLA;
