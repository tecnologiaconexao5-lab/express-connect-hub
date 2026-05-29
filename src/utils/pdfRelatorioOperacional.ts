// ============================================================
// PDFs do modulo de Relatorio Operacional de Faturamento
//
// REESCRITO — agora delega para o novo sistema profissional
// (foundation + consolidatedReports).
//
// Mantem compatibilidade total com todos os callers.
// ============================================================

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  drawCoverPage,
  drawContentHeader,
  drawContentFooter,
  drawCorporateTable,
  drawSectionTitle,
  drawMetricsGrid,
  drawInfoBlock,
  drawFinancialComposition,
  drawObservations,
  getPageSetup,
  type PdfLogo,
  type FinancialLine,
  type SummaryMetric,
  fmtBRL,
  fmtDate,
} from "@/lib/pdf/foundation";

interface PDFReportOptions {
  titulo: string;
  subtitulo?: string;
  periodo?: string;
  usuario?: string;
  colunas: string[];
  linhas: (string | number)[][];
  totais?: { label: string; valor: string }[];
  rodape?: string;
  orientacao?: "portrait" | "landscape";
}

// ===================== GERAL: RELATORIO OPERACIONAL =====================

export const gerarPDFRelatorioOperacional = async (options: PDFReportOptions): Promise<void> => {
  console.info("[PDF_REAL] gerarPDFRelatorioOperacional -> usando NOVO sistema profissional (foundation)");

  const doc = new jsPDF(options.orientacao || "landscape", "mm", "a4");
  const page = getPageSetup(doc, 12);

  const logo = await drawCoverPage(doc, {
    documentType: options.titulo.toUpperCase(),
    documentNumber: options.subtitulo || "",
    entityName: options.periodo || "",
    entitySubtitle: options.usuario ? `Responsavel: ${options.usuario}` : undefined,
    date: fmtDate(new Date().toISOString()),
    via: "Cliente",
  });

  let y = 85;

  const drawContentPageHeader = (d: jsPDF, pg: typeof page, l: PdfLogo | null) => {
    drawContentHeader(d, pg.pageWidth, pg.margin, l, {
      title: options.titulo,
      subtitle: options.subtitulo || options.periodo,
    });
  };

  y = drawCorporateTable(doc, page, logo, {
    startY: y,
    columns: options.colunas,
    rows: options.linhas as any,
    fontSize: 7,
    headerFontSize: 7.5,
    columnAligns: { 0: "center" },
    onPageDraw: drawContentPageHeader,
  });

  if (options.totais && options.totais.length > 0) {
    y = (doc as any).lastAutoTable?.finalY ?? y;
    y += 8;

    if (y > page.pageHeight - 60) {
      doc.addPage();
      y = 20;
      drawContentPageHeader(doc, page, logo);
    }

    const financeLines: FinancialLine[] = options.totais.map((t) => ({
      label: t.label,
      value: Number.parseFloat(t.valor.replace(/[^0-9,-]/g, "").replace(",", ".")) || 0,
    }));
    const lastItem = options.totais[options.totais.length - 1];
    if (financeLines.length > 0) {
      financeLines[financeLines.length - 1].highlight = true;
    }

    drawFinancialComposition(doc, page.margin, y, page.contentWidth, "RESUMO OPERACIONAL", financeLines.map((l, i) => ({
      ...l,
      value: (() => {
        const v = options.totais![i]?.valor || "0";
        const n = Number.parseFloat(v.replace(/[^0-9,-]/g, "").replace(",", "."));
        return Number.isFinite(n) ? n : 0;
      })(),
      label: options.totais![i]?.label || l.label,
    })));
  }

  drawContentFooter(doc, page.pageWidth, page.pageHeight, page.margin);

  const filename = options.titulo
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase()
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  doc.save(`${filename}.pdf`);
};

// ===================== PRESTADOR: REPASSE =====================

export const gerarPDFRepassePrestador = async (
  data: any[],
  filtros: any,
  resumo: {
    totalRepasses: number;
    qtdOperacoes: number;
    mediaOperacional: number;
    pendencias: number;
    valorAprovado: number;
  },
  usuario?: string
) => {
  console.info("[PDF_REAL] gerarPDFRepassePrestador -> usando NOVO sistema profissional (foundation)");

  const doc = new jsPDF("landscape", "mm", "a4");
  const page = getPageSetup(doc, 12);
  const periodoStr = `${fmtDate(filtros.dataInicial)} a ${fmtDate(filtros.dataFinal)}`;

  const logo = await drawCoverPage(doc, {
    documentType: "DEMONSTRATIVO DE PAGAMENTO",
    documentNumber: filtros.prestador || "Consolidado",
    entityName: `Operações: ${resumo.qtdOperacoes}`,
    entitySubtitle: periodoStr,
    date: fmtDate(new Date().toISOString()),
    via: "Prestador",
  });

  let y = 85;

  const drawContentPageHeader = (d: jsPDF, pg: typeof page, l: PdfLogo | null) => {
    drawContentHeader(d, pg.pageWidth, pg.margin, l, {
      title: "DEMONSTRATIVO DE PAGAMENTO OPERACIONAL",
      subtitle: filtros.prestador ? `${filtros.prestador} — ${periodoStr}` : periodoStr,
    });
  };

  let sumBase = 0;
  let sumKm = 0;
  let sumEspera = 0;
  let sumPedagio = 0;
  let sumReemb = 0;
  let sumDesc = 0;
  let sumLiquido = 0;
  let sumAdiant = 0;
  let sumConvenio = 0;

  // Pré-calcula os totais para exibir no resumo
  data.forEach((item) => {
    const fn = item.financeiro || {};
    const metadata = item.metadata?.financeiroPrestador || {};
    const pTotals = item.metadata?.totals?.prestador || {};

    sumBase += Number(item.custo_prestador || pTotals.valorBase || fn.valorBase || 0);
    sumKm += Number(metadata.kmExcedente || 0);
    sumEspera += Number(metadata.espera || 0);
    sumPedagio += Number(metadata.pedagio || 0);
    sumReemb += Number(metadata.valorReembolsoOutros || 0);
    sumDesc += Number(item.descontos || metadata.descontos || 0);
    sumLiquido += Number(item.valor_final_repasse || pTotals.total || fn.receitaLiquida || 0);
    sumAdiant += Number(metadata.adiantamento || fn.adiantamento || 0);
    sumConvenio += Number(metadata.combustivel || fn.combustivel || 0);
  });

  const subtotalAprovado = sumBase + sumKm + sumEspera + sumPedagio + sumReemb;

  const metricValues = [
    { label: "Operações", value: String(resumo.qtdOperacoes) },
    { label: "Total Pendente", value: fmtBRL(resumo.pendencias) },
    { label: "Valor Base Operações", value: fmtBRL(sumBase) },
    { label: "KM Adicional", value: sumKm > 0 ? fmtBRL(sumKm) : "R$ 0,00" },
    { label: "Espera", value: sumEspera > 0 ? fmtBRL(sumEspera) : "R$ 0,00" },
    { label: "Pedágios", value: sumPedagio > 0 ? fmtBRL(sumPedagio) : "R$ 0,00" },
    { label: "Reembolsos", value: sumReemb > 0 ? fmtBRL(sumReemb) : "R$ 0,00" },
    { label: "Subtotal Aprovado", value: fmtBRL(subtotalAprovado), col: "right" as const },
    { label: "Convênio Combustível", value: sumConvenio > 0 ? fmtBRL(sumConvenio) : "R$ 0,00", col: "right" as const },
    { label: "Adiantamentos", value: sumAdiant > 0 ? fmtBRL(sumAdiant) : "R$ 0,00", col: "right" as const },
    { label: "Descontos Diversos", value: sumDesc > 0 ? fmtBRL(sumDesc) : "R$ 0,00", col: "right" as const },
    { label: "TOTAL LÍQUIDO A RECEBER", value: fmtBRL(sumLiquido), col: "right" as const }
  ];
  y = drawInfoBlock(doc, page.margin, y, page.contentWidth, "RESUMO DO PRESTADOR", metricValues);

  // Tabela
  y = drawSectionTitle(doc, page.margin, y, "DETALHAMENTO DAS OPERAÇÕES", page);
  y += 2;


  const rows = data.map((item) => {
    const fn = item.financeiro || {};
    const metadata = item.metadata?.financeiroPrestador || {};
    const pTotals = item.metadata?.totals?.prestador || {};

    const vBase = Number(item.custo_prestador || pTotals.valorBase || fn.valorBase || 0);
    const vKm = Number(metadata.kmExcedente || 0);
    const vEspera = Number(metadata.espera || 0);
    const vPedagio = Number(metadata.pedagio || 0);
    const vReemb = Number(metadata.valorReembolsoOutros || 0);
    const vDesc = Number(item.descontos || metadata.descontos || 0);
    const vLiquido = Number(item.valor_final_repasse || pTotals.total || fn.receitaLiquida || 0);
    const vAdiant = Number(metadata.adiantamento || fn.adiantamento || 0);
    const vConvenio = Number(metadata.combustivel || fn.combustivel || 0);

    sumBase += vBase;
    sumKm += vKm;
    sumEspera += vEspera;
    sumPedagio += vPedagio;
    sumReemb += vReemb;
    sumDesc += vDesc;
    sumLiquido += vLiquido;
    sumAdiant += vAdiant;
    sumConvenio += vConvenio;

    return [
      fmtDate(item.data_finalizacao || item.created_at || item.data_escala || item.data),
      String(item.numero || item.os_numero || "S/N").substring(0, 8),
      item.enderecos?.[0]?.cidade || item.origem || "-",
      item.enderecos?.[item.enderecos?.length - 1]?.cidade || item.destino || "-",
      fmtBRL(vBase),
      fmtBRL(vKm),
      fmtBRL(vEspera),
      fmtBRL(vPedagio),
      fmtBRL(vReemb),
      fmtBRL(vDesc),
      fmtBRL(vLiquido)
    ];
  });

  y = drawCorporateTable(doc, page, logo, {
    startY: y,
    columns: ["Data", "OS", "Origem", "Destino", "V. Base", "KM Extra", "Espera", "Pedágio", "Reemb.", "Desc.", "Líquido"],
    rows,
    fontSize: 6.5,
    headerFontSize: 7,
    columnWidths: { 0: 18, 1: 18, 4: 18, 5: 16, 6: 16, 7: 18, 8: 18, 9: 18, 10: 22 }, // No widths for 2 and 3, let them auto-fill
    columnAligns: { 0: "center", 1: "center", 4: "right", 5: "right", 6: "right", 7: "right", 8: "right", 9: "right", 10: "right" },
    onPageDraw: drawContentPageHeader,
  });
  y += 6;

  // Composição financeira
  if (y > 145) {
    doc.addPage();
    y = 35;
    drawContentPageHeader(doc, page, logo);
  }

  const financeLines: FinancialLine[] = [
    { label: "Valor Base", value: sumBase },
  ];
  if (sumKm > 0) financeLines.push({ label: "KM Adicional", value: sumKm });
  if (sumEspera > 0) financeLines.push({ label: "Espera", value: sumEspera });
  if (sumPedagio > 0) financeLines.push({ label: "Pedágio", value: sumPedagio });
  if (sumReemb > 0) financeLines.push({ label: "Reembolso", value: sumReemb });
  
  financeLines.push({ label: "Subtotal", value: subtotalAprovado, isTotal: true });

  if (sumConvenio > 0) financeLines.push({ label: "Convênio Combustível", value: -sumConvenio });
  if (sumAdiant > 0) financeLines.push({ label: "Adiantamentos", value: -sumAdiant });
  if (sumDesc > 0) financeLines.push({ label: "Descontos Diversos", value: -sumDesc });

  financeLines.push({ label: "TOTAL LÍQUIDO A RECEBER", value: sumLiquido, isTotal: true, highlight: true });

  drawFinancialComposition(doc, page.margin, y, page.contentWidth, "COMPOSIÇÃO DO PAGAMENTO", financeLines);

  drawObservations(doc, page.margin, y + 40, page.contentWidth,
    "Demonstrativo de pagamento operacional a prestadores de serviço de transporte autônomo. " +
    "Valores sujeitos à confirmação de execução e documentação fiscal. CNPJ: 31.227.975/0001-80."
  );

  drawContentFooter(doc, page.pageWidth, page.pageHeight, page.margin);
  doc.save("demonstrativo_pagamento_prestadores.pdf");
};

// ===================== FATURAMENTO DETALHADO =====================

export const gerarPDFFaturamentoDetalhado = async (
  cliente: { nome: string; cnpj: string },
  periodo: string,
  operacoes: any[],
  usuario?: string
) => {
  console.info("[PDF_REAL] gerarPDFFaturamentoDetalhado -> usando NOVO sistema profissional (foundation)");

  const doc = new jsPDF("landscape", "mm", "a4");
  const page = getPageSetup(doc, 12);

  const totalOperacoes = operacoes.length;

  const getValor = (o: any, ...campos: string[]): number => {
    for (const c of campos) {
      const v = Number(o[c]);
      if (Number.isFinite(v) && v !== 0) return v;
    }
    return 0;
  };

  const KM_BASE_PADRAO = 200;
  const subtotalFrete = operacoes.reduce((s, o) => s + getValor(o, "valor_cliente", "valorCliente", "valor_final", "valorFrete", "valor_total"), 0);
  const totalPedagio = operacoes.reduce((s, o) => s + getValor(o, "pedagio", "valor_pedagio"), 0);
  const totalAdicionais = operacoes.reduce((s, o) => s + getValor(o, "adicionais", "valorAdicional", "valor_espera", "ajudante"), 0);
  const totalDescontos = operacoes.reduce((s, o) => s + getValor(o, "descontos", "valor_desconto"), 0);
  const totalKM = operacoes.reduce((s, o) => s + getValor(o, "km_total", "kmTotal", "kmRodados"), 0);
  const totalKMAdicional = operacoes.reduce((s, o) => {
    const kmTotal = getValor(o, "km_total", "kmTotal", "kmRodados");
    const kmBase = getValor(o, "km_base", "kmBase", "km_franquia") || KM_BASE_PADRAO;
    return s + Math.max(0, kmTotal - kmBase);
  }, 0);
  const totalFaturado = subtotalFrete + totalPedagio + totalAdicionais - totalDescontos;

  // CAPA
  const logo = await drawCoverPage(doc, {
    documentType: "RELATORIO DE FATURAMENTO",
    documentNumber: cliente.nome,
    entityName: `CNPJ: ${cliente.cnpj}`,
    entitySubtitle: periodo,
    date: fmtDate(new Date().toISOString()),
    status: `${totalOperacoes} operacoes`,
    via: "Cliente",
  });

  // PAGINA 1
  let y = 85;

  const drawContentPageHeader = (d: jsPDF, pg: typeof page, l: PdfLogo | null) => {
    drawContentHeader(d, pg.pageWidth, pg.margin, l, {
      title: "RELATORIO OPERACIONAL DE FATURAMENTO",
      subtitle: `${cliente.nome} — ${periodo}`,
    });
  };

  // Metricas corporativas
  const infoFields = [
    { label: "Total de Operações", value: String(totalOperacoes) },
    { label: "KM Rodados", value: `${totalKM} km` },
    { label: "KM Adicional", value: `${totalKMAdicional} km` },
    { label: "Pedágios", value: fmtBRL(totalPedagio), col: "right" as const },
    { label: "Adicionais", value: fmtBRL(totalAdicionais), col: "right" as const },
    { label: "Descontos", value: fmtBRL(totalDescontos), col: "right" as const },
  ];
  y = drawInfoBlock(doc, page.margin, y, page.contentWidth, "RESUMO OPERACIONAL", infoFields);

  // Tabela
  y = drawSectionTitle(doc, page.margin, y, "DETALHAMENTO DAS OPERACOES", page);
  y += 2;

  const rows = operacoes.map((item) => {
    const dataOS = item.data_finalizacao || item.created_at || item.data;
    const vBase = getValor(item, "valor_cliente", "valorCliente", "valor_final", "valorFrete", "valor_total");
    const vPedagio = getValor(item, "pedagio", "valor_pedagio");
    const vAdic = getValor(item, "adicionais", "valorAdicional", "ajudante", "valor_espera");
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
    columns: ["OS", "Data", "Origem", "Destino", "Placa", "KM Base", "KM Adic", "Pedágio", "Adicionais", "Descontos", "Valor Oper.", "Valor Final"],
    rows,
    fontSize: 7.5,
    headerFontSize: 8,
    columnWidths: { 0: 18, 1: 18, 4: 18, 5: 16, 6: 16, 7: 18, 8: 18, 9: 18, 10: 22, 11: 22 }, // No widths for 2 and 3, let them auto-fill
    columnAligns: { 0: "center", 1: "center", 4: "center", 5: "center", 6: "center", 7: "right", 8: "right", 9: "right", 10: "right", 11: "right" },
    onPageDraw: (d, pg, l) => {
      drawContentPageHeader(d, pg, l);
    },
  });
  y += 6;

  // Composicao
  if (y > 145) {
    doc.addPage();
    y = 35;
    drawContentPageHeader(doc, page, logo);
  }

  const financeLines: FinancialLine[] = [
    { label: "Valor da Operacao (Frete)", value: subtotalFrete },
  ];
  if (totalPedagio > 0) financeLines.push({ label: "Pedagios", value: totalPedagio, indent: true });
  if (totalAdicionais > 0) financeLines.push({ label: "Adicionais", value: totalAdicionais, indent: true });
  if (totalDescontos > 0) financeLines.push({ label: "Descontos", value: totalDescontos, indent: true });
  financeLines.push({ label: "TOTAL FATURADO", value: totalFaturado, isTotal: true, highlight: true });

  drawFinancialComposition(doc, page.margin, y, page.contentWidth, "COMPOSICAO FINANCEIRA", financeLines);

  drawObservations(doc, page.margin, y + 40, page.contentWidth,
    "Este relatorio reflete os dados reais da escala operacional e adicionais do periodo. " +
    "Em caso de divergencias, manifestar-se em ate 48 horas uteis para ajustes no fechamento do faturamento."
  );

  drawContentFooter(doc, page.pageWidth, page.pageHeight, page.margin);

  const filename = `relatorio_operacional_${cliente.nome.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.pdf`;
  doc.save(`${filename}.pdf`);
};

// Re-export headers/footers para compatibilidade com codigo legado

export const drawHeaderNavy = (
  doc: any,
  logo: any,
  pageWidth: number,
  margin: number,
  title: string,
  subtitle: string | undefined,
  dataHora: string,
  periodo: string | undefined,
  usuario: string | undefined
) => {
  drawContentHeader(doc, pageWidth, margin, logo ? { base64: logo.base64, naturalWidth: logo.naturalWidth || 1545, naturalHeight: logo.naturalHeight || 982 } : null, {
    title,
    subtitle: subtitle || periodo,
  });
};

export function drawFooterLight(
  doc: any,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  _logo?: any
) {
  drawContentFooter(doc, pageWidth, pageHeight, margin);
}

export const drawFooterNavy = drawFooterLight;
