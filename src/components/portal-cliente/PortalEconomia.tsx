import { LucideIcon, TrendingDown, TrendingUp, DollarSign, Fuel, Package, Truck, MapPin, CheckCircle, Clock, Calculator, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface EconomiaMetrics {
  economiaVsFrotaPropria: number;
  produtividade: number;
  reducaoCusto: number;
  kmOtimizados: number;
  ocupacaoMedia: number;
  economiaCombustivel: number;
  entregasConsolidadas: number;
  metaEconomia: number;
}

interface PortalEconomiaProps {
  metrics?: EconomiaMetrics;
}

type PeriodFilter = "hoje" | "7dias" | "30dias" | "mes_atual" | "personalizado";

const periodLabels: Record<PeriodFilter, string> = {
  hoje: "Hoje",
  "7dias": "7 Dias",
  "30dias": "30 Dias",
  mes_atual: "Mês Atual",
  personalizado: "Personalizado",
};

const defaultMetrics: EconomiaMetrics = {
  economiaVsFrotaPropria: 18400,
  produtividade: 94,
  reducaoCusto: 12.5,
  kmOtimizados: 1250,
  ocupacaoMedia: 82,
  economiaCombustivel: 4200,
  entregasConsolidadas: 89,
  metaEconomia: 15000,
};

export function PortalEconomia({ metrics = defaultMetrics }: PortalEconomiaProps) {
  const [periodoFiltro, setPeriodoFiltro] = useState<PeriodFilter>("30dias");
  const progressoMeta = (metrics.economiaVsFrotaPropria / metrics.metaEconomia) * 100;

  const handleExportar = () => {
    const dados = `RELATÓRIO ECONÔMICO - PERÍODO: ${periodLabels[periodoFiltro]}
===============================================
Economia vs Frota Própria: R$ ${metrics.economiaVsFrotaPropria.toLocaleString()}
Produtividade: ${metrics.produtividade}%
Redução de Custo: ${metrics.reducaoCusto}%
Km Otimizados: ${metrics.kmOtimizados}km
Ocupação Média: ${metrics.ocupacaoMedia}%
Economia Combustível: R$ ${metrics.economiaCombustivel.toLocaleString()}
Entregas Consolidadas: ${metrics.entregasConsolidadas}
Meta de Economia: R$ ${metrics.metaEconomia.toLocaleString()}

DETALHAMENTO:
- Sem veículos próprios: R$ 12.400/mês
- Otimização rotas: R$ 2.800/mês
- Consolidação cargas: R$ 1.900/mês
- Economia combustível: R$ 1.300/mês

Gerado em: ${new Date().toLocaleString("pt-BR")}`;

    const blob = new Blob([dados], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_economia_${periodoFiltro}_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Economia Operacional</h2>
            <p className="text-sm font-bold text-slate-500">Análise financeira e produtividade</p>
          </div>
        </div>
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 font-black uppercase px-3 py-1">
          <TrendingDown className="w-3.5 h-3.5 mr-1.5" />
          Em economia
        </Badge>
        <Badge className="bg-blue-50 text-blue-700 border-blue-200">
          Período: {periodLabels[periodoFiltro]}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(Object.keys(periodLabels) as PeriodFilter[]).map((periodo) => (
          <Button
            key={periodo}
            variant={periodoFiltro === periodo ? "default" : "outline"}
            size="sm"
            className={periodoFiltro === periodo ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-emerald-200 text-emerald-700 bg-white"}
            onClick={() => setPeriodoFiltro(periodo)}
          >
            {periodLabels[periodo]}
          </Button>
        ))}
        <Button variant="outline" size="sm" className="border-emerald-200 text-emerald-700 bg-white ml-auto" onClick={handleExportar}>
          <Download className="w-3 h-3 mr-1" />
          Exportar Relatório
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200 shadow-sm rounded-2xl hover:shadow-md transition-all">
          <CardContent className="p-6 text-center">
            <DollarSign className="w-8 h-8 mx-auto text-emerald-600 mb-3" />
            <p className="text-4xl font-black text-slate-900">R$ {(metrics.economiaVsFrotaPropria / 1000).toFixed(1)}k</p>
            <p className="text-xs font-black text-emerald-700 uppercase tracking-widest mt-2">Economia Total</p>
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">vs frota própria</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 shadow-sm rounded-2xl hover:shadow-md transition-all">
          <CardContent className="p-6 text-center">
            <TrendingDown className="w-8 h-8 mx-auto text-orange-600 mb-3" />
            <p className="text-4xl font-black text-slate-900">{metrics.reducaoCusto}%</p>
            <p className="text-xs font-black text-orange-700 uppercase tracking-widest mt-2">Redução Custo</p>
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">mensal</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 shadow-sm rounded-2xl hover:shadow-md transition-all">
          <CardContent className="p-6 text-center">
            <MapPin className="w-8 h-8 mx-auto text-blue-600 mb-3" />
            <p className="text-4xl font-black text-slate-900">{metrics.kmOtimizados}</p>
            <p className="text-xs font-black text-blue-700 uppercase tracking-widest mt-2">km Otimizados</p>
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">este mês</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 shadow-sm rounded-2xl hover:shadow-md transition-all">
          <CardContent className="p-6 text-center">
            <Truck className="w-8 h-8 mx-auto text-purple-600 mb-3" />
            <p className="text-4xl font-black text-slate-900">{metrics.ocupacaoMedia}%</p>
            <p className="text-xs font-black text-purple-700 uppercase tracking-widest mt-2">Ocupação Média</p>
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">da frota</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white border-slate-200 rounded-2xl shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-900 text-sm font-black flex items-center gap-2 uppercase tracking-widest">
              <TrendingDown className="w-4 h-4 text-emerald-600" />
              Meta de Economia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-slate-500 uppercase">Progresso mensal</span>
              <span className="text-sm font-black text-emerald-600">{progressoMeta.toFixed(0)}%</span>
            </div>
            <div className="h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all"
                style={{ width: `${Math.min(progressoMeta, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-4 text-[10px] font-black text-slate-400 uppercase tracking-tight">
              <span>R$ {metrics.economiaVsFrotaPropria.toLocaleString()} atingido</span>
              <span>R$ {metrics.metaEconomia.toLocaleString()} meta</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 rounded-2xl shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-900 text-sm font-black flex items-center gap-2 uppercase tracking-widest">
              <DollarSign className="w-4 h-4 text-orange-600" />
              Detalhamento Economia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <span className="text-sm font-bold text-slate-700">Sem veículos próprios</span>
                <span className="text-sm font-black text-emerald-600">R$ 12.400/mês</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <span className="text-sm font-bold text-slate-700">Otimização rotas</span>
                <span className="text-sm font-black text-emerald-600">R$ 2.800/mês</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <span className="text-sm font-bold text-slate-700">Consolidação cargas</span>
                <span className="text-sm font-black text-emerald-600">R$ 1.900/mês</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <span className="text-sm font-bold text-slate-700">Economia combustível</span>
                <span className="text-sm font-black text-emerald-600">R$ 1.300/mês</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-emerald-50 border-emerald-100 rounded-2xl shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-black text-emerald-900 uppercase tracking-tight">Valor percebido pelo cliente</p>
              <p className="text-xs font-medium text-emerald-700 mt-1 leading-relaxed">
                A cada R$ 1 investido na Conexão Express, você economiza R$ 1,23 em comparação com operação própria.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}