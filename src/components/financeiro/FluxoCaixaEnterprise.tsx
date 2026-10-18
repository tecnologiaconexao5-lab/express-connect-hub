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
import { calcularFluxo, type FluxoPrevisto, type FluxoBaixa } from "@/services/financeiro/fluxoCaixaService";

// ============================================================================
// F0-F — Fluxo de Caixa com dados REAIS (sem tabelas inexistentes).
//   PREVISTO  → financeiro_receber (entradas) + financeiro_pagar (saídas).
//   REALIZADO → financeiro_baixas (estornada = false), separado por titulo_tabela.
// Nunca soma previsto + realizado como se fossem dois fatos distintos:
// o realizado vem SOMENTE das baixas (não é inferido por status/vencimento).
// Saldo inicial: sem fonte confiável → exibe "não configurado" (até F0-H).
// ============================================================================

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const categorias = ["Todas", "Receita Faturamento", "Custo Prestador", "Combustível", "Pedágio", "Seguro", "Manutenção", "Aluguel", "Outros"];
const tipos = ["todos", "entrada", "saida"];
const statuses = ["todos", "realizado", "previsto"];

interface FluxoItem {
  id: string;
  data: string;
  descricao: string;
  categoria: string;
  tipo: "entrada" | "saida";
  valor: number;
  origem: "previsto" | "realizado"; // previsto = título; realizado = baixa
  realizado: boolean;
  status?: string | null;
  conta?: string;
  forma?: string;
}

interface SaldoInicial {
  data: string;
  valor: number;
}

export default function FluxoCaixaEnterprise() {
  const [loading, setLoading] = useState(true);
  const [lancamentos, setLancamentos] = useState<FluxoItem[]>([]);
  const [saldoInicial, setSaldoInicial] = useState<SaldoInicial>({ data: "", valor: 0 });
  const [saldoInicialConfigurado, setSaldoInicialConfigurado] = useState(false);
  const [contas, setContas] = useState<string[]>([]);
  const [periodo, setPeriodo] = useState("30");
  const [categoria, setCategoria] = useState("Todas");
  const [tipo, setTipo] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [conta, setConta] = useState("todas");
  const [view, setView] = useState("grafico");
  const [visualizacao, setVisualizacao] = useState("diario");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");

  useEffect(() => {
    fetchDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  const fetchDados = async () => {
    setLoading(true);
    try {
      const hoje = new Date();
      const dataInicioPeriodo = new Date(hoje.getTime() - parseInt(periodo) * 24 * 60 * 60 * 1000);
      const dataFimPeriodo = new Date(hoje.getTime() + parseInt(periodo) * 24 * 60 * 60 * 1000);
      const ini = dataInicioPeriodo.toISOString().split('T')[0];
      const fim = dataFimPeriodo.toISOString().split('T')[0];

      // FIN-MASTER-361 — saldo inicial: soma de todas contas_financeiras ativas
      const { data: contasData } = await supabase
        .from("contas_financeiras")
        .select("id, nome, saldo_inicial, ativa")
        .eq("ativa", true);

      if (contasData && contasData.length > 0) {
        const somaSaldoInicial = contasData.reduce((a, c) => a + (Number(c.saldo_inicial) || 0), 0);
        setSaldoInicial({ data: "", valor: somaSaldoInicial });
        setSaldoInicialConfigurado(true);
      } else {
        setSaldoInicial({ data: "", valor: 0 });
        setSaldoInicialConfigurado(false);
      }

      // ── PREVISTO — entradas: títulos a receber (exclui TESTE/HML) ───────────
      const { data: receberData, error: errRec } = await supabase
        .from("financeiro_receber")
        .select("id, fatura, cliente_nome, cliente, valor, data_vencimento, status, categoria")
        .eq("is_teste", false)
        .gte("data_vencimento", ini)
        .lte("data_vencimento", fim);
      if (errRec) throw errRec;

      // ── PREVISTO — saídas: títulos a pagar (exclui TESTE/HML) ───────────────
      const { data: pagarData, error: errPag } = await supabase
        .from("financeiro_pagar")
        .select("id, documento, fornecedor_nome, prestador, valor, data_vencimento, status, categoria")
        .eq("is_teste", false)
        .gte("data_vencimento", ini)
        .lte("data_vencimento", fim);
      if (errPag) throw errPag;

      // TMS-FIN-PROG-05C.3A — IDs de títulos TESTE/HML (para não compor o
      // resultado REALIZADO). As linhas de baixa permanecem no banco (histórico).
      const [{ data: testRecIds }, { data: testPagIds }] = await Promise.all([
        supabase.from("financeiro_receber").select("id").eq("is_teste", true),
        supabase.from("financeiro_pagar").select("id").eq("is_teste", true),
      ]);
      const idsTeste = new Set<string>(
        [...(testRecIds || []), ...(testPagIds || [])].map((x: { id: string }) => x.id)
      );

      // ── REALIZADO — baixas reais (estornada = false) ────────────────────────
      const { data: baixasData, error: errBai } = await supabase
        .from("financeiro_baixas")
        .select("id, titulo_tabela, titulo_id, valor_baixado, data_baixa, forma_pagamento, conta_financeira, estornada")
        .eq("estornada", false)
        .gte("data_baixa", ini)
        .lte("data_baixa", fim);
      if (errBai) throw errBai;

      const items: FluxoItem[] = [];
      const ehCancelado = (s: string | null | undefined) =>
        ["cancelado", "cancelada"].includes(String(s || "").toLowerCase());

      receberData?.forEach((r: any) => {
        if (ehCancelado(r.status)) return; // cancelado não é receita prevista real
        const data = (r.data_vencimento || "").split('T')[0];
        items.push({
          id: `rec-${r.id}`,
          data,
          descricao: `Recebimento ${r.fatura || r.cliente_nome || r.cliente || 'Fat'}`,
          categoria: r.categoria || "Receita Faturamento",
          tipo: "entrada",
          valor: Number(r.valor) || 0,
          origem: "previsto",
          realizado: false,
          status: r.status || null,
        });
      });

      pagarData?.forEach((p: any) => {
        if (ehCancelado(p.status)) return; // cancelado não é despesa prevista real
        const data = (p.data_vencimento || "").split('T')[0];
        items.push({
          id: `pag-${p.id}`,
          data,
          descricao: `Pagamento ${p.documento || p.fornecedor_nome || p.prestador || 'Doc'}`,
          categoria: p.categoria || "Custo Prestador",
          tipo: "saida",
          valor: Number(p.valor) || 0,
          origem: "previsto",
          realizado: false,
          status: p.status || null,
        });
      });

      baixasData?.forEach((b: any) => {
        // TMS-FIN-PROG-05C.3A — baixa de título TESTE/HML não compõe o resultado
        // REAL da empresa (a linha de baixa permanece no banco como histórico).
        if (idsTeste.has(b.titulo_id)) return;
        const data = b.data_baixa ? b.data_baixa.split('T')[0] : "";
        const entrada = b.titulo_tabela === "financeiro_receber";
        items.push({
          id: `bai-${b.id}`,
          data,
          descricao: entrada ? "Recebimento (baixa)" : "Pagamento (baixa)",
          categoria: entrada ? "Receita Faturamento" : "Custo Prestador",
          tipo: entrada ? "entrada" : "saida",
          valor: Number(b.valor_baixado) || 0,
          origem: "realizado",
          realizado: true,
          status: "realizado",
          conta: b.conta_financeira || undefined,
          forma: b.forma_pagamento || undefined,
        });
      });

      setLancamentos(items);
      setContas(Array.from(new Set(items.map(i => i.conta).filter((c): c is string => !!c))));
    } catch (error: any) {
      console.error("Erro ao buscar dados do fluxo de caixa:", error);
      toast.error("Erro ao carregar dados do fluxo de caixa");
      setLancamentos([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Projeção diária = PREVISTO somente (títulos) — realizado vem das baixas ──
  const dadosAgrupados = useMemo(() => {
    const inicioCustomizado = dataInicio ? new Date(dataInicio) : new Date(Date.now() - parseInt(periodo) * 24 * 60 * 60 * 1000);
    const fimCustomizado = dataFim ? new Date(dataFim) : new Date(Date.now() + parseInt(periodo) * 24 * 60 * 60 * 1000);

    let filtered = lancamentos.filter(l => l.origem === "previsto" && !l.realizado);

    filtered = filtered.filter(l => {
      const dataLanc = new Date(l.data);
      return dataLanc >= inicioCustomizado && dataLanc <= fimCustomizado;
    });

    if (categoria !== "Todas") filtered = filtered.filter(l => l.categoria === categoria);
    if (tipo !== "todos") filtered = filtered.filter(l => l.tipo === tipo);
    if (conta !== "todas") {
      filtered = filtered.filter(l => l.conta === conta || (!l.conta && conta === "Sem conta definida"));
    }

    const agrupado: Record<string, { entrada: number; saida: number }> = {};

    filtered.forEach(l => {
      const dataKey = l.data;
      if (!agrupado[dataKey]) agrupado[dataKey] = { entrada: 0, saida: 0 };
      if (l.tipo === "entrada") agrupado[dataKey].entrada += l.valor;
      else agrupado[dataKey].saida += l.valor;
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
          realizado: false, // projeção: previsto, jamais inferido por status/data
        };
      });
  }, [lancamentos, periodo, categoria, tipo, conta, dataInicio, dataFim, saldoInicial]);

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
            realizado: false,
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
            realizado: false,
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
          realizado: false,
        });
      });
      return meses;
    }
    return dadosAgrupados;
  }, [dadosAgrupados, visualizacao]);

  // ── Indicadores (fonte única: fluxoCaixaService — previsto × realizado) ─────
  const iniFluxo = dataInicio ? new Date(dataInicio) : new Date(Date.now() - parseInt(periodo) * 24 * 60 * 60 * 1000);
  const fimFluxo = dataFim ? new Date(dataFim) : new Date(Date.now() + parseInt(periodo) * 24 * 60 * 60 * 1000);

  const previstosFiltrados: FluxoPrevisto[] = lancamentos
    .filter(l => l.origem === "previsto" && !l.realizado
      && (tipo === "todos" || l.tipo === tipo)
      && (categoria === "Todas" || l.categoria === categoria)
      && (conta === "todas" || l.conta === conta || (conta === "Sem conta definida" && !l.conta))
      && new Date(l.data) >= iniFluxo && new Date(l.data) <= fimFluxo)
    .map(l => ({ tipo: l.tipo, valor: l.valor }));

  const baixasFiltradas: FluxoBaixa[] = lancamentos
    .filter(l => l.origem === "realizado"
      && (tipo === "todos" || l.tipo === tipo)
      && (categoria === "Todas" || l.categoria === categoria)
      && (conta === "todas" || l.conta === conta || (conta === "Sem conta definida" && !l.conta))
      && new Date(l.data) >= iniFluxo && new Date(l.data) <= fimFluxo)
    .map(l => ({
      titulo_tabela: (l.tipo === "entrada" ? "financeiro_receber" : "financeiro_pagar") as FluxoBaixa["titulo_tabela"],
      valor_baixado: l.valor,
      estornada: false,
    }));

  const fluxo = calcularFluxo(previstosFiltrados, baixasFiltradas);
  const totalEntradasPrevistas = fluxo.previstoEntrada;
  const totalSaidasPrevistas = fluxo.previstoSaida;
  const entradasRealizadas = fluxo.realizadoEntrada;
  const saidasRealizadas = fluxo.realizadoSaida;
  const fluxoRealizado = fluxo.fluxoRealizado;

  const saldoAtual = saldoInicial.valor + totalEntradasPrevistas - totalSaidasPrevistas;
  const saldoAcumuladoFinal = dadosProcessados.length > 0
    ? dadosProcessados[dadosProcessados.length - 1].saldoAcumulado
    : saldoInicial.valor;

  const filteredLancamentos = lancamentos.filter(l => {
    if (categoria !== "Todas" && l.categoria !== categoria) return false;
    if (tipo !== "todos" && l.tipo !== tipo) return false;
    if (status === "realizado" && !l.realizado) return false;
    if (status === "previsto" && l.realizado) return false;
    if (conta !== "todas" && l.conta !== conta && !(conta === "Sem conta definida" && !l.conta)) return false;
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
          <p className="text-sm text-muted-foreground">Previsto (títulos) × Realizado (baixas)</p>
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
          <Button variant="outline" className="gap-1">
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
              <span className="text-sm font-medium">Conta:</span>
              <Select value={conta} onValueChange={setConta}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="Sem conta definida">Sem conta definida</SelectItem>
                  {contas.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: "Saldo Inicial", value: saldoInicialConfigurado ? fmtFin(saldoInicial.valor) : "Não configurado", icon: DollarSign, accent: "bg-emerald-500", color: "text-emerald-500" },
          { label: "Entradas Previstas", value: fmtFin(totalEntradasPrevistas), icon: ArrowDownRight, accent: "bg-green-500", color: "text-green-500" },
          { label: "Saídas Previstas", value: fmtFin(totalSaidasPrevistas), icon: ArrowUpRight, accent: "bg-rose-500", color: "text-rose-500" },
          { label: "Saldo Final", value: saldoInicialConfigurado ? fmtFin(saldoAtual) : "—", icon: DollarSign, accent: "bg-blue-500", color: "text-blue-500" },
          { label: "Saldo Acumulado", value: saldoInicialConfigurado ? fmtFin(saldoAcumuladoFinal) : "—", icon: TrendingUp, accent: "bg-violet-500", color: "text-violet-500" },
        ].map(k => (
          <Card key={k.label} className="relative overflow-hidden bg-card border-border shadow-sm hover:-translate-y-0.5 transition-transform">
            <div className={`absolute top-0 left-0 right-0 h-0.5 ${k.accent}`} />
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{k.label}</p>
                  <p className={`text-lg font-extrabold mt-1 ${k.color}`}>{k.value}</p>
                </div>
                <div className={`p-2 rounded-xl bg-muted/40`}><k.icon className={`w-5 h-5 ${k.color}`} /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {!saldoInicialConfigurado && (
        <p className="text-[11px] text-muted-foreground -mt-3">
          Saldo inicial não configurado — depende de Contas &amp; Caixas (F0-H). Totais de saldo exibem "—".
        </p>
      )}

      {/* Comparativo Previsto × Realizado */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-semibold">Comparativo: Previsto × Realizado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-lg bg-muted/30 border border-border/40">
              <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wide">Entradas Realizadas (baixas)</p>
              <p className="text-lg font-extrabold text-foreground mt-1">{fmtFin(entradasRealizadas)}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/30 border border-border/40">
              <p className="text-xs font-semibold text-rose-500 uppercase tracking-wide">Saídas Realizadas (baixas)</p>
              <p className="text-lg font-extrabold text-foreground mt-1">{fmtFin(saidasRealizadas)}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/30 border border-border/40">
              <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide">Fluxo Realizado</p>
              <p className="text-lg font-extrabold text-foreground mt-1">
                {saldoInicialConfigurado ? fmtFin(saldoInicial.valor + fluxoRealizado) : fmtFin(fluxoRealizado)}
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
                <CardTitle className="text-sm font-semibold">Projeção Prevista — Entradas vs Saídas</CardTitle>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dadosProcessados}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number) => fmtFin(value)}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))", borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="entrada" name="Entradas previstas" fill={entradaColor} fillOpacity={0.7} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="saida" name="Saídas previstas" fill={saidaColor} fillOpacity={0.7} radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="saldoAcumulado" name="Saldo Acumulado" stroke="#7c3aed" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {(view === "tabela" || view === "completo") && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-semibold">Lançamentos (previsto × realizado)</CardTitle>
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
                        <TableCell className="text-xs">{l.data ? new Date(l.data).toLocaleDateString("pt-BR") : "—"}</TableCell>
                        <TableCell className="text-sm font-medium">{l.descricao}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{l.categoria}</Badge>
                        </TableCell>
                        <TableCell>
                          {l.realizado ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">Realizado (baixa)</Badge>
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

          {/* Tabela Diária (Projeção Prevista) */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Projeção {visualizacao === 'diario' ? 'Diária' : visualizacao === 'semanal' ? 'Semanal' : visualizacao === 'quinzenal' ? 'Quinzenal' : 'Mensal'} ({periodo} dias) — previsto
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
                    <TableRow key={i}>
                      <TableCell className="text-xs">{d.dia}</TableCell>
                      <TableCell className="text-xs text-green-600 font-mono">{fmtFin(d.entrada)}</TableCell>
                      <TableCell className="text-xs text-red-600 font-mono">{fmtFin(d.saida)}</TableCell>
                      <TableCell className="text-xs font-mono font-medium">{fmtFin(d.entrada - d.saida)}</TableCell>
                      <TableCell className="text-xs font-mono font-bold">
                        {saldoInicialConfigurado ? fmtFin(d.saldoAcumulado) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="w-3 h-3 rounded-full border-2 border-yellow-500" title="Previsto" />
                      </TableCell>
                    </TableRow>
                  ))}
                  {dadosProcessados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum dado previsto no período
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
