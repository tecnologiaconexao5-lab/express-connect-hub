import { DollarSign } from "lucide-react";
import PlaceholderPage from "@/components/PlaceholderPage";

const Financeiro = () => (
  <PlaceholderPage
    title="Financeiro"
    description="Gestão financeira integrada com faturamento, contas a pagar/receber e análise de resultados."
    icon={DollarSign}
    subModules={[
      { title: "Faturamento", description: "Geração e controle de faturas com lotes, conferência e envio automático.", status: "development" },
      { title: "Contas a Receber", description: "Gestão de títulos a receber com controle de vencimentos e cobranças.", status: "development" },
      { title: "Contas a Pagar", description: "Controle de obrigações com fornecedores, prestadores e despesas operacionais.", status: "development" },
      { title: "Pagamento Prestadores", description: "Cálculo e processamento de pagamentos a parceiros logísticos.", status: "development" },
      { title: "Fluxo de Caixa", description: "Projeção e acompanhamento de entradas e saídas financeiras.", status: "development" },
      { title: "DRE", description: "Demonstrativo de Resultado do Exercício com visão gerencial por período.", status: "integration" },
      { title: "Conciliação", description: "Conciliação bancária automatizada com importação de extratos.", status: "integration" },
    ]}
  />
);
export default Financeiro;
