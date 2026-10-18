// ============================================================
// RELATÓRIOS CONSOLIDADOS — Conexão Express
//
// Documentos executivos corporativos para relatórios periódicos:
//   - Faturamento por cliente (consolidado)
//   - Extrato operacional
//   - Prestadores (pagamento / repasse)
//
// Usa fundação profissional — sem cards dashboard.
// Página 1: Capa corporativa
// Páginas 2+: Conteúdo editorial executivo
// ============================================================

import jsPDF from "jspdf";
import {
  drawCoverPage,
  drawContentHeader,
  drawContentFooter,
  drawCorporateTable,
  drawSectionTitle,
  drawInfoBlock,
  drawFinancialComposition,
  drawObservations,
  drawSignatureBlock,
  drawMetricsGrid,
  getPageSetup,
  type PdfLogo,
  type InfoField,
  type FinancialLine,
  type SummaryMetric,
  fmtBRL,
  fmtDate,
} from "./foundation";

const CNPJ_EMPRESA = "31.227.975/0001-80";
const KM_BASE_PADRAO = 200;

interface PeriodoFiltro {
  dataInicio: string;
  dataFim: string;
}

function formatPeriodo(dataInicio?: string, dataFim?: string): string {
  if (dataInicio && dataFim)
    return `${fmtDate(dataInicio)} a ${fmtDate(dataFim)}`;
  if (dataInicio) return `A partir de ${fmtDate(dataInicio)}`;
  if (dataFim) return `Até ${fmtDate(dataFim)}`;
  return "Todo o periodo";
}

// ===================== RELATORIO DE FATURAMENTO CONSOLIDADO =====================

export async function generateExecutiveFaturamentoReport(
  cliente: { nome: string; cnpj: string },
  periodo: PeriodoFiltro,
  operacoes: any[]
): Promise<void> {
  console.info("[PDF_REAL] generateExecutiveFaturamentoReport -> novo layout profissional");

  const doc = new jsPDF("landscape", "mm", "a4");
  const page = getPageSetup(doc, 12);
  const periodoStr = formatPeriodo(periodo.dataInicio, periodo.dataFim);

  const getValor = (o: any, ...campos: string[]): number => {
    for (const c of campos) {
      const v = Number(o[c]);
      if (Number.isFinite(v) && v !== 0) return v;
    }
    return 0;
  };

  const totalOperacoes = operacoes.length;
  const subtotalFrete = operacoes.reduce((s, o) => s + getValor(o, "valor_cliente", "valorCliente", "valor_final", "valorFinal", "valorFrete", "valor_total"), 0);
  const totalPedagio = operacoes.reduce((s, o) => s + getValor(o, "pedagio", "valor_pedagio", "valorPedagio"), 0);
  const totalEspera = operacoes.reduce((s, o) => s + getValor(o, "valor_espera", "espera", "valorEspera"), 0);
  const totalAjudante = operacoes.reduce((s, o) => s + getValor(o, "ajudante", "valor_ajudante", "valorAjudante"), 0);
  const totalOutrosAdic = operacoes.reduce((s, o) => s + getValor(o, "adicionais", "outrosAdicionais", "valorAdicional"), 0);
  const totalAdicionais = totalPedagio + totalEspera + totalAjudante + totalOutrosAdic;
  const totalDescontos = operacoes.reduce((s, o) => s + getValor(o, "descontos", "valor_desconto", "valorDesconto"), 0);
  const totalKM = operacoes.reduce((s, o) => s + getValor(o, "km_total", "kmTotal", "kmRodados", "km_rodados"), 0);
  const totalFaturado = subtotalFrete + totalAdicionais - totalDescontos;
  const totalKMAdicional = operacoes.reduce((s, o) => {
    const kmTotal = getValor(o, "km_total", "kmTotal", "kmRodados");
    const kmBase = getValor(o, "km_base", "kmBase", "km_franquia") || KM_BASE_PADRAO;
    return s + Math.max(0, kmTotal - kmBase);
  }, 0);

  // PAGINA 1: CAPA
  const logo = await drawCoverPage(doc, {
    documentType: "RELATORIO DE FATURAMENTO",
    documentNumber: cliente.nome,
    entityName: `CNPJ: ${cliente.cnpj}`,
    entitySubtitle: periodoStr,
    date: fmtDate(new Date().toISOString()),
    status: `${totalOperacoes} operacoes`,
    via: "Cliente",
  });

  // PAGINA 2+: CONTEUDO
  doc.addPage();
  let y = 20;

  const drawContentPageHeader = (d: jsPDF, pg: typeof page, l: PdfLogo | null) => {
    drawContentHeader(d, pg.pageWidth, pg.margin, l, {
      title: "RELATORIO DE FATURAMENTO",
      subtitle: `${cliente.nome} — ${periodoStr}`,
    });
  };

  drawContentPageHeader(doc, page, logo);

  // Dados do cliente
  y = drawSectionTitle(doc, page.margin, y, "DADOS DO CLIENTE CONTRATANTE", page);
  const clientFields: InfoField[] = [
    { label: "Razao Social", value: cliente.nome },
    { label: "CNPJ", value: cliente.cnpj },
    { label: "Periodo", value: periodoStr },
    { label: "Operacoes", value: String(totalOperacoes) },
  ];
  y = drawInfoBlock(doc, page.margin, y, page.contentWidth, "IDENTIFICACAO", clientFields);

  // Metricas
  const metrics: SummaryMetric[] = [
    { label: "Total de Operacoes", value: String(totalOperacoes) },
    { label: "KM Rodados", value: `${totalKM} km` },
    { label: "KM Adicional", value: `${totalKMAdicional} km` },
    { label: "Pedagios", value: fmtBRL(totalPedagio) },
    { label: "Adicionais", value: fmtBRL(totalAdicionais) },
    { label: "Descontos", value: fmtBRL(totalDescontos) },
  ];
  y = drawMetricsGrid(doc, page.margin, y, page.contentWidth, "RESUMO OPERACIONAL", metrics);

  // Tabela de operacoes
  if (y > 175) {
    doc.addPage();
    y = 20;
    drawContentPageHeader(doc, page, logo);
  }

  y = drawSectionTitle(doc, page.margin, y, "DETALHAMENTO DE OPERACOES", page);
  y += 2;

  const rows = operacoes.map((item) => {
    const dataOS = item.data_finalizacao || item.created_at || item.data;
    const vBase = getValor(item, "valor_cliente", "valorCliente", "valor_final", "valorFrete", "valor_total");
    const vPedagio = getValor(item, "pedagio", "valor_pedagio");
    const vAdic = getValor(item, "adicionais", "valorAdicional");
    const vDesc = getValor(item, "descontos", "valor_desconto");
    const kmTotal = getValor(item, "km_total", "kmTotal", "kmRodados");
    const kmBase = getValor(item, "km_base", "kmBase", "km_franquia") || KM_BASE_PADRAO;
    const kmAdic = Math.max(0, kmTotal - kmBase);
    const vLiquido = vBase + vPedagio + vAdic - vDesc;

    let origem = "-", destino = "-";
    if (item.enderecos && Array.isArray(item.enderecos) && item.enderecos.length > 0) {
      origem = item.enderecos[0]?.cidade || "-";
      destino = item.enderecos[item.enderecos.length - 1]?.cidade || "-";
    }

    return [
      item.numero || item.os_numero || "-",
      fmtDate(dataOS),
      origem,
      destino,
      item.veiculo_placa || "-",
      `${kmBase} km`,
      `${kmAdic} km`,
      fmtBRL(vPedagio),
      fmtBRL(vAdic),
      fmtBRL(vDesc),
      fmtBRL(vBase),
      fmtBRL(vLiquido),
    ];
  });

  y = drawCorporateTable(doc, page, logo, {
    startY: y,
    columns: ["OS", "Data", "Origem", "Destino", "Placa", "KM Base", "KM Adic", "Pedagio", "Adicionais", "Descontos", "Valor Oper.", "Valor Final"],
    rows,
    fontSize: 6.5,
    headerFontSize: 7,
    columnWidths: { 0: 16, 1: 16, 2: 28, 3: 28, 4: 18, 5: 16, 6: 16, 7: 18, 8: 18, 9: 18, 10: 22, 11: 22 },
    columnAligns: { 0: "center", 1: "center", 4: "center", 5: "center", 6: "center", 7: "right", 8: "right", 9: "right", 10: "right", 11: "right" },
    onPageDraw: drawContentPageHeader,
  });
  y += 6;

  // Composicao financeira
  if (y > 190) {
    doc.addPage();
    y = 20;
    drawContentPageHeader(doc, page, logo);
  }

  const financeLines: FinancialLine[] = [
    { label: "Valor da Operacao (Frete)", value: subtotalFrete },
  ];
  if (totalPedagio > 0) financeLines.push({ label: "Pedagios / Reembolsos", value: totalPedagio, indent: true });
  if (totalEspera > 0) financeLines.push({ label: "Taxa de Espera", value: totalEspera, indent: true });
  if (totalAjudante > 0) financeLines.push({ label: "Ajudante", value: totalAjudante, indent: true });
  if (totalOutrosAdic > 0) financeLines.push({ label: "Outros Adicionais", value: totalOutrosAdic, indent: true });
  if (totalPedagio + totalEspera + totalAjudante + totalOutrosAdic > 0) {
    financeLines.push({ label: "Total Adicionais", value: totalAdicionais });
  }
  if (totalDescontos > 0) financeLines.push({ label: "Descontos / Glosas", value: totalDescontos, indent: true });
  financeLines.push({ label: "TOTAL FATURADO", value: totalFaturado, isTotal: true, highlight: true });

  y = drawFinancialComposition(doc, page.margin, y, page.contentWidth, "COMPOSICAO FINANCEIRA", financeLines);

  // Observacoes
  if (y > 235) {
    doc.addPage();
    y = 20;
    drawContentPageHeader(doc, page, logo);
  }

  drawObservations(doc, page.margin, y, page.contentWidth,
    "Este relatorio reflete os dados reais da programação operacional e adicionais do periodo. " +
    "Em caso de divergencias, manifestar-se em ate 48 horas uteis para ajustes no fechamento do faturamento."
  );

  drawContentFooter(doc, page.pageWidth, page.pageHeight, page.margin);

  const filename = `relatorio_faturamento_${cliente.nome.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.pdf`;
  doc.save(filename);
}

// ===================== RELATORIO DE EXTRATO OPERACIONAL =====================

export async function generateExecutiveExtratoReport(
  data: any[],
  filtros: any
): Promise<void> {
  console.info("[PDF_REAL] generateExecutiveExtratoReport -> novo layout profissional");

  const doc = new jsPDF("landscape", "mm", "a4");
  const page = getPageSetup(doc, 12);
  const periodoStr = formatPeriodo(filtros?.dataInicio, filtros?.dataFim);

  const totalOperacoes = data.length;
  const totalKM = data.reduce((s: number, o: any) => s + Number(o.kmTotal ?? o.km_total ?? o.kmRodados ?? 0), 0);
  const totalPedagio = data.reduce((s: number, o: any) => s + Number(o.pedagio ?? 0), 0);
  const totalSaida = data.reduce((s: number, o: any) => s + Number(o.diaria ?? o.valorCliente ?? 0), 0);
  const totalFaturado = data.reduce((s: number, o: any) => {
    const kmTotal = Number(o.kmTotal ?? o.km_total ?? o.kmRodados ?? 0);
    const kmExcedente = Number(o.kmExcedente ?? (o as any).km_excedente ?? Math.max(0, kmTotal - KM_BASE_PADRAO));
    const valorKm = Number(o.valorKm ?? (o as any).valor_km ?? 0);
    const valorSaida = Number(o.diaria ?? o.valorCliente ?? 0);
    const pedagogio = Number(o.pedagio ?? 0);
    const desc = Number(o.descontos ?? 0);
    return s + valorSaida + valorKm * kmExcedente + pedagogio - desc;
  }, 0);

  const totalKMExcedente = data.reduce((s: number, o: any) => {
    const kmTotal = Number(o.kmTotal ?? (o as any).km_total ?? (o as any).kmRodados ?? 0);
    return s + Math.max(0, kmTotal - KM_BASE_PADRAO);
  }, 0);

  // CAPA
  const logo = await drawCoverPage(doc, {
    documentType: "EXTRATO OPERACIONAL",
    documentNumber: `${totalOperacoes} operacoes`,
    entityName: filtros?.cliente || "Consolidado Geral",
    entitySubtitle: periodoStr,
    date: fmtDate(new Date().toISOString()),
    via: "Cliente",
  });

  // PAGINA 2+: CONTEUDO
  doc.addPage();
  let y = 20;

  const drawContentPageHeader = (d: jsPDF, pg: typeof page, l: PdfLogo | null) => {
    drawContentHeader(d, pg.pageWidth, pg.margin, l, {
      title: "EXTRATO OPERACIONAL",
      subtitle: periodoStr,
    });
  };

  drawContentPageHeader(doc, page, logo);

  // Metricas
  const metrics: SummaryMetric[] = [
    { label: "Total de Operacoes", value: String(totalOperacoes) },
    { label: "KM Rodados", value: `${totalKM} km` },
    { label: "KM Excedente", value: `${totalKMExcedente} km` },
    { label: "Pedagios", value: fmtBRL(totalPedagio) },
    { label: "Valor Base (Diarias)", value: fmtBRL(totalSaida) },
    { label: "Total Faturado", value: fmtBRL(totalFaturado) },
  ];
  y = drawMetricsGrid(doc, page.margin, y, page.contentWidth, "RESUMO OPERACIONAL", metrics);

  // Tabela
  y = drawSectionTitle(doc, page.margin, y, "DETALHAMENTO DAS OPERACOES", page);
  y += 2;

  const rows = data.map((o: any) => {
    const kmTotal = Number(o.kmTotal ?? (o as any).km_total ?? (o as any).kmRodados ?? 0);
    const kmExcedente = Number(o.kmExcedente ?? (o as any).km_excedente ?? Math.max(0, kmTotal - KM_BASE_PADRAO));
    const valorKm = Number(o.valorKm ?? (o as any).valor_km ?? 0);
    const valorSaida = Number(o.diaria ?? o.valorCliente ?? 0);
    const pedagogio = Number(o.pedagio ?? 0);
    const desc = Number(o.descontos ?? 0);
    const total = valorSaida + valorKm * kmExcedente + pedagogio - desc;

    return [
      o.numero || "-",
      o.cliente || "-",
      o.prestador || "-",
      o.placa || "-",
      fmtDate(o.data),
      `${kmExcedente}`,
      fmtBRL(valorKm),
      fmtBRL(valorSaida),
      fmtBRL(pedagio),
      fmtBRL(desc),
      fmtBRL(total),
    ];
  });

  y = drawCorporateTable(doc, page, logo, {
    startY: y,
    columns: ["OS", "Cliente", "Prestador", "Placa", "Data", "KM Exc.", "Vlr. KM", "Diaria", "Pedagio", "Descontos", "Total"],
    rows,
    fontSize: 6.5,
    headerFontSize: 7,
    columnWidths: { 0: 18, 1: 35, 2: 35, 3: 18, 4: 18, 5: 15, 6: 18, 7: 20, 8: 18, 9: 18, 10: 22 },
    columnAligns: { 0: "center", 3: "center", 4: "center", 5: "right", 6: "right", 7: "right", 8: "right", 9: "right", 10: "right" },
    onPageDraw: drawContentPageHeader,
  });
  y += 6;

  // Composicao
  if (y > 195) {
    doc.addPage();
    y = 20;
    drawContentPageHeader(doc, page, logo);
  }

  const financeLines: FinancialLine[] = [
    { label: "Valor Base (Diarias)", value: totalSaida },
  ];
  if (totalKMExcedente > 0) financeLines.push({ label: "KM Excedente Total", value: totalKMExcedente * (data[0]?.valorKm || 0), indent: true });
  if (totalPedagio > 0) financeLines.push({ label: "Pedagios", value: totalPedagio, indent: true });
  financeLines.push({ label: "TOTAL FATURADO", value: totalFaturado, isTotal: true, highlight: true });

  y = drawFinancialComposition(doc, page.margin, y, page.contentWidth, "COMPOSICAO FINANCEIRA", financeLines);

  drawObservations(doc, page.margin, y, page.contentWidth,
    "Extrato operacional consolidado. Dados baseados nas ordens de servico finalizadas no periodo. " +
    "Valores sujeitos a conferencia e aprovacao do setor financeiro."
  );

  drawContentFooter(doc, page.pageWidth, page.pageHeight, page.margin);
  doc.save("extrato_operacional.pdf");
}

// ===================== RELATORIO DE PRESTADORES =====================

export async function generateExecutivePrestadorReport(
  linhas: any[],
  prestadorNome: string,
  dataInicio: string,
  dataFim: string,
  resumo: {
    totalOps: number;
    valorBruto: number;
    valorPago: number;
    saldoPendente: number;
    mediaEntrega: number;
  }
): Promise<void> {
  console.info("[PDF_REAL] generateExecutivePrestadorReport -> novo layout profissional");

  const doc = new jsPDF("landscape", "mm", "a4");
  const page = getPageSetup(doc, 12);
  const periodoStr = formatPeriodo(dataInicio, dataFim);

  // CAPA
  const logo = await drawCoverPage(doc, {
    documentType: "RELATORIO DE PRESTADORES",
    documentNumber: prestadorNome || "Consolidado",
    entityName: `Operacoes: ${resumo.totalOps}`,
    entitySubtitle: periodoStr,
    date: fmtDate(new Date().toISOString()),
    via: "Prestador",
  });

  // PAGINA 2+: CONTEUDO
  doc.addPage();
  let y = 20;

  const drawContentPageHeader = (d: jsPDF, pg: typeof page, l: PdfLogo | null) => {
    drawContentHeader(d, pg.pageWidth, pg.margin, l, {
      title: "RELATORIO DE PRESTADORES",
      subtitle: prestadorNome ? `${prestadorNome} — ${periodoStr}` : periodoStr,
    });
  };

  drawContentPageHeader(doc, page, logo);

  // Dados do prestador se especifico
  if (prestadorNome) {
    const pf: InfoField[] = [
      { label: "Prestador", value: prestadorNome },
      { label: "Periodo", value: periodoStr },
      { label: "Operacoes", value: String(resumo.totalOps) },
    ];
    y = drawInfoBlock(doc, page.margin, y, page.contentWidth, "IDENTIFICACAO DO PRESTADOR", pf);
  }

  // Metricas
  const metrics: SummaryMetric[] = [
    { label: "Total de Operacoes", value: String(resumo.totalOps) },
    { label: "Valor Bruto (Frete)", value: fmtBRL(resumo.valorBruto) },
    { label: "Valor Pago ao Prestador", value: fmtBRL(resumo.valorPago) },
    { label: "Saldo Pendente", value: fmtBRL(resumo.saldoPendente) },
    { label: "Media por Operacao", value: fmtBRL(resumo.mediaEntrega) },
    { label: "Status", value: resumo.saldoPendente > 0 ? "Com Pendencias" : "Regular" },
  ];
  y = drawMetricsGrid(doc, page.margin, y, page.contentWidth, "RESUMO FINANCEIRO", metrics);

  // Tabela
  y = drawSectionTitle(doc, page.margin, y, "DETALHAMENTO DE OPERACOES", page);
  y += 2;

  const fmtPct = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? `${n.toFixed(1)}%` : "-";
  };

  const rows = linhas.map((l: any) => [
    l.os || "-",
    l.cliente || "-",
    l.origem || "-",
    l.destino || "-",
    l.dataColeta || "-",
    l.dataEntrega || "-",
    fmtBRL(l.valorFrete),
    fmtBRL(l.valorPrestador),
    fmtPct(l.margemPct),
    l.statusFinanceiro || "-",
    l.tipoVeiculo || "-",
  ]);

  y = drawCorporateTable(doc, page, logo, {
    startY: y,
    columns: ["OS", "Cliente", "Origem", "Destino", "Data Coleta", "Data Entrega", "Valor Frete", "Valor Prest.", "Margem", "Status Fin.", "Tipo Veiculo"],
    rows,
    fontSize: 6.5,
    headerFontSize: 7,
    columnWidths: { 0: 20, 1: 38, 2: 30, 3: 30, 4: 20, 5: 20, 6: 22, 7: 22, 8: 16, 9: 18, 10: 18 },
    columnAligns: { 0: "center", 4: "center", 5: "center", 6: "right", 7: "right", 8: "right", 9: "center" },
    onPageDraw: drawContentPageHeader,
  });
  y += 6;

  // Composicao financeira
  if (y > 195) {
    doc.addPage();
    y = 20;
    drawContentPageHeader(doc, page, logo);
  }

  const financeLines: FinancialLine[] = [
    { label: "Valor Bruto Faturado", value: resumo.valorBruto },
    { label: "Valor Pago ao Prestador", value: resumo.valorPago, indent: true },
    { label: "Saldo Pendente", value: resumo.saldoPendente, indent: true },
    { label: "Media por Operacao", value: resumo.mediaEntrega, indent: true },
  ];

  y = drawFinancialComposition(doc, page.margin, y, page.contentWidth, "FECHAMENTO FINANCEIRO", financeLines);

  drawObservations(doc, page.margin, y, page.contentWidth,
    "Relatorio de prestadores de servico de transporte autonomo. " +
    "Valores sujeitos a confirmacao de execucao e documentacao fiscal. " +
    "Pagamentos processados conforme contrato vigente."
  );

  drawContentFooter(doc, page.pageWidth, page.pageHeight, page.margin);
  doc.save("relatorio_prestadores.pdf");
}
