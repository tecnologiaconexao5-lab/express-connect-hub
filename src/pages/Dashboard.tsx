import { LayoutDashboard } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardTopbar from "@/components/dashboard/DashboardTopbar";
import TabExecutivo from "@/components/dashboard/TabExecutivo";
import TabOperacional from "@/components/dashboard/TabOperacional";
import TabComercial from "@/components/dashboard/TabComercial";
import TabFinanceiro from "@/components/dashboard/TabFinanceiro";
import TabAlertas from "@/components/dashboard/TabAlertas";

const Dashboard = () => (
  <div className="animate-fade-in">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
        <LayoutDashboard className="w-5 h-5 text-primary" />
      </div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
    </div>

    <DashboardTopbar />

    <Tabs defaultValue="executivo" className="w-full">
      <TabsList className="mb-4 bg-muted/60">
        <TabsTrigger value="executivo">Executivo</TabsTrigger>
        <TabsTrigger value="operacional">Operacional</TabsTrigger>
        <TabsTrigger value="comercial">Comercial</TabsTrigger>
        <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
        <TabsTrigger value="alertas">Alertas</TabsTrigger>
      </TabsList>

      <TabsContent value="executivo"><TabExecutivo /></TabsContent>
      <TabsContent value="operacional"><TabOperacional /></TabsContent>
      <TabsContent value="comercial"><TabComercial /></TabsContent>
      <TabsContent value="financeiro"><TabFinanceiro /></TabsContent>
      <TabsContent value="alertas"><TabAlertas /></TabsContent>
    </Tabs>
  </div>
);

export default Dashboard;
