import { Smartphone } from "lucide-react";
import PlaceholderPage from "@/components/PlaceholderPage";

const AppPrestador = () => (
  <PlaceholderPage
    title="App do Prestador"
    description="Interface dedicada para parceiros logísticos gerenciarem suas operações e documentos."
    icon={Smartphone}
    subModules={[
      { title: "Minhas Operações", description: "Listagem de coletas e entregas atribuídas ao parceiro logístico.", status: "development" },
      { title: "Comprovantes", description: "Upload de fotos, assinaturas e comprovantes de entrega pelo celular.", status: "integration" },
      { title: "Financeiro", description: "Consulta de pagamentos, extratos e previsão de recebimentos.", status: "development" },
      { title: "Documentos", description: "Envio e atualização de documentação do parceiro e veículos.", status: "development" },
    ]}
  />
);
export default AppPrestador;
