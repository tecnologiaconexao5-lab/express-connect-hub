/**
 * ESCALA-PRESTADOR-02 — Repasse dual canônico.
 *
 * Modos:
 *  - "cadastro"  (PADRÃO): base = valor_diaria ?? valor_saida ?? 0 do Cadastro do Prestador.
 *                 Nunca usa tabelas_valores.percentual_prestador (sem fallback oculto).
 *                 Não soma diária + saída. Se ambos ausentes → 0 (não inventar valor).
 *  - "percentual": base = valor da tabela do cliente × percentual informado pelo operador.
 *  - "fixo":       base = valor fixo informado pelo operador (preservado).
 *
 * Cliente (tabela/precificação) e Prestador (cadastro/regra financeira) permanecem separados.
 */

export type ModoRepassePrestador = "cadastro" | "percentual" | "fixo";

export interface RepassePrestadorInput {
  modo: ModoRepassePrestador;
  valorDiaria?: number | null;
  valorSaida?: number | null;
  valorFixo?: number | null;
  percentual?: number | null;
  valorBaseCliente?: number | null;
}

export interface RepassePrestadorResult {
  base: number;
  origem: ModoRepassePrestador;
  percentual?: number;
}

const num = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

const temValorPositivo = (v: unknown): boolean => {
  if (v === null || v === undefined || v === "") return false;
  const n = Number(v);
  return !Number.isNaN(n) && n > 0;
};

export function resolverRepassePrestadorBase(
  input: RepassePrestadorInput
): RepassePrestadorResult {
  const modo: ModoRepassePrestador =
    input.modo === "percentual" || input.modo === "fixo" ? input.modo : "cadastro";

  if (modo === "percentual") {
    const percentual = num(input.percentual);
    const base = num(input.valorBaseCliente) * (percentual / 100);
    return { base, origem: "percentual", percentual };
  }

  if (modo === "fixo") {
    return { base: num(input.valorFixo), origem: "fixo" };
  }

  // cadastro (padrão): valor_diaria primeiro, fallback valor_saida, sem somar.
  if (temValorPositivo(input.valorDiaria)) {
    return { base: num(input.valorDiaria), origem: "cadastro" };
  }
  if (temValorPositivo(input.valorSaida)) {
    return { base: num(input.valorSaida), origem: "cadastro" };
  }
  return { base: 0, origem: "cadastro" };
}
