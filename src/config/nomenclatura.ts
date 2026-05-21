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
