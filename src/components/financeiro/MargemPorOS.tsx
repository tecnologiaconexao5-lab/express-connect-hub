import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DollarSign, TrendingUp, TrendingDown, Percent, Users,
  FileText, Download, RefreshCw, Search, SlidersHorizontal, Printer
} from "lucide-react";
import { toast } from "sonner";
import { gerarPDFProfissional } from "@/utils/pdfGenerator";

const fmtBRL = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v: number) => `${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const fmtData = (d: string) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "-";

interface Composicao {
  id: string;
  os_id: string;
  created_at: string;
  valor_cliente: number;
  valor_prestador: number;
  imposto_valor: number;
  seguro_valor: number;
  pedagio_valor: number;
  outros_custos: number;
  margem_bruta: number;
  margem_liquida: number;
  percentual_margem_liquida: number;
  cliente_id?: string;
  prestador_id?: string;
  cliente_nome?: string;
  prestador_nome?: string;
  veiculo_tipo?: string;
}

const TIPOS_VEICULO = [
  "todos", "Fiorino", "VAN", "3/4", "Toco", "Truck", "Carreta", "Bitruck", "Utilitário", "Outros"
];

export default function MargemPorOS() {
  const [dados, setDados] = useState<Composicao[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFiltros, setShowFiltros] = useState(false);
  const [filtros, setFiltros] = useState({
    dataInicial: "",
    dataFinal: "",
    clienteId: "",
    prestadorId: "",
    busca: "",
    tipoVeiculo: "todos",
    margemMinima: "",
  });

  const [kpis, setKpis] = useState({
    receitaTotal: 0,
    totalPrestadores: 0,
    totalOS: 0,
    impostosTaxas: 0,
    pedagioTotal: 0,
    margemBruta: 0,
    margemLiquida: 0,
    pctMargemLiquida: 0,
    ticketMedio: 0,
  });

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("composicao_financeira_os")
        .select("*")
        .order("created_at", { ascending: false });

      if (filtros.dataInicial) query = query.gte("created_at", filtros.dataInicial);
      if (filtros.dataFinal) query = query.lte("created_at", filtros.dataFinal + "T23:59:59");
      if (filtros.clienteId) query = query.eq("cliente_id", filtros.clienteId);
      if (filtros.prestadorId) query = query.eq("prestador_id", filtros.prestadorId);
      if (filtros.tipoVeiculo && filtros.tipoVeiculo !== "todos") {
        query = query.eq("veiculo_tipo", filtros.tipoVeiculo);
      }

      const { data, error } = await query.limit(200);

      if (error) {
        console.warn("Erro na query margem:", error.message);
        setDados([]);
        return;
      }

      let dadosFiltrados = (data || []) as Composicao[];

      // Filtro busca local
      if (filtros.busca) {
        const b = filtros.busca.toLowerCase();
        dadosFiltrados = dadosFiltrados.filter(d =>
          (d.os_id || "").toLowerCase().includes(b) ||
          (d.cliente_nome || "").toLowerCase().includes(b) ||
          (d.prestador_nome || "").toLowerCase().includes(b)
        );
      }

      // Filtro margem mínima
      if (filtros.margemMinima !== "") {
        const minPct = parseFloat(filtros.margemMinima);
        if (!isNaN(minPct)) {
          dadosFiltrados = dadosFiltrados.filter(d => (d.percentual_margem_liquida || 0) >= minPct);
        }
      }

      setDados(dadosFiltrados);

      const receitaTotal = dadosFiltrados.reduce((s, d) => s + (d.valor_cliente || 0), 0);
      const impostosTaxas = dadosFiltrados.reduce((s, d) => s + (d.imposto_valor || 0) + (d.seguro_valor || 0), 0);
      const pedagioTotal = dadosFiltrados.reduce((s, d) => s + (d.pedagio_valor || 0), 0);
      const margemBruta = dadosFiltrados.reduce((s, d) => s + (d.margem_bruta || 0), 0);
      const margemLiquida = dadosFiltrados.reduce((s, d) => s + (d.margem_liquida || 0), 0);
      const pct = receitaTotal > 0 ? (margemLiquida / receitaTotal) * 100 : 0;
      const prestadoresUnicos = new Set(dadosFiltrados.filter(d => d.prestador_id).map(d => d.prestador_id)).size;

      setKpis({
        receitaTotal,
        totalPrestadores: prestadoresUnicos,
        totalOS: dadosFiltrados.length,
        impostosTaxas,
        pedagioTotal,
        margemBruta,
        margemLiquida,
        pctMargemLiquida: pct,
        ticketMedio: dadosFiltrados.length > 0 ? receitaTotal / dadosFiltrados.length : 0,
      });
    } catch (err) {
      console.error("Erro carregar dados margem:", err);
      toast.error("Erro ao carregar dados");
      setDados([]);
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const exportarCSV = () => {
    if (dados.length === 0) { toast.error("Sem dados para exportar"); return; }
    const headers = [
      "OS ID", "Data", "Cliente", "Prestador", "Tipo Veículo",
      "Valor Cliente", "Valor Prestador", "Impostos", "Seguro", "Pedágio",
      "Outros Custos", "Margem Bruta", "Margem Líquida", "% Margem"
    ];
    const rows = dados.map(d => [
      d.os_id ? d.os_id.slice(0, 8) : "-",
      fmtData(d.created_at),
      d.cliente_nome || d.cliente_id?.slice(0, 8) || "-",
      d.prestador_nome || d.prestador_id?.slice(0, 8) || "-",
      d.veiculo_tipo || "-",
      (d.valor_cliente || 0).toFixed(2),
      (d.valor_prestador || 0).toFixed(2),
      (d.imposto_valor || 0).toFixed(2),
      (d.seguro_valor || 0).toFixed(2),
      (d.pedagio_valor || 0).toFixed(2),
      (d.outros_custos || 0).toFixed(2),
      (d.margem_bruta || 0).toFixed(2),
      (d.margem_liquida || 0).toFixed(2),
      (d.percentual_margem_liquida || 0).toFixed(2),
    ]);
    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `margem_real_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${dados.length} registros exportados`);
  };

  const exportarPDF = () => {
    if (dados.length === 0) { toast.error("Sem dados para exportar"); return; }
    
    gerarPDFProfissional({
      titulo: "Relatório de Margem Real por OS",
      subtitulo: `Filtros ativos: ${filtrosAtivosCount}`,
      orientacao: "landscape",
      colunas: ["OS", "Data", "Cliente", "Prestador", "Vl Cliente", "Vl Prestador", "Mg Bruta", "Mg Liq", "%"],
      linhas: dados.map(d => [
        d.os_id ? d.os_id.slice(0, 8) : "-",
        fmtData(d.created_at),
        d.cliente_nome || d.cliente_id?.slice(0, 8) || "-",
        d.prestador_nome || d.prestador_id?.slice(0, 8) || "-",
        (d.valor_cliente || 0).toFixed(2),
        (d.valor_prestador || 0).toFixed(2),
        (d.margem_bruta || 0).toFixed(2),
        (d.margem_liquida || 0).toFixed(2),
        `${(d.percentual_margem_liquida || 0).toFixed(2)}%`
      ]),
      totais: [
        { label: "Receita Total:", valor: fmtBRL(kpis.receitaTotal) },
        { label: "Margem Bruta:", valor: fmtBRL(kpis.margemBruta) },
        { label: "Margem Líquida:", valor: fmtBRL(kpis.margemLiquida) },
        { label: "% Margem Geral:", valor: fmtPct(kpis.pctMargemLiquida) }
      ]
    });
    toast.success("PDF gerado com sucesso");
  };

  const getMargemBadge = (pct: number) => {
    if (pct < 0) return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
    if (pct < 8) return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    if (pct < 15) return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  };

  const limparFiltros = () => setFiltros({
    dataInicial: "", dataFinal: "", clienteId: "", prestadorId: "",
    busca: "", tipoVeiculo: "todos", margemMinima: "",
  });

  const filtrosAtivosCount = [
    filtros.dataInicial, filtros.dataFinal, filtros.clienteId,
    filtros.prestadorId, filtros.busca, filtros.margemMinima,
    filtros.tipoVeiculo !== "todos" ? filtros.tipoVeiculo : ""
  ].filter(Boolean).length;

  const KPIS = [
    { label: "Receita Total", value: fmtBRL(kpis.receitaTotal), icon: DollarSign, accent: "bg-emerald-500", color: "text-emerald-500" },
    { label: "Total de OS", value: kpis.totalOS, icon: FileText, accent: "bg-blue-500", color: "text-blue-500" },
    { label: "Prestadores", value: kpis.totalPrestadores, icon: Users, accent: "bg-violet-500", color: "text-violet-500" },
    { label: "Ticket Médio", value: fmtBRL(kpis.ticketMedio), icon: TrendingUp, accent: "bg-cyan-500", color: "text-cyan-500" },
    { label: "Impostos + Taxas", value: fmtBRL(kpis.impostosTaxas), icon: FileText, accent: "bg-rose-500", color: "text-rose-500" },
    { label: "Pedágio Total", value: fmtBRL(kpis.pedagioTotal), icon: TrendingDown, accent: "bg-amber-500", color: "text-amber-500" },
    { label: "Margem Bruta", value: fmtBRL(kpis.margemBruta), icon: TrendingUp, accent: "bg-indigo-500", color: "text-indigo-500" },
    { label: "Margem Líquida", value: fmtBRL(kpis.margemLiquida), icon: Percent, accent: "bg-green-500", color: "text-green-500" },
    { label: "% Margem Líq.", value: fmtPct(kpis.pctMargemLiquida), icon: Percent, accent: kpis.pctMargemLiquida >= 10 ? "bg-green-500" : kpis.pctMargemLiquida >= 0 ? "bg-amber-500" : "bg-red-500", color: kpis.pctMargemLiquida >= 10 ? "text-green-500" : kpis.pctMargemLiquida >= 0 ? "text-amber-500" : "text-red-500" },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            Relatório Margem Real por OS
          </h2>
          <p className="text-sm text-muted-foreground">Rentabilidade detalhada por ordem de serviço</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={carregarDados} disabled={loading} className="gap-1.5">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={`gap-1.5 relative ${filtrosAtivosCount > 0 ? "border-primary text-primary" : ""}`}
            onClick={() => setShowFiltros(v => !v)}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filtros
            {filtrosAtivosCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary rounded-full text-[9px] text-primary-foreground flex items-center justify-center font-bold">
                {filtrosAtivosCount}
              </span>
            )}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportarCSV}>
            <FileText className="w-4 h-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportarPDF}>
            <Download className="w-4 h-4" /> PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
        {KPIS.map(k => (
          <Card key={k.label} className="relative overflow-hidden bg-card border-border shadow-sm hover:-translate-y-0.5 transition-transform">
            <div className={`absolute top-0 left-0 right-0 h-0.5 ${k.accent}`} />
            <CardContent className="p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">{k.label}</p>
              <p className={`text-base font-extrabold mt-1 ${k.color} leading-tight`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      {showFiltros && (
        <Card className="bg-muted/30 border-border">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Data Inicial</Label>
                <Input type="date" value={filtros.dataInicial} onChange={e => setFiltros(f => ({ ...f, dataInicial: e.target.value }))} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data Final</Label>
                <Input type="date" value={filtros.dataFinal} onChange={e => setFiltros(f => ({ ...f, dataFinal: e.target.value }))} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Buscar OS / Cliente</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                  <Input placeholder="Buscar..." value={filtros.busca} onChange={e => setFiltros(f => ({ ...f, busca: e.target.value }))} className="pl-8 h-9" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo Veículo</Label>
                <Select value={filtros.tipoVeiculo} onValueChange={v => setFiltros(f => ({ ...f, tipoVeiculo: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_VEICULO.map(t => <SelectItem key={t} value={t}>{t === "todos" ? "Todos" : t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Margem Mínima (%)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 5"
                  value={filtros.margemMinima}
                  onChange={e => setFiltros(f => ({ ...f, margemMinima: e.target.value }))}
                  className="h-9"
                  min="-100" max="100" step="1"
                />
              </div>
              <div className="flex gap-2 items-end">
                <Button size="sm" onClick={carregarDados} className="h-9 flex-1">Aplicar</Button>
                {filtrosAtivosCount > 0 && (
                  <Button size="sm" variant="ghost" onClick={limparFiltros} className="h-9">Limpar</Button>
                )}
              </div>
              <div className="flex items-end">
                <p className="text-xs text-muted-foreground">{dados.length} registros</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela */}
      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-[11px] font-semibold uppercase pl-4">OS</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase">Data</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase">Cliente</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase">Prestador</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase">Veículo</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase text-right">Vl. Cliente</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase text-right">Vl. Prestador</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase text-right">Imposto</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase text-right">Seguro</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase text-right">Pedágio</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase text-right">Outros</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase text-right">Mg. Bruta</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase text-right">Mg. Líq.</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase text-center">% Margem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-12">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary" />
                      <p className="text-sm text-muted-foreground mt-2">Carregando dados...</p>
                    </TableCell>
                  </TableRow>
                ) : dados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-16">
                      <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-sm font-semibold text-muted-foreground">Nenhuma OS com composição financeira</p>
                      <p className="text-xs text-muted-foreground mt-1">Ajuste os filtros ou verifique se há OS finalizadas com composição</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  dados.map((d, i) => {
                    const pct = d.percentual_margem_liquida || 0;
                    return (
                      <TableRow key={d.id || i} className="hover:bg-muted/20 group">
                        <TableCell className="pl-4 py-2.5">
                          <span className="font-mono text-xs font-bold text-primary">
                            {d.os_id ? d.os_id.slice(0, 8) : "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground py-2.5">{fmtData(d.created_at)}</TableCell>
                        <TableCell className="text-xs py-2.5 max-w-[120px] truncate" title={d.cliente_nome || d.cliente_id || ""}>
                          {d.cliente_nome || (d.cliente_id ? d.cliente_id.slice(0, 8) : "-")}
                        </TableCell>
                        <TableCell className="text-xs py-2.5 max-w-[120px] truncate" title={d.prestador_nome || d.prestador_id || ""}>
                          {d.prestador_nome || (d.prestador_id ? d.prestador_id.slice(0, 8) : "-")}
                        </TableCell>
                        <TableCell className="py-2.5">
                          {d.veiculo_tipo ? (
                            <Badge variant="outline" className="text-[10px] font-medium">{d.veiculo_tipo}</Badge>
                          ) : <span className="text-xs text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-xs text-right text-emerald-600 dark:text-emerald-400 font-semibold py-2.5">{fmtBRL(d.valor_cliente || 0)}</TableCell>
                        <TableCell className="text-xs text-right text-rose-500 py-2.5">-{fmtBRL(d.valor_prestador || 0)}</TableCell>
                        <TableCell className="text-xs text-right text-rose-400 py-2.5">-{fmtBRL(d.imposto_valor || 0)}</TableCell>
                        <TableCell className="text-xs text-right text-amber-500 py-2.5">-{fmtBRL(d.seguro_valor || 0)}</TableCell>
                        <TableCell className="text-xs text-right text-amber-500 py-2.5">-{fmtBRL(d.pedagio_valor || 0)}</TableCell>
                        <TableCell className="text-xs text-right text-muted-foreground py-2.5">-{fmtBRL(d.outros_custos || 0)}</TableCell>
                        <TableCell className="text-xs text-right font-medium py-2.5">{fmtBRL(d.margem_bruta || 0)}</TableCell>
                        <TableCell className={`text-xs text-right font-bold py-2.5 ${pct < 0 ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                          {fmtBRL(d.margem_liquida || 0)}
                        </TableCell>
                        <TableCell className="text-center py-2.5">
                          <Badge className={`text-xs font-mono font-bold border-0 ${getMargemBadge(pct)}`}>
                            {fmtPct(pct)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {dados.length > 0 && (
            <div className="px-4 py-2 border-t border-border/40 bg-muted/10 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{dados.length} registros exibidos</p>
              <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7" onClick={exportarCSV}>
                <Download className="w-3.5 h-3.5" /> Exportar CSV
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}