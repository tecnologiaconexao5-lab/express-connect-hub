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
  /**
   * UPGRADE — INTEGRAÇÃO DE PEDÁGIO (payload preparado).
   * Valor monetário do pedágio da rota (R$), retornado pela API de pedágios quando
   * disponível (ex.: Maplink Toll API ou Google Routes API com tolls).
   * Opcional: o Mapbox Directions não retorna pedágio — nesse caso permanece undefined
   * e o operador informa o valor manualmente no resumo da rota.
   */
  pedagio?: number;
  /** Identificação do provider que calculou o pedágio (ex.: "maplink", "google_routes"). */
  pedagioProvider?: string;
}

/**
 * UPGRADE — INTEGRAÇÃO DE PEDÁGIO (estado/payload).
 * Estrutura de estado que acompanha o campo pedágio da OS para rastrear a origem
 * do valor: retornado por API, digitado manualmente ou ainda não identificado.
 */
export type FontePedagio = "nao_identificado" | "api" | "manual";

export interface PedagioInfo {
  fonte: FontePedagio;
  /** Provider que informou o pedágio quando fonte === "api". */
  provider?: string;
  /** ISO timestamp da última atualização do valor. */
  atualizadoEm?: string;
}

export type TipoRota = "rapida" | "curta" | "operacional";

export interface RoutesResult {
  rapida: DistanceResult | null;
  curta: DistanceResult | null;
  operacional: DistanceResult | null;
}

export interface MapsProvider {
  calcularRota(origem: string, destino: string): Promise<DistanceResult | null>;
  calcularRotaCoordenadas(origem: Coordinates, destino: Coordinates): Promise<DistanceResult | null>;
  calcularRotasAlternativas(origemCoords: Coordinates, destinoCoords: Coordinates): Promise<RoutesResult>;
}

export interface GeocodingResult {
  coordinates: Coordinates;
  formattedAddress: string;
}

export interface MapboxError {
  message: string;
  code?: string;
}