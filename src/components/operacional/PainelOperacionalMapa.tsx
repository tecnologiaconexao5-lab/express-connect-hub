import { useEffect, useState } from "react";
import Map, { Marker, NavigationControl, ScaleControl } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MAPBOX_ACCESS_TOKEN } from "@/lib/mapboxToken";

interface TrackingPosEnriquecida {
  id: string;
  latitude: number;
  longitude: number;
  velocidade?: number;
  status: string;
  updated_at: string;
  created_at: string;
  captured_at?: string;
  origem?: string;
  alocacao_id?: string;
  prestador_id?: string;
  os_id?: string;
  cliente_id?: string;
  precisao?: number;
  alocacao?: {
    id: string;
    status: string;
    origem: string;
    destino: string;
    placa: string;
    tipo_veiculo: string;
    prestador_nome: string;
    prestador_telefone: string;
    os_numero: string;
    os_cliente: string;
  };
}

const statusColors: Record<string, string> = {
  em_rota: "bg-indigo-500",
  atrasado: "bg-orange-500",
  critico: "bg-red-600",
  aguardando: "bg-gray-400",
  sem_sinal: "bg-slate-400",
  online: "bg-emerald-500",
  offline: "bg-slate-300",
  default: "bg-slate-300",
};

export default function PainelOperacionalMapa() {
  const token = MAPBOX_ACCESS_TOKEN;
  const [locs, setLocs] = useState<TrackingPosEnriquecida[]>([]);
  const [loading, setLoading] = useState(true);

  const carregarLocs = async () => {
    try {
      const { data: trackingData, error } = await supabase
        .from("portal_tracking_realtime")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const alocacaoIds = [...new Set((trackingData || []).map(t => t.alocacao_id).filter(Boolean))];
      let alocacoesMap: Record<string, any> = {};

      if (alocacaoIds.length > 0) {
        const { data: alocacoes } = await supabase
          .from("alocacoes_escala")
          .select(`
            id, status, origem, destino, placa, tipo_veiculo,
            prestadores (nome_completo, telefone),
            ordens_servico (numero, cliente)
          `)
          .in("id", alocacaoIds);

        for (const a of alocacoes || []) {
          alocacoesMap[a.id] = a;
        }
      }

      const enriquecidas: TrackingPosEnriquecida[] = (trackingData || []).map(t => {
        const aloc = t.alocacao_id ? alocacoesMap[t.alocacao_id] : undefined;
        return {
          id: t.id,
          latitude: t.latitude,
          longitude: t.longitude,
          velocidade: t.velocidade,
          status: t.status || "offline",
          updated_at: t.updated_at,
          created_at: t.created_at,
          captured_at: t.captured_at,
          origem: t.origem,
          alocacao_id: t.alocacao_id,
          prestador_id: t.prestador_id,
          os_id: t.os_id,
          cliente_id: t.cliente_id,
          precisao: t.precisao,
          alocacao: aloc ? {
            id: aloc.id,
            status: aloc.status,
            origem: aloc.origem,
            destino: aloc.destino,
            placa: aloc.placa,
            tipo_veiculo: aloc.tipo_veiculo,
            prestador_nome: aloc.prestadores?.nome_completo || "—",
            prestador_telefone: aloc.prestadores?.telefone || "—",
            os_numero: aloc.ordens_servico?.numero || "—",
            os_cliente: aloc.ordens_servico?.cliente || "—",
          } : undefined,
        };
      });

      setLocs(enriquecidas);
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
        { event: "INSERT", schema: "public", table: "portal_tracking_realtime" },
        carregarLocs,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, []);

  const total = locs.length;
  const emRota = locs.filter(l => l.status === "em_rota" || l.status === "online").length;
  const atrasadas = locs.filter(l => l.status === "atrasado").length;
  const criticas = locs.filter(l => l.status === "critico").length;
  const semSinal = locs.filter(l => l.status === "offline" || l.status === "aguardando").length;

  const initialView = locs[0]
    ? { latitude: locs[0].latitude, longitude: locs[0].longitude, zoom: 12 }
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

      <div className="lg:col-span-2 h-96 rounded border">
        {locs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm bg-slate-50 rounded">
            <div className="text-center p-8">
              <Loader2 className="animate-spin mx-auto mb-4" />
              <p>{loading ? "Carregando localizações..." : "Nenhuma localização em tempo real disponível."}</p>
              {!loading && <p className="text-xs text-slate-400 mt-2">As posições aparecerão aqui quando os motoristas ativarem o rastreamento pelo App Conexão Express.</p>}
            </div>
          </div>
        ) : (
          <Map
            mapboxAccessToken={token}
            initialViewState={initialView}
            style={{ width: "100%", height: "100%" }}
            mapStyle="mapbox://styles/mapbox/streets-v12"
          >
            <NavigationControl position="top-left" />
            <ScaleControl />
            {locs.map(loc => (
              <Marker
                key={loc.id}
                longitude={loc.longitude}
                latitude={loc.latitude}
                anchor="bottom"
              >
                <div
                  className={`w-3 h-3 rounded-full ${statusColors[loc.status] || statusColors.default}`}
                  title={`OS: ${loc.alocacao?.os_numero || "—"}\nMotorista: ${loc.alocacao?.prestador_nome || "—"}\nStatus: ${loc.status}\nVel: ${loc.velocidade ?? "-"} km/h`}
                />
              </Marker>
            ))}
          </Map>
        )}
      </div>

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
              Nenhuma localização em tempo real ainda.
              <p className="text-xs text-slate-400 mt-1">Ative o rastreamento no App Motorista para ver posições aqui.</p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100%-2rem)]">
              <ul className="divide-y">
                {locs.map(loc => (
                  <li key={loc.id} className="p-2 flex justify-between items-center">
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-medium text-slate-800 truncate text-sm">
                        {loc.alocacao?.os_numero !== "—" ? `OS ${loc.alocacao.os_numero}` : (loc.origem ?? "Sem origem")}
                      </span>
                      <span className="text-xs text-slate-500 truncate">
                        {loc.alocacao?.prestador_nome || "—"} {loc.alocacao?.placa ? `· ${loc.alocacao.placa}` : ""}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(loc.created_at).toLocaleTimeString("pt-BR")}
                        {loc.velocidade !== undefined && loc.velocidade !== null && ` · ${loc.velocidade} km/h`}
                      </span>
                    </div>
                    <Badge className={`${statusColors[loc.status] || statusColors.default} shrink-0 ml-2`}>
                      {loc.status}
                    </Badge>
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
