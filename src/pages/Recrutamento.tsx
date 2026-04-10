import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { UserPlus, Filter, Database, Clock, LineChart, Briefcase, PlusCircle, BarChart3, MessageSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Captacao } from "@/components/recrutamento/Captacao";
import { BancoTalentos } from "@/components/recrutamento/BancoTalentos";
import { TriagemIA } from "@/components/recrutamento/TriagemIA";
import { LembretesAuto } from "@/components/recrutamento/LembretesAuto";
import { RecrutamentoAnalytics } from "@/components/recrutamento/RecrutamentoAnalytics";

import { OperacoesRI } from "@/components/recrutamento/OperacoesRI";
import { NovaOperacaoRI } from "@/components/recrutamento/NovaOperacaoRI";
import { IndicadoresRI } from "@/components/recrutamento/IndicadoresRI";
import { DisparosWhatsApp } from "@/components/recrutamento/DisparosWhatsApp";

export default function Recrutamento() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "operacoes";
  const handleTabChange = (val: string) => setSearchParams({ tab: val });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <UserPlus className="w-8 h-8 text-primary" /> Recrutamento Inteligente (RI) – Conexão Express
          </h1>
          <p className="text-muted-foreground">O motor completo para atrair, simular operações, qualificar via IA e automatizar a ativação de profissionais e parceiros.</p>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-card justify-start overflow-x-auto border-b rounded-none w-full">
           <TabsTrigger value="operacoes" className="px-5"><Briefcase className="w-4 h-4 mr-2"/> Operações</TabsTrigger>
           <TabsTrigger value="nova-operacao" className="px-5"><PlusCircle className="w-4 h-4 mr-2"/> Nova Operação</TabsTrigger>
           <TabsTrigger value="indicadores-ri" className="px-5"><BarChart3 className="w-4 h-4 mr-2"/> Indicadores</TabsTrigger>
           <TabsTrigger value="disparos" className="px-5"><MessageSquare className="w-4 h-4 mr-2"/> Disparos WhatsApp</TabsTrigger>
           <TabsTrigger value="captacao" className="px-5 text-muted-foreground"><UserPlus className="w-4 h-4 mr-2"/> Captação Base</TabsTrigger>
           <TabsTrigger value="banco" className="px-5 text-muted-foreground"><Database className="w-4 h-4 mr-2"/> Célula de Talentos</TabsTrigger>
           <TabsTrigger value="triagem" className="px-5 text-muted-foreground"><Filter className="w-4 h-4 mr-2"/> Triagem IA</TabsTrigger>
           <TabsTrigger value="lembretes" className="px-5 text-muted-foreground"><Clock className="w-4 h-4 mr-2"/> Automações Antigas</TabsTrigger>
           <TabsTrigger value="analytics" className="px-5 text-muted-foreground"><LineChart className="w-4 h-4 mr-2"/> Analytics Base</TabsTrigger>
        </TabsList>

        <TabsContent value="operacoes" className="pt-4"><OperacoesRI /></TabsContent>
        <TabsContent value="nova-operacao" className="pt-4"><NovaOperacaoRI /></TabsContent>
        <TabsContent value="indicadores-ri" className="pt-4"><IndicadoresRI /></TabsContent>
        <TabsContent value="disparos" className="pt-4"><DisparosWhatsApp /></TabsContent>
        
        <TabsContent value="captacao" className="pt-4"><Captacao /></TabsContent>
        <TabsContent value="banco" className="pt-4"><BancoTalentos /></TabsContent>
        <TabsContent value="triagem" className="pt-4"><TriagemIA /></TabsContent>
        <TabsContent value="lembretes" className="pt-4"><LembretesAuto /></TabsContent>
        <TabsContent value="analytics" className="pt-4"><RecrutamentoAnalytics /></TabsContent>
      </Tabs>
    </div>
  );
}
