import { useState } from "react";
import { FileText, Download, Filter, Truck, Users, DollarSign, TrendingUp, BarChart3, Calendar, Printer, Building2, ChevronDown, CreditCard, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useLogo } from "@/hooks/useLogo";
import { supabase } from "@/lib/supabase";
import { useEffect } from "react";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface OS {
  id: number;
  numero: string;
  data: string;
  cliente: string;
  prestador: string;
  origem: string;
  destino: string;
  status: string;
  valorCliente: number;
  custoPrestador: number;
  margem: number;
  margemPct: number;
}

// REMOVED MOCK_OS

interface Cliente {
  id: number;
  nome: string;
  cnpj: string;
  totalFaturado: number;
  diarias: number;
  contratosFixos: number;
  operacoes: OS[];
}

// REMOVED MOCK_CLIENTES

interface Prestador {
  id: number;
  nome: string;
  cpfCnpj: string;
  tipo: string;
  totalOperacoes: number;
  valorPago: number;
  score: number;
  ocorrencias: number;
}

// REMOVED MOCK_PRESTADORES

interface PagamentoPrestador {
  id: number;
  prestador: string;
  os: string;
  competencia: string;
  valorBruto: number;
  inss: number;
  irrf: number;
  outrosDescontos: number;
  valorLiquido: number;
  formaPagamento: string;
  status: string;
  banco: string;
  pix: string;
}

const mockPagamentosPrestadores: PagamentoPrestador[] = [
  { id: 1, prestador: "João Transporte", os: "OS-420", competencia: "03/2026", valorBruto: 1800, inss: 198, irrf: 0, outrosDescontos: 0, valorLiquido: 1602, formaPagamento: "PIX", status: "Pago", banco: "", pix: "joao@pix.com" },
  { id: 2, prestador: "João Transporte", os: "OS-425", competencia: "03/2026", valorBruto: 550, inss: 60.5, irrf: 0, outrosDescontos: 0, valorLiquido: 489.5, formaPagamento: "PIX", status: "Pago", banco: "", pix: "joao@pix.com" },
  { id: 3, prestador: "Maria Logistics", os: "OS-421", competencia: "03/2026", valorBruto: 1200, inss: 132, irrf: 0, outrosDescontos: 0, valorLiquido: 1068, formaPagamento: "Transferência", status: "Pago", banco: "Bradesco", pix: "" },
  { id: 4, prestador: "Maria Logistics", os: "OS-424", competencia: "03/2026", valorBruto: 2100, inss: 231, irrf: 52.5, outrosDescontos: 0, valorLiquido: 1816.5, formaPagamento: "Transferência", status: "Pago", banco: "Bradesco", pix: "" },
  { id: 5, prestador: "Transportes ABC", os: "OS-422", competencia: "03/2026", valorBruto: 700, inss: 77, irrf: 0, outrosDescontos: 0, valorLiquido: 623, formaPagamento: "PIX", status: "Pendente", banco: "", pix: "transporte@pix.com" },
  { id: 6, prestador: "Transportes ABC", os: "OS-426", competencia: "03/2026", valorBruto: 900, inss: 99, irrf: 0, outrosDescontos: 50, valorLiquido: 751, formaPagamento: "PIX", status: "Pago", banco: "", pix: "transporte@pix.com" },
  { id: 7, prestador: "João Transporte", os: "OS-427", competencia: "03/2026", valorBruto: 1400, inss: 154, irrf: 0, outrosDescontos: 0, valorLiquido: 1246, formaPagamento: "PIX", status: "Pago", banco: "", pix: "joao@pix.com" },
];

const generateExtratoPDF = (data: OS[], filtros: any) => {
  const doc = new jsPDF();
  
  doc.setFillColor(15, 26, 46);
  doc.rect(0, 0, 220, 30, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text("CONEXÃO EXPRESS", 14, 18);
  doc.setFontSize(12);
  doc.text("EXTRATO OPERACIONAL", 14, 26);
  
  doc.setTextColor(100);
  doc.setFontSize(9);
  doc.text(`Data de emissão: ${new Date().toLocaleDateString("pt-BR")}`, 14, 38);
  
  doc.setDrawColor(249, 115, 22);
  doc.setLineWidth(0.5);
  doc.line(14, 42, 196, 42);
  
  doc.setTextColor(60);
  doc.setFontSize(10);
  doc.text("Filtros Aplicados:", 14, 50);
  doc.setFontSize(9);
  if (filtros.cliente && filtros.cliente !== "todos") doc.text(`• Cliente: ${filtros.cliente}`, 14, 56);
  if (filtros.prestador && filtros.prestador !== "todos") doc.text(`• Prestador: ${filtros.prestador}`, 14, 62);
  if (filtros.status && filtros.status !== "todos") doc.text(`• Status: ${filtros.status}`, 14, 68);
  if (filtros.dataInicio && filtros.dataFim) doc.text(`• Período: ${filtros.dataInicio} a ${filtros.dataFim}`, 14, 74);

  const tableData = data.map(os => [
    os.numero,
    os.data,
    os.cliente,
    os.prestador,
    os.origem,
    os.destino,
    os.status,
    fmtFin(os.valorCliente),
    fmtFin(os.custoPrestador),
    `${os.margemPct.toFixed(1)}%`
  ]);

  autoTable(doc, {
    startY: 80,
    head: [["OS", "Data", "Cliente", "Prestador", "Origem", "Destino", "Status", "Valor", "Custo", "Margem"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [15, 26, 46], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 18 },
      2: { cellWidth: 25 },
      3: { cellWidth: 25 },
      4: { cellWidth: 22 },
      5: { cellWidth: 22 },
      6: { cellWidth: 18 },
      7: { cellWidth: 18, halign: "right" },
      8: { cellWidth: 18, halign: "right" },
      9: { cellWidth: 15, halign: "right" },
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  const totalReceita = data.reduce((acc, os) => acc + os.valorCliente, 0);
  const totalCusto = data.reduce((acc, os) => acc + os.custoPrestador, 0);
  const totalMargem = data.reduce((acc, os) => acc + os.margem, 0);
  const margemMedia = (totalMargem / totalReceita) * 100;

  doc.setFillColor(249, 250, 251);
  doc.rect(14, finalY, 182, 25, "F");
  
  doc.setFontSize(10);
  doc.setTextColor(15, 26, 46);
  doc.text("TOTAIS", 18, finalY + 8);
  
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Total de OS: ${data.length}`, 18, finalY + 15);
  doc.text(`Receita Total: ${fmtFin(totalReceita)}`, 18, finalY + 21);
  doc.text(`Custo Total: ${fmtFin(totalCusto)}`, 80, finalY + 15);
  doc.text(`Margem Total: ${fmtFin(totalMargem)}`, 80, finalY + 21);
  doc.setTextColor(22, 163, 74);
  doc.text(`Margem Média: ${margemMedia.toFixed(1)}%`, 140, finalY + 18);

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Documento gerado automaticamente pelo Sistema Conexão Express", 105, 285, { align: "center" });

  doc.save("extrato_operacional.pdf");
};

const generateFaturamentoPDF = (cliente: Cliente) => {
  const doc = new jsPDF();
  
  doc.setFillColor(15, 26, 46);
  doc.rect(0, 0, 220, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text("CONEXÃO EXPRESS", 14, 14);
  
  doc.setTextColor(249, 115, 22);
  doc.setFontSize(14);
  doc.text("RELATÓRIO DE FATURAMENTO", 14, 32);
  
  doc.setDrawColor(249, 115, 22);
  doc.setLineWidth(0.5);
  doc.line(14, 36, 196, 36);
  
  doc.setFillColor(249, 249, 249);
  doc.rect(14, 42, 90, 35, "F");
  doc.setTextColor(15, 26, 46);
  doc.setFontSize(11);
  doc.text("CLIENTE", 18, 50);
  doc.setFontSize(10);
  doc.text(cliente.nome, 18, 58);
  doc.text(`CNPJ: ${cliente.cnpj}`, 18, 65);
  
  doc.setFillColor(249, 115, 22);
  doc.rect(110, 42, 86, 35, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text("RESUMO EXECUTIVO", 118, 50);
  doc.setFontSize(10);
  doc.text(`Total Faturado: ${fmtFin(cliente.totalFaturado)}`, 118, 58);
  doc.text(`Diárias/Contratos: ${cliente.diarias + cliente.contratosFixos}`, 118, 65);
  doc.text(`Operações: ${cliente.operacoes.length}`, 118, 72);

  const tableData = cliente.operacoes.map(os => [
    os.numero,
    os.data,
    os.origem,
    os.destino,
    os.status,
    fmtFin(os.valorCliente)
  ]);

  autoTable(doc, {
    startY: 85,
    head: [["OS", "Data", "Origem", "Destino", "Status", "Valor"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [15, 26, 46], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 8 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  doc.setFontSize(10);
  doc.setTextColor(15, 26, 46);
  doc.text("CONDIÇÕES DE FATURAMENTO", 14, finalY);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("• Faturamento mensal via NF-e", 14, finalY + 6);
  doc.text("• Prazo de pagamento: 30 dias", 14, finalY + 12);
  doc.text("• Contrato de nivel de serviço vigente", 14, finalY + 18);

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Emitido em: ${new Date().toLocaleString("pt-BR")}`, 105, 280, { align: "center" });

  doc.save(`faturamento_${cliente.nome.replace(/\s/g, "_")}.pdf`);
};

export default function RelatoriosEnterprise() {
  const [view, setView] = useState("extrato");
  const [filtros, setFiltros] = useState({
    dataInicio: "",
    dataFim: "",
    cliente: "todos",
    prestador: "todos",
    status: "todos"
  });
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);

  const [relatorioOS, setRelatorioOS] = useState<OS[]>([]);
  const [relatorioClientes, setRelatorioClientes] = useState<Cliente[]>([]);
  const [relatorioPrestadores, setRelatorioPrestadores] = useState<Prestador[]>([]);
  
  useEffect(() => {
    async function loadData() {
      // 1. Fetch OS
      const { data: osData } = await supabase.from("ordens_servico").select("*").order("data", { ascending: false });
      const fmtdOS: OS[] = (osData || []).map(o => {
         const margem = (o.valor_cliente || 0) - (o.custo_prestador || 0);
         const margemPct = o.valor_cliente > 0 ? (margem / o.valor_cliente) * 100 : 0;
         return {
           id: o.id,
           numero: o.numero,
           data: o.data || "",
           cliente: o.cliente || "Avulso",
           prestador: o.prestador || "Não alocado",
           origem: o.enderecos?.[0]?.cidade || "N/A",
           destino: o.enderecos?.[o.enderecos.length-1]?.cidade || "N/A",
           status: o.status || "Pendente",
           valorCliente: o.valor_cliente || 0,
           custoPrestador: o.custo_prestador || 0,
           margem: margem,
           margemPct: margemPct
         };
      });
      setRelatorioOS(fmtdOS);

      // 2. Fetch Clientes
      const { data: cliData } = await supabase.from("clientes").select("*");
      const fmtdCli: Cliente[] = (cliData || []).map(c => {
         const ops = fmtdOS.filter(o => o.cliente === c.nome_fantasia || o.cliente === c.razao_social);
         return {
            id: c.id,
            nome: c.nome_fantasia || c.razao_social || "",
            cnpj: c.cnpj || "",
            totalFaturado: ops.reduce((sum, o) => sum + o.valorCliente, 0),
            diarias: 0,
            contratosFixos: 0,
            operacoes: ops
         };
      });
      setRelatorioClientes(fmtdCli);

      // 3. Fetch Prestadores
      const { data: prestData } = await supabase.from("prestadores").select("*");
      const fmtdPrest: Prestador[] = (prestData || []).map(p => {
         const ops = fmtdOS.filter(o => o.prestador === p.nome_completo);
         return {
            id: p.id,
            nome: p.nome_completo || "",
            cpfCnpj: p.cpf_cnpj || "",
            tipo: p.tipo_parceiro || "Agregado",
            totalOperacoes: ops.length,
            valorPago: ops.reduce((sum, o) => sum + o.custoPrestador, 0),
            score: p.score_interno || 4.0,
            ocorrencias: 0
         };
      });
      setRelatorioPrestadores(fmtdPrest);
    }
    loadData();
  }, []);

  const clientesUnicos = Array.from(new Set(relatorioOS.map(o => o.cliente).filter(Boolean)));
  const prestadoresUnicos = Array.from(new Set(relatorioOS.map(o => o.prestador).filter(Boolean)));
  const statusUnicos = Array.from(new Set(relatorioOS.map(o => o.status).filter(Boolean)));

  const filteredOS = relatorioOS.filter(os => {
    if (filtros.cliente !== "todos" && os.cliente !== filtros.cliente) return false;
    if (filtros.prestador !== "todos" && os.prestador !== filtros.prestador) return false;
    if (filtros.status !== "todos" && os.status !== filtros.status) return false;
    if (filtros.dataInicio && os.data && os.data < filtros.dataInicio) return false;
    if (filtros.dataFim && os.data && os.data > filtros.dataFim) return false;
    return true;
  });

  const totalReceita = filteredOS.reduce((acc, os) => acc + os.valorCliente, 0);
  const totalCusto = filteredOS.reduce((acc, os) => acc + os.custoPrestador, 0);
  const totalMargem = filteredOS.reduce((acc, os) => acc + os.margem, 0);
  const margemMedia = totalReceita > 0 ? (totalMargem / totalReceita) * 100 : 0;

  const scatterData = relatorioOS.map(os => ({
    x: os.custoPrestador,
    y: os.margem,
    z: os.valorCliente,
    nome: os.numero
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header enterprise */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm">
            <BarChart3 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatórios Enterprise</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Análises gerenciais, extrato operacional e exportação PDF corporativo</p>
          </div>
        </div>
      </div>

      <Tabs value={view} onValueChange={setView} className="w-full">
        {/* Tabs underline enterprise */}
        <div className="border-b border-border mb-6">
          <TabsList className="h-auto bg-transparent p-0 gap-0">
            <TabsTrigger value="extrato" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary pb-3 px-5 gap-2">
              <FileText className="w-4 h-4"/>Extrato Operacional
            </TabsTrigger>
            <TabsTrigger value="faturamento" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary pb-3 px-5 gap-2">
              <Building2 className="w-4 h-4"/>Faturamento Cliente
            </TabsTrigger>
            <TabsTrigger value="margem" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary pb-3 px-5 gap-2">
              <TrendingUp className="w-4 h-4"/>Margem Operação
            </TabsTrigger>
            <TabsTrigger value="prestadores" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary pb-3 px-5 gap-2">
              <Truck className="w-4 h-4"/>Prestadores
            </TabsTrigger>
          </TabsList>
        </div>

        {/* EXTRATO OPERACIONAL */}
        <TabsContent value="extrato" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filtros
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Data Início</label>
                  <Input type="date" className="mt-1" value={filtros.dataInicio} onChange={(e) => setFiltros({...filtros, dataInicio: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Data Fim</label>
                  <Input type="date" className="mt-1" value={filtros.dataFim} onChange={(e) => setFiltros({...filtros, dataFim: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Cliente</label>
                  <Select value={filtros.cliente} onValueChange={(v) => setFiltros({...filtros, cliente: v})}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {clientesUnicos.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Prestador</label>
                  <Select value={filtros.prestador} onValueChange={(v) => setFiltros({...filtros, prestador: v})}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {prestadoresUnicos.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Status</label>
                  <Select value={filtros.status} onValueChange={(v) => setFiltros({...filtros, status: v})}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {statusUnicos.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(filtros.cliente !== "todos" || filtros.prestador !== "todos" || filtros.status !== "todos" || filtros.dataInicio || filtros.dataFim) && (
                <div className="mt-3 flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => setFiltros({ dataInicio: "", dataFim: "", cliente: "todos", prestador: "todos", status: "todos" })}>
                    Limpar Filtros
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
              {[
                { label: "Total OS", value: filteredOS.length, color: "text-slate-700" },
                { label: "Receita", value: fmtFin(totalReceita), color: "text-blue-700" },
                { label: "Custo", value: fmtFin(totalCusto), color: "text-red-600" },
                { label: "Margem Média", value: `${margemMedia.toFixed(1)}%`, color: margemMedia >= 0 ? "text-green-600" : "text-red-600" },
              ].map((kpi, i) => (
                <Card key={i} className="border shadow-sm">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">{kpi.label}</p>
                    <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Button onClick={() => generateExtratoPDF(filteredOS, filtros)} className="gap-2 bg-orange-500 hover:bg-orange-600 ml-4">
              <Download className="w-4 h-4" />
              Gerar PDF
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº OS</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Prestador</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor Cliente</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOS.map((os) => (
                    <TableRow key={os.id}>
                      <TableCell className="font-medium">{os.numero}</TableCell>
                      <TableCell className="text-sm">{os.data}</TableCell>
                      <TableCell>{os.cliente}</TableCell>
                      <TableCell className="text-sm">{os.prestador}</TableCell>
                      <TableCell className="text-sm">{os.origem}</TableCell>
                      <TableCell className="text-sm">{os.destino}</TableCell>
                      <TableCell>
                        <Badge className={os.status === "Concluída" ? "bg-green-100 text-green-800" : os.status === "Em Andamento" ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"}>
                          {os.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{fmtFin(os.valorCliente)}</TableCell>
                      <TableCell className="text-right font-mono text-red-600">{fmtFin(os.custoPrestador)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold text-green-600">{fmtFin(os.margem)} ({os.margemPct.toFixed(1)}%)</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* KPI cards — dark mode safe */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 shadow-sm hover:shadow-md transition">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total OS</p>
              <p className="text-2xl font-extrabold text-foreground">{filteredOS.length}</p>
              <div className="h-1 w-full bg-blue-500/20 rounded-full mt-1"><div className="h-full bg-blue-500 rounded-full" style={{width:'60%'}}/></div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 shadow-sm hover:shadow-md transition">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Receita Total</p>
              <p className="text-2xl font-extrabold text-emerald-500">{fmtFin(totalReceita)}</p>
              <div className="h-1 w-full bg-emerald-500/20 rounded-full mt-1"><div className="h-full bg-emerald-500 rounded-full" style={{width:'80%'}}/></div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 shadow-sm hover:shadow-md transition">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Custo Total</p>
              <p className="text-2xl font-extrabold text-rose-500">{fmtFin(totalCusto)}</p>
              <div className="h-1 w-full bg-rose-500/20 rounded-full mt-1"><div className="h-full bg-rose-500 rounded-full" style={{width:'65%'}}/></div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 shadow-sm hover:shadow-md transition">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Margem Total</p>
              <p className="text-2xl font-extrabold text-violet-500">{fmtFin(totalMargem)}</p>
              <p className="text-xs text-muted-foreground font-semibold">{margemMedia.toFixed(1)}% de margem</p>
            </div>
          </div>
        </TabsContent>

        {/* FATURAMENTO POR CLIENTE */}
        <TabsContent value="faturamento" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {relatorioClientes.length === 0 && <p className="text-muted-foreground text-sm py-4">Nenhum cliente com dados de faturamento.</p>}
            {relatorioClientes.map((cliente) => (
              <div
                key={cliente.id}
                className={`bg-card border rounded-xl p-5 cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5 group ${
                  clienteSelecionado?.id === cliente.id
                    ? 'border-primary shadow-md shadow-primary/10'
                    : 'border-border hover:border-primary/40'
                }`}
                onClick={() => setClienteSelecionado(cliente)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  {clienteSelecionado?.id === cliente.id && (
                    <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1" />
                  )}
                </div>
                <p className="font-bold text-foreground group-hover:text-primary transition-colors">{cliente.nome}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{cliente.cnpj}</p>
                <p className="text-xl font-extrabold text-emerald-500 mt-3">{fmtFin(cliente.totalFaturado)}</p>
                <p className="text-xs text-muted-foreground mt-1">{cliente.operacoes.length} operações realizadas</p>
              </div>
            ))}
          </div>

          {clienteSelecionado && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Detalhes - {clienteSelecionado.nome}</CardTitle>
                <Button onClick={() => generateFaturamentoPDF(clienteSelecionado)} className="gap-2 bg-orange-500 hover:bg-orange-600">
                  <Download className="w-4 h-4" />
                  Gerar PDF
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>OS</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Destino</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clienteSelecionado.operacoes.map((os) => (
                      <TableRow key={os.id}>
                        <TableCell className="font-medium">{os.numero}</TableCell>
                        <TableCell className="text-sm">{os.data}</TableCell>
                        <TableCell className="text-sm">{os.origem}</TableCell>
                        <TableCell className="text-sm">{os.destino}</TableCell>
                        <TableCell><Badge>{os.status}</Badge></TableCell>
                        <TableCell className="text-right font-mono">{fmtFin(os.valorCliente)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* MARGEM POR OPERAÇÃO */}
        <TabsContent value="margem" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-sm">Margem por Operação (Dispersão)</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis type="number" dataKey="x" name="Custo" tick={{ fontSize: 10 }} label={{ value: "Custo Prestador (R$)", position: "bottom", fontSize: 10 }} />
                    <YAxis type="number" dataKey="y" name="Margem" tick={{ fontSize: 10 }} label={{ value: "Margem (R$)", angle: -90, position: "left", fontSize: 10 }} />
                    <ZAxis type="number" dataKey="z" range={[50, 400]} name="Receita" />
                    <Tooltip formatter={(value: number, name: string) => fmtFin(value)} contentStyle={{ borderRadius: '8px' }} />
                    <Scatter name="Operações" data={scatterData} fill="#f97316" />
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Ranking de Clientes por Rentabilidade</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead className="text-right">Margem</TableHead>
                      <TableHead className="text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relatorioClientes.map((c) => {
                      const ops = relatorioOS.filter(o => o.cliente === c.nome);
                      const receita = ops.reduce((a, o) => a + o.valorCliente, 0);
                      const custo = ops.reduce((a, o) => a + o.custoPrestador, 0);
                      const margem = receita - custo;
                      const pct = receita > 0 ? (margem / receita) * 100 : 0;
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.nome}</TableCell>
                          <TableCell className="text-right font-mono">{fmtFin(receita)}</TableCell>
                          <TableCell className="text-right font-mono text-red-600">{fmtFin(custo)}</TableCell>
                          <TableCell className="text-right font-mono text-green-600">{fmtFin(margem)}</TableCell>
                          <TableCell className="text-right font-bold">{pct.toFixed(1)}%</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* PRESTADORES */}
        <TabsContent value="prestadores" className="space-y-4 pt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prestador</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Operações</TableHead>
                    <TableHead className="text-right">Valor Pago</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead className="text-right">Ocorrências</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relatorioPrestadores.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.nome}</TableCell>
                      <TableCell className="text-sm font-mono">{p.cpfCnpj}</TableCell>
                      <TableCell><Badge variant="outline">{p.tipo}</Badge></TableCell>
                      <TableCell className="text-right">{p.totalOperacoes}</TableCell>
                      <TableCell className="text-right font-mono">{fmtFin(p.valorPago)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className={`font-bold ${p.score >= 4.5 ? 'text-green-600' : p.score >= 4 ? 'text-yellow-600' : 'text-red-600'}`}>{p.score}</span>
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500" style={{ width: `${(p.score / 5) * 100}%` }} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className={p.ocorrencias <= 3 ? "bg-green-100 text-green-800" : p.ocorrencias <= 6 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}>
                          {p.ocorrencias}
                        </Badge>
                      </TableCell>
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
