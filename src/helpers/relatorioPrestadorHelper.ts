export interface LinhaRelatorioPrestador {
  prestadorNome: string;
  prestadorDocumento: string;
  periodoInicio: string;
  periodoFim: string;
  quantidadeOs: number;
  valorServicos: number;
  valorAdicionais: number;
  valorDescontos: number;
  valorPedagio: number;
  valorReembolsos: number;
  valorBonus: number;
  valorAdiantamentos: number;
  valorLiquido: number;
  statusPagamento: string;
  statusConferencia: string;
  statusAprovacao: string;
  origem: string;
  // 05D.6D.1 — vínculo real (por ID) para filtros funcionais
  clienteId: string;
  clienteNome: string;
  osNumero: string;
}

export interface ClienteResolvido {
  clienteId: string;
  clienteNome: string;
}

export function gerarLinhasRelatorio(
  pagamentos: Record<string, unknown>[],
  pagamentosManuais: Record<string, unknown>[],
  resolverCliente?: (pagamento: Record<string, unknown>) => ClienteResolvido
): LinhaRelatorioPrestador[] {
  const linhas: LinhaRelatorioPrestador[] = [];

  pagamentos.forEach(p => {
    const cli = resolverCliente ? resolverCliente(p) : { clienteId: String(p.cliente_id || ""), clienteNome: String(p.cliente_nome || "") };
    linhas.push({
      prestadorNome: String(p.prestador_nome || ""),
      prestadorDocumento: String(p.prestador_documento || ""),
      periodoInicio: String(p.periodo_inicio || "").slice(0, 10),
      periodoFim: String(p.periodo_fim || "").slice(0, 10),
      quantidadeOs: Number(p.quantidade_os || 0),
      valorServicos: Number(p.valor_servicos || 0),
      valorAdicionais: Number(p.valor_adicionais || 0),
      valorDescontos: Number(p.valor_descontos || 0),
      valorPedagio: Number(p.valor_pedagio || 0),
      valorReembolsos: Number(p.valor_reembolsos || 0),
      valorBonus: Number(p.valor_bonus || 0),
      valorAdiantamentos: Number(p.valor_adiantamentos || 0),
      valorLiquido: Number(p.valor_liquido || 0),
      statusPagamento: String(p.status_pagamento || p.status || "pendente"),
      statusConferencia: String(p.status_conferencia || ""),
      statusAprovacao: String(p.status_aprovacao || ""),
      origem: String(p.origem_lancamento || ""),
      clienteId: cli.clienteId || "",
      clienteNome: cli.clienteNome || "",
      osNumero: String(p.os_numero || ""),
    });
  });

  pagamentosManuais.forEach(p => {
    const vl = p.natureza === "credito" ? Number(p.valor || 0) : -Number(p.valor || 0);
    linhas.push({
      prestadorNome: String(p.prestador_nome || ""),
      prestadorDocumento: String(p.prestador_documento || ""),
      periodoInicio: String(p.data_competencia || "").slice(0, 10),
      periodoFim: String(p.data_competencia || "").slice(0, 10),
      quantidadeOs: p.os_id ? 1 : 0,
      valorServicos: vl > 0 ? vl : 0,
      valorAdicionais: 0,
      valorDescontos: vl < 0 ? Math.abs(vl) : 0,
      valorPedagio: 0,
      valorReembolsos: 0,
      valorBonus: 0,
      valorAdiantamentos: 0,
      valorLiquido: vl,
      statusPagamento: String(p.status_pagamento || "pendente"),
      statusConferencia: String(p.status_conferencia || ""),
      statusAprovacao: String(p.status_aprovacao || ""),
      origem: String(p.origem_lancamento || "manual"),
      clienteId: String(p.cliente_id || ""),
      clienteNome: String(p.cliente_nome || ""),
      osNumero: String(p.os_numero || ""),
    });
  });

  return linhas;
}

export interface FiltrosLinhaRelatorio {
  dataInicio?: string;
  dataFim?: string;
  prestadorNome?: string | null;
  clienteId?: string | null;
  origem?: string;
  status?: string;
  busca?: string;
}

const ORIGEM_PARA_LANCAMENTO: Record<string, string> = {
  ordem_servico: "os_direta",
  escala: "escala_direta",
  manual: "manual",
};

/**
 * Filtra o conjunto COMPLETO antes da paginacao (05D.6D.1).
 * Periodo pela DATA DO SERVICO (periodoInicio). Busca por Prestador OU OS.
 */
export function filtrarLinhasRelatorio(
  linhas: LinhaRelatorioPrestador[],
  filtros: FiltrosLinhaRelatorio
): LinhaRelatorioPrestador[] {
  const busca = (filtros.busca || "").trim().toLowerCase();
  const origemAlvo = filtros.origem && filtros.origem !== "todos" ? ORIGEM_PARA_LANCAMENTO[filtros.origem] : undefined;
  return linhas.filter((l) => {
    if (filtros.dataInicio && l.periodoInicio && l.periodoInicio < filtros.dataInicio) return false;
    if (filtros.dataFim && l.periodoInicio && l.periodoInicio > filtros.dataFim) return false;
    if (filtros.prestadorNome && l.prestadorNome !== filtros.prestadorNome) return false;
    if (filtros.clienteId && l.clienteId !== filtros.clienteId) return false;
    if (origemAlvo && l.origem !== origemAlvo) return false;
    if (filtros.status && filtros.status !== "todos" && (l.statusPagamento || "pendente") !== filtros.status) return false;
    if (busca && !((l.prestadorNome || "").toLowerCase().includes(busca) || (l.osNumero || "").toLowerCase().includes(busca))) return false;
    return true;
  });
}

export function paginarLinhas<T>(linhas: T[], page: number, pageSize: number): T[] {
  const inicio = (Math.max(1, page) - 1) * pageSize;
  return linhas.slice(inicio, inicio + pageSize);
}

export function montarLinhasCSV(linhas: LinhaRelatorioPrestador[]): { header: string[]; rows: (string | number)[][] } {
  const header = [
    "Data Serviço", "Prestador", "Cliente", "OS", "Origem",
    "Serviço", "Pedágio", "Adicional", "Descontos", "Reembolsos", "Bônus", "Adiantamentos",
    "Líquido", "Status Pagamento", "Status Conferência", "Status Aprovação",
  ];
  const rows = linhas.map((l) => [
    l.periodoInicio,
    l.prestadorNome,
    l.clienteNome,
    l.osNumero,
    l.origem,
    l.valorServicos.toFixed(2),
    l.valorPedagio.toFixed(2),
    l.valorAdicionais.toFixed(2),
    l.valorDescontos.toFixed(2),
    l.valorReembolsos.toFixed(2),
    l.valorBonus.toFixed(2),
    l.valorAdiantamentos.toFixed(2),
    l.valorLiquido.toFixed(2),
    l.statusPagamento,
    l.statusConferencia,
    l.statusAprovacao,
  ]);
  return { header, rows };
}

export function exportarCSV(linhas: LinhaRelatorioPrestador[]): void {
  const { header, rows } = montarLinhasCSV(linhas);
  const csvContent = [header.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `relatorio_prestadores_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export function imprimirRelatorio(): void {
  window.print();
}
