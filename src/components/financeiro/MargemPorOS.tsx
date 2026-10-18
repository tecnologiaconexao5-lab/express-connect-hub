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
  DollarSign, TrendingUp, TrendingDown, Percent, FileText,
  RefreshCw, Search, SlidersHorizontal, Printer
} from "lucide-react";
import { toast } from "sonner";
import { gerarPDFProfissional } from "@/utils/pdfGenerator";
import {
  calcularMargemOs,
  calcularIndicadores,
  type MargemOsInput,
  type LinhaMargemOs,
  type IndicadoresMargem,
} from "@/services/financeiro/margemOsService";

// ============================================================================
// F0-I — Margem por OS com fontes reais (sem composicao_financeira_os).
//   Receita = financeiro_receber por os_id/os_vinculadas (real) OU valor
//             operacional confirmado de ordens_servico.valor_cliente (prevista).
//   Custo   = pagamentos_prestadores.valor_liquido (impacto_dre) por os_id/os_numero.
//   Outros  = financeiro_pagar vinculado à OS (sem repasses de prestador).
//   Margem R$ = Receita − Custo − Outros;  Margem % = Margem/Receita×100.
// ============================================================================

const fmtBRL = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v: number) => `${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const fmtData = (d?: string | null) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "-";

const STATUS_LABEL: Record<string, string> = {
  real: "Real",
  prevista: "Prevista",
  pendente: "Pendente",
};

export default function MargemPorOS() {
  const [linhas, setLinhas] = useState<LinhaMargemOs[]>([]);
  const [filtradas, setFiltradas] = useState<LinhaMargemOs[]>([]);
  const [indicadores, setIndicadores] = useState<IndicadoresMargem | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFiltros, setShowFiltros] = useState(false);
  const [clientes, setClientes] = useState<string[]>([]);
  const [prestadores, setPrestadores] = useState<string[]>([]);
  const [statusOsList, setStatusOsList] = useState<string[]>([]);
  const [filtros, setFiltros] = useState({
    dataInicial: "",
    dataFinal: "",
    cliente: "todos",
    prestador: "todos",
    busca: "",
    status: "todas", // prevista | real | pendente
    margem: "todas", // positiva | negativa
    statusOs: "todas",
  });

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      // OS master (fonte de cada operação)
      let q = supabase
        .from("ordens_servico")
        .select(`
          id, numero, cliente, prestador, valor_cliente, data, status,
          clientes!cliente(id, nome_fantasia, razao_social),
          prestadores!prestador(id, nome_completo)
        `)
        .order("data", { ascending: false })
        .limit(500);
      if (filtros.dataInicial) q = q.gte("data", filtros.dataInicial);
      if (filtros.dataFinal) q = q.lte("data", filtros.dataFinal);
      const { data: osData, error: errOs } = await q;
      if (errOs) throw errOs;

      // Receita (fonte única) e custos — no período, mas sem limite de paginação
      const [recR, pgtR, pagR] = await Promise.all([
        supabase.from("financeiro_receber").select("id, os_id, os_vinculadas, valor, status"),
        supabase.from("pagamentos_prestadores").select("id, os_id, os_numero, valor_liquido, impacto_dre"),
        supabase.from("financeiro_pagar").select("id, os_id, descricao, valor"),
      ]);

      const receber = recR.data || [];
      const pagtos = pgtR.data || [];
      const pagar = pagR.data || [];

      const linhasBrutas: LinhaMargemOs[] = (osData || []).map((os: any) => {
        const osId = os.id;
        const osNumero = os.numero || "";

        // Receita: faturamento/receber por os_id ou os_vinculadas (contém numero)
        const receitasOs = receber.filter((r: any) =>
          (r.os_id && String(r.os_id) === osId) ||
          (r.os_vinculadas && String(r.os_vinculadas).includes(osNumero))
        );
        const receitaFaturada = receitasOs.reduce((s: number, r: any) => s + (Number(r.valor) || 0), 0);

        let receita = 0;
        let receitaFonte: MargemOsInput["receitaFonte"] = "sem_receita";
        if (receitaFaturada > 0) {
          receita = receitaFaturada;
          receitaFonte = "faturamento"; // real
        } else if (Number(os.valor_cliente) > 0) {
          receita = Number(os.valor_cliente);
          receitaFonte = "operacional"; // prevista
        }

        // Custo prestador: valor_liquido (impacto_dre) por os_id ou os_numero
        const custoPrestador = pagtos
          .filter((p: any) => !!p.impacto_dre && (p.os_id === osId || (p.os_numero && String(p.os_numero) === osNumero)))
          .reduce((s: number, p: any) => s + (Number(p.valor_liquido) || 0), 0);

        // Outros custos vinculados à OS (fora pagamentos_prestadores, sem repasse)
        const outrosCustos = pagar
          .filter((p: any) => p.os_id === osId && !String(p.descricao || "").toLowerCase().startsWith("repasse"))
          .reduce((s: number, p: any) => s + (Number(p.valor) || 0), 0);

        return calcularMargemOs({
          osId,
          osNumero,
          data: os.data || null,
          clienteNome: os.clientes?.nome_fantasia || os.clientes?.razao_social || null,
          prestadorNome: os.prestadores?.nome_completo || null,
          statusOs: os.status || null,
          receita,
          receitaFonte,
          custoPrestador,
          outrosCustos,
        });
      });

      setLinhas(linhasBrutas);
      setClientes(Array.from(new Set(linhasBrutas.map(l => l.clienteNome).filter((c): c is string => !!c))));
      setPrestadores(Array.from(new Set(linhasBrutas.map(l => l.prestadorNome).filter((p): p is string => !!p))));
      setStatusOsList(Array.from(new Set(linhasBrutas.map(l => l.statusOs).filter((s): s is string => !!s))));
      aplicarFiltros(linhasBrutas, filtros);
    } catch (err: any) {
      console.error("Erro carregar margem por OS:", err);
      toast.error("Erro ao carregar dados");
      setLinhas([]);
      setFiltradas([]);
    } finally {
      setLoading(false);
    }
  }, [filtros.dataInicial, filtros.dataFinal]);

  const aplicarFiltros = useCallback((dataset: LinhaMargemOs[], f: typeof filtros) => {
    const r = dataset.filter((l) => {
      if (f.cliente !== "todos" && l.clienteNome !== f.cliente) return false;
      if (f.prestador !== "todos" && l.prestadorNome !== f.prestador) return false;
      if (f.status !== "todas" && l.statusMargem !== f.status) return false;
      if (f.margem === "positiva" && l.margem < 0) return false;
      if (f.margem === "negativa" && l.margem >= 0) return false;
      if (f.statusOs !== "todas" && l.statusOs !== f.statusOs) return false;
      if (f.busca) {
        const b = f.busca.toLowerCase();
        const alvo = `${l.osNumero || ""} ${l.clienteNome || ""} ${l.prestadorNome || ""}`.toLowerCase();
        if (!alvo.includes(b)) return false;
      }
      return true;
    });
    setFiltradas(r);
    setIndicadores(calcularIndicadores(r));
  }, []);

  useEffect(() => {
    aplicarFiltros(linhas, filtros);
  }, [linhas, filtros, aplicarFiltros]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const setFiltro = (k: keyof typeof filtros, v: string) => setFiltros((p) => ({ ...p, [k]: v }));

  const exportarCSV = () => {
    if (filtradas.length === 0) { toast.error("Sem dados para exportar"); return; }
    const headers = ["OS", "Data", "Cliente", "Prestador", "Status", "Receita", "Custo Prestador", "Outros", "Margem R$", "%"];
    const rows = filtradas.map(l => [
      l.osNumero || (l.osId ? l.osId.slice(0, 8) : "-"),
      l.data || "-",
      l.clienteNome || "-",
      l.prestadorNome || "-",
      STATUS_LABEL[l.statusMargem] || l.statusMargem,
      l.receita.toFixed(2),
      l.custoPrestador.toFixed(2),
      l.outrosCustos.toFixed(2),
      l.margem.toFixed(2),
      `${l.margemPct.toFixed(2)}%`,
    ]);
    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `margem_por_os_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtradas.length} registros exportados`);
  };

  const exportarPDF = () => {
    if (filtradas.length === 0) { toast.error("Sem dados para exportar"); return; }
    gerarPDFProfissional({
      titulo: "Relatório de Margem por OS",
      subtitulo: "Fontes: financeiro_receber / pagamentos_prestadores / financeiro_pagar",
      orientacao: "landscape",
      colunas: ["OS", "Data", "Cliente", "Prestador", "Status", "Receita", "Custo", "Outros", "Margem", "%"],
      linhas: filtradas.map(l => [
        l.osNumero || (l.osId ? l.osId.slice(0, 8) : "-"),
        fmtData(l.data),
        l.clienteNome || "-",
        l.prestadorNome || "-",
        STATUS_LABEL[l.statusMargem] || l.statusMargem,
        l.receita.toFixed(2),
        l.custoPrestador.toFixed(2),
        l.outrosCustos.toFixed(2),
        l.margem.toFixed(2),
        `${l.margemPct.toFixed(2)}%`,
      ]),
      totais: indicadores ? [
        { label: "Receita Total:", valor: fmtBRL(indicadores.receitaTotal) },
        { label: "Custo Total:", valor: fmtBRL(indicadores.custoTotal) },
        { label: "Margem Total:", valor: fmtBRL(indicadores.margemTotal) },
        { label: "Margem Média:", valor: fmtPct(indicadores.margemMediaPct) },
      ] : [],
    });
    toast.success("PDF gerado com sucesso");
  };

  const getMargemBadge = (pct: number) => {
    if (pct < 0) return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
    if (pct < 8) return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  };

  const filtrosAtivosCount = [
    filtros.dataInicial, filtros.dataFinal,
    filtros.cliente !== "todos" ? filtros.cliente : "",
    filtros.prestador !== "todos" ? filtros.prestador : "",
    filtros.busca,
    filtros.status !== "todas" ? filtros.status : "",
    filtros.margem !== "todas" ? filtros.margem : "",
    filtros.statusOs !== "todas" ? filtros.statusOs : "",
  ].filter(Boolean).length;

  const KPIS = [
    { label: "Receita Total", value: fmtBRL(indicadores?.receitaTotal || 0), icon: DollarSign, accent: "bg-emerald-500", color: "text-emerald-500" },
    { label: "Custo Total", value: fmtBRL(indicadores?.custoTotal || 0), icon: TrendingDown, accent: "bg-rose-500", color: "text-rose-500" },
    { label: "Margem Total R$", value: fmtBRL(indicadores?.margemTotal || 0), icon: TrendingUp, accent: (indicadores?.margemTotal ?? 0) >= 0 ? "bg-indigo-500" : "bg-red-500", color: (indicadores?.margemTotal ?? 0) >= 0 ? "text-indigo-500" : "text-red-500" },
    { label: "Margem Média %", value: fmtPct(indicadores?.margemMediaPct || 0), icon: Percent, accent: (indicadores?.margemMediaPct ?? 0) >= 0 ? "bg-green-500" : "bg-red-500", color: (indicadores?.margemMediaPct ?? 0) >= 0 ? "text-green-500" : "text-red-500" },
    { label: "OS com Margem Negativa", value: indicadores?.osNegativas ?? 0, icon: TrendingDown, accent: "bg-amber-500", color: "text-amber-500" },
    { label: "Quantidade de OS", value: indicadores?.quantidadeOs ?? 0, icon: FileText, accent: "bg-blue-500", color: "text-blue-500" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            Margem por OS
          </h2>
          <p className="text-sm text-muted-foreground">Rentabilidade por operação (fontes reais: receber / pagamentos de prestadores)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={carregarDados} disabled={loading} className="gap-1.5">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button variant="outline" size="sm" className={`gap-1.5 relative ${filtrosAtivosCount > 0 ? "border-primary text-primary" : ""}`} onClick={() => setShowFiltros(v => !v)}>
            <SlidersHorizontal className="w-4 h-4" /> Filtros
            {filtrosAtivosCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary rounded-full text-[9px] text-primary-foreground flex items-center justify-center font-bold">{filtrosAtivosCount}</span>
            )}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportarCSV}><FileText className="w-4 h-4" /> CSV</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportarPDF}><FileText className="w-4 h-4" /> PDF</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}><Printer className="w-4 h-4" /> Imprimir</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 items-end">
              <div className="space-y-1"><Label className="text-xs">Data Inicial</Label><Input type="date" value={filtros.dataInicial} onChange={e => setFiltro("dataInicial", e.target.value)} className="h-9" /></div>
              <div className="space-y-1"><Label className="text-xs">Data Final</Label><Input type="date" value={filtros.dataFinal} onChange={e => setFiltro("dataFinal", e.target.value)} className="h-9" /></div>
              <div className="space-y-1">
                <Label className="text-xs">Cliente</Label>
                <Select value={filtros.cliente} onValueChange={v => setFiltro("cliente", v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {clientes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prestador</Label>
                <Select value={filtros.prestador} onValueChange={v => setFiltro("prestador", v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {prestadores.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status Margem</Label>
                <Select value={filtros.status} onValueChange={v => setFiltro("status", v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="real">Real</SelectItem>
                    <SelectItem value="prevista">Prevista</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Margem</Label>
                <Select value={filtros.margem} onValueChange={v => setFiltro("margem", v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="positiva">Positiva</SelectItem>
                    <SelectItem value="negativa">Negativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status OS</Label>
                <Select value={filtros.statusOs} onValueChange={v => setFiltro("statusOs", v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {statusOsList.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Buscar OS / Cliente / Prestador</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                  <Input placeholder="Buscar..." value={filtros.busca} onChange={e => setFiltro("busca", e.target.value)} className="pl-8 h-9" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" className="h-9" onClick={() => aplicarFiltros(linhas, filtros)}>Aplicar</Button>
              <Button size="sm" variant="ghost" className="h-9" onClick={() => setFiltros({ dataInicial: "", dataFinal: "", cliente: "todos", prestador: "todos", busca: "", status: "todas", margem: "todas", statusOs: "todas" })}>Limpar</Button>
              <p className="text-xs text-muted-foreground ml-auto">{filtradas.length} registros</p>
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
                  <TableHead className="text-[11px] font-semibold uppercase pl-4">OS / Romaneio</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase">Data</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase">Cliente</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase">Prestador</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase">Status</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase text-right">Receita</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase text-right">Custo Prest.</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase text-right">Outros</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase text-right">Margem R$</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase text-center">% Margem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-12">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary" />
                    <p className="text-sm text-muted-foreground mt-2">Carregando dados...</p>
                  </TableCell></TableRow>
                ) : filtradas.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-16">
                    <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm font-semibold text-muted-foreground">Nenhuma OS no período</p>
                  </TableCell></TableRow>
                ) : (
                  filtradas.map((l, i) => (
                    <TableRow key={l.osId || i} className="hover:bg-muted/20 group">
                      <TableCell className="pl-4 py-2.5">
                        <span className="font-mono text-xs font-bold text-primary">{l.osNumero || (l.osId ? l.osId.slice(0, 8) : "-")}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground py-2.5">{fmtData(l.data)}</TableCell>
                      <TableCell className="text-xs py-2.5 max-w-[120px] truncate" title={l.clienteNome || ""}>{l.clienteNome || "-"}</TableCell>
                      <TableCell className="text-xs py-2.5 max-w-[120px] truncate" title={l.prestadorNome || ""}>{l.prestadorNome || "-"}</TableCell>
                      <TableCell className="py-2.5">
                        <Badge variant="outline" className={`text-[10px] ${l.statusMargem === "real" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : l.statusMargem === "prevista" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-gray-100 text-gray-500"}`}>
                          {STATUS_LABEL[l.statusMargem] || l.statusMargem}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right text-emerald-600 dark:text-emerald-400 font-semibold py-2.5">{fmtBRL(l.receita)}</TableCell>
                      <TableCell className="text-xs text-right text-rose-500 py-2.5">-{fmtBRL(l.custoPrestador)}</TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground py-2.5">-{fmtBRL(l.outrosCustos)}</TableCell>
                      <TableCell className={`text-xs text-right font-bold py-2.5 ${l.margem < 0 ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400"}`}>{fmtBRL(l.margem)}</TableCell>
                      <TableCell className="text-center py-2.5">
                        <Badge className={`text-xs font-mono font-bold border-0 ${getMargemBadge(l.margemPct)}`}>{fmtPct(l.margemPct)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground">
        Fonte: receita = financeiro_receber (real) ou valor operacional da OS (prevista);
        custo = pagamentos_prestadores.valor_liquido (impacto_dre); outros = financeiro_pagar vinculado à OS.
        Sem dupla contagem.
      </p>
    </div>
  );
}
