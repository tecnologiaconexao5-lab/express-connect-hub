// ============================================================
// FUNDAÇÃO PROFISSIONAL DE PDF — Conexão Express
//
// Motor de renderização puro. Não usa componentes React.
// Layout editorial corporativo — sem cards, sem dashboard.
//
// Estrutura:
//   Página 1: Capa corporativa (navy, logo grande, dados do documento)
//   Páginas 2+: Conteúdo executivo (header leve, tabelas, análises)
// ============================================================

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { empresaConfig } from "@/utils/empresaConfig";

// ======================== PALETA CORPORATIVA ========================
export const NAVY: [number, number, number] = [15, 26, 46];
export const ORANGE: [number, number, number] = [249, 115, 22];
export const WHITE: [number, number, number] = [255, 255, 255];
export const TEXT_DARK: [number, number, number] = [30, 41, 59];
export const TEXT_BODY: [number, number, number] = [71, 85, 105];
export const TEXT_MUTED: [number, number, number] = [148, 163, 184];
export const BORDER: [number, number, number] = [226, 232, 240];
export const BG_WARM: [number, number, number] = [255, 251, 245];
export const BG_LIGHT: [number, number, number] = [248, 250, 252];
export const GREEN: [number, number, number] = [16, 185, 129];
export const RED_SOFT: [number, number, number] = [239, 68, 68];

// ======================== LOGOTIPO OFICIAL ========================
export interface PdfLogo {
  base64: string;
  naturalWidth: number;
  naturalHeight: number;
}

let _cachedLogo: PdfLogo | null = null;

async function measureImage(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 1545, h: 982 });
    img.src = src;
  });
}

async function fetchToBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Carrega o logotipo oficial branco (para fundos escuros).
 * Prioridade exclusiva: /logos/logo-conexao-branco.png
 * NUNCA retorna fallback "CX".
 */
export async function loadLogo(): Promise<PdfLogo | null> {
  if (_cachedLogo) return _cachedLogo;

  const url = "/logos/logo-conexao-oficial.png";
  const base64 = await fetchToBase64(url);
  if (base64) {
    const dims = await measureImage(base64);
    _cachedLogo = { base64, naturalWidth: dims.w, naturalHeight: dims.h };
    return _cachedLogo;
  }

  return null;
}

function drawLogoOnDark(
  doc: jsPDF,
  logo: PdfLogo | null,
  x: number,
  y: number,
  maxW: number,
  maxH: number
): number {
  if (logo) {
    const ratio = logo.naturalWidth / logo.naturalHeight;
    let w = maxW;
    let h = w / ratio;
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }
    const drawY = y + (maxH - h) / 2;
    try {
      doc.addImage(logo.base64, "PNG", x, drawY, w, h, undefined, "FAST");
    } catch {
      renderLogoText(doc, x, y + maxH / 2, "CONEXÃO EXPRESS", true);
    }
    return w;
  }

  renderLogoText(doc, x, y + maxH / 2, "CONEXÃO EXPRESS", true);
  return 0;
}

function drawLogoOnLight(
  doc: jsPDF,
  logo: PdfLogo | null,
  x: number,
  y: number,
  maxW: number,
  maxH: number
): number {
  if (logo) {
    const ratio = logo.naturalWidth / logo.naturalHeight;
    let w = maxW;
    let h = w / ratio;
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }
    const drawY = y + (maxH - h) / 2;
    try {
      doc.addImage(logo.base64, "PNG", x, drawY, w, h, undefined, "FAST");
    } catch {
      renderLogoText(doc, x, y + maxH / 2, "CONEXÃO EXPRESS", false);
    }
    return w;
  }

  renderLogoText(doc, x, y + maxH / 2, "CONEXÃO EXPRESS", false);
  return 0;
}

function renderLogoText(
  doc: jsPDF,
  x: number,
  y: number,
  text: string,
  onDark: boolean
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(onDark ? 22 : 18);
  doc.setTextColor(onDark ? 255 : NAVY[0], onDark ? 255 : NAVY[1], onDark ? 255 : NAVY[2]);
  doc.text(text, x, y);
}

// ===================== PÁGINA 1: CAPA CORPORATIVA =====================

export interface CoverOptions {
  documentType: string;
  documentNumber: string;
  entityName: string;
  entitySubtitle?: string;
  status?: string;
  date?: string;
  via?: "Cliente" | "Prestador";
}

/**
 * Renderiza a capa (página 1) do documento corporativo.
 * Fundo navy completo, logo grande, dados do documento.
 */
export async function drawCoverPage(
  doc: jsPDF,
  opts: CoverOptions
): Promise<PdfLogo | null> {
  const logo = await loadLogo();
  const W = doc.internal.pageSize.getWidth();
  const M = 15;
  const bannerH = 75;

  // Fundo navy
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, 0, W, bannerH, "F");

  // Logo
  drawLogoOnDark(doc, logo, M, 12, 100, 32);

  // Slogan
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(230, 235, 245);
  doc.text("TRANSPORTES & LOGÍSTICA", M, 48);

  // Linha laranja divisória perfeitamente abaixo do logo
  doc.setDrawColor(ORANGE[0], ORANGE[1], ORANGE[2]);
  doc.setLineWidth(0.6);
  doc.line(M, 53, W - M, 53);

  // Dados da empresa
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(180, 190, 205);
  doc.text(`CNPJ: ${empresaConfig.cnpj}`, M, 60);
  doc.text(`${empresaConfig.telefone}  •  ${empresaConfig.email}`, M, 65);

  // Bloco direito: tipo do documento + número
  const rightX = W - M;
  let blockY = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.text(opts.documentType, rightX, blockY, { align: "right" });
  blockY += 10;

  doc.setFontSize(22);
  doc.setTextColor(ORANGE[0], ORANGE[1], ORANGE[2]);
  doc.text(opts.documentNumber, rightX, blockY, { align: "right" });
  blockY += 10;

  if (opts.entityName) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
    doc.text(opts.entityName, rightX, blockY, { align: "right" });
    blockY += 6;
  }

  if (opts.entitySubtitle) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(180, 190, 205);
    doc.text(opts.entitySubtitle, rightX, blockY, { align: "right" });
  }

  return logo;
}

// ===================== PÁGINAS 2+: HEADER EXECUTIVO =====================

export interface ContentHeaderOptions {
  title: string;
  subtitle?: string;
  pageLabel?: string;
}

/**
 * Header leve para páginas de conteúdo (2 em diante).
 * Diferente da capa — barra fina, logo pequeno, sem cards.
 */
export function drawContentHeader(
  doc: jsPDF,
  pageWidth: number,
  margin: number,
  logo: PdfLogo | null,
  opts: ContentHeaderOptions
): number {
  const headerH = 25;
  const pageNum = doc.getNumberOfPages();

  // Fundo branco com borda inferior fina
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, headerH, "F");
  doc.setDrawColor(ORANGE[0], ORANGE[1], ORANGE[2]);
  doc.setLineWidth(0.8);
  doc.line(margin, headerH, pageWidth - margin, headerH);

  // Logo pequeno à esquerda
  if (logo) {
    const ratio = logo.naturalWidth / logo.naturalHeight;
    const logoH = 10;
    const logoW = logoH * ratio;
    try {
      doc.addImage(logo.base64, "PNG", margin, 4, logoW, logoH, undefined, "FAST");
    } catch {
      /* ignora */
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text("CONEXÃO EXPRESS", margin, 12);
  }

  // Título à direita
  const rightX = pageWidth - margin;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(opts.title, rightX, 10, { align: "right" });

  if (opts.subtitle) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(TEXT_BODY[0], TEXT_BODY[1], TEXT_BODY[2]);
    doc.text(opts.subtitle, rightX, 16, { align: "right" });
  }

  // Número da página
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  const pageText = opts.pageLabel ? `${opts.pageLabel} — Pág. ${pageNum}` : `Página ${pageNum}`;
  doc.text(pageText, rightX, 21, { align: "right" });

  return headerH + 8;
}

// ===================== RODAPÉ EXECUTIVO =====================

export function drawContentFooter(
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  margin: number
) {
  const footerY = pageHeight - 14;

  // Linha fina separadora
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);

  const pageNum = doc.getNumberOfPages();
  doc.text(`${empresaConfig.nome} — CNPJ: ${empresaConfig.cnpj}`, margin, footerY + 5);
  doc.text(`Página ${pageNum}`, pageWidth - margin, footerY + 5, { align: "right" });
  doc.text(
    "Documento gerado eletronicamente",
    pageWidth / 2,
    footerY + 9,
    { align: "center" }
  );
}

// ===================== SETUP MULTI-PÁGINA =====================

export interface PageSetup {
  pageWidth: number;
  pageHeight: number;
  margin: number;
  contentWidth: number;
}

export function getPageSetup(doc: jsPDF, margin: number = 15): PageSetup {
  return {
    pageWidth: doc.internal.pageSize.getWidth(),
    pageHeight: doc.internal.pageSize.getHeight(),
    margin,
    contentWidth: doc.internal.pageSize.getWidth() - margin * 2,
  };
}

// ===================== TABELA CORPORATIVA =====================

export interface CorporateTableOptions {
  startY: number;
  columns: string[];
  rows: (string | number)[][];
  columnWidths?: { [key: number]: number };
  columnAligns?: { [key: number]: "left" | "center" | "right" };
  fontSize?: number;
  headerFontSize?: number;
  /** Renderiza cabeçalho de conteúdo em páginas seguintes */
  onPageDraw?: (doc: jsPDF, page: PageSetup, logo: PdfLogo | null) => void;
}

/**
 * Renderiza uma tabela corporativa usando autoTable, com estilo limpo.
 * Header navy, rows alternadas, sem cards.
 */
export function drawCorporateTable(
  doc: jsPDF,
  page: PageSetup,
  logo: PdfLogo | null,
  opts: CorporateTableOptions
): number {
  const colStyles: any = {};
  if (opts.columnWidths) {
    Object.entries(opts.columnWidths).forEach(([k, v]) => {
      colStyles[Number(k)] = { cellWidth: v };
    });
  }
  if (opts.columnAligns) {
    Object.entries(opts.columnAligns).forEach(([k, v]) => {
      colStyles[Number(k)] = { ...colStyles[Number(k)], halign: v };
    });
  }

  autoTable(doc, {
    startY: opts.startY,
    head: [opts.columns],
    body: opts.rows,
    theme: "striped",
    headStyles: {
      fillColor: NAVY,
      textColor: 255,
      fontStyle: "bold",
      fontSize: opts.headerFontSize ?? 7.5,
      halign: "center",
      valign: "middle",
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: opts.fontSize ?? 7,
      textColor: TEXT_BODY,
      valign: "middle",
      cellPadding: 2.5,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: colStyles,
    tableWidth: page.contentWidth,
    margin: {
      top: 35,
      right: page.margin,
      bottom: page.margin + 20,
      left: page.margin,
    },
    tableLineColor: BORDER,
    tableLineWidth: 0.15,
    didDrawPage: (data: any) => {
      drawContentFooter(doc, page.pageWidth, page.pageHeight, page.margin);
      if (data.pageNumber > 1 && opts.onPageDraw) {
        opts.onPageDraw(doc, page, logo);
      }
    },
  });

  return (doc as any).lastAutoTable?.finalY ?? opts.startY;
}

// ===================== SEÇÃO: TÍTULO =====================

export function drawSectionTitle(
  doc: jsPDF,
  x: number,
  y: number,
  title: string,
  page: PageSetup
): number {
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(title, x, y);

  doc.setDrawColor(ORANGE[0], ORANGE[1], ORANGE[2]);
  doc.setLineWidth(0.5);
  const lineY = y + 1.5;
  doc.line(x, lineY, x + 55, lineY);

  return y + 8;
}

// ===================== SEÇÃO: QUADRO INFORMATIVO =====================

export interface InfoField {
  label: string;
  value: string;
  col?: "left" | "right";
}

/**
 * Renderiza um quadro informativo limpo (dados do cliente/prestador).
 * Estilo editorial — borda fina, sem fundo colorido forte.
 */
export function drawInfoBlock(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  title: string,
  fields: InfoField[]
): number {
  const padding = 5;
  const lineHeight = 6;
  const titleH = 8;
  const contentH = fields.length * lineHeight + padding * 2;
  const totalH = titleH + contentH;

  // Fundo sutil
  doc.setFillColor(250, 251, 253);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.25);
  doc.rect(x, y, w, totalH, "FD");

  // Título
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(title, x + padding, y + padding + 4);

  // Linha separadora do título
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.15);
  doc.line(x + padding, y + titleH + 2, x + w - padding, y + titleH + 2);

  // Campos
  const fieldY = y + titleH + padding;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");

  const leftFields = fields.filter((f) => f.col !== "right");
  const rightFields = fields.filter((f) => f.col === "right");

  leftFields.forEach((f, i) => {
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text(f.label + ":", x + padding, fieldY + 4 + i * lineHeight);
    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    doc.setFont("helvetica", "bold");
    const labelW = doc.getTextWidth(f.label + ": ");
    doc.text(f.value, x + padding + labelW + 1, fieldY + 4 + i * lineHeight);
    doc.setFont("helvetica", "normal");
  });

  rightFields.forEach((f, i) => {
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text(f.label + ":", x + w / 2, fieldY + 4 + i * lineHeight);
    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    doc.setFont("helvetica", "bold");
    const labelW = doc.getTextWidth(f.label + ": ");
    doc.text(f.value, x + w / 2 + labelW + 1, fieldY + 4 + i * lineHeight);
    doc.setFont("helvetica", "normal");
  });

  return y + totalH + 6;
}

// ===================== SEÇÃO: COMPOSIÇÃO FINANCEIRA =====================

export interface FinancialLine {
  label: string;
  value: number;
  highlight?: boolean;
  indent?: boolean;
  isTotal?: boolean;
}

/**
 * Renderiza a composição financeira em formato de tabela editorial.
 * SEM cards — tabela limpa com labels e valores alinhados.
 */
export function drawFinancialComposition(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  title: string,
  lines: FinancialLine[]
): number {
  const padding = 5;
  const lineH = 7;
  const titleH = 9;
  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const totalH = titleH + lines.length * lineH + padding * 2;

  // Fundo
  doc.setFillColor(250, 251, 253);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.25);
  doc.rect(x, y, w, totalH, "FD");

  // Título da composição
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(title, x + padding, y + padding + 5);

  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.15);
  doc.line(x + padding, y + titleH + 2, x + w - padding, y + titleH + 2);

  const valueX = x + w - padding;
  let ly = y + titleH + padding;

  lines.forEach((line) => {
    const curY = ly + 4;

    if (line.isTotal) {
      doc.setDrawColor(ORANGE[0], ORANGE[1], ORANGE[2]);
      doc.setLineWidth(0.5);
      doc.line(x + padding, curY - 7, valueX, curY - 7);
    }

    doc.setFontSize(7.5);
    doc.setFont("helvetica", line.highlight || line.isTotal ? "bold" : "normal");
    doc.setTextColor(
      line.highlight || line.isTotal ? NAVY[0] : TEXT_BODY[0],
      line.highlight || line.isTotal ? NAVY[1] : TEXT_BODY[1],
      line.highlight || line.isTotal ? NAVY[2] : TEXT_BODY[2]
    );

    const label = line.indent ? `  ${line.label}` : line.label;
    doc.text(label, x + padding + (line.indent ? 4 : 0), curY);
    doc.text(fmt(line.value), valueX, curY, { align: "right" });

    ly += lineH;
  });

  return y + totalH + 6;
}

// ===================== SEÇÃO: OBSERVAÇÕES =====================

export function drawObservations(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  text: string
): number {
  const padding = 4;
  const boxH = 14;

  doc.setFillColor(BG_WARM[0], BG_WARM[1], BG_WARM[2]);
  doc.setDrawColor(254, 215, 170);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, boxH, "FD");

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text("OBSERVAÇÕES", x + padding, y + padding + 3);

  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(TEXT_BODY[0], TEXT_BODY[1], TEXT_BODY[2]);
  doc.text(text, x + padding, y + padding + 7, { maxWidth: w - padding * 2 });

  return y + boxH + 6;
}

// ===================== SEÇÃO: ASSINATURA / CONFERÊNCIA =====================

export interface SignatureOptions {
  leftLabel: string;
  leftSub?: string;
  rightLabel: string;
  rightSub?: string;
}

/**
 * Renderiza o bloco de assinatura / conferência.
 */
export function drawSignatureBlock(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  opts: SignatureOptions
): number {
  const lineY = y + 14;

  doc.setDrawColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  doc.setLineWidth(0.4);

  const leftStart = x + 8;
  const leftEnd = x + w / 2 - 10;
  doc.line(leftStart, lineY, leftEnd, lineY);

  const rightStart = x + w / 2 + 10;
  const rightEnd = x + w - 8;
  doc.line(rightStart, lineY, rightEnd, lineY);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.text(opts.leftLabel, x + w / 4, lineY + 5, { align: "center" });
  doc.text(opts.rightLabel, x + (w / 4) * 3, lineY + 5, { align: "center" });

  if (opts.leftSub || opts.rightSub) {
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    if (opts.leftSub)
      doc.text(opts.leftSub, x + w / 4, lineY + 9, { align: "center" });
    if (opts.rightSub)
      doc.text(opts.rightSub, x + (w / 4) * 3, lineY + 9, { align: "center" });
  }

  return lineY + 16;
}

// ===================== SEÇÃO: RESUMO OPERACIONAL =====================

export interface SummaryMetric {
  label: string;
  value: string;
}

/**
 * Renderiza um resumo em grid 2 colunas (labels + valores).
 * Estilo limpo, sem fundos coloridos de card.
 */
export function drawMetricsGrid(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  title: string,
  metrics: SummaryMetric[]
): number {
  const padding = 5;
  const titleH = 9;
  const metricH = 6.5;
  const cols = 2;
  const rows = Math.ceil(metrics.length / cols);
  const contentH = rows * metricH + padding * 2;
  const totalH = titleH + contentH;

  // Fundo sutil
  doc.setFillColor(250, 251, 253);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.25);
  doc.rect(x, y, w, totalH, "FD");

  // Título
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(title, x + padding, y + padding + 5);

  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.15);
  doc.line(x + padding, y + titleH + 2, x + w - padding, y + titleH + 2);

  const colW = (w - padding * 3) / cols;
  let my = y + titleH + padding + 2;

  metrics.forEach((m, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const cx = x + padding + c * (colW + padding);
    const cy = my + r * metricH;

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text(m.label, cx, cy + 3);

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text(m.value, cx, cy + 3 + metricH / 2 + 2);
  });

  return y + totalH + 6;
}

// ===================== UTILITÁRIOS DE FORMATAÇÃO =====================

export const fmtBRL = (v: any): string => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export const fmtDate = (d?: string): string => {
  try {
    if (!d) return "—";
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return "—";
    return parsed.toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
};

export const fmtNumber = (v: any, decimals = 0): string => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export { autoTable };
