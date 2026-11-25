import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Map, { Marker, Popup, NavigationControl, FullscreenControl, ScaleControl, Source, Layer, MapRef } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Truck, Bike, Car, AlertTriangle, AlertCircle, CheckCircle, MapPin, X, Settings, Package, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { MAPBOX_ACCESS_TOKEN } from "@/lib/mapboxToken";

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
  /** Roteirizador: cor/id da rota + dados completos da parada. */
  routeColor?: string;
  routeId?: string;
  destinatario?: string;
  endereco?: string;
  peso?: number;
  janela?: string;
  motorista?: string;
}

interface RouteLine {
  id: string;
  color: string;
  coordinates: [number, number][];
}

interface RegionPolygon {
  id: string;
  color: string;
  coordinates: [number, number][];
  /** Rótulo da região desenhado sobre o polígono. */
  label?: string;
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
  /** Roteirizador: várias rotas (cada uma com cor) e polígonos por região. */
  routeLines?: RouteLine[];
  regionPolygons?: RegionPolygon[];
  origin?: { latitude: number; longitude: number; label?: string };
  legend?: { color: string; label: string }[];
  focusRouteId?: string | null;
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

// Ícone do marcador de acordo com o veículo alocado (moto ≠ caminhão).
const getVehicleIcon = (vehicleType?: string | null) => {
  const t = String(vehicleType || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (t.includes("moto")) return Bike;
  if (t.includes("carro") || t.includes("passeio") || t.includes("automovel")) return Car;
  return Truck;
};

// Alertas/conclusão continuam com prioridade visual sobre o tipo de veículo.
const getMarkerIcon = (location: MapLocation) => {
  if (location.status === "ocorrencia") return AlertCircle;
  if (location.status === "atrasado") return AlertTriangle;
  if (location.status === "concluida") return CheckCircle;
  return getVehicleIcon(location.vehicleType);
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
  routeLines,
  regionPolygons,
  origin,
  legend,
  focusRouteId,
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
  // Modo roteirização: várias rotas/polígonos — sem legenda genérica duplicada.
  const modoRoteirizacao = Boolean(
    (routeLines && routeLines.length > 0) || (regionPolygons && regionPolygons.length > 0),
  );
  const clusteringEfetivo = clusteringEnabled && !modoRoteirizacao;

  useEffect(() => {
    if (!selectedLocationId || !mapRef.current) return;
    const loc = locations.find(l => l.id === selectedLocationId);
    if (loc) {
      const mapInstance = mapRef.current.getMap();
      mapInstance.flyTo({ center: [loc.longitude, loc.latitude], zoom: 14, duration: 800 });
      setSelectedLocation(loc);
    }
  }, [selectedLocationId, locations]);

  // Foco em uma rota/regiao (fitBounds) ou em todas as rotas.
  useEffect(() => {
    const mapInstance = mapRef.current?.getMap();
    if (!mapInstance) return;
    let coords: [number, number][] = [];
    if (focusRouteId) {
      const line = routeLines?.find(l => l.id === focusRouteId);
      const poly = regionPolygons?.find(p => p.id === focusRouteId);
      coords = line?.coordinates || poly?.coordinates || [];
    } else if (routeLines && routeLines.length > 0) {
      routeLines.forEach(l => { coords = coords.concat(l.coordinates); });
    }
    if (coords.length === 0) return;
    let minLng = coords[0][0], maxLng = coords[0][0];
    let minLat = coords[0][1], maxLat = coords[0][1];
    coords.forEach(([lng, lat]) => {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    });
    try {
      mapInstance.fitBounds(
        [[minLng, minLat], [maxLng, maxLat]],
        { padding: 60, duration: 800, maxZoom: 14 },
      );
    } catch {
      // ignora fitBounds invalido
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRouteId]);

  useEffect(() => {
    setMapToken(MAPBOX_ACCESS_TOKEN);
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
    if (!clusteringEfetivo) return;
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
  }, [locations, clusteringEfetivo, onMarkerClick]);

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
        interactiveLayerIds={clusteringEfetivo ? ["clusters-circle", "unclustered-point"] : undefined}
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

        {regionPolygons?.map((poly) => {
          const emFoco = !focusRouteId || poly.id === focusRouteId;
          return (
            <Source
              key={`poly-${poly.id}`}
              id={`poly-${poly.id}`}
              type="geojson"
              data={{
                type: "Feature",
                properties: {},
                geometry: { type: "Polygon", coordinates: [poly.coordinates] },
              } as any}
            >
              <Layer
                id={`poly-fill-${poly.id}`}
                type="fill"
                paint={{ "fill-color": poly.color, "fill-opacity": emFoco ? 0.12 : 0.04 }}
              />
              <Layer
                id={`poly-line-${poly.id}`}
                type="line"
                paint={{
                  "line-color": poly.color,
                  "line-width": emFoco ? 2.5 : 1.5,
                  "line-opacity": emFoco ? 0.9 : 0.2,
                }}
              />
            </Source>
          );
        })}

        {regionPolygons?.map((poly) => {
          if (!poly.label) return null;
          const ring = poly.coordinates.length > 3
            ? poly.coordinates.slice(0, poly.coordinates.length - 1)
            : poly.coordinates;
          if (ring.length === 0) return null;
          const lng = ring.reduce((acc, p) => acc + p[0], 0) / ring.length;
          const lat = ring.reduce((acc, p) => acc + p[1], 0) / ring.length;
          const emFoco = !focusRouteId || poly.id === focusRouteId;
          return (
            <Marker key={`lbl-${poly.id}`} longitude={lng} latitude={lat} anchor="center">
              <div
                className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-md whitespace-nowrap pointer-events-none"
                style={{ backgroundColor: poly.color, opacity: emFoco ? 0.95 : 0.3 }}
              >
                {poly.label}
              </div>
            </Marker>
          );
        })}

        {routeLines?.map((line) => {
          const emFoco = !focusRouteId || line.id === focusRouteId;
          return (
            <Source
              key={`line-${line.id}`}
              id={`line-${line.id}`}
              type="geojson"
              data={{
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates: line.coordinates },
              } as any}
            >
              <Layer
                id={`line-${line.id}`}
                type="line"
                layout={{ "line-join": "round", "line-cap": "round" }}
                paint={{
                  "line-color": line.color,
                  "line-width": emFoco ? 5 : 2.5,
                  "line-opacity": emFoco ? 0.95 : 0.15,
                }}
              />
            </Source>
          );
        })}

        {origin && (
          <Marker longitude={origin.longitude} latitude={origin.latitude} anchor="bottom">
            <div className="flex flex-col items-center">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center border-2 border-white shadow-lg"
                style={{ backgroundColor: "#111827" }}
                title={origin.label || "Local de carregamento"}
              >
                <Package className="w-4 h-4 text-white" />
              </div>
              <span className="mt-0.5 text-[10px] font-semibold text-white bg-slate-900/80 px-1.5 py-0.5 rounded whitespace-nowrap">
                {origin.label || "CD/Base"}
              </span>
            </div>
          </Marker>
        )}

        {clusteringEfetivo ? (
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
            const IconMarker = getMarkerIcon(location);
            const emFoco = !focusRouteId || location.routeId === focusRouteId;
            const modoRotaMarcador = Boolean(location.routeColor);
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
                  style={{
                    filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.3))`,
                    opacity: emFoco ? 1 : 0.28,
                  }}
                >
                  {modoRotaMarcador ? (
                    // Marcador limpo numerado na cor da rota (roteirizador).
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-lg"
                      style={{ backgroundColor: location.routeColor }}
                      title={location.numero}
                    >
                      {location.sequencia ?? "•"}
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
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
              {selectedLocation.destinatario && (
                <p className="text-xs text-gray-700 mb-0.5 font-medium">
                  Destinatário: {selectedLocation.destinatario}
                </p>
              )}
              {selectedLocation.endereco && (
                <p className="text-[10px] text-gray-500 mb-0.5">{selectedLocation.endereco}</p>
              )}
              {selectedLocation.peso != null && (
                <p className="text-[10px] text-gray-500 mb-0.5">Peso: {selectedLocation.peso} kg</p>
              )}
              {selectedLocation.janela && (
                <p className="text-[10px] text-gray-500 mb-0.5">Janela: {selectedLocation.janela}</p>
              )}
              {selectedLocation.motorista && (
                <p className="text-[10px] text-gray-500 mb-0.5">Motorista: {selectedLocation.motorista}</p>
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

      {!modoRoteirizacao && legend && legend.length > 0 && (
        <div className="absolute bottom-4 right-4 bg-slate-900/90 backdrop-blur rounded-lg p-3 z-10 border border-slate-700 max-h-[50%] overflow-y-auto">
          <p className="text-[10px] text-slate-400 uppercase font-semibold mb-2">Rotas / Regiões</p>
          <div className="space-y-1">
            {legend.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-slate-300 truncate max-w-[180px]">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      {!modoRoteirizacao && (
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
          {clusteringEfetivo && (
            <div className="flex items-center gap-2 pt-1 border-t border-slate-700 mt-1">
              <div className="w-3 h-3 rounded-full bg-indigo-500" />
              <span className="text-xs text-slate-300">Cluster</span>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
