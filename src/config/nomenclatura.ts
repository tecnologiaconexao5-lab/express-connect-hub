// Configuração flexível de nomenclatura do sistema
// Permite customização de labels para diferentes tipos de operações

export const NOMENCLATURA_PADRAO = {
  labelOS: "Ordem de Serviço",
  siglaSO: "OS",
  labelOperacao: "Operação",
  labelCarregamento: "Ordem de Carregamento",
  labelExtrato: "Extrato Operacional",
  labelRelatorioPDF: "Relatório de Faturamento Operacional",
} as const;

export type Nomenclatura = typeof NOMENCLATURA_PADRAO;

/**
 * Tipos operacionais que devem ser apresentados como
 * "Ordem de Carregamento" (OC) em vez de "Ordem de Serviço" (OS)
 * no PDF e nas comunicações com cliente/prestador.
 */
const TIPOS_CARREGAMENTO = new Set<string>([
  "transferencia",
  "transferência",
  "distribuicao",
  "distribuição",
  "dedicado",
  "carregamento",
  "carga",
  "carga fracionada",
  "carga lotacao",
  "carga lotação",
  "lotacao",
  "lotação",
]);

/**
 * Resolve a nomenclatura adequada (label + sigla) com base no
 * tipo operacional da OS. Mantém compatibilidade com a config
 * customizada salva em localStorage.
 *
 * Ex.: tipo "Transferência" → { labelOS: "Ordem de Carregamento", siglaSO: "OC" }
 *      tipo "Coleta e Entrega" → { labelOS: "Ordem de Serviço",     siglaSO: "OS" }
 */
export const resolverNomenclaturaPorTipo = (
  tipoOperacao?: string | null
): Nomenclatura => {
  const base = obterNomenclatura();
  if (!tipoOperacao) return base;

  const norm = String(tipoOperacao).trim().toLowerCase();
  if (TIPOS_CARREGAMENTO.has(norm)) {
    return {
      ...base,
      labelOS: base.labelCarregamento || "Ordem de Carregamento",
      siglaSO: "OC",
    };
  }
  return base;
};

export const obterNomenclatura = (): Nomenclatura => {
  try {
    if (typeof window === "undefined") return NOMENCLATURA_PADRAO;

    const stored = localStorage.getItem("empresa_identidade_visual");
    if (!stored) return NOMENCLATURA_PADRAO;

    const config = JSON.parse(stored);
    const customNomenclatura = config.nomenclatura;

    if (!customNomenclatura) return NOMENCLATURA_PADRAO;

    return { ...NOMENCLATURA_PADRAO, ...customNomenclatura };
  } catch (e) {
    console.warn("Erro ao carregar nomenclatura customizada:", e);
    return NOMENCLATURA_PADRAO;
  }
};

export const salvarNomenclatura = (nomenclatura: Partial<Nomenclatura>) => {
  try {
    if (typeof window === "undefined") return;

    const stored = localStorage.getItem("empresa_identidade_visual");
    const config = stored ? JSON.parse(stored) : {};

    config.nomenclatura = { ...config.nomenclatura, ...nomenclatura };

    localStorage.setItem("empresa_identidade_visual", JSON.stringify(config));
  } catch (e) {
    console.error("Erro ao salvar nomenclatura:", e);
  }
};
