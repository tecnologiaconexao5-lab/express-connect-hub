import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { 
  Clock, Hourglass, FileText, UserCheck, Truck, Package, 
  MapPin, Home, AlertTriangle, CheckCircle, RefreshCcw, 
  Share2, XCircle, TrendingUp, TrendingDown, Minus
} from "lucide-react";
import { statusOperacional, operacoesPorRegiao, osPorDia, ocorrenciasPorMotivo, ultimasOrdens, ultimasOcorrencias, parceirosAguardando, CORES_GRAFICOS } from "./mockData";

const statusBadgeColor = (s: string) => {
  if (s === "Finalizada") return "bg-green-600 text-white";
  if (s === "Com Ocorrência") return "bg-red-500 text-white";
  if (s.includes("Entrega") || s.includes("Rota") || s.includes("Operação")) return "bg-emerald-500 text-white";
  if (s.includes("Coleta") || s.includes("Carregando")) return "bg-teal-500 text-white";
  if (s.includes("Aguardando")) return "bg-yellow-500 text-black";
  if (s === "Programada") return "bg-blue-500 text-white";
  return "bg-gray-400 text-white";
};

const statusIcons: Record<string, React.ElementType> = {
  "Rascunho": Clock,
  "Aguardando Aprovação": Hourglass,
  "Programada": FileText,
  "Aguardando Parceiro": UserCheck,
  "Aguardando Veículo": Truck,
  "Em Coleta": Package,
  "Em Rota": MapPin,
  "Em Entrega": Home,
  "Com Ocorrência": AlertTriangle,
  "Finalizada": CheckCircle,
  "Reentrega": RefreshCcw,
  "Devolução": Share2,
  "Cancelada": XCircle,
};

const statusColors: Record<string, string> = {
  "Rascunho": "text-gray-500 bg-gray-100 border-gray-200",
  "Aguardando Aprovação": "text-yellow-600 bg-yellow-100 border-yellow-300",
  "Aguardando Programação": "text-orange-500 bg-orange-100 border-orange-300",
  "Em Programação": "text-orange-600 bg-orange-100 border-orange-300",
  "Programada": "text-blue-600 bg-blue-100 border-blue-300",
  "Aguardando Parceiro": "text-purple-600 bg-purple-100 border-purple-300",
  "Aguardando Veículo": "text-indigo-600 bg-indigo-100 border-indigo-300",
  "Aguardando Coleta": "text-cyan-600 bg-cyan-100 border-cyan-300",
  "Em Coleta": "text-teal-600 bg-teal-100 border-teal-300",
  "Carregando": "text-emerald-600 bg-emerald-100 border-emerald-300",
  "Saiu para Rota": "text-green-600 bg-green-100 border-green-300",
  "Em Operação": "text-green-700 bg-green-100 border-green-300",
  "Em Entrega": "text-lime-600 bg-lime-100 border-lime-300",
  "Com Ocorrência": "text-red-600 bg-red-100 border-red-300",
  "Aguardando Baixa": "text-amber-600 bg-amber-100 border-amber-300",
  "Finalizada": "text-green-800 bg-green-200 border-green-400",
  "Reentrega": "text-rose-600 bg-rose-100 border-rose-300",
  "Devolução": "text-red-700 bg-red-100 border-red-300",
  "Retorno à Base": "text-slate-600 bg-slate-100 border-slate-300",
};

const getTendencia = (nome: string) => {
  const tendencias: Record<string, number> = {
    "Rascunho": -2,
    "Aguardando Aprovação": 5,
    "Aguardando Programação": -3,
    "Programada": 8,
    "Aguardando Parceiro": -1,
    "Aguardando Veículo": 2,
    "Em Coleta": 4,
    "Em Rota": 12,
    "Em Entrega": 6,
    "Com Ocorrência": -4,
    "Finalizada": 15,
    "Reentrega": 1,
    "Devolução": -1,
  };
  return tendencias[nome] || 0;
};

const StatusCard = ({ nome, qtd, cor }: { nome: string; qtd: number; cor: string }) => {
  const navigate = useNavigate();
  const Icon = statusIcons[nome] || Clock;
  const colorClass = statusColors[nome] || "text-gray-600 bg-gray-100 border-gray-200";
  const tendencia = getTendencia(nome);
  
  const getStatusBarColor = (nome: string) => {
    if (nome === "Finalizada") return "bg-green-500";
    if (nome === "Com Ocorrência") return "bg-red-500";
    if (nome.includes("Rota") || nome.includes("Entrega") || nome.includes("Operação")) return "bg-emerald-500";
    if (nome.includes("Coleta") || nome.includes("Carregando")) return "bg-teal-500";
    if (nome.includes("Aguardando")) return "bg-yellow-500";
    if (nome === "Programada") return "bg-blue-500";
    return "bg-gray-400";
  };

  const getIconBgColor = (nome: string) => {
    if (nome === "Finalizada") return "bg-green-500";
    if (nome === "Com Ocorrência") return "bg-red-500";
    if (nome.includes("Rota") || nome.includes("Entrega") || nome.includes("Operação")) return "bg-emerald-500";
    if (nome.includes("Coleta") || nome.includes("Carregando")) return "bg-teal-500";
    if (nome.includes("Aguardando")) return "bg-yellow-500";
    if (nome === "Programada") return "bg-blue-500";
    return "bg-gray-500";
  };

  return (
    <Card 
      className="cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-card dark:bg-slate-800 border-border dark:border-slate-700 shadow-sm"
      onClick={() => navigate(`/operacao?tab=os&status=${encodeURIComponent(nome)}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-lg ${getIconBgColor(nome)} flex items-center justify-center shadow-md`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
            tendencia > 0 ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400" : tendencia < 0 ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
          }`}>
            {tendencia > 0 ? <TrendingUp className="w-3 h-3" /> : tendencia < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            <span>{Math.abs(tendencia)}%</span>
          </div>
        </div>
        <div className="mb-3">
          <p className="text-3xl font-bold text-foreground dark:text-white">{qtd}</p>
          <p className="text-xs font-medium text-muted-foreground dark:text-gray-400 mt-0.5">{nome}</p>
        </div>
        <div className="h-1.5 w-full bg-muted dark:bg-slate-700 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full ${getStatusBarColor(nome)}`} 
            style={{ width: `${Math.min((qtd / 50) * 100, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
};

const topStatus = [...statusOperacional].filter(s => s.nome !== "Finalizada").sort((a, b) => b.qtd - a.qtd).slice(0, 8);

const TabOperacional = () => (
  <div className="space-y-6">
    {/* Status cards com ícones */}
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {statusOperacional.map((s) => (
        <StatusCard key={s.nome} nome={s.nome} qtd={s.qtd} cor={s.cor} />
      ))}
    </div>

    {/* Gráficos */}
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
        <CardHeader className="pb-2"><CardTitle className="text-sm">Operações por região</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={operacoesPorRegiao} dataKey="valor" nameKey="regiao" cx="50%" cy="50%" outerRadius={90} label={({ regiao, percent }) => `${regiao} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                {operacoesPorRegiao.map((_, i) => <Cell key={i} fill={CORES_GRAFICOS[i]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
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

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Ocorrências por motivo</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={ocorrenciasPorMotivo}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
              <XAxis dataKey="motivo" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="qtd" fill={CORES_GRAFICOS[6]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>

    {/* Tabelas */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Últimas 10 ordens de serviço</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">OS</TableHead>
                <TableHead className="text-xs">Cliente</TableHead>
                <TableHead className="text-xs">Rota</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ultimasOrdens.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="text-xs font-medium">{o.id}</TableCell>
                  <TableCell className="text-xs">{o.cliente}</TableCell>
                  <TableCell className="text-xs">{o.origem}→{o.destino}</TableCell>
                  <TableCell><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusBadgeColor(o.status)}`}>{o.status}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Últimas ocorrências abertas</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">ID</TableHead>
                  <TableHead className="text-xs">OS</TableHead>
                  <TableHead className="text-xs">Motivo</TableHead>
                  <TableHead className="text-xs">Parceiro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ultimasOcorrencias.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="text-xs font-medium">{o.id}</TableCell>
                    <TableCell className="text-xs">{o.os}</TableCell>
                    <TableCell className="text-xs">{o.motivo}</TableCell>
                    <TableCell className="text-xs">{o.parceiro}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Parceiros aguardando confirmação</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Parceiro</TableHead>
                  <TableHead className="text-xs">Região</TableHead>
                  <TableHead className="text-xs">OS</TableHead>
                  <TableHead className="text-xs">Desde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parceirosAguardando.map((p) => (
                  <TableRow key={p.nome}>
                    <TableCell className="text-xs font-medium">{p.nome}</TableCell>
                    <TableCell className="text-xs">{p.regiao}</TableCell>
                    <TableCell className="text-xs">{p.os}</TableCell>
                    <TableCell className="text-xs">{p.desde}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
);

export default TabOperacional;
