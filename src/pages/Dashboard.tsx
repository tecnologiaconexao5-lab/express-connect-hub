import { LayoutDashboard, Activity, TrendingUp, DollarSign, Bell } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardTopbar from "@/components/dashboard/DashboardTopbar";
import TabExecutivo from "@/components/dashboard/TabExecutivo";
import TabOperacional from "@/components/dashboard/TabOperacional";
import TabComercial from "@/components/dashboard/TabComercial";
import TabFinanceiro from "@/components/dashboard/TabFinanceiro";
import TabAlertas from "@/components/dashboard/TabAlertas";

const Dashboard = () => (
  <div className="animate-fade-in">
    {/* Header enterprise */}
    <div className="flex items-center gap-4 mb-6">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm">
        <LayoutDashboard className="w-6 h-6 text-primary" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Visão consolidada de operações, comercial e financeiro</p>
      </div>
    </div>

    <DashboardTopbar />

    <Tabs defaultValue="executivo" className="w-full">
      {/* Underline tabs — enterprise style */}
      <div className="border-b border-border mb-6">
        <TabsList className="h-auto bg-transparent p-0 gap-0">
          <TabsTrigger value="executivo" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary pb-3 px-5">
            <Activity className="w-4 h-4"/>Executivo
          </TabsTrigger>
          <TabsTrigger value="operacional" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary pb-3 px-5">
            <TrendingUp className="w-4 h-4"/>Operacional
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
        </TabsList>
      </div>

      <TabsContent value="executivo"><TabExecutivo /></TabsContent>
      <TabsContent value="operacional"><TabOperacional /></TabsContent>
      <TabsContent value="comercial"><TabComercial /></TabsContent>
      <TabsContent value="financeiro"><TabFinanceiro /></TabsContent>
      <TabsContent value="alertas"><TabAlertas /></TabsContent>
    </Tabs>
  </div>
);

export default Dashboard;

