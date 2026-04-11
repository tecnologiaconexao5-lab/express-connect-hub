import { useState, useEffect, useMemo } from "react";
import { Calendar, Filter, Download, TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, LineChart, Line, AreaChart, Area, ComposedChart 
} from "recharts";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const categorias = ["Todas", "Receita Faturamento", "Custo Prestador", "Combustível", "Pedágio", "Seguro", "Manutenção", "Aluguel", "Outros"];
const tipos = ["todos", "entrada", "saida"];
const statuses = ["todos", "realizado", "previsto"];

interface LancamentoFinanceiro {
  id: string;
  data: string;
  descricao: string;
  categoria: string;
  tipo: string;
  valor: number;
  conta_contabil?: string;
  unidade_id?: string;
  centro_custo_id?: string;
  realizado: boolean;
}

interface SaldoInicial {
  data: string;
  valor: number;
}

export default function FluxoCaixaEnterprise() {
  const [loading, setLoading] = useState(true);
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>([]);
  const [saldoInicial, setSaldoInicial] = useState<SaldoInicial>({ data: "", valor: 0 });
  const [periodo, setPeriodo] = useState("30");
  const [categoria, setCategoria] = useState("Todas");
  const [tipo, setTipo] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [view, setView] = useState("grafico");
  const [visualizacao, setVisualizacao] = useState("diario");
  const [unidade, setUnidade] = useState("todas");
  const [centroCusto, setCentroCusto] = useState("todos");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");

  useEffect(() => {
    fetchDados();
  }, [periodo]);

  const fetchDados = async () => {
    setLoading(true);
    try {
      const hoje = new Date();
      const dataInicioPeriodo = new Date(hoje.getTime() - parseInt(periodo) * 24 * 60 * 60 * 1000);
      const dataFimPeriodo = new Date(hoje.getTime() + parseInt(periodo) * 24 * 60 * 60 * 1000);

      const { data: lancamentosData, error: errorLancamentos } = await supabase
        .from("lancamentos_financeiros")
        .select("*")
        .gte("data", dataInicioPeriodo.toISOString().split('T')[0])
        .lte("data", dataFimPeriodo.toISOString().split('T')[0])
        .order("data", { ascending: true });

      if (errorLancamentos) throw errorLancamentos;

      const { data: receberData } = await supabase
        .from("financeiro_receber")
        .select("id, fatura, cliente_id, valor, competencia, vencimento, status")
        .gte("vencimento", dataInicioPeriodo.toISOString().split('T')[0])
        .lte("vencimento", dataFimPeriodo.toISOString().split('T')[0]);

      const { data: pagarData } = await supabase
        .from("financeiro_pagar")
        .select("id, documento, prestador_id, valor, competencia, vencimento, status")
        .gte("vencimento", dataInicioPeriodo.toISOString().split('T')[0])
        .lte("vencimento", dataFimPeriodo.toISOString().split('T')[0]);

      const hojeStr = hoje.toISOString().split('T')[0];

      const lancamentosProcessados: LancamentoFinanceiro[] = [];

      receberData?.forEach((r: any) => {
        const vencimentoStr = r.vencimento ? new Date(r.vencimento).toISOString().split('T')[0] : "";
        lancamentosProcessados.push({
          id: r.id,
          data: vencimentoStr,
          descricao: `Recebimento ${r.fatura || 'Fat'}`,
          categoria: "Receita Faturamento",
          tipo: "entrada",
          valor: parseFloat(r.valor) || 0,
          realizado: r.status === "paga" || vencimentoStr <= hojeStr
        });
      });

      pagarData?.forEach((p: any) => {
        const vencimentoStr = p.vencimento ? new Date(p.vencimento).toISOString().split('T')[0] : "";
        lancamentosProcessados.push({
          id: p.id,
          data: vencimentoStr,
          descricao: `Pagamento ${p.documento || 'Doc'}`,
          categoria: "Custo Prestador",
          tipo: "saida",
          valor: parseFloat(p.valor) || 0,
          realizado: p.status === "paga" || vencimentoStr <= hojeStr
        });
      });

      if (lancamentosData) {
        lancamentosData.forEach((l: any) => {
          lancamentosProcessados.push({
            id: l.id,
            data: l.data,
            descricao: l.descricao,
            categoria: l.categoria,
            tipo: l.tipo,
            valor: parseFloat(l.valor) || 0,
            conta_contabil: l.conta_contabil,
            unidade_id: l.unidade_id,
            centro_custo_id: l.centro_custo_id,
            realizado: true
          });
        });
      }

      const { data: saldoData } = await supabase
        .from("saldos_financeiros")
        .select("*")
        .order("data", { ascending: false })
        .limit(1)
        .single();

      if (saldoData) {
        setSaldoInicial({ data: saldoData.data, valor: parseFloat(saldoData.valor) || 0 });
      } else {
        setSaldoInicial({ data: hojeStr, valor: 0 });
      }

      setLancamentos(lancamentosProcessados);
    } catch (error: any) {
      console.error("Erro ao buscar dados do fluxo de caixa:", error);
      toast.error("Erro ao carregar dados do fluxo de caixa");
      setLancamentos([]);
    } finally {
      setLoading(false);
    }
  };

  const dadosAgrupados = useMemo(() => {
    const inicioCustomizado = dataInicio ? new Date(dataInicio) : new Date(Date.now() - parseInt(periodo) * 24 * 60 * 60 * 1000);
    const fimCustomizado = dataFim ? new Date(dataFim) : new Date(Date.now() + parseInt(periodo) * 24 * 60 * 60 * 1000);
    
    let filtered = lancamentos.filter(l => {
      const dataLanc = new Date(l.data);
      return dataLanc >= inicioCustomizado && dataLanc <= fimCustomizado;
    });

    if (categoria !== "Todas") {
      filtered = filtered.filter(l => l.categoria === categoria);
    }
    if (tipo !== "todos") {
      filtered = filtered.filter(l => l.tipo === tipo);
    }
    if (status === "realizado") {
      filtered = filtered.filter(l => l.realizado);
    }
    if (status === "previsto") {
      filtered = filtered.filter(l => !l.realizado);
    }
    if (unidade !== "todas") {
      filtered = filtered.filter(l => l.unidade_id === unidade);
    }
    if (centroCusto !== "todos") {
      filtered = filtered.filter(l => l.centro_custo_id === centroCusto);
    }

    const agrupado: Record<string, { entrada: number; saida: number; realizado: boolean }> = {};

    filtered.forEach(l => {
      const dataKey = l.data;
      if (!agrupado[dataKey]) {
        agrupado[dataKey] = { entrada: 0, saida: 0, realizado: l.realizado };
      }
      if (l.tipo === "entrada") {
        agrupado[dataKey].entrada += l.valor;
      } else {
        agrupado[dataKey].saida += l.valor;
      }
    });

    return Object.entries(agrupado)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, valores], index, arr) => {
        const saldoAnterior = index > 0 
          ? arr.slice(0, index).reduce((acc, [, v]) => acc + v.entrada - v.saida, saldoInicial.valor)
          : saldoInicial.valor;
        
        return {
          data,
          dia: new Date(data).getDate().toString().padStart(2, '0'),
          entrada: valores.entrada,
          saida: valores.saida,
          saldo: valores.entrada - valores.saida,
          saldoAcumulado: saldoAnterior + valores.entrada - valores.saida,
          realizado: valores.realizado || new Date(data) <= new Date()
        };
      });
  }, [lancamentos, periodo, categoria, tipo, status, unidade, centroCusto, dataInicio, dataFim, saldoInicial]);

  const dadosProcessados = useMemo(() => {
    if (visualizacao === "semanal") {
      const semanas: any[] = [];
      for (let i = 0; i < dadosAgrupados.length; i += 7) {
        const semana = dadosAgrupados.slice(i, i + 7);
        if (semana.length > 0) {
          semanas.push({
            dia: `S${Math.ceil((i + 1) / 7)}`,
            data: semana[0].data,
            entrada: semana.reduce((a, d) => a + d.entrada, 0),
            saida: semana.reduce((a, d) => a + d.saida, 0),
            saldoAcumulado: semana[semana.length - 1].saldoAcumulado,
            realizado: semana.every(d => d.realizado)
          });
        }
      }
      return semanas;
    }
    if (visualizacao === "quinzenal") {
      const qz: any[] = [];
      for (let i = 0; i < dadosAgrupados.length; i += 15) {
        const quinzenal = dadosAgrupados.slice(i, i + 15);
        if (quinzenal.length > 0) {
          qz.push({
            dia: i === 0 ? "1ª Q" : "2ª Q",
            data: quinzenal[0].data,
            entrada: quinzenal.reduce((a, d) => a + d.entrada, 0),
            saida: quinzenal.reduce((a, d) => a + d.saida, 0),
            saldoAcumulado: quinzenal[quinzenal.length - 1].saldoAcumulado,
            realizado: quinzenal.every(d => d.realizado)
          });
        }
      }
      return qz;
    }
    if (visualizacao === "mensal") {
      const meses: any[] = [];
      const mesesAgrupados: Record<string, typeof dadosAgrupados> = {};
      
      dadosAgrupados.forEach(d => {
        const mes = d.data.substring(0, 7);
        if (!mesesAgrupados[mes]) mesesAgrupados[mes] = [];
        mesesAgrupados[mes].push(d);
      });
      
      Object.entries(mesesAgrupados).forEach(([mes, dias]) => {
        meses.push({
          dia: mes,
          data: dias[0].data,
          entrada: dias.reduce((a, d) => a + d.entrada, 0),
          saida: dias.reduce((a, d) => a + d.saida, 0),
          saldoAcumulado: dias[dias.length - 1].saldoAcumulado,
          realizado: dias.every(d => d.realizado)
        });
      });
      return meses;
    }
    return dadosAgrupados;
  }, [dadosAgrupados, visualizacao]);

  const totalEntradas = dadosProcessados.reduce((acc, d) => acc + d.entrada, 0);
  const totalSaidas = dadosProcessados.reduce((acc, d) => acc + d.saida, 0);
  const saldoAtual = saldoInicial.valor + totalEntradas - totalSaidas;
  const saldoAcumuladoFinal = dadosProcessados.length > 0 
    ? dadosProcessados[dadosProcessados.length - 1].saldoAcumulado 
    : saldoInicial.valor;

  const filteredLancamentos = lancamentos.filter(l => {
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
          <Button variant="outline" size="sm" onClick={fetchDados} disabled={loading} className="gap-1">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Select value={visualizacao} onValueChange={setVisualizacao}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Visualização" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="diario">Diário</SelectItem>
              <SelectItem value="semanal">Semanal</SelectItem>
              <SelectItem value="quinzenal">Quinzenal</SelectItem>
              <SelectItem value="mensal">Mensal</SelectItem>
            </SelectContent>
          </Select>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">Próximos 15 dias</SelectItem>
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

      {/* Filtros por período personalizado */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Período:</span>
              <Input 
                type="date" 
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-[150px]"
              />
              <span className="text-muted-foreground">até</span>
              <Input 
                type="date" 
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-[150px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Unidade:</span>
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Centro Custo:</span>
              <Select value={centroCusto} onValueChange={setCentroCusto}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-green-800 uppercase">Saldo Inicial</p>
                <p className="text-xl font-bold text-green-700 mt-1">{fmtFin(saldoInicial.valor)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-800 uppercase">Entradas Previstas</p>
                <p className="text-xl font-bold text-emerald-700 mt-1">{fmtFin(totalEntradas)}</p>
              </div>
              <ArrowDownRight className="w-8 h-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-orange-800 uppercase">Saídas Previstas</p>
                <p className="text-xl font-bold text-orange-700 mt-1">{fmtFin(totalSaidas)}</p>
              </div>
              <ArrowUpRight className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-800 uppercase">Saldo Final</p>
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
                <p className="text-xs font-semibold text-purple-800 uppercase">Saldo Acumulado</p>
                <p className="text-xl font-bold text-purple-700 mt-1">{fmtFin(saldoAcumuladoFinal)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comparativo Previsto x Realizado */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-semibold">Comparativo: Previsto vs Realizado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-lg bg-green-50">
              <p className="text-xs font-semibold text-green-700">Entradas Realizadas</p>
              <p className="text-lg font-bold text-green-600">
                {fmtFin(dadosProcessados.filter(d => d.realizado).reduce((acc, d) => acc + d.entrada, 0))}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-red-50">
              <p className="text-xs font-semibold text-red-700">Saídas Realizadas</p>
              <p className="text-lg font-bold text-red-600">
                {fmtFin(dadosProcessados.filter(d => d.realizado).reduce((acc, d) => acc + d.saida, 0))}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-blue-50">
              <p className="text-xs font-semibold text-blue-700">Saldo Realizado</p>
              <p className="text-lg font-bold text-blue-600">
                {fmtFin(
                  dadosProcessados
                    .filter(d => d.realizado)
                    .reduce((acc, d) => acc + d.entrada - d.saida, saldoInicial.valor)
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {(view === "grafico" || view === "completo") && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Entradas vs Saídas</CardTitle>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dadosProcessados}>
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
                    {filteredLancamentos.slice(0, 20).map((l) => (
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
                    {filteredLancamentos.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Nenhum lançamento encontrado no período
                        </TableCell>
                      </TableRow>
                    )}
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
                Projeção {visualizacao === 'diario' ? 'Diária' : visualizacao === 'semanal' ? 'Semanal' : visualizacao === 'quinzenal' ? 'Quinzenal' : 'Mensal'} ({periodo} dias)
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
                  {dadosProcessados.slice(0, 20).map((d, i) => (
                    <TableRow key={i} className={d.realizado ? "" : "opacity-70"}>
                      <TableCell className="text-xs">{d.dia}</TableCell>
                      <TableCell className="text-xs text-green-600 font-mono">{fmtFin(d.entrada)}</TableCell>
                      <TableCell className="text-xs text-red-600 font-mono">{fmtFin(d.saida)}</TableCell>
                      <TableCell className="text-xs font-mono font-medium">{fmtFin(d.entrada - d.saida)}</TableCell>
                      <TableCell className="text-xs font-mono font-bold">{fmtFin(d.saldoAcumulado)}</Cell>
                      <TableCell>
                        {d.realizado ? (
                          <div className="w-3 h-3 rounded-full bg-green-500" title="Realizado" />
                        ) : (
                          <div className="w-3 h-3 rounded-full border-2 border-yellow-500" title="Previsto" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {dadosProcessados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum dado encontrado no período
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}