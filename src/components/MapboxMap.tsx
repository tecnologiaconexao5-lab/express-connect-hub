import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Map, { Marker, Popup, NavigationControl, FullscreenControl, ScaleControl, Source, Layer, MapRef } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Truck, AlertTriangle, AlertCircle, CheckCircle, MapPin, X, Settings, Package, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export interface MapLocation {
  id: string;
  numero: string;
  latitude: number;
  longitude: number;
  status: "em_rota" | "aguardando" | "ocorrencia" | "atrasado" | "concluida" | "em_coleta" | "em_entrega" | "parado";
  cliente?: string;
  prestador?: string;
  previsao?: string;
  sla?: string;
  sequencia?: number;
  vehicleType?: string;
  plate?: string;
  driverName?: string;
  gpsState?: string;
  speed?: number;
  accuracy?: number;
  bateria?: number;
  lastLocationAt?: string;
  osNumero?: string;
  currentStage?: string;
  origin?: string;
  destination?: string;
}

interface MapboxMapProps {
  locations?: MapLocation[];
  onMarkerClick?: (location: MapLocation) => void;
  onOpenDetails?: (location: MapLocation) => void;
  showControls?: boolean;
  style?: "dark" | "light";
  height?: string;
  showClustering?: boolean;
  title?: string;
  routeCoordinates?: [number, number][];
  selectedLocationId?: string;
}



const getStatusColor = (status: string) => {
  switch (status) {
    case "em_rota": return "#22c55e";
    case "em_coleta": return "#0ea5e9";
    case "em_entrega": return "#f97316";
    case "parado": return "#f59e0b";
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
    case "em_coleta": return Package;
    case "em_entrega": return MapPin;
    case "parado": return Clock;
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
    case "em_coleta": return "Em Coleta";
    case "em_entrega": return "Em Entrega";
    case "parado": return "Parado";
    case "aguardando": return "Aguardando";
    case "ocorrencia": return "Ocorrência";
    case "atrasado": return "Atrasado";
    case "concluida": return "Concluída";
    default: return status;
  }
};

export default function MapboxMap({
  locations = [],
  onMarkerClick,
  onOpenDetails,
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

  useEffect(() => {
    if (!selectedLocation) return;
    const atual = locations.find(l => l.id === selectedLocation.id);
    if (atual) setSelectedLocation(atual);
    else setSelectedLocation(null);
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
        gpsState: loc.gpsState,
        driverName: loc.driverName,
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

  if (locations.length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center bg-slate-900 rounded-lg" style={{ height }}>
        <div className="text-center p-8">
          <MapPin className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Nenhuma localização</h3>
          <p className="text-slate-400 mb-4 max-w-md">
            Nenhuma OS com coordenadas disponível no momento. As localizações aparecerão aqui quando houver dados de rastreamento.
          </p>
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
                  "em_coleta", "#0ea5e9",
                  "em_entrega", "#f97316",
                  "parado", "#f59e0b",
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
            maxWidth="300px"
          >
            <div className="p-1.5 min-w-[260px] text-slate-800">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-bold text-sm truncate">{selectedLocation.osNumero || selectedLocation.numero}</span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full text-white shrink-0"
                  style={{ backgroundColor: getStatusColor(selectedLocation.status) }}
                >
                  {getStatusLabel(selectedLocation.status)}
                </span>
              </div>

              {/* SLA + GPS chips */}
              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                {selectedLocation.sla === "atrasado" && (
                  <span className="text-[9px] font-bold uppercase text-white bg-rose-600 px-1.5 py-0.5 rounded">
                    Atrasado
                  </span>
                )}
                {selectedLocation.gpsState && selectedLocation.gpsState !== "sem_rastreamento" && (
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    selectedLocation.gpsState === "atualizado" ? "bg-emerald-600 text-white"
                    : selectedLocation.gpsState === "antigo" ? "bg-amber-500 text-white"
                    : "bg-rose-600 text-white"
                  }`}>
                    {selectedLocation.gpsState === "atualizado" ? "GPS OK" : selectedLocation.gpsState === "antigo" ? "GPS Antigo" : "GPS Muito Antigo"}
                  </span>
                )}
                {selectedLocation.speed != null && selectedLocation.speed > 0 && (
                  <span className="text-[9px] font-bold uppercase text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                    {selectedLocation.speed} km/h
                  </span>
                )}
              </div>

              {selectedLocation.driverName && (
                <p className="text-xs text-gray-700 mb-0.5 font-medium">{selectedLocation.driverName}</p>
              )}
              {selectedLocation.vehicleType && (
                <p className="text-[10px] text-gray-500 mb-1">
                  {selectedLocation.vehicleType}{selectedLocation.plate ? ` · ${selectedLocation.plate}` : ""}
                </p>
              )}
              {selectedLocation.cliente && (
                <p className="text-xs text-gray-600 mb-0.5">Cliente: {selectedLocation.cliente}</p>
              )}
              {selectedLocation.currentStage && (
                <p className="text-[11px] text-indigo-600 font-medium mb-0.5">Etapa: {selectedLocation.currentStage}</p>
              )}
              {selectedLocation.gpsState && selectedLocation.gpsState !== "sem_rastreamento" && (
                <p className="text-[10px] text-gray-500 mb-0.5">
                  GPS {selectedLocation.gpsState === "atualizado" ? "atualizado" : selectedLocation.gpsState === "antigo" ? "desatualizado" : "muito antigo"}
                  {selectedLocation.lastLocationAt ? ` (há ${(() => {
                    const diffMin = Math.floor((Date.now() - new Date(selectedLocation.lastLocationAt).getTime()) / 60000);
                    return diffMin < 60 ? `${diffMin}min` : `${Math.floor(diffMin / 60)}h`;
                  })()})` : ""}
                </p>
              )}
              {selectedLocation.accuracy != null && (
                <p className="text-[10px] text-gray-500 mb-0.5">Precisão: ±{selectedLocation.accuracy}m</p>
              )}
              {(() => {
                const bat = selectedLocation.bateria;
                const valida = bat != null && bat > 0;
                if (!valida) {
                  return <p className="text-[10px] text-gray-400 mb-0.5">Bateria não informada</p>;
                }
                const nivel = bat >= 20 ? "normal" : bat >= 10 ? "atencao" : "critico";
                const cor = nivel === "normal" ? "text-emerald-600" : nivel === "atencao" ? "text-amber-600" : "text-rose-600";
                const barra = nivel === "normal" ? "bg-emerald-500" : nivel === "atencao" ? "bg-amber-500" : "bg-rose-500";
                return (
                  <p className="text-[10px] text-gray-500 mb-0.5 flex items-center gap-1.5">
                    <span>Bateria: <span className={`font-bold ${cor}`}>{Math.round(bat)}%</span></span>
                    <span className="w-8 h-1.5 rounded-full bg-gray-200 overflow-hidden inline-block">
                      <span className={`block h-full ${barra}`} style={{ width: `${Math.min(100, bat)}%` }} />
                    </span>
                    {nivel === "critico" && <span className="text-[9px] font-bold uppercase text-rose-500">Crítico</span>}
                    {nivel === "atencao" && <span className="text-[9px] font-semibold uppercase text-amber-500">Atenção</span>}
                  </p>
                );
              })()}
              {selectedLocation.origin && (
                <p className="text-[10px] text-gray-500 mb-0.5 truncate">Origem: {selectedLocation.origin}</p>
              )}
              {selectedLocation.destination && (
                <p className="text-[10px] text-gray-500 mb-0.5 truncate">Destino: {selectedLocation.destination}</p>
              )}
              {selectedLocation.previsao && (
                <p className={`text-[10px] mb-1 ${
                  selectedLocation.sla === "atrasado" ? "text-rose-600 font-semibold" : "text-gray-500"
                }`}>
                  Previsão: {new Date(selectedLocation.previsao).toLocaleString("pt-BR")}
                </p>
              )}
              {onOpenDetails && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetails(selectedLocation);
                  }}
                  className="w-full mt-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 px-3 rounded-md font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                  Abrir Painel Completo
                </button>
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
            <div className="w-3 h-3 rounded-full bg-sky-500" />
            <span className="text-xs text-slate-300">Em Coleta</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-xs text-slate-300">Em Entrega</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-xs text-slate-300">Parado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-xs text-slate-300">Aguardando</span>
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
