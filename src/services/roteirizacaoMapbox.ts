import { Coordinates, DistanceResult } from "./types";

const MAPBOX_DIRECTIONS_URL = "https://api.mapbox.com/directions/v5/mapbox/driving";

function getMapboxToken(): string | null {
  const token = 
    import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim() ||
    import.meta.env.VITE_MAPBOX_TOKEN?.trim() ||
    import.meta.env.MAPBOX_ACCESS_TOKEN?.trim() ||
    import.meta.env.MAPBOX_TOKEN?.trim() ||
    null;
  return token;
}

async function buscarRotaMapbox(
  origemCoords: Coordinates,
  destinoCoords: Coordinates,
  token: string
): Promise<DistanceResult | null> {
  const { lat: latOrigem, lng: lngOrigem } = origemCoords;
  const { lat: latDestino, lng: lngDestino } = destinoCoords;

  const url = `${MAPBOX_DIRECTIONS_URL}/${lngOrigem},${latOrigem};${lngDestino},${latDestino}.json?access_token=${token}&overview=simplified`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`[Roteirizacao Mapbox] Erro na rota: status ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      console.error(`[Roteirizacao Mapbox] Rota não encontrada`);
      return null;
    }

    const route = data.routes[0];
    const distance = route.distance;
    const duration = route.duration;

    const distanciaKm = distance / 1000;
    const duracaoMin = Math.round(duration / 60);

    const distanciaTexto = distanciaKm.toFixed(1).replace(".", ",") + " km";
    
    let duracaoTexto: string;
    if (duracaoMin < 60) {
      duracaoTexto = `${duracaoMin} min`;
    } else {
      const horas = Math.floor(duracaoMin / 60);
      const minutos = duracaoMin % 60;
      if (minutos === 0) {
        duracaoTexto = `${horas}h`;
      } else {
        duracaoTexto = `${horas}h ${minutos}min`;
      }
    }

    return {
      distanciaKm,
      duracaoMin,
      distanciaTexto,
      duracaoTexto,
      provider: "mapbox",
    };
  } catch (error) {
    console.error(`[Roteirizacao Mapbox] Erro ao buscar rota:`, error);
    return null;
  }
}

export interface CalculoRotaInput {
  latitude?: number;
  longitude?: number;
}

const MAX_PONTOS_POR_BLOCO = 10;

export const calcularDistanciaTempoRota = async (
  paradas: CalculoRotaInput[],
  origemCoords?: Coordinates
): Promise<{
  distanciaTotalKm: number;
  tempoTotalMinutos: number;
  origemCalculo: 'mapbox' | 'estimativa_local';
  alertas: string[];
}> => {
  const token = getMapboxToken();
  const alertas: string[] = [];

  const paradasComCoords = paradas.filter(
    p => p.latitude !== undefined && p.longitude !== undefined
  );

  if (!token || paradasComCoords.length < 2) {
    alertas.push("Mapbox não disponível ou coordenadas insuficientes");
    alertas.push("Usando estimativa local por falta de coordenadas");

    const kmBase = 5;
    const minBase = 10;
    const distanciaTotal = kmBase * paradas.length;
    const tempoTotal = minBase * paradas.length;

    return {
      distanciaTotalKm: Math.round(distanciaTotal * 10) / 10,
      tempoTotalMinutos: Math.round(tempoTotal),
      origemCalculo: 'estimativa_local',
      alertas,
    };
  }

  let distanciaTotal = 0;
  let tempoTotal = 0;
  const blocos: CalculoRotaInput[][] = [];

  for (let i = 0; i < paradasComCoords.length; i += MAX_PONTOS_POR_BLOCO) {
    blocos.push(paradasComCoords.slice(i, i + MAX_PONTOS_POR_BLOCO));
  }

  let pontosProcessados = 0;

  for (const bloco of blocos) {
    if (bloco.length < 2) continue;

    const origemIdx = pontosProcessados;
    const destinoUltimo = bloco[bloco.length - 1];

    if (!origemCoords && origemIdx > 0) {
      const origemAnterior = paradasComCoords[origemIdx - 1];
      if (!origemAnterior.latitude || !origemAnterior.longitude) continue;

      const resultado = await buscarRotaMapbox(
        { lat: origemAnterior.latitude, lng: origemAnterior.longitude },
        { lat: destinoUltimo.latitude!, lng: destinoUltimo.longitude! },
        token
      );

      if (resultado) {
        distanciaTotal += resultado.distanciaKm;
        tempoTotal += resultado.duracaoMin;
      }
    } else if (origemCoords) {
      const primeiraParada = bloco[0];
      if (!primeiraParada.latitude || !primeiraParada.longitude) continue;

      const resultado = await buscarRotaMapbox(
        origemCoords,
        { lat: primeiraParada.latitude, lng: primeiraParada.longitude },
        token
      );

      if (resultado) {
        distanciaTotal += resultado.distanciaKm;
        tempoTotal += resultado.duracaoMin;
      }
    }

    for (let i = 0; i < bloco.length - 1; i++) {
      const p1 = bloco[i];
      const p2 = bloco[i + 1];

      if (!p1.latitude || !p1.longitude || !p2.latitude || !p2.longitude) continue;

      const resultado = await buscarRotaMapbox(
        { lat: p1.latitude, lng: p1.longitude },
        { lat: p2.latitude, lng: p2.longitude },
        token
      );

      if (resultado) {
        distanciaTotal += resultado.distanciaKm;
        tempoTotal += resultado.duracaoMin;
      }
    }

    pontosProcessados += bloco.length;

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  if (distanciaTotal === 0) {
    alertas.push("Mapbox não retornou resultados");
    alertas.push("Usando estimativa local");

    const kmBase = 5;
    const minBase = 10;
    return {
      distanciaTotalKm: Math.round(kmBase * paradas.length * 10) / 10,
      tempoTotalMinutos: Math.round(minBase * paradas.length),
      origemCalculo: 'estimativa_local',
      alertas,
    };
  }

  alertas.push(`Calculo via Mapbox: ${paradasComCoords.length} pontos processados em ${blocos.length} blocos`);

  return {
    distanciaTotalKm: Math.round(distanciaTotal * 10) / 10,
    tempoTotalMinutos: Math.round(tempoTotal),
    origemCalculo: 'mapbox',
    alertas,
  };
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

export default {
  calcularDistanciaTempoRota,
  calcularDistanciaHaversine,
};