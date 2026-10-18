/**
 * CAD-VEIC-02 — Persistência canônica do tipo de veículo.
 *
 * Campo CANÔNICO: veiculos.tipo_veiculo
 * Campo LEGADO:   veiculos.tipo
 *
 * Novos ADD/EDIT gravam `tipo_veiculo` (canônico) e espelham `tipo` (legado)
 * para preservar leitores antigos que usam fallback (`tipo_veiculo || tipo`).
 */

export const VEICULO_PAYLOAD_ALLOWLIST: string[] = [
  'placa', 'tipo', 'tipo_veiculo', 'marca', 'modelo', 'ano', 'renavam', 'antt',
  'proprietario_nome', 'proprietario_documento', 'capacidade_kg', 'capacidade_m3',
  'comprimento_m', 'largura_m', 'altura_m', 'tipo_carga', 'temperatura_min',
  'temperatura_max', 'rastreador', 'seguro', 'restricoes_regiao', 'observacoes',
  'principal', 'status', 'prestador_vinculado', 'updated_at'
];

/** Mantém apenas colunas conhecidas de `veiculos` (inclui `tipo_veiculo` canônico). */
export function sanitizeVeiculoPayload(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const key of VEICULO_PAYLOAD_ALLOWLIST) {
    if (data[key] !== undefined) {
      sanitized[key] = data[key];
    }
  }
  return sanitized;
}

/**
 * Campos de tipo do veículo para o payload.
 * Grava o CANÔNICO `tipo_veiculo` e espelha o legado `tipo`.
 * Sem tipo explícito → objeto vazio (nada é gravado; sem default artificial).
 */
export function camposTipoVeiculo(tipoVeiculo: unknown): Record<string, string> {
  if (tipoVeiculo === null || tipoVeiculo === undefined) return {};
  const v = String(tipoVeiculo).trim();
  if (!v) return {};
  return { tipo_veiculo: v, tipo: v };
}

/** Leitura: canônico primeiro, fallback legado (registros antigos). */
export function lerTipoVeiculo(row: { tipo_veiculo?: unknown; tipo?: unknown } | null | undefined): string {
  if (!row) return "";
  const canon = row.tipo_veiculo;
  if (canon !== null && canon !== undefined && String(canon).trim() !== "") return String(canon);
  const legado = row.tipo;
  if (legado !== null && legado !== undefined && String(legado).trim() !== "") return String(legado);
  return "";
}
