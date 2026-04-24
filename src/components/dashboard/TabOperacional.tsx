import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { 
  Clock, Hourglass, FileText, UserCheck, Truck, Package, 
  MapPin, Home, AlertTriangle, CheckCircle, RefreshCcw, 
  Share2, XCircle, TrendingUp, TrendingDown, Minus, Loader2
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const CORES_GRAFICOS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];

const statusBadgeColor = (s: string) => {
  if (s === "Finalizada" || s === "finalizada") return "bg-green-600 text-white";
  if (s === "Com Ocorrência" || s === "com_ocorrencia") return "bg-red-500 text-white";
  if (s.includes("Entrega") || s.includes("Rota") || s.includes("Operação") || s.includes("em_entrega") || s.includes("em_rota")) return "bg-emerald-500 text-white";
  if (s.includes("Coleta") || s.includes("Carregando") || s.includes("em_coleta")) return "bg-teal-500 text-white";
  if (s.includes("Aguardando") || s.includes("aguardando")) return "bg-yellow-500 text-black";
  if (s === "Programada" || s === "programada") return "bg-blue-500 text-white";
  if (s === "Rascunho" || s === "rascunho") return "bg-gray-400 text-white";
  if (s === "Cancelada" || s === "cancelada") return "bg-gray-600 text-white";
  return "bg-gray-400 text-white";
};

const statusIcons: Record<string, React.ElementType> = {
  "Rascunho": Clock,
  "rascunho": Clock,
  "Aguardando Aprovação": Hourglass,
  "Programada": FileText,
  "programada": FileText,
  "Aguardando Parceiro": UserCheck,
  "aguardando_parceiro": UserCheck,
  "Aguardando Veículo": Truck,
  "Em Coleta": Package,
  "em_coleta": Package,
  "Em Rota": MapPin,
  "em_rota": MapPin,
  "Em Entrega": Home,
  "em_entrega": Home,
  "Com Ocorrência": AlertTriangle,
  "com_ocorrencia": AlertTriangle,
  "Finalizada": CheckCircle,
  "finalizada": CheckCircle,
  "Reentrega": RefreshCcw,
  "Devolução": Share2,
  "Cancelada": XCircle,
  "cancelada": XCircle,
};

const statusColors: Record<string, string> = {
  "Rascunho": "text-gray-500 bg-gray-100 border-gray-200",
  "rascunho": "text-gray-500 bg-gray-100 border-gray-200",
  "Aguardando Aprovação": "text-yellow-600 bg-yellow-100 border-yellow-300",
  "Programada": "text-blue-600 bg-blue-100 border-blue-300",
  "programada": "text-blue-600 bg-blue-100 border-blue-300",
  "Aguardando Parceiro": "text-purple-600 bg-purple-100 border-purple-300",
  "aguardando_parceiro": "text-purple-600 bg-purple-100 border-purple-300",
  "Aguardando Veículo": "text-indigo-600 bg-indigo-100 border-indigo-300",
  "Em Coleta": "text-teal-600 bg-teal-100 border-teal-300",
  "em_coleta": "text-teal-600 bg-teal-100 border-teal-300",
  "Carregando": "text-emerald-600 bg-emerald-100 border-emerald-300",
  "Em Rota": "text-green-600 bg-green-100 border-green-300",
  "em_rota": "text-green-600 bg-green-100 border-green-300",
  "Em Operação": "text-green-700 bg-green-100 border-green-300",
  "Em Entrega": "text-lime-600 bg-lime-100 border-lime-300",
  "em_entrega": "text-lime-600 bg-lime-100 border-lime-300",
  "Com Ocorrência": "text-red-600 bg-red-100 border-red-300",
  "com_ocorrencia": "text-red-600 bg-red-100 border-red-300",
  "Aguardando Baixa": "text-amber-600 bg-amber-100 border-amber-300",
  "Finalizada": "text-green-800 bg-green-200 border-green-400",
  "finalizada": "text-green-800 bg-green-200 border-green-400",
  "Reentrega": "text-rose-600 bg-rose-100 border-rose-300",
  "Devolução": "text-red-700 bg-red-100 border-red-300",
  "Cancelada": "text-gray-600 bg-gray-100 border-gray-300",
  "cancelada": "text-gray-600 bg-gray-100 border-gray-300",
};

const getIconBgColor = (nome: string) => {
  if (nome === "Finalizada" || nome === "finalizada") return "bg-green-500";
  if (nome === "Com Ocorrência" || nome === "com_ocorrencia") return "bg-red-500";
  if (nome.includes("Rota") || nome.includes("Entrega") || nome.includes("Operação") || nome.includes("em_")) return "bg-emerald-500";
  if (nome.includes("Coleta") || nome.includes("Carregando")) return "bg-teal-500";
  if (nome.includes("Aguardando") || nome.includes("aguardando")) return "bg-yellow-500";
  if (nome === "Programada" || nome === "programada") return "bg-blue-500";
  if (nome === "Rascunho" || nome === "rascunho") return "bg-gray-500";
  return "bg-gray-500";
};

const StatusCard = ({ nome, qtd }: { nome: string; qtd: number }) => {
  const navigate = useNavigate();
  const Icon = statusIcons[nome] || Clock;
  
  return (
    <Card 
      className="cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-card border-border shadow-sm"
      onClick={() => navigate(`/operacao?tab=os&status=${encodeURIComponent(nome)}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-lg ${getIconBgColor(nome)} flex items-center justify-center shadow-md`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
        <div className="mb-3">
          <p className="text-3xl font-bold text-foreground">{qtd}</p>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">{nome}</p>
        </div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min((qtd / 10) * 100, 100)}%` }} />
        </div>
      </CardContent>
    </Card>
  );
};

const TabOperacional = () => {
  const [loading, setLoading] = useState(true);
  const [osPorStatus, setOsPorStatus] = useState<{ nome: string; qtd: number }[]>([]);
  const [osRecentes, setOsRecentes] = useState<any[]>([]);
  const [osPorDia, setOsPorDia] = useState<{ dia: string; os: number }[]>([]);
  const [totalOS, setTotalOS] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: osData } = await supabase
          .from("ordens_servico")
          .select("status, numero, created_at")
          .order("created_at", { ascending: false })
          .limit(100);

        if (osData) {
          const statusCount: Record<string, number> = {};
          osData.forEach(os => {
            const status = os.status || "sem_status";
            statusCount[status] = (statusCount[status] || 0) + 1;
          });
          
          const statusArray = Object.entries(statusCount).map(([nome, qtd]) => ({ nome, qtd }));
          statusArray.sort((a, b) => b.qtd - a.qtd);
          setOsPorStatus(statusArray);
          setTotalOS(osData.length);

          const diaCount: Record<string, number> = {};
          const hoje = new Date();
          for (let i = 29; i >= 0; i--) {
            const d = new Date(hoje);
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split("T")[0];
            diaCount[key] = 0;
          }
          osData.forEach(os => {
            const dia = os.created_at?.split("T")[0];
            if (dia && diaCount[dia] !== undefined) {
              diaCount[dia]++;
            }
          });
          const diaArray = Object.entries(diaCount).map(([dia, os]) => ({ dia, os }));
          setOsPorDia(diaArray);

          setOsRecentes(osData.slice(0, 10));
        }
      } catch (err) {
        console.error("[TabOperacional] Erro ao carregar dados:", err);
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

  const topStatus = osPorStatus.filter(s => s.nome !== "finalizada").slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {osPorStatus.slice(0, 12).map((s) => (
          <StatusCard key={s.nome} nome={s.nome} qtd={s.qtd} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">OS por status (top 8)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topStatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
                <XAxis dataKey="nome" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="qtd" fill={CORES_GRAFICOS[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">OS por dia (últimos 30 dias)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={osPorDia}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
                <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="os" stroke={CORES_GRAFICOS[2]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Últimas {osRecentes.length} ordens de serviço</CardTitle></CardHeader>
        <CardContent className="p-0">
          {osRecentes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">OS</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {osRecentes.map((o) => (
                  <TableRow key={o.numero}>
                    <TableCell className="text-xs font-medium">{o.numero}</TableCell>
                    <TableCell><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusBadgeColor(o.status)}`}>{o.status}</span></TableCell>
                    <TableCell className="text-xs">{o.created_at?.split("T")[0]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground p-4">Nenhuma OS encontrada</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TabOperacional;