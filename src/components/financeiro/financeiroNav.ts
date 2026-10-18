// F0-L — Navegação financeira: grupos claros (fonte única de verdade).
// A página Financeiro renderiza os grupos a partir destes dados (sem seta escondida).

export interface FinanceiroNavItem {
  valor: string;
  label: string;
}

export interface FinanceiroNavGrupo {
  grupo: string;
  itens: FinanceiroNavItem[];
}

export const GRUPOS_NAVEGACAO: FinanceiroNavGrupo[] = [
  {
    grupo: "Visão Geral",
    itens: [
      { valor: "dashboard", label: "Dashboard" },
      { valor: "pendencias", label: "Pendências" },
    ],
  },
  {
    grupo: "Faturamento",
    itens: [
      { valor: "conferencia", label: "Conferência" },
      { valor: "faturas", label: "Faturas" },
      { valor: "receber", label: "Contas a Receber" },
      { valor: "inadimplencia", label: "Inadimplência" },
      { valor: "relatorio-faturamento", label: "Relatório de Faturamento" },
    ],
  },
  {
    grupo: "Pagamentos",
    itens: [
      { valor: "pagar", label: "Contas a Pagar" },
      { valor: "pagamento-prestadores", label: "Pag. Prestadores" },
    ],
  },
  {
    grupo: "Tesouraria",
    itens: [
      { valor: "fluxo", label: "Fluxo de Caixa" },
      { valor: "contas-caixas", label: "Contas & Caixas" },
      { valor: "conciliacao", label: "Conciliação" },
      { valor: "lotes", label: "CNAB" },
    ],
  },
  {
    grupo: "Gestão",
    itens: [
      { valor: "dre", label: "DRE" },
      { valor: "margem-os", label: "Margem por OS" },
      { valor: "relatorios", label: "Relatórios" },
      { valor: "recibos", label: "Recibos" },
    ],
  },
  {
    grupo: "Outros (legado)",
    itens: [
      { valor: "margem", label: "Margem (legado)" },
      { valor: "rentabilidade", label: "Rentabilidade" },
      { valor: "seguros-auto", label: "Seguros Auto" },
      { valor: "contabilidade", label: "Contabilidade" },
    ],
  },
  {
    grupo: "Configurações",
    itens: [
      { valor: "plano-contas", label: "Plano de Contas" },
      { valor: "config-financeira", label: "Config. Financeiras" },
      { valor: "regras-cliente", label: "Regras por Cliente" },
    ],
  },
];

/** Módulos críticos que nunca podem ficar escondidos atrás de seta. */
export const MODULOS_CRITICOS = [
  "dashboard", "conferencia", "faturas", "receber", "inadimplencia",
  "relatorio-faturamento",
  "pagar", "pagamento-prestadores", "fluxo", "contas-caixas",
  "conciliacao", "lotes", "dre", "margem-os", "relatorios", "recibos",
  "plano-contas", "config-financeira", "regras-cliente",
];

export const TODOS_VALORES_NAV = GRUPOS_NAVEGACAO.flatMap((g) => g.itens.map((i) => i.valor));

// TMS-LAYOUT-02 — Navegação em 2 níveis.
// Categoria (nível 1) derivada automaticamente da aba ativa (nível 2).
// A rota já identifica a aba → nenhum clique extra é necessário.

/** Retorna a categoria (grupo) que contém a aba informada. Fallback: Faturamento. */
export function grupoPorTab(tab: string): FinanceiroNavGrupo {
  return (
    GRUPOS_NAVEGACAO.find((g) => g.itens.some((i) => i.valor === tab)) ?? GRUPOS_NAVEGACAO[1]
  );
}

/** Função padrão de um grupo (primeira do grupo) — usada ao trocar de categoria. */
export function funcaoPadraoDoGrupo(grupo: FinanceiroNavGrupo): string {
  return grupo.itens[0]?.valor ?? "";
}
