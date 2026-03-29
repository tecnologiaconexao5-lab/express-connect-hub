import { useState } from "react";
import { Route, Map as MapIcon, Zap, MapPin, Truck, RefreshCw, Layers, Plus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import MapboxMap from "@/components/MapboxMap";
import { useTheme } from "@/hooks/useTheme";

interface RoutePoint {
  id: string;
  numero: string;
  latitude: number;
  longitude: number;
  cliente: string;
  tipo: "origem" | "destino";
  tempo?: string;
}

const defaultRoutePoints: RoutePoint[] = [
  { id: "cd", numero: "CD", latitude: -23.4628, longitude: -46.5331, cliente: "DOCA Matriz - Guarulhos", tipo: "origem" },
  { id: "1", numero: "OS-10450-4411", latitude: -23.5505, longitude: -46.6333, cliente: "Indústria ABC Paulista", tipo: "destino", tempo: "~10 min" },
  { id: "2", numero: "OS-202610-8802", latitude: -23.2222, longitude: -45.9999, cliente: "Embraer S.A (Matriz)", tipo: "destino", tempo: "~45 min" },
  { id: "3", numero: "OS-202610-8805", latitude: -22.9068, longitude: -43.1729, cliente: "Mercado Livre (Galpão Z)", tipo: "destino", tempo: "~12 min" },
];

const RoteirizacaoLista = () => {
  const { theme } = useTheme();
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>(defaultRoutePoints);

  const mapLocations = routePoints.map(p => ({
    id: p.id,
    numero: p.numero,
    latitude: p.latitude,
    longitude: p.longitude,
    status: p.tipo === "origem" ? "em_rota" as const : "em_rota" as const,
    cliente: p.cliente,
  }));

  return (
     <div className="space-y-6">
       <div className="flex flex-col md:flex-row gap-6 h-[600px]">
          
          <div className="w-full md:w-2/3 flex flex-col gap-4 h-full relative">
             <div className="flex justify-between items-center bg-card p-3 border rounded shadow-sm z-10">
                <div className="flex items-center gap-2">
                   <h3 className="font-bold flex items-center gap-2"><MapIcon className="w-5 h-5 text-purple-600"/> Mapa de Sequenciamento</h3>
                   <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 ml-2">Mapbox</Badge>
                </div>
                <div className="flex gap-2">
                   <Button variant="outline" size="sm" className="h-8 shadow gap-1"><Plus className="w-3 h-3"/> Adicionar Ponto</Button>
                   <Button variant="outline" size="sm" className="h-8 shadow"><Layers className="w-3 h-3 mr-1"/> Camadas</Button>
                </div>
             </div>
             
             <div className="flex-1 rounded-lg overflow-hidden relative shadow flex items-center justify-center border border-border">
                <MapboxMap 
                  locations={mapLocations}
                  style={theme === "dark" ? "dark" : "light"}
                  showControls={true}
                  title="Roteirização - Sequência de Entregas"
                  height="100%"
                />
             </div>
          </div>

          <div className="w-full md:w-1/3 flex flex-col gap-4 h-full overflow-y-auto pr-2">
             <Card>
                <CardHeader className="p-4 pb-2 border-b bg-slate-50">
                  <CardTitle className="text-base flex justify-between items-center">Roteiro Otimizado <Badge className="bg-green-500 hover:bg-green-600 font-bold px-2 py-0 border-none text-[10px]">Aguardando Viagem</Badge></CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                   <div className="grid grid-cols-2 gap-2 text-center text-sm mb-4">
                      <div className="bg-slate-100 p-2 rounded border"><p className="text-[10px] text-slate-500 uppercase font-bold">KM TOTAL EST.</p><p className="font-black text-slate-800">42.5 km</p></div>
                      <div className="bg-slate-100 p-2 rounded border"><p className="text-[10px] text-slate-500 uppercase font-bold">TEMPO TRÂNS.</p><p className="font-black text-slate-800">2h 15m</p></div>
                   </div>

                   <Button className="w-full bg-slate-800 text-white shadow"><RefreshCw className="w-4 h-4 mr-2"/> Re-Otimizar Destinos</Button>

                   <div className="relative pl-[22px] space-y-4 mt-6">
                      <div className="absolute left-[9px] top-4 bottom-8 w-0.5 bg-slate-200"></div>
                      
                      {/* ORIGEM */}
                      <div className="relative">
                         <div className="absolute left-[-22px] top-1 w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold z-10 border-2 border-white shadow-sm ring-2 ring-slate-100">CD</div>
                         <div className="bg-white border rounded-lg p-3 shadow-sm shadow-slate-200 border-slate-200 relative overflow-hidden">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-800"></div>
                            <h5 className="font-bold text-sm text-slate-800">DOCA Matriz — Saída</h5>
                            <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">Guarulhos, SP - Carga G12</p>
                            <p className="text-[10px] text-slate-500 font-medium bg-slate-50 border border-slate-100 p-1 w-full mt-2 rounded flex items-center gap-1"><Truck className="w-3 h-3"/> Fiat Fiorino / Motorista: Carlos</p>
                         </div>
                      </div>

                      {/* START OS 1 */}
                      <div className="relative">
                         <div className="absolute left-[-22px] top-1 w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold z-10 border-2 border-white shadow-sm ring-2 ring-purple-100">1</div>
                         <div className="bg-white border rounded-lg p-3 shadow-sm hover:border-purple-300 transition cursor-pointer group">
                            <div className="flex justify-between items-start">
                               <h5 className="font-bold text-sm text-slate-800 group-hover:text-purple-700 transition">OS-10450-4411</h5>
                               <span className="text-[11px] font-bold text-purple-600 font-mono">~10 min</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5 mb-1.5"><span className="font-bold text-slate-600">Cliente Destino:</span> Indústria ABC Paulista</p>
                            <span className="text-[10px] bg-red-50 text-red-700 px-1 py-0.5 font-bold uppercase rounded border border-red-200 truncate inline-block w-full">Alerta de Ocorrência Registrada na OS</span>
                         </div>
                      </div>

                      {/* START OS 2 */}
                      <div className="relative">
                         <div className="absolute left-[-22px] top-1 w-5 h-5 rounded-full bg-slate-400 text-white flex items-center justify-center text-[10px] font-bold z-10 border-2 border-white shadow-sm">2</div>
                         <div className="bg-white border rounded-lg p-3 shadow-sm hover:border-slate-300 transition cursor-pointer">
                            <div className="flex justify-between items-start mb-1">
                               <h5 className="font-bold text-sm text-slate-800">OS-202610-8802</h5>
                               <span className="text-[11px] font-bold text-slate-500 font-mono">~45 min</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground"><span className="font-bold text-slate-600">Cliente Destino:</span> Embraer S.A (Matriz)</p>
                         </div>
                      </div>
                      
                      {/* START OS 3 */}
                      <div className="relative">
                         <div className="absolute left-[-22px] top-1 w-5 h-5 rounded-full bg-slate-400 text-white flex items-center justify-center text-[10px] font-bold z-10 border-2 border-white shadow-sm">3</div>
                         <div className="bg-white border rounded-lg p-3 shadow-sm hover:border-slate-300 transition cursor-pointer">
                            <div className="flex justify-between items-start mb-1">
                               <h5 className="font-bold text-sm text-slate-800">OS-202610-8805</h5>
                               <span className="text-[11px] font-bold text-slate-500 font-mono">~12 min</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground"><span className="font-bold text-slate-600">Cliente Destino:</span> Mercado Livre (Galpão Z)</p>
                         </div>
                      </div>

                   </div>
                </CardContent>
             </Card>
          </div>

       </div>
     </div>
   );
};

export default RoteirizacaoLista;
