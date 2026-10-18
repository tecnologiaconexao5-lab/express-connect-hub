// ============================================================
// PDFs do modulo de Relatorio Operacional de Faturamento
//
// REESCRITO — agora delega para o novo sistema profissional
// (foundation + consolidatedReports).
//
// Mantem compatibilidade total com todos os callers.
//
// Novas funcoes *Buffer para automacao (Etapa 6):
// - Retornam Uint8Array em vez de fazer download no navegador
// - Mesma estrutura, mesmo conteudo, apenas mudam o output
// ============================================================

import { jsPDF } from "jspdf";
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
  totais?: { label: string; valor: string; moeda?: boolean }[];
  rodape?: string;
  orientacao?: "portrait" | "landscape";
}

// ===================== GERAL: RELATORIO OPERACIONAL =====================

async function _gerarPDFRelatorioOperacionalDoc(
  options: PDFReportOptions
): Promise<jsPDF> {
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

    // TMS-S04C — "moeda:false" preserva o valor como está (quantidade, sem R$).
    // Quantidades NUNCA recebem formatação monetária (Total de Clientes/Operações).
    drawResumoTotais(doc, page.margin, y, page.contentWidth, options.totais);
  }

  drawContentFooter(doc, page.pageWidth, page.pageHeight, page.margin);
  return doc;
}

/** Renderiza o RESUMO de totais respeitando o tipo de cada linha (moeda ou quantidade). */
function drawResumoTotais(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  totais: { label: string; valor: string; moeda?: boolean }[]
) {
  const padding = 5;
  const lineH = 7;
  const titleH = 9;
  const totalH = titleH + totais.length * lineH + padding * 2;

  doc.setFillColor(250, 251, 253);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.rect(x, y, w, totalH, "FD");

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 26, 46);
  doc.text("RESUMO OPERACIONAL", x + padding, y + padding + 5);

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.15);
  doc.line(x + padding, y + titleH + 2, x + w - padding, y + titleH + 2);

  const valueX = x + w - padding;
  let ly = y + titleH + padding;

  totais.forEach((t, i) => {
    const isLast = i === totais.length - 1;
    const curY = ly + 4;

    if (isLast) {
      doc.setDrawColor(249, 115, 22);
      doc.setLineWidth(0.5);
      doc.line(x + padding, ly, valueX, ly);
    }

    doc.setFontSize(7.5);
    doc.setFont("helvetica", isLast ? "bold" : "normal");
    doc.setTextColor(isLast ? 15 : 71, isLast ? 26 : 85, isLast ? 46 : 105);
    doc.text(t.label, x + padding, curY);

    const valor = t.moeda === false ? t.valor : fmtBRL(parseFloat(t.valor.replace(/[^0-9,-]/g, "").replace(",", ".")) || 0);
    doc.text(valor, valueX, curY, { align: "right" });

    ly += lineH;
  });
}

export const gerarPDFRelatorioOperacional = async (options: PDFReportOptions): Promise<void> => {
  console.info("[PDF_REAL] gerarPDFRelatorioOperacional -> usando NOVO sistema profissional (foundation)");
  const doc = await _gerarPDFRelatorioOperacionalDoc(options);
  const filename = options.titulo
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase()
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  doc.save(`${filename}.pdf`);
};

export const gerarPDFRelatorioOperacionalBuffer = async (options: PDFReportOptions): Promise<Uint8Array> => {
  const doc = await _gerarPDFRelatorioOperacionalDoc(options);
  return new Uint8Array(doc.output("arraybuffer"));
};

// ===================== PRESTADOR: REPASSE =====================

async function _gerarPDFRepassePrestadorDoc(
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
): Promise<jsPDF> {
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
  let sumOutros = 0;
  let sumDesc = 0;
  let sumLiquido = 0;
  let sumAdiant = 0;
  let sumConvenio = 0;

  const rows = data.map((item) => {
    const fn = item.financeiro || {};
    const metadata = item.metadata?.financeiroPrestador || {};
    const pTotals = item.metadata?.totals?.prestador || {};

    let dateStr = item.data_finalizacao || item.data_escala || item.data || item.created_at;
    let formattedDate = "-";
    if (dateStr) {
      if (dateStr.includes("/")) {
        formattedDate = dateStr;
      } else {
        let safeDate = dateStr;
        if (!safeDate.includes("T") && safeDate.length === 10) safeDate = `${safeDate}T12:00:00`;
        const dObj = new Date(safeDate);
        if (!isNaN(dObj.getTime())) formattedDate = dObj.toLocaleDateString("pt-BR");
        else formattedDate = dateStr;
      }
    }

    const vBase = Number(item.valorBasePrestador !== undefined ? item.valorBasePrestador : (item.custo_prestador || pTotals.valorBase || fn.valorBase || 0));
    let vKm = Number(pTotals.detalhes?.km?.valorTotal || metadata.kmExcedente || 0);
    const vEspera = Number(pTotals.detalhes?.espera?.valorTotal || metadata.espera || 0);
    const vPedagio = Number(metadata.pedagio || 0);
    const vReemb = Number(metadata.valorReembolsoOutros || 0);
    const vDesc = Number(item.descontos || metadata.descontos || 0);
    const vLiquido = Number(item.valor_final_repasse || pTotals.total || fn.receitaLiquida || (vBase + vKm + vEspera + vPedagio + vReemb - vDesc));
    const vAdiant = Number(metadata.adiantamento || fn.adiantamento || 0);
    const vConvenio = Number(metadata.combustivel || fn.combustivel || 0);

    const calcLiquido = vBase + vKm + vEspera + vPedagio + vReemb - vDesc;
    const diff = vLiquido - calcLiquido;
    let vOutros = 0;

    if (diff > 0.01) {
      const hasKmIndication = metadata.kmExcedente || metadata.km_excedente || metadata.valorKm || pTotals.detalhes?.km || item.metadata?.totals?.cliente?.detalhes?.km;
      if (hasKmIndication) {
        vKm += diff;
      } else {
        vOutros = diff;
      }
    }

    sumBase += vBase;
    sumKm += vKm;
    sumEspera += vEspera;
    sumPedagio += vPedagio;
    sumReemb += vReemb;
    sumOutros += vOutros;
    sumDesc += vDesc;
    sumLiquido += vLiquido;
    sumAdiant += vAdiant;
    sumConvenio += vConvenio;

    return [
      formattedDate,
      String(item.numero || item.os_numero || "S/N"),
      item.enderecos?.[0]?.cidade || item.origem || "-",
      item.enderecos?.[item.enderecos?.length - 1]?.cidade || item.destino || "-",
      fmtBRL(vBase),
      fmtBRL(vKm),
      fmtBRL(vEspera),
      fmtBRL(vPedagio + vReemb),
      fmtBRL(vOutros),
      fmtBRL(vDesc),
      fmtBRL(vLiquido)
    ];
  });

  const metricValues = [
    { label: "Operações", value: String(resumo.qtdOperacoes) },
    { label: "Valor Base Operações", value: fmtBRL(sumBase) },
    { label: "KM Adicional", value: sumKm > 0 ? fmtBRL(sumKm) : "R$ 0,00" },
    { label: "Espera", value: sumEspera > 0 ? fmtBRL(sumEspera) : "R$ 0,00" },
    { label: "Pedágios/Reembolsos", value: (sumPedagio + sumReemb) > 0 ? fmtBRL(sumPedagio + sumReemb) : "R$ 0,00" },
    { label: "Outros Adicionais", value: sumOutros > 0 ? fmtBRL(sumOutros) : "R$ 0,00" },
    { label: "Descontos", value: sumDesc > 0 ? fmtBRL(sumDesc) : "R$ 0,00" },
    { label: "TOTAL LÍQUIDO A RECEBER", value: fmtBRL(sumLiquido), col: "right" as const }
  ];
  y = drawInfoBlock(doc, page.margin, y, page.contentWidth, "RESUMO DO PRESTADOR", metricValues);

  y = drawSectionTitle(doc, page.margin, y, "DETALHAMENTO DAS OPERAÇÕES", page);
  y += 2;

  y = drawCorporateTable(doc, page, logo, {
    startY: y,
    columns: ["Data", "OS", "Origem", "Destino", "V. Base", "KM Extra", "Espera", "Pedágio/Reemb.", "Outros", "Desc.", "Líquido"],
    rows,
    fontSize: 6.5,
    headerFontSize: 7,
    columnWidths: { 0: 20, 1: 30, 4: 18, 5: 16, 6: 16, 7: 18, 8: 18, 9: 18, 10: 22 },
    columnAligns: { 0: "center", 1: "center", 4: "right", 5: "right", 6: "right", 7: "right", 8: "right", 9: "right", 10: "right" },
    onPageDraw: drawContentPageHeader,
  });
  y += 6;

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
  const totalPedReemb = sumPedagio + sumReemb;
  if (totalPedReemb > 0) financeLines.push({ label: "Pedágios/Reembolsos", value: totalPedReemb });
  if (sumOutros > 0) financeLines.push({ label: "Outros Adicionais", value: sumOutros });

  const totalDescontos = sumDesc + sumAdiant + sumConvenio;
  if (totalDescontos > 0) financeLines.push({ label: "Descontos", value: -totalDescontos });

  financeLines.push({ label: "TOTAL LÍQUIDO A RECEBER", value: sumLiquido, isTotal: true, highlight: true });

  drawFinancialComposition(doc, page.margin, y, page.contentWidth, "COMPOSIÇÃO DO PAGAMENTO", financeLines);

  drawObservations(doc, page.margin, y + 40, page.contentWidth,
    "Demonstrativo de pagamento operacional a prestadores de serviço de transporte autônomo. " +
    "Valores sujeitos à confirmação de execução e documentação fiscal. CNPJ: 31.227.975/0001-80."
  );

  drawContentFooter(doc, page.pageWidth, page.pageHeight, page.margin);
  return doc;
}

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
  const doc = await _gerarPDFRepassePrestadorDoc(data, filtros, resumo, usuario);
  doc.save("demonstrativo_pagamento_prestadores.pdf");
};

export const gerarPDFRepassePrestadorBuffer = async (
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
): Promise<Uint8Array> => {
  const doc = await _gerarPDFRepassePrestadorDoc(data, filtros, resumo, usuario);
  return new Uint8Array(doc.output("arraybuffer"));
};

// ===================== FATURAMENTO DETALHADO =====================

async function _gerarPDFFaturamentoDetalhadoDoc(
  cliente: { nome: string; cnpj: string },
  periodo: string,
  operacoes: any[],
  usuario?: string
): Promise<jsPDF> {
  const doc = new jsPDF("landscape", "mm", "a4");
  const page = getPageSetup(doc, 12);

  const totalOperacoes = operacoes.length;

  const getValor = (o: any, ...campos: string[]): number | undefined => {
    for (const c of campos) {
      if (o[c] !== undefined && o[c] !== null && o[c] !== "") {
        const v = Number(o[c]);
        if (Number.isFinite(v)) return v;
      }
    }
    return undefined;
  };

  const KM_BASE_PADRAO = 200;
  const subtotalFrete = operacoes.reduce((s, o) => s + (getValor(o, "valor_frete", "valor_cliente", "valorCliente", "valor_final", "valorFrete", "valor_total") ?? 0), 0);
  const totalPedagio = operacoes.reduce((s, o) => s + (getValor(o, "pedagio", "valor_pedagio") ?? 0), 0);
  const totalAdicionais = operacoes.reduce((s, o) => s + (getValor(o, "adicionais", "valorAdicional", "valor_espera", "ajudante") ?? 0), 0);
  const totalDescontos = operacoes.reduce((s, o) => s + (getValor(o, "descontos", "valor_desconto") ?? 0), 0);
  const totalKM = operacoes.reduce((s, o) => s + (getValor(o, "km_total", "kmTotal", "kmRodados") ?? 0), 0);
  const totalKMAdicional = operacoes.reduce((s, o) => {
    const kmTotal = getValor(o, "km_total", "kmTotal", "kmRodados") ?? 0;
    const kmBase = getValor(o, "km_base", "kmBase", "km_franquia") ?? KM_BASE_PADRAO;
    return s + Math.max(0, kmTotal - kmBase);
  }, 0);
  const totalFaturado = subtotalFrete + totalPedagio + totalAdicionais - totalDescontos;

  const logo = await drawCoverPage(doc, {
    documentType: "RELATORIO DE FATURAMENTO",
    documentNumber: cliente.nome,
    entityName: `CNPJ: ${cliente.cnpj}`,
    entitySubtitle: periodo,
    date: fmtDate(new Date().toISOString()),
    status: `${totalOperacoes} operacoes`,
    via: "Cliente",
  });

  let y = 85;

  const drawContentPageHeader = (d: jsPDF, pg: typeof page, l: PdfLogo | null) => {
    drawContentHeader(d, pg.pageWidth, pg.margin, l, {
      title: "RELATORIO OPERACIONAL DE FATURAMENTO",
      subtitle: `${cliente.nome} — ${periodo}`,
    });
  };

  const infoFields = [
    { label: "Total de Operações", value: String(totalOperacoes) },
    { label: "KM Rodados", value: `${totalKM} km` },
    { label: "KM Adicional", value: `${totalKMAdicional} km` },
    { label: "Pedágios", value: fmtBRL(totalPedagio), col: "right" as const },
    { label: "Adicionais", value: fmtBRL(totalAdicionais), col: "right" as const },
    { label: "Descontos", value: fmtBRL(totalDescontos), col: "right" as const },
  ];
  y = drawInfoBlock(doc, page.margin, y, page.contentWidth, "RESUMO OPERACIONAL", infoFields);

  y = drawSectionTitle(doc, page.margin, y, "DETALHAMENTO DAS OPERACOES", page);
  y += 2;

  const rows = operacoes.map((item) => {
    let dateStr = item.data_finalizacao || item.created_at || item.data;
    let formattedDate = "-";
    if (dateStr) {
      if (dateStr.includes("/")) {
        formattedDate = dateStr;
      } else {
        let safeDate = dateStr;
        if (!safeDate.includes("T") && safeDate.length === 10) safeDate = `${safeDate}T12:00:00`;
        const dObj = new Date(safeDate);
        if (!isNaN(dObj.getTime())) formattedDate = dObj.toLocaleDateString("pt-BR");
        else formattedDate = dateStr;
      }
    }

    const vBase = getValor(item, "valor_frete", "valor_cliente", "valorCliente", "valor_final", "valorFrete", "valor_total") ?? 0;
    const vPedagio = getValor(item, "pedagio", "valor_pedagio") ?? 0;
    const vAdic = getValor(item, "adicionais", "valorAdicional", "ajudante", "valor_espera") ?? 0;
    const vDesc = getValor(item, "descontos", "valor_desconto") ?? 0;
    const kmTotal = getValor(item, "km_total", "kmTotal", "kmRodados") ?? 0;
    const kmBase = getValor(item, "km_base", "kmBase", "km_franquia") ?? KM_BASE_PADRAO;
    const kmAdic = Math.max(0, kmTotal - kmBase);
    const vLiquido = vBase + vPedagio + vAdic - vDesc;

    let origem = "-", destino = "-";
    if (item.enderecos && Array.isArray(item.enderecos) && item.enderecos.length > 0) {
      origem = item.enderecos[0]?.cidade || "-";
      destino = item.enderecos[item.enderecos.length - 1]?.cidade || "-";
    }

    return [
      item.numero || item.os_numero || "-",
      formattedDate,
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
    columnWidths: { 0: 18, 1: 18, 4: 18, 5: 16, 6: 16, 7: 18, 8: 18, 9: 18, 10: 22, 11: 22 },
    columnAligns: { 0: "center", 1: "center", 4: "center", 5: "center", 6: "center", 7: "right", 8: "right", 9: "right", 10: "right", 11: "right" },
    onPageDraw: (d, pg, l) => {
      drawContentPageHeader(d, pg, l);
    },
  });
  y += 6;

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
    "Este relatorio reflete os dados reais da programação operacional e adicionais do periodo. " +
    "Em caso de divergencias, manifestar-se em ate 48 horas uteis para ajustes no fechamento do faturamento."
  );

  drawContentFooter(doc, page.pageWidth, page.pageHeight, page.margin);
  return doc;
}

export const gerarPDFFaturamentoDetalhado = async (
  cliente: { nome: string; cnpj: string },
  periodo: string,
  operacoes: any[],
  usuario?: string
) => {
  console.info("[PDF_REAL] gerarPDFFaturamentoDetalhado -> usando NOVO sistema profissional (foundation)");
  const doc = await _gerarPDFFaturamentoDetalhadoDoc(cliente, periodo, operacoes, usuario);
  const filename = `relatorio_operacional_${cliente.nome.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.pdf`;
  doc.save(`${filename}.pdf`);
};

export const gerarPDFFaturamentoDetalhadoBuffer = async (
  cliente: { nome: string; cnpj: string },
  periodo: string,
  operacoes: any[],
  usuario?: string
): Promise<Uint8Array> => {
  const doc = await _gerarPDFFaturamentoDetalhadoDoc(cliente, periodo, operacoes, usuario);
  return new Uint8Array(doc.output("arraybuffer"));
};

// ===================== RE-EXPORTS LEGADO =====================

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