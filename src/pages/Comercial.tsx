import { Briefcase } from "lucide-react";
import PlaceholderPage from "@/components/PlaceholderPage";

const Comercial = () => (
  <PlaceholderPage
    title="Comercial"
    description="Gestão comercial completa com CRM, orçamentos e simulações de frete."
    icon={Briefcase}
    subModules={[
      { title: "CRM", description: "Gerenciamento de leads, oportunidades e relacionamento com clientes prospects.", status: "development" },
      { title: "Orçamentos", description: "Criação e acompanhamento de propostas comerciais com aprovação em fluxo.", status: "development" },
      { title: "Tabela de Valores", description: "Gestão de tabelas de preço por região, tipo de serviço e faixa de peso.", status: "development" },
      { title: "Simulador", description: "Simulação de frete com cálculo automático baseado em tabelas vigentes.", status: "integration" },
    ]}
  />
);
export default Comercial;
