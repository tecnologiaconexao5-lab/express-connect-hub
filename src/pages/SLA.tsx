import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Award, TrendingUp, TrendingDown, Clock, AlertTriangle, Truck, MapPin, CheckCircle, ShieldAlert } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";

export default function SLA() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "cliente";
  const handleTabChange = (val: string) => setSearchParams({ tab: val });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Award className="w-8 h-8 text-primary" /> SLA, Performance e Qualidade
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">Monitoramento de Service Level Agreement e KPIs Ouro.</p>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-card justify-start overflow-x-auto border-b rounded-none w-full">
           <TabsTrigger value="cliente" className="px-5"><ShieldAlert className="w-4 h-4 mr-2"/> Indicadores e Dashboard</TabsTrigger>
           <TabsTrigger value="nps" className="px-5"><Award className="w-4 h-4 mr-2"/> SLA por Cliente</TabsTrigger>
           <TabsTrigger value="entrega" className="px-5"><MapPin className="w-4 h-4 mr-2"/> SLA por Operação</TabsTrigger>
           <TabsTrigger value="performance" className="px-5"><Truck className="w-4 h-4 mr-2"/> Perf. Prestador</TabsTrigger>
        </TabsList>

        {/* --- DASHBOARD SLA --- */}
        <TabsContent value="cliente" className="pt-4 space-y-4">
           {/* Cards Topo */}
           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
             {[
               { t: "Taxa no Prazo", v: "94.2%", c: "text-green-600" },
               { t: "1ª Tentativa", v: "88.5%", c: "text-blue-600" },
               { t: "Devoluções", v: "1.2%", c: "text-red-500" },
               { t: "Reentregas", v: "3.4%", c: "text-orange-500" },
               { t: "Avarias", v: "0.8%", c: "text-red-600" },
               { t: "NPS Cliente", v: "8.9", c: "text-emerald-600" },
               { t: "NPS Prestador", v: "9.1", c: "text-emerald-600" }
             ].map(k => (
                <Card key={k.t} className="shadow-sm">
                  <CardContent className="p-4 text-center">
                     <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{k.t}</p>
                     <p className={`text-xl font-black mt-1 ${k.c}`}>{k.v}</p>
                  </CardContent>
                </Card>
             ))}
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Evolução de Entregas no Prazo (Últimas 8 Semanas)</CardTitle>
                </CardHeader>
                <CardContent className="h-64 flex items-end justify-between px-8 pb-4 gap-2">
                   {[89, 90, 88, 92, 94, 91, 95, 94].map((v, i) => (
                      <div key={i} className="flex flex-col items-center gap-2 flex-1">
                         <div className="w-full bg-blue-100 rounded-t-sm relative flex items-end justify-center" style={{ height: '200px' }}>
                            <div className="w-full bg-blue-500 rounded-t-sm transition-all" style={{ height: `${v}%` }}></div>
                         </div>
                         <span className="text-xs font-bold text-slate-500">S {i+1}</span>
                      </div>
                   ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-red-600 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> Alertas SLA (Abaixo Pactuado)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                   <div className="divide-y">
                      {[
                        { cliente: "Indústria ABC", pactuado: "95%", real: "89%", ic: TrendingDown },
                        { cliente: "Tech Solutions", pactuado: "98%", real: "94%", ic: TrendingDown },
                      ].map((c, i) => (
                         <div key={i} className="p-4 flex items-center justify-between hover:bg-red-50/50">
                            <div>
                              <p className="font-bold text-sm text-slate-800">{c.cliente}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">Meta: {c.pactuado} • Real: <span className="text-red-600 font-bold">{c.real}</span></p>
                            </div>
                            <c.ic className="w-5 h-5 text-red-500" />
                         </div>
                      ))}
                   </div>
                </CardContent>
              </Card>
           </div>
        </TabsContent>

        {/* --- SLA POR CLIENTE --- */}
        <TabsContent value="nps" className="pt-4 space-y-4">
           <Card>
             <CardHeader>
               <CardTitle>SLA Estabelecidos (Top Clients)</CardTitle>
               <CardDescription>Carga horária prometida contratualmente versus tempo real de trânsito computado.</CardDescription>
             </CardHeader>
             <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Cliente Corporativo</TableHead><TableHead className="text-center">SLA Pactuado (Horas)</TableHead><TableHead className="text-center">Realizado (Média)</TableHead><TableHead className="text-center">Atingimento %</TableHead><TableHead className="text-center">Tendência</TableHead></TableRow></TableHeader>
                  <TableBody>
                     <TableRow>
                       <TableCell className="font-bold">Indústria Global Ltda</TableCell>
                       <TableCell className="text-center font-medium">48h</TableCell>
                       <TableCell className="text-center text-green-600 font-bold">42h</TableCell>
                       <TableCell className="text-center"><Badge variant="outline" className="bg-green-50 text-green-700">98%</Badge></TableCell>
                       <TableCell className="text-center"><TrendingUp className="w-4 h-4 text-green-500 inline"/></TableCell>
                     </TableRow>
                     <TableRow>
                       <TableCell className="font-bold">Tech Solutions E-commerce</TableCell>
                       <TableCell className="text-center font-medium">24h</TableCell>
                       <TableCell className="text-center text-red-600 font-bold">28h</TableCell>
                       <TableCell className="text-center"><Badge variant="outline" className="bg-red-50 text-red-700">89%</Badge></TableCell>
                       <TableCell className="text-center"><TrendingDown className="w-4 h-4 text-red-500 inline"/></TableCell>
                     </TableRow>
                  </TableBody>
                </Table>
             </CardContent>
           </Card>
        </TabsContent>

        {/* --- SLA POR OPERAÇÃO --- */}
        <TabsContent value="entrega" className="pt-4 space-y-4">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <Card><CardContent className="p-4"><p className="text-sm font-bold text-slate-500">Operação Dedicada</p><p className="text-2xl font-black mt-1 text-blue-600">99.1%</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-sm font-bold text-slate-500">Fracionado (LTL)</p><p className="text-2xl font-black mt-1 text-slate-700">88.4%</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-sm font-bold text-slate-500">Lotação (FTL)</p><p className="text-2xl font-black mt-1 text-emerald-600">96.0%</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-sm font-bold text-slate-500">Refrigerada / Fria</p><p className="text-2xl font-black mt-1 text-blue-400">98.5%</p></CardContent></Card>
           </div>

           <Card>
              <CardHeader><CardTitle>Tempo Médio por Etapa Logística (Horas)</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                 <div>
                   <div className="flex justify-between mb-1 text-sm font-bold"><span className="text-slate-600">Espera Coleta (Lead Time Inicial)</span><span>3h</span></div>
                   <Progress value={20} className="h-2" />
                 </div>
                 <div>
                   <div className="flex justify-between mb-1 text-sm font-bold"><span className="text-orange-600">Trânsito em Rota (Rodoviário)</span><span>36h</span></div>
                   <Progress value={85} className="h-2 bg-orange-100" />
                 </div>
                 <div>
                   <div className="flex justify-between mb-1 text-sm font-bold"><span className="text-green-600">Processo de Descarga / Baixa</span><span>1.5h</span></div>
                   <Progress value={10} className="h-2 bg-green-100" />
                 </div>
              </CardContent>
           </Card>
        </TabsContent>

        {/* --- PERFORMANCE PRESTADOR --- */}
        <TabsContent value="performance" className="pt-4 space-y-4">
           <Card>
             <CardHeader>
               <CardTitle>Ranking de Reputação de Parceiros</CardTitle>
               <CardDescription>Critérios baseados em Ocorrências, Avarias, e Entregas no Prazo para ranquear os contratados.</CardDescription>
             </CardHeader>
             <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Prestador</TableHead><TableHead className="text-center">Operações</TableHead><TableHead className="text-center">No Prazo %</TableHead><TableHead className="text-center">Ocorrências</TableHead><TableHead className="text-center">Score (0-5)</TableHead><TableHead className="text-center">Nível</TableHead></TableRow></TableHeader>
                  <TableBody>
                     <TableRow>
                       <TableCell className="font-bold text-sm">João Transportes ME</TableCell>
                       <TableCell className="text-center font-medium">142</TableCell><TableCell className="text-center font-bold text-green-600">98.5%</TableCell>
                       <TableCell className="text-center"><Badge variant="outline" className="border-green-200">1 leve</Badge></TableCell>
                       <TableCell className="text-center font-black text-orange-500">4.9</TableCell>
                       <TableCell className="text-center"><Badge variant="secondary" className="bg-green-500 text-white border-none">Destaque</Badge></TableCell>
                     </TableRow>
                     <TableRow className="bg-red-50/30">
                       <TableCell className="font-bold text-sm">Carlos Agregado</TableCell>
                       <TableCell className="text-center font-medium">28</TableCell><TableCell className="text-center font-bold text-red-600">82.0%</TableCell>
                       <TableCell className="text-center"><Badge variant="outline" className="border-red-200 text-red-600">5 (2 avarias)</Badge></TableCell>
                       <TableCell className="text-center font-black text-slate-500">2.1</TableCell>
                       <TableCell className="text-center"><Badge variant="secondary" className="bg-red-500 text-white border-none">Crítico</Badge></TableCell>
                     </TableRow>
                     <TableRow>
                       <TableCell className="font-bold text-sm">LogX Rápida</TableCell>
                       <TableCell className="text-center font-medium">89</TableCell><TableCell className="text-center font-bold text-slate-600">92.0%</TableCell>
                       <TableCell className="text-center"><Badge variant="outline" className="border-orange-200 text-orange-600">3 (atrasos)</Badge></TableCell>
                       <TableCell className="text-center font-black text-orange-500">3.8</TableCell>
                       <TableCell className="text-center"><Badge variant="secondary" className="bg-yellow-500 text-white border-none">Atenção</Badge></TableCell>
                     </TableRow>
                  </TableBody>
                </Table>
             </CardContent>
           </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
