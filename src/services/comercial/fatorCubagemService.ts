// ═══════════════════════════════════════════════════════════════════════════════
// TMS-COM-CARGA-04 — Regras de fator de cubagem (kg/m³) parametrizáveis.
// Fonte OFICIAL: configuracoes_sistema['fator_cubagem_regras'] (backend/Supabase).
// LocalStorage é apenas cache temporário (via configuracoesService), nunca oficial.
// Precedência: regra da modalidade → regra padrão geral → sem fator.
// Preparado para regra específica de provider (Fracionado) sem alterar a carga.
// ═══════════════════════════════════════════════════════════════════════════════
import { carregarConfiguracaoSistema, salvarConfiguracaoSistema } from "@/services/configuracoesService";
import { FATOR_CONTEXTO_PADRAO, FATOR_CONTEXTOS_REAIS, type RegraFatorCubagem } from "@/components/comercial/cargaCalculo";

export const CHAVE_FATOR_CUBAGEM = "fator_cubagem_regras";

export { FATOR_CONTEXTO_PADRAO, FATOR_CONTEXTOS_REAIS };

/** Regras padrão vazias (sem fator inventado) — uma linha por contexto real. */
export function regrasFatorCubagemPadrao(): RegraFatorCubagem[] {
  return FATOR_CONTEXTOS_REAIS.map((c) => ({ contexto: c.value, fatorKgM3: 0, ativo: false }));
}

/** Normaliza/valida as regras carregadas. */
function normalizar(rows: unknown): RegraFatorCubagem[] {
  if (!Array.isArray(rows)) return [];
  return (rows as RegraFatorCubagem[])
    .filter((r) => r && typeof r.contexto === "string")
    .map((r) => ({ contexto: r.contexto, fatorKgM3: Number(r.fatorKgM3) || 0, ativo: r.ativo !== false }));
}

/** Mescla regras salvas sobre o padrão (mantém todos os contextos reais visíveis). */
export function mesclarRegrasFator(salvo: unknown): RegraFatorCubagem[] {
  const base = new Map(regrasFatorCubagemPadrao().map((r) => [r.contexto, r]));
  for (const r of normalizar(salvo)) base.set(r.contexto, r);
  return [...base.values()];
}

/** Carrega as regras oficiais (fallback: apenas os contextos vazios). */
export async function carregarRegrasFatorCubagem(): Promise<RegraFatorCubagem[]> {
  try {
    const salvo = await carregarConfiguracaoSistema(CHAVE_FATOR_CUBAGEM);
    if (salvo) return mesclarRegrasFator(salvo);
  } catch {
    /* sem regras salvas */
  }
  return regrasFatorCubagemPadrao();
}

/** Salva as regras no backend (configuracoes_sistema). */
export async function salvarRegrasFatorCubagem(rows: RegraFatorCubagem[]): Promise<void> {
  await salvarConfiguracaoSistema(CHAVE_FATOR_CUBAGEM, rows);
}
