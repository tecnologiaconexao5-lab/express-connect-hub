import { DollarSign, Activity, Users, TrendingUp, UserCheck, CheckCircle2, Receipt, Clock, TrendingDown, Package, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { kpisExecutivo, faturamentoMensal, operacoesSemana, operacoesTipoVeiculo, topClientes, CORES_GRAFICOS } from "./mockData";
import { AniversariantesWidget } from "@/components/comunicacao/AniversariantesWidget";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtN = (v: number) => v.toLocaleString("pt-BR");

const KpiCard = ({ title, value, icon: Icon, accent = false, trend }: { title: string; value: string; icon: any; accent?: boolean; trend?: "up" | "down" | "neutral" }) => (
  <Card className={`relative overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 ${accent ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700 shadow-xl" : "border-border/50 bg-card shadow-sm hover:shadow-md"}`}>
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <p className={`text-xs font-semibold uppercase tracking-wider ${accent ? "text-slate-300" : "text-muted-foreground"}`}>{title}</p>
          <p className={`text-3xl font-extrabold tracking-tight ${accent ? "text-white" : "text-foreground"}`}>{value}</p>
          {trend && (
            <div className={`flex items-center gap-1 text-xs ${trend === "up" ? "text-emerald-400" : trend === "down" ? "text-rose-400" : "text-slate-400"}`}>
              {trend === "up" ? <TrendingUp className="w-3 h-3" /> : trend === "down" ? <TrendingDown className="w-3 h-3" /> : null}
              <span>{trend === "up" ? "+12%" : trend === "down" ? "-5%" : "0%"}</span>
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${accent ? "bg-white/10 text-white" : "bg-primary/10 text-primary"}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </CardContent>
    {accent && <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent pointer-events-none" />}
  </Card>
);

const KpiSmall = ({ title, value, icon: Icon, subtext }: { title: string; value: string; icon: any; subtext?: string }) => (
  <Card className="border-border/40 bg-gradient-to-br from-card to-card/80 shadow-sm hover:shadow-md transition-all">
    <CardContent className="p-4 flex items-center gap-4">
      <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide truncate">{title}</p>
        <p className="text-xl font-bold text-foreground leading-none mt-1 truncate">{value}</p>
        {subtext && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{subtext}</p>}
      </div>
    </CardContent>
  </Card>
);

const TabExecutivo = () => (
  <div className="space-y-6">
    <AniversariantesWidget />

    {/* Linha 1 — 4 KPIs grandes Premium */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard title="Faturamento do mês" value={fmt(kpisExecutivo.faturamentoMes)} icon={DollarSign} accent trend="up" />
      <KpiCard title="Total de operações" value={fmtN(kpisExecutivo.totalOperacoes)} icon={Activity} trend="up" />
      <KpiCard title="Prestadores ativos" value={fmtN(kpisExecutivo.prestadoresAtivos)} icon={Users} />
      <KpiCard title="Margem média" value={`${kpisExecutivo.margemMedia}%`} icon={TrendingUp} trend="neutral" />
    </div>

    {/* Linha 2 — 4 KPIs menores */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiSmall title="Clientes ativos" value={fmtN(kpisExecutivo.clientesAtivos)} icon={UserCheck} subtext="+3 novos" />
      <KpiSmall title="Ordens concluídas" value={fmtN(kpisExecutivo.ordensConcluidas)} icon={CheckCircle2} subtext="98% aprovação" />
      <KpiSmall title="Ticket médio" value={fmt(kpisExecutivo.ticketMedio)} icon={Receipt} subtext="por operação" />
      <KpiSmall title="Entrega no prazo" value={`${kpisExecutivo.entregaNoPrazo}%`} icon={Clock} subtext="meta: 95%" />
    </div>

    {/* Linha 3 — 2 gráficos */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Faturamento por mês</CardTitle></CardHeader>
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

      <Card className="shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Evolução de operações por semana</CardTitle></CardHeader>
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
      <Card className="shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Operações por tipo de veículo</CardTitle></CardHeader>
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

      <Card className="shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Top 5 clientes por volume</CardTitle></CardHeader>
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
