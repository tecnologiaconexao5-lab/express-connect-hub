// ============================================================
// OS MOBILE — rota com múltiplas paradas + retorno à origem.
// Usa Mapbox Directions (waypoints na ordem das paradas) e devolve
// km de ida, km de retorno (última parada → primeira) e duração.
// ============================================================

import type { EnderecoType } from "@/components/ui/EnderecoCompleto";
import { geocodificarEndereco } from "@/services/maps/mapboxAutocomplete";
import { getMapboxToken } from "@/services/maps/mapboxProvider";

const DIRECTIONS_URL = "https://api.mapbox.com/directions/v5/mapbox/driving";

export interface PontoRotaMobile {
  endereco: EnderecoType;
}

export interface RotaMobileResultado {
  kmIda: number;
  kmRetorno: number;
  kmTotal: number;
  duracaoMin: number;
}

interface Coordenada {
  lat: number;
  lng: number;
}

interface DirectionsRoute {
  distance?: number;
  duration?: number;
}

interface DirectionsResponse {
  routes?: DirectionsRoute[];
}

export function montarEnderecoTexto(endereco?: EnderecoType | null): string {
  if (!endereco) return "";
  const linha1 = [endereco.logradouro, endereco.numero].filter(Boolean).join(", ");
  const linha2 = [endereco.bairro, [endereco.cidade, endereco.estado].filter(Boolean).join("/")]
    .filter(Boolean)
    .join(", ");
  return [linha1 || endereco.enderecoFormatado || "", linha2].filter(Boolean).join(" - ");
}

export function enderecoTemCidade(endereco?: EnderecoType | null): boolean {
  return Boolean(endereco?.cidade?.trim() && endereco?.estado?.trim());
}

async function resolverCoordenadas(endereco: EnderecoType): Promise<Coordenada | null> {
  if (
    typeof endereco.latitude === "number" &&
    typeof endereco.longitude === "number" &&
    Number.isFinite(endereco.latitude) &&
    Number.isFinite(endereco.longitude)
  ) {
    return { lat: endereco.latitude, lng: endereco.longitude };
  }

  const texto = montarEnderecoTexto(endereco);
  if (!texto) return null;

  const geo = await geocodificarEndereco(texto);
  return geo?.coordinates || null;
}

async function buscarRota(coordenadas: Coordenada[]): Promise<{ km: number; duracaoMin: number } | null> {
  const token = getMapboxToken();
  if (!token || coordenadas.length < 2) return null;

  const waypoints = coordenadas
    .map((c) => `${c.lng},${c.lat}`)
    .join(";");

  const url =
    `${DIRECTIONS_URL}/${waypoints}.json?access_token=${token}` +
    "&overview=false&steps=false&geometries=geojson";

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[MobileRoute] Mapbox retornou ${response.status}`);
      return null;
    }

    const data = (await response.json()) as DirectionsResponse;
    const rota = data.routes?.[0];
    if (!rota || typeof rota.distance !== "number") return null;

    return {
      km: rota.distance / 1000,
      duracaoMin: Math.round((rota.duration || 0) / 60),
    };
  } catch (error) {
    console.error("[MobileRoute] Erro ao calcular rota:", error);
    return null;
  }
}

/**
 * Calcula a rota completa na ordem das paradas.
 * Quando `retorno` é true, soma separadamente o trecho última parada → primeira.
 */
export async function calcularRotaMobile(
  pontos: PontoRotaMobile[],
  retorno: boolean,
): Promise<RotaMobileResultado | null> {
  if (!Array.isArray(pontos) || pontos.length < 2) return null;
  if (pontos.some((p) => !enderecoTemCidade(p.endereco))) return null;

  const coordenadas = (
    await Promise.all(pontos.map((p) => resolverCoordenadas(p.endereco)))
  ).filter((c): c is Coordenada => Boolean(c));

  if (coordenadas.length !== pontos.length) return null;

  const ida = await buscarRota(coordenadas);
  if (!ida) return null;

  let kmRetorno = 0;
  if (retorno && coordenadas.length >= 2) {
    const volta = await buscarRota([
      coordenadas[coordenadas.length - 1],
      coordenadas[0],
    ]);
    kmRetorno = volta?.km || 0;
  }

  const kmIda = Math.round(ida.km * 100) / 100;
  const kmVolta = Math.round(kmRetorno * 100) / 100;

  return {
    kmIda,
    kmRetorno: kmVolta,
    kmTotal: Math.round((kmIda + kmVolta) * 100) / 100,
    duracaoMin: ida.duracaoMin,
  };
}
