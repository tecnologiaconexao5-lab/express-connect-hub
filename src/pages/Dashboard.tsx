import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutDashboard, Activity, TrendingUp, DollarSign, Bell, Network, Radio } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import DashboardTopbar from "@/components/dashboard/DashboardTopbar";
import AlertaOscotacaoExpress from "@/components/dashboard/AlertaOscotacaoExpress";
import TabExecutivo from "@/components/dashboard/TabExecutivo";
import TabOperacional from "@/components/dashboard/TabOperacional";
import TabComercial from "@/components/dashboard/TabComercial";
import TabFinanceiro from "@/components/dashboard/TabFinanceiro";
import TabAlertas from "@/components/dashboard/TabAlertas";
import TabRede from "@/components/dashboard/TabRede";
import TabEventos from "@/components/dashboard/TabEventos";
import { DashboardFilterProvider } from "@/contexts/DashboardFilterContext";

const AlertaPrestadoresAguardandoValidacao = () => {
  const [prestadoresAguardandoValidacao, setPrestadoresAguardandoValidacao] = useState(0);

  useEffect(() => {
    let active = true;

    const contarPrestadoresPendentes = async () => {
      const { count, error } = await supabase
        .from("prestadores")
        .select("id", { count: "exact", head: true })
        .or(
          "status.in.(analise,em_analise),and(origem_cadastro.eq.app_motorista,liberado_app.eq.false),and(origem_cadastro.eq.app_motorista,liberado_app.is.null)",
        );

      if (error) {
        console.error("[Dashboard] Erro ao contar prestadores aguardando validação:", error);
        return;
      }

      if (active) setPrestadoresAguardandoValidacao(count ?? 0);
    };

    void contarPrestadoresPendentes();
    return () => {
      active = false;
    };
  }, []);

  return prestadoresAguardandoValidacao > 0 ? (
    <Link
      to="/cadastros/prestadores"
      role="alert"
      className="mb-6 flex items-center rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100"
    >
      ⚠️ {prestadoresAguardandoValidacao} novo(s) cadastro(s) de prestador aguardando validação
    </Link>
  ) : null;
};

const Dashboard = () => (
  <DashboardFilterProvider>
  <div className="animate-fade-in">
    <div className="flex items-center gap-4 mb-6">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm">
        <LayoutDashboard className="w-6 h-6 text-primary" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Centro de Controle Operacional</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Visão consolidada da operação em tempo real</p>
      </div>
    </div>

    <AlertaPrestadoresAguardandoValidacao />

    <DashboardTopbar />

    {/* Solicitações de clientes via site — banner imediato no topo do Dashboard */}
    <div className="mb-6">
      <AlertaOscotacaoExpress />
    </div>

    <Tabs defaultValue="operacional" className="w-full">
      <div className="border-b border-border mb-6 overflow-x-auto">
        <TabsList className="h-auto bg-transparent p-0 gap-0 min-w-max">
          <TabsTrigger value="operacional" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary pb-3 px-5">
            <Activity className="w-4 h-4"/>Operacional
          </TabsTrigger>
          <TabsTrigger value="executivo" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary pb-3 px-5">
            <TrendingUp className="w-4 h-4"/>Executivo
          </TabsTrigger>
          <TabsTrigger value="rede" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary pb-3 px-5">
            <Network className="w-4 h-4"/>Rede Enterprise
          </TabsTrigger>
          <TabsTrigger value="comercial" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary pb-3 px-5">
            <DollarSign className="w-4 h-4"/>Comercial
          </TabsTrigger>
          <TabsTrigger value="financeiro" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary pb-3 px-5">
            <TrendingUp className="w-4 h-4"/>Financeiro
          </TabsTrigger>
          <TabsTrigger value="alertas" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary pb-3 px-5">
            <Bell className="w-4 h-4"/>Alertas
          </TabsTrigger>
          <TabsTrigger value="eventos" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary pb-3 px-5">
            <Radio className="w-4 h-4"/>Eventos
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="operacional"><TabOperacional /></TabsContent>
      <TabsContent value="executivo"><TabExecutivo /></TabsContent>
      <TabsContent value="rede"><TabRede /></TabsContent>
      <TabsContent value="comercial"><TabComercial /></TabsContent>
      <TabsContent value="financeiro"><TabFinanceiro /></TabsContent>
      <TabsContent value="alertas"><TabAlertas /></TabsContent>
      <TabsContent value="eventos"><TabEventos /></TabsContent>
    </Tabs>
  </div>
  </DashboardFilterProvider>
);

export default Dashboard;

