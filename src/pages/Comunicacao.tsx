import { useState } from "react";
import { Megaphone, Gift, History, FileText, MessageSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CentralComunicacao } from "@/components/comunicacao/CentralComunicacao";
import { Aniversariantes } from "@/components/comunicacao/Aniversariantes";
import { ConversasHub } from "@/components/comunicacao/ConversasHub";

const Comunicacao = () => {
  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Megaphone className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Hub de Comunicação</h1>
          <p className="text-sm text-muted-foreground">
            Gestão unificada de WhatsApp, E-mail e disparos em lote
          </p>
        </div>
      </div>

      <Tabs defaultValue="conversas" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="conversas" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Conversas (Chat)
          </TabsTrigger>
          <TabsTrigger value="comunicacao" className="gap-2">
            <Megaphone className="w-4 h-4" />
            Disparo em Lote
          </TabsTrigger>
          <TabsTrigger value="aniversariantes" className="gap-2">
            <Gift className="w-4 h-4" />
            Aniversariantes
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="w-4 h-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conversas" className="mt-6 m-0">
          <ConversasHub />
        </TabsContent>

        <TabsContent value="comunicacao" className="mt-6">
          <CentralComunicacao />
        </TabsContent>

        <TabsContent value="aniversariantes" className="mt-6">
          <Aniversariantes />
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
