import { Card, CardContent } from "@/components/ui/card";
import { Users, FileText, CheckCircle2, TrendingUp, Clock } from "lucide-react";

export default function DashboardComercial() {
  const kpis = {
    leadsNovos: 12,
    propostasAbertas: 8,
    taxaConversao: 35.5,
    receitaPotencial: 45000,
    followUpsPendentes: 5
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      <Card className="border-l-4 border-l-blue-500 shadow-sm">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase">Leads Novos</p>
            <p className="text-2xl font-extrabold text-blue-600">{kpis.leadsNovos}</p>
          </div>
          <div className="p-2 bg-blue-50 rounded-full"><Users className="w-5 h-5 text-blue-500" /></div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-amber-500 shadow-sm">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase">Propostas</p>
            <p className="text-2xl font-extrabold text-amber-600">{kpis.propostasAbertas}</p>
          </div>
          <div className="p-2 bg-amber-50 rounded-full"><FileText className="w-5 h-5 text-amber-500" /></div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-emerald-500 shadow-sm">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase">Conversão</p>
            <p className="text-2xl font-extrabold text-emerald-600">{kpis.taxaConversao}%</p>
          </div>
          <div className="p-2 bg-emerald-50 rounded-full"><CheckCircle2 className="w-5 h-5 text-emerald-500" /></div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-violet-500 shadow-sm">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase">Receita Ptp.</p>
            <p className="text-xl font-extrabold text-violet-600">{fmt(kpis.receitaPotencial)}</p>
          </div>
          <div className="p-2 bg-violet-50 rounded-full"><TrendingUp className="w-5 h-5 text-violet-500" /></div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-rose-500 shadow-sm">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase">Follow-up Pend.</p>
            <p className="text-2xl font-extrabold text-rose-600">{kpis.followUpsPendentes}</p>
          </div>
          <div className="p-2 bg-rose-50 rounded-full"><Clock className="w-5 h-5 text-rose-500" /></div>
        </CardContent>
      </Card>
    </div>
  );
}
