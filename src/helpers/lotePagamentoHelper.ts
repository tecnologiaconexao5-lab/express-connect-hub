// TMS-FIN-PROG-05D.7B.2 — helpers de lote/Tesouraria (puros, testaveis).
// A UI pre-filtra para UX; a autoridade e sempre a RPC f_gerar_lote_pagamentos.

export interface LinhaLote {
  id: string;
  prestador_id?: string | null;
  prestador_nome?: string | null;
  cliente_id?: string | null;
  cliente_nome?: string | null;
  valor_liquido?: number | null;
  valor_servicos?: number | null;
  pedagio?: number | null;
  adicionais?: number | null;
  periodo_fim?: string | null;
  origem_lancamento?: string | null;
  periodo_inicio?: string | null;
  data_competencia?: string | null;
  status_conferencia?: string | null;
  status_aprovacao?: string | null;
  elegivel_lote?: boolean | null;
  status_pagamento?: string | null;
  status?: string | null;
  lote_id?: string | null;
  is_teste?: boolean | null;
  tipo_pagamento?: string | null;
  os_numero?: string | null;
  created_at?: string | null;
}

const FINAIS_NAO_APTOS = ["pago", "cancelado"];

/** Pre-filtro de UX (espelha os guards da RPC, mas NAO e a autoridade). */
export function isAptoLote(p: LinhaLote): boolean {
  const sp = String(p.status_pagamento || p.status || "");
  return (
    p.status_conferencia === "conferido" &&
    p.status_aprovacao === "aprovado" &&
    p.elegivel_lote === true &&
    !FINAIS_NAO_APTOS.includes(sp) &&
    !p.lote_id &&
    p.is_teste !== true &&
    p.tipo_pagamento !== "fechamento"
  );
}

export interface ResumoLote {
  quantidade: number;
  prestadores: number;
  periodoMin: string | null;
  periodoMax: string | null;
  totalLiquido: number;
  porPrestador: { nome: string; quantidade: number; total: number }[];
}

const dataRef = (p: LinhaLote): string | null => (p.periodo_inicio || p.data_competencia || p.created_at || null)?.toString().slice(0, 10) || null;

export function resumoLoteSelecionado(items: LinhaLote[]): ResumoLote {
  const total = items.reduce((s, p) => s + (Number(p.valor_liquido) || 0), 0);
  const datas = items.map(dataRef).filter(Boolean) as string[];
  const porNome: Record<string, { quantidade: number; total: number }> = {};
  const prestadoresSet = new Set<string>();
  items.forEach((p) => {
    const key = String(p.prestador_id || p.prestador_nome || "sem_prestador");
    prestadoresSet.add(key);
    const nome = String(p.prestador_nome || "Sem prestador");
    porNome[nome] = porNome[nome] || { quantidade: 0, total: 0 };
    porNome[nome].quantidade += 1;
    porNome[nome].total += Number(p.valor_liquido) || 0;
  });
  return {
    quantidade: items.length,
    prestadores: prestadoresSet.size,
    periodoMin: datas.length ? datas.reduce((a, b) => (a < b ? a : b)) : null,
    periodoMax: datas.length ? datas.reduce((a, b) => (a > b ? a : b)) : null,
    totalLiquido: total,
    porPrestador: Object.entries(porNome).map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.total - a.total),
  };
}

/** Fila da Tesouraria (esta fase): SOMENTE lote realmente formado. */
export function filtrarFilaTesouraria(rows: LinhaLote[]): LinhaLote[] {
  return rows.filter(
    (p) =>
      p.status_aprovacao === "aprovado" &&
      p.elegivel_lote === true &&
      p.status_pagamento === "em_lote" &&
      !!p.lote_id &&
      p.is_teste !== true
  );
}

export interface GrupoLote {
  loteId: string;
  loteIdCurto: string;
  quantidade: number;
  prestadores: number;
  totalLiquido: number;
  periodoMin: string | null;
  periodoMax: string | null;
  statusLabel: string;
}

export function agruparLotesTesouraria(rows: LinhaLote[]): GrupoLote[] {
  const filtradas = filtrarFilaTesouraria(rows);
  const grupos: Record<string, LinhaLote[]> = {};
  filtradas.forEach((p) => {
    const lid = String(p.lote_id);
    (grupos[lid] = grupos[lid] || []).push(p);
  });
  return Object.entries(grupos)
    .map(([loteId, itens]) => {
      const r = resumoLoteSelecionado(itens);
      return {
        loteId,
        loteIdCurto: loteId.slice(0, 8),
        quantidade: r.quantidade,
        prestadores: r.prestadores,
        totalLiquido: r.totalLiquido,
        periodoMin: r.periodoMin,
        periodoMax: r.periodoMax,
        statusLabel: "Aguardando execução bancária",
      };
    })
    .sort((a, b) => (a.loteId < b.loteId ? -1 : 1));
}

export function loteIdCurto(loteId?: string | null): string {
  return loteId ? String(loteId).slice(0, 8) : "";
}

export interface FiltrosAptos {
  dataInicio?: string;
  dataFim?: string;
  prestadorId?: string | null;
  clienteId?: string | null;
  origem?: string;
  busca?: string;
}

/**
 * 05D.7B.3 — Fila unificada "Aptos para Lote" (todas as origens), com filtros
 * aplicados ANTES da paginacao. Nunca inclui teste/pago/cancelado/agregado/
 * ja-em-lote/elegivel=false (isAptoLote). Busca por Prestador OU OS.
 */
export function filtrarAptosLote(rows: LinhaLote[], f: FiltrosAptos): LinhaLote[] {
  const busca = (f.busca || "").trim().toLowerCase();
  const origemMap: Record<string, string> = { ordem_servico: "os_direta", escala: "escala_direta", manual: "manual" };
  const origemAlvo = f.origem && f.origem !== "todos" ? origemMap[f.origem] : undefined;
  return rows.filter((p) => {
    if (!isAptoLote(p)) return false;
    const d = (p.periodo_inicio || p.data_competencia || "").toString().slice(0, 10);
    if (f.dataInicio && d && d < f.dataInicio) return false;
    if (f.dataFim && d && d > f.dataFim) return false;
    if (f.prestadorId && p.prestador_id !== f.prestadorId) return false;
    if (f.clienteId && p.cliente_id !== f.clienteId) return false;
    if (origemAlvo && p.origem_lancamento !== origemAlvo) return false;
    if (busca && !((p.prestador_nome || "").toLowerCase().includes(busca) || (p.os_numero || "").toLowerCase().includes(busca))) return false;
    return true;
  });
}

export function totalLiquidoAptos(rows: LinhaLote[]): number {
  return rows.reduce((s, p) => s + (Number(p.valor_liquido) || 0), 0);
}
