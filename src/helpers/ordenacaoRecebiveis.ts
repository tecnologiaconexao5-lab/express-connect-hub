// ═══════════════════════════════════════════════════════════════════════════════
// TMS-FIN-AR-UX-01 — Ordenação de recebíveis (função pura, reutilizável/testável).
// Default: MAIS RECENTE -> MAIS ANTIGO por created_at (desempate estável por id).
// A ordenação deve ocorrer sobre o CONJUNTO COMPLETO, ANTES da paginação.
// ═══════════════════════════════════════════════════════════════════════════════

export interface RecebivelOrdenavel {
  id?: string | number;
  createdAt?: string;
  dataVencimento?: string;
  valorLiquido?: number;
}

export function compararRecebiveis(a: RecebivelOrdenavel, b: RecebivelOrdenavel, ordenacao: string): number {
  const idAsc = (x: RecebivelOrdenavel, y: RecebivelOrdenavel) => String(x.id).localeCompare(String(y.id));
  switch (ordenacao) {
    case "recente_desc":
      return (b.createdAt || "").localeCompare(a.createdAt || "") || idAsc(a, b);
    case "vencimento_desc":
      return (b.dataVencimento || "").localeCompare(a.dataVencimento || "") || idAsc(a, b);
    case "vencimento_asc":
      return (a.dataVencimento || "").localeCompare(b.dataVencimento || "") || idAsc(a, b);
    case "valor_desc":
      return (b.valorLiquido || 0) - (a.valorLiquido || 0);
    case "valor_asc":
      return (a.valorLiquido || 0) - (b.valorLiquido || 0);
    default:
      // default = mais recente primeiro (created_at desc; desempate estável por id asc)
      return (b.createdAt || "").localeCompare(a.createdAt || "") || idAsc(a, b);
  }
}

/** Retorna uma NOVA lista ordenada (não muta a original). */
export function ordenarRecebiveis<T extends RecebivelOrdenavel>(lista: T[], ordenacao: string): T[] {
  return [...lista].sort((a, b) => compararRecebiveis(a, b, ordenacao));
}
