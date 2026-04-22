// Map Types - Tipos para integração com Mapbox

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface DistanceResult {
  distanciaKm: number;
  duracaoMin: number;
  distanciaTexto: string;
  duracaoTexto: string;
  provider: "mapbox";
}

export interface MapsProvider {
  calcularRota(origem: string, destino: string): Promise<DistanceResult | null>;
}

export interface GeocodingResult {
  coordinates: Coordinates;
  formattedAddress: string;
}

export interface MapboxError {
  message: string;
  code?: string;
}