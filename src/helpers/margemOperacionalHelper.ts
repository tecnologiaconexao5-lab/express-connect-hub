// TMS-FIN-MARGEM-01 — helpers puros de Margem Operacional (testaveis).
// Resolve OS/cliente em ETAPAS (sem embed PostgREST, pois nao ha FK
// composicao_financeira_os -> ordens_servico).

export interface MargemOS {
  os_id: string;
  os_numero: string;
  cliente: string;
  valor_cliente: number;
  valor_prestador: number;
  pedagio_valor: number;
  margem_liquida: number;
  percentual_margem_liquida: number;
  alerta: boolean;
}

export interface ComposicaoRow {
  id: string;
  os_id: string | null;
  valor_cliente: number | null;
  valor_prestador: number | null;
  pedagio_valor: number | null;
  margem_liquida: number | null;
}

export interface OsInfo {
  numero: string | null;
  cliente: string | null;
  is_teste: boolean | null;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Monta as linhas de margem a partir das composicoes + mapa de OS + nomes de
 * cliente. Exclui is_teste=true (nao infla indicador real). Registros sem OS
 * ou com OS orfa NAO derrubam a tela (rotulo "Sem OS"/"—").
 * Margem usa o valor REAL armazenado (margem_liquida); fallback apenas se ausente.
 */
export function montarMargens(
  rows: ComposicaoRow[],
  osMap: Record<string, OsInfo | undefined>,
  nomePorCliente: Record<string, string> = {}
): MargemOS[] {
  return (rows || [])
    .filter((item) => osMap[item.os_id || ""]?.is_teste !== true)
    .map((item) => {
      const os = item.os_id ? osMap[item.os_id] : undefined;
      const receita = num(item.valor_cliente);
      const custoPrest = num(item.valor_prestador);
      const pedagio = num(item.pedagio_valor);
      const margemLiq = item.margem_liquida != null ? num(item.margem_liquida) : receita - custoPrest - pedagio;
      const margemPct = receita > 0 ? margemLiq / receita : 0;
      return {
        os_id: item.os_id || item.id,
        os_numero: os?.numero || (item.os_id ? `OS-${String(item.os_id).slice(0, 8)}` : "Sem OS"),
        cliente: (os?.cliente && nomePorCliente[os.cliente]) || "—",
        valor_cliente: receita,
        valor_prestador: custoPrest,
        pedagio_valor: pedagio,
        margem_liquida: margemLiq,
        percentual_margem_liquida: Number.isFinite(margemPct) ? margemPct : 0,
        alerta: margemPct < 0.05,
      };
    });
}

export interface ResumoMargens {
  receitaTotal: number;
  custoTotal: number;
  margemTotal: number;
  margemMedia: number;
}

export function resumirMargens(margens: MargemOS[]): ResumoMargens {
  const receitaTotal = margens.reduce((s, m) => s + m.valor_cliente, 0);
  const custoTotal = margens.reduce((s, m) => s + m.valor_prestador + m.pedagio_valor, 0);
  const margemTotal = margens.reduce((s, m) => s + m.margem_liquida, 0);
  const margemMedia = receitaTotal > 0 ? margemTotal / receitaTotal : 0;
  return { receitaTotal, custoTotal, margemTotal, margemMedia };
}
