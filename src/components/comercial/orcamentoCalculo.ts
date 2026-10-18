// ═══════════════════════════════════════════════════════════════════════════════
// TMS-COM-ORC-02 — Cálculo CANÔNICO dos valores do orçamento (fonte única).
// Usado pelo formulário (save síncrono) e pelo reload/PDF. NÃO duplicar regra.
//
// valorFinal = valorBase + adicionais + pedagio + kmExcedente + ajudante
//              + adValorem + gris + devolucao + reentrega - descontos
// (exatamente os componentes já existentes no contrato atual — sem nova tarifa).
// ═══════════════════════════════════════════════════════════════════════════════
import type { ValoresOrcamento } from "./types";

export type ValoresLike = Partial<ValoresOrcamento> & { adValorem?: number; gris?: number };

const n = (x: unknown): number => {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
};

/** Total canônico a partir dos componentes existentes. */
export function calcularValorFinal(v: ValoresLike): number {
  return (
    n(v.valorBase) + n(v.adicionais) + n(v.pedagio) + n(v.kmExcedente) +
    n(v.ajudante) + n(v.adValorem) + n(v.gris) + n(v.devolucao) + n(v.reentrega) -
    n(v.descontos)
  );
}

/** Recalcula valorFinal + lucroEstimado + margemEstimada e devolve o objeto completo. */
export function calcularValores<T extends ValoresLike>(v: T): T {
  const valorFinal = calcularValorFinal(v);
  const custoEstimado = n(v.custoEstimado);
  const lucroEstimado = valorFinal - custoEstimado;
  const margemEstimada = valorFinal > 0 ? Math.round((lucroEstimado / valorFinal) * 1000) / 10 : 0;
  return { ...v, valorFinal, lucroEstimado, margemEstimada };
}

/** Aplica a derivação de adValorem/gris (regra já existente) e recalcula o total. */
export function calcularValoresDoOrcamento(orc: {
  valores: ValoresLike;
  carga?: { valorDeclarado?: number };
  cliente?: string;
}): ValoresLike {
  const v: ValoresLike = { ...orc.valores };
  const decl = n(orc.carga?.valorDeclarado);
  if (decl > 0) {
    if (orc.cliente === "Amazon Logística" || orc.cliente === "Industrias ABC") {
      v.adValorem = 0;
      v.gris = 0;
    } else {
      v.adValorem = decl * 0.003;
      v.gris = decl * 0.0015;
    }
  }
  return calcularValores(v);
}

/**
 * TMS-ORC-PDF-01 — Total efetivo para EXIBIÇÃO (tela/PDF), SEM nova regra:
 * - valorFinal persistido > 0 => respeitado (inclusive override manual);
 * - valorFinal ausente/0 com componentes preenchidos => linhas legadas gravadas
 *   antes do cálculo síncrono (TMS-COM-ORC-02) => aplica a MESMA regra canônica
 *   calcularValorFinal(). Nunca usa valor fixo.
 */
export function resolverValorFinal(v: ValoresLike): number {
  const persistido = n(v.valorFinal);
  if (persistido > 0) return persistido;
  if (v.pricing?.overrideManual) return persistido;
  return calcularValorFinal(v);
}

/**
 * Monta o payload a enviar ao banco JÁ com os valores finais calculados
 * (elimina o race do setData assíncrono no save do formulário).
 */
export function montarPayloadOrcamento<T extends { valores: ValoresLike; carga?: { valorDeclarado?: number }; cliente?: string }>(orc: T): T {
  return { ...orc, valores: calcularValoresDoOrcamento(orc) } as T;
}
