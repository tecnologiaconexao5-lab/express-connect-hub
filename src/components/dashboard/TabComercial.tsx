import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, CheckCircle2, XCircle, DollarSign, TrendingUp, Percent, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/lib/supabase";

const CORES_GRAFICOS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const KpiCard = ({ title, value, icon: Icon, to }: { title: string; value: string; icon: any; to?: string }) => {
  const navigate = useNavigate();
  return (
    <Card className="cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-card border-border" onClick={() => to && navigate(to)}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{title}</p>
          <p className="text-lg font-bold text-foreground truncate">{value}</p>
        </div>
        {to && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
      </CardContent>
    </Card>
  );
};

const TabComercial = () => {
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState(0);
  const [prestadores, setPrestadores] = useState(0);
  const [osData, setOsData] = useState({
    total: 0,
    emAndamento: 0,
    finalizadas: 0,
    canceladas: 0,
    valorTotal: 0
  });
  const [osPorStatus, setOsPorStatus] = useState<{ etapa: string; valor: number }[]>([]);
  const [clientesTop, setClientesTop] = useState<{ cliente: string; valor: number }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clientesData, prestadoresData, osRaw, orcamentosData] = await Promise.all([
          supabase.from("clientes").select("id", { count: "exact", head: true }),
          supabase.from("prestadores").select("id", { count: "exact", head: true }),
          supabase.from("ordens_servico").select("status, cliente, valor_cliente").order("created_at", { ascending: false }).limit(100),
          supabase.from("orcamentos").select("status, valor_final").order("created_at", { ascending: false }).limit(100)
        ]);

        setClientes(clientesData.count || 0);
        setPrestadores(prestadoresData.count || 0);

        if (osRaw.data) {
          const osItems = osRaw.data;
          const total = osItems.length;
          const emAndamento = osItems.filter(os => os.status && !["finalizada", "cancelada"].includes(os.status)).length;
          const finalizadas = osItems.filter(os => os.status === "finalizada").length;
          const canceladas = osItems.filter(os => os.status === "cancelada").length;
          const valorTotal = osItems.reduce((acc, os) => acc + (os.valor_cliente || 0), 0);

          setOsData({ total, emAndamento, finalizadas, canceladas, valorTotal });

          const statusCount: Record<string, number> = {};
          osItems.forEach(os => {
            const status = os.status || "sem_status";
            statusCount[status] = (statusCount[status] || 0) + 1;
          });
          const statusArray = Object.entries(statusCount).map(([etapa, valor]) => ({ etapa, valor }));
          statusArray.sort((a, b) => b.valor - a.valor);
          setOsPorStatus(statusArray.slice(0, 6));

          const clienteValor: Record<string, number> = {};
          osItems.forEach(os => {
            const cliente = os.cliente || "Sem cliente";
            clienteValor[cliente] = (clienteValor[cliente] || 0) + (os.valor_cliente || 0);
          });
          const clienteArray = Object.entries(clienteValor)
            .map(([cliente, valor]) => ({ cliente, valor }))
            .sort((a, b) => b.valor - a.valor)
            .slice(0, 5);
          setClientesTop(clienteArray);
        }
      } catch (err) {
        console.error("[TabComercial] Erro ao carregar dados:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const taxaConversao = osData.total > 0 ? ((osData.finalizadas / osData.total) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard title="Total Clientes" value={String(clientes)} icon={FileText} to="/clientes" />
        <KpiCard title="Total Prestadores" value={String(prestadores)} icon={CheckCircle2} to="/prestadores" />
        <KpiCard title="Total OS" value={String(osData.total)} icon={XCircle} to="/operacao" />
        <KpiCard title="Em Andamento" value={String(osData.emAndamento)} icon={DollarSign} to="/operacao" />
        <KpiCard title="Finalizadas" value={String(osData.finalizadas)} icon={TrendingUp} to="/operacao" />
        <KpiCard title="Taxa Conclusão" value={`${taxaConversao}%`} icon={Percent} to="/operacao" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">OS por status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={osPorStatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
                <XAxis dataKey="etapa" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                  {osPorStatus.map((_, i) => <Cell key={i} fill={CORES_GRAFICOS[i % CORES_GRAFICOS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Valor por cliente (top 5)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={clientesTop} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
                <XAxis type="number" tickFormatter={(v) => `${(v / 1e3).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="cliente" width={110} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="valor" fill={CORES_GRAFICOS[0]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Resumo Operacional</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground">Valor Total OS</p>
              <p className="text-xl font-bold">{fmt(osData.valorTotal)}</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground">Em Andamento</p>
              <p className="text-xl font-bold">{osData.emAndamento}</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground">Finalizadas</p>
              <p className="text-xl font-bold">{osData.finalizadas}</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground">Canceladas</p>
              <p className="text-xl font-bold">{osData.canceladas}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TabComercial;