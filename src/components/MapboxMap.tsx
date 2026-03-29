import { useState, useEffect, useRef } from "react";
import Map, { Marker, Popup, NavigationControl, FullscreenControl, ScaleControl } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Truck, AlertTriangle, MapPin, X, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface MapLocation {
  id: string;
  numero: string;
  latitude: number;
  longitude: number;
  status: "em_rota" | "aguardando" | "ocorrencia" | "atrasado";
  cliente?: string;
  prestador?: string;
  previsao?: string;
}

interface MapboxMapProps {
  locations?: MapLocation[];
  onMarkerClick?: (location: MapLocation) => void;
  showControls?: boolean;
  style?: "dark" | "light";
  height?: string;
  showClustering?: boolean;
  title?: string;
}

const defaultLocations: MapLocation[] = [
  { id: "1", numero: "OS-1042", latitude: -23.5505, longitude: -46.6333, status: "em_rota", cliente: "Tech Solutions", prestador: "João Silva", previsao: "16:00" },
  { id: "2", numero: "OS-1045", latitude: -23.2222, longitude: -45.9999, status: "ocorrencia", cliente: "Indústria Global", prestador: "Maria Costa", previsao: "14:30" },
  { id: "3", numero: "OS-1090", latitude: -22.9068, longitude: -43.1729, status: "aguardando", cliente: "Comércio Varejo", prestador: "Pedro Santos", previsao: "17:00" },
  { id: "4", numero: "OS-1088", latitude: -19.9167, longitude: -43.9345, status: "em_rota", cliente: "Distribuidora Norte", prestador: "Carlos Lima", previsao: "18:30" },
  { id: "5", numero: "OS-1077", latitude: -25.4284, longitude: -49.2733, status: "atrasado", cliente: "Logística Sul", prestador: "Ana Oliveira", previsao: "12:00" },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "em_rota": return "#22c55e";
    case "aguardando": return "#eab308";
    case "ocorrencia": return "#ef4444";
    case "atrasado": return "#dc2626";
    default: return "#6b7280";
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "em_rota": return "Em Rota";
    case "aguardando": return "Aguardando";
    case "ocorrencia": return "Ocorrência";
    case "atrasado": return "Atrasado";
    default: return status;
  }
};

export default function MapboxMap({
  locations = defaultLocations,
  onMarkerClick,
  showControls = true,
  style = "dark",
  height = "100%",
  showClustering = true,
  title
}: MapboxMapProps) {
  const [viewState, setViewState] = useState({
    longitude: -46.6333,
    latitude: -23.5505,
    zoom: 6
  });
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [mapToken, setMapToken] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("mapbox_token");
    if (token) {
      setMapToken(token);
    }
  }, []);

  const handleMarkerClick = (location: MapLocation) => {
    setSelectedLocation(location);
    onMarkerClick?.(location);
  };

  const openSettings = () => {
    navigate("/configuracoes?tab=integracoes");
  };

  if (!mapToken) {
    return (
      <div 
        className="w-full flex flex-col items-center justify-center bg-slate-900 rounded-lg"
        style={{ height }}
      >
        <div className="text-center p-8">
          <MapPin className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Mapbox não configurado</h3>
          <p className="text-slate-400 mb-4 max-w-md">
            Configure o token do Mapbox em Configurações → Integrações para visualizar o mapa de rastreamento.
          </p>
          <Button onClick={openSettings} className="bg-orange-500 hover:bg-orange-600 gap-2">
            <Settings className="w-4 h-4" />
            Configurar Mapbox
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg overflow-hidden relative" style={{ height }}>
      {title && (
        <div className="absolute top-4 left-4 z-10">
          <div className="bg-slate-900/80 backdrop-blur text-white px-3 py-1.5 rounded-lg text-sm font-medium">
            {title}
          </div>
        </div>
      )}
      
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapStyle={style === "dark" ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11"}
        mapboxAccessToken={mapToken}
        style={{ width: "100%", height: "100%" }}
      >
        {showControls && (
          <>
            <NavigationControl position="top-right" />
            <FullscreenControl position="top-right" />
            <ScaleControl />
          </>
        )}

        {locations.map((location) => (
          <Marker
            key={location.id}
            longitude={location.longitude}
            latitude={location.latitude}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              handleMarkerClick(location);
            }}
          >
            <div 
              className="cursor-pointer transform hover:scale-110 transition-transform"
              style={{ 
                filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.3))`
              }}
            >
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-lg"
                style={{ backgroundColor: getStatusColor(location.status) }}
              >
                <Truck className="w-4 h-4 text-white" />
              </div>
            </div>
          </Marker>
        ))}

        {selectedLocation && (
          <Popup
            longitude={selectedLocation.longitude}
            latitude={selectedLocation.latitude}
            anchor="bottom"
            onClose={() => setSelectedLocation(null)}
            closeButton={true}
            closeOnClick={false}
            className="z-50"
          >
            <div className="p-2 min-w-[200px]">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm">{selectedLocation.numero}</span>
                <span 
                  className="text-[10px] px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: getStatusColor(selectedLocation.status) }}
                >
                  {getStatusLabel(selectedLocation.status)}
                </span>
              </div>
              {selectedLocation.cliente && (
                <p className="text-xs text-gray-600 mb-1">Cliente: {selectedLocation.cliente}</p>
              )}
              {selectedLocation.prestador && (
                <p className="text-xs text-gray-600 mb-1">Prestador: {selectedLocation.prestador}</p>
              )}
              {selectedLocation.previsao && (
                <p className="text-xs text-gray-500">Previsão: {selectedLocation.previsao}</p>
              )}
              <div className="mt-2 pt-2 border-t flex gap-2">
                <Button size="sm" variant="outline" className="text-xs flex-1">
                  Ver Detalhes
                </Button>
                <Button size="sm" className="text-xs flex-1 bg-green-500 hover:bg-green-600">
                  Contactar
                </Button>
              </div>
            </div>
          </Popup>
        )}
      </Map>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur rounded-lg p-3 z-10">
        <p className="text-[10px] text-slate-400 uppercase font-semibold mb-2">Legenda</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-xs text-slate-300">Em Rota</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-xs text-slate-300">Aguardando</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-xs text-slate-300">Ocorrência</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-800" />
            <span className="text-xs text-slate-300">Atrasado</span>
          </div>
        </div>
      </div>
    </div>
  );
}
