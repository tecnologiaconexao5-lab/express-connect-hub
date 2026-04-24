import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DollarSign, CreditCard, ArrowDownCircle, ArrowUpCircle, Percent, Landmark, PiggyBank, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "@/lib/supabase";

const CORES_GRAFICOS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const KpiCard = ({ title, value, icon: Icon, color, to }: { title: string; value: string; icon: any; color?: string; to?: string }) => {
  const navigate = useNavigate();
  return (
    <Card className="cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-card border-border" onClick={() => to && navigate(to)}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{title}</p>
          <p className="text-base font-bold text-foreground truncate">{value}</p>
        </div>
        {to && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
      </CardContent>
    </Card>
  );
};

const TabFinanceiro = () => {
  const [loading, setLoading] = useState(true);
  const [financeiro, setFinanceiro] = useState({
    aFaturar: 0,
    faturado: 0,
    aReceber: 0,
    recebido: 0,
    aPagar: 0,
    pago: 0,
    totalOS: 0,
    valorTotalOS: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [osData, receberData, pagarData] = await Promise.all([
          supabase.from("ordens_servico").select("valor_cliente, status_faturamento"),
          supabase.from("financeiro_receber").select("valor, status"),
          supabase.from("financeiro_pagar").select("valor, status")
        ]);

        const osItems = osData.data || [];
        const valorTotalOS = osItems.reduce((acc, os) => acc + (os.valor_cliente || 0), 0);
        const aFaturar = osItems.filter(os => os.status_faturamento === "a faturar").reduce((acc, os) => acc + (os.valor_cliente || 0), 0);
        const faturado = osItems.filter(os => os.status_faturamento === "faturada").reduce((acc, os) => acc + (os.valor_cliente || 0), 0);

        const receberItems = receberData.data || [];
        const aReceber = receberItems.filter(item => item.status === "aberto" || item.status === "a vencer").reduce((acc, item) => acc + (item.valor || 0), 0);
        const recebido = receberItems.filter(item => item.status === "pago" || item.status === "recebido").reduce((acc, item) => acc + (item.valor || 0), 0);

        const pagarItems = pagarData.data || [];
        const aPagar = pagarItems.filter(item => item.status === "aberto" || item.status === "a vencer").reduce((acc, item) => acc + (item.valor || 0), 0);
        const pago = pagarItems.filter(item => item.status === "pago" || item.status === "quitado").reduce((acc, item) => acc + (item.valor || 0), 0);

        setFinanceiro({
          aFaturar,
          faturado,
          aReceber,
          recebido,
          aPagar,
          pago,
          totalOS: osItems.length,
          valorTotalOS
        });
      } catch (err) {
        console.error("[TabFinanceiro] Erro ao carregar dados:", err);
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

  const lucro = financeiro.recebido - financeiro.pago;
  const margem = financeiro.recebido > 0 ? ((lucro / financeiro.recebido) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total OS" value={financeiro.totalOS.toString()} icon={DollarSign} color="bg-amber-500" to="/financeiro" />
        <KpiCard title="Valor total OS" value={fmt(financeiro.valorTotalOS)} icon={CreditCard} color="bg-blue-500" to="/financeiro" />
        <KpiCard title="A receber" value={fmt(financeiro.aReceber)} icon={ArrowDownCircle} color="bg-orange-500" to="/financeiro" />
        <KpiCard title="Recebido" value={fmt(financeiro.recebido)} icon={ArrowUpCircle} color="bg-green-500" to="/financeiro" />
        <KpiCard title="A pagar" value={fmt(financeiro.aPagar)} icon={ArrowUpCircle} color="bg-red-500" to="/financeiro" />
        <KpiCard title="Pago" value={fmt(financeiro.pago)} icon={Landmark} color="bg-emerald-600" to="/financeiro" />
        <KpiCard title="Lucro" value={fmt(lucro)} icon={Percent} color="bg-purple-500" to="/financeiro" />
        <KpiCard title="Margem" value={`${margem.toFixed(1)}%`} icon={PiggyBank} color="bg-indigo-500" to="/financeiro" />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Resumo Financeiro</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[
              { nome: "A Receber", valor: financeiro.aReceber },
              { nome: "Recebido", valor: financeiro.recebido },
              { nome: "A Pagar", valor: financeiro.aPagar },
              { nome: "Pago", valor: financeiro.pago },
              { nome: "Lucro", valor: lucro }
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
              <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${(v / 1e3).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="valor" fill={CORES_GRAFICOS[0]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default TabFinanceiro;