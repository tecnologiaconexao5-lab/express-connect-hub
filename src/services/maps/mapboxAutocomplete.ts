// Mapbox Geocoding Autocomplete Service
import { Coordinates } from "./types";

const MAPBOX_GEOCODING_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places";

export interface MapboxSuggestion {
  id: string;
  place_name: string;
  place_type: string[];
  address?: string;
  text: string;
  center?: [number, number];
  context?: Array<{ id: string; text: string }>;
  geometry?: {
    type: string;
    coordinates: [number, number];
  };
}

export interface MapboxGeocodingResult {
  suggestions: MapboxSuggestion[];
  error?: string;
}

function getMapboxToken(): string | null {
  const token = 
    import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim() ||
    import.meta.env.VITE_MAPBOX_TOKEN?.trim() ||
    import.meta.env.MAPBOX_ACCESS_TOKEN?.trim() ||
    import.meta.env.MAPBOX_TOKEN?.trim() ||
    null;
  return token;
}

export async function buscarEnderecos(
  query: string,
  options?: {
    limit?: number;
    tipos?: string[];
    proximidade?: string; // "lng,lat" para proximity
  }
): Promise<MapboxGeocodingResult> {
  const token = getMapboxToken();
  
  if (!token) {
    console.warn("[Mapbox Autocomplete] Token não configurado");
    return { suggestions: [], error: "Token Mapbox não configurado" };
  }

  if (!query || query.length < 3) {
    return { suggestions: [] };
  }

  try {
    const PROXIMIDADE_SAO_PAULO = "-46.6333,-23.5505";
    const proximidade = options?.proximidade || PROXIMIDADE_SAO_PAULO;

    const params = new URLSearchParams({
      access_token: token,
      limit: String(options?.limit || 10), // Aumentado para permitir sorting melhor
      types: options?.tipos?.join(",") || "address,place,locality,neighborhood,postcode",
      country: "br",
      language: "pt-BR",
      proximity: proximidade,
    });

    const encodedQuery = encodeURIComponent(query);
    const url = `${MAPBOX_GEOCODING_URL}/${encodedQuery}.json?${params.toString()}`;

    const response = await fetch(url);

    if (!response.ok) {
      console.error("[Mapbox Autocomplete] Erro na requisição:", response.status);
      return { suggestions: [], error: "Erro ao buscar endereços" };
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      return { suggestions: [] };
    }

    let suggestions: MapboxSuggestion[] = data.features.map((feature: any) => ({
      id: feature.id,
      place_name: feature.place_name,
      place_type: feature.place_type || [],
      address: feature.address,
      text: feature.text,
      center: feature.center,
      geometry: feature.geometry,
      context: feature.context,
    }));

    // Ordenação defensiva para priorizar São Paulo
    suggestions = suggestions.sort((a, b) => {
      const aIsSP = a.place_name.toLowerCase().includes("são paulo") || a.place_name.includes(", SP");
      const bIsSP = b.place_name.toLowerCase().includes("são paulo") || b.place_name.includes(", SP");
      
      if (aIsSP && !bIsSP) return -1;
      if (!aIsSP && bIsSP) return 1;
      return 0;
    });

    // Cortar para o limite original solicitado
    return { suggestions: suggestions.slice(0, options?.limit || 5) };
  } catch (error) {
    console.error("[Mapbox Autocomplete] Erro:", error);
    return { suggestions: [], error: "Erro ao conectar com Mapbox" };
  }
}

export async function geocodificarEndereco(
  endereco: string
): Promise<{ coordinates: Coordinates; formattedAddress: string } | null> {
  const token = getMapboxToken();

  if (!token) {
    console.warn("[Mapbox Geocoding] Token não configurado");
    return null;
  }

  if (!endereco) {
    return null;
  }

  try {
    const params = new URLSearchParams({
      access_token: token,
      limit: "1",
      country: "br",
      language: "pt-BR",
    });

    const encodedAddress = encodeURIComponent(endereco);
    const url = `${MAPBOX_GEOCODING_URL}/${encodedAddress}.json?${params.toString()}`;

    const response = await fetch(url);

    if (!response.ok) {
      console.error("[Mapbox Geocoding] Erro:", response.status);
      return null;
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      return null;
    }

    const feature = data.features[0];
    const [lng, lat] = feature.center;

    return {
      coordinates: { lat, lng },
      formattedAddress: feature.place_name,
    };
  } catch (error) {
    console.error("[Mapbox Geocoding] Erro:", error);
    return null;
  }
}

export function extrairDadosDaSuggestion(
  suggestion: MapboxSuggestion
): {
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep?: string;
  latitude?: number;
  longitude?: number;
  enderecoFormatado: string;
  mapboxPlaceId: string;
} {
  const context = suggestion.context || [];
  
  const findContext = (type: string) => {
    const item = context.find(c => c.id.startsWith(type));
    return item?.text;
  };

  const cep = findContext("postcode");
  const cidade = findContext("place") || findContext("locality") || "";
  const estado = findContext("region") || "";
  const bairro = findContext("neighborhood") || suggestion.text;
  
  const logradouro = suggestion.address 
    ? `${suggestion.text}, ${suggestion.address}`
    : suggestion.text;

  let numero = "";
  if (suggestion.place_type.includes("address") && suggestion.address) {
    numero = suggestion.address;
  }

  let latitude: number | undefined;
  let longitude: number | undefined;
  
  if (suggestion.center) {
    longitude = suggestion.center[0];
    latitude = suggestion.center[1];
  } else if (suggestion.geometry?.coordinates) {
    longitude = suggestion.geometry.coordinates[0];
    latitude = suggestion.geometry.coordinates[1];
  }

  return {
    logradouro,
    numero,
    bairro,
    cidade,
    estado,
    cep,
    latitude,
    longitude,
    enderecoFormatado: suggestion.place_name,
    mapboxPlaceId: suggestion.id,
  };
}

export const mapboxAutocomplete = {
  buscar: buscarEnderecos,
  geocodificar: geocodificarEndereco,
  extrairDados: extrairDadosDaSuggestion,
};

export default mapboxAutocomplete;