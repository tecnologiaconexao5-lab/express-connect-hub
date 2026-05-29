import { useState, useEffect, useMemo } from "react";
import { ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign, Calendar, AlertCircle, FileText, Truck, Wallet, Activity, ChevronUp, ChevronDown, Users, BarChart3, Route, Fuel } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, Line, PieChart, Pie, Cell } from "recharts";
import { supabase } from "@/lib/supabase";

const fmtFin = (v: number) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "—";
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
const fmtNum = (v: number) => v?.toLocaleString("pt-BR") || "0";

const CORES_PIE = ["#3b82f6", "#f87171", "#34d399", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

interface KPICardProps {
  title: string;
  value: string;
  subValue?: string;
  icon: React.ElementType;
  gradient: string;
  iconBg: string;
  trend?: number;
  trendLabel?: string;
  size?: "lg" | "sm";
}

const KPICard = ({ title, value, subValue, icon: Icon, gradient, iconBg, trend, trendLabel, size = "sm" }: KPICardProps) => (
  <div className={`relative group overflow-hidden rounded-xl border bg-card shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 ${size === "lg" ? "p-6" : "p-5"}`}>
    <div className={`absolute top-0 left-0 right-0 h-1 ${gradient}`} />
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</p>
        <p className={`font-black tracking-tight text-foreground truncate ${size === "lg" ? "text-3xl" : "text-2xl"}`}>{value}</p>
        {subValue && <p className="text-xs text-muted-foreground mt-1 font-medium">{subValue}</p>}
        {trend !== undefined && (
          <div className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-bold ${
            trend >= 0
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          }`}>
            {trend >= 0 ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {fmtPct(trend)} {trendLabel ?? "vs mês ant."}
          </div>
        )}
      </div>
      <div className={`flex-shrink-0 ml-3 p-3 rounded-xl ${iconBg} shadow-sm group-hover:scale-110 transition-transform duration-200`}>
        <Icon className={`${size === "lg" ? "w-6 h-6" : "w-5 h-5"} text-white`} />
      </div>
    </div>
  </div>
);

export default function DashboardFinanceiroEnterprise() {
  const [isLoading, setIsLoading] = useState(true);
  const [dadosMesAtual, setDadosMesAtual] = useState<any[]>([]);
  const [dadosMesAnterior, setDadosMesAnterior] = useState<any[]>([]);
  const [dados6Meses, setDados6Meses] = useState<any[]>([]);
  const [pagamentosGeral, setPagamentosGeral] = useState<any[]>([]);
  const [pagamentosPrestador, setPagamentosPrestador] = useState<any[]>([]);
  const [receber, setReceber] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [prestadores, setPrestadores] = useState<any[]>([]);

  const mesAtual = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const mesAnterior = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [
        { data: osMes },
        { data: osAnt },
        { data: os6 },
        { data: pgr },
        { data: ppg },
        { data: rcv },
        { data: cli },
        { data: pre },
      ] = await Promise.all([
        supabase.from("ordens_servico")
          .select("id, numero, cliente_id, prestador_id, valor_cliente, custo_prestador, pedagio, adicionais, descontos, distancia_km, tipo_operacao, status, data, created_at, margem_liquida, margem_bruta, volumes, peso")
          .in("status", ["finalizada", "concluida"])
          .gte("data", `${mesAtual}-01`),
        supabase.from("ordens_servico")
          .select("id, valor_cliente, custo_prestador, data")
          .in("status", ["finalizada", "concluida"])
          .gte("data", `${mesAnterior}-01`)
          .lt("data", `${mesAtual}-01`),
        supabase.from("ordens_servico")
          .select("id, valor_cliente, custo_prestador, data")
          .in("status", ["finalizada", "concluida"])
          .gte("data", `${new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).toISOString().split("T")[0]}`)
          .order("data", { ascending: true }),
        supabase.from("financeiro_pagar")
          .select("id, descricao, valor, status, prestador_id, prestador, data_vencimento, categoria")
          .in("status", ["aberto", "a_vencer", "vencido"]),
        supabase.from("pagamentos_prestadores")
          .select("id, prestador_id, prestador_nome, valor_liquido, valor, status_pagamento, data_competencia, origem_lancamento")
          .in("status_pagamento", ["pendente", "agendado", "em_lote"]),
        supabase.from("financeiro_receber")
          .select("id, cliente_id, cliente, valor, status, data_vencimento, data_pagamento, os_id")
          .order("data_vencimento", { ascending: true }),
        supabase.from("clientes").select("id, nome_fantasia, razao_social, cnpj"),
        supabase.from("prestadores").select("id, nome_completo, cpf_cnpj"),
      ]);

      if (osMes) setDadosMesAtual(osMes);
      if (osAnt) setDadosMesAnterior(osAnt);
      if (os6) setDados6Meses(os6);
      if (pgr) setPagamentosGeral(pgr);
      if (ppg) setPagamentosPrestador(ppg);
      if (rcv) setReceber(rcv);
      if (cli) setClientes(cli);
      if (pre) setPrestadores(pre);
    } catch (e) {
      console.error("[Dashboard] Erro ao buscar dados:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // ── KPIs calculados ──

  const kpis = useMemo(() => {
    const receitaMes = dadosMesAtual.reduce((a: number, o: any) => a + (o.valor_cliente || 0), 0);
    const receitaAnt = dadosMesAnterior.reduce((a: number, o: any) => a + (o.valor_cliente || 0), 0);

    const custoPrestadoresMes = dadosMesAtual.reduce((a: number, o: any) => a + (o.custo_prestador || 0), 0);
    const custoPrestadoresAnt = dadosMesAnterior.reduce((a: number, o: any) => a + (o.custo_prestador || 0), 0);

    const custoGeralMes = pagamentosGeral.filter((r: any) => !r.prestador_id && !r.prestador)
      .reduce((a: number, r: any) => a + (r.valor || 0), 0);

    const custosTotais = custoPrestadoresMes + custoGeralMes;
    const custosAnt = custoPrestadoresAnt + 0;

    const resultado = receitaMes - custosTotais;
    const margemOp = receitaMes > 0 ? (resultado / receitaMes) * 100 : 0;

    const qtdOS = dadosMesAtual.length;
    const custoMedioOS = qtdOS > 0 ? custoPrestadoresMes / qtdOS : 0;
    const ticketMedioOS = qtdOS > 0 ? receitaMes / qtdOS : 0;

    const margemMedia = dadosMesAtual.length > 0
      ? dadosMesAtual.reduce((a: number, o: any) => a + ((o.valor_cliente || 0) > 0
        ? (((o.valor_cliente || 0) - (o.custo_prestador || 0)) / (o.valor_cliente || 1)) * 100 : 0), 0) / dadosMesAtual.length
      : 0;

    const variacaoReceita = receitaAnt > 0 ? ((receitaMes - receitaAnt) / receitaAnt) * 100 : 0;
    const variacaoCusto = custoPrestadoresAnt > 0 ? ((custoPrestadoresMes - custoPrestadoresAnt) / custoPrestadoresAnt) * 100 : 0;

    return { receitaMes, receitaAnt, custosTotais, resultado, margemOp, qtdOS, custoMedioOS, ticketMedioOS, margemMedia, variacaoReceita, variacaoCusto };
  }, [dadosMesAtual, dadosMesAnterior, pagamentosGeral]);

  const kpisSecundarios = useMemo(() => {
    const hoje = new Date();
    const em7dias = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    const hojeStr = hoje.toISOString().split("T")[0];

    const aReceber7d = receber.filter((r: any) =>
      (r.data_vencimento || r.vencimento) >= hojeStr &&
      (r.data_vencimento || r.vencimento) <= em7dias &&
      (r.status === "aberto" || r.status === "a_vencer")
    ).reduce((a: number, r: any) => a + (r.valor || 0), 0);

    const pagarGeral = pagamentosGeral.filter((r: any) => !r.prestador_id && !r.prestador);
    const aPagar7d = pagarGeral.filter((r: any) =>
      (r.data_vencimento) >= hojeStr &&
      (r.data_vencimento) <= em7dias
    ).reduce((a: number, r: any) => a + (r.valor || 0), 0);

    const repassesPendentes = pagamentosPrestador
      .filter((r: any) => r.status_pagamento === "pendente" || r.status_pagamento === "agendado")
      .reduce((a: number, r: any) => a + (r.valor_liquido || r.valor || 0), 0);

    const inadimplencia = receber.filter((r: any) => r.status === "vencido" || r.status === "aberto" && (r.data_vencimento || r.vencimento) < hojeStr)
      .reduce((a: number, r: any) => a + (r.valor || 0), 0);

    const clientesInadimplentes = [...new Set(receber.filter((r: any) =>
      r.status === "vencido" || (r.status === "aberto" && (r.data_vencimento || r.vencimento) < hojeStr)
    ).map((r: any) => r.cliente_id || r.cliente))].length;

    return { aReceber7d, aPagar7d, repassesPendentes, totalCompromissado: aPagar7d + repassesPendentes, inadimplencia, clientesInadimplentes };
  }, [receber, pagamentosGeral, pagamentosPrestador]);

  // ── Gráfico 6 meses ──
  const grafico6Meses = useMemo(() => {
    const porMes: Record<string, { receita: number; despesa: number }> = {};
    dados6Meses.forEach((o: any) => {
      const mes = o.data ? o.data.slice(0, 7) : (o.created_at || "").slice(0, 7);
      if (!mes) return;
      if (!porMes[mes]) porMes[mes] = { receita: 0, despesa: 0 };
      porMes[mes].receita += o.valor_cliente || 0;
      porMes[mes].despesa += o.custo_prestador || 0;
    });
    const meses = Object.keys(porMes).sort();
    const agora = new Date();
    const mesesLabel = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return meses.map(m => {
      const [ano, mesNum] = m.split("-").map(Number);
      const label = `${mesesLabel[mesNum - 1] || mesNum}/${String(ano).slice(2)}`;
      const d = porMes[m];
      return { mes: label, receita: d.receita, despesa: d.despesa, resultado: d.receita - d.despesa };
    });
  }, [dados6Meses]);

  // ── Rankings ──
  const rankings = useMemo(() => {
    const clienteMap = new Map(clientes.map((c: any) => [c.id, c.nome_fantasia || c.razao_social]));
    const prestadorMap = new Map(prestadores.map((p: any) => [p.id, p.nome_completo]));

    const porCliente: Record<string, { id: string; nome: string; receita: number; custo: number; margem: number; qtd: number }> = {};
    dadosMesAtual.forEach((o: any) => {
      const cid = o.cliente_id;
      if (!cid) return;
      if (!porCliente[cid]) porCliente[cid] = { id: cid, nome: clienteMap.get(cid) || "—", receita: 0, custo: 0, margem: 0, qtd: 0 };
      porCliente[cid].receita += o.valor_cliente || 0;
      porCliente[cid].custo += o.custo_prestador || 0;
      porCliente[cid].qtd += 1;
    });
    Object.values(porCliente).forEach(c => {
      c.margem = c.receita > 0 ? ((c.receita - c.custo) / c.receita) * 100 : 0;
    });

    const topClientes = Object.values(porCliente).sort((a, b) => (b.receita - b.custo) - (a.receita - a.custo)).slice(0, 5);

    const porOperacao: Record<string, { tipo: string; receita: number; custo: number; margem: number; qtd: number }> = {};
    dadosMesAtual.forEach((o: any) => {
      const tipo = o.tipo_operacao || "Não classificado";
      if (!porOperacao[tipo]) porOperacao[tipo] = { tipo, receita: 0, custo: 0, margem: 0, qtd: 0 };
      porOperacao[tipo].receita += o.valor_cliente || 0;
      porOperacao[tipo].custo += o.custo_prestador || 0;
      porOperacao[tipo].qtd += 1;
    });
    Object.values(porOperacao).forEach(o => {
      o.margem = o.receita > 0 ? ((o.receita - o.custo) / o.receita) * 100 : 0;
    });

    const opDeficitarias = Object.values(porOperacao).filter(o => o.margem < 0).sort((a, b) => a.margem - b.margem).slice(0, 5);
    const opMaisLucrativa = Object.values(porOperacao).sort((a, b) => (b.receita - b.custo) - (a.receita - a.custo)).slice(0, 1)[0];

    const porPrestador: Record<string, { id: string; nome: string; custo: number; qtd: number }> = {};
    dadosMesAtual.forEach((o: any) => {
      const pid = o.prestador_id;
      if (!pid) return;
      if (!porPrestador[pid]) porPrestador[pid] = { id: pid, nome: prestadorMap.get(pid) || "—", custo: 0, qtd: 0 };
      porPrestador[pid].custo += o.custo_prestador || 0;
      porPrestador[pid].qtd += 1;
    });
    const topPrestadores = Object.values(porPrestador).sort((a, b) => b.custo - a.custo).slice(0, 5);

    const totalKm = dadosMesAtual.reduce((a: number, o: any) => a + (o.distancia_km || 0), 0);
    const custoKmMedio = totalKm > 0 ? kpis.custoPrestadoresMes / totalKm : 0;

    const receitasVencendoHoje = receber.filter((r: any) =>
      r.status === "aberto" && (r.data_vencimento || r.vencimento) === new Date().toISOString().split("T")[0]
    ).slice(0, 5);

    const pagamentosProgramados = pagamentosGeral.filter((r: any) => !r.prestador_id && !r.prestador)
      .filter((r: any) => r.status === "aberto" || r.status === "a_vencer")
      .slice(0, 5);

    const ossSemFatura = dadosMesAtual.filter((o: any) =>
      o.status_faturamento === "a faturar" || !o.status_faturamento
    ).slice(0, 5);

    return { topClientes, opDeficitarias, opMaisLucrativa, topPrestadores, custoKmMedio, receitasVencendoHoje, pagamentosProgramados, ossSemFatura };
  }, [dadosMesAtual, clientes, prestadores, receber, pagamentosGeral, kpis]);

  // ── Dados para pie chart ──
  const dadosPieClientes = useMemo(() => {
    const porCliente: Record<string, number> = {};
    dadosMesAtual.forEach((o: any) => {
      const nome = o.cliente || clientes.find((c: any) => c.id === o.cliente_id)?.nome_fantasia || "—";
      porCliente[nome] = (porCliente[nome] || 0) + (o.valor_cliente || 0);
    });
    return Object.entries(porCliente).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([nome, valor]) => ({ nome, valor }));
  }, [dadosMesAtual, clientes]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 text-muted-foreground py-20 justify-center">
          <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Carregando dashboard financeiro...</p>
        </div>
      </div>
    );
  }

  const semDados = dadosMesAtual.length === 0 && pagamentosGeral.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-2.5 text-foreground">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            Dashboard Financeiro
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {semDados
              ? "Dados insuficientes — finalize OS e cadastre despesas para gerar indicadores"
              : `Análise operacional baseada em ${kpis.qtdOS} OS finalizadas no mês`
            }
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/60 rounded-lg px-3 py-2">
          <Calendar className="w-4 h-4" />
          <span className="font-medium">{new Date().toLocaleDateString("pt-BR", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      {semDados ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <BarChart3 className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-semibold">Nenhum dado disponível</p>
            <p className="text-sm mt-1">Finalize ordens de serviço e cadastre despesas para gerar os indicadores financeiros.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs primários */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Receita do Mês"
              value={fmtFin(kpis.receitaMes)}
              subValue={`${kpis.qtdOS} OS finalizadas`}
              icon={TrendingUp}
              gradient="bg-gradient-to-r from-blue-500 to-blue-600"
              iconBg="bg-gradient-to-br from-blue-500 to-blue-700"
              trend={kpis.variacaoReceita}
              size="lg"
            />
            <KPICard
              title="Custos Operacionais"
              value={fmtFin(kpis.custosTotais)}
              subValue={`${fmtFin(kpis.custoPrestadoresMes)} prestadores + ${fmtFin(kpis.custoGeralMes)} geral`}
              icon={ArrowUpRight}
              gradient="bg-gradient-to-r from-red-500 to-rose-600"
              iconBg="bg-gradient-to-br from-red-500 to-rose-700"
              trend={kpis.variacaoCusto}
              trendLabel="(↓ bom)"
              size="lg"
            />
            <KPICard
              title="Resultado Líquido"
              value={fmtFin(kpis.resultado)}
              subValue={`Margem Operacional: ${kpis.margemOp.toFixed(1)}%`}
              icon={DollarSign}
              gradient={kpis.resultado >= 0 ? "bg-gradient-to-r from-emerald-500 to-green-600" : "bg-gradient-to-r from-red-600 to-rose-700"}
              iconBg={kpis.resultado >= 0 ? "bg-gradient-to-br from-emerald-500 to-green-700" : "bg-gradient-to-br from-red-600 to-rose-800"}
              size="lg"
            />
            <KPICard
              title="Margem Média"
              value={kpis.margemMedia > 0 ? `${kpis.margemMedia.toFixed(1)}%` : "—"}
              subValue={kpis.margemMedia > 0 ? `${kpis.qtdOS} OS no período` : "Dados insuficientes"}
              icon={Activity}
              gradient="bg-gradient-to-r from-violet-500 to-purple-600"
              iconBg="bg-gradient-to-br from-violet-500 to-purple-700"
              size="lg"
            />
          </div>

          {/* KPIs secundários + Margem + Ticket + Custo médio */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KPICard
              title="A Receber (7 dias)"
              value={fmtFin(kpisSecundarios.aReceber7d)}
              icon={ArrowDownRight}
              gradient="bg-gradient-to-r from-amber-400 to-yellow-500"
              iconBg="bg-gradient-to-br from-amber-400 to-yellow-600"
            />
            <KPICard
              title="A Pagar Geral"
              value={fmtFin(kpisSecundarios.aPagar7d)}
              subValue="financeiro_pagar"
              icon={ArrowUpRight}
              gradient="bg-gradient-to-r from-orange-500 to-red-500"
              iconBg="bg-gradient-to-br from-orange-500 to-red-600"
            />
            <KPICard
              title="Repasses Prestadores"
              value={fmtFin(kpisSecundarios.repassesPendentes)}
              subValue="pagamentos_prestadores"
              icon={Truck}
              gradient="bg-gradient-to-r from-violet-500 to-purple-600"
              iconBg="bg-gradient-to-br from-violet-500 to-purple-700"
            />
            <KPICard
              title="Total Compromissado"
              value={fmtFin(kpisSecundarios.totalCompromissado)}
              subValue="Geral + Prestadores"
              icon={Wallet}
              gradient="bg-gradient-to-r from-slate-700 to-slate-900"
              iconBg="bg-gradient-to-br from-slate-700 to-slate-900"
            />
            <KPICard
              title="Inadimplência"
              value={fmtFin(kpisSecundarios.inadimplencia)}
              subValue={`${kpisSecundarios.clientesInadimplentes} cliente(s)`}
              icon={AlertCircle}
              gradient="bg-gradient-to-r from-red-600 to-rose-700"
              iconBg="bg-gradient-to-br from-red-600 to-rose-800"
            />
          </div>

          {/* KPIs operacionais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard
              title="Custo Médio por OS"
              value={kpis.qtdOS > 0 ? fmtFin(kpis.custoMedioOS) : "—"}
              subValue={kpis.qtdOS > 0 ? `${fmtNum(kpis.qtdOS)} OS` : "Dados insuficientes"}
              icon={Truck}
              gradient="bg-gradient-to-r from-cyan-500 to-sky-600"
              iconBg="bg-gradient-to-br from-cyan-500 to-sky-700"
            />
            <KPICard
              title="Ticket Médio por OS"
              value={kpis.qtdOS > 0 ? fmtFin(kpis.ticketMedioOS) : "—"}
              subValue={kpis.qtdOS > 0 ? `${fmtNum(kpis.qtdOS)} OS` : "Dados insuficientes"}
              icon={DollarSign}
              gradient="bg-gradient-to-r from-emerald-500 to-teal-600"
              iconBg="bg-gradient-to-br from-emerald-500 to-teal-700"
            />
            <KPICard
              title="Lucro Operacional Est."
              value={fmtFin(kpis.resultado)}
              subValue={`Margem: ${kpis.margemOp.toFixed(1)}%`}
              icon={Activity}
              gradient="bg-gradient-to-r from-indigo-500 to-indigo-600"
              iconBg="bg-gradient-to-br from-indigo-500 to-indigo-700"
            />
            <KPICard
              title="Custo/Km Médio"
              value={rankings.custoKmMedio > 0 ? fmtFin(rankings.custoKmMedio) : "—"}
              subValue={rankings.custoKmMedio > 0 ? "por km rodado" : "Dados insuficientes"}
              icon={Route}
              gradient="bg-gradient-to-r from-pink-500 to-rose-600"
              iconBg="bg-gradient-to-br from-pink-500 to-rose-700"
            />
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
                  Receita vs Despesa ({grafico6Meses.length > 0 ? "6 meses" : "Dados insuficientes"})
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[280px] pt-4">
                {grafico6Meses.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    Nenhum dado histórico disponível
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={grafico6Meses} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-20" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(value: number) => fmtFin(value)} contentStyle={{ borderRadius: '10px', border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="receita" name="Receita" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="despesa" name="Despesa" fill="#f87171" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="resultado" name="Resultado" fill="#34d399" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" />
                  Distribuição por Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[280px] pt-4">
                {dadosPieClientes.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    Nenhum dado disponível
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={dadosPieClientes} dataKey="valor" nameKey="nome" cx="50%" cy="50%" outerRadius={90} innerRadius={45} label={({ nome, percent }: any) => `${(percent * 100).toFixed(0)}%`}>
                        {dadosPieClientes.map((_, i) => (
                          <Cell key={i} fill={CORES_PIE[i % CORES_PIE.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => fmtFin(value)} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Rankings */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Top clientes por margem */}
            <Card className="shadow-sm">
              <CardHeader className="py-3 px-5 bg-emerald-50/50 dark:bg-emerald-950/20 border-b">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                  <TrendingUp className="w-4 h-4" />
                  Top 5 Clientes por Margem
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {rankings.topClientes.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">Dados insuficientes</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-b bg-muted/20">
                        <TableHead className="h-7 text-[10px] font-semibold text-muted-foreground px-3">Cliente</TableHead>
                        <TableHead className="h-7 text-[10px] font-semibold text-muted-foreground text-right">Receita</TableHead>
                        <TableHead className="h-7 text-[10px] font-semibold text-muted-foreground text-right">Margem</TableHead>
                        <TableHead className="h-7 text-[10px] font-semibold text-muted-foreground text-right px-3">OS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rankings.topClientes.map((c, i) => (
                        <TableRow key={c.id} className="h-9 hover:bg-muted/10">
                          <TableCell className="text-xs font-medium px-3">
                            <span className="text-[10px] text-muted-foreground mr-1.5">#{i + 1}</span>
                            {c.nome}
                          </TableCell>
                          <TableCell className="text-xs text-right font-semibold">{fmtFin(c.receita)}</TableCell>
                          <TableCell className="text-xs text-right font-bold" style={{ color: c.margem >= 0 ? '#16a34a' : '#dc2626' }}>
                            {c.margem.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-xs text-right px-3 text-muted-foreground">{c.qtd}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Operações deficitárias */}
            <Card className="shadow-sm">
              <CardHeader className="py-3 px-5 bg-red-50/50 dark:bg-red-950/20 border-b">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-red-800 dark:text-red-300">
                  <AlertCircle className="w-4 h-4" />
                  Operações Deficitárias
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {rankings.opDeficitarias.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    {dadosMesAtual.length > 0 ? "Nenhuma operação com margem negativa" : "Dados insuficientes"}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-b bg-muted/20">
                        <TableHead className="h-7 text-[10px] font-semibold text-muted-foreground px-3">Tipo</TableHead>
                        <TableHead className="h-7 text-[10px] font-semibold text-muted-foreground text-right">Receita</TableHead>
                        <TableHead className="h-7 text-[10px] font-semibold text-muted-foreground text-right">Custo</TableHead>
                        <TableHead className="h-7 text-[10px] font-semibold text-muted-foreground text-right px-3">Margem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rankings.opDeficitarias.map((o, i) => (
                        <TableRow key={o.tipo} className="h-9 hover:bg-muted/10">
                          <TableCell className="text-xs font-medium px-3">
                            <span className="text-[10px] text-muted-foreground mr-1.5">#{i + 1}</span>
                            {o.tipo}
                          </TableCell>
                          <TableCell className="text-xs text-right">{fmtFin(o.receita)}</TableCell>
                          <TableCell className="text-xs text-right text-red-600 font-medium">{fmtFin(o.custo)}</TableCell>
                          <TableCell className="text-xs text-right px-3 font-bold text-red-600">{o.margem.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Top prestadores por custo */}
            <Card className="shadow-sm">
              <CardHeader className="py-3 px-5 bg-violet-50/50 dark:bg-violet-950/20 border-b">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-violet-800 dark:text-violet-300">
                  <Users className="w-4 h-4" />
                  Top Prestadores por Custo
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {rankings.topPrestadores.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">Dados insuficientes</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-b bg-muted/20">
                        <TableHead className="h-7 text-[10px] font-semibold text-muted-foreground px-3">Prestador</TableHead>
                        <TableHead className="h-7 text-[10px] font-semibold text-muted-foreground text-right">Custo Total</TableHead>
                        <TableHead className="h-7 text-[10px] font-semibold text-muted-foreground text-right">OS</TableHead>
                        <TableHead className="h-7 text-[10px] font-semibold text-muted-foreground text-right px-3">Médio/OS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rankings.topPrestadores.map((p, i) => (
                        <TableRow key={p.id} className="h-9 hover:bg-muted/10">
                          <TableCell className="text-xs font-medium px-3">
                            <span className="text-[10px] text-muted-foreground mr-1.5">#{i + 1}</span>
                            {p.nome}
                          </TableCell>
                          <TableCell className="text-xs text-right font-semibold">{fmtFin(p.custo)}</TableCell>
                          <TableCell className="text-xs text-right text-muted-foreground">{p.qtd}</TableCell>
                          <TableCell className="text-xs text-right px-3 text-muted-foreground">{p.qtd > 0 ? fmtFin(p.custo / p.qtd) : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tabelas de alertas */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Faturas vencendo */}
            <Card className="shadow-sm overflow-hidden">
              <CardHeader className="py-3 px-5 flex flex-row items-center justify-between bg-blue-50/50 dark:bg-blue-950/20 border-b">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-800 dark:text-blue-300">
                  <FileText className="w-4 h-4" />
                  A Receber Hoje
                </CardTitle>
                <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 text-xs font-bold">{rankings.receitasVencendoHoje.length}</Badge>
              </CardHeader>
              <CardContent className="p-0">
                {rankings.receitasVencendoHoje.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">Nenhum recebimento para hoje</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-b bg-muted/20">
                        <TableHead className="h-8 text-[10px] font-semibold text-muted-foreground px-3">Cliente</TableHead>
                        <TableHead className="h-8 text-[10px] font-semibold text-muted-foreground text-right px-3">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rankings.receitasVencendoHoje.map((f: any) => (
                        <TableRow key={f.id} className="h-10 hover:bg-blue-50/30 dark:hover:bg-blue-950/10">
                          <TableCell className="text-xs font-medium px-3">{f.cliente || clientes.find((c: any) => c.id === f.cliente_id)?.nome_fantasia || "—"}</TableCell>
                          <TableCell className="text-xs text-right px-3 font-bold text-blue-700 dark:text-blue-400">{fmtFin(f.valor)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {rankings.receitasVencendoHoje.length > 0 && (
                  <div className="px-3 py-2 border-t bg-muted/10">
                    <p className="text-[10px] text-muted-foreground font-semibold">
                      Total: <span className="text-blue-700">{fmtFin(rankings.receitasVencendoHoje.reduce((a: number, f: any) => a + (f.valor || 0), 0))}</span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pagamentos programados */}
            <Card className="shadow-sm overflow-hidden">
              <CardHeader className="py-3 px-5 flex flex-row items-center justify-between bg-red-50/50 dark:bg-red-950/20 border-b">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-red-800 dark:text-red-300">
                  <DollarSign className="w-4 h-4" />
                  Pagamentos a Vencer
                </CardTitle>
                <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-300 text-xs font-bold">{rankings.pagamentosProgramados.length}</Badge>
              </CardHeader>
              <CardContent className="p-0">
                {rankings.pagamentosProgramados.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">Nenhum pagamento programado</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-b bg-muted/20">
                        <TableHead className="h-8 text-[10px] font-semibold text-muted-foreground px-3">Descrição</TableHead>
                        <TableHead className="h-8 text-[10px] font-semibold text-muted-foreground text-right px-3">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rankings.pagamentosProgramados.map((p: any) => (
                        <TableRow key={p.id} className="h-10 hover:bg-red-50/30 dark:hover:bg-red-950/10">
                          <TableCell className="text-xs font-medium px-3 truncate max-w-[180px]">{p.descricao || p.categoria || "—"}</TableCell>
                          <TableCell className="text-xs text-right px-3 font-bold text-red-600 dark:text-red-400">{fmtFin(p.valor)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {rankings.pagamentosProgramados.length > 0 && (
                  <div className="px-3 py-2 border-t bg-muted/10">
                    <p className="text-[10px] text-muted-foreground font-semibold">
                      Total: <span className="text-red-600">{fmtFin(rankings.pagamentosProgramados.reduce((a: number, p: any) => a + (p.valor || 0), 0))}</span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* OS sem fatura */}
            <Card className="shadow-sm overflow-hidden">
              <CardHeader className="py-3 px-5 flex flex-row items-center justify-between bg-amber-50/50 dark:bg-amber-950/20 border-b">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-800 dark:text-amber-300">
                  <Truck className="w-4 h-4" />
                  OS sem Fatura
                </CardTitle>
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 text-xs font-bold animate-pulse">{rankings.ossSemFatura.length}</Badge>
              </CardHeader>
              <CardContent className="p-0">
                {rankings.ossSemFatura.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">Todas as OS faturadas</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-b bg-muted/20">
                        <TableHead className="h-8 text-[10px] font-semibold text-muted-foreground px-3">OS</TableHead>
                        <TableHead className="h-8 text-[10px] font-semibold text-muted-foreground text-right px-3">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rankings.ossSemFatura.map((o: any) => (
                        <TableRow key={o.id} className="h-10 hover:bg-amber-50/30 dark:hover:bg-amber-950/10">
                          <TableCell className="text-xs font-medium px-3">{o.numero || o.id?.slice(0, 8)}</TableCell>
                          <TableCell className="text-xs text-right px-3 font-bold">{fmtFin(o.valor_cliente || 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {rankings.ossSemFatura.length > 0 && (
                  <div className="px-3 py-2 border-t bg-muted/10">
                    <p className="text-[10px] text-muted-foreground font-semibold">
                      Pendente: <span className="text-amber-700">{fmtFin(rankings.ossSemFatura.reduce((a: number, o: any) => a + (o.valor_cliente || 0), 0))}</span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
