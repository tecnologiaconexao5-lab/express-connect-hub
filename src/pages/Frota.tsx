import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Car, Wrench, Fuel, FileText, Shield, PieChart, Info, AlertTriangle, CheckCircle, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Frota() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "manutencao";
  const handleTabChange = (val: string) => setSearchParams({ tab: val });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Car className="w-8 h-8 text-primary" /> Gestão de Frota e Veículos
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">Controle, custos e abastecimento.<Badge variant="secondary" className="bg-amber-100 text-amber-800 ml-2">Módulo em Desenvolvimento</Badge></p>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-card justify-start overflow-x-auto border-b rounded-none w-full">
           <TabsTrigger value="manutencao" className="px-5"><Wrench className="w-4 h-4 mr-2"/> Manutenção</TabsTrigger>
           <TabsTrigger value="abastecimento" className="px-5"><Fuel className="w-4 h-4 mr-2"/> Abastecimento</TabsTrigger>
           <TabsTrigger value="documentos" className="px-5"><FileText className="w-4 h-4 mr-2"/> Documentos</TabsTrigger>
           <TabsTrigger value="seguros" className="px-5"><Shield className="w-4 h-4 mr-2"/> Seguros</TabsTrigger>
           <TabsTrigger value="custos" className="px-5"><PieChart className="w-4 h-4 mr-2"/> Custos por Veículo</TabsTrigger>
        </TabsList>

        <div className="mt-4 p-4 bg-blue-50/50 border border-blue-100 rounded-lg text-sm text-blue-800 flex items-center gap-3">
           <Info className="w-5 h-5 text-blue-600 shrink-0"/>
           Esse módulo está em transição analítica. No futuro, todos os lançamentos gerarão contabilidade e integrarão com o <b>Portal do Prestador</b> para avisos de manutenções correntes.
        </div>

        {/* --- MANUTENCAO --- */}
        <TabsContent value="manutencao" className="pt-2">
           <Card>
              <CardHeader className="flex flex-row justify-between items-center py-4">
                <div><CardTitle>Histórico de Manutenções</CardTitle><CardDescription>Registros preventivos e corretivos com estimativa da próxima parada.</CardDescription></div>
                <Button className="bg-blue-600"><Plus className="w-4 h-4 mr-1"/> Nova OS Oficina</Button>
              </CardHeader>
              <CardContent className="p-0">
                 <Table>
                   <TableHeader><TableRow><TableHead>Veículo / Placa</TableHead><TableHead>Tipo</TableHead><TableHead>Data</TableHead><TableHead>Custo Oficial</TableHead><TableHead>Próxima Revisão</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                   <TableBody>
                     <TableRow>
                       <TableCell className="font-bold">ABC-1234 (Fiorino)</TableCell>
                       <TableCell><Badge variant="outline" className="border-green-200 text-green-700">Preventiva</Badge></TableCell>
                       <TableCell>15/03/2026</TableCell>
                       <TableCell className="font-medium text-red-600">{fmtFin(850.00)}</TableCell>
                       <TableCell>50.000 Km</TableCell>
                       <TableCell><span className="text-sm font-bold text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Concluído</span></TableCell>
                     </TableRow>
                     <TableRow>
                       <TableCell className="font-bold">XYZ-9876 (HR)</TableCell>
                       <TableCell><Badge variant="outline" className="border-red-200 text-red-700">Corretiva</Badge></TableCell>
                       <TableCell>26/03/2026</TableCell>
                       <TableCell className="font-medium text-red-600">{fmtFin(2100.00)}</TableCell>
                       <TableCell>12/2026</TableCell>
                       <TableCell><span className="text-sm font-bold text-orange-600 flex items-center gap-1"><Wrench className="w-3 h-3"/> Na Oficina</span></TableCell>
                     </TableRow>
                   </TableBody>
                 </Table>
              </CardContent>
           </Card>
        </TabsContent>

        {/* --- ABASTECIMENTO --- */}
        <TabsContent value="abastecimento" className="pt-2">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
             <Card className="border-l-4 border-l-orange-500"><CardContent className="p-4"><p className="text-sm font-bold text-slate-500 uppercase">Gasto em Abastecimento (Mês)</p><p className="text-2xl font-bold mt-1 text-orange-600">{fmtFin(4580.00)}</p></CardContent></Card>
             <Card className="border-l-4 border-l-blue-500"><CardContent className="p-4"><p className="text-sm font-bold text-slate-500 uppercase">Litros Consumidos (Mês)</p><p className="text-2xl font-bold mt-1 text-blue-600">845 L</p></CardContent></Card>
             <Card className="border-l-4 border-l-green-500"><CardContent className="p-4"><p className="text-sm font-bold text-slate-500 uppercase">Média Geral da Frota</p><p className="text-2xl font-bold mt-1 text-green-600">8.2 Km/L</p></CardContent></Card>
           </div>
           <Card>
              <CardHeader className="flex flex-row justify-between items-center py-4">
                <div><CardTitle>Diário de Abastecimento</CardTitle></div>
                <Button variant="outline"><Plus className="w-4 h-4 mr-1"/> Lançar Cupom Fiscal</Button>
              </CardHeader>
              <CardContent className="p-0">
                 <Table>
                   <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Veículo / Placa</TableHead><TableHead>Posto</TableHead><TableHead>Km Momento</TableHead><TableHead>Litros / Combust.</TableHead><TableHead className="text-right">Valor Total</TableHead></TableRow></TableHeader>
                   <TableBody>
                     <TableRow>
                       <TableCell>27/03/2026</TableCell><TableCell className="font-bold">ABC-1234</TableCell><TableCell>Posto Ipiranga Rota 2</TableCell>
                       <TableCell>42.100</TableCell><TableCell>55 L (Diesel S10)</TableCell><TableCell className="text-right font-medium text-red-600">{fmtFin(350.00)}</TableCell>
                     </TableRow>
                     <TableRow>
                       <TableCell>26/03/2026</TableCell><TableCell className="font-bold">XYZ-9876</TableCell><TableCell>Posto Ale Centro</TableCell>
                       <TableCell>185.320</TableCell><TableCell>42 L (Etanol)</TableCell><TableCell className="text-right font-medium text-red-600">{fmtFin(145.00)}</TableCell>
                     </TableRow>
                   </TableBody>
                 </Table>
              </CardContent>
           </Card>
        </TabsContent>

        {/* --- DOCUMENTOS --- */}
        <TabsContent value="documentos" className="pt-2">
           <Card>
              <CardHeader className="py-4">
                <CardTitle>Vencimentos Centralizados e CRLV</CardTitle>
                <CardDescription>Gerencie documentos críticos de cada caminhão ou Fiorino. O sistema te avisa 30 dias antes.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                 <Table>
                   <TableHeader><TableRow><TableHead>Veículo</TableHead><TableHead>Documento</TableHead><TableHead>Órgão</TableHead><TableHead>Vencimento</TableHead><TableHead>Alerta Padrão</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                   <TableBody>
                     <TableRow>
                       <TableCell className="font-bold">ABC-1234</TableCell>
                       <TableCell>CRLV Exercicio 2026</TableCell><TableCell>Detran-SP</TableCell>
                       <TableCell>31/10/2026</TableCell><TableCell>30/09/2026</TableCell>
                       <TableCell><Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Em dia</Badge></TableCell>
                     </TableRow>
                     <TableRow className="bg-orange-50/50">
                       <TableCell className="font-bold">UUV-8833</TableCell>
                       <TableCell>ANTT Proprietário</TableCell><TableCell>ANTT</TableCell>
                       <TableCell className="text-orange-700 font-bold">15/04/2026</TableCell><TableCell>15/03/2026</TableCell>
                       <TableCell><Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300 gap-1"><AlertTriangle className="w-3 h-3"/> Vence em 18d</Badge></TableCell>
                     </TableRow>
                   </TableBody>
                 </Table>
              </CardContent>
           </Card>
        </TabsContent>

        {/* --- SEGUROS --- */}
        <TabsContent value="seguros" className="pt-2">
           <Card>
              <CardHeader className="py-4 justify-between flex flex-row">
                <CardTitle>Apólices e RCTR-C</CardTitle>
                <Button className="bg-blue-600"><Plus className="w-4 h-4 mr-1"/> Adicionar Apólice</Button>
              </CardHeader>
              <CardContent className="p-0">
                 <Table>
                   <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Seguradora</TableHead><TableHead>Apólice</TableHead><TableHead>Vigência</TableHead><TableHead>Cobertura Franquia</TableHead><TableHead>Veículos Protegidos</TableHead></TableRow></TableHeader>
                   <TableBody>
                     <TableRow>
                       <TableCell className="font-bold">Casco (Total)</TableCell>
                       <TableCell>Porto Seguro</TableCell>
                       <TableCell>001.2025.AXX.332</TableCell>
                       <TableCell>10/01/2027</TableCell>
                       <TableCell>100% FIPE (R$ 4.500 Franquia)</TableCell>
                       <TableCell>08 Veículos (Frotista)</TableCell>
                     </TableRow>
                     <TableRow>
                       <TableCell className="font-bold">RCTR-C / RCF-DC</TableCell>
                       <TableCell>Sura Seguros</TableCell>
                       <TableCell>202.2025.RCTR.440</TableCell>
                       <TableCell>30/12/2026</TableCell>
                       <TableCell>R$ 1.500.000 (Sem Franquia em Acidente)</TableCell>
                       <TableCell>Todos da Obra</TableCell>
                     </TableRow>
                   </TableBody>
                 </Table>
              </CardContent>
           </Card>
        </TabsContent>

        {/* --- CUSTOS --- */}
        <TabsContent value="custos" className="pt-2">
           <Card className="max-w-4xl mx-auto">
              <CardHeader className="text-center py-8">
                 <PieChart className="w-16 h-16 mx-auto mb-4 text-purple-600" />
                 <CardTitle className="text-2xl">Módulo de Rentabilidade por Veículo (DRE Frota)</CardTitle>
                 <CardDescription className="text-base max-w-xl mx-auto">Custos aglutinados sobre (Manutenção + Abastecimento + Seguros + Pneus + Depreciação). Isso deduzirá automaticamente as margens da Torre no futuro.</CardDescription>
              </CardHeader>
              <CardContent>
                 <Table>
                   <TableHeader className="bg-slate-50"><TableRow><TableHead>Placa</TableHead><TableHead className="text-right">Combustível</TableHead><TableHead className="text-right">Manutenções</TableHead><TableHead className="text-right">Fixos (Seguro/IPVA)</TableHead><TableHead className="text-right bg-red-50 font-bold">CUSTO TOTAL (Mês)</TableHead></TableRow></TableHeader>
                   <TableBody>
                     <TableRow><TableCell className="font-bold text-lg text-slate-700">ABC-1234</TableCell><TableCell className="text-right">{fmtFin(1450.00)}</TableCell><TableCell className="text-right">{fmtFin(850.00)}</TableCell><TableCell className="text-right">{fmtFin(200.00)}</TableCell><TableCell className="text-right bg-red-50 text-red-600 font-black">{fmtFin(2500.00)}</TableCell></TableRow>
                     <TableRow><TableCell className="font-bold text-lg text-slate-700">XYZ-9876</TableCell><TableCell className="text-right">{fmtFin(2100.00)}</TableCell><TableCell className="text-right">{fmtFin(0)}</TableCell><TableCell className="text-right">{fmtFin(200.00)}</TableCell><TableCell className="text-right bg-red-50 text-red-600 font-black">{fmtFin(2300.00)}</TableCell></TableRow>
                     <TableRow><TableCell className="font-bold text-lg text-slate-700">GHI-4433</TableCell><TableCell className="text-right">{fmtFin(900.00)}</TableCell><TableCell className="text-right">{fmtFin(400.00)}</TableCell><TableCell className="text-right">{fmtFin(150.00)}</TableCell><TableCell className="text-right bg-red-50 text-red-600 font-black">{fmtFin(1450.00)}</TableCell></TableRow>
                   </TableBody>
                 </Table>
              </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
