// ============================================================
// ETAPA-2: Filtro rigoroso de veículo — Rede de Oportunidades
//
// Garante que uma OS publicada só apareça para prestadores cujo
// tipo de veículo corresponda exatamente ao exigido pela OS
// (ex.: OS de moto somente para prestadores com moto).
//
// Regra pura e determinística, reutilizada no TMS (lista de
// prestadores compatíveis) e no app/prestador (lista de oportunidades).
// ============================================================

/**
 * Normaliza o tipo de veículo para comparação:
 * - minúsculas, sem acentos e sem espaços/underscores
 * - resolve sinônimos comuns (motocicleta → moto, 3/4 → tres_quartos etc.)
 */
export function normalizarTipoVeiculo(valor?: string | null): string {
  if (!valor) return "";
  const base = String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const sinonimos: Record<string, string> = {
    moto: "moto",
    motos: "moto",
    motocicleta: "moto",
    motocicletas: "moto",
    motoboy: "moto",
    motorcycle: "moto",
    carro: "carro_passeio",
    carro_passeio: "carro_passeio",
    passeio: "carro_passeio",
    veiculo_passeio: "carro_passeio",
    veiculo_de_passeio: "carro_passeio",
    utilitario: "fiorino",
    "3_4": "tres_quartos",
    tres_quartos: "tres_quartos",
    tresquartos: "tres_quartos",
    "34": "tres_quartos",
    vuc: "vuc",
    hr: "hr",
    van: "van",
    fiorino: "fiorino",
    kangoo: "kangoo",
    kombi: "kombi",
    toco: "toco",
    truck: "truck",
    caminhao_truck: "truck",
    bitruck: "bitruck",
    bi_truck: "bitruck",
    carreta: "carreta",
    bitrem: "bitrem",
  };

  return sinonimos[base] || base;
}

/**
 * Extrai a lista normalizada de tipos de veículo de um prestador.
 * Considera o campo único `veiculo_tipo` e/ou a coleção `veiculos`.
 */
export function tiposVeiculoDoPrestador(prestador: {
  veiculo_tipo?: string | null;
  veiculos?: unknown;
} | null | undefined): string[] {
  const tipos = new Set<string>();

  if (prestador?.veiculo_tipo) {
    const t = normalizarTipoVeiculo(prestador.veiculo_tipo);
    if (t) tipos.add(t);
  }

  const lista = Array.isArray(prestador?.veiculos) ? (prestador!.veiculos as any[]) : [];
  for (const v of lista) {
    const bruto = v?.tipo_veiculo || v?.tipo || v?.categoria || v?.veiculo_tipo;
    const t = normalizarTipoVeiculo(bruto);
    if (t) tipos.add(t);
  }

  return [...tipos];
}

/**
 * Verificação rigorosa de compatibilidade de veículo.
 *
 * - Sem tipo exigido pela OS → compatível (nada a restringir).
 * - Com tipo exigido → o prestador precisa declarar o MESMO tipo normalizado.
 *   Prestador sem veículo declarado NÃO é considerado compatível.
 */
export function veiculoCompativel(
  tipoNecessario?: string | null,
  tiposPrestador: string[] = []
): boolean {
  const necessario = normalizarTipoVeiculo(tipoNecessario);
  if (!necessario) return true;
  const normalizados = new Set(tiposPrestador.map((t) => normalizarTipoVeiculo(t)).filter(Boolean));
  return normalizados.has(necessario);
}

/**
 * Atalho: verifica um prestador (objeto) contra o tipo exigido.
 */
export function prestadorCompativelComVeiculo(
  tipoNecessario?: string | null,
  prestador?: { veiculo_tipo?: string | null; veiculos?: unknown } | null
): boolean {
  return veiculoCompativel(tipoNecessario, tiposVeiculoDoPrestador(prestador));
}
