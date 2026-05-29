import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign, Download, UploadCloud, PieChart, CheckCircle2, MoreHorizontal, FileText, Target, UserMinus, ShieldCheck, CreditCard, ArrowRightLeft, Plus, Search, LayoutDashboard, Calculator, BookOpen, Landmark, Users, Package, Clock, Receipt, TrendingUpIcon, FileCheck, FileX, Check, X, Eye, Edit, Trash2, AlertCircle, Sparkles, MoreVertical } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
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
import MargemPorOS from "@/components/financeiro/MargemPorOS";
import DateRangePicker from "@/components/ui/DateRangePicker";
import ContasBancarias from "@/components/financeiro/ContasBancarias";
import ReciboRapido from "@/components/financeiro/ReciboRapido";
import ContasReceberEnterprise from "@/components/financeiro/ContasReceberEnterprise";
import ContasPagar from "@/components/financeiro/ContasPagar";
import PagamentoPrestadores from "@/components/financeiro/PagamentoPrestadores";
import RelatorioFinanceiroCompleto from "@/components/financeiro/RelatorioFinanceiroCompleto";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Helper: format numeric input as BRL currency string
const parseCurrency = (s: string): number => {
  const clean = s.replace(/[^\d,]/g, "").replace(",", ".");
  return parseFloat(clean) || 0;
};

// Status badge com cores padronizadas
const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string }> = {
    "a vencer": { label: "A Vencer", cls: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300" },
    vencida: { label: "Vencida", cls: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300" },
    paga: { label: "Paga", cls: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300" },
    cancelada: { label: "Cancelada", cls: "bg-gray-100 text-gray-500 border-gray-200" },
  };
  const entry = map[status?.toLowerCase()] ?? { label: status ?? "-", cls: "bg-gray-100 text-gray-500" };
  return <Badge variant="outline" className={`text-[11px] font-semibold px-2.5 py-0.5 ${entry.cls}`}>{entry.label}</Badge>;
};

const categoriasPagar = [
  "Energia elétrica", "Água", "Aluguel", "Internet/telefone", 
  "Software/licenças", "Combustível frota própria", "Manutenção", 
  "Folha de pagamento (CLT)", "Impostos (DAS, DCTF, etc.)", "Outros"
];

export default function Financeiro() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "receber";
  const [subTabRentabilidade, setSubTabRentabilidade] = useState("por-os");
  const [dateRange, setDateRange] = useState<{from: Date | undefined; to: Date | undefined}>({ from: undefined, to: undefined });

  const handleTabChange = (val: string) => setSearchParams({ tab: val });

  const StatCard = ({ title, value, sub, icon: Icon, gradient, iconBg }: any) => (
    <div className="relative overflow-hidden rounded-xl border bg-card shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 p-5 flex items-center justify-between">
      <div className={`absolute top-0 left-0 right-0 h-1 ${gradient}`} />
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{title}</p>
        <p className="text-2xl font-black text-foreground leading-none">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1.5 font-medium">{sub}</p>}
      </div>
      <div className={`p-3 rounded-xl ${iconBg} shadow-sm`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
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
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="mb-4 justify-start overflow-x-auto flex-wrap">
            <TabsTrigger value="dashboard" className="gap-2"><LayoutDashboard className="w-4 h-4"/>Dashboard</TabsTrigger>
            <TabsTrigger value="receber" className="gap-2"><ArrowDownRight className="w-4 h-4"/>Receber</TabsTrigger>
            <TabsTrigger value="pagar" className="gap-2"><ArrowUpRight className="w-4 h-4"/>Pagar</TabsTrigger>
            <TabsTrigger value="pagamento-prestadores" className="gap-2"><Users className="w-4 h-4"/>Pag. Prestadores</TabsTrigger>
            <TabsTrigger value="margem-os" className="gap-2"><TrendingUpIcon className="w-4 h-4"/>Margem por OS</TabsTrigger>
            <TabsTrigger value="fluxo" className="gap-2"><TrendingUp className="w-4 h-4"/>Fluxo de Caixa</TabsTrigger>
            <TabsTrigger value="dre" className="gap-2"><Calculator className="w-4 h-4"/>DRE</TabsTrigger>
            <TabsTrigger value="conciliacao" className="gap-2"><ArrowRightLeft className="w-4 h-4"/>Conciliação</TabsTrigger>
            <TabsTrigger value="lotes" className="gap-2"><CreditCard className="w-4 h-4"/>CNAB</TabsTrigger>
            <TabsTrigger value="plano-contas" className="gap-2"><BookOpen className="w-4 h-4"/>Plano de Contas</TabsTrigger>
            <TabsTrigger value="contas-caixas" className="gap-2"><Landmark className="w-4 h-4"/>Contas & Caixas</TabsTrigger>
            <TabsTrigger value="inadimplencia" className="gap-2"><UserMinus className="w-4 h-4"/>Inadimplência</TabsTrigger>
            <TabsTrigger value="relatorios" className="gap-2"><FileText className="w-4 h-4"/>Relatórios</TabsTrigger>
            <TabsTrigger value="margem" className="gap-2"><Target className="w-4 h-4"/>Margem</TabsTrigger>
            <TabsTrigger value="provisoes" className="gap-2"><Clock className="w-4 h-4"/>Provisões</TabsTrigger>
            <TabsTrigger value="centro-resultado" className="gap-2"><PieChart className="w-4 h-4"/>Centro Resultado</TabsTrigger>
            <TabsTrigger value="recibos" className="gap-2"><Receipt className="w-4 h-4"/>Recibos</TabsTrigger>
            <TabsTrigger value="rentabilidade" className="gap-2"><TrendingUpIcon className="w-4 h-4"/>Rentabilidade</TabsTrigger>
            <TabsTrigger value="pendencias" className="gap-2"><ShieldCheck className="w-4 h-4 text-red-500"/>Pendências</TabsTrigger>
            <TabsTrigger value="seguros-auto" className="gap-2"><ShieldCheck className="w-4 h-4"/>Seguros Auto</TabsTrigger>
            <TabsTrigger value="contabilidade" className="gap-2"><FileText className="w-4 h-4"/>Contabilidade</TabsTrigger>
        </TabsList>

        {/* --- DASHBOARD FINANCEIRO ENTERPRISE --- */}
        <TabsContent value="dashboard" className="pt-4">
          <DashboardFinanceiroEnterprise />
        </TabsContent>

        {/* --- CONTAS A RECEBER --- */}
        <TabsContent value="receber" className="pt-4">
           <ContasReceberEnterprise />
        </TabsContent>

        {/* --- CONTAS A PAGAR --- */}
        <TabsContent value="pagar" className="pt-4">
           <ContasPagar />
        </TabsContent>

        {/* --- PAGAMENTO DE PRESTADORES --- */}
        <TabsContent value="pagamento-prestadores" className="pt-4">
           <PagamentoPrestadores />
        </TabsContent>

        {/* --- CONTAS & CAIXAS (NOVO) --- */}
        <TabsContent value="contas-caixas" className="pt-4">
           <ContasBancarias />
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

        {/* --- MARGEM POR OS --- */}
        <TabsContent value="margem-os" className="pt-4">
           <MargemPorOS />
        </TabsContent>

        {/* --- DRE --- / substituido por Margem */}
        <TabsContent value="margem" className="pt-4">
           <MargemOperacional />
        </TabsContent>

        {/* --- SEGUROS --- */}
        <TabsContent value="seguros-auto" className="pt-4">
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
           <Tabs defaultValue="lista">
             <TabsList className="mb-4 bg-muted/50">
               <TabsTrigger value="lista"><FileCheck className="w-4 h-4 mr-2" /> Recibos Emitidos</TabsTrigger>
               <TabsTrigger value="novo-rapido"><Plus className="w-4 h-4 mr-2" /> Recibo Rápido</TabsTrigger>
             </TabsList>
             
              <TabsContent value="lista" className="space-y-4">
                <Card>
                  <CardHeader className="py-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">Lista de Recibos Emitidos</CardTitle>
                    <Badge variant="secondary" className="text-[10px]">Em desenvolvimento</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12 text-muted-foreground">
                      <FileCheck className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p className="font-medium">Módulo de recibos em desenvolvimento</p>
                      <p className="text-sm mt-1">Os recibos serão gerados automaticamente a partir das OS finalizadas.</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
             
             <TabsContent value="novo-rapido">
                <ReciboRapido />
             </TabsContent>
           </Tabs>
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
                <Button variant="outline" onClick={() => toast.info("Exportação em desenvolvimento")}><Download className="w-4 h-4 mr-2" />Exportar PDF</Button>
                <Button variant="outline" onClick={() => toast.info("Exportação em desenvolvimento")}><FileCheck className="w-4 h-4 mr-2" />Exportar Excel</Button>
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
                    <CardDescription>Acesse a tab <strong>Margem por OS</strong> no menu principal para dados reais.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12 text-muted-foreground">
                      <TrendingUpIcon className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p className="font-medium">Dados demonstrativos removidos</p>
                      <p className="text-sm mt-1">A rentabilidade real está disponível em <strong>Margem por OS</strong> com dados do Supabase.</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* RENTABILIDADE POR CLIENTE */}
              <TabsContent value="por-cliente" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Margem por Cliente</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12 text-muted-foreground">
                      <TrendingUpIcon className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p className="font-medium">Em desenvolvimento</p>
                      <p className="text-sm mt-1">Relatório de rentabilidade por cliente estará disponível em breve.</p>
                    </div>
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
                <Card>
                  <CardContent>
                    <div className="text-center py-12 text-muted-foreground">
                      <TrendingUpIcon className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p className="font-medium">Ranking em desenvolvimento</p>
                      <p className="text-sm mt-1">Top desempenho por prestadores, clientes, rotas e veículos estará disponível em breve.</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              </Tabs>
        </TabsContent>

        {/* --- RELATÓRIOS FINANCEIROS --- */}
        <TabsContent value="relatorios" className="pt-4">
          <RelatorioFinanceiroCompleto />
        </TabsContent>

      </Tabs>
    </div>
  );
}
