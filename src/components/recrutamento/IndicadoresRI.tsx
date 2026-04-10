import { BarChart3, TrendingUp, AlertTriangle, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function IndicadoresRI() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Painel Executivo de Indicadores
          </h2>
          <p className="text-sm text-muted-foreground">Visão estratégica e inteligência analítica das Campanhas de Captação.</p>
        </div>
        <Badge variant="outline" className="bg-slate-100 text-slate-700 font-bold border-slate-300 gap-1.5 px-3 py-1">
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> Acesso Nível Administrativo
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="py-3 pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase font-bold tracking-wide">Média de Lucro Operações</CardTitle>
          </CardHeader>
          <CardContent>
             <p className="text-2xl font-bold text-slate-800">R$ 2.450,00</p>
             <p className="text-[10px] text-green-600 mt-1 flex items-center gap-1 font-semibold"><TrendingUp className="w-3 h-3"/> +12.5% ref. mês ant.</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardHeader className="py-3 pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase font-bold tracking-wide">Melhor Operação (Lucro/dia)</CardTitle>
          </CardHeader>
          <CardContent>
             <p className="text-xl font-bold text-emerald-700 truncate">Rota Sul D+1</p>
             <p className="text-[10px] text-emerald-600/80 mt-1 font-semibold">Estimado: R$ 3.800/Mês</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardHeader className="py-3 pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase font-bold tracking-wide">Custo Médio / km Geral</CardTitle>
          </CardHeader>
          <CardContent>
             <p className="text-2xl font-bold text-slate-800">R$ 2,34</p>
             <p className="text-[10px] text-slate-500 mt-1 font-semibold">Considerando Todas as Rotas Ativas</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 bg-red-50/30 shadow-sm">
          <CardHeader className="py-3 pb-2">
            <CardTitle className="text-xs text-red-700 uppercase font-bold tracking-wide flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5"/> Alerta de Retorno</CardTitle>
          </CardHeader>
          <CardContent>
             <p className="text-sm font-bold text-red-800">Distribuição Capital</p>
             <p className="text-[10px] text-red-600 mt-1 font-semibold">Base de lucro abaixo do tolerável (15%)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
         {/* VISÕES GRÁFICAS - MOCKUPS */}
         <Card className="shadow-sm">
           <CardHeader className="pb-3 border-b">
             <CardTitle className="text-sm">Veículos por Operação - Volume Exigido</CardTitle>
           </CardHeader>
           <CardContent className="pt-6 h-[250px] flex items-center justify-center flex-col text-muted-foreground">
              <BarChart3 className="w-12 h-12 opacity-20 mb-2" />
              <p className="text-xs">Gráfico em renderização: Agrupamento de Tipos de Veículos (Van, VUC, 3/4) vs. Quantidade de Vagas em Campanhas Ativas.</p>
           </CardContent>
         </Card>

         <Card className="shadow-sm">
           <CardHeader className="pb-3 border-b">
             <CardTitle className="text-sm">Ranking de Campanhas (Eficiência Financeira)</CardTitle>
           </CardHeader>
           <CardContent className="pt-4">
              <div className="space-y-4">
                 <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded">
                    <div className="flex items-center gap-3">
                       <span className="font-bold text-slate-400">1º</span>
                       <div>
                         <p className="text-xs font-bold">Transferência Ouro Branco</p>
                         <p className="text-[10px] text-slate-400">Margem: 32% | Carreta</p>
                       </div>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Alto Retorno</Badge>
                 </div>
                 <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded">
                    <div className="flex items-center gap-3">
                       <span className="font-bold text-slate-400">2º</span>
                       <div>
                         <p className="text-xs font-bold">Rota Sul D+1</p>
                         <p className="text-[10px] text-slate-400">Margem: 28% | Carreta</p>
                       </div>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Alto Retorno</Badge>
                 </div>
                 <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded">
                    <div className="flex items-center gap-3">
                       <span className="font-bold text-slate-400">3º</span>
                       <div>
                         <p className="text-xs font-bold">Entrega Fracionada MG</p>
                         <p className="text-[10px] text-slate-400">Margem: 22% | Truck</p>
                       </div>
                    </div>
                    <Badge variant="outline" className="text-slate-600 bg-slate-50">Retorno Padrão</Badge>
                 </div>
              </div>
           </CardContent>
         </Card>
      </div>
    </div>
  );
}
