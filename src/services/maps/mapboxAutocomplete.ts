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
  context?: Array<{ id: string; text: string; short_code?: string }>;
  geometry?: {
    type: string;
    coordinates: [number, number];
  };
  /** Formato Google/Places (quando disponível) — usado para bairro/CEP exatos. */
  address_components?: Array<{
    long_name?: string;
    short_name?: string;
    types?: string[];
    /** Place Types (v1) também podem vir como strings soltas. */
    [k: string]: unknown;
  }>;
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

// ============================================================
// FIX-CRITICO-AUTOCOMPLETE-CEP-BAIRRO
// Helpers de CEP: o Mapbox pode retornar o `postcode` PARCIAL (ex.: "05016"
// — só o prefixo de 5 dígitos). CEP parcial NUNCA deve ser aceito como final.
// ============================================================
const somentesDigitos = (v: unknown): string => String(v ?? "").replace(/\D/g, "");

/** true somente com CEP completo (8 dígitos). */
export const cepCompleto = (v: unknown): boolean => somentesDigitos(v).length === 8;

/** Formata 8 dígitos em "00000-000"; vazio se incompleto. */
export const formatarCep = (v: unknown): string => {
  const d = somentesDigitos(v);
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : "";
};

/** Prefixo de 5 dígitos de um CEP (completo ou parcial). */
const prefixoCep = (v: unknown): string => somentesDigitos(v).slice(0, 5);

const textoLimpo = (v: unknown): string => String(v ?? "").trim();

/**
 * Mapeia o bairro a partir dos `address_components` (Google/Places),
 * iterando na ordem exigida: sublocality_level_1 → sublocality → neighborhood.
 */
function bairroDeAddressComponents(components?: MapboxSuggestion["address_components"]): string {
  if (!Array.isArray(components)) return "";
  const ordem = [
    "sublocality_level_1",
    "sublocality",
    "neighborhood",
    "neighbourhood",
    "administrative_area_level_4",
    "administrative_area_level_3",
  ];
  for (const tipo of ordem) {
    const comp = components.find((c) => (c?.types || []).includes(tipo));
    const valor = textoLimpo(comp?.long_name || comp?.short_name);
    if (valor) return valor;
  }
  return "";
}

function componentePorTipo(
  components: MapboxSuggestion["address_components"] | undefined,
  tipos: string[],
): string {
  if (!Array.isArray(components)) return "";
  const comp = components.find((c) => (c?.types || []).some((t) => tipos.includes(t)));
  return textoLimpo(comp?.long_name || comp?.short_name);
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
  /** Prefixo de 5 dígitos quando o CEP completo não está disponível. */
  cepPrefixo?: string;
  latitude?: number;
  longitude?: number;
  enderecoFormatado: string;
  mapboxPlaceId: string;
} {
  const context = suggestion.context || [];
  const components = suggestion.address_components;

  const findContext = (type: string) => {
    const item = context.find((c) => c.id.startsWith(type));
    return item?.text;
  };

  // CEP — aceita apenas 8 dígitos (Guarda o prefixo parcial para o fallback ViaCEP).
  const cepCtxBruto =
    componentePorTipo(components, ["postal_code"]) || findContext("postcode") || "";
  const cep = cepCompleto(cepCtxBruto) ? formatarCep(cepCtxBruto) : undefined;
  const cepPref = prefixoCep(cepCtxBruto) || undefined;

  const cidade =
    componentePorTipo(components, ["administrative_area_level_2", "locality", "postal_town"]) ||
    findContext("place") ||
    findContext("locality") ||
    "";

  const regCtx = context.find((c) => c.id.startsWith("region"));
  const estadoComp = componentePorTipo(components, ["administrative_area_level_1"]);
  const estadoShortComp =
    (components || []).find((c) =>
      (c?.types || []).includes("administrative_area_level_1"),
    )?.short_name || "";
  const estado = estadoShortComp
    ? estadoShortComp.slice(0, 2).toUpperCase()
    : regCtx && regCtx.short_code
      ? regCtx.short_code.replace("BR-", "")
      : estadoComp
        ? estadoComp.slice(0, 2).toUpperCase()
        : regCtx?.text?.substring(0, 2) || "";

  // BAIRRO — fallbacks (address_components primeiro; depois context do Mapbox).
  const bairro =
    bairroDeAddressComponents(components) ||
    findContext("neighborhood") ||
    findContext("suburb") ||
    findContext("district") ||
    findContext("sublocality") ||
    "";

  const logradouro =
    componentePorTipo(components, ["route", "street_address"]) || suggestion.text || "";

  let numero = "";
  if (suggestion.place_type.includes("address") && suggestion.address) {
    numero = suggestion.address;
  } else {
    numero = componentePorTipo(components, ["street_number"]);
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
    cepPrefixo: cep ? undefined : cepPref,
    latitude,
    longitude,
    enderecoFormatado: suggestion.place_name,
    mapboxPlaceId: suggestion.id,
  };
}

// ============================================================
// FIX-AUTOCOMPLETE-E-NOVO-TEMPLATE-WHATSAPP
// Ao selecionar uma sugestão, o Mapbox nem sempre traz CEP/bairro/
// cidade/UF no `context` (comum no Brasil). Estas funções complementam
// os campos que faltam com 2 camadas de fallback:
//   1) parsing do próprio place_name ("Rua X, Bairro, Cidade, SP 01310-100, Brasil")
//   2) reverse geocoding nas coordenadas do centro da sugestão
// ============================================================

const UFS_BR = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
]);

export interface DadosEnderecoComplementares {
  cep?: string;
  /** Prefixo de 5 dígitos (quando só o CEP parcial está disponível). */
  cepPrefixo?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
}

/**
 * Fallback 1 — extrai bairro/cidade/UF/CEP do próprio place_name do Mapbox.
 * Formato pt-BR: "Rua das Flores, Vila Madalena, São Paulo, SP 01310-100, Brasil"
 */
export function extrairDadosDePlaceName(
  placeName: string,
  textoPrincipal?: string
): DadosEnderecoComplementares {
  const resultado: DadosEnderecoComplementares = {};
  const bruto = String(placeName || "");
  if (!bruto.trim()) return resultado;

  // CEP completo (8 dígitos) em qualquer parte do place_name.
  const cepMatch = bruto.match(/\b(\d{5})-?(\d{3})\b/);
  if (cepMatch) resultado.cep = `${cepMatch[1]}-${cepMatch[2]}`;

  // CEP parcial (apenas prefixo de 5 dígitos) — guardado, nunca usado como final.
  if (!resultado.cep) {
    const parcial = bruto.match(/\b(\d{5})(?![-\d])/);
    if (parcial) resultado.cepPrefixo = parcial[1];
  }

  const partes = bruto
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && p.toLowerCase() !== "brasil");

  const principal = String(textoPrincipal || "").trim();

  for (let i = partes.length - 1; i >= 0; i--) {
    // Aceita "SP", "SP 01310-100" (completo) e "SP 05016" (prefixo parcial).
    const m = partes[i].match(/^([A-Z]{2})(?:\s+(\d{5})(?:-?(\d{3}))?)?$/);
    if (m && UFS_BR.has(m[1])) {
      if (!resultado.estado) resultado.estado = m[1];
      if (m[2] && m[3] && !resultado.cep) {
        resultado.cep = `${m[2]}-${m[3]}`;
      } else if (m[2] && !m[3] && !resultado.cepPrefixo) {
        resultado.cepPrefixo = m[2];
      }
      if (!resultado.cidade && i > 0) {
        const antes = partes[i - 1];
        if (!/^([A-Z]{2})(\s+\d{5}(-?\d{3})?)?$/.test(antes)) resultado.cidade = antes;
      }
      if (!resultado.bairro && i > 1) {
        const antesDois = partes[i - 2];
        if (antesDois !== principal) resultado.bairro = antesDois;
      }
      break;
    }
  }

  return resultado;
}

/**
 * Fallback 2 — reverse geocoding nas coordenadas da sugestão selecionada.
 * Retorna a feature completa (com `context`) ou null.
 */
export async function reverseGeocodificar(
  center?: [number, number]
): Promise<MapboxSuggestion | null> {
  const token = getMapboxToken();
  if (!token || !center || center.length !== 2) return null;

  try {
    const [lng, lat] = center;
    // Sem restrição de `types`: o Mapbox devolve a feature mais próxima com o
    // `context` completo (inclui bairro/postcode quando existir).
    const params = new URLSearchParams({
      access_token: token,
      country: "br",
      language: "pt-BR",
      limit: "1",
    });
    const url = `${MAPBOX_GEOCODING_URL}/${lng},${lat}.json?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const feature = data?.features?.[0];
    if (!feature) return null;

    return {
      id: feature.id,
      place_name: feature.place_name,
      place_type: feature.place_type || [],
      address: feature.address,
      text: feature.text,
      center: feature.center,
      geometry: feature.geometry,
      context: feature.context,
    };
  } catch {
    return null;
  }
}

// ============================================================
// FIX-CRITICO-AUTOCOMPLETE-CEP-BAIRRO
// Fallback 3 — ViaCEP. Cruza CEP (completo ou prefixo de 5 dígitos),
// UF, cidade e logradouro para descobrir o CEP EXATO e o Bairro.
//   • CEP completo (8): GET /ws/{cep}/json/
//   • Sem CEP: GET /ws/{uf}/{cidade}/{logradouro}/json/ (lista; se houver
//     prefixo de 5 dígitos, prioriza o resultado com aquele prefixo)
// ============================================================
export interface ViaCepResultado extends DadosEnderecoComplementares {
  logradouro?: string;
}

interface ViaCepLinha {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | string;
}

export async function consultarViaCep(params: {
  cep?: string;
  cepPrefixo?: string;
  uf?: string;
  cidade?: string;
  logradouro?: string;
}): Promise<ViaCepResultado | null> {
  const cepDig = somentesDigitos(params.cep);
  const prefixo = somentesDigitos(params.cepPrefixo).slice(0, 5);
  const uf = textoLimpo(params.uf).toUpperCase();
  const cidade = textoLimpo(params.cidade);
  const logradouro = textoLimpo(params.logradouro);

  try {
    // 1) CEP completo — consulta direta.
    if (cepDig.length === 8) {
      const resp = await fetch(`https://viacep.com.br/ws/${cepDig}/json/`);
      if (!resp.ok) return null;
      const d = (await resp.json()) as ViaCepLinha;
      if (!d || d.erro) return null;
      return {
        cep: formatarCep(d.cep) || params.cep,
        cepPrefixo: undefined,
        bairro: textoLimpo(d.bairro) || undefined,
        cidade: textoLimpo(d.localidade) || undefined,
        estado: textoLimpo(d.uf) || undefined,
        logradouro: textoLimpo(d.logradouro) || undefined,
      };
    }

    // 2) Sem CEP completo — busca por UF + cidade + logradouro.
    if (!uf || !cidade || logradouro.length < 3) return null;
    const url = `https://viacep.com.br/ws/${encodeURIComponent(uf)}/${encodeURIComponent(
      cidade,
    )}/${encodeURIComponent(logradouro)}/json/`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const lista = (await resp.json()) as ViaCepLinha[];
    if (!Array.isArray(lista) || lista.length === 0) return null;

    const validos = lista.filter((d) => cepCompleto(d?.cep));
    if (validos.length === 0) return null;

    // Prioriza o registro cujo CEP começa com o prefixo parcial do Mapbox.
    const escolhido =
      (prefixo && validos.find((d) => somentesDigitos(d.cep).startsWith(prefixo))) ||
      validos[0];

    return {
      cep: formatarCep(escolhido.cep) || undefined,
      cepPrefixo: undefined,
      bairro: textoLimpo(escolhido.bairro) || undefined,
      cidade: textoLimpo(escolhido.localidade) || undefined,
      estado: textoLimpo(escolhido.uf) || undefined,
      logradouro: textoLimpo(escolhido.logradouro) || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Preenche os campos (CEP/Bairro/Cidade/UF) que estiverem vazios OU cujo CEP
 * esteja INCOMPLETO (menos de 8 dígitos) em `base`. Cadeia de fallbacks:
 *   1) parsing do place_name
 *   2) reverse geocoding (coordenadas exatas da sugestão)
 *   3) ViaCEP (CEP/prefixo + cidade + UF + logradouro)
 * Nunca sobrescreve um CEP já COMPLETO nem um valor já existente.
 */
export async function complementarDadosEndereco(
  base: DadosEnderecoComplementares,
  suggestion: MapboxSuggestion
): Promise<DadosEnderecoComplementares> {
  const vazio = (v?: string) => !String(v || "").trim();
  const patch: DadosEnderecoComplementares = {};

  // CEP parcial (<8 dígitos) conta como AUSENTE e deve ser corrigido.
  const precisaCep = !cepCompleto(base.cep);
  const precisaBairro = vazio(base.bairro);
  const precisaCidade = vazio(base.cidade);
  const precisaEstado = vazio(base.estado);
  if (!precisaCep && !precisaBairro && !precisaCidade && !precisaEstado) return patch;

  const mesclados: DadosEnderecoComplementares = {
    cep: cepCompleto(base.cep) ? formatarCep(base.cep) : undefined,
    bairro: textoLimpo(base.bairro) || undefined,
    cidade: textoLimpo(base.cidade) || undefined,
    estado: textoLimpo(base.estado) || undefined,
  };
  let prefixo = prefixoCep(base.cep) || undefined;

  const aindaFalta = () =>
    !mesclados.cep || vazio(mesclados.bairro) || vazio(mesclados.cidade) || vazio(mesclados.estado);

  // Fallback 1 — place_name (síncrono, sem rede).
  const parsed = extrairDadosDePlaceName(suggestion.place_name, suggestion.text);
  if (!mesclados.cep && cepCompleto(parsed.cep)) mesclados.cep = formatarCep(parsed.cep);
  if (vazio(mesclados.bairro) && parsed.bairro) mesclados.bairro = parsed.bairro;
  if (vazio(mesclados.cidade) && parsed.cidade) mesclados.cidade = parsed.cidade;
  if (vazio(mesclados.estado) && parsed.estado) mesclados.estado = parsed.estado;
  if (!prefixo && parsed.cepPrefixo) prefixo = parsed.cepPrefixo;

  // Fallback 2 — reverse geocoding nas coordenadas exatas do local.
  if (aindaFalta() && suggestion.center) {
    const rev = await reverseGeocodificar(suggestion.center);
    if (rev) {
      const d = extrairDadosDaSuggestion(rev);
      if (!mesclados.cep && cepCompleto(d.cep)) mesclados.cep = formatarCep(d.cep);
      if (vazio(mesclados.bairro) && d.bairro) mesclados.bairro = d.bairro;
      if (vazio(mesclados.cidade) && d.cidade) mesclados.cidade = d.cidade;
      if (vazio(mesclados.estado) && d.estado) mesclados.estado = d.estado;
      if (!prefixo && d.cepPrefixo) prefixo = d.cepPrefixo;
    }
  }

  // Fallback 3 — ViaCEP cruzando cidade + UF + logradouro (e prefixo do CEP).
  if (aindaFalta()) {
    const via = await consultarViaCep({
      cep: mesclados.cep,
      cepPrefixo: prefixo,
      uf: mesclados.estado,
      cidade: mesclados.cidade,
        logradouro: suggestion.text,
    });
    if (via) {
      if (!mesclados.cep && cepCompleto(via.cep)) mesclados.cep = formatarCep(via.cep);
      if (vazio(mesclados.bairro) && via.bairro) mesclados.bairro = via.bairro;
      if (vazio(mesclados.cidade) && via.cidade) mesclados.cidade = via.cidade;
      if (vazio(mesclados.estado) && via.estado) mesclados.estado = via.estado;
    }
  }

  if (precisaCep && cepCompleto(mesclados.cep)) patch.cep = formatarCep(mesclados.cep);
  if (precisaBairro && mesclados.bairro) patch.bairro = mesclados.bairro;
  if (precisaCidade && mesclados.cidade) patch.cidade = mesclados.cidade;
  if (precisaEstado && mesclados.estado) patch.estado = mesclados.estado;

  return patch;
}

export const mapboxAutocomplete = {
  buscar: buscarEnderecos,
  geocodificar: geocodificarEndereco,
  extrairDados: extrairDadosDaSuggestion,
  complementarDados: complementarDadosEndereco,
  extrairDadosDePlaceName,
  consultarViaCep,
};

export default mapboxAutocomplete;