import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
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

const topStatus = [...statusOperacional].filter(s => s.nome !== "Finalizada").sort((a, b) => b.qtd - a.qtd).slice(0, 8);

const TabOperacional = () => (
  <div className="space-y-6">
    {/* Status cards */}
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {statusOperacional.map((s) => (
        <Card key={s.nome} className="hover:shadow-md transition-shadow">
          <CardContent className="p-3 flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${s.cor} shrink-0`} />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{s.nome}</p>
              <p className="text-lg font-bold">{s.qtd}</p>
            </div>
          </CardContent>
        </Card>
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
