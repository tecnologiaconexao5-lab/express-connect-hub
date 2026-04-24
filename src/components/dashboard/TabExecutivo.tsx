import { useState, useEffect } from "react";
import { DollarSign, Activity, Users, TrendingUp, UserCheck, CheckCircle2, Receipt, Clock, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/lib/supabase";
import { AniversariantesWidget } from "@/components/comunicacao/AniversariantesWidget";

const CORES_GRAFICOS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

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

const TabExecutivo = () => {
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState(0);
  const [prestadores, setPrestadores] = useState(0);
  const [veiculos, setVeiculos] = useState(0);
  const [osTotal, setOsTotal] = useState(0);
  const [osFinalizadas, setOsFinalizadas] = useState(0);
  const [faturamento, setFaturamento] = useState(0);
  const [osRecentes, setOsRecentes] = useState<any[]>([]);
  const [osPorStatus, setOsPorStatus] = useState<Record<string, number>>({});
  const [osPorVeiculo, setOsPorVeiculo] = useState<{ tipo: string; valor: number }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clientesCount, prestadoresCount, veiculosCount, osData, financeiroData] = await Promise.all([
          supabase.from("clientes").select("id", { count: "exact", head: true }),
          supabase.from("prestadores").select("id", { count: "exact", head: true }),
          supabase.from("veiculos").select("id", { count: "exact", head: true }),
          supabase.from("ordens_servico").select("status, veiculo_tipo, valor_cliente, numero, created_at").order("created_at", { ascending: false }).limit(100),
          supabase.from("financeiro_receber").select("valor")
        ]);

        setClientes(clientesCount.count || 0);
        setPrestadores(prestadoresCount.count || 0);
        setVeiculos(veiculosCount.count || 0);

        if (osData.data) {
          setOsTotal(osData.data.length);
          setOsFinalizadas(osData.data.filter(os => os.status === "finalizada").length);
          
          const statusCount: Record<string, number> = {};
          osData.data.forEach(os => {
            statusCount[os.status || "sem_status"] = (statusCount[os.status || "sem_status"] || 0) + 1;
          });
          setOsPorStatus(statusCount);

          const veiculoCount: Record<string, number> = {};
          osData.data.forEach(os => {
            const tipo = os.veiculo_tipo || "Não informado";
            veiculoCount[tipo] = (veiculoCount[tipo] || 0) + 1;
          });
          const veiculosArray = Object.entries(veiculoCount).map(([tipo, valor]) => ({ tipo, valor }));
          setOsPorVeiculo(veiculosArray);

          setOsRecentes(osData.data.slice(0, 5));
        }

        if (financeiroData.data) {
          const total = financeiroData.data.reduce((acc, item) => acc + (item.valor || 0), 0);
          setFaturamento(total);
        }
      } catch (err) {
        console.error("[TabExecutivo] Erro ao carregar dados:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const ticketMedio = osTotal > 0 ? faturamento / osTotal : 0;

  return (
    <div className="space-y-6">
      <AniversariantesWidget />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Faturamento total" value={fmt(faturamento)} icon={DollarSign} accent trend="up" />
        <KpiCard title="Total de OS" value={fmtN(osTotal)} icon={Activity} trend="up" />
        <KpiCard title="Prestadores" value={fmtN(prestadores)} icon={Users} />
        <KpiCard title="Clientes" value={fmtN(clientes)} icon={TrendingUp} trend="neutral" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiSmall title="Veículos" value={fmtN(veiculos)} icon={UserCheck} subtext="cadastrados" />
        <KpiSmall title="OS finalizadas" value={fmtN(osFinalizadas)} icon={CheckCircle2} subtext={`${osTotal > 0 ? Math.round(osFinalizadas / osTotal * 100) : 0}%`} />
        <KpiSmall title="Ticket médio" value={fmt(ticketMedio)} icon={Receipt} subtext="por OS" />
        <KpiSmall title="Em aberto" value={fmtN(osTotal - osFinalizadas)} icon={Clock} subtext="em andamento" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">OS por Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={Object.entries(osPorStatus).map(([tipo, valor]) => ({ tipo, valor }))} dataKey="valor" nameKey="tipo" cx="50%" cy="50%" outerRadius={95} label={({ tipo, percent }) => `${tipo} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {Object.keys(osPorStatus).map((_, i) => <Cell key={i} fill={CORES_GRAFICOS[i % CORES_GRAFICOS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">OS por Tipo de Veículo</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={osPorVeiculo}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
                <XAxis dataKey="tipo" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="valor" fill={CORES_GRAFICOS[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Últimas OS</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {osRecentes.map((os) => (
                <div key={os.numero} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <div>
                    <span className="font-medium text-sm">{os.numero}</span>
                    <span className="text-xs text-muted-foreground ml-2">| {os.status}</span>
                  </div>
                  <span className="font-semibold text-sm">{fmt(os.valor_cliente || 0)}</span>
                </div>
              ))}
              {osRecentes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma OS encontrada</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TabExecutivo;