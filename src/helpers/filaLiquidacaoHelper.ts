// ═══════════════════════════════════════════════════════════════════════════════
// REFORMULACAO-UI-PAGAMENTOS — Fila de Liquidação (helpers puros/testáveis).
//
// A "Fila de Liquidação" reúne as OSs e Programações Operacionais (origens
// `os_direta` / `escala_direta`) FINALIZADAS no aplicativo e ainda aguardando
// liberação financeira. A liberação em si é feita pelas RPCs oficiais
// (pagamentoPrestadorService). Este módulo só calcula/filtra/resume — zero I/O.
// ═══════════════════════════════════════════════════════════════════════════════

export interface FilaLiquidacaoValores {
  bruto: number;
  descontos: number;
  liquido: number;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Valor Bruto = créditos do prestador (serviços + pedágio + adicionais +
 * reembolsos + bônus).
 * Descontos   = descontos + adiantamentos.
 * Valor Líquido é a AUTORIDADE gravada no título (`valor_liquido`); quando
 * ausente/zero, cai no cálculo `bruto - descontos`.
 */
export function calcularFilaValores(p: any): FilaLiquidacaoValores {
  const bruto =
    num(p?.valor_servicos) + num(p?.pedagio) + num(p?.adicionais) + num(p?.valor_reembolsos) + num(p?.valor_bonus);
  const descontos = num(p?.valor_descontos) + num(p?.valor_adiantamentos);
  const liquidoInformado = Number(p?.valor_liquido);
  const liquido =
    Number.isFinite(liquidoInformado) && liquidoInformado !== 0
      ? liquidoInformado
      : Math.round((bruto - descontos) * 100) / 100;
  return {
    bruto: Math.round(bruto * 100) / 100,
    descontos: Math.round(descontos * 100) / 100,
    liquido: Math.round(liquido * 100) / 100,
  };
}

/** Origens operacionais que alimentam a Fila de Liquidação. */
export const ORIGENS_FILA_LIQUIDACAO = ["os_direta", "escala_direta"] as const;

/**
 * Item pertence à Fila de Liquidação quando:
 *  - origem é OS Direta ou Programação Operacional (escala_direta);
 *  - ainda NÃO foi pago nem cancelado;
 *  - não é registro de teste.
 */
export function isItemFilaLiquidacao(p: any): boolean {
  const origem = String(p?.origem_lancamento || "");
  if (!(ORIGENS_FILA_LIQUIDACAO as readonly string[]).includes(origem)) return false;
  const sp = String(p?.status_pagamento || p?.status || "");
  if (sp === "pago" || sp === "cancelado") return false;
  if (p?.is_teste === true) return false;
  return true;
}

export interface FiltrosFilaLiquidacao {
  prestadorId?: string | null;
  busca?: string;
}

/** Filtro de UX (prestador + busca por prestador/OS). */
export function filtrarFilaLiquidacao(rows: any[], f: FiltrosFilaLiquidacao = {}): any[] {
  const q = (f.busca || "").trim().toLowerCase();
  return (rows || []).filter((p) => {
    if (!isItemFilaLiquidacao(p)) return false;
    if (f.prestadorId && p?.prestador_id !== f.prestadorId) return false;
    if (!q) return true;
    return (
      String(p?.prestador_nome || "").toLowerCase().includes(q) ||
      String(p?.os_numero || "").toLowerCase().includes(q)
    );
  });
}

export interface ResumoFilaLiquidacao {
  bruto: number;
  descontos: number;
  liquido: number;
  qtd: number;
}

/** Soma bruto/descontos/líquido da fila (arredondado a 2 casas). */
export function resumoFilaLiquidacao(rows: any[]): ResumoFilaLiquidacao {
  let bruto = 0;
  let descontos = 0;
  let liquido = 0;
  for (const p of rows || []) {
    const v = calcularFilaValores(p);
    bruto += v.bruto;
    descontos += v.descontos;
    liquido += v.liquido;
  }
  const fn = (x: number) => Math.round(x * 100) / 100;
  return { bruto: fn(bruto), descontos: fn(descontos), liquido: fn(liquido), qtd: (rows || []).length };
}
