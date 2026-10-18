// F0-I — Margem por OS: rentabilidade real por operação (funções puras).
// Fontes (competência econômica, sem dupla contagem):
//   Receita = UMA fonte oficial por OS (faturamento/financeiro_receber, ou
//             valor operacional confirmado = PREVISTO; nunca OS+fatura+receber).
//   Custo   = pagamentos_prestadores.valor_liquido (já embute serviços, pedágio,
//             reembolsos, adicionais, descontos, adiantamentos, multas, ajustes)
//             — NUNCA somar valor_liquido + componentes.
//   Outros  = custos operacionais com vínculo real à OS fora de pagamentos_prestadores.

export type ReceitaFonte = "faturamento" | "operacional" | "sem_receita";
export type StatusMargem = "real" | "prevista" | "pendente";

export interface MargemOsInput {
  osId: string | null;
  osNumero: string | null;
  data?: string | null;
  clienteNome?: string | null;
  prestadorNome?: string | null;
  veiculoTipo?: string | null;
  statusOs?: string | null;
  receita: number;
  receitaFonte: ReceitaFonte;
  custoPrestador: number; // valor_liquido
  outrosCustos: number; // apenas vínculo real comprovado à OS
}

export interface LinhaMargemOs extends MargemOsInput {
  margem: number;
  margemPct: number;
  statusMargem: StatusMargem;
}

export interface IndicadoresMargem {
  receitaTotal: number;
  custoTotal: number;
  margemTotal: number;
  margemMediaPct: number;
  osNegativas: number;
  quantidadeOs: number;
}

/**
 * Margem por OS (sem dupla contagem):
 *   Margem R$ = Receita − Custo Prestador (valor_liquido) − Outros Custos
 *   Margem %  = Margem / Receita × 100
 * Status: 'real' (faturado/receber), 'prevista' (valor operacional), 'pendente' (sem receita).
 */
export function calcularMargemOs(input: MargemOsInput): LinhaMargemOs {
  const receita = Number(input.receita) || 0;
  const custoPrestador = Number(input.custoPrestador) || 0;
  const outrosCustos = Number(input.outrosCustos) || 0;
  const margem = receita - custoPrestador - outrosCustos;
  const margemPct = receita > 0 ? (margem / receita) * 100 : 0;
  const statusMargem: StatusMargem =
    input.receitaFonte === "faturamento" ? "real"
    : input.receitaFonte === "operacional" ? "prevista"
    : "pendente";
  return { ...input, receita, custoPrestador, outrosCustos, margem, margemPct, statusMargem };
}

/** Indicadores sobre o MESMO conjunto já filtrado (tabela e KPIs usam os mesmos dados). */
export function calcularIndicadores(linhas: LinhaMargemOs[]): IndicadoresMargem {
  const receitaTotal = linhas.reduce((a, l) => a + l.receita, 0);
  const custoTotal = linhas.reduce((a, l) => a + l.custoPrestador + l.outrosCustos, 0);
  const margemTotal = linhas.reduce((a, l) => a + l.margem, 0);
  const osNegativas = linhas.filter((l) => l.margem < 0).length;
  return {
    receitaTotal,
    custoTotal,
    margemTotal,
    margemMediaPct: receitaTotal > 0 ? (margemTotal / receitaTotal) * 100 : 0,
    osNegativas,
    quantidadeOs: linhas.length,
  };
}
