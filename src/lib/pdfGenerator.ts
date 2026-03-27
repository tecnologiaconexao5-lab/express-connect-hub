import jsPDF from "jspdf";
import "jspdf-autotable";

// Add autotable definition so TS knows about it
// since jspdf-autotable modifies jsPDF prototype
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export const generateProfessionalPDF = (data: any, type: "ORÇAMENTO" | "ORDEM DE SERVIÇO") => {
  const doc = new jsPDF("p", "pt", "a4");

  // Colors
  const ORANGE = [234, 88, 12];
  const BLUE = [30, 58, 138];
  
  // -- Decorator Top Banner
  doc.setFillColor(ORANGE[0], ORANGE[1], ORANGE[2]);
  doc.rect(0, 0, 595, 10, "F");
  doc.setFillColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.rect(0, 10, 595, 20, "F");

  // -- Header
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138); // Dark Blue
  doc.text("CONEXÃO EXPRESS", 40, 60);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont("helvetica", "normal");
  doc.text("Transportes e Logística Avançada", 40, 75);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text(type, 297, 60, { align: "center" });

  doc.setFontSize(12);
  doc.text(data.numero || `${type === "ORÇAMENTO" ? "ORC" : "OS"}-0000X`, 555, 60, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Emissão: ${new Date().toLocaleDateString()}`, 555, 75, { align: "right" });
  if (type === "ORÇAMENTO") {
    doc.text(`Validade: ${new Date(new Date().setDate(new Date().getDate() + 7)).toLocaleDateString()}`, 555, 87, { align: "right" });
  }

  // Linear separator
  doc.setDrawColor(200);
  doc.line(40, 100, 555, 100);

  // -- Client Block
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text("CLIENTE", 40, 125);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(50);
  doc.text(`Razão Social: ${data.cliente || "RAZÃO SOCIAL NÃO INFORMADA"}`, 40, 140);
  doc.text(`CNPJ: ${data.cnpj || "00.000.000/0001-00"}`, 40, 155);
  doc.text(`Período / Referência: ${data.periodo || "Imediato"}`, 40, 170);

  // -- Executive Summary Block (Orange box right)
  doc.setFillColor(ORANGE[0], ORANGE[1], ORANGE[2]);
  doc.rect(340, 115, 215, 70, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("RESUMO EXECUTIVO", 350, 130);
  doc.setFont("helvetica", "normal");
  doc.text(`Total Posições/Entregas: ${data.entregas || 1}`, 350, 145);
  doc.text(`Valor Bruto Estimado: R$ ${(data.valorTotal || data.valorCliente || 0).toLocaleString("pt-BR")}`, 350, 160);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`TOTAL A FATURAR: R$ ${(data.valorTotal || data.valorCliente || 0).toLocaleString("pt-BR")}`, 350, 175);

  // -- Main Table
  let currentY = 220;
  
  const tableData = data.tabela ? data.tabela : [
    [new Date().toLocaleDateString(), data.prestador || "Padrão", data.veiculoAlocado || "Utilitário", data.placa || "ABC-1234", `R$ ${(data.valorTotal || data.valorCliente || 0).toLocaleString("pt-BR")}`]
  ];

  doc.autoTable({
    startY: currentY,
    head: [["DATA", "PRESTADOR", "VEÍCULO", "PLACA", "VALOR"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: BLUE, textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 8, textColor: 50 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 40, right: 40 },
    didDrawPage: (dataHook: any) => { currentY = dataHook.cursor.y; }
  });

  currentY = (doc as any).lastAutoTable.finalY + 20;

  // -- Total Consolidated Block (Orange right)
  doc.setFillColor(ORANGE[0], ORANGE[1], ORANGE[2]);
  doc.rect(340, currentY, 215, 30, "F");
  doc.setTextColor(255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`TOTAL GERAL: R$ ${(data.valorTotal || data.valorCliente || 0).toLocaleString("pt-BR")}`, 447, currentY + 19, { align: "center" });

  currentY += 60;

  // -- Conditions & Footer
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.setFont("helvetica", "bold");
  doc.text("Condições e Prazo:", 40, currentY);
  doc.setFont("helvetica", "normal");
  doc.text("Prazo de pagamento de 15 dias após emissão de NF. Valores sujeitos a reajuste em caso de KM excedente.", 40, currentY + 12);
  
  currentY += 60;

  // Signatures
  doc.setDrawColor(150);
  doc.line(80, currentY, 250, currentY);
  doc.line(340, currentY, 510, currentY);
  doc.text("Conexão Express Transportes LTDA", 165, currentY + 15, { align: "center" });
  doc.text(`Assinatura do Cliente / Recebedor`, 425, currentY + 15, { align: "center" });

  // Bottom Footer
  doc.setFontSize(8);
  doc.setTextColor(180);
  doc.text("Conexão Express Transportes LTDA - CNPJ: 00.123.456/0001-00", 297, 800, { align: "center" });
  doc.text("Sua carga com segurança e velocidade que importam.", 297, 810, { align: "center" });

  doc.save(`${type.toLowerCase()}_${data.numero || "0000"}.pdf`);
};
