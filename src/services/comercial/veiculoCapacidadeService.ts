// ═══════════════════════════════════════════════════════════════════════════════
// TMS-COM-CARGA-03 — Persistência da capacidade parametrizável de veículos.
// Reutiliza configuracoes_sistema (chave 'veiculo_capacidades') — SEM migration,
// SEM tabela paralela. Default derivado de VEICULO_PARAMETROS (origem explícita).
// Preparado para Dedicado/Conexão Exclusivo/Fracionado/Parceiros/Providers.
// ═══════════════════════════════════════════════════════════════════════════════
import { carregarConfiguracaoSistema, salvarConfiguracaoSistema } from "@/services/configuracoesService";
import { catalogoPadraoVeiculo, type VeiculoCapacidade } from "@/components/comercial/cargaCalculo";

export const CHAVE_CAPACIDADES_VEICULO = "veiculo_capacidades";

/** Catálogo padrão (derivado do sistema). Reexport para conveniência. */
export function capacidadesPadraoVeiculo(): VeiculoCapacidade[] {
  return catalogoPadraoVeiculo();
}

/** Mescla o catálogo salvo (configuracoes_sistema) por cima do padrão. */
export function mesclarCapacidades(salvo: unknown, padrao: VeiculoCapacidade[] = capacidadesPadraoVeiculo()): VeiculoCapacidade[] {
  const map = new Map(padrao.map((p) => [p.tipo, p]));
  if (Array.isArray(salvo)) {
    for (const row of salvo as VeiculoCapacidade[]) {
      if (!row || !row.tipo) continue;
      map.set(row.tipo, { ...(map.get(row.tipo) || {}), ...row } as VeiculoCapacidade);
    }
  }
  return [...map.values()];
}

/** Carrega o catálogo efetivo (padrão + overrides salvos). */
export async function carregarCapacidadesVeiculo(): Promise<VeiculoCapacidade[]> {
  const padrao = capacidadesPadraoVeiculo();
  try {
    const salvo = await carregarConfiguracaoSistema(CHAVE_CAPACIDADES_VEICULO);
    if (salvo && Array.isArray(salvo) && salvo.length > 0) return mesclarCapacidades(salvo, padrao);
  } catch {
    /* usa padrão */
  }
  return padrao;
}

/** Salva o catálogo parametrizado em configuracoes_sistema. */
export async function salvarCapacidadesVeiculo(rows: VeiculoCapacidade[]): Promise<void> {
  await salvarConfiguracaoSistema(CHAVE_CAPACIDADES_VEICULO, rows);
}
