import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { UserPlus, Filter, Database, Clock, LineChart } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Captacao } from "@/components/recrutamento/Captacao";
import { BancoTalentos } from "@/components/recrutamento/BancoTalentos";
import { TriagemIA } from "@/components/recrutamento/TriagemIA";
import { LembretesAuto } from "@/components/recrutamento/LembretesAuto";
import { RecrutamentoAnalytics } from "@/components/recrutamento/RecrutamentoAnalytics";

export default function Recrutamento() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "captacao";
  const handleTabChange = (val: string) => setSearchParams({ tab: val });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <UserPlus className="w-8 h-8 text-primary" /> Recrutamento e Admissão de Malha
          </h1>
          <p className="text-muted-foreground">O motor completo para atrair, qualificar via IA e automatizar a ativação de terceiros e agregados.</p>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-card justify-start overflow-x-auto border-b rounded-none w-full">
           <TabsTrigger value="captacao" className="px-5"><UserPlus className="w-4 h-4 mr-2"/> Captação</TabsTrigger>
           <TabsTrigger value="banco" className="px-5"><Database className="w-4 h-4 mr-2"/> Célula de Talentos</TabsTrigger>
           <TabsTrigger value="triagem" className="px-5"><Filter className="w-4 h-4 mr-2"/> Triagem IA</TabsTrigger>
           <TabsTrigger value="lembretes" className="px-5"><Clock className="w-4 h-4 mr-2"/> Automações (Wapp)</TabsTrigger>
           <TabsTrigger value="analytics" className="px-5"><LineChart className="w-4 h-4 mr-2"/> Analytics da Jornada</TabsTrigger>
        </TabsList>

        <TabsContent value="captacao" className="pt-4"><Captacao /></TabsContent>
        <TabsContent value="banco" className="pt-4"><BancoTalentos /></TabsContent>
        <TabsContent value="triagem" className="pt-4"><TriagemIA /></TabsContent>
        <TabsContent value="lembretes" className="pt-4"><LembretesAuto /></TabsContent>
        <TabsContent value="analytics" className="pt-4"><RecrutamentoAnalytics /></TabsContent>
      </Tabs>
    </div>
  );
}
