// ============================================================
// Template profissional único para relatórios PDF do TMS
// - Padrão visual Conexão Express (navy + laranja)
// - Logo oficial com fallback seguro
// - Componentes reutilizáveis para todos os relatórios
// ============================================================
import { empresaConfig } from "./empresaConfig";
import { getLogoWithFallback, drawLogoSafe } from "@/lib/pdfLogoSupport";

const navyRGB: [number, number, number] = [15, 26, 46];
const orangeRGB: [number, number, number] = [249, 115, 22];
const slate700: [number, number, number] = [51, 65, 85];
const slate400: [number, number, number] = [148, 163, 184];
const lightBg: [number, number, number] = [248, 250, 252];

export type PdfLogo = Awaited<ReturnType<typeof getLogoWithFallback>>;

interface HeaderOptions {
  title: string
  subtitle?: string
  period?: string
  user?: string
}

/**
 * Desenha cabeçalho padrão navy com logo
 */
export async function drawPdfHeaderConexao(
  doc: any,
  pageWidth: number,
  margin: number,
  options: HeaderOptions
) {
  const logo = await getLogoWithFallback(true);
  const dataHora = new Date().toLocaleString("pt-BR");

  doc.setFillColor(navyRGB[0], navyRGB[1], navyRGB[2]);
  doc.rect(0, 0, pageWidth, 40, "F");

  drawLogoSafe(doc, logo, {
    x: margin,
    y: 4,
    maxWidth: 67,
    maxHeight: 33,
    align: "left",
    valign: "middle",
    onFallback: () => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text("CONEXÃO EXPRESS", margin, 18);
    },
  });

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 200, 200);
  doc.text(
    `${empresaConfig.cnpj}  •  ${empresaConfig.telefone}  •  ${empresaConfig.email}`,
    margin,
    36
  );

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(options.title, pageWidth - margin, 15, { align: "right" });

  if (options.subtitle) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(options.subtitle, pageWidth - margin, 22, { align: "right" });
  }

  doc.setFontSize(6.5);
  doc.text(`Gerado em: ${dataHora}`, pageWidth - margin, 29, { align: "right" });
  if (options.period) {
    doc.text(`Período: ${options.period}`, pageWidth - margin, 34, { align: "right" });
  } else if (options.user) {
    doc.text(`Responsável: ${options.user}`, pageWidth - margin, 34, { align: "right" });
  }

  doc.setDrawColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, 40, pageWidth - margin, 40);

  return { logo, dataHora };
}

/**
 * Desenha rodapé padrão claro com linha laranja
 */
export function drawPdfFooterConexao(
  doc: any,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  logo?: PdfLogo
) {
  const pageNum = doc.internal.getNumberOfPages();
  const totalPages = doc.internal.getNumberOfPages();

  doc.setFillColor(255, 255, 255);
  doc.rect(0, pageHeight - 18, pageWidth, 18, "F");
  doc.setDrawColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
  doc.setLineWidth(0.4);
  doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);

  if (logo?.base64 && !logo.isText) {
    try {
      const logoH = 8;
      const logoW = (logo.naturalWidth || 200) * (logoH / (logo.naturalHeight || 40));
      doc.addImage(logo.base64, "WEBP", margin, pageHeight - 14, logoW, logoH);
    } catch {
      renderFooterText(doc, pageWidth, pageHeight, margin, pageNum);
    }
  } else {
    renderFooterText(doc, pageWidth, pageHeight, margin, pageNum);
  }

  doc.setFontSize(5.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(slate400[0], slate400[1], slate400[2]);
  doc.text(empresaConfig.slogan || "", pageWidth / 2, pageHeight - 3, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text(`Página ${pageNum}`, pageWidth - margin, pageHeight - 5, { align: "right" });
}

function renderFooterText(
  doc: any,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  pageNum: number
) {
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(slate700[0], slate700[1], slate700[2]);
  doc.text(empresaConfig.nome, margin, pageHeight - 5);
  doc.setFontSize(5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(slate400[0], slate400[1], slate400[2]);
  doc.text(`CNPJ: ${empresaConfig.cnpj}`, margin, pageHeight - 1);
}

/**
 * Desenha título de seção com linha separadora
 */
export function drawPdfSectionTitle(
  doc: any,
  x: number,
  y: number,
  text: string,
  pageWidth: number,
  margin: number
) {
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(navyRGB[0], navyRGB[1], navyRGB[2]);
  doc.text(text, x, y);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(margin, y + 1, pageWidth - margin, y + 1);
  return y + 6;
}

/**
 * Desenha card informativo com label e valor
 */
export function drawPdfKpiCard(
  doc: any,
  cx: number,
  cy: number,
  cw: number,
  ch: number,
  label: string,
  valor: string,
  cor: number[] = navyRGB,
  bg: number[] = lightBg
) {
  doc.setFillColor(bg[0], bg[1], bg[2]);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(cx, cy, cw, ch, 1.5, 1.5, "FD");
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text(label, cx + 4, cy + 5);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(cor[0], cor[1], cor[2]);
  doc.text(valor, cx + 4, cy + 13);
}

/**
 * Desenha box de informações (dados do cliente/prestador)
 */
export function drawPdfInfoBox(
  doc: any,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  lines: { label: string; value: string }[]
) {
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(navyRGB[0], navyRGB[1], navyRGB[2]);
  doc.text(title, x + 4, y + 5);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(slate700[0], slate700[1], slate700[2]);
  lines.forEach((l, i) => {
    doc.text(`${l.label}: ${l.value}`, x + 4, y + 11 + i * 4);
  });
}

/**
 * Mensagem profissional para dados vazios
 */
export function drawPdfEmptyState(
  doc: any,
  x: number,
  y: number,
  w: number,
  message: string
) {
  doc.setFillColor(255, 247, 237);
  doc.setDrawColor(254, 215, 170);
  doc.roundedRect(x, y, w, 16, 2, 2, "FD");
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(180, 83, 9);
  doc.text(message || "Nenhum dado encontrado para o período/filtros selecionados.", x + 6, y + 10);
}

/**
 * Área de assinatura para fechamento
 */
export function drawPdfSignatureArea(
  doc: any,
  x: number,
  y: number,
  w: number,
  empresaLabel: string,
  clienteLabel: string
) {
  doc.setDrawColor(180, 190, 200);
  doc.setLineWidth(0.5);
  doc.line(x + 8, y, x + w / 2 - 8, y);
  doc.line(x + w / 2 + 8, y, x + w - 8, y);

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(slate700[0], slate700[1], slate700[2]);
  doc.text(empresaLabel, x + w / 4, y + 5, { align: "center" });
  doc.text(clienteLabel, x + (w / 4) * 3, y + 5, { align: "center" });

  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Responsável Financeiro", x + w / 4, y + 9, { align: "center" });
  doc.text("Aceite Comercial / Assinatura", x + (w / 4) * 3, y + 9, { align: "center" });
}
