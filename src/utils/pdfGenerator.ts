import jsPDF from "jspdf";
import "jspdf-autotable";
import { empresaConfig } from "./empresaConfig";

interface PDFOptions {
  titulo: string;
  subtitulo?: string;
  colunas: string[];
  linhas: any[][];
  totais?: { label: string; valor: string }[];
  orientacao?: "portrait" | "landscape";
}

export const carregarLogoBase64Utils = async (): Promise<string | null> => {
  try {
    const response = await fetch('/logo-oficial-conexao.png');
    if (response.ok) {
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }
  } catch (e) {
    console.warn("Logo não encontrado:", e);
  }
  return null;
};

export const gerarPDFProfissional = async ({ titulo, subtitulo, colunas, linhas, totais, orientacao = "portrait" }: PDFOptions) => {
  const logo = await carregarLogoBase64Utils();
  const doc = new jsPDF(orientacao, "pt", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;

  // Header Helper
  const drawHeader = () => {
    // Fundo do header
    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(0, 0, pageWidth, 100, "F");

    // Logo (placeholder ou tenta carregar)
    if (logo) {
      try {
        // dimensions for 3:1 aspect ratio on pt unit (72 vs 24)
        doc.addImage(logo, "PNG", margin, 25, 108, 36);
      } catch (e) {
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("CONEXÃO EXPRESS", margin, 45);
      }
    } else {
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text("CONEXÃO EXPRESS", margin, 45);
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(empresaConfig.cnpj, margin, 60);
    doc.text(empresaConfig.telefone, margin, 75);

    // Título
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(titulo, pageWidth - margin, 45, { align: "right" });

    if (subtitulo) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(subtitulo, pageWidth - margin, 60, { align: "right" });
    }

    const dataGeracao = new Date().toLocaleString("pt-BR");
    doc.setFontSize(8);
    doc.text(`Gerado em: ${dataGeracao}`, pageWidth - margin, 75, { align: "right" });

    // Linha divisória
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(margin, 100, pageWidth - margin, 100);
  };

  // Draw initial header
  drawHeader();

  // Tabela
  (doc as any).autoTable({
    startY: 120,
    head: [colunas],
    body: linhas,
    theme: "striped",
    headStyles: {
      fillColor: [15, 23, 42], // slate-900
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
      halign: "center"
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85] // slate-700
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // slate-50
    },
    margin: { top: 120, right: margin, bottom: 80, left: margin },
    didDrawPage: (data: any) => {
      // Footer
      const str = `Página ${doc.internal.getNumberOfPages()}`;
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(str, pageWidth / 2, pageHeight - 20, { align: "center" });
      
      // Header em novas páginas
      if (data.pageNumber > 1) {
        drawHeader();
      }
    }
  });

  // Totais
  if (totais && totais.length > 0) {
    let finalY = (doc as any).lastAutoTable.finalY + 20;
    
    // Verifica se precisa de nova página para os totais
    if (finalY > pageHeight - 100) {
      doc.addPage();
      finalY = 120;
    }

    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(margin, finalY, pageWidth - (margin * 2), (totais.length * 20) + 20, "F");
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);

    let currentY = finalY + 20;
    totais.forEach(t => {
      doc.text(t.label, margin + 20, currentY);
      doc.text(t.valor, pageWidth - margin - 20, currentY, { align: "right" });
      currentY += 20;
    });
  }

  doc.save(`${titulo.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
};
