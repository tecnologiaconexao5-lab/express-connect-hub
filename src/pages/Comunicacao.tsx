import { useState } from "react";
import { Megaphone, Gift, History, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CentralComunicacao } from "@/components/comunicacao/CentralComunicacao";
import { Aniversariantes } from "@/components/comunicacao/Aniversariantes";

const Comunicacao = () => {
  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Megaphone className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Central de Comunicação</h1>
          <p className="text-sm text-muted-foreground">
            Comunicação em lote, campanhas e engajamento com prestadores
          </p>
        </div>
      </div>

      <Tabs defaultValue="comunicacao" className="w-full">
        <TabsList>
          <TabsTrigger value="comunicacao" className="gap-2">
            <Megaphone className="w-4 h-4" />
            Nova Comunicação
          </TabsTrigger>
          <TabsTrigger value="aniversariantes" className="gap-2">
            <Gift className="w-4 h-4" />
            Aniversariantes
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <History className="w-4 h-4" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="w-4 h-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comunicacao" className="mt-6">
          <CentralComunicacao />
        </TabsContent>

        <TabsContent value="aniversariantes" className="mt-6">
          <Aniversariantes />
        </TabsContent>

        <TabsContent value="historico" className="mt-6">
          <div className="p-8 text-center text-muted-foreground">
            Histórico de comunicações em desenvolvimento
          </div>
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <div className="p-8 text-center text-muted-foreground">
            Biblioteca de templates em desenvolvimento
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Comunicacao;
