import * as XLSX from "xlsx";

interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  format?: string;
}

export const exportToExcel = (
  data: any[],
  columns: ExcelColumn[],
  filename: string,
  title?: string
) => {
  const wb = XLSX.utils.book_new();

  const headerRow = columns.map((c) => c.header);
  const dataRows = data.map((item) =>
    columns.map((col) => item[col.key] ?? "")
  );

  const wsData = [];
  if (title) {
    wsData.push([title]);
    wsData.push([]);
  }
  wsData.push(headerRow);
  wsData.push(...dataRows);

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const colWidths = columns.map((c) => ({ wch: c.width || 15 }));
  ws["!cols"] = colWidths;

  if (title) {
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } },
    ];
  }

  const wbName = `${filename.replace(/[^a-z0-9]/gi, "_")}.xlsx`;
  XLSX.writeFile(wb, wbName);
};

export const exportFaturamentoToExcel = (
  data: any[],
  periodoLabel: string
) => {
  const columns: ExcelColumn[] = [
    { header: "Cliente", key: "cliente_nome", width: 30 },
    { header: "CNPJ", key: "cliente_cnpj", width: 20 },
    { header: "Qtd OS", key: "quantidade_os", width: 10 },
    { header: "Valor Faturado", key: "valor_faturado", width: 18 },
    { header: "Valor Pago", key: "valor_pago", width: 18 },
    { header: "Pendência", key: "valor_pendente", width: 18 },
    { header: "Ticket Médio", key: "ticket_medio", width: 18 },
    { header: "Última Operação", key: "ultima_operacao", width: 15 },
    { header: "Margem Total", key: "margem_total", width: 18 },
  ];

  exportToExcel(
    data,
    columns,
    `faturamento_clientes_${periodoLabel}`,
    `Relatório de Faturamento por Cliente - ${periodoLabel}`
  );
};

export const exportPagamentoToExcel = (
  data: any[],
  periodoLabel: string
) => {
  const columns: ExcelColumn[] = [
    { header: "Data", key: "data_formatada", width: 12 },
    { header: "OS", key: "numero", width: 14 },
    { header: "Cliente", key: "cliente_nome", width: 25 },
    { header: "Prestador", key: "prestador_nome", width: 25 },
    { header: "Tipo Serviço", key: "veiculo_tipo", width: 15 },
    { header: "Origem", key: "origem", width: 15 },
    { header: "Destino", key: "destino", width: 15 },
    { header: "Valor Operação", key: "custo_prestador", width: 16 },
    { header: "Adicional", key: "adicionais", width: 14 },
    { header: "Desconto", key: "descontos", width: 14 },
    { header: "Valor Final Repasse", key: "valor_final_repasse", width: 18 },
    { header: "Status", key: "status_pagamento", width: 12 },
  ];

  const enrichedData = data.map((item) => ({
    ...item,
    data_formatada: item.data_finalizacao
      ? new Date(item.data_finalizacao + "T12:00:00").toLocaleDateString("pt-BR")
      : "-",
    origem: item.enderecos?.[0]?.cidade || item.origem || "-",
    destino:
      item.enderecos?.[item.enderecos.length - 1]?.cidade ||
      item.destino ||
      "-",
  }));

  exportToExcel(
    enrichedData,
    columns,
    `pagamento_prestadores_${periodoLabel}`,
    `Relatório de Repasses a Prestadores - ${periodoLabel}`
  );
};

export const exportPrestadoresToExcel = (data: any[], periodoLabel: string) => {
  const columns: ExcelColumn[] = [
    { header: "Prestador", key: "nome", width: 30 },
    { header: "CPF/CNPJ", key: "cpf_cnpj", width: 20 },
    { header: "Tipo", key: "tipo_parceiro", width: 15 },
    { header: "Cidade", key: "cidade", width: 15 },
    { header: "UF", key: "uf", width: 5 },
    { header: "Veículo", key: "veiculo_principal", width: 15 },
    { header: "Operações", key: "operacoes_finalizadas", width: 12 },
    { header: "Valor Recebido", key: "valor_recebido", width: 18 },
    { header: "Score", key: "score_interno", width: 8 },
    { header: "Status", key: "status", width: 12 },
    { header: "Última Operação", key: "ultima_operacao", width: 15 },
  ];

  exportToExcel(
    data,
    columns,
    `prestadores_${periodoLabel}`,
    `Relatório de Prestadores - ${periodoLabel}`
  );
};

export const exportClienteAgregadoRefrigeradoToExcel = (
  data: any[],
  clienteNome: string,
  prestadorNome: string,
  periodoLabel: string
) => {
  const columns: ExcelColumn[] = [
    { header: "DATA VIAGEM", key: "data_viagem", width: 12 },
    { header: "MOTORISTA", key: "motorista", width: 25 },
    { header: "PLACA", key: "placa", width: 12 },
    { header: "TIPO DE VEÍCULO", key: "tipo_veiculo", width: 18 },
    { header: "Observação", key: "observacao", width: 20 },
    { header: "HORÁRIO CHEGADA", key: "horario_chegada", width: 16 },
    { header: "HORÁRIO SAÍDA", key: "horario_saida", width: 16 },
    { header: "DIÁRIA", key: "diaria", width: 14 },
    { header: "KM TOTAL", key: "km_total", width: 10 },
    { header: "KM EXCEDENTE", key: "km_excedente", width: 12 },
    { header: "VLR.KM", key: "vlr_km", width: 12 },
    { header: "VLR.TOTAL", key: "vlr_total", width: 14 },
    { header: "Nº OC", key: "numero_oc", width: 14 },
    { header: "OBS", key: "obs", width: 30 },
  ];

  const enrichedData = data.map((item) => ({
    ...item,
    diaria: item.diaria_formatada || "-",
    vlr_km: item.vlr_km_formatado || "-",
    vlr_total: item.vlr_total_formatado || "-",
  }));

  exportToExcel(
    enrichedData,
    columns,
    `relatorio_cliente_agregado_${periodoLabel}`,
    `Relatório Cliente — Agregado Refrigerado | Cliente: ${clienteNome} | Prestador: ${prestadorNome}`
  );
};
