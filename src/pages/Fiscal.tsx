import { FileText } from "lucide-react";
import PlaceholderPage from "@/components/PlaceholderPage";

const Fiscal = () => (
  <PlaceholderPage
    title="Fiscal"
    description="Emissão e gestão de documentos fiscais eletrônicos do transporte."
    icon={FileText}
    subModules={[
      { title: "CT-e", description: "Emissão, cancelamento e gestão de Conhecimentos de Transporte Eletrônicos.", status: "integration" },
      { title: "MDF-e", description: "Manifesto Eletrônico de Documentos Fiscais para operações de transporte.", status: "integration" },
      { title: "CIOT", description: "Código Identificador da Operação de Transporte para fretes terceirizados.", status: "integration" },
      { title: "XML/PDF", description: "Armazenamento e consulta de XMLs e DANFEs dos documentos fiscais.", status: "development" },
      { title: "Parametrizações", description: "Configuração de CFOP, CST, alíquotas e regras fiscais por operação.", status: "development" },
    ]}
  />
);
export default Fiscal;
