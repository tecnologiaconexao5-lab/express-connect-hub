// Distance Service - Serviço de cálculo de distância
import type { DistanceResult, Coordinates, RoutesResult } from "./types";
import { mapboxProvider } from "./mapboxProvider";
import { geocodificarEndereco } from "./mapboxAutocomplete";

/**
 * Ponto aceito pelos cálculos de rota: string livre OU o endereço completo
 * (Rua/Número/Bairro/Cidade/UF/CEP) com coordenadas opcionais.
 * As coordenadas têm prioridade; sem elas, o texto completo é geocodificado.
 */
export type PontoRota =
  | string
  | {
      latitude?: number | null;
      longitude?: number | null;
      logradouro?: string | null;
      numero?: string | null;
      bairro?: string | null;
      cidade?: string | null;
      estado?: string | null;
      uf?: string | null;
      cep?: string | null;
      endereco?: string | null;
    };

const numeroValido = (valor: unknown): number | null => {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) && n !== 0 ? n : null;
};

const contem = (texto: string, trecho: string): boolean =>
  Boolean(trecho) && texto.toLowerCase().includes(trecho.toLowerCase());

/**
 * Monta a string completa para a API de mapas:
 * "Rua, Número, Bairro, Cidade - UF, CEP" — sem duplicar o que já estiver
 * no campo `endereco`. Nunca devolve só a cidade/CEP quando há dados
 * desmembrados disponíveis.
 */
export function montarTextoLivreEndereco(ponto: PontoRota): string {
  if (typeof ponto === "string") return ponto.trim();
  const base = String(ponto.endereco || "").trim();
  const rua = String(ponto.logradouro || "").trim();
  const numero = String(ponto.numero || "").trim();
  const bairro = String(ponto.bairro || "").trim();
  const cidade = String(ponto.cidade || "").trim();
  const uf = String(ponto.estado || ponto.uf || "").trim();
  const cep = String(ponto.cep || "").trim();

  const linhaRua = rua ? [rua, numero].filter(Boolean).join(", ") : base;
  const partes = [linhaRua];
  if (bairro && !contem(linhaRua, bairro)) partes.push(bairro);
  if (cidade) {
    const cidadeUf = uf ? `${cidade} - ${uf}` : cidade;
    if (!contem(linhaRua, cidade)) partes.push(cidadeUf);
  } else if (uf && !contem(linhaRua, uf)) {
    partes.push(uf);
  }
  if (cep && !contem(linhaRua, cep)) partes.push(cep);
  return partes.filter(Boolean).join(", ").trim() || base;
}

async function resolverPonto(ponto: PontoRota): Promise<Coordinates | null> {
  if (typeof ponto !== "string") {
    const lat = numeroValido(ponto.latitude);
    const lng = numeroValido(ponto.longitude);
    if (lat !== null && lng !== null) return { lat, lng };
  }
  const texto = montarTextoLivreEndereco(ponto);
  if (!texto) return null;
  const geo = await geocodificarEndereco(texto);
  return geo?.coordinates ?? null;
}

export async function calcularDistancia(
  origem: PontoRota,
  destino: PontoRota
): Promise<DistanceResult | null> {
  const origemCoords = await resolverPonto(origem);
  if (!origemCoords) {
    console.error("[DistanceService] Não foi possível resolver a origem");
    return null;
  }
  const destinoCoords = await resolverPonto(destino);
  if (!destinoCoords) {
    console.error("[DistanceService] Não foi possível resolver o destino");
    return null;
  }

  return mapboxProvider.calcularRotaCoordenadas(origemCoords, destinoCoords);
}

export async function calcularRotasAlternativas(
  origem: PontoRota,
  destino: PontoRota
): Promise<RoutesResult | null> {
  const origemCoords = await resolverPonto(origem);
  if (!origemCoords) {
    console.error("[DistanceService] Não foi possível geocodificar a origem para alternativas");
    return null;
  }
  const destinoCoords = await resolverPonto(destino);
  if (!destinoCoords) {
    console.error("[DistanceService] Não foi possível geocodificar o destino para alternativas");
    return null;
  }

  return mapboxProvider.calcularRotasAlternativas(origemCoords, destinoCoords);
}

export default calcularDistancia;
