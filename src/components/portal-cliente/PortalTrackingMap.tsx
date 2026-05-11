import { LucideIcon, MapPin, Navigation, Truck, Clock, Map } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TrackingLocation {
  lat: number;
  lng: number;
  label?: string;
}

interface PortalTrackingMapProps {
  origin?: TrackingLocation;
  destination?: TrackingLocation;
  currentPosition?: TrackingLocation;
  driverName?: string;
  vehicle?: string;
  plate?: string;
  status?: string;
  eta?: string;
  distance?: number;
  mapboxToken?: string;
}

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
}: PortalTrackingMapProps) {
  const hasValidCoords =
    (origin && origin.lat && origin.lng) ||
    (destination && destination.lat && destination.lng) ||
    (currentPosition && currentPosition.lat && currentPosition.lng);

  const hasMapboxToken = mapboxToken && mapboxToken.length > 0;

  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    programacao: { bg: "bg-slate-500/10", text: "text-slate-400", label: "Programado" },
    coleta: { bg: "bg-blue-500/10", text: "text-blue-400", label: "Em Coleta" },
    em_rota: { bg: "bg-orange-500/10", text: "text-orange-400", label: "Em Rota" },
    entrega_concluida: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Entregue" },
    atrasada: { bg: "bg-red-500/10", text: "text-red-400", label: "Atrasado" },
    problema: { bg: "bg-red-500/10", text: "text-red-400", label: "Com Problema" },
  };

  const statusStyle = statusColors[status] || statusColors.programacao;

  if (!hasValidCoords || !hasMapboxToken) {
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
          {(eta || distance) && (
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
            </div>
          )}
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
        <div className="h-[300px] rounded-xl bg-slate-700/30 relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-slate-400 text-sm">Mapa Mapbox</p>
              <p className="text-slate-500 text-xs mt-1">
                Coordenadas: {currentPosition?.lat.toFixed(4)}, {currentPosition?.lng.toFixed(4)}
              </p>
            </div>
          </div>
          {origin && (
            <div className="absolute top-4 left-4 flex items-center gap-2 px-2 py-1 bg-emerald-500/20 rounded text-xs text-emerald-400">
              <MapPin className="w-3 h-3" />
              Origem
            </div>
          )}
          {destination && (
            <div className="absolute top-4 right-4 flex items-center gap-2 px-2 py-1 bg-purple-500/20 rounded text-xs text-purple-400">
              <MapPin className="w-3 h-3" />
              Destino
            </div>
          )}
        </div>
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
        </div>
        {vehicle && plate && (
          <div className="mt-3 p-2 bg-slate-800/50 rounded text-xs text-slate-400 flex items-center justify-center gap-4">
            <span>🚗 {vehicle}</span>
            <span>🏷️ {plate}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}