import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Users, DollarSign, Calculator, TrendingUp, ChevronLeft } from "lucide-react";
import RelatorioFaturamentoCliente from "./relatorios/RelatorioFaturamentoCliente";
import RelatorioPagamentoPrestador from "./relatorios/RelatorioPagamentoPrestador";
import MargemPorOS from "./MargemPorOS";
import DREGerencial from "./DREGerencial";
import FluxoCaixaEnterprise from "./FluxoCaixaEnterprise";

type ReportType = 'faturamento' | 'pagamentos' | 'margem' | 'dre' | 'fluxo' | null;

export default function RelatorioFinanceiroCompleto() {
  const [activeReport, setActiveReport] = useState<ReportType>(null);

  const reports = [
    { 
      id: 'faturamento' as ReportType, 
      title: 'Faturamento por Cliente', 
      desc: 'Análise detalhada de faturamento, OS e ticket médio por cliente.',
      icon: DollarSign,
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-900/20'
    },
    { 
      id: 'pagamentos' as ReportType, 
      title: 'Pagamento de Prestadores', 
      desc: 'Relatório de custos, quantidades e valores pagos a prestadores.',
      icon: Users,
      color: 'text-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-900/20'
    },
    { 
      id: 'margem' as ReportType, 
      title: 'Margem Real por OS', 
      desc: 'Visão exata de receita, custos, pedágio, impostos e lucro de cada OS.',
      icon: FileText,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20'
    },
    { 
      id: 'dre' as ReportType, 
      title: 'DRE Gerencial', 
      desc: 'Demonstrativo de Resultados do Exercício, margens e EBITDA.',
      icon: Calculator,
      color: 'text-purple-500',
      bg: 'bg-purple-50 dark:bg-purple-900/20'
    },
    { 
      id: 'fluxo' as ReportType, 
      title: 'Fluxo de Caixa', 
      desc: 'Projeção de entradas, saídas e saldo para os próximos 30, 60 e 90 dias.',
      icon: TrendingUp,
      color: 'text-cyan-500',
      bg: 'bg-cyan-50 dark:bg-cyan-900/20'
    }
  ];

  if (activeReport) {
    const currentReport = reports.find(r => r.id === activeReport);
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-4 border-b border-border pb-4">
          <Button variant="ghost" size="icon" onClick={() => setActiveReport(null)} className="rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              {currentReport?.icon && <currentReport.icon className={`w-6 h-6 ${currentReport.color}`} />}
              {currentReport?.title}
            </h2>
            <p className="text-sm text-muted-foreground">{currentReport?.desc}</p>
          </div>
        </div>
        
        <div className="pt-2">
          {activeReport === 'faturamento' && <RelatorioFaturamentoCliente />}
          {activeReport === 'pagamentos' && <RelatorioPagamentoPrestador />}
          {activeReport === 'margem' && <MargemPorOS />}
          {activeReport === 'dre' && <DREGerencial />}
          {activeReport === 'fluxo' && <FluxoCaixaEnterprise />}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Relatórios Financeiros</h2>
        <p className="text-sm text-muted-foreground">Selecione um relatório profissional para visualizar e exportar.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((r) => (
          <Card 
            key={r.id} 
            className="cursor-pointer border-border hover:border-primary/50 hover:shadow-md transition-all duration-200 group bg-card"
            onClick={() => setActiveReport(r.id)}
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${r.bg} transition-colors`}>
                  <r.icon className={`w-6 h-6 ${r.color}`} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">{r.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{r.desc}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}