// ============================================================
// MISSAO COTACAO-EXPRESS-V2 — cálculo de rota + preço da Fase 1
// Módulo puro (rede apenas em funções assíncronas explícitas),
// usado pela página pública /cotacao-express para mostrar o valor
// do frete NA HORA antes de o cliente aprovar.
//
// Camada 1 — ROTA: Mapbox Directions multi-ponto (mesmo token do
//            autocomplete), com geocoding de ponta a ponta.
// Camada 2 — PREÇO: edge `pedido-rapido` action "estimar" (fonte
//            oficial, tabelas_valores via service_role).
// Camada 3 — FALLBACK: TABELA_TESTE_VEICULOS_SP com a MESMA fórmula
//            da edge (base + km excedente + 10% por parada extra),
//            para nunca deixar o cliente sem preço na tela.
// ============================================================
import { getMapboxToken } from "@/lib/mapboxToken";
import { supabase } from "@/lib/supabase";
import { geocodificarEndereco } from "@/services/maps/mapboxAutocomplete";
import { TABELA_TESTE_VEICULOS_SP } from "@/helpers/tabelaFretePadrao";
import { labelVeiculo, veiculoPorPeso } from "@/lib/veiculoPeso";

const DIRECTIONS_URL = "https://api.mapbox.com/directions/v5/mapbox/driving";
const TIMEOUT_PRECIFICACAO_MS = 7000;

// ------------------------------------------------------------
// Tipos
// ------------------------------------------------------------

export interface PontoRotaCotacao {
  endereco: string;
  lat: number | null;
  lng: number | null;
}

export interface RotaCotacao {
  km: number;
  duracaoMin: number;
  paradas: number;
}

export type FontePrecificacao =
  | "tabela_cliente"
  | "tabela_padrao"
  | "sem_tabela"
  | "tabela_local";

export interface FormulaPrecificacao {
  valorBase: number;
  franquiaKm: number;
  kmExcedente: number;
  valorKmExcedente: number;
  acrescimoParadasExtras: number;
}

export interface PrecificacaoCotacao {
  valor: number;
  moeda: "BRL";
  distancia_km: number;
  duracao_min: number | null;
  tipo_veiculo: string;
  rotulo_veiculo: string;
  paradas: number;
  fonte: FontePrecificacao;
  tabela: string | null;
  formula: FormulaPrecificacao;
  aviso: string;
  calculado_em: string;
}

export interface EstimarFreteInput {
  distanciaKm: number;
  tipoVeiculo: string;
  paradas: number;
  duracaoMin?: number | null;
}

interface RespostaEstimar {
  success?: boolean;
  valor?: number | null;
  moeda?: string;
  distanciaKm?: number;
  paradas?: number;
  fonte?: string;
  tabela?: { id?: string; nome?: string } | null;
  formula?: Partial<FormulaPrecificacao>;
  aviso?: string;
  mensagem?: string;
  error?: string;
}

export interface SugestaoVeiculoCotacao {
  tipo: string;
  rotulo: string;
  avulso: boolean;
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const r2 = (n: number): number => Math.round(n * 100) / 100;

const arred1 = (n: number): number => Math.round(n * 10) / 10;

/** Veículo por peso (regra fixa do projeto) com rótulo legível. */
export function veiculoSugeridoCotacao(
  pesoKg: number | null | undefined,
): SugestaoVeiculoCotacao {
  const peso = typeof pesoKg === "number" && Number.isFinite(pesoKg) ? pesoKg : null;

  if (peso === null || peso <= 0) {
    return { tipo: "passeio", rotulo: "Veículo Passeio (sem peso informado)", avulso: false };
  }

  const tipo = veiculoPorPeso(peso);
  if (tipo) {
    return { tipo, rotulo: labelVeiculo(tipo) || tipo, avulso: false };
  }

  // Acima de 2.500 kg não há trava automática — propomos caminhão e
  // sinalizamos que a operação confirma na resposta.
  return { tipo: "truck", rotulo: "Caminhão (acima de 2.500 kg — confirmação da operação)", avulso: true };
}

/** Alias veículo → chave da TABELA_TESTE_VEICULOS_SP. */
export const ALIAS_TABELA_LOCAL: Record<string, string> = {
  moto: "moto",
  passeio: "carro_passeio",
  carro: "carro_passeio",
  carro_passeio: "carro_passeio",
  fiorino: "fiorino",
  kombi: "fiorino",
  hr: "hr",
  van: "hr",
  vuc: "vuc",
  tres_quartos: "tres_quartos",
  toco: "toco",
  truck: "truck",
  carreta: "carreta",
  bitruck: "truck",
  bitrem: "carreta",
};

/** Candidatos de `tipo_veiculo` para a edge (a tabela aceita ILIKE exato). */
export function candidatosVeiculo(tipoVeiculo: string): string[] {
  const base = (tipoVeiculo || "").toLowerCase().trim();
  if (!base) return [];
  const aliases: Record<string, string[]> = {
    passeio: ["passeio", "carro"],
    carro: ["carro", "passeio"],
    kombi: ["kombi", "fiorino"],
    hr: ["hr", "van"],
    van: ["van", "hr"],
    bitruck: ["bitruck", "truck"],
    bitrem: ["bitrem", "carreta"],
  };
  const lista = [base, ...(aliases[base] || [])];
  return Array.from(new Set(lista));
}

// ------------------------------------------------------------
// CAMADA 1 — ROTA (Mapbox Directions multi-ponto)
// ------------------------------------------------------------

interface DirectionsResponse {
  routes?: Array<{ distance?: number; duration?: number }>;
}

/**
 * Calcula a rota completa na ordem das paradas.
 * Pontos sem coordenadas são geocodificados pelo endereço.
 * Retorna null quando o Mapbox não responde (a página então
 * sinaliza "não foi possível calcular" em vez de inventar preço).
 */
export async function calcularRotaCotacao(
  pontos: PontoRotaCotacao[],
): Promise<RotaCotacao | null> {
  if (!Array.isArray(pontos) || pontos.length < 2) return null;

  const token = getMapboxToken();
  if (!token) return null;

  const coordenadas: Array<{ lat: number; lng: number }> = [];
  for (const ponto of pontos) {
    if (
      typeof ponto.lat === "number" &&
      typeof ponto.lng === "number" &&
      Number.isFinite(ponto.lat) &&
      Number.isFinite(ponto.lng)
    ) {
      coordenadas.push({ lat: ponto.lat, lng: ponto.lng });
      continue;
    }
    const geo = await geocodificarEndereco(ponto.endereco);
    if (!geo) return null;
    coordenadas.push({ lat: geo.coordinates.lat, lng: geo.coordinates.lng });
  }

  if (coordenadas.length !== pontos.length) return null;

  const waypoints = coordenadas.map((c) => `${c.lng},${c.lat}`).join(";");
  const url =
    `${DIRECTIONS_URL}/${waypoints}.json?access_token=${token}` +
    "&overview=false&steps=false&geometries=geojson";

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("[CotacaoCalculo] Mapbox Directions retornou", response.status);
      return null;
    }
    const data = (await response.json()) as DirectionsResponse;
    const rota = data.routes?.[0];
    if (!rota || typeof rota.distance !== "number") return null;

    return {
      km: arred1(rota.distance / 1000),
      duracaoMin: Math.round((rota.duration || 0) / 60),
      paradas: pontos.length,
    };
  } catch (error) {
    console.error("[CotacaoCalculo] Erro ao calcular rota:", error);
    return null;
  }
}

// ------------------------------------------------------------
// CAMADA 3 — FALLBACK LOCAL (mesma fórmula da edge)
// ------------------------------------------------------------

/**
 * Preço local quando a edge não tem tabela para o veículo
 * (a tabela universal só existe para moto). Mesma fórmula:
 *   valor = base + max(0, km - franquia) × excedente + base × 10% × paradasExtras
 */
export function valorLocalCotacao(input: EstimarFreteInput): PrecificacaoCotacao | null {
  const chave = ALIAS_TABELA_LOCAL[(input.tipoVeiculo || "").toLowerCase().trim()];
  const tabela = TABELA_TESTE_VEICULOS_SP.find((t) => t.veiculo === chave);
  if (!tabela) return null;

  const km = Math.max(0, input.distanciaKm);
  const paradas = Math.max(1, Math.round(input.paradas || 1));
  const faixa = tabela.faixas.find((f) => km <= f.ateKm) || tabela.faixas[tabela.faixas.length - 1];
  if (!faixa) return null;

  const dentroDaFaixa = km <= faixa.ateKm;
  const valorBase = faixa.cliente;
  const franquiaKm = dentroDaFaixa ? faixa.ateKm : tabela.kmBase;
  const kmExcedente = r2(Math.max(0, km - franquiaKm));
  const valorKmExcedente = tabela.excedenteCliente;
  const paradasExtras = Math.max(0, paradas - 1);
  const acrescimoParadasExtras = r2(valorBase * 0.1 * paradasExtras);
  const valor = r2(valorBase + kmExcedente * valorKmExcedente + acrescimoParadasExtras);
  const rotulo = labelVeiculo(input.tipoVeiculo) || input.tipoVeiculo;

  return {
    valor,
    moeda: "BRL",
    distancia_km: arred1(km),
    duracao_min:
      typeof input.duracaoMin === "number" && Number.isFinite(input.duracaoMin)
        ? Math.round(input.duracaoMin)
        : null,
    tipo_veiculo: input.tipoVeiculo,
    rotulo_veiculo: rotulo,
    paradas,
    fonte: "tabela_local",
    tabela: `Tabela padrão SP (${tabela.veiculo})`,
    formula: { valorBase, franquiaKm, kmExcedente, valorKmExcedente, acrescimoParadasExtras },
    aviso: "Valor estimado — sujeito a confirmação operacional (distância, pedágio e disponibilidade).",
    calculado_em: new Date().toISOString(),
  };
}

// ------------------------------------------------------------
// CAMADA 2 — PREÇO OFICIAL (edge pedido-rapido)
// ------------------------------------------------------------

async function chamarEstimar(
  tipoVeiculo: string,
  distanciaKm: number,
  paradas: number,
  signal: AbortSignal,
): Promise<RespostaEstimar | null> {
  try {
    const { data, error } = await supabase.functions.invoke("pedido-rapido", {
      body: {
        action: "estimar",
        tipoVeiculo,
        distanciaKm,
        paradas,
      },
      signal,
    });
    if (error || !data) return null;
    return data as RespostaEstimar;
  } catch {
    return null;
  }
}

/**
 * Preço do frete: tenta a fonte oficial (edge) com alguns nomes de
 * veículo compatíveis e cai para a tabela local quando não há tabela
 * (ou quando a rede falha). NUNCA devolve null — o cliente precisa
 * ver um valor.
 */
export async function estimarFreteCotacao(
  input: EstimarFreteInput,
): Promise<PrecificacaoCotacao | null> {
  const distanciaKm = Math.max(0, input.distanciaKm);
  const paradas = Math.max(1, Math.round(input.paradas || 1));
  if (distanciaKm <= 0) return valorLocalCotacao({ ...input, distanciaKm: 0 });

  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TIMEOUT_PRECIFICACAO_MS);
  const base: EstimarFreteInput = { ...input, distanciaKm, paradas };

  try {
    for (const candidato of candidatosVeiculo(input.tipoVeiculo)) {
      if (controle.signal.aborted) break;
      const resp = await chamarEstimar(candidato, distanciaKm, paradas, controle.signal);
      if (!resp) continue;
      if (typeof resp.valor === "number" && resp.valor > 0) {
        const formula = resp.formula || {};
        return {
          valor: r2(resp.valor),
          moeda: "BRL",
          distancia_km: arred1(typeof resp.distanciaKm === "number" ? resp.distanciaKm : distanciaKm),
          duracao_min:
            typeof input.duracaoMin === "number" && Number.isFinite(input.duracaoMin)
              ? Math.round(input.duracaoMin)
              : null,
          tipo_veiculo: candidato,
          rotulo_veiculo: labelVeiculo(candidato) || candidato,
          paradas: typeof resp.paradas === "number" ? resp.paradas : paradas,
          fonte: (resp.fonte as FontePrecificacao) || "tabela_padrao",
          tabela: resp.tabela?.nome || null,
          formula: {
            valorBase: Number(formula.valorBase || 0),
            franquiaKm: Number(formula.franquiaKm || 0),
            kmExcedente: Number(formula.kmExcedente || 0),
            valorKmExcedente: Number(formula.valorKmExcedente || 0),
            acrescimoParadasExtras: Number(formula.acrescimoParadasExtras || 0),
          },
          aviso:
            resp.aviso ||
            resp.mensagem ||
            "Valor estimado — sujeito a confirmação operacional (distância, pedágio e disponibilidade).",
          calculado_em: new Date().toISOString(),
        };
      }
    }
  } finally {
    clearTimeout(timer);
  }

  return valorLocalCotacao(base);
}

/**
 * Caminho completo usado pela página: rota + preço.
 * `rota === null` → sem distância confiável (a página não mostra preço).
 */
export async function calcularRotaEFreteCotacao(
  pontos: PontoRotaCotacao[],
  pesoKg: number | null | undefined,
): Promise<{ rota: RotaCotacao; veiculo: SugestaoVeiculoCotacao; precificacao: PrecificacaoCotacao } | null> {
  const rota = await calcularRotaCotacao(pontos);
  if (!rota) return null;

  const veiculo = veiculoSugeridoCotacao(pesoKg);
  const precificacao = await estimarFreteCotacao({
    distanciaKm: rota.km,
    tipoVeiculo: veiculo.tipo,
    paradas: rota.paradas,
    duracaoMin: rota.duracaoMin,
  });
  if (!precificacao) return null;

  return { rota, veiculo, precificacao };
}

/** Formata BRL no padrão da página (R$ 1.234,56). */
export function formatarBrl(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(valor) ? valor : 0);
}
