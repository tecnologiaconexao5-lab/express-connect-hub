import { Settings } from "lucide-react";
import PlaceholderPage from "@/components/PlaceholderPage";

const Configuracoes = () => (
  <PlaceholderPage
    title="Configurações"
    description="Parametrização do sistema, gestão de usuários, perfis de acesso e integrações."
    icon={Settings}
    subModules={[
      { title: "Usuários", description: "Cadastro e gestão de usuários com controle de acesso e permissões.", status: "development" },
      { title: "Perfis", description: "Definição de perfis de acesso com permissões granulares por módulo.", status: "development" },
      { title: "Parâmetros", description: "Configurações gerais do sistema: prazos, regras de negócio e limites.", status: "development" },
      { title: "Integrações", description: "Conexão com ERPs, rastreadores, gateways de pagamento e APIs externas.", status: "integration" },
      { title: "Templates", description: "Modelos de e-mail, notificação e documentos personalizáveis.", status: "development" },
    ]}
  />
);
export default Configuracoes;
