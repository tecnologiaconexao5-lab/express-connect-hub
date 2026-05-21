import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download, Printer, RefreshCw, FileText, DollarSign, TrendingUp,
  Search, Filter, ChevronDown, ChevronUp, Wallet,
  CreditCard, BarChart3, Users, Calendar
} from "lucide-react";
import { toast } from "sonner";
import { gerarPDFRelatorioOperacional, gerarPDFFaturamentoDetalhado } from "@/utils/pdfRelatorioOperacional";
import { exportFaturamentoToExcel } from "@/utils/excelExport";
import {
  buscarDadosFaturamento,
  buscarDadosFaturamentoDetalhado,
  buscarDadosEvolucaoFaturamento,
  buscarClientesAtivos,
  buscarStatusOptions,
  type FiltrosFaturamento,
} from "@/services/relatorios/relatorioService";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Line, ComposedChart
} from "recharts";

const fmtBRL = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtNum = (v: number) => (v || 0).toLocaleString("pt-BR");
const fmtData = (d: string) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "-";

const obterDataLocalFormatada = (date: Date): string => {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
};

const StatusFinanceiroBadge = ({ pago, pendente }: { pago: number; pendente: number }) => {
  if (pendente <= 0) {
    return <Badge className="bg-emerald-500/10 text-emerald-500 border-none rounded-lg">Em dia</Badge>;
  }
  const pctPendente = (pago + pendente) > 0 ? (pendente / (pago + pendente)) * 100 : 100;
  if (pctPendente > 50) {
    return <Badge className="bg-red-500/10 text-red-500 border-none rounded-lg">Crítico</Badge>;
  }
  if (pctPendente > 20) {
    return <Badge className="bg-amber-500/10 text-amber-500 border-none rounded-lg">Atenção</Badge>;
  }
  return <Badge className="bg-emerald-500/10 text-emerald-500 border-none rounded-lg">Em dia</Badge>;
};

const MetricCard = ({ titulo, valor, sub, icone: Icon, cor }: any) => (
  <Card className="border-none shadow-md bg-card rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 border-t-4 border-primary">
    <CardContent className="p-5">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{titulo}</p>
          <p className={`text-2xl font-extrabold mt-1 tracking-tight ${cor || "text-foreground"}`}>{valor}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1 font-medium">{sub}</p>}
        </div>
        <div className="p-3 rounded-2xl bg-primary/10 shrink-0">
          {Icon && <Icon className="w-5 h-5 text-primary" />}
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function RelatorioFaturamentoCliente() {
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState<any[]>([]);
  const [dadosDetalhados, setDadosDetalhados] = useState<any[]>([]);
  const [evolucao, setEvolucao] = useState<any[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [clientesAtivos, setClientesAtivos] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [sortKey, setSortKey] = useState("valor_faturado");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filtroAberto, setFiltroAberto] = useState(true);

  // Timezone-safe initial dates
  const hoje = new Date();
  const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  // Active query filters
  const [filtros, setFiltros] = useState<FiltrosFaturamento>({
    dataInicial: obterDataLocalFormatada(primeiroDiaMes),
    dataFinal: obterDataLocalFormatada(hoje),
    status: "todos",
    cliente: "",
    buscaNome: "",
    buscaCNPJ: "",
    buscaOS: "",
  });

  // UI inputs filters (avoid keystroke queries trigger)
  const [filtrosForm, setFiltrosForm] = useState<FiltrosFaturamento>({ ...filtros });
  const [periodoPreset, setPeriodoPreset] = useState<"hoje" | "semana" | "mes" | "custom">("mes");

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      const [aggData, detalhes, evol, statusOpts, cAtivos] = await Promise.all([
        buscarDadosFaturamento(filtros),
        buscarDadosFaturamentoDetalhado(filtros),
        buscarDadosEvolucaoFaturamento(filtros),
        buscarStatusOptions(),
        buscarClientesAtivos(),
      ]);
      setDados(aggData || []);
      setDadosDetalhados(detalhes || []);
      setEvolucao(evol || []);
      setStatusOptions(statusOpts || []);
      setClientesAtivos(cAtivos || []);
      setPage(1);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar dados do faturamento");
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const aplicarPreset = (preset: "hoje" | "semana" | "mes") => {
    const dataHoje = new Date();
    let inicial = "";
    let final = obterDataLocalFormatada(dataHoje);

    if (preset === "hoje") {
      inicial = obterDataLocalFormatada(dataHoje);
    } else if (preset === "semana") {
      const diaSemana = dataHoje.getDay();
      const diferenca = dataHoje.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
      const segunda = new Date(new Date().setDate(diferenca));
      inicial = obterDataLocalFormatada(segunda);
    } else if (preset === "mes") {
      const primeiroDia = new Date(dataHoje.getFullYear(), dataHoje.getMonth(), 1);
      inicial = obterDataLocalFormatada(primeiroDia);
    }

    setPeriodoPreset(preset);
    const novosFiltros = {
      ...filtrosForm,
      dataInicial: inicial,
      dataFinal: final,
    };
    setFiltrosForm(novosFiltros);
    setFiltros(novosFiltros);
  };

  const totais = useMemo(() => ({
    faturamento: dados.reduce((s, d) => s + (d.valor_faturado || 0), 0),
    qtd: dados.reduce((s, d) => s + (d.quantidade_os || 0), 0),
    ticket: dados.length > 0 ? dados.reduce((s, d) => s + (d.valor_faturado || 0), 0) / dados.reduce((s, d) => s + (d.quantidade_os || 0), 0) || 0 : 0,
    margem: dados.reduce((s, d) => s + (d.margem_total || 0), 0),
    pendente: dados.reduce((s, d) => s + (d.valor_pendente || 0), 0),
    pago: dados.reduce((s, d) => s + (d.valor_pago || 0), 0),
    ativos: clientesAtivos.length,
  }), [dados, clientesAtivos]);

  const sorted = useMemo(() => {
    const sorted = [...dados].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return sorted;
  }, [dados, sortKey, sortDir]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  const totalPages = Math.ceil(sorted.length / pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  };

  const handleExportPDF = async () => {
    if (dados.length === 0) return toast.error("Sem dados para exportar");
    const linhas = sorted.map((d) => [
      d.cliente_nome || "-",
      d.cliente_cnpj || "-",
      String(d.quantidade_os || 0),
      fmtBRL(d.valor_faturado || 0),
      fmtBRL(d.valor_pago || 0),
      fmtBRL(d.valor_pendente || 0),
      fmtBRL(d.ticket_medio || 0),
      fmtData(d.ultima_operacao),
    ]);
    await gerarPDFRelatorioOperacional({
      titulo: "Relatório Operacional de Faturamento",
      subtitulo: "Faturamento por cliente — visão operacional consolidada",
      periodo: `${fmtData(filtros.dataInicial!)} a ${fmtData(filtros.dataFinal!)}`,
      colunas: ["Cliente", "CNPJ", "Qtd OS", "Valor Faturado", "Valor Pago", "Pendência", "Ticket Médio", "Última Operação"],
      linhas,
      totais: [
        { label: "Total de Clientes:", valor: String(dados.length) },
        { label: "Total Faturado:", valor: fmtBRL(totais.faturamento) },
        { label: "Total Pago:", valor: fmtBRL(totais.pago) },
        { label: "Total Pendente:", valor: fmtBRL(totais.pendente) },
        { label: "Total de Operações:", valor: String(totais.qtd) },
        { label: "Ticket Médio:", valor: fmtBRL(totais.ticket) },
      ],
      usuario: "Administrador",
      orientacao: "landscape",
    });
    toast.success("Relatório PDF gerado com sucesso");
  };

  const handleExportExcel = () => {
    if (dados.length === 0) return toast.error("Sem dados para exportar");
    try {
      exportFaturamentoToExcel(sorted, `${filtros.dataInicial}_a_${filtros.dataFinal}`);
      toast.success("Excel exportado com sucesso");
    } catch {
      toast.error("Erro ao gerar arquivo Excel");
    }
  };

  const topClientes = useMemo(() => {
    return [...dados]
      .sort((a, b) => (b.valor_faturado || 0) - (a.valor_faturado || 0))
      .slice(0, 10)
      .map((d) => ({
        nome: d.cliente_nome?.length > 20 ? d.cliente_nome.slice(0, 18) + "..." : d.cliente_nome || "N/D",
        faturamento: d.valor_faturado || 0,
      }));
  }, [dados]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shadow-inner border border-primary/20">
            <BarChart3 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Relatório Operacional de Faturamento</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Faturamento por cliente — visão operacional consolidada do período
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-lg h-9" onClick={handleExportExcel} disabled={loading || dados.length === 0}>
            <FileText className="w-4 h-4 mr-1.5 text-primary" /> Excel
          </Button>
          <Button variant="outline" size="sm" className="rounded-lg h-9" onClick={handleExportPDF} disabled={loading || dados.length === 0}>
            <Download className="w-4 h-4 mr-1.5 text-primary" /> PDF
          </Button>
          <Button variant="outline" size="sm" className="rounded-lg h-9" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1.5 text-primary" /> Imprimir
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-md bg-card rounded-2xl overflow-hidden">
        <div
          className="flex items-center justify-between p-4 cursor-pointer select-none bg-muted/10 hover:bg-muted/20 transition-colors"
          onClick={() => setFiltroAberto(!filtroAberto)}
        >
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Filtros de Pesquisa</span>
          </div>
          <Button variant="ghost" size="sm" className="p-1 h-auto rounded-lg">
            {filtroAberto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
        {filtroAberto && (
          <CardContent className="pt-2 pb-5 px-5">
            {/* Quick Period Presets */}
            <div className="flex flex-wrap items-center gap-1.5 mb-4 border-b border-border/50 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-2">Filtros Rápidos:</span>
              {[
                { id: "hoje", label: "Hoje" },
                { id: "semana", label: "Esta Semana" },
                { id: "mes", label: "Este Mês" },
                { id: "custom", label: "Personalizado" },
              ].map((preset) => (
                <Button
                  key={preset.id}
                  variant={periodoPreset === preset.id ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs px-3 rounded-full font-semibold transition-all"
                  onClick={() => preset.id !== "custom" && aplicarPreset(preset.id as any)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Período Inicial</Label>
                <Input
                  type="date"
                  value={filtrosForm.dataInicial || ""}
                  onChange={(e) => {
                    setFiltrosForm({ ...filtrosForm, dataInicial: e.target.value });
                    setPeriodoPreset("custom");
                  }}
                  className="h-8 text-xs rounded-lg border-muted-foreground/20"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Período Final</Label>
                <Input
                  type="date"
                  value={filtrosForm.dataFinal || ""}
                  onChange={(e) => {
                    setFiltrosForm({ ...filtrosForm, dataFinal: e.target.value });
                    setPeriodoPreset("custom");
                  }}
                  className="h-8 text-xs rounded-lg border-muted-foreground/20"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Status OS</Label>
                <Select
                  value={filtrosForm.status || "todos"}
                  onValueChange={(v) => setFiltrosForm({ ...filtrosForm, status: v })}
                >
                  <SelectTrigger className="h-8 text-xs rounded-lg border-muted-foreground/20">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {statusOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Buscar por Nome</Label>
                <Input
                  placeholder="Nome do cliente..."
                  value={filtrosForm.buscaNome || ""}
                  onChange={(e) => setFiltrosForm({ ...filtrosForm, buscaNome: e.target.value })}
                  className="h-8 text-xs rounded-lg border-muted-foreground/20"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Buscar por CNPJ</Label>
                <Input
                  placeholder="Apenas números..."
                  value={filtrosForm.buscaCNPJ || ""}
                  onChange={(e) => setFiltrosForm({ ...filtrosForm, buscaCNPJ: e.target.value })}
                  className="h-8 text-xs rounded-lg border-muted-foreground/20"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Número OS</Label>
                <Input
                  placeholder="Ex: OS-001..."
                  value={filtrosForm.buscaOS || ""}
                  onChange={(e) => setFiltrosForm({ ...filtrosForm, buscaOS: e.target.value })}
                  className="h-8 text-xs rounded-lg border-muted-foreground/20"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border/50">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs rounded-lg px-4"
                onClick={() => {
                  const resetFiltros = {
                    dataInicial: obterDataLocalFormatada(primeiroDiaMes),
                    dataFinal: obterDataLocalFormatada(hoje),
                    status: "todos",
                    cliente: "",
                    buscaNome: "",
                    buscaCNPJ: "",
                    buscaOS: "",
                  };
                  setFiltrosForm(resetFiltros);
                  setFiltros(resetFiltros);
                  setPeriodoPreset("mes");
                }}
              >
                Limpar
              </Button>
              <Button 
                size="sm" 
                className="h-8 text-xs gap-1.5 rounded-lg px-4 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold"
                onClick={() => setFiltros({ ...filtrosForm })} 
                disabled={loading}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Carregando..." : "Aplicar Filtros"}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <MetricCard titulo="Total Faturado" valor={fmtBRL(totais.faturamento)} icone={DollarSign} cor="text-emerald-500" />
        <MetricCard titulo="Operações" valor={fmtNum(totais.qtd)} sub={`${dados.length} clientes`} icone={BarChart3} cor="text-blue-500" />
        <MetricCard titulo="Ticket Médio" valor={fmtBRL(totais.ticket)} icone={TrendingUp} cor="text-violet-500" />
        <MetricCard titulo="Margem Total" valor={fmtBRL(totais.margem)} icone={Wallet} cor="text-orange-500" />
        <MetricCard titulo="Clientes Ativos" valor={fmtNum(totais.ativos)} icone={Users} cor="text-cyan-500" />
        <MetricCard titulo="Valor Pendente" valor={fmtBRL(totais.pendente)} icone={CreditCard} cor="text-rose-500" />
        <MetricCard titulo="Valor Pago" valor={fmtBRL(totais.pago)} icone={Wallet} cor="text-emerald-500" />
      </div>

      <Tabs defaultValue="tabela" className="w-full">
        <TabsList className="bg-muted/50 rounded-xl p-1">
          <TabsTrigger value="tabela" className="gap-1.5 text-xs rounded-lg"><Search className="w-3.5 h-3.5" /> Faturamento Agregado</TabsTrigger>
          <TabsTrigger value="detalhado" className="gap-1.5 text-xs rounded-lg"><FileText className="w-3.5 h-3.5" /> Ordens de Serviço</TabsTrigger>
          <TabsTrigger value="evolucao" className="gap-1.5 text-xs rounded-lg"><TrendingUp className="w-3.5 h-3.5" /> Evolução</TabsTrigger>
          <TabsTrigger value="top" className="gap-1.5 text-xs rounded-lg"><BarChart3 className="w-3.5 h-3.5" /> Top Clientes</TabsTrigger>
        </TabsList>

        <TabsContent value="tabela" className="pt-4">
          <Card className="border-none shadow-md bg-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    {[
                      { key: "cliente_nome", label: "Cliente", sortable: true },
                      { key: "cliente_cnpj", label: "CNPJ", sortable: true },
                      { key: "quantidade_os", label: "Qtd OS", sortable: true, align: "text-right" },
                      { key: "valor_faturado", label: "Valor Faturado", sortable: true, align: "text-right" },
                      { key: "valor_pago", label: "Valor Pago", sortable: true, align: "text-right" },
                      { key: "valor_pendente", label: "Pendência", sortable: true, align: "text-right" },
                      { key: "ticket_medio", label: "Ticket Médio", sortable: true, align: "text-right" },
                      { key: "ultima_operacao", label: "Última Operação", sortable: true },
                      { key: "status", label: "Status Financeiro", sortable: false },
                      { key: "acoes", label: "Ações", sortable: false, align: "text-center" }
                    ].map((col) => (
                      <TableHead
                        key={col.key}
                        className={`font-semibold text-[10px] uppercase whitespace-nowrap py-3 ${col.align || ""} ${col.sortable ? "cursor-pointer select-none hover:text-primary transition-colors" : ""}`}
                        onClick={() => col.sortable && handleSort(col.key)}
                      >
                        <span className="flex items-center gap-1">
                          {col.label}
                          {col.sortable && sortKey === col.key && (
                            sortDir === "asc" ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                          )}
                        </span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2">
                          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground">Carregando dados faturamento...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginated.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Search className="w-8 h-8 opacity-30" />
                          <span>Nenhum faturamento encontrado. Ajuste os filtros.</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginated.map((d, idx) => (
                      <TableRow
                        key={d.cliente_id || idx}
                        className="hover:bg-muted/40 transition-colors border-b border-border/50 even:bg-muted/20"
                      >
                        <TableCell className="text-xs font-semibold text-foreground">{d.cliente_nome || "-"}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{d.cliente_cnpj || "-"}</TableCell>
                        <TableCell className="text-xs text-right font-bold">{d.quantidade_os || 0}</TableCell>
                        <TableCell className="text-xs text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {fmtBRL(d.valor_faturado || 0)}
                        </TableCell>
                        <TableCell className="text-xs text-right font-semibold text-emerald-600/90 dark:text-emerald-400/90">
                          {fmtBRL(d.valor_pago || 0)}
                        </TableCell>
                        <TableCell className={`text-xs text-right font-bold ${(d.valor_pendente || 0) > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>
                          {fmtBRL(d.valor_pendente || 0)}
                        </TableCell>
                        <TableCell className="text-xs text-right text-muted-foreground font-medium">
                          {fmtBRL(d.ticket_medio || 0)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-medium">
                          {fmtData(d.ultima_operacao)}
                        </TableCell>
                        <TableCell>
                          <StatusFinanceiroBadge pago={d.valor_pago || 0} pendente={d.valor_pendente || 0} />
                        </TableCell>
                        <TableCell className="text-center py-2">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[10px] px-2.5 rounded-lg font-bold border-primary/20 text-primary hover:bg-primary/10 transition-all gap-1"
                              onClick={async () => {
                                await gerarPDFFaturamentoDetalhado(
                                  { nome: d.cliente_nome, cnpj: d.cliente_cnpj },
                                  `${fmtData(filtros.dataInicial)} a ${fmtData(filtros.dataFinal)}`,
                                  d.operacoes || [],
                                  "Administrador"
                                );
                                toast.success(`Fechamento PDF de ${d.cliente_nome} gerado com sucesso`);
                              }}
                            >
                              <Download className="w-3.5 h-3.5" /> Fechamento
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-border/50">
                <span className="text-xs font-semibold text-muted-foreground">
                  Mostrando {(page - 1) * pageSize + 1} a {Math.min(page * pageSize, sorted.length)} de {sorted.length}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs rounded-lg"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                    const p = start + i;
                    if (p > totalPages) return null;
                    return (
                      <Button
                        key={p}
                        variant={p === page ? "default" : "outline"}
                        size="sm"
                        className="h-8 text-xs min-w-[32px] rounded-lg"
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </Button>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs rounded-lg"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Próximo
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="detalhado" className="pt-4">
          <Card className="border-none shadow-md bg-card rounded-2xl overflow-hidden">
            <div className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border/50 bg-muted/5">
              <div>
                <h2 className="text-sm font-bold text-foreground">Detalhamento Financeiro por OS</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Operações individuais com discriminação de taxas, adicionais e descontos</p>
              </div>
              {dadosDetalhados.length > 0 && (
                <Button 
                  size="sm" 
                  className="bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-bold gap-1.5 rounded-lg h-9 px-4 shadow-md transition-all hover:scale-[1.02]"
                  onClick={async () => {
                    const firstItem = dadosDetalhados[0];
                    const clienteNome = filtros.buscaNome || firstItem?.cliente_nome || "Consolidado";
                    const clienteCNPJ = filtros.buscaCNPJ || firstItem?.cliente_cnpj || "-";
                    await gerarPDFFaturamentoDetalhado(
                      { nome: clienteNome, cnpj: clienteCNPJ },
                      `${fmtData(filtros.dataInicial)} a ${fmtData(filtros.dataFinal)}`,
                      dadosDetalhados,
                      "Administrador"
                    );
                    toast.success("Demonstrativo de fechamento comercial detalhado gerado");
                  }}
                >
                  <Download className="w-4 h-4" /> Exportar Fechamento Comercial (PDF)
                </Button>
              )}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="font-semibold text-[10px] uppercase text-center py-3">Data</TableHead>
                    <TableHead className="font-semibold text-[10px] uppercase text-center py-3">OS</TableHead>
                    <TableHead className="font-semibold text-[10px] uppercase py-3">Cliente</TableHead>
                    <TableHead className="font-semibold text-[10px] uppercase py-3">Veículo</TableHead>
                    <TableHead className="font-semibold text-[10px] uppercase py-3">Rota (Origem → Destino)</TableHead>
                    <TableHead className="font-semibold text-[10px] uppercase text-right py-3">Frete Base</TableHead>
                    <TableHead className="font-semibold text-[10px] uppercase text-right py-3">Pedágio</TableHead>
                    <TableHead className="font-semibold text-[10px] uppercase text-right py-3">Ajudante</TableHead>
                    <TableHead className="font-semibold text-[10px] uppercase text-right py-3">Adic. Outros</TableHead>
                    <TableHead className="font-semibold text-[10px] uppercase text-right py-3 text-rose-500">Descontos</TableHead>
                    <TableHead className="font-semibold text-[10px] uppercase text-right py-3 text-emerald-500">Valor Líquido</TableHead>
                    <TableHead className="font-semibold text-[10px] uppercase text-center py-3">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2">
                          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground">Carregando operações...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : dadosDetalhados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-12 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Search className="w-8 h-8 opacity-30" />
                          <span>Nenhuma operação encontrada para os filtros aplicados.</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    dadosDetalhados.map((item, idx) => {
                      const vBase = Number(item.valor_cliente) || 0;
                      const vPedagio = Number(item.pedagio) || 0;
                      const vAjudante = Number(item.ajudante) || 0;
                      const vOutros = Number(item.adicionais) || 0;
                      const vAdic = vPedagio + vAjudante + vOutros;
                      const vDesc = Number(item.descontos) || 0;
                      const vLiquido = vBase + vAdic - vDesc;

                      let rota = "-";
                      if (item.enderecos && Array.isArray(item.enderecos) && item.enderecos.length > 0) {
                        const orig = item.enderecos[0]?.cidade || item.enderecos[0]?.estado || "-";
                        const dest = item.enderecos[item.enderecos.length - 1]?.cidade || item.enderecos[item.enderecos.length - 1]?.estado || "-";
                        rota = `${orig} → ${dest}`;
                      } else if (item.origem_endereco || item.destino_endereco) {
                        rota = `${item.origem_endereco || "-"} → ${item.destino_endereco || "-"}`;
                      }

                      return (
                        <TableRow key={item.id || idx} className="hover:bg-muted/40 transition-colors border-b border-border/50 even:bg-muted/20">
                          <TableCell className="text-xs text-center font-medium text-muted-foreground">{fmtData(item.data_finalizacao || item.created_at || item.data)}</TableCell>
                          <TableCell className="text-xs text-center font-bold text-foreground">{item.numero || item.os_numero || "-"}</TableCell>
                          <TableCell className="text-xs font-semibold text-foreground max-w-[140px] truncate">{item.cliente_nome || "-"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground font-medium">{item.veiculo_tipo || "-"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground font-medium max-w-[180px] truncate">{rota}</TableCell>
                          <TableCell className="text-xs text-right font-semibold text-slate-700 dark:text-slate-300">{fmtBRL(vBase)}</TableCell>
                          <TableCell className="text-xs text-right font-medium text-slate-500">{fmtBRL(vPedagio)}</TableCell>
                          <TableCell className="text-xs text-right font-medium text-slate-500">{fmtBRL(vAjudante)}</TableCell>
                          <TableCell className="text-xs text-right font-medium text-slate-500">{fmtBRL(vOutros)}</TableCell>
                          <TableCell className="text-xs text-right font-bold text-rose-600 dark:text-rose-400">{fmtBRL(vDesc)}</TableCell>
                          <TableCell className="text-xs text-right font-extrabold text-emerald-600 dark:text-emerald-400">{fmtBRL(vLiquido)}</TableCell>
                          <TableCell className="text-xs text-center">
                            <Badge variant="outline" className="text-[10px] font-semibold py-0.5 px-2 bg-muted/40 text-muted-foreground">
                              {item.status || "Finalizada"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="evolucao" className="pt-4">
          <Card className="border-none shadow-md bg-card rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <h3 className="text-sm font-bold mb-4 text-foreground">Evolução Histórica do Faturamento</h3>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={evolucao}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number) => fmtBRL(value)}
                      contentStyle={{ borderRadius: "12px", fontSize: "12px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                    />
                    <Legend />
                    <Bar dataKey="receita" name="Receita" fill="#f97316" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="custo" name="Custo" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="margem" name="Margem" stroke="#22c55e" strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="top" className="pt-4">
          <Card className="border-none shadow-md bg-card rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <h3 className="text-sm font-bold mb-4 text-foreground">Top 10 Clientes por Volume de Faturamento</h3>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topClientes} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} width={150} />
                    <Tooltip
                      formatter={(value: number) => fmtBRL(value)}
                      contentStyle={{ borderRadius: "12px", fontSize: "12px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                    />
                    <Bar dataKey="faturamento" fill="#f97316" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
