// Formatação numérica pt-BR usada na UI operacional.

/**
 * Distância em km com UMA casa decimal e vírgula pt-BR.
 * Evita valores crus do banco/API como "108.741547000" → retorna "108,7".
 */
export function formatarDistanciaKm(valor?: number | string | null): string {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return "0,0";
  return n.toFixed(1).replace(".", ",");
}
