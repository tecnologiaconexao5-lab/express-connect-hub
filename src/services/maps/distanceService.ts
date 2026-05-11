// Distance Service - Serviço de cálculo de distância
import type { DistanceResult, Coordinates } from "./types";
import { mapboxProvider } from "./mapboxProvider";
import { geocodificarEndereco } from "./mapboxAutocomplete";

export async function calcularDistancia(
  origem: string | { latitude?: number; longitude?: number; logradouro?: string; cidade?: string; estado?: string },
  destino: string | { latitude?: number; longitude?: number; logradouro?: string; cidade?: string; estado?: string }
): Promise<DistanceResult | null> {
  let origemCoords: Coordinates | null = null;
  let destinoCoords: Coordinates | null = null;
  let origemTexto = "";
  let destinoTexto = "";

  if (typeof origem === "string") {
    origemTexto = origem;
    if (!origem || origem.trim() === "") {
      console.error("[DistanceService] Origem vazia ou não informada");
      return null;
    }
  } else {
    if (origem.latitude && origem.longitude) {
      origemCoords = { lat: origem.latitude, lng: origem.longitude };
    } else if (origem.logradouro && origem.cidade) {
      origemTexto = `${origem.logradouro}, ${origem.cidade}/${origem.estado || "SP"}`;
    } else {
      console.error("[DistanceService] Origem sem coordenadas ou endereço");
      return null;
    }
  }

  if (typeof destino === "string") {
    destinoTexto = destino;
    if (!destino || destino.trim() === "") {
      console.error("[DistanceService] Destino vazio ou não informado");
      return null;
    }
  } else {
    if (destino.latitude && destino.longitude) {
      destinoCoords = { lat: destino.latitude, lng: destino.longitude };
    } else if (destino.logradouro && destino.cidade) {
      destinoTexto = `${destino.logradouro}, ${destino.cidade}/${destino.estado || "SP"}`;
    } else {
      console.error("[DistanceService] Destino sem coordenadas ou endereço");
      return null;
    }
  }

  if (!origemCoords && !origemTexto) {
    console.error("[DistanceService] Origem sem dados");
    return null;
  }

  if (!destinoCoords && !destinoTexto) {
    console.error("[DistanceService] Destino sem dados");
    return null;
  }

  if (origemCoords && destinoCoords) {
    console.log("[DistanceService] Usando coordenadas diretas");
    return mapboxProvider.calcularRotaCoordenadas(origemCoords, destinoCoords);
  }

  if (!origemCoords && origemTexto) {
    const geoOrigem = await geocodificarEndereco(origemTexto);
    if (geoOrigem) {
      origemCoords = geoOrigem.coordinates;
    }
  }
  if (!destinoCoords && destinoTexto) {
    const geoDestino = await geocodificarEndereco(destinoTexto);
    if (geoDestino) {
      destinoCoords = geoDestino.coordinates;
    }
  }

  if (!origemCoords && origemTexto) {
    const geoOrigem = await geocodificarEndereco(origemTexto);
    if (geoOrigem) {
      origemCoords = geoOrigem.coordinates;
    }
  }

  if (origemCoords && destinoCoords) {
    console.log("[DistanceService] Usando coordenadas geocodificadas");
    return mapboxProvider.calcularRotaCoordenadas(origemCoords, destinoCoords);
  }

  if (origemTexto && destinoTexto) {
    console.log("[DistanceService] Usando endereços textuais");
    return mapboxProvider.calcularRota(origemTexto, destinoTexto);
  }

  console.error("[DistanceService] Não foi possível calcular rota");
  return null;
}

export default calcularDistancia;