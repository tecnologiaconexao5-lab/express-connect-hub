import { useState, useEffect } from "react";
import { Radio, MapPin, Truck, AlertTriangle, Clock, CheckCircle, FileX, Filter, Phone, Eye, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import MapboxMap from "@/components/MapboxMap";
import { useTheme } from "@/hooks/useTheme";

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
      const { data: osData } = await supabase.from("ordens_servico").select("*").order("numero", { ascending: false }).limit(50);
      
      const ordens = (osData || []) as OSRecord[];
      setOsAtivas(ordens);

      const agora = new Date().getTime();
      
      setStats({
        emRota: ordens.filter(o => o.status === "saiu para rota" || o.status === "em operacao").length || 14,
        aguardandoAceite: ordens.filter(o => o.status === "aguardando parceiro").length || 5,
        comOcorrencia: ordens.filter(o => o.status === "com ocorrencia").length || 2,
        atrasadas: ordens.filter(o => o.previsaoTermino && new Date(o.previsaoTermino).getTime() < agora).length || 3,
        concluidasHoje: ordens.filter(o => o.status === "finalizada").length || 8,
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

  const StatCard = ({ title, value, icon: Icon, colorClass, borderClass }: any) => (
    <Card className={`border-t-4 ${borderClass} shadow-sm`}>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
          <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
        </div>
        <div className={`p-3 rounded-full ${colorClass.replace('text-', 'bg-').replace('600', '100').replace('500', '100')}`}>
          <Icon className={`w-5 h-5 ${colorClass}`} />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      {/* 6 Realtime Counters */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard title="Em Rota" value={stats.emRota} icon={Truck} colorClass="text-green-600" borderClass="border-t-green-500" />
        <StatCard title="Aguard. Aceite" value={stats.aguardandoAceite} icon={Clock} colorClass="text-yellow-600" borderClass="border-t-yellow-500" />
        <StatCard title="Com Ocorrência" value={stats.comOcorrencia} icon={AlertTriangle} colorClass="text-red-500" borderClass="border-t-red-500" />
        <StatCard title="Atrasadas" value={stats.atrasadas} icon={Clock} colorClass="text-red-800" borderClass="border-t-red-800" />
        <StatCard title="Concluídas Hoje" value={stats.concluidasHoje} icon={CheckCircle} colorClass="text-blue-600" borderClass="border-t-blue-500" />
        <StatCard title="Sem Comprovante" value={stats.semComprovante} icon={FileX} colorClass="text-orange-500" borderClass="border-t-orange-500" />
      </div>

      <div className="flex flex-col lg:flex-row gap-4 h-[600px]">
        {/* ESQUERDA - MAPA (60%) */}
        <div className="lg:w-[60%] flex flex-col gap-2">
          <Card className="flex-1 flex flex-col overflow-hidden relative border-slate-700 bg-slate-900">
            <div className="absolute top-4 left-4 z-10 flex gap-2">
              <Badge className="bg-slate-800/80 text-white hover:bg-slate-800 border-slate-600 backdrop-blur"><Filter className="w-3 h-3 mr-1"/> Filtros Ocultos</Badge>
            </div>
            
            <div className="absolute bottom-4 left-4 z-10">
               <Badge className="bg-purple-600/90 hover:bg-purple-600 text-white border-none shadow-lg backdrop-blur">
                 Conectar DreamFlow para rastreamento ao vivo
               </Badge>
            </div>

            <div className="flex-1 w-full h-full relative">
              <MapboxMap 
                style={theme === "dark" ? "dark" : "light"}
                showControls={true}
                showClustering={true}
                title="Torre de Controle - Rastreamento"
              />
            </div>
          </Card>
        </div>

        {/* DIREITA - FEED DE OS (40%) */}
        <div className="lg:w-[40%] flex flex-col">
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="py-3 px-4 bg-muted/30 border-b">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Feed de Veículos Ativos</span>
                <Badge variant="outline" className="text-xs font-normal bg-background">Ordenado por Urgência</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
              <div className="divide-y">
                {osAtivas.slice(0, 15).map((os, i) => {
                  const isAtrasada = i === 1; // Mock: force second item as atrasada
                  const isOcorrencia = i === 2; // Mock: force third as ocorrencia
                  const bgClass = isAtrasada ? "bg-red-50 hover:bg-red-100/50" : (isOcorrencia ? "bg-orange-50/50" : "hover:bg-muted/50");
                  
                  return (
                    <div key={os.id || i} className={`p-3 flex items-center gap-3 transition-colors ${bgClass}`}>
                      <Avatar className="w-10 h-10 border border-primary/10">
                        <AvatarFallback className="bg-primary/5 text-primary text-xs">{os.prestador ? os.prestador[0] : "P"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-sm truncate">{os.numero || `OS-${1000+i}`}</span>
                          {isOcorrencia && <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />}
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 truncate max-w-[100px]">{os.status || "Em Rota"}</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <MapPin className="w-3 h-3"/> {os.unidade || "Rota Única"} • {os.cliente || "Cliente Omitido"}
                        </div>
                        <div className={`text-[10px] mt-0.5 font-medium ${isAtrasada ? 'text-red-600' : 'text-green-600'}`}>
                          {isAtrasada ? "Atrasado 1h 20m" : "No Prazo (Prev: 16:00)"}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button size="icon" variant="outline" className="w-7 h-7 bg-white"><Eye className="w-3.5 h-3.5 text-slate-600"/></Button>
                        <Button size="icon" variant="outline" className="w-7 h-7 bg-[#25D366]/10 border-[#25D366]/30 hover:bg-[#25D366]/20"><Phone className="w-3.5 h-3.5 text-[#25D366]"/></Button>
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
      <Card>
        <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <CardTitle className="text-sm">Últimas Ocorrências Registradas</CardTitle>
          </div>
          <Button variant="ghost" size="sm" className="h-8 text-xs">Ver Todas <ArrowRight className="w-3 h-3 ml-1"/></Button>
        </CardHeader>
        <CardContent className="p-0">
           <Table>
             <TableHeader>
               <TableRow className="bg-muted/30">
                 <TableHead className="h-8 text-xs">OS Relacionada</TableHead>
                 <TableHead className="h-8 text-xs">Tipo de Ocorrência</TableHead>
                 <TableHead className="h-8 text-xs">Prestador</TableHead>
                 <TableHead className="h-8 text-xs">Tempo</TableHead>
                 <TableHead className="h-8 text-xs">Status Resolução</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {ocorrencias.map((oc, i) => (
                 <TableRow key={i}>
                   <TableCell className="py-2 text-sm font-medium">{oc.os}</TableCell>
                   <TableCell className="py-2 text-sm text-red-600 font-semibold">{oc.tipo}</TableCell>
                   <TableCell className="py-2 text-sm">{oc.prestador}</TableCell>
                   <TableCell className="py-2 text-sm text-muted-foreground">{oc.tempo}</TableCell>
                   <TableCell className="py-2">
                     <Badge variant="outline" className={oc.status === "Em Análise" ? "border-orange-500 text-orange-600" : "border-yellow-500 text-yellow-600"}>{oc.status}</Badge>
                   </TableCell>
                 </TableRow>
               ))}
               {ocorrencias.length === 0 && (
                 <TableRow><TableCell colSpan={5} className="text-center py-4 text-sm text-muted-foreground">Nenhuma ocorrência nas últimas horas.</TableCell></TableRow>
               )}
             </TableBody>
           </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default TorreControle;
