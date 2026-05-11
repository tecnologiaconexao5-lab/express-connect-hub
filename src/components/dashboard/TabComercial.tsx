import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, CheckCircle2, XCircle, DollarSign, TrendingUp, Percent, Users, Target, ArrowRight, Loader2, UserPlus, Briefcase, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/lib/supabase";

const CORES = ["#F97316", "#3B82F6", "#10B981", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F59E0B"];
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const ttStyle = { backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))", borderRadius: "8px", fontSize: "12px" };

const KpiCard = ({ title, value, icon: Icon, color, sub, placeholder }: {
  title: string; value: string; icon: any; color?: string; sub?: string; placeholder?: boolean;
}) => {
  const navigate = useNavigate();
  return (
    <Card className="hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-card border-border shadow-sm group relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-1 h-full ${color ?? "bg-primary"} opacity-60 group-hover:opacity-100 transition-opacity`} />
      <CardContent className="p-4 pl-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">{title}</p>
            <p className={`text-xl font-extrabold mt-1 ${placeholder ? "text-muted-foreground" : "text-foreground"}`}>{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
            {placeholder && <Badge variant="outline" className="text-[9px] mt-1 h-4">Em preparação</Badge>}
          </div>
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
            <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const TabComercial = () => {
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState(0);
  const [osData, setOsData] = useState({ total: 0, emAndamento: 0, finalizadas: 0, canceladas: 0, valorTotal: 0 });
  const [clientesTop, setClientesTop] = useState<{ cliente: string; valor: number; os: number }[]>([]);
  const [orcamentos, setOrcamentos] = useState({ total: 0, aprovados: 0, pendentes: 0, reprovados: 0, valorAprovado: 0 });
  const [osPorStatus, setOsPorStatus] = useState<{ etapa: string; valor: number }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clientesData, osRaw, orcRaw] = await Promise.all([
          supabase.from("clientes").select("id", { count: "exact", head: true }),
          supabase.from("ordens_servico").select("status, cliente, valor_cliente").order("created_at", { ascending: false }).limit(300),
          supabase.from("orcamentos").select("status, valor_final").limit(300),
        ]);

        setClientes(clientesData.count || 0);

        if (osRaw.data) {
          const items = osRaw.data;
          const total = items.length;
          const emAndamento = items.filter(o => o.status && !["finalizada", "cancelada"].includes(o.status)).length;
          const finalizadas = items.filter(o => o.status === "finalizada").length;
          const canceladas = items.filter(o => o.status === "cancelada").length;
          const valorTotal = items.reduce((a, o) => a + (o.valor_cliente || 0), 0);
          setOsData({ total, emAndamento, finalizadas, canceladas, valorTotal });

          const sc: Record<string, number> = {};
          items.forEach(o => { sc[o.status || "sem_status"] = (sc[o.status || "sem_status"] || 0) + 1; });
          setOsPorStatus(Object.entries(sc).map(([etapa, valor]) => ({ etapa, valor })).sort((a, b) => b.valor - a.valor).slice(0, 6));

          const cv: Record<string, { valor: number; os: number }> = {};
          items.forEach(o => {
            const c = o.cliente || "Sem cliente";
            if (!cv[c]) cv[c] = { valor: 0, os: 0 };
            cv[c].valor += o.valor_cliente || 0;
            cv[c].os += 1;
          });
          setClientesTop(Object.entries(cv).map(([cliente, d]) => ({ cliente, valor: d.valor, os: d.os })).sort((a, b) => b.valor - a.valor).slice(0, 5));
        }

        if (orcRaw.data) {
          const items = orcRaw.data;
          const aprovados = items.filter(o => o.status === "aprovado").length;
          const pendentes = items.filter(o => o.status === "pendente" || o.status === "aberto").length;
          const reprovados = items.filter(o => o.status === "reprovado" || o.status === "cancelado").length;
          const valorAprovado = items.filter(o => o.status === "aprovado").reduce((a, o) => a + (o.valor_final || 0), 0);
          setOrcamentos({ total: items.length, aprovados, pendentes, reprovados, valorAprovado });
        }
      } catch (err) {
        console.error("[TabComercial]", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const taxaConversao = osData.total > 0 ? ((osData.finalizadas / osData.total) * 100).toFixed(1) : "0";
  const taxaOrc = orcamentos.total > 0 ? ((orcamentos.aprovados / orcamentos.total) * 100).toFixed(1) : "0";

  const pieData = [
    { name: "Aprovados", value: orcamentos.aprovados, color: CORES[2] },
    { name: "Pendentes", value: orcamentos.pendentes, color: CORES[1] },
    { name: "Reprovados", value: orcamentos.reprovados, color: CORES[3] },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* KPIs Clientes */}
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2"><Users className="w-3.5 h-3.5" />Clientes</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <KpiCard title="Total Clientes" value={String(clientes)} icon={Users} color="bg-blue-500" sub="cadastrados" />
          <KpiCard title="Clientes Ativos" value={String(clientes)} icon={CheckCircle2} color="bg-emerald-500" sub="com OS no período" />
          <KpiCard title="Novos no Mês" value="—" icon={UserPlus} color="bg-violet-500" placeholder />
          <KpiCard title="Follow-ups Pend." value="—" icon={Clock} color="bg-amber-500" placeholder />
        </div>
      </div>

      {/* KPIs Propostas */}
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2"><FileText className="w-3.5 h-3.5" />Propostas / Orçamentos</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <KpiCard title="Total Propostas" value={String(orcamentos.total)} icon={FileText} color="bg-blue-500" />
          <KpiCard title="Aprovadas" value={String(orcamentos.aprovados)} icon={CheckCircle2} color="bg-emerald-500" sub={fmt(orcamentos.valorAprovado)} />
          <KpiCard title="Pendentes" value={String(orcamentos.pendentes)} icon={AlertCircle} color="bg-amber-500" />
          <KpiCard title="Taxa Conversão" value={`${taxaOrc}%`} icon={Percent} color="bg-violet-500" sub="propostas aprovadas" />
          <KpiCard title="Oportunidades" value="—" icon={Target} color="bg-indigo-500" placeholder />
        </div>
      </div>

      {/* KPIs Operacional */}
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2"><Briefcase className="w-3.5 h-3.5" />Operacional Comercial</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <KpiCard title="Total OS" value={String(osData.total)} icon={FileText} color="bg-blue-500" />
          <KpiCard title="Em Andamento" value={String(osData.emAndamento)} icon={TrendingUp} color="bg-amber-500" />
          <KpiCard title="Taxa de Conclusão" value={`${taxaConversao}%`} icon={Percent} color="bg-emerald-500" />
          <KpiCard title="Valor Total OS" value={fmt(osData.valorTotal)} icon={DollarSign} color="bg-primary" />
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Valor por Cliente (Top 5)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
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

        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Status dos Orçamentos</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={ttStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-sm">Nenhum orçamento encontrado</p>
                <Badge variant="outline" className="mt-2">Em preparação</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top clientes tabela */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Top Clientes por Receita</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs">#</TableHead>
                <TableHead className="text-xs">Cliente</TableHead>
                <TableHead className="text-xs text-right">Nº OS</TableHead>
                <TableHead className="text-xs text-right">Receita Total</TableHead>
                <TableHead className="text-xs text-right">Ticket Médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientesTop.map((c, i) => (
                <TableRow key={c.cliente} className="hover:bg-muted/20 transition">
                  <TableCell className="text-xs font-bold text-muted-foreground w-8">#{i + 1}</TableCell>
                  <TableCell className="text-sm font-semibold">{c.cliente}</TableCell>
                  <TableCell className="text-xs text-right">{c.os}</TableCell>
                  <TableCell className="text-xs text-right font-mono font-semibold text-emerald-500">{fmt(c.valor)}</TableCell>
                  <TableCell className="text-xs text-right font-mono text-muted-foreground">{fmt(c.os > 0 ? c.valor / c.os : 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default TabComercial;