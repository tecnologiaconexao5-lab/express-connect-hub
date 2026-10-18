// ═══════════════════════════════════════════════════════════════════════════════
// FIN-BUG-04 — Exibição da fila de pagamentos de prestadores.
//
// PROBLEMA (Prestador Fantasma): lançamentos manuais antigos foram gravados com
// `prestador_nome = NULL` e `valor_liquido = 0` (o valor real ficou em
// `valor_servicos`). A tela exibia "Não informado" e "R$ 0,00", como se o dado
// tivesse sido perdido no payload.
//
// Estes helpers fazem a NORMALIZAÇÃO DE EXIBIÇÃO (somente leitura):
//   • nome: usa `prestador_nome`; se ausente, resolve pelo cadastro via
//     `prestador_id` (mapa nomePorId);
//   • valor: usa `valor_liquido`; se <= 0, cai para `valor_servicos` (legado);
//   • fantasma: registro sem `prestador_id` => não pode ser aprovado/pago;
//   • bloqueio: valor <= 0 e/ou sem prestador => a RPC oficial recusaria
//     (VALOR_INVALIDO / SEM_PRESTADOR) — sinalizado em vez de escondido.
//
// NÃO altera banco, RLS, RPCs nem payload de escrita.
// ═══════════════════════════════════════════════════════════════════════════════

export interface RegistroPagamentoView {
  prestador_id?: string | null;
  prestador_nome?: string | null;
  valor_liquido?: number | string | null;
  valor_servicos?: number | string | null;
  valor?: number | string | null;
  origem_lancamento?: string | null;
  tipo_lancamento?: string | null;
  natureza?: string | null;
  status?: string | null;
  status_conferencia?: string | null;
  status_aprovacao?: string | null;
  status_pagamento?: string | null;
  is_teste?: boolean | null;
  // Datas existem no registro, mas NÃO participam do predicado da inbox
  // (FIN-BUG-06): uma pendência não é ocultada por período.
  data_competencia?: string | null;
  periodo_inicio?: string | null;
  periodo_fim?: string | null;
  created_at?: string | null;
}

export interface PagamentoNormalizado {
  /** Nome exibível resolvido (cadastro por id como fallback). null se realmente ausente. */
  prestadorNome: string | null;
  /** Valor exibível: valor_liquido; fallback legado = valor_servicos/valor. */
  valor: number;
  /** true quando o valor exibido veio do fallback legado (valor_liquido <= 0). */
  valorLegado: boolean;
  /** true quando o registro não possui prestador_id (registro fantasma). */
  semPrestador: boolean;
  /** true quando a RPC oficial conseguiria aprovar (prestador + valor > 0). */
  podeAprovar: boolean;
  /** Motivo padronizado do bloqueio (mesmo vocabulário das RPCs). */
  motivoBloqueio: "SEM_PRESTADOR" | "VALOR_INVALIDO" | null;
}

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const txt = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export function normalizarPagamento(
  row: RegistroPagamentoView,
  nomePorId: Record<string, string> = {},
): PagamentoNormalizado {
  const nomeProprio = txt(row.prestador_nome);
  const nomeCadastro = row.prestador_id ? txt(nomePorId[row.prestador_id]) : "";
  const prestadorNome = nomeProprio || nomeCadastro || null;

  const liquido = num(row.valor_liquido);
  const servicos = num(row.valor_servicos);
  const base = num(row.valor);
  const valorLegado = liquido <= 0 && (servicos > 0 || base > 0);
  const valor = liquido > 0 ? liquido : servicos > 0 ? servicos : base;

  const semPrestador = !row.prestador_id;
  const motivoBloqueio: PagamentoNormalizado["motivoBloqueio"] =
    semPrestador ? "SEM_PRESTADOR" : valor <= 0 ? "VALOR_INVALIDO" : null;

  return {
    prestadorNome,
    valor,
    valorLegado,
    semPrestador,
    podeAprovar: motivoBloqueio === null,
    motivoBloqueio,
  };
}

export interface ResumoFilaAprovacao {
  pendentes: { qtd: number; valor: number };
  aprovados: { qtd: number; valor: number };
  bloqueados: { qtd: number; valor: number };
  pagosMes: { qtd: number; valor: number };
  fantasmas: { qtd: number; valor: number };
}

/**
 * Resumo financeiro da fila (cards "banking"): considera apenas registros ativos
 * (não cancelados e não de teste). Não altera nada — apenas agrega.
 */
export function resumirFilaAprovacao(
  rows: RegistroPagamentoView[],
  nomePorId: Record<string, string> = {},
): ResumoFilaAprovacao {
  const resumo: ResumoFilaAprovacao = {
    pendentes: { qtd: 0, valor: 0 },
    aprovados: { qtd: 0, valor: 0 },
    bloqueados: { qtd: 0, valor: 0 },
    pagosMes: { qtd: 0, valor: 0 },
    fantasmas: { qtd: 0, valor: 0 },
  };

  for (const row of rows) {
    if (row.is_teste === true) continue;
    const statusGeral = txt(row.status).toLowerCase();
    const statusPag = txt(row.status_pagamento).toLowerCase();
    if (statusGeral === "cancelado" || statusPag === "cancelado") continue;

    const norm = normalizarPagamento(row, nomePorId);
    if (norm.semPrestador) {
      resumo.fantasmas.qtd += 1;
      resumo.fantasmas.valor += norm.valor;
    }

    const aprovacao = txt(row.status_aprovacao).toLowerCase();
    if (aprovacao === "aguardando_aprovacao" || aprovacao === "" || aprovacao === "pendente") {
      resumo.pendentes.qtd += 1;
      resumo.pendentes.valor += norm.valor;
      if (!norm.podeAprovar) {
        resumo.bloqueados.qtd += 1;
        resumo.bloqueados.valor += norm.valor;
      }
      continue;
    }

    if (aprovacao === "aprovado") {
      if (statusPag === "pago") {
        resumo.pagosMes.qtd += 1;
        resumo.pagosMes.valor += norm.valor;
      } else if (statusPag !== "cancelado") {
        resumo.aprovados.qtd += 1;
        resumo.aprovados.valor += norm.valor;
      }
    }
  }

  return resumo;
}

/** Ordena a fila: manuais primeiro, depois por data (mais recente primeiro). */
export function ordenarFilaAprovacao<T extends RegistroPagamentoView & { created_at?: string | null; data_competencia?: string | null }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const manualA = txt(a.origem_lancamento) === "manual" ? 0 : 1;
    const manualB = txt(b.origem_lancamento) === "manual" ? 0 : 1;
    if (manualA !== manualB) return manualA - manualB;
    const dataA = txt(a.data_competencia || a.created_at);
    const dataB = txt(b.data_competencia || b.created_at);
    return dataB.localeCompare(dataA);
  });
}

/**
 * FIN-BUG-06 — Predicado da Caixa de Entrada.
 *
 * Uma pendência SÓ sai da fila quando aprovada/reprovada (ou cancelada/est).
 * NÃO considera período/datas: lançamentos de meses anteriores permanecem
 * visíveis até decisão do financeiro. Este é o filtro único usado tanto pelo
 * badge da aba quanto pela tabela (mesma fonte = mesmo length).
 */
export function estaPendenteAprovacao(row: RegistroPagamentoView): boolean {
  if (row.is_teste === true) return false;
  if (txt(row.status).toLowerCase() === "cancelado") return false;
  if (txt(row.status_pagamento).toLowerCase() === "cancelado") return false;
  return txt(row.status_aprovacao).toLowerCase() === "aguardando_aprovacao";
}
