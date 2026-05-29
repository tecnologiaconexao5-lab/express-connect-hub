// PDF para Ordem de Serviço
// Mantém compatibilidade com a interface OSPDFData legada e adiciona
// versão profissional jsPDF com header navy e rodapé corporativo.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { empresaConfig } from "@/utils/empresaConfig";
import {
  getLogoWithFallback,
  drawLogoSafe,
  renderLogoTextPremium,
} from "@/lib/pdfLogoSupport";
import { drawHeaderNavy, drawFooterNavy } from "@/utils/pdfRelatorioOperacional";

// Interface legada (mantida para compatibilidade)
export interface OSPDFData {
  numero: string;
  cliente: string;
  prestador: string;
  data: string;
  valorCliente: number;
  valorPrestador: number;
  pedagio: number;
  impostos: number;
  margemBruta: number;
  margemLiquida: number;
}

// Interface profissional com dados completos da OS
export interface OSDadosProfissional {
  numero: string;
  data: string;
  cliente: string;
  clienteCnpj: string;
  prestador: string;
  veiculoTipo: string;
  veiculoPlaca: string;
  origem: string;
  destino: string;
  horario: string;
  kmTotal: number;
  valorCliente: number;
  valorPrestador: number;
  pedagio: number;
  espera: number;
  ajudante: number;
  adicionais: number;
  descontos: number;
  observacoes?: string;
}

const fmtBRL = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string) =>
  d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "-";

// ============================================================
// Função legada — retorna HTML (compatibilidade)
// ============================================================
export function gerarPDFOS(data: OSPDFData): string {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>OS ${data.numero}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
    .info { margin: 10px 0; }
    .info strong { display: inline-block; width: 120px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background-color: #007bff; color: white; }
    .valor { text-align: right; font-weight: bold; }
    .negativo { color: #dc3545; }
    .positivo { color: #28a745; }
    .footer { margin-top: 40px; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <h1>📋 Ordem de Serviço</h1>
  <div class="info"><strong>Nº OS:</strong> ${data.numero}</div>
  <div class="info"><strong>Data:</strong> ${data.data}</div>
  <div class="info"><strong>Cliente:</strong> ${data.cliente || "-"}</div>
  <div class="info"><strong>Prestador:</strong> ${data.prestador || "-"}</div>
  
  <table>
    <tr><th>Descrição</th><th class="valor">Valor</th></tr>
    <tr><td>Valor Cliente</td><td class="valor positivo">${fmt(data.valorCliente)}</td></tr>
    <tr><td>Valor Prestador</td><td class="valor negativo">-${fmt(data.valorPrestador)}</td></tr>
    <tr><td>Pedágio</td><td class="valor negativo">-${fmt(data.pedagio)}</td></tr>
    <tr><td>Impostos</td><td class="valor negativo">-${fmt(data.impostos)}</td></tr>
    <tr><td><strong>Margem Bruta</strong></td><td class="valor ${data.margemBruta >= 0 ? "positivo" : "negativo"}"><strong>${fmt(data.margemBruta)}</strong></td></tr>
    <tr><td><strong>Margem Líquida</strong></td><td class="valor ${data.margemLiquida >= 0 ? "positivo" : "negativo"}"><strong>${fmt(data.margemLiquida)}</strong></td></tr>
  </table>
  
  <div class="footer">
    <p>Gerado por TMS Conexão Express em ${new Date().toLocaleString("pt-BR")}</p>
  </div>
</body>
</html>
  `;
  
  return html;
}

export function imprimirOS(data: OSPDFData): void {
  const html = gerarPDFOS(data);
  const win = window.open("", "PDF", "width=800,height=600");
  if (win) {
    win.document.write(html);
    win.document.close();
    win.print();
  }
}

export function baixarPDFOS(data: OSPDFData): void {
  const html = gerarPDFOS(data);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `OS_${data.numero}.html`;
  link.click();
}

// ============================================================
// Versão profissional jsPDF — header navy, rodapé corporativo
// ============================================================
export const gerarPDFOrdemServicoProfissional = async (
  dados: OSDadosProfissional
): Promise<void> => {
  const logo = await getLogoWithFallback(true);
  const doc = new jsPDF("portrait", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const usableWidth = pageWidth - margin * 2;
  const dataHora = new Date().toLocaleString("pt-BR");

  drawHeaderNavy(doc, logo, pageWidth, margin, "ORDEM DE SERVIÇO", dados.numero, dataHora, undefined, "Sistema");

  const startY = 48;

  // Bloco informações principais
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, startY, usableWidth, 32, 2, 2, "FD");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 26, 46);
  doc.text("INFORMAÇÕES DA ORDEM DE SERVIÇO", margin + 4, startY + 5);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);

  const infoLeft = [
    { label: "Cliente:", value: dados.cliente },
    { label: "CNPJ:", value: dados.clienteCnpj },
    { label: "Prestador:", value: dados.prestador },
  ];
  const infoRight = [
    { label: "Data:", value: fmtData(dados.data) },
    { label: "Horário:", value: dados.horario },
    { label: "Veículo:", value: `${dados.veiculoTipo} - ${dados.veiculoPlaca}` },
  ];

  infoLeft.forEach((item, i) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(item.label, margin + 4, startY + 12 + i * 7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 26, 46);
    doc.text(item.value, margin + 22, startY + 12 + i * 7);
  });

  infoRight.forEach((item, i) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(item.label, pageWidth / 2 + 4, startY + 12 + i * 7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 26, 46);
    doc.text(item.value, pageWidth / 2 + 22, startY + 12 + i * 7);
  });

  // Rota
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(margin, startY + 35, pageWidth - margin, startY + 35);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("Origem:", margin + 4, startY + 41);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 26, 46);
  doc.text(dados.origem, margin + 18, startY + 41);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("Destino:", pageWidth / 2 + 4, startY + 41);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 26, 46);
  doc.text(dados.destino, pageWidth / 2 + 18, startY + 41);

  let yPos = startY + 50;

  // Tabela de valores
  autoTable(doc, {
    startY: yPos,
    head: [["Descrição", "Valor"]],
    body: [
      ["Valor Operação (Frete)", fmtBRL(dados.valorCliente)],
      ["Pedágio", fmtBRL(dados.pedagio)],
      ["Espera", fmtBRL(dados.espera)],
      ["Ajudante", fmtBRL(dados.ajudante)],
      ["Outros Adicionais", fmtBRL(dados.adicionais)],
      ["Descontos", `- ${fmtBRL(dados.descontos)}`],
    ],
    theme: "striped",
    headStyles: {
      fillColor: [15, 26, 46],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
    },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
    columnStyles: {
      0: { cellWidth: 100, halign: "left" },
      1: { cellWidth: 50, halign: "right" },
    },
    margin: { top: yPos, right: margin, bottom: 35, left: margin },
    didDrawPage: (data: any) => {
      drawFooterNavy(doc, pageWidth, pageHeight, margin);
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || yPos;

  // Total geral
  const totalGeral = dados.valorCliente + dados.pedagio + dados.espera + dados.ajudante + dados.adicionais - dados.descontos;
  const totalY = finalY + 4;

  doc.setFillColor(255, 247, 237);
  doc.setDrawColor(254, 215, 170);
  doc.roundedRect(margin, totalY, usableWidth, 12, 2, 2, "FD");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(249, 115, 22);
  doc.text("TOTAL GERAL DA ORDEM DE SERVIÇO", margin + 6, totalY + 8);

  doc.setFontSize(10);
  doc.setTextColor(15, 26, 46);
  doc.text(fmtBRL(totalGeral), pageWidth - margin - 6, totalY + 8, { align: "right" });

  // KM
  let kmY = totalY + 18;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, kmY, usableWidth, 12, 2, 2, "FD");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("Quilometragem Total:", margin + 6, kmY + 8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 26, 46);
  doc.text(`${dados.kmTotal} km`, margin + 40, kmY + 8);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("Repasse Prestador:", pageWidth / 2 + 4, kmY + 8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 26, 46);
  doc.text(fmtBRL(dados.valorPrestador), pageWidth / 2 + 40, kmY + 8);

  // Observações
  if (dados.observacoes) {
    const obsY = kmY + 18;
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, obsY, usableWidth, 20, 2, 2, "FD");

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 26, 46);
    doc.text("Observações", margin + 5, obsY + 6);

    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 116, 139);
    doc.text(dados.observacoes, margin + 5, obsY + 13, { maxWidth: usableWidth - 10 });
  }

  drawFooterNavy(doc, pageWidth, pageHeight, margin);

  doc.save(`ordem_servico_${dados.numero.replace(/[^a-z0-9]/gi, "_")}.pdf`);
};