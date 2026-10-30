import { LayoutDashboard, Activity, TrendingUp, DollarSign, Bell, Network, Radio } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

