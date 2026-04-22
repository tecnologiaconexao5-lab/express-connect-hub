// Distance Service - Serviço de cálculo de distância
import type { DistanceResult } from "./types";
import { mapboxProvider } from "./mapboxProvider";

export async function calcularDistancia(
  origem: string,
  destino: string
): Promise<DistanceResult | null> {
  if (!origem || origem.trim() === "") {
    console.error("[DistanceService] Origem vazia ou não informada");
    return null;
  }

  if (!destino || destino.trim() === "") {
    console.error("[DistanceService] Destino vazio ou não informado");
    return null;
  }

  return mapboxProvider.calcularRota(origem.trim(), destino.trim());
}

export default calcularDistancia;