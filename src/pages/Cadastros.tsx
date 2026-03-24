import { Database } from "lucide-react";
import PlaceholderPage from "@/components/PlaceholderPage";

const Cadastros = () => (
  <PlaceholderPage
    title="Cadastros"
    description="Base cadastral centralizada de clientes, prestadores, veículos e estrutura organizacional."
    icon={Database}
    subModules={[
      { title: "Clientes", description: "Cadastro completo de clientes com dados fiscais, contatos e endereços.", status: "development" },
      { title: "Prestadores", description: "Gestão de parceiros logísticos com documentação, veículos e áreas de atuação.", status: "development" },
      { title: "Veículos", description: "Frota própria e de parceiros com dados técnicos e documentação.", status: "development" },
      { title: "Regiões", description: "Mapeamento de regiões de atendimento com praças e abrangência.", status: "development" },
      { title: "Filiais", description: "Estrutura de filiais com endereços, responsáveis e áreas de cobertura.", status: "development" },
      { title: "Unidades", description: "Unidades operacionais com configurações específicas de operação.", status: "development" },
      { title: "Centros de Custo", description: "Estrutura de centros de custo para rateio e controle financeiro.", status: "development" },
      { title: "Tabelas Auxiliares", description: "Tabelas de apoio: tipos de veículo, tipos de carga, motivos, etc.", status: "development" },
    ]}
  />
);
export default Cadastros;
