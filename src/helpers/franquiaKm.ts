/**
 * ESCALA-VEIC-TABELA-06 — Franquia KM canônica.
 *
 * A tabela Comercial grava o KM incluído na franquia em `franquia_km` (canônico).
 * `km_franquia` é o campo legado (default 0). 0 É VALOR VÁLIDO — nunca usar `||`.
 *
 * Regra:
 *  1. franquia_km, se valor válido (inclusive 0);
 *  2. senão km_franquia legado, se válido (inclusive 0);
 *  3. senão 0.
 */

const parseValor = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

export function resolverFranquiaEfetiva(
  franquiaKm: unknown,
  kmFranquiaLegado: unknown
): number {
  const canonico = parseValor(franquiaKm);
  if (canonico !== null) return canonico;

  const legado = parseValor(kmFranquiaLegado);
  if (legado !== null) return legado;

  return 0;
}

/**
 * Tarifa de KM excedente da tabela do cliente.
 * Preferência: valor_km_excedente → valor_km (legado) → 0.
 * 0 preservado (nunca usa preço artificial).
 */
export function resolverTarifaKmExcedente(
  valorKmExcedente: unknown,
  valorKmLegado: unknown
): number {
  const excedente = parseValor(valorKmExcedente);
  if (excedente !== null) return excedente;

  const legado = parseValor(valorKmLegado);
  if (legado !== null) return legado;

  return 0;
}
