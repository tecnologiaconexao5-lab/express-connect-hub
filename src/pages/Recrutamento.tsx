import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { UserPlus, Filter, Database, Clock, LineChart, Briefcase, PlusCircle, BarChart3, MessageSquare, Truck, Bot } from "lucide-react";
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
import { BancoMotoristas } from "@/components/recrutamento/BancoMotoristas";
import { WhatsAppIAPrestadores } from "@/components/recrutamento/WhatsAppIAPrestadores";

export default function Recrutamento() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "operacoes";
  const handleTabChange = (val: string) => setSearchParams({ tab: val });

  return (
    <div className="animate-fade-in">
      {/* Header enterprise */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm shrink-0">
            <UserPlus className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Recrutamento Inteligente
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Atrair, simular operações, qualificar via IA e automatizar a ativação de parceiros.
            </p>
          </div>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        {/* Tabs bar enterprise — distribuída */}
        <div className="mb-6 border-b border-border">
          <TabsList className="h-auto bg-transparent p-0 gap-0 flex flex-wrap">
            <TabsTrigger value="operacoes" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary pb-3 px-4">
              <Briefcase className="w-4 h-4"/>Operações
            </TabsTrigger>
            <TabsTrigger value="nova-operacao" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary pb-3 px-4">
              <PlusCircle className="w-4 h-4"/>Nova Operação
            </TabsTrigger>
            <TabsTrigger value="indicadores-ri" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary pb-3 px-4">
              <BarChart3 className="w-4 h-4"/>Indicadores
            </TabsTrigger>
            <TabsTrigger value="disparos" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary pb-3 px-4">
              <MessageSquare className="w-4 h-4"/>Disparos WApp
            </TabsTrigger>
            <TabsTrigger value="motoristas" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary pb-3 px-4">
              <Truck className="w-4 h-4"/>Banco Motoristas
            </TabsTrigger>
            <TabsTrigger value="whatsapp-ia" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-green-500 data-[state=active]:bg-transparent data-[state=active]:text-green-600 pb-3 px-4">
              <Bot className="w-4 h-4"/>WhatsApp IA
            </TabsTrigger>
            <TabsTrigger value="captacao" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary pb-3 px-4 text-muted-foreground">
              <UserPlus className="w-4 h-4"/>Captação
            </TabsTrigger>
            <TabsTrigger value="banco" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary pb-3 px-4 text-muted-foreground">
              <Database className="w-4 h-4"/>Talentos
            </TabsTrigger>
            <TabsTrigger value="triagem" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary pb-3 px-4 text-muted-foreground">
              <Filter className="w-4 h-4"/>Triagem IA
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="operacoes"><OperacoesRI /></TabsContent>
        <TabsContent value="nova-operacao"><NovaOperacaoRI /></TabsContent>
        <TabsContent value="indicadores-ri"><IndicadoresRI /></TabsContent>
        <TabsContent value="disparos"><DisparosWhatsApp /></TabsContent>
        <TabsContent value="whatsapp-ia"><WhatsAppIAPrestadores /></TabsContent>
        <TabsContent value="motoristas"><BancoMotoristas /></TabsContent>
        <TabsContent value="captacao"><Captacao /></TabsContent>
        <TabsContent value="banco"><BancoTalentos /></TabsContent>
        <TabsContent value="triagem"><TriagemIA /></TabsContent>
        <TabsContent value="lembretes"><LembretesAuto /></TabsContent>
        <TabsContent value="analytics"><RecrutamentoAnalytics /></TabsContent>
      </Tabs>
    </div>
  );
}
