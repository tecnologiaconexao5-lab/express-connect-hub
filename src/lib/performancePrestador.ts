/**
 * FASE 7 — Item 12: classificação de performance operacional.
 *
 * Regra de ouro: candidato novo NÃO recebe nota fictícia. A categoria
 * "Em desenvolvimento" é usada quando não há amostra operacional real
 * (entregas/pontualidade/ocorrências).
 */
export type CategoriaPerformance =
  | "Diamante"
  | "Ouro"
  | "Prata"
  | "Bronze"
  | "Em desenvolvimento";

export interface PerformancePrestadorInput {
  /** Total de entregas/operações concluídas (dado real do TMS). */
  totalEntregas?: number | null;
  /** Pontualidade 0-100 (quando o TMS possui o dado). */
  pontualidade?: number | null;
  /** Ocorrências operacionais reais. */
  ocorrencias?: number | null;
  /** Quando true, é candidato em avaliação inicial (sem nota de performance). */
  isCandidato?: boolean | null;
}

export interface ResultadoPerformance {
  categoria: CategoriaPerformance;
  /** null quando não há amostra operacional suficiente. */
  score: number | null;
  amostraInsuficiente: boolean;
  totalEntregas: number;
  pontualidade: number | null;
  ocorrencias: number;
}

const clamp = (valor: number): number => Math.max(0, Math.min(100, valor));

export function calcularCategoriaPerformance(
  input: PerformancePrestadorInput,
): ResultadoPerformance {
  const totalEntregas = Math.max(0, Number(input.totalEntregas || 0));
  const ocorrencias = Math.max(0, Number(input.ocorrencias || 0));
  const pontualidadeBruta = Number(input.pontualidade);
  const pontualidade =
    Number.isFinite(pontualidadeBruta) && pontualidadeBruta > 0
      ? clamp(pontualidadeBruta)
      : null;

  // Candidato em avaliação inicial ou sem nenhum dado operacional real:
  // não inventa score de desempenho.
  const semAmostra =
    input.isCandidato === true ||
    (totalEntregas === 0 && pontualidade === null);

  if (semAmostra) {
    return {
      categoria: "Em desenvolvimento",
      score: null,
      amostraInsuficiente: true,
      totalEntregas,
      pontualidade,
      ocorrencias,
    };
  }

  const scoreEntregas = clamp(totalEntregas * 2);
  const scoreOcorrencias = clamp(100 - ocorrencias * 10);

  const score =
    pontualidade !== null
      ? clamp(scoreEntregas * 0.35 + pontualidade * 0.45 + scoreOcorrencias * 0.2)
      : clamp(scoreEntregas * 0.7 + scoreOcorrencias * 0.3);

  const categoria: CategoriaPerformance =
    score >= 90
      ? "Diamante"
      : score >= 75
        ? "Ouro"
        : score >= 55
          ? "Prata"
          : score >= 35
            ? "Bronze"
            : "Em desenvolvimento";

  return {
    categoria,
    score: Math.round(score),
    amostraInsuficiente: false,
    totalEntregas,
    pontualidade,
    ocorrencias,
  };
}

export const PERFORMANCE_CORES: Record<CategoriaPerformance, string> = {
  Diamante: "bg-cyan-100 text-cyan-800 border-cyan-200",
  Ouro: "bg-yellow-100 text-yellow-800 border-yellow-200",
  Prata: "bg-slate-100 text-slate-700 border-slate-200",
  Bronze: "bg-amber-100 text-amber-800 border-amber-200",
  "Em desenvolvimento": "bg-blue-100 text-blue-700 border-blue-200",
};
