import { Car } from "lucide-react";
import PlaceholderPage from "@/components/PlaceholderPage";

const Frota = () => (
  <PlaceholderPage
    title="Frota"
    description="Gestão completa da frota própria com manutenção, abastecimento e documentação."
    icon={Car}
    subModules={[
      { title: "Manutenção", description: "Controle de manutenções preventivas e corretivas com histórico completo.", status: "development" },
      { title: "Abastecimento", description: "Registro e análise de consumo de combustível com indicadores de performance.", status: "development" },
      { title: "Documentos", description: "Gestão de documentação veicular: CRLV, IPVA, licenciamento e multas.", status: "development" },
      { title: "Seguros", description: "Controle de apólices de seguro com vigências, coberturas e sinistros.", status: "development" },
    ]}
  />
);
export default Frota;
