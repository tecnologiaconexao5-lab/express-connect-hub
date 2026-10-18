// ============================================================================
// helpers/rls.ts — Cenário 4 (TMS-01-SEC / RLS com JWT de motorista)
// ----------------------------------------------------------------------------
// Utilitários finos sobre PostgREST para validar isolamento de linhas (RLS) com
// o JWT de um motorista autenticado. Uma consulta é considerada "bloqueada"
// quando o banco devolve erro OU zero linhas (RLS filtra silenciosamente).
// ============================================================================
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ResultadoAcesso {
  /** Linhas retornadas (SELECT) ou afetadas (UPDATE/DELETE/INSERT). */
  linhas: Record<string, unknown>[];
  erro?: string;
  /** true quando o acesso foi negado/filtrado (erro ou 0 linhas). */
  bloqueado: boolean;
}

function montarResultado(
  data: unknown,
  error: { message: string } | null,
): ResultadoAcesso {
  const linhas = (Array.isArray(data) ? data : data ? [data] : []) as Record<string, unknown>[];
  return { linhas, erro: error?.message, bloqueado: !!error || linhas.length === 0 };
}

/** SELECT em uma tabela, opcionalmente filtrando por uma coluna/valor. */
export async function ler(
  client: SupabaseClient,
  tabela: string,
  coluna?: string,
  valor?: string,
  colunas = "*",
): Promise<ResultadoAcesso> {
  let q: any = client.from(tabela).select(colunas);
  if (coluna && valor !== undefined) q = q.eq(coluna, valor);
  const { data, error } = await q;
  return montarResultado(data, error);
}

/** UPDATE por id (ou coluna/valor) retornando as linhas afetadas. */
export async function atualizar(
  client: SupabaseClient,
  tabela: string,
  patch: Record<string, unknown>,
  coluna: string,
  valor: string,
): Promise<ResultadoAcesso> {
  const { data, error } = await client
    .from(tabela)
    .update(patch)
    .eq(coluna, valor)
    .select("*");
  return montarResultado(data, error);
}

/** INSERT retornando a(s) linha(s) criada(s). */
export async function inserir(
  client: SupabaseClient,
  tabela: string,
  registro: Record<string, unknown>,
): Promise<ResultadoAcesso> {
  const { data, error } = await client.from(tabela).insert(registro).select("*");
  return montarResultado(data, error);
}

/** true se alguma linha possui `campo === id`. */
export function contemId(
  linhas: Record<string, unknown>[],
  campo: string,
  id: string,
): boolean {
  return linhas.some((l) => String(l[campo]) === String(id));
}
