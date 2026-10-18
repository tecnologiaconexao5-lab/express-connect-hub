// F0-G — DRE Gerencial: fontes reais + cálculo puro e testável.
// Competência econômica (não fluxo de caixa):
//   Receita  → financeiro_receber (fonte oficial; fatura/OS NÃO contam de novo)
//   Custos   → pagamentos_prestadores (impacto_dre = true, valor_liquido)
//   Despesas → financeiro_pagar (EXCLUINDO repasses de prestador e impostos)
// Baixas financeiras NÃO criam competência (não são input do DRE).

export type ClassificacaoDespesa = "imposto" | "financeira" | "comercial" | "administrativa" | "outras";
export type ClassificacaoReceita = "operacional" | "financeira";

export interface DreReceita {
  valor: number;
  categoria?: string | null;
}

export interface DreCustoPrestador {
  valor_liquido: number;
  impacto_dre: boolean;
}

export interface DreDespesa {
  valor: number;
  categoria?: string | null;
  plano_conta?: string | null;
}

export interface DreTotais {
  receitaBruta: number;
  receitasFinanceiras: number;
  deducoes: number;
  receitaLiquida: number;
  custosPrestadores: number;
  despesasAdministrativas: number;
  despesasComerciais: number;
  despesasOutras: number;
  despesasFinanceiras: number;
  despesasOperacionais: number;
  ebitda: number;
  depreciacao: number;
  ebit: number;
  resultadoFinanceiro: number;
  lucroAntesIR: number;
  ir: number;
  lucroLiquido: number;
}

/**
 * Classifica uma despesa pelo plano de contas/categoria (reaproveita os campos
 * reais `categoria`/`plano_conta`/`plano_contas`). Sem plano paralelo.
 */
export function classificarDespesa(categoria?: string | null, planoConta?: string | null): ClassificacaoDespesa {
  const c = `${categoria || ""} ${planoConta || ""}`.toLowerCase();
  if (/(imposto|tributo|\biss\b|\bpis\b|\bcofins\b|\bicms\b|\birrf\b|\binss\b)/.test(c)) return "imposto";
  if (/(financeir|juros|tarifa|taxa banc)/.test(c)) return "financeira";
  if (/(comercial|marketing|comiss|propaganda|publicidade|venda)/.test(c)) return "comercial";
  if (/(admin|aluguel|salari|folha|pro-labore|software|tecnolog|contabil|telefone|internet|material|limpeza|energia|agua)/.test(c)) return "administrativa";
  return "outras";
}

/** Classifica uma receita: operacional (frete/serviços) vs financeira (juros/aplicações). */
export function classificarReceita(categoria?: string | null): ClassificacaoReceita {
  const c = (categoria || "").toLowerCase();
  if (/(financeir|juros|aplicac|rendimento)/.test(c)) return "financeira";
  return "operacional";
}

/**
 * Fórmula exata do DRE (competência):
 *   Receita Líquida      = Receita Bruta − Deduções (impostos/tributos)
 *   EBITDA               = Receita Líquida − Custos Prestadores − Despesas Operacionais
 *                           (adm + comercial + outras; EXCLUI depreciação, financeiras e IR)
 *   EBIT                 = EBITDA − Depreciação (sem fonte real → 0, não estimar)
 *   Lucro antes do IR    = EBIT + Resultado Financeiro (receitas fin. − despesas fin.)
 *   Lucro Líquido        = Lucro antes do IR − IR (sem fonte real → 0, não estimar)
 * Baixas/estornos NÃO entram (não são competência).
 */
export function calcularDRE(
  receitas: DreReceita[],
  custosPrestadores: DreCustoPrestador[],
  despesas: DreDespesa[]
): DreTotais {
  let receitaBruta = 0;
  let receitasFinanceiras = 0;
  for (const r of receitas) {
    const v = Number(r.valor) || 0;
    if (classificarReceita(r.categoria) === "financeira") receitasFinanceiras += v;
    else receitaBruta += v;
  }

  let deducoes = 0;
  let despAdmin = 0;
  let despComercial = 0;
  let despOutras = 0;
  let despFinanceiras = 0;
  for (const d of despesas) {
    const v = Number(d.valor) || 0;
    switch (classificarDespesa(d.categoria, d.plano_conta)) {
      case "imposto": deducoes += v; break;
      case "financeira": despFinanceiras += v; break;
      case "comercial": despComercial += v; break;
      case "administrativa": despAdmin += v; break;
      default: despOutras += v; break;
    }
  }

  const custosPrestadoresTotal = custosPrestadores
    .filter((c) => !!c.impacto_dre)
    .reduce((acc, c) => acc + (Number(c.valor_liquido) || 0), 0);

  const receitaLiquida = receitaBruta - deducoes;
  const despesasOperacionais = despAdmin + despComercial + despOutras;
  const ebitda = receitaLiquida - custosPrestadoresTotal - despesasOperacionais;
  const depreciacao = 0; // sem fonte real confiável — não estimar
  const ebit = ebitda - depreciacao;
  const resultadoFinanceiro = receitasFinanceiras - despFinanceiras;
  const lucroAntesIR = ebit + resultadoFinanceiro;
  const ir = 0; // sem fonte real confiável — não estimar
  const lucroLiquido = lucroAntesIR - ir;

  return {
    receitaBruta,
    receitasFinanceiras,
    deducoes,
    receitaLiquida,
    custosPrestadores: custosPrestadoresTotal,
    despesasAdministrativas: despAdmin,
    despesasComerciais: despComercial,
    despesasOutras: despOutras,
    despesasFinanceiras: despFinanceiras,
    despesasOperacionais,
    ebitda,
    depreciacao,
    ebit,
    resultadoFinanceiro,
    lucroAntesIR,
    ir,
    lucroLiquido,
  };
}

export type PeriodoDre = "mensal" | "trimestral" | "anual" | "personalizado";

/** Calcula janelas de competência atual e anterior a partir de uma referência (YYYY-MM). */
export function periodoParaDatas(
  periodo: PeriodoDre,
  referencia: string,
  customInicio?: string,
  customFim?: string
): { inicio: string; fim: string; inicioAnterior: string; fimAnterior: string } {
  const [anoS, mesS] = referencia.split("-").map(Number);

  if (periodo === "personalizado" && customInicio && customFim) {
    const inicioAtual = customInicio;
    const fimAtual = customFim;
    const ini = new Date(`${customInicio}T00:00:00Z`).getTime();
    const f = new Date(`${customFim}T00:00:00Z`).getTime();
    const duracao = Math.max(1, Math.round((f - ini) / 86400000) + 1);
    return {
      inicio: inicioAtual,
      fim: fimAtual,
      inicioAnterior: addDaysISO(customInicio, -duracao),
      fimAnterior: addDaysISO(customInicio, -1),
    };
  }

  let meses = 1;
  if (periodo === "trimestral") meses = 3;
  if (periodo === "anual") meses = 12;

  return {
    inicio: isoMonthStart(anoS, mesS - (meses - 1)),
    fim: isoMonthEnd(anoS, mesS),
    inicioAnterior: isoMonthStart(anoS, mesS - (meses * 2 - 1)),
    fimAnterior: isoMonthEnd(anoS, mesS - meses),
  };
}

/** Soma/subtrai dias a uma data ISO (YYYY-MM-DD) usando aritmética UTC. */
function addDaysISO(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function isoMonthStart(ano: number, mes: number): string {
  const dt = new Date(Date.UTC(ano, mes - 1, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function isoMonthEnd(ano: number, mes: number): string {
  const dt = new Date(Date.UTC(ano, mes, 0));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}
