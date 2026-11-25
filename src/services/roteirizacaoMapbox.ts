interface Coordinates {
  lat: number;
  lng: number;
}

import { getMapboxToken } from "@/lib/mapboxToken";

const MAPBOX_DIRECTIONS_URL = "https://api.mapbox.com/directions/v5/mapbox/driving";
const OSRM_ROUTE_URL = "https://router.project-osrm.org/route/v1/driving";

/** Mapbox Directions aceita até 25 waypoints; OSRM demo também fica seguro em 25. */
const MAX_WAYPOINTS = 25;

/** Fator de tortuosidade urbana para a malha viária estimada (calibrado SP/Grande SP). */
export const TORTUOSIDADE_URBANA = 1.35;
/** Velocidade média urbana usada na estimativa Haversine calibrada. */
export const VELOCIDADE_MEDIA_URBANA_KMH = 28;
/** Tempo médio de serviço por parada (min). */
export const TEMPO_MEDIO_PARADA_MIN = 10;

/**
 * Mapbox Directions multi-ponto (chunks de 25 waypoints, com continuidade entre
 * blocos). Devolve null quando o Mapbox não responde de forma alguma.
 */
async function buscarRotaMapboxMulti(
  pontos: Coordinates[],
  token: string,
): Promise<{ distanciaKm: number; duracaoMin: number; coordinates: [number, number][] } | null> {
  if (pontos.length < 2) return null;

  let distanciaMetros = 0;
  let duracaoSegundos = 0;
  const coordinates: [number, number][] = [];
  let sucessos = 0;

  for (let i = 0; i < pontos.length - 1; i += MAX_WAYPOINTS - 1) {
    const trecho = pontos.slice(i, Math.min(i + MAX_WAYPOINTS, pontos.length));
    if (trecho.length < 2) break;

    const coordsStr = trecho.map(p => `${p.lng},${p.lat}`).join(";");
    const url =
      `${MAPBOX_DIRECTIONS_URL}/${coordsStr}.json?access_token=${token}` +
      `&overview=full&geometries=geojson&continue_straight=false`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (sucessos === 0) return null;
        break;
      }
      const data = await response.json();
      const route = data?.routes?.[0];
      if (!route) {
        if (sucessos === 0) return null;
        break;
      }
      distanciaMetros += Number(route.distance) || 0;
      duracaoSegundos += Number(route.duration) || 0;
      if (Array.isArray(route.geometry?.coordinates)) {
        coordinates.push(...route.geometry.coordinates);
      }
      sucessos++;
    } catch (erro) {
      console.warn(
        "[Roteirizacao Mapbox] Falha no directions multi-ponto:",
        erro instanceof Error ? erro.message : erro,
      );
      if (sucessos === 0) return null;
      break;
    }
  }

  if (sucessos === 0) return null;
  return {
    distanciaKm: distanciaMetros / 1000,
    duracaoMin: duracaoSegundos / 60,
    coordinates,
  };
}

/**
 * OSRM público (malha viária real e gratuita) — usado quando o Mapbox não
 * responde. Também processa em chunks de 25 pontos.
 */
async function buscarRotaOsrmMulti(
  pontos: Coordinates[],
): Promise<{ distanciaKm: number; duracaoMin: number; coordinates: [number, number][] } | null> {
  if (pontos.length < 2) return null;

  let distanciaMetros = 0;
  let duracaoSegundos = 0;
  const coordinates: [number, number][] = [];
  let sucessos = 0;

  for (let i = 0; i < pontos.length - 1; i += MAX_WAYPOINTS - 1) {
    const trecho = pontos.slice(i, Math.min(i + MAX_WAYPOINTS, pontos.length));
    if (trecho.length < 2) break;

    const coordsStr = trecho.map(p => `${p.lng},${p.lat}`).join(";");
    const url = `${OSRM_ROUTE_URL}/${coordsStr}?overview=full&geometries=geojson&steps=false`;

    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        if (sucessos === 0) return null;
        break;
      }
      const data = await response.json();
      const route = data?.routes?.[0];
      if (!route) {
        if (sucessos === 0) return null;
        break;
      }
      distanciaMetros += Number(route.distance) || 0;
      duracaoSegundos += Number(route.duration) || 0;
      if (Array.isArray(route.geometry?.coordinates)) {
        coordinates.push(...route.geometry.coordinates);
      }
      sucessos++;
    } catch (erro) {
      console.warn(
        "[Roteirizacao OSRM] Falha na rota:",
        erro instanceof Error ? erro.message : erro,
      );
      if (sucessos === 0) return null;
      break;
    }
  }

  if (sucessos === 0) return null;
  return {
    distanciaKm: distanciaMetros / 1000,
    duracaoMin: duracaoSegundos / 60,
    coordinates,
  };
}

export interface CalculoRotaInput {
  latitude?: number;
  longitude?: number;
}

export interface OpcoesCalculoRota {
  /** Quando true, soma o trecho de volta à origem (ida e volta à base). */
  comRetorno?: boolean;
}

/** (0,0) e coordenadas fora de faixa NAO sao coordenadas validas. */
export function temCoordenadaValida(lat?: number, lng?: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    Number(lat) !== 0 && Number(lng) !== 0 &&
    Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180;
}

function montarListaPontos(
  paradas: CalculoRotaInput[],
  origemCoords: Coordinates | undefined,
  comRetorno: boolean,
): Coordinates[] {
  const pontos: Coordinates[] = [];
  const temOrigem = Boolean(
    origemCoords && temCoordenadaValida(origemCoords.lat, origemCoords.lng),
  );
  if (temOrigem && origemCoords) {
    pontos.push({ lat: origemCoords.lat, lng: origemCoords.lng });
  }
  for (const p of paradas) {
    if (temCoordenadaValida(p.latitude, p.longitude)) {
      pontos.push({ lat: Number(p.latitude), lng: Number(p.longitude) });
    }
  }
  if (comRetorno && temOrigem && origemCoords && pontos.length >= 2) {
    pontos.push({ lat: origemCoords.lat, lng: origemCoords.lng });
  }
  return pontos;
}

function estimarHaversineCalibrado(
  pontos: Coordinates[],
  paradas: CalculoRotaInput[],
  alertas: string[],
): {
  distanciaTotalKm: number;
  tempoTotalMinutos: number;
  origemCalculo: 'estimativa_local';
  alertas: string[];
  routeCoordinates?: [number, number][];
} {
  let distancia = 0;
  for (let i = 1; i < pontos.length; i++) {
    distancia += calcularDistanciaHaversine(
      pontos[i - 1].lat,
      pontos[i - 1].lng,
      pontos[i].lat,
      pontos[i].lng,
    );
  }
  const distanciaCalibrada = distancia * TORTUOSIDADE_URBANA;
  const tempoDeslocamento = (distanciaCalibrada / VELOCIDADE_MEDIA_URBANA_KMH) * 60;
  const tempoServico = paradas.length * TEMPO_MEDIO_PARADA_MIN;
  const routeCoordinates = pontos.map(p => [p.lng, p.lat] as [number, number]);

  alertas.push(
    `Estimativa Haversine calibrada (${TORTUOSIDADE_URBANA}x · ${VELOCIDADE_MEDIA_URBANA_KMH} km/h · ${TEMPO_MEDIO_PARADA_MIN} min/parada).`,
  );

  // Garante distância > 0 quando existe origem + paradas (nunca "0 km").
  const distanciaFinal = distanciaCalibrada > 0.05
    ? distanciaCalibrada
    : Math.max(0.5, paradas.length * 0.5);

  return {
    distanciaTotalKm: Math.round(distanciaFinal * 10) / 10,
    tempoTotalMinutos: Math.round(tempoDeslocamento + tempoServico),
    origemCalculo: 'estimativa_local',
    alertas,
    routeCoordinates,
  };
}

export const calcularDistanciaTempoRota = async (
  paradas: CalculoRotaInput[],
  origemCoords?: Coordinates,
  opcoes?: OpcoesCalculoRota,
): Promise<{
  distanciaTotalKm: number;
  tempoTotalMinutos: number;
  origemCalculo: 'mapbox' | 'osrm' | 'estimativa_local';
  alertas: string[];
  routeCoordinates?: [number, number][];
}> => {
  const token = getMapboxToken();
  const alertas: string[] = [];
  const comRetorno = Boolean(opcoes?.comRetorno);

  const pontos = montarListaPontos(paradas, origemCoords, comRetorno);

  // Sem pontos suficientes para traçar malha viária: fallback determinístico.
  if (pontos.length < 2) {
    alertas.push("Coordenadas insuficientes para traçar a rota");
    alertas.push("Usando estimativa local por paradas");
    const total = Math.max(paradas.length, 1);
    return {
      distanciaTotalKm: Math.round(5 * total * 10) / 10,
      tempoTotalMinutos: Math.round(10 * total),
      origemCalculo: 'estimativa_local',
      alertas,
    };
  }

  // Camada 1 — Mapbox Directions (multi-ponto).
  if (token) {
    const mapbox = await buscarRotaMapboxMulti(pontos, token);
    if (mapbox && mapbox.distanciaKm > 0) {
      alertas.push(
        `Rota via Mapbox Directions: ${pontos.length} ponto(s)${comRetorno ? " · ida e volta" : ""}.`,
      );
      return {
        distanciaTotalKm: Math.round(mapbox.distanciaKm * 10) / 10,
        tempoTotalMinutos: Math.round(mapbox.duracaoMin),
        origemCalculo: 'mapbox',
        alertas,
        routeCoordinates: mapbox.coordinates,
      };
    }
    alertas.push("Mapbox Directions não respondeu — tentando OSRM.");
  }

  // Camada 2 — OSRM público (malha viária real e gratuita).
  const osrm = await buscarRotaOsrmMulti(pontos);
  if (osrm && osrm.distanciaKm > 0) {
    alertas.push(
      `Rota via OSRM (malha viária real): ${pontos.length} ponto(s)${comRetorno ? " · ida e volta" : ""}.`,
    );
    return {
      distanciaTotalKm: Math.round(osrm.distanciaKm * 10) / 10,
      tempoTotalMinutos: Math.round(osrm.duracaoMin),
      origemCalculo: 'osrm',
      alertas,
      routeCoordinates: osrm.coordinates,
    };
  }
  alertas.push("OSRM indisponível — usando Haversine calibrado.");

  // Camada 3 — Haversine calibrado (1.35x) entre paradas/origem.
  return estimarHaversineCalibrado(pontos, paradas, alertas);
};

export const calcularDistanciaHaversine = (
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export interface CoordenadaGeocodificada {
  latitude: number;
  longitude: number;
}

/**
 * Geocoding real: Mapbox Geocoding API (se token) e fallback Nominatim (OSM).
 * Retorna null quando nao encontrar — nunca inventa coordenadas.
 */
export async function geocodificarEndereco(
  endereco: string,
): Promise<CoordenadaGeocodificada | null> {
  const query = String(endereco || "").trim();
  if (!query) return null;

  const token = getMapboxToken();
  if (token) {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${
        encodeURIComponent(query)
      }.json?access_token=${token}&country=br&limit=1&language=pt&proximity=-46.6333,-23.5505`;
      const resposta = await fetch(url);
      if (resposta.ok) {
        const dados = await resposta.json();
        const centro = dados?.features?.[0]?.center;
        if (Array.isArray(centro) && centro.length === 2) {
          const latitude = Number(centro[1]);
          const longitude = Number(centro[0]);
          if (temCoordenadaValida(latitude, longitude)) {
            return { latitude, longitude };
          }
        }
      }
    } catch (erro) {
      console.warn(
        "[Roteirizacao Mapbox] Falha no geocoding:",
        erro instanceof Error ? erro.message : erro,
      );
    }
  }

  try {
    const url =
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${
        encodeURIComponent(query)
      }`;
    const resposta = await fetch(url, {
      headers: { "Accept": "application/json" },
    });
    if (resposta.ok) {
      const dados = await resposta.json();
      const item = Array.isArray(dados) ? dados[0] : null;
      if (item?.lat && item?.lon) {
        const latitude = Number(item.lat);
        const longitude = Number(item.lon);
        if (temCoordenadaValida(latitude, longitude)) {
          return { latitude, longitude };
        }
      }
    }
  } catch (erro) {
    console.warn(
      "[Roteirizacao] Falha no Nominatim:",
      erro instanceof Error ? erro.message : erro,
    );
  }

  return null;
}

export default {
  calcularDistanciaTempoRota,
  calcularDistanciaHaversine,
  geocodificarEndereco,
  temCoordenadaValida,
};
