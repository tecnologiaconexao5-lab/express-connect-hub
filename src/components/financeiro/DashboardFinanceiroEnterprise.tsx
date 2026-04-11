import { useState, useEffect } from "react";
import { ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign, Calendar, AlertCircle, FileText, Truck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area, ComposedChart } from "recharts";
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
  color: string;
  trend?: number;
  variant?: "default" | "gradient-blue" | "gradient-green" | "gradient-red" | "gradient-purple" | "gradient-amber" | "gradient-slate" | "gradient-cyan";
}

const KPICard = ({ title, value, subValue, icon: Icon, color, trend, variant = "default" }: KPICardProps) => {
  const gradientClass: Record<string, string> = {
    "default": "bg-card border-l-4",
    "gradient-blue": "bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white border-none shadow-blue-700/20",
    "gradient-green": "bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 text-white border-none shadow-emerald-700/20",
    "gradient-red": "bg-gradient-to-br from-red-500 via-red-600 to-red-700 text-white border-none shadow-red-700/20",
    "gradient-purple": "bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 text-white border-none shadow-purple-700/20",
    "gradient-amber": "bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 text-white border-none shadow-orange-700/20",
    "gradient-slate": "bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 text-white border-none shadow-slate-700/20",
    "gradient-cyan": "bg-gradient-to-br from-cyan-500 via-cyan-600 to-cyan-700 text-white border-none shadow-cyan-700/20",
  };

  const isGradient = variant !== "default";
  const gradientColor = gradientClass[variant] || gradientClass.default;

  return (
    <Card className={`${gradientColor} shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1`}>
      <CardContent className="p-5 flex items-center justify-between">
        <div className="flex-1">
          <p className={`text-xs font-bold uppercase tracking-wider ${isGradient ? "text-white/80" : "text-muted-foreground"}`}>{title}</p>
          <p className={`text-2xl font-black mt-2 tracking-tight ${isGradient ? "text-white" : ""}`}>{value}</p>
          {subValue && (
            <p className={`text-xs font-medium mt-1.5 ${isGradient ? "text-white/70" : "text-muted-foreground"}`}>{subValue}</p>
          )}
          {trend !== undefined && (
            <p className={`text-xs font-bold mt-3 flex items-center gap-1.5 ${trend >= 0 ? (isGradient ? "text-green-300" : "text-green-600") : (isGradient ? "text-red-300" : "text-red-600")}`}>
              {trend >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5 rotate-180" />}
              <span>{fmtPct(trend)}</span>
              <span className={isGradient ? "text-white/60" : "text-muted-foreground"}>vs mês ant.</span>
            </p>
          )}
        </div>
        <div className={`p-3.5 rounded-2xl ${isGradient ? "bg-white/15 backdrop-blur-sm" : "bg-muted"}`}>
          <Icon className="w-6 h-6" style={isGradient ? { color: "white" } : { color }} />
        </div>
      </CardContent>
    </Card>
  );
};

const safeSupabase = (): any => {
  try {
    return supabase;
  } catch {
    return null;
  }
};

export default function DashboardFinanceiroEnterprise() {
  const [receber, setReceber] = useState<any[]>([]);
  const [pagar, setPagar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const sb = safeSupabase();
    
    if (!sb) {
      setReceber(mockFaturasVencendo.map(f => ({...f, status: 'a vencer'})));
      setPagar(mockPagamentosProgramados.map(f => ({...f, status: 'a vencer'})));
      setLoading(false);
      return;
    }
    
    try {
      const { data: rcv, error: rcvError } = await sb.from("financeiro_receber").select("*").order("vencimento", { ascending: true });
      if (rcvError) throw rcvError;
      if (rcv && rcv.length > 0) setReceber(rcv);
      else setReceber(mockFaturasVencendo.map(f => ({...f, status: 'a vencer'})));
    } catch {
      setReceber(mockFaturasVencendo.map(f => ({...f, status: 'a vencer'})));
    }
    
    try {
      const { data: pgr, error: pgrError } = await sb.from("financeiro_pagar").select("*").order("vencimento", { ascending: true });
      if (pgrError) throw pgrError;
      if (pgr && pgr.length > 0) setPagar(pgr);
      else setPagar(mockPagamentosProgramados.map(f => ({...f, status: 'a vencer'})));
    } catch {
      setPagar(mockPagamentosProgramados.map(f => ({...f, status: 'a vencer'})));
    } finally {
      setLoading(false);
    }
  };

  const variacaoReceita = ((mockKPIs.receitaMes - mockKPIs.receitaMesAnterior) / mockKPIs.receitaMesAnterior) * 100;
  const variacaoCustos = ((mockKPIs.custosOperacionais - mockKPIs.custosMesAnterior) / mockKPIs.custosMesAnterior) * 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-primary" />
          Dashboard Financeiro Enterprise
        </h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4" />
          {new Date().toLocaleDateString("pt-BR", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Linha 1 - KPIs Grandes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title="Receita do Mês" 
          value={fmtFin(mockKPIs.receitaMes)} 
          icon={DollarSign} 
          color="#2563eb"
          trend={variacaoReceita}
        />
        <KPICard 
          title="Custos Operacionais" 
          value={fmtFin(mockKPIs.custosOperacionais)} 
          icon={ArrowUpRight} 
          color="#dc2626"
          trend={variacaoCustos}
        />
        <KPICard 
          title="Resultado Líquido" 
          value={fmtFin(mockKPIs.resultadoLiquido)} 
          subValue={`Margem: ${mockKPIs.margemLiquida}%`}
          icon={TrendingUp} 
          color="#16a34a"
        />
        <KPICard 
          title="Saldo Projetado (30 dias)" 
          value={fmtFin(mockKPIs.saldoProjetado30)} 
          icon={DollarSign} 
          color="#7c3aed"
        />
      </div>

      {/* Linha 2 - KPIs Menores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title="A Receber (7 dias)" 
          value={fmtFin(mockKPIs.aReceber7Dias)} 
          icon={ArrowDownRight} 
          color="#f59e0b"
        />
        <KPICard 
          title="A Pagar (7 dias)" 
          value={fmtFin(mockKPIs.aPagar7Dias)} 
          icon={ArrowUpRight} 
          color="#ef4444"
        />
        <KPICard 
          title="Inadimplência Atual" 
          value={fmtFin(mockKPIs.inadimplencia)} 
          subValue={`${mockKPIs.clientesInadimplentes} clientes`}
          icon={AlertCircle} 
          color="#dc2626"
        />
        <KPICard 
          title="Custo por OS (média)" 
          value={fmtFin(mockKPIs.custoPorOS)} 
          icon={Truck} 
          color="#0891b2"
        />
      </div>

      {/* Linha 3 - Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Receita vs Despesa vs Resultado (6 meses)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockGrafico6Meses}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number) => fmtFin(value)}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Legend />
                <Bar dataKey="receita" name="Receita" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesa" name="Despesa" fill="#dc2626" radius={[4, 4, 0, 0]} />
                <Bar dataKey="resultado" name="Resultado" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Fluxo de Caixa Projetado (30 dias)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockFluxoCaixa30Dias}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number) => fmtFin(value)}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Legend />
                <Area type="monotone" dataKey="entrada" name="Entradas" stroke="#16a34a" fill="#16a34a" fillOpacity={0.2} />
                <Area type="monotone" dataKey="saida" name="Saídas" stroke="#dc2626" fill="#dc2626" fillOpacity={0.2} />
                <Line type="monotone" dataKey="saldoAcumulado" name="Saldo Acumulado" stroke="#7c3aed" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Linha 4 - Tabelas Rápidas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              Faturas Vencendo Hoje
            </CardTitle>
            <Badge variant="secondary" className="text-xs">{mockFaturasVencendo.length}</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-8 text-xs">Fatura</TableHead>
                  <TableHead className="h-8 text-xs">Cliente</TableHead>
                  <TableHead className="h-8 text-xs text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockFaturasVencendo.slice(0, 5).map((f) => (
                  <TableRow key={f.id} className="h-10">
                    <TableCell className="text-xs font-medium py-2">{f.fatura}</TableCell>
                    <TableCell className="text-xs py-2">{f.cliente}</TableCell>
                    <TableCell className="text-xs text-right font-medium py-2">{fmtFin(f.valor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-red-600" />
              Pagamentos Programados
            </CardTitle>
            <Badge variant="secondary" className="text-xs">{mockPagamentosProgramados.length}</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-8 text-xs">Doc</TableHead>
                  <TableHead className="h-8 text-xs">Fornecedor</TableHead>
                  <TableHead className="h-8 text-xs text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockPagamentosProgramados.slice(0, 5).map((p) => (
                  <TableRow key={p.id} className="h-10">
                    <TableCell className="text-xs font-medium py-2">{p.doc}</TableCell>
                    <TableCell className="text-xs py-2">{p.fornecedor}</TableCell>
                    <TableCell className="text-xs text-right font-medium py-2 text-red-600">{fmtFin(p.valor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Truck className="w-4 h-4 text-orange-600" />
              OS sem Fatura Gerada
            </CardTitle>
            <Badge variant="secondary" className="text-xs">{mockOSSemFatura.length}</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-8 text-xs">OS</TableHead>
                  <TableHead className="h-8 text-xs">Cliente</TableHead>
                  <TableHead className="h-8 text-xs text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockOSSemFatura.slice(0, 5).map((os) => (
                  <TableRow key={os.id} className="h-10">
                    <TableCell className="text-xs font-medium py-2">{os.os}</TableCell>
                    <TableCell className="text-xs py-2">{os.cliente}</TableCell>
                    <TableCell className="text-xs text-right font-medium py-2">{fmtFin(os.valor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
