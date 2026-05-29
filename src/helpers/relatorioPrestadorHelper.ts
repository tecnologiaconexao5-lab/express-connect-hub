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
}

export function gerarLinhasRelatorio(
  pagamentos: Record<string, unknown>[],
  pagamentosManuais: Record<string, unknown>[]
): LinhaRelatorioPrestador[] {
  const linhas: LinhaRelatorioPrestador[] = [];

  pagamentos.forEach(p => {
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
    });
  });

  return linhas;
}

export function exportarCSV(linhas: LinhaRelatorioPrestador[]): void {
  const header = [
    "Prestador", "Documento", "Período Início", "Período Fim",
    "Qtd OS", "Serviços", "Adicionais", "Descontos", "Pedágio",
    "Reembolsos", "Bônus", "Adiantamentos", "Valor Líquido",
    "Status Pagamento", "Status Conferência", "Status Aprovação", "Origem"
  ];

  const rows = linhas.map(l => [
    l.prestadorNome,
    l.prestadorDocumento,
    l.periodoInicio,
    l.periodoFim,
    l.quantidadeOs,
    l.valorServicos.toFixed(2),
    l.valorAdicionais.toFixed(2),
    l.valorDescontos.toFixed(2),
    l.valorPedagio.toFixed(2),
    l.valorReembolsos.toFixed(2),
    l.valorBonus.toFixed(2),
    l.valorAdiantamentos.toFixed(2),
    l.valorLiquido.toFixed(2),
    l.statusPagamento,
    l.statusConferencia,
    l.statusAprovacao,
    l.origem,
  ]);

  const csvContent = [header.join(";"), ...rows.map(r => r.join(";"))].join("\n");
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
