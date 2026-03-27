import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ClipboardList, Calendar, MapPin, Truck, AlertTriangle, FileCheck, ArrowRightLeft, RotateCcw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlaceholderPage from "@/components/PlaceholderPage";
import OrdensServicoLista from "@/components/operacao/OrdensServicoLista";

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
            Escala
          </TabsTrigger>
          <TabsTrigger value="ocorrencias" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Ocorrências
          </TabsTrigger>
          <TabsTrigger value="pod" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <FileCheck className="w-4 h-4 mr-2" />
            Comprovantes / POD
          </TabsTrigger>
          <TabsTrigger value="devolucoes" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <RotateCcw className="w-4 h-4 mr-2" />
            Devoluções
          </TabsTrigger>
          <TabsTrigger value="reentregas" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            Reentregas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="os">
          <OrdensServicoLista />
        </TabsContent>

        <TabsContent value="escala">
          <PlaceholderPage
            title="Escala e Roteirização"
            description="Distribuição inteligente de frotas e parceiros rodoviários."
            icon={Calendar}
            subModules={[]}
          />
        </TabsContent>

        <TabsContent value="ocorrencias">
          <PlaceholderPage
            title="Ocorrências"
            description="Tratamento e mediação de anomalias no fluxo de entregas."
            icon={AlertTriangle}
            subModules={[]}
          />
        </TabsContent>

        <TabsContent value="pod">
          <PlaceholderPage
            title="Comprovantes de Entrega (POD)"
            description="Upload em massa, cruzamento e auditoria de assinaturas, CTe e baixas."
            icon={FileCheck}
            subModules={[]}
          />
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
