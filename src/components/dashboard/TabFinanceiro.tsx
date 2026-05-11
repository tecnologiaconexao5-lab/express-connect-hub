import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DollarSign, CreditCard, ArrowDownCircle, ArrowUpCircle, Percent, Landmark, PiggyBank, Loader2, TrendingUp, TrendingDown, AlertTriangle, CalendarDays, CheckCircle2, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { supabase } from "@/lib/supabase";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtFull = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const CORES = ["#10B981", "#3B82F6", "#EF4444", "#F97316", "#8B5CF6", "#F59E0B"];
const ttStyle = { backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))", borderRadius: "8px", fontSize: "12px" };

const KpiCard = ({ title, value, icon: Icon, colorClass, sub, trend, navigate: nav, to }: {
  title: string; value: string; icon: any; colorClass: string; sub?: string; trend?: "up" | "down"; navigate?: any; to?: string;
}) => (
  <Card
    className={`hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-card border-border shadow-sm relative overflow-hidden cursor-pointer group`}
    onClick={() => nav && to && nav(to)}
  >
    <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity ${colorClass.replace("text-", "bg-")}`} />
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">{title}</p>
          <p className="text-xl font-extrabold text-foreground mt-1 truncate">{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
          {trend && (
            <div className={`flex items-center gap-1 text-xs mt-1 ${trend === "up" ? "text-emerald-500" : "text-rose-500"}`}>
              {trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{trend === "up" ? "Positivo" : "Atenção"}</span>
            </div>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-opacity-10 ${colorClass.replace("text-", "bg-").replace("-500", "-500/15").replace("-600", "-600/15")}`}>
          <Icon className={`w-5 h-5 ${colorClass}`} />
        </div>
      </div>
    </CardContent>
  </Card>
);

const TabFinanceiro = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [financeiro, setFinanceiro] = useState({
    aFaturar: 0, faturado: 0,
    aReceber: 0, recebido: 0,
    aPagar: 0, pago: 0,
    totalOS: 0, valorTotalOS: 0
  });
  const [vencimentos, setVencimentos] = useState<any[]>([]);
  const [composicao, setComposicao] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [osData, receberData, pagarData, composicaoData] = await Promise.all([
          supabase.from("ordens_servico").select("valor_cliente, custo_prestador, status_faturamento"),
          supabase.from("financeiro_receber").select("valor, status, vencimento, descricao").order("vencimento", { ascending: true }).limit(100),
          supabase.from("financeiro_pagar").select("valor, status, vencimento, descricao").order("vencimento", { ascending: true }).limit(100),
          supabase.from("composicao_financeira_os").select("valor_cliente, custo_prestador, margem").limit(100),
        ]);

        const osItems = osData.data || [];
        const valorTotalOS = osItems.reduce((a, o) => a + (o.valor_cliente || 0), 0);
        const aFaturar = osItems.filter(o => o.status_faturamento === "a faturar").reduce((a, o) => a + (o.valor_cliente || 0), 0);
        const faturado = osItems.filter(o => o.status_faturamento === "faturada").reduce((a, o) => a + (o.valor_cliente || 0), 0);

        const recItems = receberData.data || [];
        const aReceber = recItems.filter(i => i.status === "aberto" || i.status === "a vencer").reduce((a, i) => a + (i.valor || 0), 0);
        const recebido = recItems.filter(i => i.status === "pago" || i.status === "recebido").reduce((a, i) => a + (i.valor || 0), 0);

        const pagItems = pagarData.data || [];
        const aPagar = pagItems.filter(i => i.status === "aberto" || i.status === "a vencer").reduce((a, i) => a + (i.valor || 0), 0);
        const pago = pagItems.filter(i => i.status === "pago" || i.status === "quitado").reduce((a, i) => a + (i.valor || 0), 0);

        setFinanceiro({ aFaturar, faturado, aReceber, recebido, aPagar, pago, totalOS: osItems.length, valorTotalOS });

        // Próximos vencimentos (a receber + a pagar, ordenados)
        const hoje = new Date().toISOString().split("T")[0];
        const vcRec = recItems.filter(i => i.status !== "pago" && i.status !== "recebido" && i.vencimento >= hoje).slice(0, 5).map(i => ({ ...i, tipo: "receber" }));
        const vcPag = pagItems.filter(i => i.status !== "pago" && i.status !== "quitado" && i.vencimento >= hoje).slice(0, 5).map(i => ({ ...i, tipo: "pagar" }));
        const vcAll = [...vcRec, ...vcPag].sort((a, b) => (a.vencimento ?? "").localeCompare(b.vencimento ?? "")).slice(0, 8);
        setVencimentos(vcAll);

        // Composição para gráfico
        if (composicaoData.data && composicaoData.data.length > 0) {
          setComposicao(composicaoData.data.slice(0, 12).map((c, i) => ({
            id: `OS ${i + 1}`,
            receita: c.valor_cliente || 0,
            custo: c.custo_prestador || 0,
            margem: c.margem || 0,
          })));
        }
      } catch (err) {
        console.error("[TabFinanceiro]", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const lucroB = financeiro.recebido - financeiro.pago;
  const margemPct = financeiro.recebido > 0 ? ((lucroB / financeiro.recebido) * 100) : 0;
  const inadimplencia = financeiro.aReceber > 0 ? ((financeiro.aReceber / (financeiro.aReceber + financeiro.recebido)) * 100) : 0;
  const saldoProjetado = financeiro.aReceber - financeiro.aPagar;
  const custoMedioOS = financeiro.totalOS > 0 ? financeiro.valorTotalOS / financeiro.totalOS : 0;

  const barData = [
    { nome: "A Receber", valor: financeiro.aReceber, fill: CORES[1] },
    { nome: "Recebido", valor: financeiro.recebido, fill: CORES[0] },
    { nome: "A Pagar", valor: financeiro.aPagar, fill: CORES[2] },
    { nome: "Pago", valor: financeiro.pago, fill: CORES[3] },
    { nome: "Lucro", valor: lucroB, fill: CORES[4] },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs Receber */}
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2"><ArrowDownCircle className="w-3.5 h-3.5 text-emerald-500" />A Receber / Recebido</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Valor Total OS" value={fmt(financeiro.valorTotalOS)} icon={DollarSign} colorClass="text-blue-500" to="/financeiro" navigate={navigate} />
          <KpiCard title="A Receber" value={fmt(financeiro.aReceber)} icon={ArrowDownCircle} colorClass="text-amber-500" trend="down" />
          <KpiCard title="Recebido" value={fmt(financeiro.recebido)} icon={CheckCircle2} colorClass="text-emerald-500" trend="up" />
          <KpiCard title="A Faturar" value={fmt(financeiro.aFaturar)} icon={FileText} colorClass="text-violet-500" sub="em carteira" />
        </div>
      </div>

      {/* KPIs Pagar */}
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2"><ArrowUpCircle className="w-3.5 h-3.5 text-rose-500" />A Pagar / Pago</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="A Pagar" value={fmt(financeiro.aPagar)} icon={ArrowUpCircle} colorClass="text-rose-500" trend="down" />
          <KpiCard title="Pago" value={fmt(financeiro.pago)} icon={Landmark} colorClass="text-emerald-600" />
          <KpiCard title="Lucro Bruto" value={fmt(lucroB)} icon={PiggyBank} colorClass={lucroB >= 0 ? "text-emerald-500" : "text-rose-500"} trend={lucroB >= 0 ? "up" : "down"} />
          <KpiCard title="Margem Líquida" value={`${margemPct.toFixed(1)}%`} icon={Percent} colorClass={margemPct >= 15 ? "text-emerald-500" : "text-amber-500"} />
        </div>
      </div>

      {/* KPIs Gestão */}
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5 text-primary" />Gestão Financeira</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Custo Médio por OS" value={fmt(custoMedioOS)} icon={CreditCard} colorClass="text-blue-500" sub={`${financeiro.totalOS} OS no período`} />
          <KpiCard title="Inadimplência" value={`${inadimplencia.toFixed(1)}%`} icon={AlertTriangle} colorClass={inadimplencia > 20 ? "text-rose-500" : "text-amber-500"} trend={inadimplencia > 20 ? "down" : "up"} />
          <KpiCard title="Saldo Projetado" value={fmt(saldoProjetado)} icon={TrendingUp} colorClass={saldoProjetado >= 0 ? "text-emerald-500" : "text-rose-500"} sub="receber - pagar" />
          <KpiCard title="Faturado" value={fmt(financeiro.faturado)} icon={CheckCircle2} colorClass="text-primary" sub="NF emitida" />
        </div>
      </div>

      {/* Gráfico Resumo */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Resumo Financeiro — Visão Geral</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="nome" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tickFormatter={(v) => `${(v / 1e3).toFixed(0)}k`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={ttStyle} />
              <Bar dataKey="valor" name="Valor" radius={[4, 4, 0, 0]}>
                {barData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Próximos Vencimentos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />Próximos Vencimentos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {vencimentos.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs">Descrição</TableHead>
                    <TableHead className="text-xs">Venc.</TableHead>
                    <TableHead className="text-xs text-right">Valor</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vencimentos.map((v, i) => (
                    <TableRow key={i} className="hover:bg-muted/20 transition">
                      <TableCell className="text-xs truncate max-w-[140px]">{v.descricao || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{v.vencimento}</TableCell>
                      <TableCell className={`text-xs text-right font-mono font-semibold ${v.tipo === "receber" ? "text-emerald-500" : "text-rose-500"}`}>
                        {fmtFull(v.valor || 0)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[9px] h-4 ${v.tipo === "receber" ? "border-emerald-500 text-emerald-600" : "border-rose-500 text-rose-600"}`}>
                          {v.tipo === "receber" ? "Entrada" : "Saída"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-6 text-center">
                <p className="text-sm text-muted-foreground">Nenhum vencimento próximo</p>
                <Badge variant="outline" className="mt-2">Sem pendências</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Composição financeira */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Composição por OS (Receita × Custo)</CardTitle></CardHeader>
          <CardContent>
            {composicao.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={composicao}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="id" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tickFormatter={(v) => `${(v / 1e3).toFixed(0)}k`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={ttStyle} />
                  <Bar dataKey="receita" name="Receita" fill={CORES[0]} radius={[2, 2, 0, 0]} opacity={0.8} />
                  <Bar dataKey="custo" name="Custo" fill={CORES[2]} radius={[2, 2, 0, 0]} opacity={0.8} />
                  <Line type="monotone" dataKey="margem" name="Margem" stroke={CORES[4]} strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="p-8 text-center">
                <TrendingUp className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Dados de composição financeira</p>
                <Badge variant="outline" className="mt-2">Em preparação</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TabFinanceiro;