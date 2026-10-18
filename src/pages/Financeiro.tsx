import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DollarSign, Download, UploadCloud, PieChart, MoreHorizontal, FileText, Target, ShieldCheck, ArrowRightLeft, Plus, Search, LayoutDashboard, Calculator, BookOpen, Landmark, Users, Package, Clock, Receipt, TrendingUpIcon, FileCheck, FileX, Check, X, Eye, Edit, Trash2, AlertCircle, Sparkles, MoreVertical, Gauge, ListChecks, CircleCheck, HandCoins, UserX, Wallet, ArrowLeftRight, Banknote, ChartNoAxesCombined, FileChartColumn, ReceiptText, Settings, SlidersHorizontal, Layers } from "lucide-react";
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
import ConferenciaFinanceira from "@/components/financeiro/ConferenciaFinanceira";
import FaturaLista from "@/components/financeiro/FaturaLista";
import RelatorioFaturamentoCliente from "@/components/financeiro/relatorios/RelatorioFaturamentoCliente";
import ConfigFinanceira from "@/components/financeiro/ConfigFinanceira";
import RegrasFinanceirasClienteTab from "@/components/financeiro/RegrasFinanceirasClienteTab";
import { GRUPOS_NAVEGACAO, grupoPorTab, funcaoPadraoDoGrupo, type FinanceiroNavGrupo } from "@/components/financeiro/financeiroNav";
import { cn } from "@/lib/utils";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Ícones por aba (navegação agrupada F0-L) — TMS-LAYOUT-01 (ícones profissionais por módulo)
const NAV_ICONES: Record<string, any> = {
  // Visão Geral
  dashboard: LayoutDashboard, pendencias: ListChecks,
  // Faturamento
  conferencia: CircleCheck, faturas: Receipt, receber: HandCoins, inadimplencia: UserX,
  "relatorio-faturamento": FileChartColumn,
  // Pagamentos
  pagar: Wallet, "pagamento-prestadores": Users,
  // Tesouraria
  fluxo: ArrowRightLeft, "contas-caixas": Landmark, conciliacao: ArrowLeftRight, lotes: Banknote,
  // Gestão
  dre: Calculator, "margem-os": ChartNoAxesCombined, relatorios: FileChartColumn, recibos: ReceiptText,
  // Outros (legado)
  margem: Target, rentabilidade: TrendingUpIcon, "seguros-auto": ShieldCheck, contabilidade: FileText,
  // Configurações
  "plano-contas": BookOpen, "config-financeira": Settings, "regras-cliente": SlidersHorizontal,
};

// Ícones por grupo (cabeçalhos da navegação agrupada)
const GRUPO_ICONES: Record<string, any> = {
  "Visão Geral": Gauge,
  "Faturamento": Receipt,
  "Pagamentos": HandCoins,
  "Tesouraria": Landmark,
  "Gestão": FileChartColumn,
  "Outros (legado)": Layers,
  "Configurações": Settings,
};

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

  // TMS-LAYOUT-02 — categoria ativa derivada automaticamente da aba atual
  // (a rota já identifica a aba → não exige cliques extras).
  const grupoAtivo = grupoPorTab(currentTab);

  // Ao clicar em uma categoria: preserva a aba ativa quando ela pertence ao
  // grupo; caso contrário seleciona a função padrão (primeira) do grupo.
  const handleCategoriaClick = (grupo: FinanceiroNavGrupo) => {
    if (grupo.itens.some((i) => i.valor === currentTab)) return;
    setSearchParams({ tab: funcaoPadraoDoGrupo(grupo) });
  };

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
            <DollarSign className="w-8 h-8 text-primary" /> Gestão Financeira
          </h1>
          <p className="text-muted-foreground">Visão geral e controle do dinheiro do Hub.</p>
        </div>
        <div className="flex gap-2">
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <div className="mb-5 space-y-3">
          {/* NÍVEL 1 — CATEGORIAS (barra única; sem dezenas de funções simultâneas) */}
          <div className="rounded-xl border border-border/60 bg-card p-1.5 shadow-sm">
            <div className="flex flex-wrap items-center gap-1">
              {GRUPOS_NAVEGACAO.map((grupo) => {
                const GrupoIcon = GRUPO_ICONES[grupo.grupo];
                const ativa = grupo.grupo === grupoAtivo.grupo;
                return (
                  <button
                    key={grupo.grupo}
                    type="button"
                    onClick={() => handleCategoriaClick(grupo)}
                    title={grupo.grupo}
                    className={cn(
                      "flex h-12 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors duration-150 border",
                      "flex-1 sm:flex-none sm:px-4",
                      ativa
                        ? "bg-primary/10 text-primary shadow-sm border-primary/25"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground border-transparent"
                    )}
                  >
                    {GrupoIcon && <GrupoIcon className="w-4 h-4 shrink-0" />}
                    <span>{grupo.grupo === "Outros (legado)" ? "Outros" : grupo.grupo}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* NÍVEL 2 — FUNÇÕES DO GRUPO ATIVO (somente o grupo selecionado) */}
          <TabsList className="h-auto w-full justify-start gap-1.5 rounded-xl bg-muted/40 p-1.5 flex-nowrap overflow-x-auto sm:flex-wrap sm:overflow-visible">
            {grupoAtivo.itens.map((item) => {
              const ItemIcon = NAV_ICONES[item.valor];
              return (
                <TabsTrigger
                  key={item.valor}
                  value={item.valor}
                  className="flex-none gap-1.5 rounded-lg px-3.5 py-2 text-sm"
                >
                  {ItemIcon && <ItemIcon className="w-4 h-4 shrink-0" />}
                  {item.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* --- DASHBOARD FINANCEIRO ENTERPRISE --- */}
        <TabsContent value="dashboard" className="pt-4">
          <DashboardFinanceiroEnterprise />
        </TabsContent>

        {/* --- CONFERENCIA FINANCEIRA (Operações Finalizadas) --- */}
        <TabsContent value="conferencia" className="pt-4">
          <ConferenciaFinanceira />
        </TabsContent>

        {/* --- FATURAS (Estrutura oficial Fase 2A/2B) --- */}
        <TabsContent value="faturas" className="pt-4">
          <FaturaLista />
        </TabsContent>

        {/* --- CONFIGURAÇÕES FINANCEIRAS DA CONEXÃO (A31) --- */}
        <TabsContent value="config-financeira" className="pt-4">
          <ConfigFinanceira />
        </TabsContent>

        {/* --- REGRAS FINANCEIRAS POR CLIENTE (A31) --- */}
        <TabsContent value="regras-cliente" className="pt-4">
          <RegrasFinanceirasClienteTab />
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

        {/* --- RELATÓRIO DE FATURAMENTO (relatório do cliente; componente reutilizado) --- */}
        <TabsContent value="relatorio-faturamento" className="pt-4">
           <RelatorioFaturamentoCliente />
        </TabsContent>

        <TabsContent value="conciliacao" className="pt-4">
            <ConciliacaoAvancada />
         </TabsContent>

         {/* --- RECIBOS --- */}
         <TabsContent value="recibos" className="pt-4">
            <ReciboRapido />
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
                  <Button variant="outline" disabled title="Exportacao em desenvolvimento"><Download className="w-4 h-4 mr-2" />Exportar PDF</Button>
                  <Button variant="outline" disabled title="Exportacao em desenvolvimento"><FileCheck className="w-4 h-4 mr-2" />Exportar Excel</Button>
               </div>
            </div>

            <Tabs value={subTabRentabilidade} onValueChange={setSubTabRentabilidade}>
              <TabsList>
                <TabsTrigger value="por-os">Por OS</TabsTrigger>
              </TabsList>

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
