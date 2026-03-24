import { DollarSign, CreditCard, ArrowDownCircle, ArrowUpCircle, TrendingUp, Percent, Landmark, PiggyBank } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { kpisFinanceiro, receitaDespesaLucro, faturamentoPorCliente, previstoRealizado, despesasPorCategoria, CORES_GRAFICOS } from "./mockData";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const KpiCard = ({ title, value, icon: Icon, color }: { title: string; value: string; icon: any; color?: string }) => (
  <Card>
    <CardContent className="p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color || "bg-muted"}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{title}</p>
        <p className="text-base font-bold">{value}</p>
      </div>
    </CardContent>
  </Card>
);

const TabFinanceiro = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard title="A faturar" value={fmt(kpisFinanceiro.aFaturar)} icon={DollarSign} color="bg-amber-500" />
      <KpiCard title="Faturado" value={fmt(kpisFinanceiro.faturado)} icon={CreditCard} color="bg-blue-500" />
      <KpiCard title="A receber" value={fmt(kpisFinanceiro.aReceber)} icon={ArrowDownCircle} color="bg-orange-500" />
      <KpiCard title="Recebido" value={fmt(kpisFinanceiro.recebido)} icon={ArrowUpCircle} color="bg-green-500" />
      <KpiCard title="A pagar" value={fmt(kpisFinanceiro.aPagar)} icon={ArrowUpCircle} color="bg-red-500" />
      <KpiCard title="Pago" value={fmt(kpisFinanceiro.pago)} icon={Landmark} color="bg-emerald-600" />
      <KpiCard title="Margem média" value={`${kpisFinanceiro.margemMedia}%`} icon={Percent} color="bg-purple-500" />
      <KpiCard title="Provisão do período" value={fmt(kpisFinanceiro.provisao)} icon={PiggyBank} color="bg-indigo-500" />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Receita × Despesa × Lucro (6 meses)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={receitaDespesaLucro}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="receita" name="Receita" fill={CORES_GRAFICOS[0]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesa" name="Despesa" fill={CORES_GRAFICOS[1]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="lucro" name="Lucro" fill={CORES_GRAFICOS[2]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Faturamento por cliente (top 5)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={faturamentoPorCliente} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
              <XAxis type="number" tickFormatter={(v) => `${(v / 1e3).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="cliente" width={110} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="valor" fill={CORES_GRAFICOS[0]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Previsto × Realizado</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={previstoRealizado}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="previsto" name="Previsto" stroke={CORES_GRAFICOS[1]} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="realizado" name="Realizado" stroke={CORES_GRAFICOS[0]} strokeWidth={2} dot={{ fill: CORES_GRAFICOS[0], r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Despesas por categoria</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={despesasPorCategoria} dataKey="valor" nameKey="categoria" cx="50%" cy="50%" outerRadius={95} label={({ categoria, percent }) => `${categoria} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                {despesasPorCategoria.map((_, i) => <Cell key={i} fill={CORES_GRAFICOS[i]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmt(v)} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  </div>
);

export default TabFinanceiro;
