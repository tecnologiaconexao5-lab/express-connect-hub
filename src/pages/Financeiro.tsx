import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { DollarSign, ArrowDownRight, ArrowUpRight, TrendingUp, Download, PieChart, Plus, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import SegurosFinanceiro from "@/components/financeiro/SegurosFinanceiro";
import ContabilidadeFinanceiro from "@/components/financeiro/ContabilidadeFinanceiro";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Financeiro() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "receber";

  const [receber, setReceber] = useState<any[]>([]);
  const [pagar, setPagar] = useState<any[]>([]);
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  
  const [buscaReceber, setBuscaReceber] = useState("");
  const [buscaPagar, setBuscaPagar] = useState("");

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
      if (data && data.length > 0) setPagar(data);
      else setPagar([
         { id: 1, doc: "NF-8599", fornecedor: "João Transporte (Prestador)", competencia: "10/2026", vencimento: new Date(new Date().setDate(new Date().getDate() + 3)).toISOString(), valor: 1200.00, status: "a vencer" },
         { id: 2, doc: "NF-902", fornecedor: "Posto Ipiranga", competencia: "10/2026", vencimento: new Date(new Date().setDate(new Date().getDate() + 10)).toISOString(), valor: 4500.00, status: "a vencer" }
      ]);
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
          <p className="text-muted-foreground">Gestão unificada de contas, caixa e DRE.</p>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-card justify-start overflow-x-auto border-b rounded-none w-full">
           <TabsTrigger value="receber" className="data-[state=active]:bg-muted"><ArrowDownRight className="w-4 h-4 mr-2"/> Contas a Receber</TabsTrigger>
           <TabsTrigger value="pagar" className="data-[state=active]:bg-muted"><ArrowUpRight className="w-4 h-4 mr-2"/> Contas a Pagar</TabsTrigger>
           <TabsTrigger value="fluxo" className="data-[state=active]:bg-muted"><TrendingUp className="w-4 h-4 mr-2"/> Fluxo de Caixa</TabsTrigger>
           <TabsTrigger value="dre" className="data-[state=active]:bg-muted"><PieChart className="w-4 h-4 mr-2"/> DRE Simplificado</TabsTrigger>
           <TabsTrigger value="seguros" className="data-[state=active]:bg-muted"><DollarSign className="w-4 h-4 mr-2"/> Seguros</TabsTrigger>
           <TabsTrigger value="contabilidade" className="data-[state=active]:bg-muted"><DollarSign className="w-4 h-4 mr-2"/> Contabilidade</TabsTrigger>
        </TabsList>

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
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
             <StatCard title="Total a Pagar" value={fmtFin(filtrarDoc(pagar, "").reduce((acc, i) => acc + (i.status !== "paga" ? i.valor : 0), 0))} icon={DollarSign} color="#ea580c" />
             <StatCard title="Vencido" value={fmtFin(filtrarDoc(pagar, "").reduce((acc, i) => acc + (i.status === "vencida" ? i.valor : 0), 0))} icon={ArrowUpRight} color="#dc2626" />
             <StatCard title="A Vencer (7 Dias)" value={fmtFin(filtrarDoc(pagar, "").reduce((acc, i) => acc + (i.status === "a vencer" ? i.valor : 0), 0))} icon={ArrowUpRight} color="#eab308" />
             <StatCard title="Pago no Mês" value={fmtFin(filtrarDoc(pagar, "").reduce((acc, i) => acc + (i.status === "paga" ? i.valor : 0), 0))} icon={DollarSign} color="#16a34a" />
           </div>

           <Card>
             <CardHeader className="py-4 flex flex-row items-center gap-4 justify-between">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Buscar fornecedor/prestador..." value={buscaPagar} onChange={(e) => setBuscaPagar(e.target.value)} className="pl-9" />
                </div>
                <Button className="bg-orange-600 hover:bg-orange-700 text-white"><Plus className="w-4 h-4 mr-2"/> Gerar Lote de Pagamento</Button>
             </CardHeader>
             <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Documento</TableHead><TableHead>Fornecedor / Prestador</TableHead><TableHead>Competência</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filtrarDoc(pagar, buscaPagar).map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-semibold">{p.doc}</TableCell>
                        <TableCell>{p.fornecedor}</TableCell><TableCell>{p.competencia}</TableCell>
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

        {/* --- FLUXO DE CAIXA --- */}
        <TabsContent value="fluxo" className="space-y-4 pt-4">
           <Card className="bg-orange-50/50 border-orange-100">
             <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-orange-900 uppercase">Saldo Projetado Em Caixa</h3>
                    <p className="text-4xl font-bold text-orange-600 mt-2">{fmtFin(45800.00)}</p>
                  </div>
                  <div className="flex gap-4">
                     <div>
                       <p className="text-sm text-muted-foreground">Entradas do Mês</p>
                       <p className="text-xl font-semibold text-green-600">+{fmtFin(24500.00)}</p>
                     </div>
                     <div>
                       <p className="text-sm text-muted-foreground">Saídas do Mês</p>
                       <p className="text-xl font-semibold text-red-600">-{fmtFin(8200.00)}</p>
                     </div>
                  </div>
                </div>
             </CardContent>
           </Card>

           <Card>
             <CardHeader className="flex flex-row items-center justify-between py-4">
               <CardTitle className="text-sm">Lançamentos de Caixa (Auto + Manuais)</CardTitle>
               <Button variant="outline" size="sm"><Plus className="w-4 h-4 mr-1"/> Lançamento Manual</Button>
             </CardHeader>
             <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Valor R$</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {lancamentos.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell>{new Date(l.data).toLocaleDateString()}</TableCell>
                        <TableCell className="font-semibold text-sm">{l.descricao}</TableCell>
                        <TableCell>{l.categoria}</TableCell>
                        <TableCell>
                           {l.tipo === "entrada" ? <span className="text-green-600 flex items-center gap-1 text-xs font-bold uppercase"><ArrowDownRight className="w-3 h-3"/> Entrada</span> : <span className="text-red-600 flex items-center gap-1 text-xs font-bold uppercase"><ArrowUpRight className="w-3 h-3"/> Saída</span>}
                        </TableCell>
                        <TableCell className="text-right font-bold">{l.tipo === "entrada" ? <span className="text-green-600">+{fmtFin(l.valor)}</span> : <span className="text-red-600">-{fmtFin(l.valor)}</span>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
             </CardContent>
           </Card>
        </TabsContent>

        {/* --- DRE SIMPLIFICADO --- */}
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

        {/* --- SEGUROS --- */}
        <TabsContent value="seguros" className="pt-4">
           <SegurosFinanceiro />
        </TabsContent>

        {/* --- CONTABILIDADE --- */}
        <TabsContent value="contabilidade" className="pt-4">
           <ContabilidadeFinanceiro />
        </TabsContent>

      </Tabs>
    </div>
  );
}
