import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useLogo } from "@/hooks/useLogo";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export interface PDFTemplateOptions {
  titulo: string;
  subtitulo?: string;
  filtros?: string[];
  logoUrl?: string;
  nomeEmpresa?: string;
  cnpj?: string;
}

const DEFAULT_EMPRESA = {
  nome: "Conexão Express Transportes LTDA",
  cnpj: "42.796.040/0001-31"
};

export function createProfessionalPDF(): jsPDF {
  const doc = new jsPDF("p", "mm", "a4");
  return doc;
}

export function addHeader(
  doc: jsPDF,
  options: PDFTemplateOptions,
  config: ReturnType<typeof useLogo>['config']
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 15;

  const hex = config.corPrimaria || "#F97316";
  const primaryColor = {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  };

  const darkHex = config.corSecundaria || "#0F1A2E";
  const secondaryColor = {
    r: parseInt(darkHex.slice(1, 3), 16),
    g: parseInt(darkHex.slice(3, 5), 16),
    b: parseInt(darkHex.slice(5, 7), 16)
  };

  if (options.logoUrl) {
    try {
      doc.addImage(options.logoUrl, 'PNG', margin, 5, 25, 12);
    } catch (e) {
      console.error('Erro ao adicionar logo no header:', e);
    }
  }

  const textX = options.logoUrl ? margin + 30 : margin + 5;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(secondaryColor.r, secondaryColor.g, secondaryColor.b);
  doc.text(options.nomeEmpresa || DEFAULT_EMPRESA.nome, textX, y + 5);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(options.cnpj || DEFAULT_EMPRESA.cnpj, textX, y + 10);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(secondaryColor.r, secondaryColor.g, secondaryColor.b);
  doc.text(options.titulo, pageWidth / 2, y + 5, { align: "center" });

  if (options.subtitulo) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(options.subtitulo, pageWidth / 2, y + 11, { align: "center" });
  }

  y += 18;

  doc.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);

  y += 5;

  if (options.filtros && options.filtros.length > 0) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    options.filtros.forEach((filtro, index) => {
      doc.text(filtro, margin, y + (index * 4));
    });
    y += options.filtros.length * 4 + 3;
  }

  return y;
}

export function addFooter(
  doc: jsPDF,
  pageNum: number,
  totalPages: number,
  usuario?: string,
  config?: ReturnType<typeof useLogo>['config']
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;

  const hex = config?.corPrimaria || "#F97316";
  const primaryColor = {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  };

  doc.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.setLineWidth(0.3);
  doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Emitido em: ${new Date().toLocaleString("pt-BR")}`, margin, pageHeight - 15);
  
  const usuarioTexto = usuario ? `Usuário: ${usuario}` : "";
  if (usuarioTexto) {
    doc.text(usuarioTexto, pageWidth / 2, pageHeight - 15, { align: "center" });
  }
  
  doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - margin, pageHeight - 15, { align: "right" });
}

export function addTable(
  doc: jsPDF,
  startY: number,
  head: any[],
  body: any[],
  config?: ReturnType<typeof useLogo>['config']
) {
  const hex = config?.corSecundaria || "#0F1A2E";
  const secondaryColor = {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  };

  const hexPrimary = config?.corPrimaria || "#F97316";
  const primaryColor = {
    r: parseInt(hexPrimary.slice(1, 3), 16),
    g: parseInt(hexPrimary.slice(3, 5), 16),
    b: parseInt(hexPrimary.slice(5, 7), 16)
  };

  autoTable(doc, {
    startY,
    head,
    body,
    theme: "striped",
    headStyles: {
      fillColor: [secondaryColor.r, secondaryColor.g, secondaryColor.b],
      textColor: 255,
      fontSize: 9,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 8,
      textColor: 50,
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250],
    },
    margin: { left: 20, right: 20 },
    didDrawPage: (data) => {
      data.cursor.y = data.cursor.y;
    },
  });

  return (doc as any).lastAutoTable?.finalY || startY;
}

export function addTotalsRow(
  doc: jsPDF,
  startY: number,
  totals: { label: string; value: string }[],
  config?: ReturnType<typeof useLogo>['config']
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  const hex = config?.corPrimaria || "#F97316";
  const primaryColor = {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  };

  const bgColor = [255, 243, 232];

  const tableWidth = pageWidth - 2 * margin;
  const colWidth = tableWidth / totals.length;

  doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
  doc.rect(margin, startY, tableWidth, 10, 'F');

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);

  totals.forEach((total, index) => {
    const x = margin + (index * colWidth);
    if (index === totals.length - 1) {
      doc.text(total.value, pageWidth - margin, startY + 7, { align: "right" });
    } else {
      doc.text(total.label, x + 5, startY + 7);
    }
  });

  return startY + 15;
}

export async function generateProfessionalReport(
  options: PDFTemplateOptions,
  head: any[],
  body: any[],
  totals?: { label: string; value: string }[],
  filename?: string
) {
  const doc = createProfessionalPDF();
  const { config, getLogo, shouldShowLogo } = useLogo();
  
  const logoUrl = shouldShowLogo('relatoriosPdf') ? await getLogo() : '';
  
  const y = addHeader(doc, { ...options, logoUrl }, config);
  const finalY = addTable(doc, y, head, body, config);
  
  if (totals && totals.length > 0) {
    addTotalsRow(doc, finalY + 10, totals, config);
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages, undefined, config);
  }

  doc.save(filename || `relatorio_${new Date().toISOString().split('T')[0]}.pdf`);
}
