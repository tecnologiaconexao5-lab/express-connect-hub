import { Database } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PlaceholderPage from "@/components/PlaceholderPage";

const Cadastros = () => {
  const navigate = useNavigate();

  return (
    <div>
      <PlaceholderPage
        title="Cadastros"
        description="Base cadastral centralizada de clientes, prestadores, veículos e estrutura organizacional."
        icon={Database}
        subModules={[
          { title: "Clientes", description: "Cadastro completo de clientes com dados fiscais, contatos e endereços.", status: "integration" },
          { title: "Prestadores", description: "Gestão de parceiros logísticos com documentação, veículos e áreas de atuação.", status: "integration" },
          { title: "Veículos", description: "Frota própria e de parceiros com dados técnicos e documentação.", status: "integration" },
          { title: "Regiões", description: "Mapeamento de regiões de atendimento com praças e abrangência.", status: "integration" },
          { title: "Filiais", description: "Estrutura de filiais com endereços, responsáveis e áreas de cobertura.", status: "integration" },
          { title: "Unidades", description: "Unidades operacionais com configurações específicas de operação.", status: "integration" },
          { title: "Centros de Custo", description: "Estrutura de centros de custo para rateio e controle financeiro.", status: "integration" },
          { title: "Tabelas Auxiliares", description: "Tabelas de apoio: tipos de veículo, tipos de carga, motivos, etc.", status: "integration" },
        ]}
        onSubModuleClick={(title) => {
          if (title === "Clientes") navigate("/cadastros/clientes");
          if (title === "Prestadores") navigate("/cadastros/prestadores");
          if (title === "Veículos") navigate("/cadastros/veiculos");
          if (title === "Regiões") navigate("/cadastros/auxiliares?tab=regioes");
          if (title === "Filiais") navigate("/cadastros/auxiliares?tab=filiais");
          if (title === "Unidades") navigate("/cadastros/auxiliares?tab=unidades");
          if (title === "Centros de Custo") navigate("/cadastros/auxiliares?tab=centros-custo");
          if (title === "Tabelas Auxiliares") navigate("/cadastros/auxiliares?tab=tabelas");
        }}
      />
    </div>
  );
};

export default Cadastros;
