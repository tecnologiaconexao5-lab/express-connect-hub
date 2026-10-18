// Mapbox Provider - Provider para Mapbox API
import type { MapsProvider, DistanceResult, RoutesResult, GeocodingResult, Coordinates } from "./types";

const MAPBOX_GEOCODING_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places";
const MAPBOX_DIRECTIONS_URL = "https://api.mapbox.com/directions/v5/mapbox/driving";

export function getMapboxToken(): string | null {
  const token = 
    import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim() ||
    import.meta.env.VITE_MAPBOX_TOKEN?.trim() ||
    import.meta.env.MAPBOX_ACCESS_TOKEN?.trim() ||
    import.meta.env.MAPBOX_TOKEN?.trim() ||
    null;
  return token;
}

async function geocodificarEndereco(endereco: string, token: string): Promise<GeocodingResult | null> {
  const encodedAddress = encodeURIComponent(endereco);
  const url = `${MAPBOX_GEOCODING_URL}/${encodedAddress}.json?access_token=${token}&limit=1`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`[Mapbox] Erro na geocodificação: status ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      console.error(`[Mapbox] Endereço não encontrado: ${endereco}`);
      return null;
    }

    const feature = data.features[0];
    const [lng, lat] = feature.center;

    return {
      coordinates: { lat, lng },
      formattedAddress: feature.place_name,
    };
  } catch (error) {
    console.error(`[Mapbox] Erro na geocodificação:`, error);
    return null;
  }
}

function formatarDistanceResult(route: any, pedagio?: { valor: number; provider: string }): DistanceResult {
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
      duracaoTexto = minutos === 0 ? `${horas}h` : `${horas}h ${minutos}min`;
    }
    return {
      distanciaKm,
      duracaoMin,
      distanciaTexto,
      duracaoTexto,
      provider: "mapbox" as const,
      // UPGRADE — PEDÁGIO: presente apenas quando a API de pedágios informar o valor.
      ...(typeof pedagio?.valor === "number" && pedagio.valor > 0
        ? { pedagio: pedagio.valor, pedagioProvider: pedagio.provider }
        : {}),
    };
  }

  async function buscarRota(
  origemCoords: Coordinates,
  destinoCoords: Coordinates,
  token: string
): Promise<DistanceResult | null> {
  const { lat: latOrigem, lng: lngOrigem } = origemCoords;
  const { lat: latDestino, lng: lngDestino } = destinoCoords;

  const url = `${MAPBOX_DIRECTIONS_URL}/${lngOrigem},${latOrigem};${lngDestino},${latDestino}.json?access_token=${token}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`[Mapbox] Erro na rota: status ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      console.error(`[Mapbox] Rota não encontrada`);
      return null;
    }

    const route = data.routes[0];

    // UPGRADE — INTEGRAÇÃO DE PEDÁGIO: ponto de plug da API de pedágios.
    // Quando Maplink/Google Routes API for habilitado, faça a consulta aqui e repasse:
    //   const pedagio = await consultarPedagioAPI(origemCoords, destinoCoords); // { valor, provider }
    //   return formatarDistanceResult(route, pedagio);
    // Enquanto isso DistanceResult.pedagio fica undefined e a UI exibe o fallback
    // "Não identificado" com campo de inserção manual rápida.
    return formatarDistanceResult(route);
  } catch (error) {
    console.error(`[Mapbox] Erro ao buscar rota:`, error);
    return null;
  }
}

export const mapboxProvider: MapsProvider = {
  async calcularRota(origem: string, destino: string): Promise<DistanceResult | null> {
    const token = getMapboxToken();

    if (!token) {
      console.error("[Mapbox] Token não configurado. Defina VITE_MAPBOX_ACCESS_TOKEN no .env");
      return null;
    }

    if (!origem || !destino) {
      console.error("[Mapbox] Origem e destino são obrigatórios");
      return null;
    }

    const origemGeocoded = await geocodificarEndereco(origem, token);
    if (!origemGeocoded) {
      console.error(`[Mapbox] Não foi possível geocodificar origem: ${origem}`);
      return null;
    }

    const destinoGeocoded = await geocodificarEndereco(destino, token);
    if (!destinoGeocoded) {
      console.error(`[Mapbox] Não foi possível geocodificar destino: ${destino}`);
      return null;
    }

    const rota = await buscarRota(origemGeocoded.coordinates, destinoGeocoded.coordinates, token);
    if (!rota) {
      console.error("[Mapbox] Não foi possível calcular a rota");
      return null;
    }

    return rota;
  },

  async calcularRotaCoordenadas(origem: Coordinates, destino: Coordinates): Promise<DistanceResult | null> {
    const token = getMapboxToken();

    if (!token) {
      console.error("[Mapbox] Token não configurado");
      return null;
    }

    const rota = await buscarRota(origem, destino, token);
    if (!rota) {
      console.error("[Mapbox] Não foi possível calcular a rota");
      return null;
    }

    return rota;
  },

  async calcularRotasAlternativas(origemCoords: Coordinates, destinoCoords: Coordinates): Promise<RoutesResult> {
    const token = getMapboxToken();
    if (!token) {
      console.error("[Mapbox] Token não configurado para rotas alternativas");
      return { rapida: null, curta: null, operacional: null };
    }
    const { lat: latOrigem, lng: lngOrigem } = origemCoords;
    const { lat: latDestino, lng: lngDestino } = destinoCoords;
    const url = `${MAPBOX_DIRECTIONS_URL}/${lngOrigem},${latOrigem};${lngDestino},${latDestino}.json?access_token=${token}&alternatives=true&language=pt-BR`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`[Mapbox] Erro na rota alternativa: status ${response.status}`);
        return { rapida: null, curta: null, operacional: null };
      }
      const data = await response.json();
      if (!data.routes || data.routes.length === 0) {
        console.error("[Mapbox] Nenhuma rota encontrada");
        return { rapida: null, curta: null, operacional: null };
      }

      const todas = data.routes.map((r: any) => formatarDistanceResult(r));

      const ordenadasPorTempo = [...todas].sort((a, b) => a.duracaoMin - b.duracaoMin);
      const ordenadasPorDist = [...todas].sort((a, b) => a.distanciaKm - b.distanciaKm);

      const rapida = ordenadasPorTempo[0] || null;
      const curta = ordenadasPorDist[0] || null;

      const mesmaRota = rapida && curta && Math.abs(rapida.distanciaKm - curta.distanciaKm) < 0.5;
      const economiaSignificativa = rapida && curta && (rapida.distanciaKm - curta.distanciaKm) > 2 && (curta.duracaoMin - rapida.duracaoMin) < 10;
      const operacional = mesmaRota ? rapida : (economiaSignificativa ? curta : rapida);

      return { rapida, curta, operacional };
    } catch (error) {
      console.error("[Mapbox] Erro ao buscar rotas alternativas:", error);
      return { rapida: null, curta: null, operacional: null };
    }
  },
};

export interface SugestaoEndereco {
  id: string;
  place_name: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  lat: number;
  lng: number;
}

export async function buscarSugestoesEnderecos(query: string): Promise<SugestaoEndereco[]> {
  const token = getMapboxToken();
  if (!token || !query || query.trim().length < 3) return [];

  const encodedQuery = encodeURIComponent(query);
  const url = `${MAPBOX_GEOCODING_URL}/${encodedQuery}.json?access_token=${token}&country=br&autocomplete=true&limit=5`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();

    if (!data.features) return [];

    return data.features.map((feat: any) => {
      const [lng, lat] = feat.center;

      let rua = feat.text || "";
      let numero = feat.address || "";
      let bairro = "";
      let cidade = "";
      let uf = "";
      let cep = "";

      if (feat.context) {
        feat.context.forEach((ctx: any) => {
          if (ctx.id.startsWith("neighborhood")) {
            bairro = ctx.text;
          } else if (ctx.id.startsWith("place")) {
            cidade = ctx.text;
          } else if (ctx.id.startsWith("region")) {
            uf = ctx.short_code ? ctx.short_code.replace("BR-", "") : ctx.text;
          } else if (ctx.id.startsWith("postcode")) {
            cep = ctx.text;
          }
        });
      }

      // Se o text contiver apenas o nome da rua sem número, e o place_name for mais descritivo
      return {
        id: feat.id,
        place_name: feat.place_name,
        rua: rua || feat.place_name.split(",")[0] || "",
        numero: numero || "",
        bairro: bairro,
        cidade: cidade,
        uf: uf,
        cep: cep,
        lat,
        lng
      };
    });
  } catch (err) {
    console.error('[Mapbox] Erro ao buscar sugestoes:', err);
    return [];
  }
}

export default mapboxProvider;