import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Network, Eye, CheckCircle, XCircle, Clock, TrendingUp, Loader2, Timer, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const KpiCard = ({ title, value, icon: Icon, color }: { title: string; value: string; icon: any; color: string }) => (
  <Card className="bg-card border-border shadow-sm">
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className={`text-2xl font-extrabold mt-1 ${color}`}>{value}</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const TabRede = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [oportunidades, setOportunidades] = useState<any[]>([]);
  const [visualizacoes, setVisualizacoes] = useState(0);
  const [prestadoresComVisualizacao, setPrestadoresComVisualizacao] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [opData, visData] = await Promise.all([
          supabase.from("rede_oportunidades").select("id, status, valor_prestador, veiculo_necessario, regiao, prazo_expiracao, aceite_em, created_at, ordens_servico:os_id(numero)").order("created_at", { ascending: false }).limit(50),
          supabase.from("rede_visualizacoes").select("id, prestador_id", { count: "exact" }),
        ]);

        if (opData.data) setOportunidades(opData.data);
        if (visData.data) {
          setVisualizacoes(visData.data.length);
          setPrestadoresComVisualizacao(new Set(visData.data.map((v: any) => v.prestador_id)).size);
        }
      } catch (err) {
        console.error("[TabRede]", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const abertas = oportunidades.filter(o => o.status === "publicada").length;
  const aceitas = oportunidades.filter(o => o.status === "aceita").length;
  const expiradas = oportunidades.filter(o => o.status === "expirada").length;
  const canceladas = oportunidades.filter(o => o.status === "cancelada").length;
  const fechadas = aceitas + expiradas + canceladas;
  const taxaAceite = fechadas > 0 ? Math.round((aceitas / fechadas) * 100) : 0;
  const temposAceite = oportunidades.filter(o => o.status === "aceita" && o.aceite_em).map(o =>
    (new Date(o.aceite_em).getTime() - new Date(o.created_at).getTime()) / 1000 / 60
  );
  const tempoMedio = temposAceite.length > 0 ? Math.round(temposAceite.reduce((a, b) => a + b, 0) / temposAceite.length) : 0;

  const statusBadge = (s: string) => {
    if (s === "aceita") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
    if (s === "expirada") return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
    if (s === "cancelada") return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
    if (s === "publicada") return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
    return "bg-amber-100 text-amber-700";
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard title="Oportunidades Abertas" value={String(abertas)} icon={Network} color="text-blue-500" />
        <KpiCard title="Visualizações" value={String(visualizacoes)} icon={Eye} color="text-indigo-500" />
        <KpiCard title="Aceitas" value={String(aceitas)} icon={CheckCircle} color="text-emerald-500" />
        <KpiCard title="Taxa de Aceite" value={`${taxaAceite}%`} icon={TrendingUp} color={taxaAceite >= 50 ? "text-emerald-500" : "text-amber-500"} />
        <KpiCard title="Tempo Médio" value={tempoMedio > 0 ? `${tempoMedio}min` : "—"} icon={Timer} color="text-violet-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Users className="w-4 h-4 text-primary" />Prestadores</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div><p className="text-sm font-semibold">Prestadores que visualizaram</p></div>
              <span className="text-base font-extrabold text-foreground">{prestadoresComVisualizacao}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div><p className="text-sm font-semibold">Total de oportunidades</p></div>
              <span className="text-base font-extrabold text-foreground">{oportunidades.length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div><p className="text-sm font-semibold">Expiradas</p></div>
              <span className="text-base font-extrabold text-muted-foreground">{expiradas}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div><p className="text-sm font-semibold">Canceladas</p></div>
              <span className="text-base font-extrabold text-muted-foreground">{canceladas}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Últimas Oportunidades</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs">OS</TableHead>
                  <TableHead className="text-xs">Valor</TableHead>
                  <TableHead className="text-xs">Região</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {oportunidades.slice(0, 8).map((op) => (
                  <TableRow key={op.id} className="hover:bg-muted/20 cursor-pointer transition" onClick={() => navigate("/operacao?tab=os")}>
                    <TableCell className="text-xs font-semibold">{op.ordens_servico?.numero || "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{fmt(op.valor_prestador || 0)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{op.regiao || "—"}</TableCell>
                    <TableCell><span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusBadge(op.status)}`}>{op.status}</span></TableCell>
                  </TableRow>
                ))}
                {oportunidades.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-8">Nenhuma oportunidade encontrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TabRede;
