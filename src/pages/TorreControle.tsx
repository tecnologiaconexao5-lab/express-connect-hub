import { Radio } from "lucide-react";
import PlaceholderPage from "@/components/PlaceholderPage";

const TorreControle = () => (
  <PlaceholderPage
    title="Torre de Controle"
    description="Centro de comando para monitoramento em tempo real de todas as operações logísticas."
    icon={Radio}
    subModules={[
      { title: "Operações em Andamento", description: "Painel com todas as coletas e entregas ativas, status e previsões de conclusão.", status: "development" },
      { title: "Tracking", description: "Rastreamento em tempo real de veículos e cargas com atualização automática.", status: "integration" },
      { title: "Timeline", description: "Linha do tempo detalhada de cada operação com marcos e checkpoints.", status: "development" },
      { title: "Alertas", description: "Alertas automáticos de atrasos, desvios de rota e ocorrências críticas.", status: "development" },
      { title: "Mapa", description: "Visualização geográfica de operações, rotas e pontos de interesse.", status: "integration" },
    ]}
  />
);
export default TorreControle;
