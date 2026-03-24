import { ClipboardList } from "lucide-react";
import PlaceholderPage from "@/components/PlaceholderPage";

const Operacao = () => (
  <PlaceholderPage
    title="Operação"
    description="Gestão completa do ciclo operacional: da coleta à entrega, incluindo ocorrências e devoluções."
    icon={ClipboardList}
    subModules={[
      { title: "Ordens de Serviço", description: "Criação, distribuição e acompanhamento de OS com workflow completo.", status: "development" },
      { title: "Escala", description: "Programação de parceiros operacionais e veículos por região e período.", status: "development" },
      { title: "Ocorrências", description: "Registro e tratamento de ocorrências operacionais com classificação e resolução.", status: "development" },
      { title: "Comprovantes/POD", description: "Upload e gestão de provas de entrega com assinatura digital e fotos.", status: "integration" },
      { title: "Programação", description: "Planejamento antecipado de coletas e entregas com otimização de rotas.", status: "development" },
      { title: "Devoluções", description: "Controle de mercadorias devolvidas com motivos e fluxo de retorno.", status: "development" },
      { title: "Reentregas", description: "Gestão de tentativas adicionais de entrega com agendamento e controle.", status: "development" },
    ]}
  />
);
export default Operacao;
