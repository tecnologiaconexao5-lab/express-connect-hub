import { useEffect, useRef } from "react";
import { MapPin, Navigation, Truck, Clock, Map } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import mapboxgl from "mapbox-gl";
import type { TrackingPosition } from "@/services/rastreamento/trackingService";

interface TrackingLocation {
  lat: number;
  lng: number;
  label?: string;
}

interface PortalTrackingMapProps {
  origin?: TrackingLocation;
  destination?: TrackingLocation;
  currentPosition?: TrackingPosition;
  driverName?: string;
  vehicle?: string;
  plate?: string;
  status?: string;
  eta?: string;
  distance?: number;
  mapboxToken?: string;
  ultimaAtualizacao?: string;
}

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  programacao: { bg: "bg-slate-500/10", text: "text-slate-400", label: "Programado" },
  coleta: { bg: "bg-blue-500/10", text: "text-blue-400", label: "Em Coleta" },
  em_rota: { bg: "bg-orange-500/10", text: "text-orange-400", label: "Em Rota" },
  entrega_concluida: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Entregue" },
  atrasada: { bg: "bg-red-500/10", text: "text-red-400", label: "Atrasado" },
  problema: { bg: "bg-red-500/10", text: "text-red-400", label: "Com Problema" },
};

export function PortalTrackingMap({
  origin,
  destination,
  currentPosition,
  driverName,
  vehicle,
  plate,
  status = "Aguardando",
  eta,
  distance,
  mapboxToken,
  ultimaAtualizacao,
}: PortalTrackingMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  const coordsValidas = (currentPosition?.latitude && currentPosition?.longitude) ||
    (origin?.lat && origin?.lng) || (destination?.lat && destination?.lng);

  const tokenValido = mapboxToken && mapboxToken.length > 0;

  // Inicializa ou atualiza o mapa Mapbox quando há coordenadas
  useEffect(() => {
    if (!coordsValidas || !tokenValido || !mapContainer.current) return;

    const centerLng = currentPosition?.longitude || destination?.lng || origin?.lng || 0;
    const centerLat = currentPosition?.latitude || destination?.lat || origin?.lat || 0;

    if (!mapInstance.current) {
      mapboxgl.accessToken = mapboxToken!;
      mapInstance.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [centerLng, centerLat],
        zoom: 13,
        attributionControl: false,
      });
      mapInstance.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    }

    // Atualiza a posição do marcador principal
    if (currentPosition?.latitude && currentPosition?.longitude && mapInstance.current) {
      const lng = currentPosition.longitude;
      const lat = currentPosition.latitude;
      if (!markerRef.current) {
        const el = document.createElement("div");
        el.className = "w-8 h-8 bg-orange-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center";
        el.innerHTML = '<div class="w-3 h-3 bg-white rounded-full"></div>';
        markerRef.current = new mapboxgl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(mapInstance.current);
      } else {
        markerRef.current.setLngLat([lng, lat]);
      }
      mapInstance.current.flyTo({ center: [lng, lat], zoom: 13, duration: 1000 });
    }

    return () => {
      // Não destruímos o mapa aqui para evitar recriação desnecessária
    };
  }, [currentPosition?.latitude, currentPosition?.longitude, coordsValidas, tokenValido, mapboxToken, origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  // Limpa o mapa ao desmontar
  useEffect(() => {
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  const statusStyle = statusColors[status] || statusColors.programacao;

  if (!tokenValido) {
    return (
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-white flex items-center gap-2">
            <Map className="w-4 h-4 text-purple-400" />
            Rastreamento em Tempo Real
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] rounded-xl bg-slate-700/30 flex flex-col items-center justify-center gap-3 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-purple-500 rounded-full blur-3xl" />
              <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-orange-500 rounded-full blur-2xl" />
            </div>
            <div className="w-16 h-16 rounded-2xl bg-slate-600/50 flex items-center justify-center">
              <Map className="w-8 h-8 text-slate-400" />
            </div>
            <div className="text-center relative z-10">
              <p className="text-sm text-slate-300 font-medium">Mapa em Breve</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Configure o token Mapbox para habilitar o rastreamento em tempo real
              </p>
            </div>
            {driverName && (
              <div className="flex items-center gap-4 mt-4 p-3 bg-slate-800/50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-purple-500 flex items-center justify-center text-white font-bold">
                  {driverName.charAt(0)}
                </div>
                <div>
                  <p className="text-sm text-white">{driverName}</p>
                  <p className="text-xs text-slate-400">{vehicle} • {plate}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs ${statusStyle.bg} ${statusStyle.text}`}>
                  {statusStyle.label}
                </span>
              </div>
            )}
          </div>
          <InfoGrid eta={eta} distance={distance} driverName={driverName} status={status} statusStyle={statusStyle} vehicle={vehicle} plate={plate} ultimaAtualizacao={ultimaAtualizacao} />
        </CardContent>
      </Card>
    );
  }

  if (!coordsValidas) {
    const semTrackingNuncaIniciado = !driverName && !status;
    return (
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-white flex items-center gap-2">
            <Map className="w-4 h-4 text-purple-400" />
            Rastreamento em Tempo Real
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] rounded-xl bg-slate-700/30 flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-slate-600/50 flex items-center justify-center">
              {semTrackingNuncaIniciado ? (
                <MapPin className="w-8 h-8 text-slate-400" />
              ) : (
                <Navigation className="w-8 h-8 text-slate-400" />
              )}
            </div>
            <div className="text-center">
              {semTrackingNuncaIniciado ? (
                <>
                  <p className="text-sm text-slate-300 font-medium">Rastreamento não disponível</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Esta entrega ainda não possui dados de rastreamento. O link de rastreio será ativado quando o motorista iniciar a rota.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-300 font-medium">Aguardando Localização</p>
                  <p className="text-xs text-slate-500 mt-1">
                    A localização será exibida assim que o motorista iniciar a rota
                  </p>
                </>
              )}
            </div>
          </div>
          <InfoGrid eta={eta} distance={distance} driverName={driverName} status={status} statusStyle={statusStyle} vehicle={vehicle} plate={plate} ultimaAtualizacao={ultimaAtualizacao} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-white flex items-center gap-2">
          <Map className="w-4 h-4 text-purple-400" />
          Rastreamento em Tempo Real
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={mapContainer} className="h-[300px] rounded-xl overflow-hidden" />
        <div className="grid grid-cols-2 gap-3 mt-4">
          {driverName && (
            <div className="p-3 bg-slate-700/30 rounded-lg flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs">
                {driverName.charAt(0)}
              </div>
              <div>
                <p className="text-xs text-slate-400">Motorista</p>
                <p className="text-sm text-white font-medium">{driverName}</p>
              </div>
            </div>
          )}
          <div className="p-3 bg-slate-700/30 rounded-lg flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${statusStyle.bg}`}>
              <Truck className={`w-4 h-4 ${statusStyle.text}`} />
            </div>
            <div>
              <p className="text-xs text-slate-400">Status</p>
              <p className={`text-sm font-medium ${statusStyle.text}`}>{statusStyle.label}</p>
            </div>
          </div>
          {ultimaAtualizacao && (
            <div className="p-3 bg-slate-700/30 rounded-lg flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Clock className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Última Atualização</p>
                <p className="text-sm text-white font-medium">{new Date(ultimaAtualizacao).toLocaleTimeString("pt-BR")}</p>
              </div>
            </div>
          )}
          {currentPosition?.velocidade !== undefined && (
            <div className="p-3 bg-slate-700/30 rounded-lg flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Navigation className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Velocidade</p>
                <p className="text-sm text-white font-medium">{currentPosition.velocidade.toFixed(0)} km/h</p>
              </div>
            </div>
          )}
        </div>
        {vehicle && plate && (
          <div className="mt-3 p-2 bg-slate-800/50 rounded text-xs text-slate-400 flex items-center justify-center gap-4">
            <Truck className="w-3 h-3 inline" /> {vehicle}
            <MapPin className="w-3 h-3 inline" /> {plate}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InfoGrid({ eta, distance, driverName, status, statusStyle, vehicle, plate, ultimaAtualizacao }: {
  eta?: string; distance?: number; driverName?: string; status: string; statusStyle: { bg: string; text: string; label: string }; vehicle?: string; plate?: string; ultimaAtualizacao?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 mt-4">
      {eta && (
        <div className="p-3 bg-slate-700/30 rounded-lg flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Previsão</p>
            <p className="text-sm text-white font-medium">{eta}</p>
          </div>
        </div>
      )}
      {distance && (
        <div className="p-3 bg-slate-700/30 rounded-lg flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <Navigation className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Distância</p>
            <p className="text-sm text-white font-medium">{distance} km</p>
          </div>
        </div>
      )}
      {ultimaAtualizacao && (
        <div className="p-3 bg-slate-700/30 rounded-lg flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Atualização</p>
            <p className="text-sm text-white font-medium">{new Date(ultimaAtualizacao).toLocaleTimeString("pt-BR")}</p>
          </div>
        </div>
      )}
    </div>
  );
}