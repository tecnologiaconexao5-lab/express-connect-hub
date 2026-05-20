import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download, Printer, RefreshCw, FileText, DollarSign, Truck,
  Search, Filter, ChevronDown, ChevronUp, Wallet, CreditCard,
  TrendingUp, BarChart3, Users, AlertCircle, CheckCircle2, Clock
} from "lucide-react";
import { toast } from "sonner";
import { gerarPDFRepassePrestador } from "@/utils/pdfEnterpriseExport";
import { exportPagamentoToExcel } from "@/utils/excelExport";
import {
  buscarDadosPagamentoPrestador,
  type FiltrosPagamento,
} from "@/services/relatorios/relatorioService";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from "recharts";

const fmtBRL = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtNum = (v: number) => (v || 0).toLocaleString("pt-BR");
const fmtData = (d: string) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "-";

const StatusPagtoBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string }> = {
    pago: { label: "Repassado", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
    pendente: { label: "Pendente", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
    aprovado: { label: "Aprovado", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
    cancelado: { label: "Cancelado", cls: "bg-gray-100 text-gray-500 dark:bg-gray-800" },
  };
  const entry = map[status?.toLowerCase()] ?? { label: status || "-", cls: "bg-gray-100 text-gray-500" };
  return (
    <Badge variant="outline" className={`text-[10px] font-semibold px-2 py-0.5 border-0 ${entry.cls}`}>
      {entry.label}
    </Badge>
  );
};

const MetricCard = ({ titulo, valor, sub, icone: Icon, cor }: any) => (
  <Card className="border-border shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">{titulo}</p>
          <p className={`text-xl font-extrabold mt-0.5 ${cor || "text-foreground"}`}>{valor}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>}
        </div>
        <div className="p-2.5 rounded-xl shrink-0 bg-primary/10">
          {Icon && <Icon className="w-5 h-5 text-primary" />}
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function RelatorioPagamentoPrestador() {
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [sortKey, setSortKey] = useState("data_finalizacao");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filtros, setFiltros] = useState<FiltrosPagamento>({
    dataInicial: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
    dataFinal: new Date().toISOString().split("T")[0],
    prestador: "",
    cliente: "",
    statusPagamento: "todos",
  });
  const [filtroAberto, setFiltroAberto] = useState(true);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      const data = await buscarDadosPagamentoPrestador(filtros);
      setDados(data || []);
      setPage(1);
      toast.success(`${data?.length || 0} operações encontradas`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const resumo = useMemo(() => {
    const totalRepasses = dados.reduce((s, d) => s + (Number(d.valor_final_repasse) || 0), 0);
    const qtd = dados.length;
    const media = qtd > 0 ? totalRepasses / qtd : 0;
    const pendencias = dados
      .filter((d) => d.status_pagamento !== "pago")
      .reduce((s, d) => s + (Number(d.valor_final_repasse) || 0), 0);
    const aprovado = dados
      .filter((d) => d.status_pagamento === "aprovado" || d.status_pagamento === "pago")
      .reduce((s, d) => s + (Number(d.valor_final_repasse) || 0), 0);
    return { totalRepasses, qtd, media, pendencias, aprovado };
  }, [dados]);

  const sorted = useMemo(() => {
    return [...dados].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (typeof av === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [dados, sortKey, sortDir]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  const totalPages = Math.ceil(sorted.length / pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
    setPage(1);
  };

  const handleExportPDF = async () => {
    if (dados.length === 0) return toast.error("Sem dados para exportar");
    try {
      await gerarPDFRepassePrestador(sorted, filtros, resumo, "Administrador");
      toast.success("PDF gerado com sucesso");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PDF");
    }
  };

  const handleExportExcel = () => {
    if (dados.length === 0) return toast.error("Sem dados para exportar");
    try {
      exportPagamentoToExcel(sorted, `${filtros.dataInicial}_a_${filtros.dataFinal}`);
      toast.success("Excel gerado com sucesso");
    } catch {
      toast.error("Erro ao gerar Excel");
    }
  };

  const topPrestadores = useMemo(() => {
    const map = new Map<string, number>();
    dados.forEach((d) => {
      const nome = d.prestador_nome || "N/I";
      map.set(nome, (map.get(nome) || 0) + (Number(d.valor_final_repasse) || 0));
    });
    return Array.from(map.entries())
      .map(([nome, valor]) => ({ nome: nome.length > 20 ? nome.slice(0, 18) + "..." : nome, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);
  }, [dados]);

  const prestadoresUnicos = useMemo(() => {
    return [...new Set(dados.map((d) => d.prestador_nome).filter(Boolean))];
  }, [dados]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm">
            <Truck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Repasses a Prestadores</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Relatório operacional de prestação de serviços e repasses financeiros
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={loading || dados.length === 0}>
            <FileText className="w-4 h-4 mr-1.5" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={loading || dados.length === 0}>
            <Download className="w-4 h-4 mr-1.5" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1.5" /> Imprimir
          </Button>
        </div>
      </div>

      <Card className="border-border shadow-sm">
        <div
          className="flex items-center justify-between p-4 cursor-pointer select-none"
          onClick={() => setFiltroAberto(!filtroAberto)}
        >
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Filtros</span>
            {!filtroAberto && dados.length > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {dados.length} resultados
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" className="p-1 h-auto">
            {filtroAberto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
        {filtroAberto && (
          <CardContent className="pt-0 pb-4 px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px]">Período Inicial</Label>
                <Input
                  type="date"
                  value={filtros.dataInicial || ""}
                  onChange={(e) => setFiltros({ ...filtros, dataInicial: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Período Final</Label>
                <Input
                  type="date"
                  value={filtros.dataFinal || ""}
                  onChange={(e) => setFiltros({ ...filtros, dataFinal: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Prestador</Label>
                <Input
                  placeholder="Nome do prestador..."
                  value={filtros.prestador || ""}
                  onChange={(e) => setFiltros({ ...filtros, prestador: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Status Repasse</Label>
                <Select
                  value={filtros.statusPagamento || "todos"}
                  onValueChange={(v) => setFiltros({ ...filtros, statusPagamento: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pago">Repassado</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setFiltros({
                    dataInicial: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
                    dataFinal: new Date().toISOString().split("T")[0],
                    prestador: "",
                    cliente: "",
                    tipoOperacao: "",
                    statusPagamento: "todos",
                    filial: "",
                  });
                }}
              >
                Limpar
              </Button>
              <Button size="sm" className="h-7 text-xs gap-1" onClick={carregarDados} disabled={loading}>
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Carregando..." : "Aplicar"}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard titulo="Total Repasses" valor={fmtBRL(resumo.totalRepasses)} icone={Wallet} cor="text-emerald-600" />
        <MetricCard titulo="Operações" valor={fmtNum(resumo.qtd)} icone={BarChart3} cor="text-blue-600" />
        <MetricCard titulo="Média Operacional" valor={fmtBRL(resumo.media)} icone={TrendingUp} cor="text-violet-600" />
        <MetricCard titulo="Valor Aprovado" valor={fmtBRL(resumo.aprovado)} icone={CheckCircle2} cor="text-cyan-600" />
        <MetricCard titulo="Pendências" valor={fmtBRL(resumo.pendencias)} icone={Clock} cor="text-rose-600" />
      </div>

      <Tabs defaultValue="tabela" className="w-full">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="tabela" className="gap-1.5 text-xs"><Search className="w-3.5 h-3.5" /> Operações</TabsTrigger>
          <TabsTrigger value="top" className="gap-1.5 text-xs"><BarChart3 className="w-3.5 h-3.5" /> Top Prestadores</TabsTrigger>
        </TabsList>

        <TabsContent value="tabela" className="pt-4">
          <Card className="border-border shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    {[
                      { key: "data_finalizacao", label: "Data", sortable: true },
                      { key: "cliente_nome", label: "Cliente", sortable: true },
                      { key: "numero", label: "OS", sortable: true },
                      { key: "veiculo_tipo", label: "Tipo Serviço", sortable: true },
                      { key: "origem", label: "Origem", sortable: false },
                      { key: "destino", label: "Destino", sortable: false },
                      { key: "custo_prestador", label: "Valor Operação", sortable: true, align: "text-right" },
                      { key: "adicionais", label: "Adicional", sortable: true, align: "text-right" },
                      { key: "descontos", label: "Desconto", sortable: true, align: "text-right" },
                      { key: "valor_final_repasse", label: "Repasse Final", sortable: true, align: "text-right" },
                      { key: "status_pagamento", label: "Status", sortable: false },
                    ].map((col) => (
                      <TableHead
                        key={col.key}
                        className={`font-semibold text-[10px] uppercase whitespace-nowrap ${col.align || ""} ${col.sortable ? "cursor-pointer select-none hover:text-primary" : ""}`}
                        onClick={() => col.sortable && handleSort(col.key)}
                      >
                        <span className="flex items-center gap-1">
                          {col.label}
                          {col.sortable && sortKey === col.key && (
                            sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          )}
                        </span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2">
                          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground">Carregando operações...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginated.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Search className="w-8 h-8 opacity-30" />
                          <span>Nenhuma operação encontrada. Ajuste os filtros.</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginated.map((d, idx) => (
                      <TableRow
                        key={d.id || idx}
                        className="hover:bg-muted/40 transition-colors border-b border-border/50 even:bg-muted/20"
                      >
                        <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {fmtData(d.data_finalizacao)}
                        </TableCell>
                        <TableCell className="text-xs font-medium max-w-[180px] truncate">
                          {d.cliente_nome || "-"}
                        </TableCell>
                        <TableCell className="text-xs font-mono font-medium">
                          {d.numero || d.id?.slice(0, 8) || "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {d.veiculo_tipo || "-"}
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground max-w-[120px] truncate">
                          {d.enderecos?.[0]?.cidade || "-"}
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground max-w-[120px] truncate">
                          {d.enderecos?.[d.enderecos.length - 1]?.cidade || "-"}
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono">
                          {fmtBRL(Number(d.custo_prestador) || 0)}
                        </TableCell>
                        <TableCell className="text-xs text-right text-emerald-600 dark:text-emerald-400 font-mono">
                          {fmtBRL(Number(d.adicionais) || 0)}
                        </TableCell>
                        <TableCell className="text-xs text-right text-rose-600 dark:text-rose-400 font-mono">
                          {fmtBRL(Number(d.descontos) || 0)}
                        </TableCell>
                        <TableCell className="text-xs text-right font-semibold font-mono text-primary">
                          {fmtBRL(Number(d.valor_final_repasse) || 0)}
                        </TableCell>
                        <TableCell>
                          <StatusPagtoBadge status={d.status_pagamento || "pendente"} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  Mostrando {(page - 1) * pageSize + 1} a {Math.min(page * pageSize, sorted.length)} de {sorted.length}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline" size="sm" className="h-7 text-xs"
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
                        className="h-7 text-xs min-w-[28px]"
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </Button>
                    );
                  })}
                  <Button
                    variant="outline" size="sm" className="h-7 text-xs"
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

        <TabsContent value="top" className="pt-4">
          <Card className="border-border shadow-sm">
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold mb-4">Top Prestadores por Valor de Repasses</h3>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topPrestadores} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} width={150} />
                    <Tooltip
                      formatter={(value: number) => fmtBRL(value)}
                      contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                    />
                    <Bar dataKey="valor" fill="#f97316" radius={[0, 4, 4, 0]} />
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
