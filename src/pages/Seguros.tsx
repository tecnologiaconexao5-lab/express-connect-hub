import { useSearchParams } from "react-router-dom";
import { Umbrella, Settings, FileBox, Users, Calculator, BellRing, History } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ConfiguracaoGeral from "@/components/seguros/ConfiguracaoGeral";
import ApolicesTransportador from "@/components/seguros/ApolicesTransportador";
import RegrasCliente from "@/components/seguros/RegrasCliente";
import RegrasCalculo from "@/components/seguros/RegrasCalculo";
import AlertasPainel from "@/components/seguros/AlertasPainel";
import HistoricoSinistros from "@/components/seguros/HistoricoSinistros";

export default function Seguros() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "configuracao";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Umbrella className="w-8 h-8 text-primary" /> Seguros e Gerenciamento de Risco
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Módulo integrado para controle de apólices, cálculo de DDR, rastreamento e bloqueio de sinistros operacionais.
        </p>
      </div>

      <Tabs value={currentTab} onValueChange={(val) => setSearchParams({ tab: val })} className="w-full">
        <TabsList className="bg-card w-full flex overflow-x-auto justify-start border-b rounded-none mb-6 pb-0 h-auto">
           <TabsTrigger value="configuracao" className="py-3 px-4 data-[state=active]:border-b-2 data-[state=active]:border-primary"><Settings className="w-4 h-4 mr-2"/> Configuração Geral</TabsTrigger>
           <TabsTrigger value="apolices" className="py-3 px-4 data-[state=active]:border-b-2 data-[state=active]:border-primary"><FileBox className="w-4 h-4 mr-2"/> Apólices do Transportador</TabsTrigger>
           <TabsTrigger value="regras-cliente" className="py-3 px-4 data-[state=active]:border-b-2 data-[state=active]:border-primary"><Users className="w-4 h-4 mr-2"/> Regras por Cliente (DDR)</TabsTrigger>
           <TabsTrigger value="regras-calculo" className="py-3 px-4 data-[state=active]:border-b-2 data-[state=active]:border-primary"><Calculator className="w-4 h-4 mr-2"/> Regras de Cálculo</TabsTrigger>
           <TabsTrigger value="alertas" className="py-3 px-4 data-[state=active]:border-b-2 data-[state=active]:border-primary"><BellRing className="w-4 h-4 mr-2"/> Monitoramento e Alertas</TabsTrigger>
           <TabsTrigger value="sinistros" className="py-3 px-4 data-[state=active]:border-b-2 data-[state=active]:border-primary"><History className="w-4 h-4 mr-2"/> Histórico de Sinistros</TabsTrigger>
        </TabsList>

        <TabsContent value="configuracao"><ConfiguracaoGeral /></TabsContent>
        <TabsContent value="apolices"><ApolicesTransportador /></TabsContent>
        <TabsContent value="regras-cliente"><RegrasCliente /></TabsContent>
        <TabsContent value="regras-calculo"><RegrasCalculo /></TabsContent>
        <TabsContent value="alertas"><AlertasPainel /></TabsContent>
        <TabsContent value="sinistros"><HistoricoSinistros /></TabsContent>
      </Tabs>
    </div>
  );
}
