// ============================================================
// RADAR OPERACIONAL — Combustíveis
// Serviço simulado (mock) com o preço médio diário de referência
// para a região de São Paulo/SP. Sem chamadas externas: os valores
// são determinísticos por dia, para a operação ter uma referência
// estável durante toda a jornada.
//
// Quando a integração real (ANP/feed externo) entrar, basta trocar
// a implementação de `buscarRadarCombustivel` mantendo o contrato.
// ============================================================

export type TipoCombustivelRadar = "gasolina" | "etanol" | "diesel";

export interface PrecoCombustivelRadar {
  id: TipoCombustivelRadar;
  nome: string;
  preco: number;
  unidade: "R$/L";
  variacaoPercentual: number;
  tendencia: "alta" | "baixa" | "estavel";
}

export interface RadarCombustivelResultado {
  regiao: string;
  uf: string;
  atualizadoEm: string;
  fonte: string;
  precos: PrecoCombustivelRadar[];
}

const REGIAO_PADRAO = "São Paulo";
const UF_PADRAO = "SP";

const BASE_PRECOS: Record<TipoCombustivelRadar, { nome: string; preco: number }> = {
  gasolina: { nome: "Gasolina", preco: 6.09 },
  etanol: { nome: "Etanol", preco: 4.29 },
  diesel: { nome: "Diesel S10", preco: 6.19 },
};

const ORDEM: TipoCombustivelRadar[] = ["gasolina", "etanol", "diesel"];

/** Hash estável por dia + combustível (evita variação a cada render). */
function sementeDoDia(data: Date, tipo: TipoCombustivelRadar): number {
  const dia = `${data.getFullYear()}-${data.getMonth() + 1}-${data.getDate()}`;
  const texto = `${dia}:${tipo}`;
  let hash = 0;
  for (let i = 0; i < texto.length; i += 1) {
    hash = (hash * 31 + texto.charCodeAt(i)) % 100000;
  }
  return hash;
}

function variacaoDoDia(data: Date, tipo: TipoCombustivelRadar): number {
  // Faixa plausível de variação diária: -1,2% a +1,2%.
  const bruto = (sementeDoDia(data, tipo) % 241) - 120;
  return Math.round((bruto / 100) * 100) / 100;
}

function arredondarPreco(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Retorna o preço médio diário dos combustíveis na região informada.
 * `atrasoMs` simula a latência de rede (usado também nos testes).
 */
export async function buscarRadarCombustivel(
  regiao: string = REGIAO_PADRAO,
  opcoes: { atrasoMs?: number; agora?: Date } = {},
): Promise<RadarCombustivelResultado> {
  const { atrasoMs = 350, agora = new Date() } = opcoes;

  if (atrasoMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, atrasoMs));
  }

  const precos = ORDEM.map((tipo) => {
    const base = BASE_PRECOS[tipo];
    const variacao = variacaoDoDia(agora, tipo);
    const preco = arredondarPreco(base.preco * (1 + variacao / 100));
    return {
      id: tipo,
      nome: base.nome,
      preco,
      unidade: "R$/L" as const,
      variacaoPercentual: variacao,
      tendencia: variacao > 0.01 ? "alta" : variacao < -0.01 ? "baixa" : "estavel",
    } satisfies PrecoCombustivelRadar;
  });

  return {
    regiao,
    uf: UF_PADRAO,
    atualizadoEm: agora.toISOString(),
    fonte: "Média diária de referência (simulado)",
    precos,
  };
}

export function formatarPrecoCombustivel(valor: number): string {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export function formatarVariacaoCombustivel(valor: number): string {
  const sinal = valor > 0 ? "+" : "";
  return `${sinal}${valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

export function formatarAtualizacaoRadar(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "—";
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const RADAR_REGIAO_PADRAO = `${REGIAO_PADRAO}/${UF_PADRAO}`;
