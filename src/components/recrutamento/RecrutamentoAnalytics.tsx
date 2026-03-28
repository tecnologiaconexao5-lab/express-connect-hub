import { PieChart, Zap, TrendingUp, Search, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function RecrutamentoAnalytics() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
       <Card className="col-span-full border-b-4 border-b-primary">
          <CardHeader className="text-center">
             <TrendingUp className="w-12 h-12 text-primary mx-auto mb-4"/>
             <CardTitle className="text-xl">Funil Logístico Express de Candidatos</CardTitle>
             <CardDescription>Conversão do mês via Meta Ads e Formulário Orgânico.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row justify-center items-center gap-2 md:gap-6 pt-6">
             {["Interessados (120)", "Triagem Ativa (65)", "Docs Carga (42)", "Aprovados / Integração (28)", "Frotistas Ativos (12)"].map((s, i) => (
                <div key={i} className="flex flex-col md:flex-row items-center gap-2 md:gap-6 w-full md:w-auto">
                   <div className="bg-slate-50 border border-slate-200 px-6 py-4 rounded-xl text-center w-full md:w-auto hover:bg-white shadow-sm transition group">
                      <p className="font-bold text-slate-700 font-mono tracking-tighter text-sm lg:text-base group-hover:text-primary">{s}</p>
                   </div>
                   {i < 4 && <Search className="w-5 h-5 text-slate-300 rotate-90 md:rotate-0" />}
                </div>
             ))}
          </CardContent>
       </Card>

       <Card>
          <CardHeader>
             <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2"><PieChart className="w-4 h-4 text-emerald-500"/> Retenção vs Tipo de Veículo</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
                <div className="flex flex-col gap-1"><div className="flex justify-between text-xs font-bold text-slate-600"><span>VUC / HR</span><span>45% Cadastros | 80% Retidos</span></div><div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 w-[80%]"/></div></div>
                <div className="flex flex-col gap-1"><div className="flex justify-between text-xs font-bold text-slate-600"><span>Fiorino / Saveiro</span><span>30% Cadastros | 65% Retidos</span></div><div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 w-[65%]"/></div></div>
                <div className="flex flex-col gap-1"><div className="flex justify-between text-xs font-bold text-slate-600"><span>Caminhão Pesado</span><span>25% Cadastros | 30% Retidos</span></div><div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 w-[30%]"/></div></div>
             </div>
          </CardContent>
       </Card>

       <Card className="col-span-1 lg:col-span-2 bg-slate-900 border-0 text-white">
          <CardHeader>
             <CardTitle className="text-sm font-bold text-blue-300 flex items-center gap-2"><Zap className="w-4 h-4 text-amber-400"/> Gaps Geográficos na Malha de Escala</CardTitle>
          </CardHeader>
          <CardContent className="h-40 flex items-center justify-center p-0">
             <div className="w-full h-full bg-[linear-gradient(45deg,rgba(0,0,0,0.1)_25%,transparent_25%,transparent_50%,rgba(0,0,0,0.1)_50%,rgba(0,0,0,0.1)_75%,transparent_75%,transparent)] bg-[length:20px_20px] opacity-10 flex items-center justify-center relative pointer-events-none"/>
             <div className="absolute z-10 text-center font-bold text-slate-300 text-sm md:text-base p-6">
                Mapa de Calor em Tempo Real: <br/> Região ABC Paulista tem <span className="text-red-400">alta demanda de OS fracionada</span> e <span className="text-red-400">baixíssima captação ativa</span> de veículos leves (VUC). Aumente investimento de ADS nesta zona.
             </div>
          </CardContent>
       </Card>
    </div>
  );
}
