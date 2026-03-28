import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CrmKanban from "./CrmKanban";
import CrmLeads from "./CrmLeads";
import CrmAtividades from "./CrmAtividades";
import { LayoutDashboard, Users, CalendarDays } from "lucide-react";

export default function CrmBase() {
  const [activeTab, setActiveTab] = useState("pipeline");

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-lg">
          <TabsTrigger value="pipeline" className="text-xs uppercase tracking-wider"><LayoutDashboard className="w-3.5 h-3.5 mr-2" /> Pipeline Kanban</TabsTrigger>
          <TabsTrigger value="leads" className="text-xs uppercase tracking-wider"><Users className="w-3.5 h-3.5 mr-2" /> Gestão de Leads</TabsTrigger>
          <TabsTrigger value="atividades" className="text-xs uppercase tracking-wider"><CalendarDays className="w-3.5 h-3.5 mr-2" /> Atividades</TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <TabsContent value="pipeline" className="m-0"><CrmKanban /></TabsContent>
          <TabsContent value="leads" className="m-0"><CrmLeads /></TabsContent>
          <TabsContent value="atividades" className="m-0"><CrmAtividades /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
