import { DollarSign, Activity, Users, TrendingUp, UserCheck, CheckCircle2, Receipt, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { kpisExecutivo, faturamentoMensal, operacoesSemana, operacoesTipoVeiculo, topClientes, CORES_GRAFICOS } from "./mockData";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtN = (v: number) => v.toLocaleString("pt-BR");

const KpiCard = ({ title, value, icon: Icon, accent = false }: { title: string; value: string; icon: any; accent?: boolean }) => (
  <Card className={accent ? "border-primary/30 bg-primary/5" : ""}>
    <CardContent className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accent ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const KpiSmall = ({ title, value, icon: Icon }: { title: string; value: string; icon: any }) => (
  <Card>
    <CardContent className="p-4 flex items-center gap-3">
      <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{title}</p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
    </CardContent>
  </Card>
);

const TabExecutivo = () => (
  <div className="space-y-6">
    {/* Linha 1 — 4 KPIs grandes */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard title="Faturamento do mês" value={fmt(kpisExecutivo.faturamentoMes)} icon={DollarSign} accent />
      <KpiCard title="Total de operações" value={fmtN(kpisExecutivo.totalOperacoes)} icon={Activity} />
      <KpiCard title="Prestadores ativos" value={fmtN(kpisExecutivo.prestadoresAtivos)} icon={Users} />
      <KpiCard title="Margem média" value={`${kpisExecutivo.margemMedia}%`} icon={TrendingUp} />
    </div>

    {/* Linha 2 — 4 KPIs menores */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiSmall title="Clientes ativos" value={fmtN(kpisExecutivo.clientesAtivos)} icon={UserCheck} />
      <KpiSmall title="Ordens concluídas" value={fmtN(kpisExecutivo.ordensConcluidas)} icon={CheckCircle2} />
      <KpiSmall title="Ticket médio" value={fmt(kpisExecutivo.ticketMedio)} icon={Receipt} />
      <KpiSmall title="Entrega no prazo" value={`${kpisExecutivo.entregaNoPrazo}%`} icon={Clock} />
    </div>

    {/* Linha 3 — 2 gráficos */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Faturamento por mês</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={faturamentoMensal}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="valor" fill={CORES_GRAFICOS[0]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Evolução de operações por semana</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={operacoesSemana}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
              <XAxis dataKey="semana" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="operacoes" stroke={CORES_GRAFICOS[0]} strokeWidth={2} dot={{ fill: CORES_GRAFICOS[0], r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>

    {/* Linha 4 — 2 gráficos */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Operações por tipo de veículo</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={operacoesTipoVeiculo} dataKey="valor" nameKey="tipo" cx="50%" cy="50%" outerRadius={95} label={({ tipo, percent }) => `${tipo} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                {operacoesTipoVeiculo.map((_, i) => <Cell key={i} fill={CORES_GRAFICOS[i % CORES_GRAFICOS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Top 5 clientes por volume</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topClientes} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="cliente" width={110} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="volume" fill={CORES_GRAFICOS[1]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  </div>
);

export default TabExecutivo;
