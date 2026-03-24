import { FileText, CheckCircle2, XCircle, DollarSign, TrendingUp, Percent } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { kpisComercial, funilComercial, valorPorCliente, conversoesSemana, motivosPerda, CORES_GRAFICOS } from "./mockData";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const KpiCard = ({ title, value, icon: Icon }: { title: string; value: string; icon: any }) => (
  <Card>
    <CardContent className="p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{title}</p>
        <p className="text-lg font-bold">{value}</p>
      </div>
    </CardContent>
  </Card>
);

const TabComercial = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <KpiCard title="Orçamentos emitidos" value={String(kpisComercial.orcamentosEmitidos)} icon={FileText} />
      <KpiCard title="Aprovados" value={String(kpisComercial.aprovados)} icon={CheckCircle2} />
      <KpiCard title="Perdidos" value={String(kpisComercial.perdidos)} icon={XCircle} />
      <KpiCard title="Valor orçado" value={fmt(kpisComercial.valorOrcado)} icon={DollarSign} />
      <KpiCard title="Valor convertido" value={fmt(kpisComercial.valorConvertido)} icon={TrendingUp} />
      <KpiCard title="Taxa de conversão" value={`${kpisComercial.taxaConversao}%`} icon={Percent} />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Funil comercial</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={funilComercial}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
              <XAxis dataKey="etapa" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                {funilComercial.map((_, i) => <Cell key={i} fill={CORES_GRAFICOS[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Valor por cliente (top 5)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={valorPorCliente} layout="vertical">
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
        <CardHeader className="pb-2"><CardTitle className="text-sm">Conversões por semana</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={conversoesSemana}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
              <XAxis dataKey="semana" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="conversoes" stroke={CORES_GRAFICOS[0]} strokeWidth={2} dot={{ fill: CORES_GRAFICOS[0], r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Motivos de perda</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={motivosPerda} dataKey="valor" nameKey="motivo" cx="50%" cy="50%" outerRadius={90} label={({ motivo, percent }) => `${motivo} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                {motivosPerda.map((_, i) => <Cell key={i} fill={CORES_GRAFICOS[i]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  </div>
);

export default TabComercial;
