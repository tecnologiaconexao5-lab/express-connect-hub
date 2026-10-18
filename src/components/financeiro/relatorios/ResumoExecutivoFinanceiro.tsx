import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, RefreshCw, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  calcularResumoFinanceiro,
  resumirPorCliente,
  resumirPorPrestador,
  calcularInadimplencia,
  filtrarPorPeriodo,
  type RecReceber,
  type RecPagar,
  type RecPagamentoPrestador,
  type RecBaixa,
} from "@/services/financeiro/relatoriosFinanceirosService";

// ============================================================================
// F0-J — Resumo Executivo Financeiro (fontes reais, sem dupla contagem).
// KPIs e tabelas usam o MESMO dataset filtrado.
// ============================================================================

const fmtBRL = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d?: string | null) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "-";

export default function ResumoExecutivoFinanceiro() {
  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const [loading, setLoading] = useState(false);
  const [filtros, setFiltros] = useState({ dataInicial: iso(primeiroDia), dataFinal: iso(hoje), cliente: "todos", prestador: "todos" });

  const [receber, setReceber] = useState<RecReceber[]>([]);
  const [pagar, setPagar] = useState<RecPagar[]>([]);
  const [pagamentos, setPagamentos] = useState<RecPagamentoPrestador[]>([]);
  const [baixasRec, setBaixasRec] = useState<RecBaixa[]>([]);
  const [baixasPag, setBaixasPag] = useState<RecBaixa[]>([]);

  const [clientes, setClientes] = useState<string[]>([]);
  const [prestadores, setPrestadores] = useState<string[]>([]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [r, p, pp, b] = await Promise.all([
        supabase.from("financeiro_receber").select("id, cliente, cliente_nome, valor, data_vencimento, status"),
        supabase.from("financeiro_pagar").select("id, fornecedor_nome, prestador, valor, data_vencimento, status, os_id, descricao"),
        supabase.from("pagamentos_prestadores").select("prestador_nome, valor_liquido, impacto_dre"),
        supabase.from("financeiro_baixas").select("titulo_tabela, titulo_id, valor_baixado, estornada, data_baixa"),
      ]);
      const hojeStr = iso(hoje);
      const receberRaw = (r.data || []).map((x: any) => ({
        id: x.id,
        cliente: x.cliente_nome || x.cliente || null,
        valor: Number(x.valor) || 0,
        data_vencimento: x.data_vencimento || null,
        status: x.status || null,
      }));
      const pagarRaw = (p.data || [])
        .filter((x: any) => !x.os_id && !String(x.descricao || "").toLowerCase().startsWith("repasse"))
        .map((x: any) => ({
          id: x.id,
          fornecedor: x.fornecedor_nome || x.prestador || null,
          valor: Number(x.valor) || 0,
          data_vencimento: x.data_vencimento || null,
          status: x.status || null,
        }));
      const pagamentosRaw = (pp.data || []).map((x: any) => ({
        prestador: x.prestador_nome || null,
        valor_liquido: Number(x.valor_liquido) || 0,
        impacto_dre: !!x.impacto_dre,
      }));
      const baixas = (b.data || [])
        .filter((x: any) => !x.estornada && x.data_baixa && x.data_baixa >= filtros.dataInicial && x.data_baixa <= filtros.dataFinal)
        .map((x: any) => ({
          titulo_tabela: x.titulo_tabela as RecBaixa["titulo_tabela"],
          titulo_id: x.titulo_id || null,
          valor_baixado: Number(x.valor_baixado) || 0,
          estornada: !!x.estornada,
        }));

      const receberPeriodo = filtrarPorPeriodo(receberRaw, (x) => x.data_vencimento, filtros.dataInicial, filtros.dataFinal);
      const pagarPeriodo = filtrarPorPeriodo(pagarRaw, (x) => x.data_vencimento, filtros.dataInicial, filtros.dataFinal);

      setReceber(receberPeriodo);
      setPagar(pagarPeriodo);
      setPagamentos(pagamentosRaw);
      setBaixasRec(baixas.filter((x: RecBaixa) => x.titulo_tabela === "financeiro_receber"));
      setBaixasPag(baixas.filter((x: RecBaixa) => x.titulo_tabela === "financeiro_pagar"));
      setClientes(Array.from(new Set(receberRaw.map((x: RecReceber) => x.cliente).filter((c): c is string => !!c))));
      setPrestadores(Array.from(new Set(pagamentosRaw.map((x) => x.prestador).filter((x): x is string => !!x))));
      void hojeStr;
    } catch (err: any) {
      console.error("Erro resumo financeiro:", err);
      toast.error("Erro ao carregar resumo financeiro");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.dataInicial, filtros.dataFinal]);

  useEffect(() => { carregar(); }, [carregar]);

  // Filtros cliente/prestador aplicados ao MESMO dataset antes dos KPIs
  const dataset = useMemo(() => {
    const rec = filtros.cliente === "todos" ? receber : receber.filter((x) => x.cliente === filtros.cliente);
    const pag = filtros.prestador === "todos" ? pagamentos : pagamentos.filter((x) => x.prestador === filtros.prestador);
    return { receber: rec, pagar, pagamentos: pag, baixasRec, baixasPag };
  }, [receber, pagar, pagamentos, baixasRec, baixasPag, filtros.cliente, filtros.prestador]);

  const resumo = useMemo(() => calcularResumoFinanceiro(dataset), [dataset]);
  const porCliente = useMemo(() => resumirPorCliente(dataset.receber, dataset.baixasRec, iso(hoje)), [dataset]);
  const porPrestador = useMemo(() => resumirPorPrestador(dataset.pagamentos), [dataset]);
  const inadimplencia = useMemo(() => calcularInadimplencia(dataset.receber, dataset.baixasRec, iso(hoje)), [dataset]);

  const exportarCSV = (titulo: string, rows: string[][]) => {
    if (rows.length === 0) { toast.error("Sem dados para exportar"); return; }
    const csv = [rows.map((_, i) => headers[i] || `C${i}`).join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${titulo}_${filtros.dataInicial}_a_${filtros.dataFinal}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado (mesmo dataset dos filtros)");
  };
  const headers = ["Campo", "Valor", "", "", "", "", ""];

  const KPIS = [
    { label: "Faturado (previsto)", value: fmtBRL(resumo.faturado), icon: DollarSign, color: "text-blue-500" },
    { label: "Recebido (realizado)", value: fmtBRL(resumo.recebido), icon: TrendingUp, color: "text-emerald-500" },
    { label: "A Receber", value: fmtBRL(resumo.aReceber), icon: TrendingDown, color: "text-rose-500" },
    { label: "A Pagar (previsto)", value: fmtBRL(resumo.previstoPagar), icon: DollarSign, color: "text-amber-500" },
    { label: "Pago (realizado)", value: fmtBRL(resumo.pagoRealizado), icon: TrendingDown, color: "text-rose-500" },
    { label: "Custo Prestadores", value: fmtBRL(resumo.custoPrestador), icon: TrendingUp, color: "text-violet-500" },
    { label: "Fluxo Líquido", value: fmtBRL(resumo.fluxoLiquido), icon: TrendingUp, color: resumo.fluxoLiquido >= 0 ? "text-emerald-500" : "text-rose-500" },
    { label: "Margem Indicativa", value: fmtBRL(resumo.margemIndicativa), icon: TrendingUp, color: resumo.margemIndicativa >= 0 ? "text-green-600" : "text-red-600" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><TrendingUp className="w-6 h-6 text-primary" /> Resumo Executivo Financeiro</h2>
          <p className="text-sm text-muted-foreground">Faturado, recebido, a receber, pago, a pagar, prestadores — fontes reais</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={carregar} disabled={loading} className="gap-1.5">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </div>

      <Card className="bg-muted/30 border-border">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
            <div className="space-y-1"><Label className="text-xs">Período Inicial</Label><Input type="date" value={filtros.dataInicial} onChange={e => setFiltros(f => ({ ...f, dataInicial: e.target.value }))} className="h-9" /></div>
            <div className="space-y-1"><Label className="text-xs">Período Final</Label><Input type="date" value={filtros.dataFinal} onChange={e => setFiltros(f => ({ ...f, dataFinal: e.target.value }))} className="h-9" /></div>
            <div className="space-y-1">
              <Label className="text-xs">Cliente</Label>
              <Select value={filtros.cliente} onValueChange={v => setFiltros(f => ({ ...f, cliente: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {clientes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Prestador</Label>
              <Select value={filtros.prestador} onValueChange={v => setFiltros(f => ({ ...f, prestador: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {prestadores.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Exportar</Label>
              <Button size="sm" variant="outline" className="h-9 w-full gap-1.5" onClick={() => exportarCSV("resumo", [
                ["Faturado (previsto)", fmtBRL(resumo.faturado)],
                ["Recebido (realizado)", fmtBRL(resumo.recebido)],
                ["A Receber", fmtBRL(resumo.aReceber)],
                ["A Pagar (previsto)", fmtBRL(resumo.previstoPagar)],
                ["Pago (realizado)", fmtBRL(resumo.pagoRealizado)],
                ["Custo Prestadores", fmtBRL(resumo.custoPrestador)],
                ["Fluxo Líquido", fmtBRL(resumo.fluxoLiquido)],
                ["Margem Indicativa", fmtBRL(resumo.margemIndicativa)],
              ])}>
                <Download className="w-4 h-4" /> CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {KPIS.map(k => (
          <Card key={k.label} className="relative overflow-hidden bg-card border-border shadow-sm">
            <CardContent className="p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">{k.label}</p>
              <p className={`text-sm font-extrabold mt-1 ${k.color} leading-tight`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="cliente">
        <TabsList className="bg-muted/50 rounded-xl p-1">
          <TabsTrigger value="cliente" className="gap-1.5 text-xs">Resumo por Cliente</TabsTrigger>
          <TabsTrigger value="prestador" className="gap-1.5 text-xs">Resumo por Prestador</TabsTrigger>
          <TabsTrigger value="inadimplencia" className="gap-1.5 text-xs">Inadimplência</TabsTrigger>
        </TabsList>

        <TabsContent value="cliente" className="pt-3">
          <Card>
            <CardContent className="p-0">
              <div className="p-3 flex justify-end">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => exportarCSV("resumo_clientes", porCliente.map(l => [l.cliente, fmtBRL(l.faturado), fmtBRL(l.recebido), fmtBRL(l.aReceber), fmtBRL(l.vencidos)]))}>
                  <Download className="w-3.5 h-3.5" /> CSV
                </Button>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-[11px] uppercase">Cliente</TableHead>
                  <TableHead className="text-[11px] uppercase text-right">Faturado</TableHead>
                  <TableHead className="text-[11px] uppercase text-right">Recebido (real)</TableHead>
                  <TableHead className="text-[11px] uppercase text-right">A Receber</TableHead>
                  <TableHead className="text-[11px] uppercase text-right">Vencidos</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {porCliente.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum título no período</TableCell></TableRow>
                  ) : porCliente.map((l, i) => (
                    <TableRow key={i} className="hover:bg-muted/20">
                      <TableCell className="text-xs font-medium">{l.cliente}</TableCell>
                      <TableCell className="text-xs text-right font-semibold text-blue-600">{fmtBRL(l.faturado)}</TableCell>
                      <TableCell className="text-xs text-right font-semibold text-emerald-600">{fmtBRL(l.recebido)}</TableCell>
                      <TableCell className="text-xs text-right font-semibold text-rose-500">{fmtBRL(l.aReceber)}</TableCell>
                      <TableCell className="text-xs text-right">{l.vencidos > 0 ? <Badge className="bg-red-100 text-red-700">{fmtBRL(l.vencidos)}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prestador" className="pt-3">
          <Card>
            <CardContent className="p-0">
              <div className="p-3 flex justify-end">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => exportarCSV("resumo_prestadores", porPrestador.map(l => [l.prestador, fmtBRL(l.valorLiquido), String(l.quantidade)]))}>
                  <Download className="w-3.5 h-3.5" /> CSV
                </Button>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-[11px] uppercase">Prestador</TableHead>
                  <TableHead className="text-[11px] uppercase text-right">Valor Líquido (impacto DRE)</TableHead>
                  <TableHead className="text-[11px] uppercase text-right">Qtd</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {porPrestador.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Nenhum pagamento a prestador no período</TableCell></TableRow>
                  ) : porPrestador.map((l, i) => (
                    <TableRow key={i} className="hover:bg-muted/20">
                      <TableCell className="text-xs font-medium">{l.prestador}</TableCell>
                      <TableCell className="text-xs text-right font-semibold text-violet-600">{fmtBRL(l.valorLiquido)}</TableCell>
                      <TableCell className="text-xs text-right">{l.quantidade}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inadimplencia" className="pt-3">
          <Card>
            <CardContent className="p-0">
              <div className="p-3 flex justify-end">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => exportarCSV("inadimplencia", inadimplencia.map(l => [l.cliente, fmtBRL(l.valor), fmtData(l.data_vencimento), String(l.diasAtraso)]))}>
                  <Download className="w-3.5 h-3.5" /> CSV
                </Button>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-[11px] uppercase">Cliente</TableHead>
                  <TableHead className="text-[11px] uppercase text-right">Valor</TableHead>
                  <TableHead className="text-[11px] uppercase">Vencimento</TableHead>
                  <TableHead className="text-[11px] uppercase text-right">Dias em atraso</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {inadimplencia.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum título vencido</TableCell></TableRow>
                  ) : inadimplencia.map((l, i) => (
                    <TableRow key={i} className="hover:bg-muted/20">
                      <TableCell className="text-xs font-medium">{l.cliente}</TableCell>
                      <TableCell className="text-xs text-right font-bold text-rose-600">{fmtBRL(l.valor)}</TableCell>
                      <TableCell className="text-xs">{fmtData(l.data_vencimento)}</TableCell>
                      <TableCell className="text-xs text-right"><Badge className="bg-red-100 text-red-700">{l.diasAtraso}d</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
