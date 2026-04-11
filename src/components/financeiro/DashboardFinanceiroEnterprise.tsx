import { useState, useEffect } from "react";
import { ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign, Calendar, AlertCircle, FileText, Truck, Wallet, Activity, ChevronUp, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, Line } from "recharts";
import { supabase } from "@/lib/supabase";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

const mockKPIs = {
  receitaMes: 1245800,
  receitaMesAnterior: 1150200,
  custosOperacionais: 685400,
  custosMesAnterior: 712000,
  resultadoLiquido: 342500,
  margemLiquida: 27.5,
  saldoProjetado30: 485000,
  aReceber7Dias: 185400,
  aPagar7Dias: 124500,
  inadimplencia: 42300,
  clientesInadimplentes: 4,
  custoPorOS: 185.50,
};

const mockGrafico6Meses = [
  { mes: "Out/25", receita: 980000, despesa: 720000, resultado: 260000 },
  { mes: "Nov/25", receita: 1050000, despesa: 780000, resultado: 270000 },
  { mes: "Dez/25", receita: 1180000, despesa: 850000, resultado: 330000 },
  { mes: "Jan/26", receita: 1090000, despesa: 790000, resultado: 300000 },
  { mes: "Fev/26", receita: 1120000, despesa: 760000, resultado: 360000 },
  { mes: "Mar/26", receita: 1245800, despesa: 903300, resultado: 342500 },
];

const mockFluxoCaixa30Dias = [
  { dia: "01", entrada: 45000, saida: 28000, saldoAcumulado: 172000 },
  { dia: "02", entrada: 32000, saida: 41000, saldoAcumulado: 163000 },
  { dia: "03", entrada: 58000, saida: 22000, saldoAcumulado: 199000 },
  { dia: "04", entrada: 28000, saida: 35000, saldoAcumulado: 192000 },
  { dia: "05", entrada: 72000, saida: 48000, saldoAcumulado: 216000 },
  { dia: "06", entrada: 35000, saida: 25000, saldoAcumulado: 226000 },
  { dia: "07", entrada: 48000, saida: 52000, saldoAcumulado: 222000 },
  { dia: "08", entrada: 62000, saida: 38000, saldoAcumulado: 246000 },
  { dia: "09", entrada: 29000, saida: 45000, saldoAcumulado: 230000 },
  { dia: "10", entrada: 55000, saida: 31000, saldoAcumulado: 254000 },
];

const mockFaturasVencendo = [
  { id: 1, fatura: "FAT-0052", cliente: "Tech Solutions", valor: 18500, vencimento: new Date().toISOString() },
  { id: 2, fatura: "FAT-0051", cliente: "Indústria Global", valor: 12400, vencimento: new Date().toISOString() },
  { id: 3, fatura: "FAT-0050", cliente: "Comércio Varejo", valor: 8200, vencimento: new Date().toISOString() },
  { id: 4, fatura: "FAT-0049", cliente: "Distribuidora Norte", valor: 15800, vencimento: new Date().toISOString() },
  { id: 5, fatura: "FAT-0048", cliente: "Logística Sul", valor: 5400, vencimento: new Date().toISOString() },
];

const mockPagamentosProgramados = [
  { id: 1, doc: "NF-9201", fornecedor: "João Transporte", valor: 1200, vencimento: new Date().toISOString() },
  { id: 2, doc: "NF-1542", fornecedor: "Posto Ipiranga", valor: 4500, vencimento: new Date().toISOString() },
  { id: 3, doc: "NF-882", fornecedor: "Pedágio BR-101", valor: 890, vencimento: new Date().toISOString() },
  { id: 4, doc: "BOL-203", fornecedor: "Seguradora Sancor", valor: 3200, vencimento: new Date().toISOString() },
  { id: 5, doc: "NF-445", fornecedor: "Manutenção Veículos", valor: 1800, vencimento: new Date().toISOString() },
];

const mockOSSemFatura = [
  { id: 1, os: "OS-420", cliente: "Tech Solutions", valor: 2400, data: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 2, os: "OS-421", cliente: "Indústria Global", valor: 1800, data: new Date(Date.now() - 86400000).toISOString() },
  { id: 3, os: "OS-422", cliente: "Comércio Varejo", valor: 950, data: new Date().toISOString() },
  { id: 4, os: "OS-423", cliente: "Distribuidora Norte", valor: 3200, data: new Date().toISOString() },
];

interface KPICardProps {
  title: string;
  value: string;
  subValue?: string;
  icon: React.ElementType;
  gradient: string;
  iconBg: string;
  trend?: number;
  trendLabel?: string;
  size?: "lg" | "sm";
}

const KPICard = ({ title, value, subValue, icon: Icon, gradient, iconBg, trend, trendLabel, size = "sm" }: KPICardProps) => (
  <div className={`relative group overflow-hidden rounded-xl border bg-card shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 ${size === "lg" ? "p-6" : "p-5"}`}>
    {/* Gradient accent top */}
    <div className={`absolute top-0 left-0 right-0 h-1 ${gradient}`} />

    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</p>
        <p className={`font-black tracking-tight text-foreground truncate ${size === "lg" ? "text-3xl" : "text-2xl"}`}>{value}</p>
        {subValue && (
          <p className="text-xs text-muted-foreground mt-1 font-medium">{subValue}</p>
        )}
        {trend !== undefined && (
          <div className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-bold ${
            trend >= 0
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          }`}>
            {trend >= 0 ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {fmtPct(trend)} {trendLabel ?? "vs mês ant."}
          </div>
        )}
      </div>
      <div className={`flex-shrink-0 ml-3 p-3 rounded-xl ${iconBg} shadow-sm group-hover:scale-110 transition-transform duration-200`}>
        <Icon className={`${size === "lg" ? "w-6 h-6" : "w-5 h-5"} text-white`} />
      </div>
    </div>
  </div>
);

export default function DashboardFinanceiroEnterprise() {
  const [receber, setReceber] = useState<any[]>([]);
  const [pagar, setPagar] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: rcv } = await supabase.from("financeiro_receber").select("*").order("vencimento", { ascending: true });
      if (rcv) setReceber(rcv);
    } catch { setReceber(mockFaturasVencendo.map(f => ({...f, status: 'a vencer'}))); }

    try {
      const { data: pgr } = await supabase.from("financeiro_pagar").select("*").order("vencimento", { ascending: true });
      if (pgr) setPagar(pgr);
    } catch { setPagar(mockPagamentosProgramados.map(f => ({...f, status: 'a vencer'}))); }
  };

  const variacaoReceita = ((mockKPIs.receitaMes - mockKPIs.receitaMesAnterior) / mockKPIs.receitaMesAnterior) * 100;
  const variacaoCustos = ((mockKPIs.custosOperacionais - mockKPIs.custosMesAnterior) / mockKPIs.custosMesAnterior) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-2.5 text-foreground">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            Dashboard Financeiro
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Visão executiva em tempo real</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/60 rounded-lg px-3 py-2">
          <Calendar className="w-4 h-4" />
          <span className="font-medium">{new Date().toLocaleDateString("pt-BR", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      {/* KPIs primários — grandes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Receita do Mês"
          value={fmtFin(mockKPIs.receitaMes)}
          icon={TrendingUp}
          gradient="bg-gradient-to-r from-blue-500 to-blue-600"
          iconBg="bg-gradient-to-br from-blue-500 to-blue-700"
          trend={variacaoReceita}
          size="lg"
        />
        <KPICard
          title="Custos Operacionais"
          value={fmtFin(mockKPIs.custosOperacionais)}
          icon={ArrowUpRight}
          gradient="bg-gradient-to-r from-red-500 to-rose-600"
          iconBg="bg-gradient-to-br from-red-500 to-rose-700"
          trend={variacaoCustos}
          trendLabel="(↓ bom)"
          size="lg"
        />
        <KPICard
          title="Resultado Líquido"
          value={fmtFin(mockKPIs.resultadoLiquido)}
          subValue={`Margem: ${mockKPIs.margemLiquida}%`}
          icon={DollarSign}
          gradient="bg-gradient-to-r from-emerald-500 to-green-600"
          iconBg="bg-gradient-to-br from-emerald-500 to-green-700"
          size="lg"
        />
        <KPICard
          title="Saldo Projetado 30d"
          value={fmtFin(mockKPIs.saldoProjetado30)}
          subValue="Baseado no fluxo atual"
          icon={Wallet}
          gradient="bg-gradient-to-r from-violet-500 to-purple-600"
          iconBg="bg-gradient-to-br from-violet-500 to-purple-700"
          size="lg"
        />
      </div>

      {/* KPIs secundários */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          title="A Receber (7 dias)"
          value={fmtFin(mockKPIs.aReceber7Dias)}
          icon={ArrowDownRight}
          gradient="bg-gradient-to-r from-amber-400 to-yellow-500"
          iconBg="bg-gradient-to-br from-amber-400 to-yellow-600"
        />
        <KPICard
          title="A Pagar (7 dias)"
          value={fmtFin(mockKPIs.aPagar7Dias)}
          icon={ArrowUpRight}
          gradient="bg-gradient-to-r from-orange-500 to-red-500"
          iconBg="bg-gradient-to-br from-orange-500 to-red-600"
        />
        <KPICard
          title="Inadimplência"
          value={fmtFin(mockKPIs.inadimplencia)}
          subValue={`${mockKPIs.clientesInadimplentes} clientes`}
          icon={AlertCircle}
          gradient="bg-gradient-to-r from-red-600 to-rose-700"
          iconBg="bg-gradient-to-br from-red-600 to-rose-800"
        />
        <KPICard
          title="Custo Médio por OS"
          value={fmtFin(mockKPIs.custoPorOS)}
          icon={Truck}
          gradient="bg-gradient-to-r from-cyan-500 to-sky-600"
          iconBg="bg-gradient-to-br from-cyan-500 to-sky-700"
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
              Receita vs Despesa (6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[280px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockGrafico6Meses} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value: number) => fmtFin(value)}
                  contentStyle={{ borderRadius: '10px', border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="receita" name="Receita" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesa" name="Despesa" fill="#f87171" radius={[4, 4, 0, 0]} />
                <Bar dataKey="resultado" name="Resultado" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              Fluxo de Caixa Projetado (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[280px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockFluxoCaixa30Dias}>
                <defs>
                  <linearGradient id="entradaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="saidaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f87171" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value: number) => fmtFin(value)}
                  contentStyle={{ borderRadius: '10px', border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="entrada" name="Entradas" stroke="#34d399" fill="url(#entradaGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="saida" name="Saídas" stroke="#f87171" fill="url(#saidaGrad)" strokeWidth={2} />
                <Line type="monotone" dataKey="saldoAcumulado" name="Saldo Acumulado" stroke="#a78bfa" strokeWidth={2.5} dot={false} strokeDasharray="5 3" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabelas de alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Faturas vencendo */}
        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="py-3 px-5 flex flex-row items-center justify-between bg-blue-50/50 dark:bg-blue-950/20 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-800 dark:text-blue-300">
              <FileText className="w-4 h-4" />
              Faturas Vencendo Hoje
            </CardTitle>
            <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 text-xs font-bold">{mockFaturasVencendo.length}</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b bg-muted/20">
                  <TableHead className="h-8 text-xs font-semibold text-muted-foreground px-4">Fatura</TableHead>
                  <TableHead className="h-8 text-xs font-semibold text-muted-foreground">Cliente</TableHead>
                  <TableHead className="h-8 text-xs font-semibold text-muted-foreground text-right px-4">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockFaturasVencendo.slice(0, 5).map((f) => (
                  <TableRow key={f.id} className="h-11 hover:bg-blue-50/30 dark:hover:bg-blue-950/10 transition-colors">
                    <TableCell className="text-xs font-semibold py-2 px-4 text-blue-700 dark:text-blue-400">{f.fatura}</TableCell>
                    <TableCell className="text-xs py-2 font-medium text-foreground">{f.cliente}</TableCell>
                    <TableCell className="text-xs text-right py-2 px-4 font-bold text-blue-700 dark:text-blue-400">{fmtFin(f.valor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="px-4 py-2.5 border-t bg-muted/10">
              <p className="text-xs text-muted-foreground font-semibold">
                Total: <span className="text-blue-700 dark:text-blue-400">{fmtFin(mockFaturasVencendo.reduce((a, b) => a + b.valor, 0))}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Pagamentos programados */}
        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="py-3 px-5 flex flex-row items-center justify-between bg-red-50/50 dark:bg-red-950/20 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-red-800 dark:text-red-300">
              <DollarSign className="w-4 h-4" />
              Pagamentos Programados
            </CardTitle>
            <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-300 text-xs font-bold">{mockPagamentosProgramados.length}</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b bg-muted/20">
                  <TableHead className="h-8 text-xs font-semibold text-muted-foreground px-4">Doc</TableHead>
                  <TableHead className="h-8 text-xs font-semibold text-muted-foreground">Fornecedor</TableHead>
                  <TableHead className="h-8 text-xs font-semibold text-muted-foreground text-right px-4">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockPagamentosProgramados.slice(0, 5).map((p) => (
                  <TableRow key={p.id} className="h-11 hover:bg-red-50/30 dark:hover:bg-red-950/10 transition-colors">
                    <TableCell className="text-xs font-semibold py-2 px-4 font-mono text-muted-foreground">{p.doc}</TableCell>
                    <TableCell className="text-xs py-2 font-medium text-foreground">{p.fornecedor}</TableCell>
                    <TableCell className="text-xs text-right py-2 px-4 font-bold text-red-600 dark:text-red-400">{fmtFin(p.valor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="px-4 py-2.5 border-t bg-muted/10">
              <p className="text-xs text-muted-foreground font-semibold">
                Total: <span className="text-red-600 dark:text-red-400">{fmtFin(mockPagamentosProgramados.reduce((a, b) => a + b.valor, 0))}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* OS sem fatura */}
        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="py-3 px-5 flex flex-row items-center justify-between bg-amber-50/50 dark:bg-amber-950/20 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <Truck className="w-4 h-4" />
              OS sem Fatura Gerada
            </CardTitle>
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 text-xs font-bold animate-pulse">{mockOSSemFatura.length}</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b bg-muted/20">
                  <TableHead className="h-8 text-xs font-semibold text-muted-foreground px-4">OS</TableHead>
                  <TableHead className="h-8 text-xs font-semibold text-muted-foreground">Cliente</TableHead>
                  <TableHead className="h-8 text-xs font-semibold text-muted-foreground text-right px-4">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockOSSemFatura.slice(0, 5).map((os) => (
                  <TableRow key={os.id} className="h-11 hover:bg-amber-50/30 dark:hover:bg-amber-950/10 transition-colors">
                    <TableCell className="text-xs font-semibold py-2 px-4 text-amber-700 dark:text-amber-400">{os.os}</TableCell>
                    <TableCell className="text-xs py-2 font-medium text-foreground">{os.cliente}</TableCell>
                    <TableCell className="text-xs text-right py-2 px-4 font-bold text-foreground">{fmtFin(os.valor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="px-4 py-2.5 border-t bg-muted/10">
              <p className="text-xs text-muted-foreground font-semibold">
                Pendente: <span className="text-amber-700 dark:text-amber-400">{fmtFin(mockOSSemFatura.reduce((a, b) => a + b.valor, 0))}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
