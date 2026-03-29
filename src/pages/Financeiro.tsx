import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign, Download, UploadCloud, PieChart, CheckCircle2, MoreHorizontal, FileText, Target, UserMinus, ShieldCheck, CreditCard, ArrowRightLeft, Plus, Search, LayoutDashboard, Calculator, BookOpen, Landmark, Users, Package, Clock, Receipt, TrendingUpIcon, FileCheck, FileX, Check, X, Eye, Edit, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import DashboardFinanceiroEnterprise from "@/components/financeiro/DashboardFinanceiroEnterprise";
import DREGerencial from "@/components/financeiro/DREGerencial";
import FluxoCaixaEnterprise from "@/components/financeiro/FluxoCaixaEnterprise";
import PlanoContas from "@/components/financeiro/PlanoContas";
import SegurosFinanceiro from "@/components/financeiro/SegurosFinanceiro";
import ContabilidadeFinanceiro from "@/components/financeiro/ContabilidadeFinanceiro";
import PagamentoCNAB from "@/components/financeiro/PagamentoCNAB";
import PendenciasCadastro from "@/components/financeiro/PendenciasCadastro";
import Inadimplencia from "@/components/financeiro/Inadimplencia";
import ConciliacaoAvancada from "@/components/financeiro/ConciliacaoAvancada";
import MargemOperacional from "@/components/financeiro/MargemOperacional";
import DateRangePicker from "@/components/ui/DateRangePicker";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const categoriasPagar = [
  "Energia elétrica", "Água", "Aluguel", "Internet/telefone", 
  "Software/licenças", "Combustível frota própria", "Manutenção", 
  "Folha de pagamento (CLT)", "Impostos (DAS, DCTF, etc.)", "Outros"
];

const mockRecibos = [
  { id: 1, numero: "REC-202603-0001", os: "OS-4815", prestador: "João Silva - ME", cpfCnpj: "123.456.789-00", servico: "Frete", dataServico: "2026-03-20", valorBruto: 8500.00, descuentos: 850, valorLiquido: 7650.00, formaPagamento: "Depósito", status: "emitido" },
  { id: 2, numero: "REC-202603-0002", os: "OS-4802", prestador: "Transporte Rápido LTDA", cpfCnpj: "12.345.678/0001-90", servico: "Frete", dataServico: "2026-03-18", valorBruto: 12000.00, descuentos: 1200, valorLiquido: 10800.00, formaPagamento: "Transferência", status: "emitido" },
  { id: 3, numero: "REC-202603-0003", os: "OS-4798", prestador: "Maria Freitas", cpfCnpj: "987.654.321-00", servico: "Coleta", dataServico: "2026-03-15", valorBruto: 2500.00, descuentos: 250, valorLiquido: 2250.00, formaPagamento: "Dinheiro", status: "pago" },
];

const mockRentabilidadeOS = [
  { id: 1, os: "OS-4821", cliente: "Magazine Luiza", rota: "SP → RJ", valorCobrado: 15000, custoTotal: 10500, margem: 4500, margemPorc: 30, status: "finalizada" },
  { id: 2, os: "OS-4820", cliente: "Amazon BR", rota: "SP → MG", valorCobrado: 8500, custoTotal: 6800, margem: 1700, margemPorc: 20, status: "finalizada" },
  { id: 3, os: "OS-4819", cliente: "Mercado Livre", rota: "PR → SC", valorCobrado: 5200, custoTotal: 4600, margem: 600, margemPorc: 11.5, status: "finalizada" },
  { id: 4, os: "OS-4818", cliente: "Shopee", rota: "SP → BA", valorCobrado: 12800, custoTotal: 11520, margem: 1280, margemPorc: 10, status: "finalizada" },
  { id: 5, os: "OS-4815", cliente: "Americanas", rota: "RJ → ES", valorCobrado: 6800, custoTotal: 5440, margem: 1360, margemPorc: 20, status: "finalizada" },
];

const mockRentabilidadeCliente = [
  { id: 1, cliente: "Magazine Luiza", qtdOS: 45, receitaTotal: 680000, custoTotal: 476000, margem: 204000, margemPorc: 30, ticketMedio: 15111, crescimento: 12 },
  { id: 2, cliente: "Amazon BR", qtdOS: 38, receitaTotal: 520000, custoTotal: 390000, margem: 130000, margemPorc: 25, ticketMedio: 13684, crescimento: 8 },
  { id: 3, cliente: "Mercado Livre", qtdOS: 32, receitaTotal: 410000, custoTotal: 307500, margem: 102500, margemPorc: 25, ticketMedio: 12812, crescimento: 5 },
  { id: 4, cliente: "Shopee", qtdOS: 28, receitaTotal: 350000, custoTotal: 280000, margem: 70000, margemPorc: 20, ticketMedio: 12500, crescimento: 15 },
  { id: 5, cliente: "Americanas", qtdOS: 22, receitaTotal: 280000, custoTotal: 224000, margem: 56000, margemPorc: 20, ticketMedio: 12727, crescimento: -3 },
];

export default function Financeiro() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "receber";
  const [subTabPagar, setSubTabPagar] = useState("prestadores");
  const [subTabRentabilidade, setSubTabRentabilidade] = useState("por-os");

  const [receber, setReceber] = useState<any[]>([]);
  const [pagarPrestadores, setPagarPrestadores] = useState<any[]>([]);
  const [pagarOutros, setPagarOutros] = useState<any[]>([]);
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [recibos, setRecibos] = useState(mockRecibos);
  const [pagarAguardandoAprovacao, setPagarAguardandoAprovacao] = useState([
    { id: 1, os: "OS-4821", prestador: "João Silva", valor: 7650.00, dataExecucao: "2026-03-25", comprovante: "app", status: "pendente" },
    { id: 2, os: "OS-4819", prestador: "Transporte Rápido LTDA", valor: 10800.00, dataExecucao: "2026-03-24", comprovante: "app", status: "pendente" },
    { id: 3, os: "OS-4815", prestador: "Maria Freitas", valor: 2250.00, dataExecucao: "2026-03-23", comprovante: "app", status: "aprovado" },
  ]);
  
  const [buscaReceber, setBuscaReceber] = useState("");
  const [buscaPagar, setBuscaPagar] = useState("");
  const [dateRange, setDateRange] = useState<{from: Date | undefined; to: Date | undefined}>({ from: undefined, to: undefined });

  const handleTabChange = (val: string) => setSearchParams({ tab: val });

  useEffect(() => {
    fetchReceber();
    fetchPagar();
    fetchLancamentos();
  }, []);

  const fetchReceber = async () => {
    try {
      const { data } = await supabase.from("financeiro_receber").select("*").order("vencimento", { ascending: true });
      if (data && data.length > 0) setReceber(data);
      else setReceber([
         { id: 1, fatura: "FAT-0045", cliente: "Tech Solutions", os_vinculadas: "OS-401, OS-402", competencia: "10/2026", vencimento: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString(), valor: 14500.00, status: "a vencer" },
         { id: 2, fatura: "FAT-0038", cliente: "Indústria Global", os_vinculadas: "OS-380", competencia: "09/2026", vencimento: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString(), valor: 8200.50, status: "vencida" },
         { id: 3, fatura: "FAT-0035", cliente: "Comércio Varejo", os_vinculadas: "OS-350, OS-355", competencia: "09/2026", vencimento: new Date(new Date().setDate(new Date().getDate() - 10)).toISOString(), valor: 5400.00, status: "paga" }
      ]);
    } catch { }
  };

  const fetchPagar = async () => {
    try {
      const { data } = await supabase.from("financeiro_pagar").select("*").order("vencimento", { ascending: true });
      if (data && data.length > 0) {
        const prestadores = data.filter((d: any) => d.tipo === "prestador");
        const outros = data.filter((d: any) => d.tipo === "outro");
        setPagarPrestadores(prestadores);
        setPagarOutros(outros);
      } else {
        setPagarPrestadores([
          { id: 1, doc: "NF-8599", fornecedor: "João Transporte (Prestador)", competencia: "10/2026", vencimento: new Date(new Date().setDate(new Date().getDate() + 3)).toISOString(), valor: 1200.00, status: "a vencer", tipo: "prestador" },
          { id: 2, doc: "NF-8600", fornecedor: "Maria Freitas - ME", competencia: "10/2026", vencimento: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString(), valor: 8500.00, status: "a vencer", tipo: "prestador", os: "OS-4821" },
        ]);
        setPagarOutros([
          { id: 3, doc: "NF-902", fornecedor: "Companhia de Energia", competencia: "10/2026", vencimento: new Date(new Date().setDate(new Date().getDate() + 10)).toISOString(), valor: 4500.00, status: "a vencer", tipo: "outro", categoria: "Energia elétrica" },
          { id: 4, doc: "BOLETO-001", fornecedor: "Locação de Galpão", competencia: "10/2026", vencimento: new Date(new Date().setDate(new Date().getDate() + 15)).toISOString(), valor: 15000.00, status: "a vencer", tipo: "outro", categoria: "Aluguel", recorrente: true },
        ]);
      }
    } catch { }
  };

  const fetchLancamentos = async () => {
    try {
      const { data } = await supabase.from("lancamentos_financeiros").select("*").order("data", { ascending: false });
      if (data && data.length > 0) setLancamentos(data);
      else setLancamentos([
         { id: 1, data: new Date().toISOString(), descricao: "Recebimento FAT-0035", categoria: "Receita Faturamento", tipo: "entrada", valor: 5400.00 },
         { id: 2, data: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString(), descricao: "Pagamento Prestador Carlos", categoria: "Custo Operacional", tipo: "saida", valor: 850.00 },
      ]);
    } catch { }
  };

  const filtrarDoc = (lista: any[], busca: string) => lista.filter(i => JSON.stringify(i).toLowerCase().includes(busca.toLowerCase()));

  const StatCard = ({ title, value, sub, icon: Icon, color }: any) => (
    <Card className="border-l-4" style={{ borderLeftColor: color }}>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
           <p className="text-xs font-semibold text-muted-foreground uppercase">{title}</p>
           <p className="text-2xl font-bold" style={{ color }}>{value}</p>
           {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className="p-3 bg-muted rounded-full">
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="w-8 h-8 text-primary" /> Financeiro e Rentabilidade
          </h1>
          <p className="text-muted-foreground">Visão geral e controle do dinheiro do Hub.</p>
        </div>
        <div className="flex gap-2">
           <Badge variant="destructive" className="bg-red-600 font-bold px-3 shadow animate-pulse">2 Cadastros Pendentes! (Auditoria)</Badge>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-card justify-start overflow-x-auto border-b rounded-none w-full mb-4">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-muted"><LayoutDashboard className="w-4 h-4 mr-2"/> Dashboard</TabsTrigger>
            <TabsTrigger value="receber" className="data-[state=active]:bg-muted"><ArrowDownRight className="w-4 h-4 mr-2"/> Receber</TabsTrigger>
            <TabsTrigger value="inadimplencia" className="data-[state=active]:bg-muted"><UserMinus className="w-4 h-4 mr-2"/> Inadimplência</TabsTrigger>
            <TabsTrigger value="pagar" className="data-[state=active]:bg-muted"><ArrowUpRight className="w-4 h-4 mr-2"/> Pagar</TabsTrigger>
            <TabsTrigger value="fluxo" className="data-[state=active]:bg-muted"><TrendingUp className="w-4 h-4 mr-2"/> Fluxo de Caixa</TabsTrigger>
            <TabsTrigger value="dre" className="data-[state=active]:bg-muted"><Calculator className="w-4 h-4 mr-2"/> DRE</TabsTrigger>
            <TabsTrigger value="plano-contas" className="data-[state=active]:bg-muted"><BookOpen className="w-4 h-4 mr-2"/> Plano de Contas</TabsTrigger>
            <TabsTrigger value="conciliacao" className="data-[state=active]:bg-muted"><ArrowRightLeft className="w-4 h-4 mr-2"/> Conciliação</TabsTrigger>
            <TabsTrigger value="lotes" className="data-[state=active]:bg-muted"><CreditCard className="w-4 h-4 mr-2"/> CNAB</TabsTrigger>
            <TabsTrigger value="centro-resultado" className="data-[state=active]:bg-muted"><Landmark className="w-4 h-4 mr-2"/> Centro Resultado</TabsTrigger>
            <TabsTrigger value="provisoes" className="data-[state=active]:bg-muted"><Clock className="w-4 h-4 mr-2"/> Provisões</TabsTrigger>
            <TabsTrigger value="recibos" className="data-[state=active]:bg-muted"><Receipt className="w-4 h-4 mr-2"/> Recibos</TabsTrigger>
            <TabsTrigger value="rentabilidade" className="data-[state=active]:bg-muted"><TrendingUpIcon className="w-4 h-4 mr-2"/> Rentabilidade</TabsTrigger>
            <TabsTrigger value="pendencias" className="data-[state=active]:bg-muted"><ShieldCheck className="w-4 h-4 mr-2 text-red-500"/> Pendências</TabsTrigger>
            <TabsTrigger value="margem" className="data-[state=active]:bg-muted"><Target className="w-4 h-4 mr-2"/> Margem</TabsTrigger>
            <TabsTrigger value="seguros" className="data-[state=active]:bg-muted"><DollarSign className="w-4 h-4 mr-2"/> Seguros</TabsTrigger>
            <TabsTrigger value="contabilidade" className="data-[state=active]:bg-muted"><FileText className="w-4 h-4 mr-2"/> Contabilidade</TabsTrigger>
        </TabsList>

        {/* --- DASHBOARD FINANCEIRO ENTERPRISE --- */}
        <TabsContent value="dashboard" className="pt-4">
          <DashboardFinanceiroEnterprise />
        </TabsContent>

        {/* --- CONTAS A RECEBER --- */}
        <TabsContent value="receber" className="space-y-4 pt-4">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
             <StatCard title="Total a Receber" value={fmtFin(filtrarDoc(receber, "").reduce((acc, i) => acc + (i.status !== "paga" && i.status !== "cancelada" ? i.valor : 0), 0))} icon={DollarSign} color="#2563eb" />
             <StatCard title="Vencido" value={fmtFin(filtrarDoc(receber, "").reduce((acc, i) => acc + (i.status === "vencida" ? i.valor : 0), 0))} icon={ArrowDownRight} color="#dc2626" />
             <StatCard title="A Vencer (7 Dias)" value={fmtFin(filtrarDoc(receber, "").reduce((acc, i) => acc + (i.status === "a vencer" ? i.valor : 0), 0))} icon={ArrowDownRight} color="#eab308" />
             <StatCard title="Recebido no Mês" value={fmtFin(filtrarDoc(receber, "").reduce((acc, i) => acc + (i.status === "paga" ? i.valor : 0), 0))} icon={DollarSign} color="#16a34a" />
           </div>

           <Card>
             <CardHeader className="py-4 flex flex-row items-center gap-4 justify-between">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Buscar fatura ou cliente..." value={buscaReceber} onChange={(e) => setBuscaReceber(e.target.value)} className="pl-9" />
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white"><Plus className="w-4 h-4 mr-2"/> Gerar Fatura C.R</Button>
             </CardHeader>
             <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Nº Fatura</TableHead><TableHead>Cliente</TableHead><TableHead>OS Vinculadas</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filtrarDoc(receber, buscaReceber).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-semibold">{r.fatura}</TableCell>
                        <TableCell>{r.cliente}</TableCell><TableCell className="text-sm text-muted-foreground">{r.os_vinculadas}</TableCell>
                        <TableCell>{new Date(r.vencimento).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right font-medium">{fmtFin(r.valor)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={r.status === "a vencer" ? "bg-blue-50 text-blue-700 border-blue-200" : r.status === "vencida" ? "bg-red-50 text-red-700 border-red-200" : r.status === "paga" ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-700 border-gray-200"}>{r.status.toUpperCase()}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
             </CardContent>
           </Card>
        </TabsContent>

        {/* --- CONTAS A PAGAR --- */}
        <TabsContent value="pagar" className="space-y-4 pt-4">
           <Tabs value={subTabPagar} onValueChange={setSubTabPagar}>
             <TabsList className="bg-muted/50">
               <TabsTrigger value="prestadores" className="gap-2">
                 <Users className="w-4 h-4" /> Pagamento a Prestadores
                 <Badge variant="secondary" className="ml-1">{pagarAguardandoAprovacao.filter(p => p.status === "pendente").length}</Badge>
               </TabsTrigger>
               <TabsTrigger value="outras" className="gap-2">
                 <FileText className="w-4 h-4" /> Outras Despesas
               </TabsTrigger>
             </TabsList>

             {/* PAGAMENTO A PRESTADORES */}
             <TabsContent value="prestadores" className="space-y-4 mt-4">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                 <StatCard title="Total a Pagar" value={fmtFin(filtrarDoc(pagarPrestadores, "").reduce((acc, i: any) => acc + (i.status !== "paga" ? i.valor : 0), 0))} icon={DollarSign} color="#ea580c" />
                 <StatCard title="Vencido" value={fmtFin(filtrarDoc(pagarPrestadores, "").reduce((acc, i: any) => acc + (i.status === "vencida" ? i.valor : 0), 0))} icon={ArrowUpRight} color="#dc2626" />
                 <StatCard title="A Vencer (7 Dias)" value={fmtFin(filtrarDoc(pagarPrestadores, "").reduce((acc, i: any) => acc + (i.status === "a vencer" ? i.valor : 0), 0))} icon={ArrowUpRight} color="#eab308" />
                 <StatCard title="Pago no Mês" value={fmtFin(filtrarDoc(pagarPrestadores, "").reduce((acc, i: any) => acc + (i.status === "paga" ? i.valor : 0), 0))} icon={DollarSign} color="#16a34a" />
               </div>

               {/* Fila de Aprovação */}
               <Card className="border-yellow-200 bg-yellow-50">
                 <CardHeader className="py-3">
                   <CardTitle className="text-sm flex items-center gap-2">
                     <Clock className="w-4 h-4 text-yellow-600" />
                     Aguardando Aprovação ({pagarAguardandoAprovacao.filter(p => p.status === "pendente").length})
                   </CardTitle>
                 </CardHeader>
                 <CardContent className="p-0">
                   <Table>
                     <TableHeader><TableRow><TableHead>OS</TableHead><TableHead>Prestador</TableHead><TableHead>Valor</TableHead><TableHead>Data Execução</TableHead><TableHead>Comprovante</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                     <TableBody>
                       {pagarAguardandoAprovacao.filter(p => p.status === "pendente").map((p) => (
                         <TableRow key={p.id}>
                           <TableCell className="font-medium">{p.os}</TableCell>
                           <TableCell>{p.prestador}</TableCell>
                           <TableCell className="font-mono">{fmtFin(p.valor)}</TableCell>
                           <TableCell>{p.dataExecucao}</TableCell>
                           <TableCell><Badge variant="outline">{p.comprovante}</Badge></TableCell>
                           <TableCell className="text-right">
                             <Button size="sm" variant="outline" className="h-6 w-6 p-0"><Eye className="w-3 h-3" /></Button>
                             <Button size="sm" variant="outline" className="h-6 w-6 p-0 ml-1 text-green-600"><Check className="w-3 h-3" /></Button>
                             <Button size="sm" variant="outline" className="h-6 w-6 p-0 ml-1 text-red-600"><X className="w-3 h-3" /></Button>
                           </TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                   </Table>
                 </CardContent>
               </Card>

               <Card>
                 <CardHeader className="py-4 flex flex-row items-center justify-between">
                   <div className="relative flex-1 max-w-sm">
                     <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                     <Input placeholder="Buscar prestador..." value={buscaPagar} onChange={(e) => setBuscaPagar(e.target.value)} className="pl-9" />
                   </div>
                   <Button className="bg-orange-600 hover:bg-orange-700 text-white"><Plus className="w-4 h-4 mr-2"/> Gerar Lote CNAB</Button>
                 </CardHeader>
                 <CardContent className="p-0">
                   <Table>
                     <TableHeader><TableRow><TableHead>Documento</TableHead><TableHead>Prestador</TableHead><TableHead>OS</TableHead><TableHead>Competência</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                     <TableBody>
                       {filtrarDoc(pagarPrestadores, buscaPagar).map((p: any, i: number) => (
                         <TableRow key={i}>
                           <TableCell className="font-semibold">{p.doc}</TableCell>
                           <TableCell>{p.fornecedor}</TableCell>
                           <TableCell>{p.os || "—"}</TableCell>
                           <TableCell>{p.competencia}</TableCell>
                           <TableCell>{new Date(p.vencimento).toLocaleDateString()}</TableCell>
                           <TableCell className="text-right font-medium">{fmtFin(p.valor)}</TableCell>
                           <TableCell>
                             <Badge variant="outline" className={p.status === "a vencer" ? "bg-blue-50 text-blue-700 border-blue-200" : p.status === "vencida" ? "bg-red-50 text-red-700 border-red-200" : p.status === "paga" ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-700 border-gray-200"}>{p.status.toUpperCase()}</Badge>
                           </TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                   </Table>
                 </CardContent>
               </Card>
             </TabsContent>

             {/* OUTRAS DESPESAS */}
             <TabsContent value="outras" className="space-y-4 mt-4">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                 <StatCard title="Total a Pagar" value={fmtFin(filtrarDoc(pagarOutros, "").reduce((acc, i: any) => acc + (i.status !== "paga" ? i.valor : 0), 0))} icon={DollarSign} color="#ea580c" />
                 <StatCard title="Vencido" value={fmtFin(filtrarDoc(pagarOutros, "").reduce((acc, i: any) => acc + (i.status === "vencida" ? i.valor : 0), 0))} icon={ArrowUpRight} color="#dc2626" />
                 <StatCard title="A Vencer (7 Dias)" value={fmtFin(filtrarDoc(pagarOutros, "").reduce((acc, i: any) => acc + (i.status === "a vencer" ? i.valor : 0), 0))} icon={ArrowUpRight} color="#eab308" />
                 <StatCard title="Pago no Mês" value={fmtFin(filtrarDoc(pagarOutros, "").reduce((acc, i: any) => acc + (i.status === "paga" ? i.valor : 0), 0))} icon={DollarSign} color="#16a34a" />
               </div>

               <Card>
                 <CardHeader className="py-4 flex flex-row items-center justify-between">
                   <div className="relative flex-1 max-w-sm">
                     <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                     <Input placeholder="Buscar despesa..." value={buscaPagar} onChange={(e) => setBuscaPagar(e.target.value)} className="pl-9" />
                   </div>
                   <Dialog>
                     <DialogTrigger asChild>
                       <Button className="bg-orange-600 hover:bg-orange-700 text-white"><Plus className="w-4 h-4 mr-2"/> Nova Despesa</Button>
                     </DialogTrigger>
                     <DialogContent>
                       <DialogHeader><DialogTitle>Nova Despesa</DialogTitle></DialogHeader>
                       <div className="space-y-4 py-4">
                         <div><Label>Fornecedor</Label><Input placeholder="Nome do fornecedor" className="mt-1" /></div>
                         <div><Label>Categoria</Label>
                           <Select>
                             <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                             <SelectContent>
                               {categoriasPagar.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                             </SelectContent>
                           </Select>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                           <div><Label>Vencimento</Label><Input type="date" className="mt-1" /></div>
                           <div><Label>Valor</Label><Input type="number" placeholder="0,00" className="mt-1" /></div>
                         </div>
                         <div><Label>Competência</Label><Input placeholder="MM/AAAA" className="mt-1" /></div>
                         <div className="flex items-center gap-2"><input type="checkbox" id="recorrente" /> <Label htmlFor="recorrente">Despesa recorrente?</Label></div>
                       </div>
                       <DialogFooter>
                         <Button variant="outline">Cancelar</Button>
                         <Button className="bg-orange-500">Salvar</Button>
                       </DialogFooter>
                     </DialogContent>
                   </Dialog>
                 </CardHeader>
                 <CardContent className="p-0">
                   <Table>
                     <TableHeader><TableRow><TableHead>Documento</TableHead><TableHead>Fornecedor</TableHead><TableHead>Categoria</TableHead><TableHead>Competência</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                     <TableBody>
                       {filtrarDoc(pagarOutros, buscaPagar).map((p: any, i: number) => (
                         <TableRow key={i}>
                           <TableCell className="font-semibold">{p.doc}</TableCell>
                           <TableCell>{p.fornecedor}</TableCell>
                           <TableCell><Badge variant="outline">{p.categoria}</Badge></TableCell>
                           <TableCell>{p.competencia}</TableCell>
                           <TableCell>{new Date(p.vencimento).toLocaleDateString()}</TableCell>
                           <TableCell className="text-right font-medium">{fmtFin(p.valor)}</TableCell>
                           <TableCell>
                             <Badge variant="outline" className={p.status === "a vencer" ? "bg-blue-50 text-blue-700 border-blue-200" : p.status === "vencida" ? "bg-red-50 text-red-700 border-red-200" : p.status === "paga" ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-700 border-gray-200"}>{p.status.toUpperCase()}</Badge>
                           </TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                   </Table>
                 </CardContent>
               </Card>
             </TabsContent>
           </Tabs>
        </TabsContent>

        {/* --- FLUXO DE CAIXA ENTERPRISE --- */}
        <TabsContent value="fluxo" className="pt-4">
          <FluxoCaixaEnterprise />
        </TabsContent>

        {/* --- DRE GERENCIAL --- */}
        <TabsContent value="dre" className="pt-4">
          <DREGerencial />
        </TabsContent>

        {/* --- PLANO DE CONTAS --- */}
        <TabsContent value="plano-contas" className="pt-4">
          <PlanoContas />
        </TabsContent>

        {/* --- CENTRO DE RESULTADO --- */}
        <TabsContent value="centro-resultado" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="w-5 h-5" />
                Centro de Resultado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Landmark className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Módulo em desenvolvimento</p>
                <p className="text-sm">Permite análise de rentabilidade por centro de resultado</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- PROVISÕES --- */}
        <TabsContent value="provisoes" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Provisões
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Módulo em desenvolvimento</p>
                <p className="text-sm">Controle de provisões (13º, férias, contingências)</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- DRE SIMPLIFICADO --- */}
        {/* This section was replaced by MargemOperacional */}
        {/*
        <TabsContent value="dre" className="space-y-4 pt-4">
           <div className="flex justify-between items-center mb-6">
              <Select defaultValue="10/2026">
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Competência" /></SelectTrigger>
                <SelectContent><SelectItem value="10/2026">Outubro 2026</SelectItem><SelectItem value="09/2026">Setembro 2026</SelectItem></SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                 <Badge variant="secondary" className="bg-purple-100 text-purple-700">Novo recurso em breve</Badge>
                 <Button variant="outline" className="gap-2"><Download className="w-4 h-4"/> Exportar DRE</Button>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-blue-50/50">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-blue-900">1. Receita Bruta (Faturamento de OS)</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-blue-700">{fmtFin(145000.00)}</p></CardContent>
              </Card>
              <Card className="bg-red-50/50">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-red-900">2. Deduções Iniciais (Impostos/Desc)</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-red-700">-{fmtFin(18500.00)}</p></CardContent>
              </Card>
              <Card className="bg-green-50/50">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-green-900">3. Receita Líquida (1 - 2)</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-green-700">{fmtFin(126500.00)}</p></CardContent>
              </Card>
              
              <Card className="md:col-span-3 h-px bg-border/50 border-0" />

              <Card className="bg-orange-50/50 md:col-start-1">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-orange-900">(-) Custos Operacionais (Frete, Pedágio)</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-orange-700">-{fmtFin(88000.00)}</p></CardContent>
              </Card>
              <Card className="bg-emerald-50/50 md:col-start-3 shadow-md border-emerald-200">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-emerald-900 flex items-center justify-between">
                  Margem Bruta
                  <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full">30%</span>
                </CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-emerald-700">{fmtFin(38500.00)}</p></CardContent>
              </Card>
              
              <Card className="md:col-span-3 h-px bg-border/50 border-0" />

              <Card className="bg-slate-50 md:col-start-1">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-slate-700">(-) Despesas Administrativas Fixas</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-slate-700">-{fmtFin(12000.00)}</p></CardContent>
              </Card>

              <Card className="bg-slate-900 md:col-start-3 shadow-xl">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-slate-400">EBITDA (Resultado Operacional)</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-bold text-white">{fmtFin(26500.00)}</p></CardContent>
              </Card>

           </div>
        </TabsContent>
        */}

        {/* --- DRE --- / substituido por Margem */}
        <TabsContent value="margem" className="pt-4">
           <MargemOperacional />
        </TabsContent>

        {/* --- SEGUROS --- */}
        <TabsContent value="seguros" className="pt-4">
           <SegurosFinanceiro />
        </TabsContent>

        {/* --- CONTABILIDADE --- */}
        <TabsContent value="contabilidade" className="pt-4">
           <ContabilidadeFinanceiro />
        </TabsContent>

        {/* --- NOVOS MODULOS --- */}
        <TabsContent value="lotes" className="pt-4">
           <PagamentoCNAB />
        </TabsContent>

        <TabsContent value="pendencias" className="pt-4">
           <PendenciasCadastro />
        </TabsContent>

        <TabsContent value="inadimplencia" className="pt-4">
           <Inadimplencia />
        </TabsContent>

        <TabsContent value="conciliacao" className="pt-4">
            <ConciliacaoAvancada />
         </TabsContent>

        {/* --- RECIBOS --- */}
        <TabsContent value="recibos" className="space-y-4 pt-4">
           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
             <div>
               <h2 className="text-xl font-bold flex items-center gap-2">
                 <Receipt className="w-6 h-6 text-primary" />
                 Recibos
               </h2>
               <p className="text-sm text-muted-foreground">Geração de recibos de prestação de serviço</p>
             </div>
             <Button className="bg-orange-500 hover:bg-orange-600"><Plus className="w-4 h-4 mr-2"/> Novo Recibo</Button>
           </div>

           <Card>
             <CardHeader className="py-3">
               <CardTitle className="text-sm">Lista de Recibos Emitidos</CardTitle>
             </CardHeader>
             <CardContent className="p-0">
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Nº Recibo</TableHead>
                     <TableHead>OS</TableHead>
                     <TableHead>Prestador</TableHead>
                     <TableHead>CPF/CNPJ</TableHead>
                     <TableHead>Serviço</TableHead>
                     <TableHead>Data Serviço</TableHead>
                     <TableHead className="text-right">Valor Líquido</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead className="text-right">Ações</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {recibos.map((r) => (
                     <TableRow key={r.id}>
                       <TableCell className="font-medium">{r.numero}</TableCell>
                       <TableCell>{r.os}</TableCell>
                       <TableCell>{r.prestador}</TableCell>
                       <TableCell className="text-xs font-mono">{r.cpfCnpj}</TableCell>
                       <TableCell>{r.servico}</TableCell>
                       <TableCell>{r.dataServico}</TableCell>
                       <TableCell className="text-right font-mono font-semibold">{fmtFin(r.valorLiquido)}</TableCell>
                       <TableCell>
                         <Badge className={r.status === "emitido" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}>
                           {r.status === "emitido" ? "Emitido" : "Pago"}
                         </Badge>
                       </TableCell>
                       <TableCell className="text-right">
                         <Button size="sm" variant="ghost" className="h-6 w-6 p-0"><Eye className="w-3 h-3" /></Button>
                         <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500"><FileX className="w-3 h-3" /></Button>
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
             </CardContent>
           </Card>
        </TabsContent>

        {/* --- RENTABILIDADE --- */}
        <TabsContent value="rentabilidade" className="space-y-4 pt-4">
           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
             <div>
               <h2 className="text-xl font-bold flex items-center gap-2">
                 <TrendingUpIcon className="w-6 h-6 text-primary" />
                 Rentabilidade
               </h2>
               <p className="text-sm text-muted-foreground">Análise de margem e lucratividade</p>
             </div>
             <div className="flex gap-2">
               <DateRangePicker value={dateRange} onChange={setDateRange} />
               <Button variant="outline"><Download className="w-4 h-4 mr-2" />Exportar PDF</Button>
               <Button variant="outline"><FileCheck className="w-4 h-4 mr-2" />Exportar Excel</Button>
             </div>
           </div>

           <Tabs value={subTabRentabilidade} onValueChange={setSubTabRentabilidade}>
             <TabsList>
               <TabsTrigger value="por-os">Por OS</TabsTrigger>
               <TabsTrigger value="por-cliente">Por Cliente</TabsTrigger>
               <TabsTrigger value="por-contrato">Por Contrato</TabsTrigger>
               <TabsTrigger value="por-veiculo">Por Veículo</TabsTrigger>
               <TabsTrigger value="top-desempenho">Top Desempenho</TabsTrigger>
             </TabsList>

             {/* RENTABILIDADE POR OS */}
             <TabsContent value="por-os" className="space-y-4 mt-4">
               <Card>
                 <CardHeader className="py-3">
                   <CardTitle className="text-sm">Margem por Ordem de Serviço</CardTitle>
                 </CardHeader>
                 <CardContent className="p-0">
                   <Table>
                     <TableHeader>
                       <TableRow>
                         <TableHead>OS</TableHead>
                         <TableHead>Cliente</TableHead>
                         <TableHead>Rota</TableHead>
                         <TableHead className="text-right">Valor Cobrado</TableHead>
                         <TableHead className="text-right">Custo Total</TableHead>
                         <TableHead className="text-right">Margem R$</TableHead>
                         <TableHead className="text-right">Margem %</TableHead>
                         <TableHead>Status</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {mockRentabilidadeOS.map((r) => (
                         <TableRow key={r.id}>
                           <TableCell className="font-medium">{r.os}</TableCell>
                           <TableCell>{r.cliente}</TableCell>
                           <TableCell>{r.rota}</TableCell>
                           <TableCell className="text-right font-mono">{fmtFin(r.valorCobrado)}</TableCell>
                           <TableCell className="text-right font-mono">{fmtFin(r.custoTotal)}</TableCell>
                           <TableCell className={`text-right font-mono font-semibold ${r.margem > 0 ? "text-green-600" : "text-red-600"}`}>
                             {fmtFin(r.margem)}
                           </TableCell>
                           <TableCell className={`text-right font-mono ${r.margemPorc < 15 ? "text-red-500" : r.margemPorc >= 25 ? "text-green-600" : "text-yellow-600"}`}>
                             {r.margemPorc.toFixed(1)}%
                           </TableCell>
                           <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                   </Table>
                 </CardContent>
               </Card>
             </TabsContent>

             {/* RENTABILIDADE POR CLIENTE */}
             <TabsContent value="por-cliente" className="space-y-4 mt-4">
               <Card>
                 <CardHeader className="py-3">
                   <CardTitle className="text-sm">Margem por Cliente</CardTitle>
                 </CardHeader>
                 <CardContent className="p-0">
                   <Table>
                     <TableHeader>
                       <TableRow>
                         <TableHead>Cliente</TableHead>
                         <TableHead className="text-right">Qtd OS</TableHead>
                         <TableHead className="text-right">Receita Total</TableHead>
                         <TableHead className="text-right">Custo Total</TableHead>
                         <TableHead className="text-right">Margem R$</TableHead>
                         <TableHead className="text-right">Margem %</TableHead>
                         <TableHead className="text-right">Ticket Médio</TableHead>
                         <TableHead className="text-right">Crescimento</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {mockRentabilidadeCliente.map((r) => (
                         <TableRow key={r.id}>
                           <TableCell className="font-medium">{r.cliente}</TableCell>
                           <TableCell className="text-right">{r.qtdOS}</TableCell>
                           <TableCell className="text-right font-mono">{fmtFin(r.receitaTotal)}</TableCell>
                           <TableCell className="text-right font-mono">{fmtFin(r.custoTotal)}</TableCell>
                           <TableCell className={`text-right font-mono font-semibold ${r.margem > 0 ? "text-green-600" : "text-red-600"}`}>
                             {fmtFin(r.margem)}
                           </TableCell>
                           <TableCell className={`text-right font-mono ${r.margemPorc < 15 ? "text-red-500" : r.margemPorc >= 25 ? "text-green-600" : "text-yellow-600"}`}>
                             {r.margemPorc}%
                           </TableCell>
                           <TableCell className="text-right font-mono">{fmtFin(r.ticketMedio)}</TableCell>
                           <TableCell className={`text-right ${r.crescimento > 0 ? "text-green-600" : "text-red-600"}`}>
                             {r.crescimento > 0 ? "+" : ""}{r.crescimento}%
                           </TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                   </Table>
                 </CardContent>
               </Card>
             </TabsContent>

             {/* RENTABILIDADE POR CONTRATO */}
             <TabsContent value="por-contrato" className="space-y-4 mt-4">
               <Card>
                 <CardHeader className="py-3">
                   <CardTitle className="text-sm">Margem por Contrato</CardTitle>
                 </CardHeader>
                 <CardContent>
                   <div className="text-center py-12 text-muted-foreground">
                     <TrendingUpIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                     <p>Em desenvolvimento</p>
                   </div>
                 </CardContent>
               </Card>
             </TabsContent>

             {/* RENTABILIDADE POR VEÍCULO */}
             <TabsContent value="por-veiculo" className="space-y-4 mt-4">
               <Card>
                 <CardHeader className="py-3">
                   <CardTitle className="text-sm">Margem por Tipo de Veículo</CardTitle>
                 </CardHeader>
                 <CardContent>
                   <div className="text-center py-12 text-muted-foreground">
                     <TrendingUpIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                     <p>Em desenvolvimento</p>
                   </div>
                 </CardContent>
               </Card>
             </TabsContent>

             {/* TOP DESEMPENHO */}
             <TabsContent value="top-desempenho" className="space-y-4 mt-4">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                 <Card className="bg-green-50 border-green-200">
                   <CardHeader className="py-3">
                     <CardTitle className="text-xs font-semibold text-green-800">Top Prestadores</CardTitle>
                   </CardHeader>
                   <CardContent>
                     <p className="text-lg font-bold text-green-700">João Silva</p>
                     <p className="text-xs text-green-600">Menor custo relativo</p>
                   </CardContent>
                 </Card>
                 <Card className="bg-blue-50 border-blue-200">
                   <CardHeader className="py-3">
                     <CardTitle className="text-xs font-semibold text-blue-800">Top Clientes</CardTitle>
                   </CardHeader>
                   <CardContent>
                     <p className="text-lg font-bold text-blue-700">Magazine Luiza</p>
                     <p className="text-xs text-blue-600">Maior margem absoluta</p>
                   </CardContent>
                 </Card>
                 <Card className="bg-purple-50 border-purple-200">
                   <CardHeader className="py-3">
                     <CardTitle className="text-xs font-semibold text-purple-800">Top Rotas</CardTitle>
                   </CardHeader>
                   <CardContent>
                     <p className="text-lg font-bold text-purple-700">SP → RJ</p>
                     <p className="text-xs text-purple-600">Melhor rentabilidade</p>
                   </CardContent>
                 </Card>
                 <Card className="bg-orange-50 border-orange-200">
                   <CardHeader className="py-3">
                     <CardTitle className="text-xs font-semibold text-orange-800">Top Veículos</CardTitle>
                   </CardHeader>
                   <CardContent>
                     <p className="text-lg font-bold text-orange-700">Carreta</p>
                     <p className="text-xs text-orange-600">Maior margem %</p>
                   </CardContent>
                 </Card>
               </div>
             </TabsContent>
           </Tabs>
        </TabsContent>

      </Tabs>
    </div>
  );
}
