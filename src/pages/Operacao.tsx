import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ClipboardList, Calendar, MapPin, Truck, AlertTriangle, FileCheck, ArrowRightLeft, RotateCcw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlaceholderPage from "@/components/PlaceholderPage";
import OrdensServicoLista from "@/components/operacao/OrdensServicoLista";
import OcorrenciasLista from "@/components/operacao/OcorrenciasLista";
import EscalaLista from "@/components/operacao/EscalaLista";
import PodLista from "@/components/operacao/PodLista";
import RoteirizacaoLista from "@/components/operacao/RoteirizacaoLista";
import { Route as MapIconSolid } from "lucide-react";

const Operacao = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "os";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="w-8 h-8 text-primary" />
            Operação
          </h1>
          <p className="text-muted-foreground">Gestão completa do ciclo operacional</p>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-card border w-full justify-start overflow-x-auto">
          <TabsTrigger value="os" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <ClipboardList className="w-4 h-4 mr-2" />
            Ordens de Serviço
          </TabsTrigger>
          <TabsTrigger value="escala" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Calendar className="w-4 h-4 mr-2" />
            Escala Operacional
          </TabsTrigger>
          <TabsTrigger value="roteirizacao" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <MapIconSolid className="w-4 h-4 mr-2" />
            Roteirizador Web
          </TabsTrigger>
          <TabsTrigger value="ocorrencias" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Ocorrências Rastreio
          </TabsTrigger>
          <TabsTrigger value="pod" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <FileCheck className="w-4 h-4 mr-2" />
            Baixas e Evidências
          </TabsTrigger>
          <TabsTrigger value="devolucoes" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <RotateCcw className="w-4 h-4 mr-2" />
            Logística Reversa
          </TabsTrigger>
          <TabsTrigger value="reentregas" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            Reentregas Aprovadas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="os">
          <OrdensServicoLista />
        </TabsContent>

        <TabsContent value="escala">
          <EscalaLista />
        </TabsContent>

        <TabsContent value="roteirizacao">
          <RoteirizacaoLista />
        </TabsContent>

        <TabsContent value="ocorrencias">
          <OcorrenciasLista />
        </TabsContent>

        <TabsContent value="pod">
          <PodLista />
        </TabsContent>

        <TabsContent value="devolucoes">
          <PlaceholderPage
             title="Logística Reversa / Devolução"
             description="Tratamento de recusas e retornos à DOCA matriz."
             icon={RotateCcw}
             subModules={[]}
          />
        </TabsContent>
        <TabsContent value="reentregas">
          <PlaceholderPage
             title="Demandas de Reentrega"
             description="Controle sistêmico de 2ª tentativa e rotas reprocessadas."
             icon={ArrowRightLeft}
             subModules={[]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Operacao;
