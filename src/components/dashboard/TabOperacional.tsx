import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  Clock, Hourglass, FileText, UserCheck, Truck, Package,
  MapPin, Home, AlertTriangle, CheckCircle, RefreshCcw,
  Share2, XCircle, TrendingUp, TrendingDown, Loader2,
  Route, Timer, Users, Network, Radio
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useDashboardFilters } from "@/contexts/DashboardFilterContext";

const CORES = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];
const ttStyle = { backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))", borderRadius: "8px", fontSize: "12px" };

const NocCard = ({ label, value, icon: Icon, color, sub, onClick }: {
  label: string; value: string; icon: any; color: string; sub?: string; onClick?: () => void;
}) => (
  <Card className="cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-card border-border shadow-sm group" onClick={onClick}>
    <CardContent className="p-4">
      <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <p className="text-2xl font-extrabold text-foreground">{value}</p>
      <p className="text-[10px] font-semibold text-muted-foreground mt-0.5 uppercase tracking-wide truncate">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </CardContent>
  </Card>
);

const MetricRow = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/40">
    <p className="text-sm font-semibold text-foreground">{label}</p>
    <span className={`text-base font-extrabold ${color ?? "text-foreground"}`}>{value}</span>
  </div>
);

function hoje() { return new Date().toISOString().split("T")[0]; }

const TabOperacional = () => {
  const navigate = useNavigate();
  const { filters } = useDashboardFilters();
  const [loading, setLoading] = useState(true);

  const [osStats, setOsStats] = useState({
    total: 0, pendentes: 0, rascunho: 0, emAndamento: 0, atrasadas: 0,
    finalizadasHoje: 0, canceladas: 0, slaPct: 0,
  });
  const [escalaStats, setEscalaStats] = useState({ abertas: 0, emExecucao: 0, encerradas: 0 });
  const [redeStats, setRedeStats] = useState({ abertas: 0, aceitas: 0, expiradas: 0, canceladas: 0 });
  const [prestadoresAtivos, setPrestadoresAtivos] = useState(0);
  const [osPorStatus, setOsPorStatus] = useState<{ nome: string; qtd: number }[]>([]);
  const [osPorDia, setOsPorDia] = useState<{ dia: string; os: number }[]>([]);
  const [osRecentes, setOsRecentes] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => {
      if (active) setLoading(false);
    }, 5000);

    const fetchData = async () => {
      try {
        const hojeStr = hoje();

        const results = await Promise.allSettled([
          supabase.from("ordens_servico")
            .select("id, status, numero, created_at, data_programada, cliente, veiculo_tipo")
            .gte("created_at", filters.dataInicio)
            .lte("created_at", filters.dataFim + "T23:59:59")
            .order("created_at", { ascending: false })
            .limit(300),
          supabase.from("alocacoes_escala")
            .select("id, status")
            .limit(200),
          supabase.from("rede_oportunidades")
            .select("id, status")
            .limit(100),
          supabase.from("prestadores")
            .select("id", { count: "exact", head: true }),
        ]);

        if (!active) return;

        const osResult = results[0].status === "fulfilled" ? results[0].value : null;
        const escalaResult = results[1].status === "fulfilled" ? results[1].value : null;
        const redeResult = results[2].status === "fulfilled" ? results[2].value : null;
        const prestResult = results[3].status === "fulfilled" ? results[3].value : null;

        if (osResult?.data) {
          const items = osResult.data;
          const total = items.length;
          const pendentes = items.filter(o => o.status === "pendente").length;
          const rascunho = items.filter(o => o.status === "rascunho").length;
          const emAndamento = items.filter(o => o.status && ["em_andamento", "em_rota", "em_entrega", "em_coleta"].includes(o.status)).length;
          const atrasadas = items.filter(o => o.status && !["finalizada", "cancelada", "entregue"].includes(o.status) && o.data_programada && o.data_programada < hojeStr).length;
          const finalizadasHoje = items.filter(o => o.status === "finalizada" && o.created_at?.startsWith(hojeStr)).length;
          const canceladas = items.filter(o => o.status === "cancelada").length;
          const finalizadas = items.filter(o => o.status === "finalizada").length;
          const slaPct = total > 0 ? Math.round((finalizadas / total) * 100) : 0;

          setOsStats({ total, pendentes, rascunho, emAndamento, atrasadas, finalizadasHoje, canceladas, slaPct });

          const sc: Record<string, number> = {};
          items.forEach(o => { sc[o.status || "sem_status"] = (sc[o.status || "sem_status"] || 0) + 1; });
          setOsPorStatus(Object.entries(sc).map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd));

          const diaMap: Record<string, number> = {};
          for (let i = 29; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            diaMap[d.toISOString().split("T")[0]] = 0;
          }
          items.forEach(o => { const dia = o.created_at?.split("T")[0]; if (dia && diaMap[dia] !== undefined) diaMap[dia]++; });
          setOsPorDia(Object.entries(diaMap).map(([dia, os]) => ({ dia: dia.slice(5), os })));
          setOsRecentes(items.slice(0, 15));
        }

        if (escalaResult?.data) {
          const items = escalaResult.data;
          setEscalaStats({
            abertas: items.filter(o => o.status && ["planejada", "aguardando_aceite"].includes(o.status)).length,
            emExecucao: items.filter(o => o.status && ["aceita", "em_rota", "em_entrega", "em_coleta", "carregamento"].includes(o.status)).length,
            encerradas: items.filter(o => o.status && ["concluida", "finalizada"].includes(o.status)).length,
          });
        }

        if (redeResult?.data) {
          const items = redeResult.data;
          setRedeStats({
            abertas: items.filter(o => o.status === "publicada").length,
            aceitas: items.filter(o => o.status === "aceita").length,
            expiradas: items.filter(o => o.status === "expirada").length,
            canceladas: items.filter(o => o.status === "cancelada").length,
          });
        }

        setPrestadoresAtivos(prestResult?.count || 0);
      } catch (err) {
        console.error("[TabOperacional]", err);
      } finally {
        if (active) {
          clearTimeout(timeout);
          setLoading(false);
        }
      }
    };
    fetchData();
    return () => { active = false; clearTimeout(timeout); };
  }, [filters.dataInicio, filters.dataFim]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const motoristasEmViagem = escalaStats.emExecucao;

  return (
    <div className="space-y-6">
      {/* Seção 1 — Ordens de Serviço */}
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2"><FileText className="w-3.5 h-3.5" />Ordens de Serviço</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <NocCard label="Aguard. Programação" value={String(osStats.pendentes)} icon={Clock} color="bg-amber-500" onClick={() => navigate("/operacao?tab=os&status=pendente")} />
          <NocCard label="Aguard. Alocação" value={String(osStats.rascunho)} icon={Hourglass} color="bg-slate-500" onClick={() => navigate("/operacao?tab=os&status=rascunho")} />
          <NocCard label="Na Rede" value={String(redeStats.abertas)} icon={Network} color="bg-indigo-500" onClick={() => navigate("/operacao?tab=os")} />
          <NocCard label="Em Andamento" value={String(osStats.emAndamento)} icon={Truck} color="bg-blue-500" onClick={() => navigate("/operacao?tab=os&status=em_andamento")} />
          <NocCard label="Atrasadas" value={String(osStats.atrasadas)} icon={AlertTriangle} color="bg-red-500" sub={osStats.atrasadas > 0 ? "requer atenção" : undefined} onClick={() => navigate("/operacao?tab=os")} />
          <NocCard label="Finalizadas Hoje" value={String(osStats.finalizadasHoje)} icon={CheckCircle} color="bg-emerald-500" onClick={() => navigate("/operacao?tab=os&status=finalizada")} />
          <NocCard label="Canceladas" value={String(osStats.canceladas)} icon={XCircle} color="bg-gray-500" onClick={() => navigate("/operacao?tab=os&status=cancelada")} />
          <NocCard label="SLA" value={`${osStats.slaPct}%`} icon={TrendingUp} color={osStats.slaPct >= 80 ? "bg-emerald-500" : "bg-rose-500"} />
        </div>
      </div>

      {/* Seção 2 — Escalas */}
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2"><Radio className="w-3.5 h-3.5" />Programação Operacional</p>
        <div className="grid grid-cols-3 gap-3">
          <NocCard label="Abertas" value={String(escalaStats.abertas)} icon={Clock} color="bg-amber-500" onClick={() => navigate("/operacao?tab=escala")} />
          <NocCard label="Em Execução" value={String(escalaStats.emExecucao)} icon={Truck} color="bg-blue-500" onClick={() => navigate("/operacao?tab=escala")} />
          <NocCard label="Encerradas" value={String(escalaStats.encerradas)} icon={CheckCircle} color="bg-emerald-500" onClick={() => navigate("/operacao?tab=escala")} />
        </div>
      </div>

      {/* Seção 3 — Rede Enterprise */}
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2"><Network className="w-3.5 h-3.5" />Rede Enterprise</p>
        <div className="grid grid-cols-4 gap-3">
          <NocCard label="Oportunidades" value={String(redeStats.abertas)} icon={Network} color="bg-blue-500" onClick={() => navigate("/operacao?tab=os")} />
          <NocCard label="Aceitas" value={String(redeStats.aceitas)} icon={CheckCircle} color="bg-emerald-500" onClick={() => navigate("/operacao?tab=os")} />
          <NocCard label="Expiradas" value={String(redeStats.expiradas)} icon={XCircle} color="bg-slate-500" onClick={() => navigate("/operacao?tab=os")} />
          <NocCard label="Canceladas" value={String(redeStats.canceladas)} icon={XCircle} color="bg-red-400" onClick={() => navigate("/operacao?tab=os")} />
        </div>
      </div>

      {/* Seção 4 — Motoristas */}
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2"><Users className="w-3.5 h-3.5" />Motoristas / Prestadores</p>
        <div className="grid grid-cols-3 gap-3">
          <NocCard label="Disponíveis" value={String(prestadoresAtivos)} icon={Users} color="bg-emerald-500" onClick={() => navigate("/cadastros/prestadores")} />
          <NocCard label="Em Viagem" value={String(motoristasEmViagem)} icon={Truck} color="bg-blue-500" onClick={() => navigate("/operacao?tab=escala")} />
          <NocCard label="Total Cadastrados" value={String(prestadoresAtivos + motoristasEmViagem)} icon={UserCheck} color="bg-violet-500" onClick={() => navigate("/cadastros/prestadores")} />
        </div>
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

      {/* Tabela OS recentes */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Últimas Ordens de Serviço ({osRecentes.length})</CardTitle></CardHeader>
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
              {osRecentes.slice(0, 10).map((o) => {
                const badgeClass = o.status === "finalizada" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : o.status === "cancelada" ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  : o.status?.includes("rota") || o.status?.includes("entrega") ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
                return (
                  <TableRow key={o.numero || o.id} className="hover:bg-muted/20 cursor-pointer transition" onClick={() => navigate("/operacao?tab=os")}>
                    <TableCell className="text-xs font-semibold">{o.numero || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{o.cliente || "—"}</TableCell>
                    <TableCell className="text-xs">{o.veiculo_tipo || "—"}</TableCell>
                    <TableCell><span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${badgeClass}`}>{o.status?.replace(/_/g, " ")}</span></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{o.created_at?.split("T")[0]}</TableCell>
                  </TableRow>
                );
              })}
              {osRecentes.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-8">Nenhuma OS encontrada no período</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default TabOperacional;
