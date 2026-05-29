import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Map, { Marker, Popup, NavigationControl, FullscreenControl, ScaleControl, Source, Layer, MapRef } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Truck, AlertTriangle, AlertCircle, CheckCircle, MapPin, X, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export interface MapLocation {
  id: string;
  numero: string;
  latitude: number;
  longitude: number;
  status: "em_rota" | "aguardando" | "ocorrencia" | "atrasado" | "concluida";
  cliente?: string;
  prestador?: string;
  previsao?: string;
  sla?: string;
  sequencia?: number;
}

interface MapboxMapProps {
  locations?: MapLocation[];
  onMarkerClick?: (location: MapLocation) => void;
  showControls?: boolean;
  style?: "dark" | "light";
  height?: string;
  showClustering?: boolean;
  title?: string;
  routeCoordinates?: [number, number][];
  selectedLocationId?: string;
}

const defaultLocations: MapLocation[] = [
  { id: "1", numero: "OS-1042", latitude: -23.5505, longitude: -46.6333, status: "em_rota", cliente: "Tech Solutions", prestador: "João Silva", previsao: "16:00" },
  { id: "2", numero: "OS-1045", latitude: -23.2222, longitude: -45.9999, status: "ocorrencia", cliente: "Indústria Global", prestador: "Maria Costa", previsao: "14:30" },
  { id: "3", numero: "OS-1090", latitude: -22.9068, longitude: -43.1729, status: "aguardando", cliente: "Comércio Varejo", prestador: "Pedro Santos", previsao: "17:00" },
  { id: "4", numero: "OS-1088", latitude: -19.9167, longitude: -43.9345, status: "em_rota", cliente: "Distribuidora Norte", prestador: "Carlos Lima", previsao: "18:30" },
  { id: "5", numero: "OS-1077", latitude: -25.4284, longitude: -49.2733, status: "atrasado", cliente: "Logística Sul", prestador: "Ana Oliveira", previsao: "12:00" },
  { id: "6", numero: "OS-1091", latitude: -23.5610, longitude: -46.6560, status: "em_rota", cliente: "Tech Solutions", prestador: "João Silva" },
  { id: "7", numero: "OS-1092", latitude: -23.5450, longitude: -46.6400, status: "concluida", cliente: "Tech Solutions", prestador: "João Silva" },
  { id: "8", numero: "OS-1093", latitude: -23.5300, longitude: -46.6200, status: "aguardando", cliente: "Comércio Varejo", prestador: "Pedro Santos" },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "em_rota": return "#22c55e";
    case "aguardando": return "#eab308";
    case "ocorrencia": return "#ef4444";
    case "atrasado": return "#dc2626";
    case "concluida": return "#3b82f6";
    default: return "#6b7280";
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "em_rota": return Truck;
    case "aguardando": return Truck;
    case "ocorrencia": return AlertCircle;
    case "atrasado": return AlertTriangle;
    case "concluida": return CheckCircle;
    default: return Truck;
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "em_rota": return "Em Rota";
    case "aguardando": return "Aguardando";
    case "ocorrencia": return "Ocorrência";
    case "atrasado": return "Atrasado";
    case "concluida": return "Concluída";
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
  title,
  routeCoordinates,
  selectedLocationId,
}: MapboxMapProps) {
  const [viewState, setViewState] = useState({
    longitude: locations.length > 0 ? locations[0].longitude : -46.6333,
    latitude: locations.length > 0 ? locations[0].latitude : -23.5505,
    zoom: 10
  });
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [mapToken, setMapToken] = useState<string | null>(null);
  const hasCenterRef = useRef(false);
  const mapRef = useRef<MapRef>(null);
  const navigate = useNavigate();

  const clusteringEnabled = showClustering && locations.length > 5;

  useEffect(() => {
    if (!selectedLocationId || !mapRef.current) return;
    const loc = locations.find(l => l.id === selectedLocationId);
    if (loc) {
      const mapInstance = mapRef.current.getMap();
      mapInstance.flyTo({ center: [loc.longitude, loc.latitude], zoom: 14, duration: 800 });
      setSelectedLocation(loc);
    }
  }, [selectedLocationId, locations]);

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || localStorage.getItem("mapbox_token");
    if (token) {
      setMapToken(token);
    }
  }, []);

  useEffect(() => {
    if (locations.length > 0 && !hasCenterRef.current) {
      hasCenterRef.current = true;
      setViewState(prev => ({
        ...prev,
        longitude: locations[0].longitude,
        latitude: locations[0].latitude
      }));
    }
  }, [locations]);

  const geojsonData = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: locations.map(loc => ({
      type: "Feature" as const,
      properties: {
        id: loc.id,
        numero: loc.numero,
        status: loc.status,
        cliente: loc.cliente,
        prestador: loc.prestador,
        previsao: loc.previsao,
        sla: loc.sla,
      },
      geometry: { type: "Point" as const, coordinates: [loc.longitude, loc.latitude] }
    }))
  }), [locations]);

  const handleMapClick = useCallback((e: any) => {
    if (!clusteringEnabled) return;
    const feature = e.features?.[0];
    if (!feature) return;

    const clusterId = feature.properties?.cluster_id;
    if (clusterId) {
      const mapInstance = mapRef.current?.getMap();
      if (mapInstance) {
        const source = mapInstance.getSource("clusters") as any;
        source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
          if (err) return;
          const geometry = feature.geometry as { coordinates: [number, number] };
          mapInstance.flyTo({ center: geometry.coordinates, zoom: zoom + 1 });
        });
      }
    } else {
      const loc = locations.find(l => l.id === feature.properties.id);
      if (loc) {
        setSelectedLocation(loc);
        onMarkerClick?.(loc);
      }
    }
  }, [locations, clusteringEnabled, onMarkerClick]);

  const handleMarkerClick = (location: MapLocation) => {
    setSelectedLocation(location);
    onMarkerClick?.(location);
  };

  const openSettings = () => {
    navigate("/configuracoes?tab=integracoes");
  };

  if (!mapToken) {
    return (
      <div className="w-full flex flex-col items-center justify-center bg-slate-900 rounded-lg" style={{ height }}>
        <div className="text-center p-8">
          <MapPin className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Mapa não disponível</h3>
          <p className="text-slate-400 mb-4 max-w-md">
            Configure a integração de mapas para visualizar o rastreamento em tempo real.
          </p>
          <Button onClick={openSettings} className="bg-orange-500 hover:bg-orange-600 gap-2">
            <Settings className="w-4 h-4" />
            Configurar Integração
          </Button>
        </div>
      </div>
    );
  }

  const routeGeojson: any = routeCoordinates ? {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: routeCoordinates
    }
  } : null;

  return (
    <div className="w-full rounded-lg overflow-hidden relative" style={{ height }}>
      {title && (
        <div className="absolute top-4 left-4 z-10">
          <div className="bg-slate-900/80 backdrop-blur text-white px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-700">
            {title}
          </div>
        </div>
      )}
      
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapStyle={style === "dark" ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11"}
        mapboxAccessToken={mapToken}
        style={{ width: "100%", height: "100%" }}
        onClick={handleMapClick}
        interactiveLayerIds={clusteringEnabled ? ["clusters-circle", "unclustered-point"] : undefined}
      >
        {showControls && (
          <>
            <NavigationControl position="top-right" />
            <FullscreenControl position="top-right" />
            <ScaleControl />
          </>
        )}

        {routeGeojson && (
          <Source id="route" type="geojson" data={routeGeojson}>
            <Layer 
              id="route-line" 
              type="line" 
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{ "line-color": "#6366f1", "line-width": 4, "line-opacity": 0.8 }}
            />
          </Source>
        )}

        {clusteringEnabled ? (
          <Source id="clusters" type="geojson" data={geojsonData} cluster={true} clusterMaxZoom={14} clusterRadius={50}>
            <Layer
              id="clusters-circle"
              type="circle"
              filter={["has", "point_count"]}
              paint={{
                "circle-color": "#6366f1",
                "circle-radius": ["step", ["get", "point_count"], 20, 10, 30, 50, 40],
                "circle-opacity": 0.85,
                "circle-stroke-width": 2,
                "circle-stroke-color": "#ffffff",
              }}
            />
            <Layer
              id="clusters-count"
              type="symbol"
              filter={["has", "point_count"]}
              layout={{
                "text-field": "{point_count_abbreviated}",
                "text-size": 12,
              }}
              paint={{ "text-color": "#ffffff" }}
            />
            <Layer
              id="unclustered-point"
              type="circle"
              filter={["!", ["has", "point_count"]]}
              paint={{
                "circle-color": ["match", ["get", "status"],
                  "em_rota", "#22c55e",
                  "aguardando", "#eab308",
                  "ocorrencia", "#ef4444",
                  "atrasado", "#dc2626",
                  "concluida", "#3b82f6",
                  "#6b7280"
                ],
                "circle-radius": 7,
                "circle-stroke-width": 2,
                "circle-stroke-color": "#ffffff",
              }}
            />
          </Source>
        ) : (
          locations.map((location) => {
            const IconMarker = getStatusIcon(location.status);
            return (
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
                  className="cursor-pointer transform hover:scale-110 transition-transform relative"
                  style={{ filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.3))` }}
                >
                  {location.sequencia !== undefined && (
                    <div className="absolute -top-2 -right-2 bg-indigo-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold border border-white z-10">
                      {location.sequencia}
                    </div>
                  )}
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-lg"
                    style={{ backgroundColor: getStatusColor(location.status) }}
                  >
                    <IconMarker className="w-4 h-4 text-white" />
                  </div>
                </div>
              </Marker>
            );
          })
        )}

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
            <div className="p-2 min-w-[200px] text-slate-800">
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
                <p className="text-xs text-gray-500">Previsão: {new Date(selectedLocation.previsao).toLocaleString("pt-BR")}</p>
              )}
              {selectedLocation.sla && (
                <p className="text-xs font-semibold mt-1" style={{ color: getStatusColor(selectedLocation.sla) }}>
                  SLA: {getStatusLabel(selectedLocation.sla)}
                </p>
              )}
            </div>
          </Popup>
        )}
      </Map>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur rounded-lg p-3 z-10 border border-slate-700">
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
            <span className="text-xs text-slate-300">Atrasado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-600" />
            <span className="text-xs text-slate-300">Ocorrência</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-xs text-slate-300">Concluída</span>
          </div>
          {clusteringEnabled && (
            <div className="flex items-center gap-2 pt-1 border-t border-slate-700 mt-1">
              <div className="w-3 h-3 rounded-full bg-indigo-500" />
              <span className="text-xs text-slate-300">Cluster</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
