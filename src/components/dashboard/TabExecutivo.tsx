import { useState, useEffect } from "react";
import { DollarSign, Activity, Users, TrendingUp, UserCheck, CheckCircle2, Receipt, Clock, TrendingDown, AlertTriangle, Target, Loader2, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, Area } from "recharts";
import { supabase } from "@/lib/supabase";
import { AniversariantesWidget } from "@/components/comunicacao/AniversariantesWidget";

const CORES = ["#F97316", "#3B82F6", "#10B981", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F59E0B"];
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtN = (v: number) => v.toLocaleString("pt-BR");

const ttStyle = { backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))", borderRadius: "8px", fontSize: "12px" };

type Trend = "up" | "down" | "neutral";

const KpiCard = ({ title, value, icon: Icon, trend, sub, accent }: {
  title: string; value: string; icon: any; trend?: Trend; sub?: string; accent?: string;
}) => (
  <Card className="relative overflow-hidden border-border/50 bg-card shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5 group">
    <div className={`absolute top-0 left-0 right-0 h-0.5 ${accent ?? "bg-primary/40"} group-hover:opacity-100 opacity-60 transition-opacity`} />
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="text-2xl font-extrabold tracking-tight text-foreground">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
          {trend && (
            <div className={`flex items-center gap-1 text-xs ${trend === "up" ? "text-emerald-500" : trend === "down" ? "text-rose-500" : "text-muted-foreground"}`}>
              {trend === "up" ? <TrendingUp className="w-3 h-3" /> : trend === "down" ? <TrendingDown className="w-3 h-3" /> : null}
              <span>{trend === "up" ? "Em alta" : trend === "down" ? "Em queda" : "Estável"}</span>
            </div>
          )}
        </div>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors shrink-0">
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const TabExecutivo = () => {
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState(0);
  const [prestadores, setPrestadores] = useState(0);
  const [veiculos, setVeiculos] = useState(0);
  const [osTotal, setOsTotal] = useState(0);
  const [osFinalizadas, setOsFinalizadas] = useState(0);
  const [osEmAberto, setOsEmAberto] = useState(0);
  const [faturamento, setFaturamento] = useState(0);
  const [custoTotal, setCustoTotal] = useState(0);
  const [osPorStatus, setOsPorStatus] = useState<{ tipo: string; valor: number }[]>([]);
  const [osPorVeiculo, setOsPorVeiculo] = useState<{ tipo: string; valor: number }[]>([]);
  const [clientesTop, setClientesTop] = useState<{ cliente: string; valor: number }[]>([]);
  const [evolucaoMensal, setEvolucaoMensal] = useState<{ mes: string; receita: number; custo: number; margem: number }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clientesCount, prestadoresCount, veiculosCount, osData, receberData, pagarData] = await Promise.all([
          supabase.from("clientes").select("id", { count: "exact", head: true }),
          supabase.from("prestadores").select("id", { count: "exact", head: true }),
          supabase.from("veiculos").select("id", { count: "exact", head: true }),
          supabase.from("ordens_servico").select("status, veiculo_tipo, valor_cliente, custo_prestador, cliente, numero, created_at").order("created_at", { ascending: false }).limit(300),
          supabase.from("financeiro_receber").select("valor"),
          supabase.from("financeiro_pagar").select("valor"),
        ]);

        setClientes(clientesCount.count || 0);
        setPrestadores(prestadoresCount.count || 0);
        setVeiculos(veiculosCount.count || 0);

        if (osData.data) {
          const items = osData.data;
          setOsTotal(items.length);
          const fin = items.filter(o => o.status === "finalizada").length;
          setOsFinalizadas(fin);
          setOsEmAberto(items.filter(o => o.status && !["finalizada", "cancelada"].includes(o.status)).length);

          const receita = items.reduce((a, o) => a + (o.valor_cliente || 0), 0);
          const custo = items.reduce((a, o) => a + (o.custo_prestador || 0), 0);
          setFaturamento(receita);
          setCustoTotal(custo);

          // OS por status
          const sc: Record<string, number> = {};
          items.forEach(o => { sc[o.status || "sem_status"] = (sc[o.status || "sem_status"] || 0) + 1; });
          setOsPorStatus(Object.entries(sc).map(([tipo, valor]) => ({ tipo, valor })).sort((a, b) => b.valor - a.valor).slice(0, 8));

          // OS por veiculo
          const vc: Record<string, number> = {};
          items.forEach(o => { const t = o.veiculo_tipo || "N/I"; vc[t] = (vc[t] || 0) + 1; });
          setOsPorVeiculo(Object.entries(vc).map(([tipo, valor]) => ({ tipo, valor })).sort((a, b) => b.valor - a.valor).slice(0, 6));

          // Top 5 clientes
          const cv: Record<string, number> = {};
          items.forEach(o => { const c = o.cliente || "Sem cliente"; cv[c] = (cv[c] || 0) + (o.valor_cliente || 0); });
          setClientesTop(Object.entries(cv).map(([cliente, valor]) => ({ cliente, valor })).sort((a, b) => b.valor - a.valor).slice(0, 5));

          // Evolução mensal (últimos 6 meses)
          const mesMap: Record<string, { r: number; c: number }> = {};
          const hoje = new Date();
          for (let i = 5; i >= 0; i--) {
            const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            mesMap[key] = { r: 0, c: 0 };
          }
          items.forEach(o => {
            const mes = o.created_at?.slice(0, 7);
            if (mes && mesMap[mes]) {
              mesMap[mes].r += o.valor_cliente || 0;
              mesMap[mes].c += o.custo_prestador || 0;
            }
          });
          const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
          setEvolucaoMensal(Object.entries(mesMap).map(([key, val]) => {
            const m = parseInt(key.split("-")[1]) - 1;
            return { mes: meses[m], receita: val.r, custo: val.c, margem: val.r - val.c };
          }));
        }
      } catch (err) {
        console.error("[TabExecutivo] Erro:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const ticketMedio = osTotal > 0 ? faturamento / osTotal : 0;
  const margemLiq = faturamento > 0 ? ((faturamento - custoTotal) / faturamento * 100) : 0;
  const slaPct = osTotal > 0 ? Math.round((osFinalizadas / osTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      <AniversariantesWidget />

      {/* KPIs Principais — 4 colunas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Faturamento Total" value={fmt(faturamento)} icon={DollarSign} trend="up" accent="bg-emerald-500/60" />
        <KpiCard title="Custo Total" value={fmt(custoTotal)} icon={TrendingDown} accent="bg-rose-500/60" />
        <KpiCard title="Margem Líquida" value={`${margemLiq.toFixed(1)}%`} icon={Target} trend={margemLiq > 15 ? "up" : "down"} accent="bg-violet-500/60" />
        <KpiCard title="Ticket Médio" value={fmt(ticketMedio)} icon={Receipt} sub="por OS" accent="bg-blue-500/60" />
      </div>

      {/* KPIs Secundários — 4 colunas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
        <KpiCard title="Total de OS" value={fmtN(osTotal)} icon={Activity} trend="up" />
        <KpiCard title="OS Finalizadas" value={fmtN(osFinalizadas)} icon={CheckCircle2} sub={`${slaPct}% do total`} />
        <KpiCard title="OS em Aberto" value={fmtN(osEmAberto)} icon={Clock} />
        <KpiCard title="SLA no Prazo" value={`${slaPct}%`} icon={Star} trend={slaPct >= 80 ? "up" : "down"} />
      </div>

      {/* KPIs Cadastrais */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard title="Clientes Ativos" value={fmtN(clientes)} icon={Users} />
        <KpiCard title="Prestadores" value={fmtN(prestadores)} icon={UserCheck} />
        <KpiCard title="Veículos" value={fmtN(veiculos)} icon={TrendingUp} />
      </div>

      {/* Gráfico Evolução Mensal */}
      <Card className="shadow-sm hover:shadow-md transition">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Evolução Mensal — Receita × Custo × Margem
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={evolucaoMensal}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tickFormatter={(v) => `${(v / 1e3).toFixed(0)}k`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={ttStyle} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Area type="monotone" dataKey="receita" name="Receita" fill={CORES[2] + "33"} stroke={CORES[2]} strokeWidth={2} />
              <Area type="monotone" dataKey="custo" name="Custo" fill={CORES[3] + "33"} stroke={CORES[3]} strokeWidth={2} />
              <Line type="monotone" dataKey="margem" name="Margem" stroke={CORES[0]} strokeWidth={2.5} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top 5 Clientes + Top Veículos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="shadow-sm hover:shadow-md transition">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Top 5 Clientes por Faturamento</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={clientesTop} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tickFormatter={(v) => `${(v / 1e3).toFixed(0)}k`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis type="category" dataKey="cliente" width={120} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={ttStyle} />
                <Bar dataKey="valor" fill={CORES[0]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">OS por Tipo de Veículo</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={osPorVeiculo}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="tipo" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={ttStyle} />
                <Bar dataKey="valor" name="OS" radius={[4, 4, 0, 0]}>
                  {osPorVeiculo.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TabExecutivo;