import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  Clock, Hourglass, FileText, UserCheck, Truck, Package,
  MapPin, Home, AlertTriangle, CheckCircle, RefreshCcw,
  Share2, XCircle, TrendingUp, TrendingDown, Loader2,
  Route, Timer, Users
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const CORES = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];
const ttStyle = { backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))", borderRadius: "8px", fontSize: "12px" };

const statusIcons: Record<string, React.ElementType> = {
  "rascunho": Clock, "programada": FileText, "aguardando_parceiro": UserCheck,
  "em_coleta": Package, "em_rota": MapPin, "em_entrega": Home,
  "com_ocorrencia": AlertTriangle, "finalizada": CheckCircle,
  "reentrega": RefreshCcw, "devolucao": Share2, "cancelada": XCircle,
};

const statusBg: Record<string, string> = {
  "finalizada": "bg-emerald-500", "com_ocorrencia": "bg-red-500", "cancelada": "bg-gray-500",
  "em_rota": "bg-blue-500", "em_entrega": "bg-lime-500", "em_coleta": "bg-teal-500",
  "programada": "bg-indigo-500", "aguardando_parceiro": "bg-purple-500", "rascunho": "bg-gray-400",
};

const statusBadge = (s: string) => {
  if (s === "finalizada") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (s === "com_ocorrencia") return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  if (s === "cancelada") return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  if (s?.includes("rota") || s?.includes("entrega")) return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
  return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
};

const StatusCard = ({ nome, qtd, total }: { nome: string; qtd: number; total: number }) => {
  const navigate = useNavigate();
  const Icon = statusIcons[nome] || Clock;
  const pct = total > 0 ? Math.round((qtd / total) * 100) : 0;
  return (
    <Card
      className="cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-card border-border shadow-sm group"
      onClick={() => navigate(`/operacao?tab=os&status=${encodeURIComponent(nome)}`)}
    >
      <CardContent className="p-4">
        <div className={`w-9 h-9 rounded-lg ${statusBg[nome] ?? "bg-gray-500"} flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <p className="text-2xl font-extrabold text-foreground">{qtd}</p>
        <p className="text-[10px] font-semibold text-muted-foreground mt-0.5 uppercase tracking-wide truncate">{nome.replace(/_/g, " ")}</p>
        <div className="mt-2 h-1 w-full bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">{pct}% do total</p>
      </CardContent>
    </Card>
  );
};

const MetricRow = ({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) => (
  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/40">
    <div>
      <p className="text-sm font-semibold text-foreground">{label}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
    <span className={`text-base font-extrabold ${color ?? "text-foreground"}`}>{value}</span>
  </div>
);

const TabOperacional = () => {
  const [loading, setLoading] = useState(true);
  const [osPorStatus, setOsPorStatus] = useState<{ nome: string; qtd: number }[]>([]);
  const [osRecentes, setOsRecentes] = useState<any[]>([]);
  const [osPorDia, setOsPorDia] = useState<{ dia: string; os: number }[]>([]);
  const [totalOS, setTotalOS] = useState(0);
  const [prestadoresData, setPrestadoresData] = useState({ total: 0, ativos: 0 });
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroVeiculo, setFiltroVeiculo] = useState("todos");
  const [veiculoTipos, setVeiculoTipos] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [osResult, prestResult] = await Promise.all([
          supabase.from("ordens_servico").select("status, numero, created_at, veiculo_tipo, cliente").order("created_at", { ascending: false }).limit(300),
          supabase.from("prestadores").select("id, status", { count: "exact" }),
        ]);

        if (osResult.data) {
          const items = osResult.data;
          setTotalOS(items.length);

          const sc: Record<string, number> = {};
          items.forEach(o => { sc[o.status || "sem_status"] = (sc[o.status || "sem_status"] || 0) + 1; });
          setOsPorStatus(Object.entries(sc).map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd));

          const tipos = [...new Set(items.map(o => o.veiculo_tipo).filter(Boolean))] as string[];
          setVeiculoTipos(tipos);

          const diaMap: Record<string, number> = {};
          const hoje = new Date();
          for (let i = 29; i >= 0; i--) {
            const d = new Date(hoje); d.setDate(d.getDate() - i);
            diaMap[d.toISOString().split("T")[0]] = 0;
          }
          items.forEach(o => { const dia = o.created_at?.split("T")[0]; if (dia && diaMap[dia] !== undefined) diaMap[dia]++; });
          setOsPorDia(Object.entries(diaMap).map(([dia, os]) => ({ dia: dia.slice(5), os })));
          setOsRecentes(items.slice(0, 12));
        }

        if (prestResult.data) {
          const total = prestResult.count || 0;
          const ativos = prestResult.data.filter(p => p.status === "ativo" || p.status === "Ativo").length;
          setPrestadoresData({ total, ativos });
        }
      } catch (err) {
        console.error("[TabOperacional]", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const finalizadas = osPorStatus.find(s => s.nome === "finalizada")?.qtd ?? 0;
  const emRota = osPorStatus.find(s => s.nome === "em_rota")?.qtd ?? 0;
  const ocorrencias = osPorStatus.find(s => s.nome === "com_ocorrencia")?.qtd ?? 0;
  const canceladas = osPorStatus.find(s => s.nome === "cancelada")?.qtd ?? 0;
  const pendentes = totalOS - finalizadas - canceladas;
  const slaOk = totalOS > 0 ? Math.round((finalizadas / totalOS) * 100) : 0;

  const osFiltered = osRecentes.filter(o => {
    if (filtroStatus !== "todos" && o.status !== filtroStatus) return false;
    if (filtroVeiculo !== "todos" && o.veiculo_tipo !== filtroVeiculo) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center p-4 bg-muted/20 border border-border rounded-xl">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filtros:</span>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {osPorStatus.map(s => <SelectItem key={s.nome} value={s.nome}>{s.nome.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroVeiculo} onValueChange={setFiltroVeiculo}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os veículos</SelectItem>
            {veiculoTipos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Status cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {osPorStatus.slice(0, 12).map(s => <StatusCard key={s.nome} nome={s.nome} qtd={s.qtd} total={totalOS} />)}
      </div>

      {/* Métricas resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-extrabold text-foreground">{totalOS}</p>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide mt-1">Total OS</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-extrabold text-emerald-500">{finalizadas}</p>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide mt-1">Concluídas</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-extrabold text-amber-500">{pendentes}</p>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide mt-1">Pendentes</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-extrabold text-blue-500">{emRota}</p>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide mt-1">Em Rota</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-extrabold text-rose-500">{ocorrencias}</p>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide mt-1">Ocorrências</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-extrabold text-violet-500">{slaOk}%</p>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide mt-1">SLA OK</p>
        </div>
      </div>

      {/* Prestadores + métricas placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Users className="w-4 h-4 text-primary"/>Prestadores</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <MetricRow label="Total cadastrados" value={String(prestadoresData.total)} />
            <MetricRow label="Disponíveis" value={String(prestadoresData.ativos)} color="text-emerald-500" />
            <MetricRow label="Em rota" value={String(emRota)} color="text-blue-500" sub="estimativa por OS" />
            <MetricRow label="Inativos" value={String(prestadoresData.total - prestadoresData.ativos)} color="text-muted-foreground" />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Route className="w-4 h-4 text-primary"/>Métricas de Rota</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <MetricRow label="Distância total rodada" value="—" sub="em preparação" color="text-muted-foreground" />
            <MetricRow label="Dist. média por OS" value="—" sub="em preparação" color="text-muted-foreground" />
            <MetricRow label="Tempo médio por entrega" value="—" sub="em preparação" color="text-muted-foreground" />
            <MetricRow label="Atrasos operacionais" value={String(ocorrencias)} color="text-rose-500" />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Timer className="w-4 h-4 text-primary"/>Indicadores de Prazo</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <MetricRow label="SLA dentro do prazo" value={`${slaOk}%`} color={slaOk >= 80 ? "text-emerald-500" : "text-rose-500"} />
            <MetricRow label="Entregas concluídas" value={String(finalizadas)} color="text-emerald-500" />
            <MetricRow label="Entregas pendentes" value={String(pendentes)} color="text-amber-500" />
            <MetricRow label="Canceladas" value={String(canceladas)} color="text-gray-400" />
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">OS por Status (top 8)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={osPorStatus.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="nome" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-15} textAnchor="end" height={55} tickFormatter={v => v.replace(/_/g, " ")} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={ttStyle} />
                <Bar dataKey="qtd" name="OS" radius={[4, 4, 0, 0]}>
                  {osPorStatus.slice(0, 8).map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">OS por Dia (últimos 30 dias)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={osPorDia}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={6} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={ttStyle} />
                <Line type="monotone" dataKey="os" name="OS" stroke={CORES[0]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabela OS recentes com filtros */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Últimas Ordens de Serviço ({osFiltered.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs">OS</TableHead>
                <TableHead className="text-xs">Cliente</TableHead>
                <TableHead className="text-xs">Veículo</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {osFiltered.slice(0, 10).map((o) => (
                <TableRow key={o.numero} className="hover:bg-muted/20 transition">
                  <TableCell className="text-xs font-semibold">{o.numero}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{o.cliente || "—"}</TableCell>
                  <TableCell className="text-xs">{o.veiculo_tipo || "—"}</TableCell>
                  <TableCell><span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusBadge(o.status)}`}>{o.status?.replace(/_/g, " ")}</span></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{o.created_at?.split("T")[0]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default TabOperacional;