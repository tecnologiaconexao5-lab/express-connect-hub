import { useState } from "react";
import { Calendar, Filter, Download, TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, LineChart, Line, AreaChart, Area, ComposedChart 
} from "recharts";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const mockFluxo30Dias = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1;
  const entrada = Math.random() * 80000 + 20000;
  const saida = Math.random() * 60000 + 15000;
  return {
    dia: day.toString().padStart(2, '0'),
    data: new Date(Date.now() + (i * 86400000)).toISOString().split('T')[0],
    entrada: Math.round(entrada),
    saida: Math.round(saida),
    saldoAcumulado: Math.round(150000 + (entrada - saida) * (i + 1) / 3),
    realizado: i < new Date().getDate(),
  };
});

const mockLancamentos = [
  { id: 1, data: new Date().toISOString(), descricao: "Recebimento FAT-0045 - Tech Solutions", categoria: "Receita Faturamento", tipo: "entrada", valor: 14500, realizado: true },
  { id: 2, data: new Date().toISOString(), descricao: "Recebimento FAT-0038 - Indústria Global", categoria: "Receita Faturamento", tipo: "entrada", valor: 8200, realizado: true },
  { id: 3, data: new Date(Date.now() - 86400000).toISOString(), descricao: "Pagamento NF-8599 - João Transporte", categoria: "Custo Prestador", tipo: "saida", valor: 1200, realizado: true },
  { id: 4, data: new Date(Date.now() - 86400000).toISOString(), descricao: "Abastecimento Posto Ipiranga", categoria: "Combustível", tipo: "saida", valor: 4500, realizado: true },
  { id: 5, data: new Date(Date.now() + 86400000 * 2).toISOString(), descricao: "Recebimento FAT-0050 - Comércio Varejo", categoria: "Receita Faturamento", tipo: "entrada", valor: 5400, realizado: false },
  { id: 6, data: new Date(Date.now() + 86400000 * 3).toISOString(), descricao: "Pagamento NF-1542 - Pedágio BR-101", categoria: "Pedágio", tipo: "saida", valor: 890, realizado: false },
  { id: 7, data: new Date(Date.now() + 86400000 * 5).toISOString(), descricao: "Recebimento FAT-0052 - Distribuidora Norte", categoria: "Receita Faturamento", tipo: "entrada", valor: 15800, realizado: false },
  { id: 8, data: new Date(Date.now() + 86400000 * 7).toISOString(), descricao: "Pagamento NF-9201 - Seguradora Sancor", categoria: "Seguro", tipo: "saida", valor: 3200, realizado: false },
];

const categorias = ["Todas", "Receita Faturamento", "Custo Prestador", "Combustível", "Pedágio", "Seguro", "Manutenção", "Outros"];
const tipos = ["todos", "entrada", "saida"];
const statuses = ["todos", "realizado", "previsto"];

export default function FluxoCaixaEnterprise() {
  const [periodo, setPeriodo] = useState("30");
  const [categoria, setCategoria] = useState("Todas");
  const [tipo, setTipo] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [view, setView] = useState("grafico");

  const totalEntradas = mockFluxo30Dias.reduce((acc, d) => acc + d.entrada, 0);
  const totalSaidas = mockFluxo30Dias.reduce((acc, d) => acc + d.saida, 0);
  const saldoAtual = totalEntradas - totalSaidas;

  const filteredLancamentos = mockLancamentos.filter(l => {
    if (categoria !== "Todas" && l.categoria !== categoria) return false;
    if (tipo !== "todos" && l.tipo !== tipo) return false;
    if (status === "realizado" && !l.realizado) return false;
    if (status === "previsto" && l.realizado) return false;
    return true;
  });

  const entradaColor = "#16a34a";
  const saidaColor = "#dc2626";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            Fluxo de Caixa Enterprise
          </h2>
          <p className="text-sm text-muted-foreground">Controle de entradas e saídas com projeções</p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Próximos 30 dias</SelectItem>
              <SelectItem value="60">Próximos 60 dias</SelectItem>
              <SelectItem value="90">Próximos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-green-800 uppercase">Total Entradas</p>
                <p className="text-xl font-bold text-green-700 mt-1">{fmtFin(totalEntradas)}</p>
              </div>
              <ArrowDownRight className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-red-800 uppercase">Total Saídas</p>
                <p className="text-xl font-bold text-red-700 mt-1">{fmtFin(totalSaidas)}</p>
              </div>
              <ArrowUpRight className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-800 uppercase">Saldo do Período</p>
                <p className="text-xl font-bold text-blue-700 mt-1">{fmtFin(saldoAtual)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-purple-800 uppercase">Saldo Projetado</p>
                <p className="text-xl font-bold text-purple-700 mt-1">{fmtFin(485000)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Seletor de Visualização */}
      <div className="flex items-center justify-between">
        <Tabs value={view} onValueChange={setView} className="w-auto">
          <TabsList>
            <TabsTrigger value="grafico">Gráfico</TabsTrigger>
            <TabsTrigger value="tabela">Tabela</TabsTrigger>
            <TabsTrigger value="completo">Completo</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              {categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              {tipos.map(t => <SelectItem key={t} value={t}>{t === 'todos' ? 'Todos' : t === 'entrada' ? 'Entradas' : 'Saídas'}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statuses.map(s => <SelectItem key={s} value={s}>{s === 'todos' ? 'Todos' : s === 'realizado' ? 'Realizado' : 'Previsto'}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {(view === "grafico" || view === "completo") && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Entradas vs Saídas por Dia</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={mockFluxo30Dias}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number) => fmtFin(value)}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Legend />
                <Bar dataKey="entrada" name="Entradas" fill={entradaColor} fillOpacity={0.7} radius={[4, 4, 0, 0]} />
                <Bar dataKey="saida" name="Saídas" fill={saidaColor} fillOpacity={0.7} radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="saldoAcumulado" name="Saldo Acumulado" stroke="#7c3aed" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {(view === "tabela" || view === "completo") && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold">Lançamentos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLancamentos.map((l) => (
                  <TableRow key={l.id} className={l.realizado ? "" : "opacity-60"}>
                    <TableCell className="text-xs">{new Date(l.data).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-sm font-medium">{l.descricao}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{l.categoria}</Badge>
                    </TableCell>
                    <TableCell>
                      {l.realizado ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">Realizado</Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-xs">Previsto</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {l.tipo === "entrada" ? (
                        <span className="text-green-600">+{fmtFin(l.valor)}</span>
                      ) : (
                        <span className="text-red-600">-{fmtFin(l.valor)}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Tabela Diária Rápida */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Projeção Diária ({periodo} dias)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Entradas</TableHead>
                <TableHead>Saídas</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Acumulado</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockFluxo30Dias.slice(0, 15).map((d, i) => (
                <TableRow key={i} className={d.realizado ? "" : "opacity-70"}>
                  <TableCell className="text-xs">{new Date(d.data).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-xs text-green-600 font-mono">{fmtFin(d.entrada)}</TableCell>
                  <TableCell className="text-xs text-red-600 font-mono">{fmtFin(d.saida)}</TableCell>
                  <TableCell className="text-xs font-mono font-medium">{fmtFin(d.entrada - d.saida)}</TableCell>
                  <TableCell className="text-xs font-mono font-bold">{fmtFin(d.saldoAcumulado)}</TableCell>
                  <TableCell>
                    {d.realizado ? (
                      <div className="w-3 h-3 rounded-full bg-green-500" title="Realizado" />
                    ) : (
                      <div className="w-3 h-3 rounded-full bg-dashed border-2 border-yellow-500" title="Previsto" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
