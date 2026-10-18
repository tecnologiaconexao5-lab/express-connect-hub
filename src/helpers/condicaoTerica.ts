/**
 * ESCALA-VEIC-TABELA-07 — Condição térmica canônica, independente do veículo.
 *
 * Dimensão 1 — VEÍCULO: fiorino, vuc, van, hr, tres_quartos, ... (tabelas_valores.tipo_veiculo)
 * Dimensão 2 — CONDIÇÃO TÉRMICA: seco | termico | refrigerado (tabelas_valores.classificacao_termica)
 *
 * A condição térmica NUNCA é embutida no tipo de veículo
 * (proibido "fiorino_refrigerada", "vuc_refrigerado", etc.).
 *
 * Semântica de compatibilidade:
 *  - dimensão desconhecida (null/undefined/vazio/"misto") = curinga → compatível;
 *  - ambas conhecidas → exigem igualdade canônica (seco ≠ termico ≠ refrigerado).
 */

export type CondicaoTerica = "seco" | "termico" | "refrigerado";

export const CONDICOES_TERMICAS: CondicaoTerica[] = ["seco", "termico", "refrigerado"];

/** Normaliza a condição térmica (acentos/case/variações) para o canônico. */
export function normalizarCondicaoTerica(v: unknown): CondicaoTerica | null {
  if (v === null || v === undefined) return null;
  const s = String(v)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!s) return null;
  if (s === "seco" || s === "seca" || s === "dry") return "seco";
  if (s === "termico" || s === "termica" || s === "thermal") return "termico";
  if (s === "refrigerado" || s === "refrigerada" || s === "refrigeracao" || s === "refrig") return "refrigerado";
  return null;
}

/**
 * Compatibilidade entre a condição térmica da tabela e a do veículo.
 * Desconhecido = curinga (preserva registros existentes sem condição definida).
 */
export function condicaoTericaCompativel(tabelaTermica: unknown, veiculoTermica: unknown): boolean {
  const t = normalizarCondicaoTerica(tabelaTermica);
  const v = normalizarCondicaoTerica(veiculoTermica);
  if (t === null || v === null) return true;
  return t === v;
}

export interface SelecaoTermicaResult<T> {
  tabela: T | null;
  ambiguidade: boolean;
  compativeis: T[];
}

/**
 * Seleciona a tabela pela condição térmica.
 * - 0 candidatas → null
 * - 1+ candidatas com a MESMA condição térmica → primeira
 * - múltiplas condições térmicas distintas e não desambiguáveis → ambiguidade (não escolher)
 * - condição conhecida sem nenhuma compatível → null (não usar tabela incompatível)
 */
export function selecionarTabelaPorCondicaoTerica<T extends { classificacao_termica?: unknown }>(
  candidatas: T[],
  veiculoTermica: unknown
): SelecaoTermicaResult<T> {
  if (!candidatas || candidatas.length === 0) {
    return { tabela: null, ambiguidade: false, compativeis: [] };
  }
  const compativeis = candidatas.filter((t) => condicaoTericaCompativel(t.classificacao_termica, veiculoTermica));
  if (compativeis.length === 0) {
    return { tabela: null, ambiguidade: false, compativeis: [] };
  }
  const distintas = new Set(
    compativeis.map((t) => normalizarCondicaoTerica(t.classificacao_termica) ?? "__sem__")
  );
  if (distintas.size <= 1) {
    return { tabela: compativeis[0], ambiguidade: false, compativeis };
  }
  return { tabela: null, ambiguidade: true, compativeis };
}
