import { FileSignature } from "lucide-react";
import PlaceholderPage from "@/components/PlaceholderPage";

const Contratos = () => (
  <PlaceholderPage
    title="Contratos"
    description="Gestão de contratos com clientes e parceiros logísticos, incluindo aditivos e vigências."
    icon={FileSignature}
    subModules={[
      { title: "Clientes", description: "Contratos de prestação de serviço com cláusulas, SLAs e condições comerciais.", status: "development" },
      { title: "Prestadores", description: "Contratos com parceiros logísticos definindo escopo, valores e obrigações.", status: "development" },
      { title: "Aditivos", description: "Gestão de aditivos contratuais com controle de versões e aprovações.", status: "development" },
      { title: "Vigências", description: "Monitoramento de prazos e alertas de vencimento de contratos.", status: "development" },
    ]}
  />
);
export default Contratos;
