import { Users } from "lucide-react";
import PlaceholderPage from "@/components/PlaceholderPage";

const PortalCliente = () => (
  <PlaceholderPage
    title="Painel do Cliente"
    description="Portal self-service para clientes acompanharem suas operações, faturas e indicadores."
    icon={Users}
    subModules={[
      { title: "Rastreamento", description: "Consulta de status de entregas e coletas em tempo real.", status: "development" },
      { title: "Solicitações", description: "Abertura de solicitações de coleta, devolução e segunda via.", status: "development" },
      { title: "Faturas", description: "Consulta e download de faturas, boletos e notas fiscais.", status: "development" },
      { title: "Relatórios", description: "Relatórios personalizados de performance e volume.", status: "integration" },
    ]}
  />
);
export default PortalCliente;
