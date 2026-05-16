// src/components/operacional/PainelOperacionalMapa.tsx
import { useEffect, useState, useRef } from "react";
import Map, { Marker, NavigationControl, ScaleControl } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface OperacaoLocalizacao {
  id: string;
  escala_id: string | null;
  latitude: number;
  longitude: number;
  velocidade?: number;
  status?: string;
  atualizado_em: string;
  origem?: string;
}

const statusColors: Record<string, string> = {
  em_rota: "bg-indigo-500",
  atrasado: "bg-orange-500",
  critico: "bg-red-600",
  aguardando: "bg-gray-400",
  sem_sinal: "bg-slate-400",
  default: "bg-slate-300",
};

export default function PainelOperacionalMapa() {
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;
  const [locs, setLocs] = useState<OperacaoLocalizacao[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch initial data
  const carregarLocs = async () => {
    try {
      const { data, error } = await supabase
        .from("operacao_localizacao")
        .select("*");
      if (error) throw error;
      setLocs(data as OperacaoLocalizacao[]);
    } catch (e: any) {
      toast.error("Erro ao carregar localizações", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarLocs();
    const sub = supabase
      .channel("realtime_mapa")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "operacao_localizacao" },
        (payload) => {
          // Simplistic handling: re‑fetch all data on any change
          carregarLocs();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, []);

  // KPIs calculations
  const total = locs.length;
  const emRota = locs.filter((l) => l.status === "em_rota").length;
  const atrasadas = locs.filter((l) => l.status === "atrasado").length;
  const criticas = locs.filter((l) => l.status === "critico").length;
  const semSinal = locs.filter((l) => !l.status || l.status === "aguardando").length;

  // Map view defaults – centre on first location if exists, else a generic point
  const initialView = locs[0]
    ? {
        latitude: locs[0].latitude,
        longitude: locs[0].longitude,
        zoom: 12,
      }
    : { latitude: -23.55052, longitude: -46.633308, zoom: 4 };

  if (!token) {
    return (
      <div className="p-6 text-center text-slate-600">
        <Loader2 className="animate-spin mx-auto mb-4" />
        <p>Token Mapbox não configurado. O mapa não pode ser exibido.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* KPIs */}
      <div className="col-span-3 grid grid-cols-5 gap-2">
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-3 flex flex-col items-center">
            <span className="text-2xl font-bold text-slate-700">{total}</span>
            <span className="text-xs text-slate-500 uppercase">Operações</span>
          </CardContent>
        </Card>
        <Card className="bg-indigo-50 border-indigo-200">
          <CardContent className="p-3 flex flex-col items-center">
            <span className="text-2xl font-bold text-indigo-700">{emRota}</span>
            <span className="text-xs text-indigo-600 uppercase">Em Rota</span>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-3 flex flex-col items-center">
            <span className="text-2xl font-bold text-orange-700">{atrasadas}</span>
            <span className="text-xs text-orange-600 uppercase">Atrasadas</span>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-3 flex flex-col items-center">
            <span className="text-2xl font-bold text-red-700">{criticas}</span>
            <span className="text-xs text-red-600 uppercase">Críticas</span>
          </CardContent>
        </Card>
        <Card className="bg-slate-100 border-slate-300">
          <CardContent className="p-3 flex flex-col items-center">
            <span className="text-2xl font-bold text-slate-700">{semSinal}</span>
            <span className="text-xs text-slate-500 uppercase">Sem Sinal</span>
          </CardContent>
        </Card>
      </div>

      {/* Map */}
      <div className="lg:col-span-2 h-96 rounded border">
        <Map
          mapboxAccessToken={token}
          initialViewState={initialView}
          style={{ width: "100%", height: "100%" }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
        >
          <NavigationControl position="top-left" />
          <ScaleControl />
          {locs.map((loc) => (
            <Marker
              key={loc.id}
              longitude={loc.longitude}
              latitude={loc.latitude}
              anchor="bottom"
            >
              <div
                className={`w-3 h-3 rounded-full ${statusColors[loc.status ?? "default"]}`}
                title={`ID: ${loc.id}\nStatus: ${loc.status ?? "-"}\nVelocidade: ${loc.velocidade ?? "-"}`}
              />
            </Marker>
          ))}
        </Map>
      </div>

      {/* Lateral list */}
      <Card className="h-96 overflow-hidden">
        <CardHeader>
          <CardTitle>Operações em Tempo Real</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-500">
              <Loader2 className="animate-spin mr-2" /> Carregando…
            </div>
          ) : locs.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              Nenhuma localização operacional em tempo real ainda.
            </div>
          ) : (
            <ScrollArea className="h-[calc(100%-2rem)]">
              <ul className="divide-y">
                {locs.map((loc) => (
                  <li key={loc.id} className="p-2 flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-800 truncate" title={loc.origem ?? ""}>
                        {loc.origem ?? "Sem origem"}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(loc.atualizado_em).toLocaleTimeString()}
                      </span>
                    </div>
                    <Badge className={statusColors[loc.status ?? "default"]}>
                      {loc.status ?? "aguardando"}
                    </Badge>
                    {loc.velocidade !== undefined && (
                      <span className="text-xs text-slate-600">{loc.velocidade} km/h</span>
                    )}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
