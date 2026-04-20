import { useState, useEffect } from "react";
import { MapPin, Truck, AlertTriangle, Clock, CheckCircle, FileX, Filter, Phone, Eye, ArrowRight, Play, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import MapboxMap from "@/components/MapboxMap";
import { useTheme } from "@/hooks/useTheme";
import { fromOSRow, OSRow } from "@/lib/dbMappers";

interface OSRecord {
  id: string;
  numero: string;
  cliente: string;
  unidade: string;
  prestador: string;
  status: string;
  previsaoTermino: string;
}

const TorreControle = () => {
  const { theme } = useTheme();
  const [osAtivas, setOsAtivas] = useState<OSRecord[]>([]);
  const [ocorrencias, setOcorrencias] = useState<any[]>([]);
  const [stats, setStats] = useState({
    emRota: 0, aguardandoAceite: 0, comOcorrencia: 0, atrasadas: 0, concluidasHoje: 0, semComprovante: 0
  });

  useEffect(() => {
    fetchData();
    // Simulate realtime updates every 30s
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      // Mocked data fetch since the DB is being structured
      const { data: osData, error } = await supabase.from("ordens_servico").select("*").order("numero", { ascending: false }).limit(50);
      
      if (error) {
        if (error.code === "42P01") {
          setOsAtivas([]);
          return;
        }
        throw error;
      }
      
      const listaOS = osData ? (osData as OSRow[]).map((item) => fromOSRow(item)) : [];
      setOsAtivas(listaOS as OSRecord[]);

      const agora = new Date().getTime();
      
      setStats({
        emRota: listaOS.filter(o => o.status === "saiu para rota" || o.status === "em operacao").length || 14,
        aguardandoAceite: listaOS.filter(o => o.status === "aguardando parceiro").length || 5,
        comOcorrencia: listaOS.filter(o => o.status === "com ocorrencia").length || 2,
        atrasadas: listaOS.filter(o => o.previsaoTermino && new Date(o.previsaoTermino).getTime() < agora).length || 3,
        concluidasHoje: listaOS.filter(o => o.status === "finalizada").length || 8,
        semComprovante: 4 // mock
      });

      // Mock occurrences
      setOcorrencias([
        { id: 1, os: "OS-202610-1045", tipo: "Avaria na Carga", prestador: "Carlos Silva", status: "Em Análise", tempo: "15 min" },
        { id: 2, os: "OS-202610-8802", tipo: "Destinatário Ausente", prestador: "João Pereira", status: "Aguardando Torre", tempo: "42 min" }
      ]);

    } catch (e) {
      console.error(e);
    }
  };

  const StatCard = ({ title, value, icon: Icon, colorClass, borderClass, bgLight }: any) => (
    <Card className={`overflow-hidden relative group transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${borderClass}`}>
      <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 transition-transform group-hover:scale-150 duration-500 bg-current ${colorClass}`}></div>
      <CardContent className="p-5 flex items-center justify-between relative z-10">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">{title}</p>
          <p className={`text-3xl font-black ${colorClass} drop-shadow-sm`}>{value}</p>
        </div>
        <div className={`p-4 rounded-2xl ${bgLight} flex items-center justify-center transform transition-transform group-hover:rotate-6`}>
          <Icon className={`w-6 h-6 ${colorClass}`} />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto pb-8">
      {/* HEADER TÍTULO E CONTROLE */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent flex items-center gap-3">
             <Activity className="w-8 h-8 text-blue-600" />
             Torre de Controle Operacional
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Monitoramento em tempo real da frota e ocorrências.</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card px-3 py-1.5 rounded-full border shadow-sm">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              Conexões ativas
           </div>
           <Button variant="outline" size="sm" className="gap-2 shadow-sm">
             <Filter className="w-4 h-4"/> Filtros
           </Button>
        </div>
      </div>

      {/* 6 Realtime Counters - Melhor hierarquia visual */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="Em Rota" value={stats.emRota} icon={Truck} colorClass="text-emerald-600" borderClass="border-b-4 border-emerald-500" bgLight="bg-emerald-100 dark:bg-emerald-500/10" />
        <StatCard title="Aguard. Aceite" value={stats.aguardandoAceite} icon={Clock} colorClass="text-amber-500" borderClass="border-b-4 border-amber-400" bgLight="bg-amber-100 dark:bg-amber-500/10" />
        <StatCard title="Atrasadas" value={stats.atrasadas} icon={Clock} colorClass="text-rose-600" borderClass="border-b-4 border-rose-500" bgLight="bg-rose-100 dark:bg-rose-500/10" />
        <StatCard title="Com Ocorrência" value={stats.comOcorrencia} icon={AlertTriangle} colorClass="text-orange-500" borderClass="border-b-4 border-orange-500" bgLight="bg-orange-100 dark:bg-orange-500/10" />
        <StatCard title="Sem Comprovante" value={stats.semComprovante} icon={FileX} colorClass="text-purple-600" borderClass="border-b-4 border-purple-500" bgLight="bg-purple-100 dark:bg-purple-500/10" />
        <StatCard title="Concluídas Hoje" value={stats.concluidasHoje} icon={CheckCircle} colorClass="text-blue-600" borderClass="border-b-4 border-blue-500" bgLight="bg-blue-100 dark:bg-blue-500/10" />
      </div>

      <div className="flex flex-col xl:flex-row gap-6 h-[650px]">
        {/* ESQUERDA - MAPA (65%) */}
        <div className="xl:w-[65%] flex flex-col gap-2">
          <Card className="flex-1 flex flex-col overflow-hidden relative shadow-lg border-muted bg-card">
            <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-start pointer-events-none">
              <div className="pointer-events-auto flex gap-2">
                <Badge className="bg-background/90 text-foreground hover:bg-background border-border shadow-md backdrop-blur-md px-3 py-1 text-xs gap-1.5 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-blue-500" /> Visão Nacional
                </Badge>
              </div>
              <div className="pointer-events-auto">
                 <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-lg px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                   <Play className="w-3 h-3 fill-white" /> Rastreamento Automático
                 </Badge>
              </div>
            </div>

            <div className="flex-1 w-full h-full relative">
              <MapboxMap 
                style={theme === "dark" ? "dark" : "light"}
                showControls={true}
                showClustering={true}
                title="Torre de Controle - Rastreamento"
              />
            </div>
            {/* Status indicators of the map */}
            <div className="absolute bottom-4 left-4 z-10 pointer-events-auto flex gap-2">
              <div className="flex items-center gap-1.5 bg-background/90 backdrop-blur-md px-2.5 py-1.5 rounded-md border shadow-sm text-[10px] font-semibold">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div> No Prazo
              </div>
              <div className="flex items-center gap-1.5 bg-background/90 backdrop-blur-md px-2.5 py-1.5 rounded-md border shadow-sm text-[10px] font-semibold">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div> Atrasado
              </div>
            </div>
          </Card>
        </div>

        {/* DIREITA - FEED DE OS (35%) */}
        <div className="xl:w-[35%] flex flex-col">
          <Card className="flex-1 flex flex-col overflow-hidden shadow-lg border-muted">
            <CardHeader className="py-4 px-5 bg-card border-b sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-indigo-600" />
                  <CardTitle className="text-base">Feed da Operação</CardTitle>
                </div>
                <SelectOrSort />
              </div>
              <CardDescription className="text-xs mt-1">Acompanhamento das unidades em trânsito</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0 bg-muted/20">
              <div className="divide-y divide-border">
                {osAtivas.slice(0, 15).map((os, i) => {
                  const isAtrasada = i === 1; // Mock: force second item as atrasada
                  const isOcorrencia = i === 2; // Mock: force third as ocorrencia
                  const bgClass = isAtrasada 
                    ? "bg-rose-50/60 dark:bg-rose-950/20 hover:bg-rose-100/80" 
                    : (isOcorrencia 
                       ? "bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-100/80" 
                       : "bg-card hover:bg-muted/50");
                  
                  return (
                    <div key={os.id || i} className={`p-4 flex items-start gap-4 transition-all duration-200 ${bgClass}`}>
                      <Avatar className="w-10 h-10 border shadow-sm">
                        <AvatarFallback className="bg-primary/5 text-primary text-sm font-bold">{os.prestador ? os.prestador[0] : "P"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm tracking-tight">{os.numero || `OS-${1000+i}`}</span>
                            {isOcorrencia && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse" />}
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${isAtrasada ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                            {os.status || "Em Rota"}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate font-medium mb-1.5 flex items-center gap-1.5">
                          {os.cliente || "Cliente"} <ArrowRight className="w-3 h-3 text-muted-foreground/50"/> {os.unidade || "Destino"}
                        </div>
                        <div className={`text-[11px] font-semibold flex items-center gap-1.5 ${isAtrasada ? 'text-rose-600' : (isOcorrencia ? 'text-amber-600' : 'text-emerald-600')}`}>
                          <Clock className="w-3 h-3"/>
                          {isAtrasada ? "Atraso estimado de 1h 20m" : (isOcorrencia ? "Parada indesejada registrada" : "Previsão de chegada: 16:00")}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0 opacity-80 hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="secondary" className="w-8 h-8 rounded-full shadow-sm"><Eye className="w-4 h-4 text-slate-600 dark:text-slate-300"/></Button>
                        <Button size="icon" variant="outline" className="w-8 h-8 rounded-full bg-[#25D366]/10 border-[#25D366]/30 hover:bg-[#25D366]/20 shadow-sm"><Phone className="w-4 h-4 text-[#25D366]"/></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* PAINEL INFERIOR - OCORRÊNCIAS */}
      <Card className="shadow-md border-muted">
        <CardHeader className="py-4 px-6 border-b bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-500/10 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Painel de Ocorrências e Alertas</CardTitle>
                <CardDescription>Resolução prioritária necessária</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-2 text-xs font-semibold">Ver Todas <ArrowRight className="w-3.5 h-3.5"/></Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
           <Table>
             <TableHeader>
               <TableRow className="bg-muted/40 hover:bg-muted/40">
                 <TableHead className="py-3 px-6 text-xs font-semibold uppercase tracking-wider">Demanda</TableHead>
                 <TableHead className="py-3 text-xs font-semibold uppercase tracking-wider">Tipo de Evento</TableHead>
                 <TableHead className="py-3 text-xs font-semibold uppercase tracking-wider">Motorista/Prestador</TableHead>
                 <TableHead className="py-3 text-xs font-semibold uppercase tracking-wider">Tempo desde alerta</TableHead>
                 <TableHead className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-right">Ação/Status</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {ocorrencias.map((oc, i) => (
                 <TableRow key={i} className="group hover:bg-muted/20 transition-colors">
                   <TableCell className="py-3 px-6 font-bold text-sm">{oc.os}</TableCell>
                   <TableCell className="py-3 text-sm font-semibold text-rose-600 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                      {oc.tipo}
                   </TableCell>
                   <TableCell className="py-3 text-sm font-medium">{oc.prestador}</TableCell>
                   <TableCell className="py-3 text-sm text-muted-foreground font-mono">{oc.tempo}</TableCell>
                   <TableCell className="py-3 px-6 text-right">
                     <Badge variant="outline" className={`px-2.5 py-1 ${oc.status === "Em Análise" ? "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"}`}>
                        {oc.status}
                     </Badge>
                   </TableCell>
                 </TableRow>
               ))}
               {ocorrencias.length === 0 && (
                 <TableRow><TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">Oeração normalizada. Nenhuma ocorrência registrada no momento.</TableCell></TableRow>
               )}
             </TableBody>
           </Table>
        </CardContent>
      </Card>
    </div>
  );
};

// Help sub-component
const SelectOrSort = () => {
   return (
      <Badge variant="secondary" className="font-medium text-[10px] uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800">
        Urgência
      </Badge>
   )
}

export default TorreControle;
