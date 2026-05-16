import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Printer, RefreshCw, FileText, DollarSign, Users } from "lucide-react";
import { toast } from "sonner";
import { gerarPDFProfissional } from "@/utils/pdfGenerator";

const fmtBRL = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "-";

export default function RelatorioPagamentoPrestador() {
  const [dados, setDados] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtros, setFiltros] = useState({
    dataInicial: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    dataFinal: new Date().toISOString().split('T')[0],
    prestador: ""
  });

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("ordens_servico")
        .select("id, numero, data_finalizacao, prestador_id, veiculo_tipo, custo_prestador, status")
        .gte("data_finalizacao", filtros.dataInicial)
        .lte("data_finalizacao", filtros.dataFinal + "T23:59:59")
        .eq("status", "finalizada");

      const { data, error } = await query;
      if (error) throw error;

      let filtrados = data || [];
      if (filtros.prestador) {
        filtrados = filtrados.filter((os: any) => 
          (os.prestador_id || "").toLowerCase().includes(filtros.prestador.toLowerCase())
        );
      }

      setDados(filtrados);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const totais = {
    os: dados.length,
    pago: dados.reduce((a, b) => a + (b.custo_prestador || 0), 0),
    ticketMedio: dados.length > 0 ? dados.reduce((a, b) => a + (b.custo_prestador || 0), 0) / dados.length : 0
  };

  const handleExportPDF = async () => {
    if (dados.length === 0) return toast.error("Sem dados para exportar");
    
    await gerarPDFProfissional({
      titulo: "Relatório de Pagamentos - Prestadores",
      subtitulo: `Período: ${fmtData(filtros.dataInicial)} a ${fmtData(filtros.dataFinal)}`,
      colunas: ["OS", "Data Finalização", "Prestador", "Veículo", "Valor (R$)"],
      linhas: dados.map(d => [
        d.numero || d.id.slice(0, 8),
        fmtData(d.data_finalizacao),
        d.prestador_id || "-",
        d.veiculo_tipo || "-",
        (d.custo_prestador || 0).toFixed(2)
      ]),
      totais: [
        { label: "Total de OS:", valor: totais.os.toString() },
        { label: "Total Pago:", valor: fmtBRL(totais.pago) },
        { label: "Ticket Médio:", valor: fmtBRL(totais.ticketMedio) }
      ]
    });
    toast.success("PDF gerado com sucesso");
  };

  const handleExportCSV = () => {
    if (dados.length === 0) return toast.error("Sem dados para exportar");
    const header = "OS;Data;Prestador;Veiculo;Valor\n";
    const rows = dados.map(d => `${d.numero || d.id.slice(0, 8)};${fmtData(d.data_finalizacao)};${d.prestador_id || "-"};${d.veiculo_tipo || "-"};${(d.custo_prestador || 0).toFixed(2)}`).join("\n");
    const blob = new Blob(["\ufeff" + header + rows], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "pagamentos_prestadores.csv";
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success("CSV gerado");
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-4 flex items-end gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Data Inicial</Label>
            <Input type="date" value={filtros.dataInicial} onChange={e => setFiltros({...filtros, dataInicial: e.target.value})} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data Final</Label>
            <Input type="date" value={filtros.dataFinal} onChange={e => setFiltros({...filtros, dataFinal: e.target.value})} className="h-9" />
          </div>
          <div className="space-y-1 flex-1">
            <Label className="text-xs">Prestador</Label>
            <Input placeholder="Buscar prestador..." value={filtros.prestador} onChange={e => setFiltros({...filtros, prestador: e.target.value})} className="h-9" />
          </div>
          <Button onClick={carregarDados} className="h-9" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" className="h-9" onClick={handleExportCSV}>
              <FileText className="w-4 h-4 mr-2" /> CSV
            </Button>
            <Button variant="outline" className="h-9" onClick={handleExportPDF}>
              <Download className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" className="h-9" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" /> Imprimir
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border shadow-sm border-l-4 border-l-amber-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total a Pagar / Pago</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{fmtBRL(totais.pago)}</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-full"><DollarSign className="w-6 h-6 text-amber-500" /></div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm border-l-4 border-l-violet-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">OS Finalizadas</p>
              <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{totais.os}</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-full"><FileText className="w-6 h-6 text-violet-500" /></div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm border-l-4 border-l-cyan-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ticket Médio</p>
              <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{fmtBRL(totais.ticketMedio)}</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-full"><Users className="w-6 h-6 text-cyan-500" /></div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card className="border-border shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="font-semibold text-xs uppercase">OS</TableHead>
                <TableHead className="font-semibold text-xs uppercase">Finalização</TableHead>
                <TableHead className="font-semibold text-xs uppercase">Prestador</TableHead>
                <TableHead className="font-semibold text-xs uppercase">Veículo</TableHead>
                <TableHead className="font-semibold text-xs uppercase text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Carregando...</TableCell></TableRow>
              ) : dados.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado.</TableCell></TableRow>
              ) : (
                dados.map(d => (
                  <TableRow key={d.id} className="hover:bg-muted/40">
                    <TableCell className="text-xs font-mono font-medium">{d.numero || d.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtData(d.data_finalizacao)}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{d.prestador_id || "-"}</TableCell>
                    <TableCell className="text-xs">{d.veiculo_tipo || "-"}</TableCell>
                    <TableCell className="text-xs font-semibold text-right text-rose-600 dark:text-rose-400">{fmtBRL(d.custo_prestador || 0)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
