// F0-F — Fluxo de Caixa: separação PREVISTO (títulos) × REALIZADO (baixas).
// Funções puras e testáveis. Regra central: realizado vem SOMENTE das baixas
// não estornadas; nunca é inferido por status/vencimento nem somado ao previsto.

export type FluxoTipo = "entrada" | "saida";

export interface FluxoPrevisto {
  tipo: FluxoTipo;
  valor: number;
}

export interface FluxoBaixa {
  titulo_tabela: "financeiro_receber" | "financeiro_pagar";
  valor_baixado: number;
  estornada: boolean;
}

export interface FluxoTotais {
  previstoEntrada: number;
  previstoSaida: number;
  realizadoEntrada: number;
  realizadoSaida: number;
  fluxoRealizado: number;
}

/**
 * Calcula os totais de previsto e realizado sem duplicidade.
 * - previsto: soma dos títulos (receber/pagar) — rastreáveis independente de baixa.
 * - realizado: soma das baixas com estornada = false, divididas por titulo_tabela.
 */
export function calcularFluxo(previstos: FluxoPrevisto[], baixas: FluxoBaixa[]): FluxoTotais {
  const previstoEntrada = previstos
    .filter((i) => i.tipo === "entrada")
    .reduce((acc, i) => acc + (Number(i.valor) || 0), 0);
  const previstoSaida = previstos
    .filter((i) => i.tipo === "saida")
    .reduce((acc, i) => acc + (Number(i.valor) || 0), 0);

  const ativas = baixas.filter((b) => !b.estornada);
  const realizadoEntrada = ativas
    .filter((b) => b.titulo_tabela === "financeiro_receber")
    .reduce((acc, b) => acc + (Number(b.valor_baixado) || 0), 0);
  const realizadoSaida = ativas
    .filter((b) => b.titulo_tabela === "financeiro_pagar")
    .reduce((acc, b) => acc + (Number(b.valor_baixado) || 0), 0);

  return {
    previstoEntrada,
    previstoSaida,
    realizadoEntrada,
    realizadoSaida,
    fluxoRealizado: realizadoEntrada - realizadoSaida,
  };
}
