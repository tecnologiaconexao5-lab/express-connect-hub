import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Award, TrendingUp, TrendingDown, Clock, AlertTriangle, Truck, MapPin, CheckCircle, ShieldAlert, Star, Medal, ChevronUp, ChevronDown, Filter, Calendar } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SLA() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "cliente";
  const handleTabChange = (val: string) => setSearchParams({ tab: val });

  interface PrestadorRanking {
    id: number;
    nome: string;
    tipoVeiculo: string;
    regiao: string;
    osRealizadas: number;
    osEscala: number;
    taxaAceite: number;
    pontualidade: number;
    ocurrencias: number;
    devolucoes: number;
    score: number;
    notaMedia: number;
    status: string;
  }

  const prestadoresRanking: PrestadorRanking[] = [
    { id: 1, nome: "João Transporte", tipoVeiculo: "Fiorino", regiao: "São Paulo - Leste", osRealizadas: 156, osEscala: 160, taxaAceite: 97.5, pontualidade: 98.2, ocurrencias: 2, devolucoes: 1, score: 94, notaMedia: 4.9, status: "Destaque" },
    { id: 2, nome: "Maria Logistics", tipoVeiculo: "HR/Van", regiao: "Campinas", osRealizadas: 89, osEscala: 95, taxaAceite: 93.6, pontualidade: 95.5, ocurrencias: 5, devolucoes: 2, score: 87, notaMedia: 4.5, status: "Ativo" },
    { id: 3, nome: "Transportes ABC", tipoVeiculo: "Carreta LS", regiao: "São Paulo - Oeste", osRealizadas: 45, osEscala: 50, taxaAceite: 90.0, pontualidade: 88.0, ocurrencias: 8, devolucoes: 3, score: 72, notaMedia: 3.8, status: "Atenção" },
    { id: 4, nome: "Carlos Agregados", tipoVeiculo: "3/4 Refrigerado", regiao: "Guarulhos", osRealizadas: 28, osEscala: 35, taxaAceite: 80.0, pontualidade: 82.0, ocurrencias: 5, devolucoes: 2, score: 68, notaMedia: 3.2, status: "Crítico" },
    { id: 5, nome: "LogX Rápida", tipoVeiculo: "VUC", regiao: "ABC Paulista", osRealizadas: 112, osEscala: 120, taxaAceite: 93.3, pontualidade: 92.0, ocurrencias: 3, devolucoes: 1, score: 89, notaMedia: 4.6, status: "Ativo" },
  ];

  const historicoMensal = [
    { mes: "Out/25", os: 142, pontualidade: 94.5, score: 88 },
    { mes: "Nov/25", os: 148, pontualidade: 95.2, score: 89 },
    { mes: "Dez/25", os: 135, pontualidade: 93.8, score: 86 },
    { mes: "Jan/26", os: 150, pontualidade: 96.1, score: 91 },
    { mes: "Fev/26", os: 155, pontualidade: 97.5, score: 93 },
    { mes: "Mar/26", os: 156, pontualidade: 98.2, score: 94 },
  ];

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
           <TabsTrigger value="ranking" className="px-5"><Medal className="w-4 h-4 mr-2"/> Ranking Prestadores</TabsTrigger>
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

        {/* --- RANKING PRESTADORES --- */}
        <TabsContent value="ranking" className="pt-4 space-y-4">
          <div className="flex justify-between items-center gap-4 mb-4">
            <div className="flex gap-2 items-center">
              <Calendar className="w-4 h-4 text-muted-foreground"/>
              <Select defaultValue="30d">
                <SelectTrigger className="w-40"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="90d">Últimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
              <Select defaultValue="todos">
                <SelectTrigger className="w-36"><SelectValue placeholder="Tipo veículo"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="fiorino">Fiorino</SelectItem>
                  <SelectItem value="hr">HR/Van</SelectItem>
                  <SelectItem value="carreta">Carreta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" className="gap-2"><Filter className="w-4 h-4"/> Mais Filtros</Button>
          </div>

          {/* PODIUM TOP 3 */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {prestadoresRanking.slice(0,3).map((p, idx) => (
              <Card key={p.id} className={`relative overflow-hidden ${idx === 0 ? 'border-yellow-400 border-2 bg-yellow-50' : idx === 1 ? 'border-gray-400 border-2 bg-gray-50' : 'border-orange-400 border-2 bg-orange-50'}`}>
                <CardContent className="p-4 text-center">
                  <div className="flex justify-center mb-2">{idx === 0 ? <Medal className="w-10 h-10 text-yellow-500"/> : idx === 1 ? <Medal className="w-10 h-10 text-gray-400"/> : <Medal className="w-10 h-10 text-orange-400"/>}</div>
                  <p className="text-xs text-muted-foreground uppercase font-bold">#{idx+1} {idx === 0 ? 'CAMPEÃO' : idx === 1 ? 'VICE' : '3º LUGAR'}</p>
                  <p className="font-bold text-lg mt-1">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">{p.tipoVeiculo}</p>
                  <div className="mt-3 flex justify-center gap-1">{Array(5).fill(0).map((_,i) => <Star key={i} className={`w-4 h-4 ${i < Math.floor(p.notaMedia) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}/>)}</div>
                  <p className="text-2xl font-black mt-2 text-primary">{p.score}</p>
                  <p className="text-xs text-muted-foreground">pts</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* TOP 5 DESTAQUES */}
          <div className="grid grid-cols-5 gap-3 mb-4">
            <Card className="bg-blue-50 border-blue-200"><CardContent className="p-3 text-center"><p className="text-[10px] uppercase font-bold text-blue-600">Maior Volume</p><p className="font-bold text-sm truncate">João Transporte</p><p className="text-xs text-blue-500">156 OS</p></CardContent></Card>
            <Card className="bg-green-50 border-green-200"><CardContent className="p-3 text-center"><p className="text-[10px] uppercase font-bold text-green-600">Mais Pontual</p><p className="font-bold text-sm truncate">João Transporte</p><p className="text-xs text-green-500">98.2%</p></CardContent></Card>
            <Card className="bg-purple-50 border-purple-200"><CardContent className="p-3 text-center"><p className="text-[10px] uppercase font-bold text-purple-600">Mais Rentável</p><p className="font-bold text-sm truncate">LogX Rápida</p><p className="text-xs text-purple-500">R$/km</p></CardContent></Card>
            <Card className="bg-emerald-50 border-emerald-200"><CardContent className="p-3 text-center"><p className="text-[10px] uppercase font-bold text-emerald-600">Mais Confiável</p><p className="font-bold text-sm truncate">João Transporte</p><p className="text-xs text-emerald-500">1.3% occ</p></CardContent></Card>
            <Card className="bg-orange-50 border-orange-200"><CardContent className="p-3 text-center"><p className="text-[10px] uppercase font-bold text-orange-600">Melhor Avaliado</p><p className="font-bold text-sm truncate">João Transporte</p><p className="text-xs text-orange-500">4.9 ★</p></CardContent></Card>
          </div>

          {/* TABELA RANKING COMPLETO */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Ranking Completo</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead className="w-12">Pos</TableHead><TableHead>Prestador</TableHead><TableHead>Tipo</TableHead><TableHead>Região</TableHead><TableHead className="text-center">OS Realiz.</TableHead><TableHead className="text-center">OS Escala</TableHead><TableHead className="text-center">Taxa Aceite</TableHead><TableHead className="text-center">Pontualidade</TableHead><TableHead className="text-center">Ocorr.</TableHead><TableHead className="text-center">Devol.</TableHead><TableHead className="text-center">Score</TableHead><TableHead className="text-center">Nota</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {prestadoresRanking.map((p, idx) => (
                    <TableRow key={p.id} className={idx < 3 ? 'bg-yellow-50/30' : ''}>
                      <TableCell className="font-bold">{idx+1}</TableCell>
                      <TableCell className="font-medium">{p.nome}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{p.tipoVeiculo}</Badge></TableCell>
                      <TableCell className="text-xs">{p.regiao}</TableCell>
                      <TableCell className="text-center">{p.osRealizadas}</TableCell>
                      <TableCell className="text-center">{p.osEscala}</TableCell>
                      <TableCell className={`text-center font-medium ${p.taxaAceite >= 95 ? 'text-green-600' : p.taxaAceite >= 85 ? 'text-yellow-600' : 'text-red-600'}`}>{p.taxaAceite.toFixed(1)}%</TableCell>
                      <TableCell className={`text-center font-medium ${p.pontualidade >= 95 ? 'text-green-600' : p.pontualidade >= 85 ? 'text-yellow-600' : 'text-red-600'}`}>{p.pontualidade.toFixed(1)}%</TableCell>
                      <TableCell className={`text-center ${p.ocurrencias <= 3 ? 'text-green-600' : p.ocurrencias <= 6 ? 'text-yellow-600' : 'text-red-600'}`}>{p.ocurrencias}</TableCell>
                      <TableCell className="text-center">{p.devolucoes}</TableCell>
                      <TableCell className="text-center font-black text-primary">{p.score}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">{Array(5).fill(0).map((_,i) => <Star key={i} className={`w-3 h-3 ${i < Math.floor(p.notaMedia) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}/>)}</div>
                      </TableCell>
                      <TableCell><Badge className={p.status === 'Destaque' ? 'bg-yellow-100 text-yellow-800' : p.status === 'Ativo' ? 'bg-green-100 text-green-800' : p.status === 'Atenção' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'}>{p.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* HISTÓRICO */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Evolução do Score - João Transporte (Top 1)</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-end justify-between gap-2 h-32 px-4">
                {historicoMensal.map((h, i) => (
                  <div key={i} className="flex flex-col items-center flex-1">
                    <div className="w-full bg-blue-100 rounded-t-sm relative flex items-end justify-center h-24">
                      <div className="w-full bg-blue-500 rounded-t-sm transition-all" style={{ height: `${h.score}%` }}></div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 mt-1">{h.mes}</span>
                    <span className="text-[10px] font-black text-primary">{h.score}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
   </div>
  );
}
