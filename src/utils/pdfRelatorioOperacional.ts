// ============================================================
// PDFs do módulo de Relatório Operacional de Faturamento
// - Usa helper global drawLogoSafe (preserva aspect ratio)
// - Sem qualquer referência a "Enterprise"
// - Documentos cliente-facing NÃO exibem margem, custo interno,
//   repasse a prestador ou resultado financeiro interno.
// ============================================================
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { empresaConfig } from "./empresaConfig";
import {
  getLogoWithFallback,
  drawLogoSafe,
  renderLogoTextFallback,
} from "@/lib/pdfLogoSupport";

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

const primaryRGB = [249, 115, 22]; // Orange Conexão Express
const darkRGB = [15, 26, 46]; // Navy Dark
const grayRGB = [100, 116, 139];
const lightBgRGB = [248, 250, 252];

/**
 * Gera o PDF profissional do Relatório Operacional de Faturamento
 * (visão agregada por cliente / consolidado).
 */
export const gerarPDFRelatorioOperacional = async (
  options: PDFReportOptions
): Promise<void> => {
  const logo = await getLogoWithFallback(true);
  const doc = new jsPDF(options.orientacao || "landscape", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const usableWidth = pageWidth - margin * 2;
  const dataHora = new Date().toLocaleString("pt-BR");

  const drawHeader = () => {
    doc.setFillColor(darkRGB[0], darkRGB[1], darkRGB[2]);
    doc.rect(0, 0, pageWidth, 38, "F");

    drawLogoSafe(doc, logo, {
      x: margin,
      y: 5,
      maxWidth: 50,
      maxHeight: 28,
      align: "left",
      valign: "middle",
      onFallback: () => renderLogoTextFallback(doc, margin, 18, "CONEXÃO EXPRESS", true),
    });

    doc.setFontSize(7);
    doc.setTextColor(200, 200, 200);
    doc.setFont("helvetica", "normal");
    doc.text(
      `${empresaConfig.cnpj}  •  ${empresaConfig.telefone}  •  ${empresaConfig.email}`,
      margin,
      35
    );

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(options.titulo, pageWidth - margin, 15, { align: "right" });

    if (options.subtitulo) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(options.subtitulo, pageWidth - margin, 21, { align: "right" });
    }

    doc.setFontSize(7);
    doc.text(`Gerado em: ${dataHora}`, pageWidth - margin, 28, { align: "right" });
    if (options.periodo) {
      doc.text(`Período: ${options.periodo}`, pageWidth - margin, 32, { align: "right" });
    } else if (options.usuario) {
      doc.text(`Responsável: ${options.usuario}`, pageWidth - margin, 32, { align: "right" });
    }

    doc.setDrawColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, 38, pageWidth - margin, 38);
  };

  drawHeader();

  const startY = 46;

  autoTable(doc, {
    startY,
    head: [options.colunas],
    body: options.linhas,
    theme: "striped",
    headStyles: {
      fillColor: [darkRGB[0], darkRGB[1], darkRGB[2]],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "center",
      valign: "middle",
    },
    bodyStyles: { fontSize: 7, textColor: [51, 65, 85], valign: "middle" },
    alternateRowStyles: { fillColor: [lightBgRGB[0], lightBgRGB[1], lightBgRGB[2]] },
    margin: { top: startY, right: margin, bottom: 35, left: margin },
    didDrawPage: (data: any) => {
      const pageNum = doc.internal.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(grayRGB[0], grayRGB[1], grayRGB[2]);

      doc.setDrawColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);

      doc.text(`Página ${pageNum}`, pageWidth / 2, pageHeight - 14, { align: "center" });
      doc.text(`Emitido por ${options.usuario || "Sistema"} - ${dataHora}`, margin, pageHeight - 14);
      doc.text(empresaConfig.nome, pageWidth - margin, pageHeight - 14, { align: "right" });

      if (data.pageNumber > 1) drawHeader();
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || startY;

  if (options.totais && options.totais.length > 0) {
    let totalsY = finalY + 8;
    if (totalsY > pageHeight - 50) {
      doc.addPage();
      totalsY = 46;
    }

    doc.setFillColor(lightBgRGB[0], lightBgRGB[1], lightBgRGB[2]);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, totalsY, usableWidth, options.totais.length * 8 + 8, 2, 2, "FD");

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(darkRGB[0], darkRGB[1], darkRGB[2]);
    doc.text("RESUMO OPERACIONAL", margin + 4, totalsY + 6);

    doc.setFontSize(8);
    let y = totalsY + 12;
    options.totais.forEach((t) => {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(t.label, margin + 8, y);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(darkRGB[0], darkRGB[1], darkRGB[2]);
      doc.text(t.valor, pageWidth - margin - 8, y, { align: "right" });
      y += 7;
    });
  }

  if (options.rodape) {
    doc.setFontSize(7);
    doc.setTextColor(grayRGB[0], grayRGB[1], grayRGB[2]);
    doc.setFont("helvetica", "italic");
    doc.text(options.rodape, pageWidth / 2, pageHeight - 8, { align: "center" });
  }

  const filename = options.titulo
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase()
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  doc.save(`${filename}.pdf`);
};

/**
 * PDF de repasses operacionais a prestador (uso interno / prestador).
 * Mantém valores de repasse pois o destinatário é o prestador.
 */
export const gerarPDFRepassePrestador = async (
  data: any[],
  filtros: any,
  resumo: { totalRepasses: number; qtdOperacoes: number; mediaOperacional: number; pendencias: number; valorAprovado: number },
  usuario?: string
) => {
  const logo = await getLogoWithFallback(true);

  const doc = new jsPDF("landscape", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  const drawHeader = () => {
    doc.setFillColor(darkRGB[0], darkRGB[1], darkRGB[2]);
    doc.rect(0, 0, pageWidth, 38, "F");

    drawLogoSafe(doc, logo, {
      x: margin,
      y: 5,
      maxWidth: 50,
      maxHeight: 28,
      align: "left",
      valign: "middle",
      onFallback: () => renderLogoTextFallback(doc, margin, 18, "CONEXÃO EXPRESS", true),
    });

    doc.setFontSize(7);
    doc.setTextColor(200, 200, 200);
    doc.setFont("helvetica", "normal");
    doc.text(
      `${empresaConfig.cnpj}  •  ${empresaConfig.telefone}  •  ${empresaConfig.email}`,
      margin,
      35
    );

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("RELATÓRIO DE REPASSES OPERACIONAIS", pageWidth - margin, 15, { align: "right" });
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text("Prestação de Serviços Autônomos de Transporte", pageWidth - margin, 21, { align: "right" });
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pageWidth - margin, 28, { align: "right" });
    if (usuario) doc.text(`Responsável: ${usuario}`, pageWidth - margin, 32, { align: "right" });

    doc.setDrawColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, 38, pageWidth - margin, 38);
  };

  drawHeader();

  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100);
  doc.text(
    "Relatório operacional de prestação de serviços e repasses financeiros referentes às operações executadas de forma autônoma.",
    margin,
    43
  );

  const fmtBRL = (v: number) =>
    (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtData = (d: string) =>
    d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "-";

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);

  let yPos = 48;
  if (filtros.prestador) {
    doc.setFont("helvetica", "bold");
    doc.text(`Prestador: `, margin, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(filtros.prestador, margin + 16, yPos);
    yPos += 4;
  }
  if (filtros.cliente) {
    doc.setFont("helvetica", "bold");
    doc.text(`Cliente: `, margin, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(filtros.cliente, margin + 16, yPos);
    yPos += 4;
  }
  doc.setFont("helvetica", "bold");
  doc.text(`Período: `, margin, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(`${fmtData(filtros.dataInicial)} a ${fmtData(filtros.dataFinal)}`, margin + 14, yPos);

  const linhas = data.map((item) => [
    fmtData(item.data_finalizacao || item.created_at),
    item.cliente_nome || "-",
    item.numero || item.os_numero || "-",
    item.veiculo_tipo || "-",
    item.enderecos?.[0]?.cidade || "-",
    item.enderecos?.[item.enderecos.length - 1]?.cidade || "-",
    fmtBRL(Number(item.custo_prestador) || 0),
    fmtBRL(Number(item.adicionais) || 0),
    fmtBRL(Number(item.descontos) || 0),
    fmtBRL(Number(item.valor_final_repasse) || 0),
    item.status_pagamento === "pago" ? "Pago" : "Pendente",
  ]);

  const tableStartY = yPos + 6;

  autoTable(doc, {
    startY: tableStartY,
    head: [["Data", "Cliente", "OS", "Veículo", "Origem", "Destino", "Operação", "Adicional", "Desconto", "Repasse Final", "Status"]],
    body: linhas,
    theme: "striped",
    headStyles: {
      fillColor: [darkRGB[0], darkRGB[1], darkRGB[2]],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "center",
      valign: "middle",
    },
    bodyStyles: { fontSize: 6.5, textColor: [51, 65, 85], valign: "middle" },
    alternateRowStyles: { fillColor: [lightBgRGB[0], lightBgRGB[1], lightBgRGB[2]] },
    margin: { top: tableStartY, right: margin, bottom: 45, left: margin },
    didDrawPage: (data: any) => {
      const pageNum = doc.internal.getNumberOfPages();
      doc.setFontSize(6.5);
      doc.setTextColor(grayRGB[0], grayRGB[1], grayRGB[2]);

      doc.setDrawColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);

      doc.text(`Página ${pageNum}`, pageWidth / 2, pageHeight - 18, { align: "center" });
      doc.text(`Emitido por Conexão Express - ${new Date().toLocaleString("pt-BR")}`, margin, pageHeight - 18);
      doc.text(empresaConfig.nome, pageWidth - margin, pageHeight - 18, { align: "right" });

      if (data.pageNumber > 1) drawHeader();
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || tableStartY;

  let resumoY = finalY + 6;
  if (resumoY > pageHeight - 55) {
    doc.addPage();
    resumoY = 46;
    drawHeader();
  }

  doc.setFillColor(255, 247, 237);
  doc.setDrawColor(254, 215, 170);
  doc.roundedRect(margin, resumoY, pageWidth - margin * 2, 28, 2, 2, "FD");

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(darkRGB[0], darkRGB[1], darkRGB[2]);
  doc.text("RESUMO OPERACIONAL DE REPASSES", margin + 4, resumoY + 6);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Total de Repasses: ${fmtBRL(resumo.totalRepasses)}`, margin + 6, resumoY + 13);
  doc.text(`Quantidade de Operações: ${resumo.qtdOperacoes}`, margin + 6, resumoY + 20);
  doc.text(`Média por Operação: ${fmtBRL(resumo.mediaOperacional)}`, pageWidth / 3 + 4, resumoY + 13);
  doc.text(`Valor Aprovado: ${fmtBRL(resumo.valorAprovado)}`, pageWidth / 3 + 4, resumoY + 20);
  doc.text(`Total Pendente: ${fmtBRL(resumo.pendencias)}`, (pageWidth / 3) * 2 + 4, resumoY + 13);

  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Este demonstrativo refere-se exclusivamente à prestação de serviços autônomos de transporte contratados sob demanda, não configurando vínculo de qualquer outra natureza.",
    pageWidth / 2,
    pageHeight - 10,
    { align: "center" }
  );

  doc.save("relatorio_repasses_prestadores.pdf");
};

/**
 * PDF de Fechamento de Faturamento Detalhado (enviado ao cliente).
 * NÃO inclui margem, custo interno, repasse ou resultado interno.
 */
export const gerarPDFFaturamentoDetalhado = async (
  cliente: { nome: string; cnpj: string },
  periodo: string,
  operacoes: any[],
  usuario: string = "Administrador"
) => {
  const logo = await getLogoWithFallback(true);
  const doc = new jsPDF("landscape", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const usableWidth = pageWidth - margin * 2;

  const fmtBRL = (v: number) =>
    (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtData = (d: string) =>
    d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "-";

  // Cálculos cliente-facing (sem custo/margem/repasse)
  const subtotalFrete = operacoes.reduce((s, o) => s + (Number(o.valor_cliente) || 0), 0);
  const totalPedagio = operacoes.reduce((s, o) => s + (Number(o.pedagio) || 0), 0);
  const totalAjudante = operacoes.reduce((s, o) => s + (Number(o.ajudante) || 0), 0);
  const totalAdicionaisOutros = operacoes.reduce((s, o) => s + (Number(o.adicionais) || 0), 0);
  const totalAdicionais = totalPedagio + totalAjudante + totalAdicionaisOutros;
  const totalDescontos = operacoes.reduce((s, o) => s + (Number(o.descontos) || 0), 0);
  const totalLiquido = subtotalFrete + totalAdicionais - totalDescontos;

  const drawHeader = () => {
    doc.setFillColor(darkRGB[0], darkRGB[1], darkRGB[2]);
    doc.rect(0, 0, pageWidth, 38, "F");

    drawLogoSafe(doc, logo, {
      x: margin,
      y: 5,
      maxWidth: 50,
      maxHeight: 28,
      align: "left",
      valign: "middle",
      onFallback: () => renderLogoTextFallback(doc, margin, 18, "CONEXÃO EXPRESS", true),
    });

    doc.setFontSize(7);
    doc.setTextColor(200, 200, 200);
    doc.setFont("helvetica", "normal");
    doc.text(
      `${empresaConfig.cnpj}  •  ${empresaConfig.telefone}  •  ${empresaConfig.email}`,
      margin,
      35
    );

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("FECHAMENTO DE FATURAMENTO DETALHADO", pageWidth - margin, 15, { align: "right" });

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Demais taxas e adicionais discriminados por operação", pageWidth - margin, 21, { align: "right" });

    const dataHora = new Date().toLocaleString("pt-BR");
    doc.setFontSize(7);
    doc.text(`Gerado em: ${dataHora} | Emissor: ${usuario}`, pageWidth - margin, 29, { align: "right" });
    doc.text(`Período do Fechamento: ${periodo}`, pageWidth - margin, 34, { align: "right" });

    doc.setDrawColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, 38, pageWidth - margin, 38);
  };

  drawHeader();

  // Bloco cliente
  let yPos = 44;
  doc.setFillColor(lightBgRGB[0], lightBgRGB[1], lightBgRGB[2]);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, yPos, usableWidth, 18, 2, 2, "FD");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(darkRGB[0], darkRGB[1], darkRGB[2]);
  doc.text("DADOS DO CLIENTE CONTRATANTE", margin + 4, yPos + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Razão Social: ${cliente.nome}`, margin + 4, yPos + 11);
  doc.text(`CNPJ: ${cliente.cnpj}`, margin + 4, yPos + 15);
  doc.text(`Qtd. de Operações Fechadas: ${operacoes.length}`, margin + 120, yPos + 11);
  doc.text(`Status Faturamento: Aprovado p/ Faturamento`, margin + 120, yPos + 15);

  // Cards (sem margem / custo / repasse)
  yPos += 22;
  const cardWidth = usableWidth / 4 - 3;
  const cardNames = [
    { label: "SUBTOTAL (FRETE BASE)", valor: fmtBRL(subtotalFrete), cor: [15, 26, 46], bg: [241, 245, 249] },
    { label: "(+) TOTAL ADICIONAIS", valor: fmtBRL(totalAdicionais), cor: [16, 185, 129], bg: [240, 253, 250] },
    { label: "(-) TOTAL DESCONTOS", valor: fmtBRL(totalDescontos), cor: [239, 68, 68], bg: [254, 242, 242] },
    { label: "TOTAL LÍQUIDO", valor: fmtBRL(totalLiquido), cor: [249, 115, 22], bg: [255, 247, 237] },
  ];

  cardNames.forEach((c, idx) => {
    const cx = margin + idx * (cardWidth + 4);
    doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cx, yPos, cardWidth, 18, 1.5, 1.5, "FD");

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(c.label, cx + 4, yPos + 5);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(c.cor[0], c.cor[1], c.cor[2]);
    doc.text(c.valor, cx + 4, yPos + 13);
  });

  yPos += 24;

  const linhas = operacoes.map((item) => {
    const dataOS = item.data_finalizacao || item.created_at || item.data;
    const vBase = Number(item.valor_cliente) || 0;
    const vPedagio = Number(item.pedagio) || 0;
    const vAjudante = Number(item.ajudante) || 0;
    const vOutros = Number(item.adicionais) || 0;
    const vAdic = vPedagio + vAjudante + vOutros;
    const vDesc = Number(item.descontos) || 0;
    const vLiquido = vBase + vAdic - vDesc;

    let origem = "-";
    let destino = "-";
    if (item.enderecos && Array.isArray(item.enderecos) && item.enderecos.length > 0) {
      origem = item.enderecos[0]?.cidade || item.enderecos[0]?.estado || "-";
      destino = item.enderecos[item.enderecos.length - 1]?.cidade || item.enderecos[item.enderecos.length - 1]?.estado || "-";
    } else {
      origem = item.origem_endereco || "-";
      destino = item.destino_endereco || "-";
    }

    return [
      fmtData(dataOS),
      item.numero || item.os_numero || "-",
      item.veiculo_tipo || "-",
      `${origem} -> ${destino}`,
      fmtBRL(vBase),
      fmtBRL(vPedagio),
      fmtBRL(vAjudante),
      fmtBRL(vOutros),
      fmtBRL(vDesc),
      fmtBRL(vLiquido),
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [["Data", "OS", "Veículo", "Rota", "Frete Base", "Pedágio", "Ajudante", "Outros Adic.", "Descontos", "Valor Líquido"]],
    body: linhas,
    theme: "striped",
    headStyles: {
      fillColor: [darkRGB[0], darkRGB[1], darkRGB[2]],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 7,
      halign: "center",
      valign: "middle",
    },
    bodyStyles: { fontSize: 6.5, textColor: [51, 65, 85], valign: "middle" },
    columnStyles: {
      0: { halign: "center", cellWidth: 16 },
      1: { halign: "center", cellWidth: 16 },
      2: { halign: "center", cellWidth: 18 },
      3: { halign: "left", cellWidth: 55 },
      4: { halign: "right", cellWidth: 22 },
      5: { halign: "right", cellWidth: 20 },
      6: { halign: "right", cellWidth: 20 },
      7: { halign: "right", cellWidth: 20 },
      8: { halign: "right", cellWidth: 20 },
      9: { halign: "right", cellWidth: 22 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { top: yPos, right: margin, bottom: 40, left: margin },
    didDrawPage: (data: any) => {
      const pageNum = doc.internal.getNumberOfPages();
      doc.setFontSize(6.5);
      doc.setTextColor(grayRGB[0], grayRGB[1], grayRGB[2]);

      doc.setDrawColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);

      doc.text(`Página ${pageNum}`, pageWidth / 2, pageHeight - 14, { align: "center" });
      doc.text(`Emitido por Conexão Express - ${new Date().toLocaleString("pt-BR")}`, margin, pageHeight - 14);
      doc.text(empresaConfig.nome, pageWidth - margin, pageHeight - 14, { align: "right" });

      if (data.pageNumber > 1) drawHeader();
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || yPos;

  let signY = finalY + 8;
  if (signY > pageHeight - 45) {
    doc.addPage();
    drawHeader();
    signY = 46;
  }

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, signY, usableWidth, 12, 1, 1, "FD");
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Observações Comerciais: Os valores acima discriminados representam o resumo operacional e financeiro consolidado do período. O faturamento será processado conforme regras contratuais. Favor retornar este demonstrativo assinado em até 48 horas em caso de divergências operacionais.",
    margin + 4,
    signY + 5,
    { maxWidth: usableWidth - 8 }
  );

  signY += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);

  doc.line(margin + 20, signY, margin + 100, signY);
  doc.text("CONEXÃO EXPRESS TRANSPORTES LTDA", margin + 60, signY + 4, { align: "center" });
  doc.text("Responsável Financeiro", margin + 60, signY + 8, { align: "center" });

  doc.line(pageWidth - margin - 100, signY, pageWidth - margin - 20, signY);
  doc.text(cliente.nome.toUpperCase(), pageWidth - margin - 60, signY + 4, { align: "center" });
  doc.text("Aceite Comercial / Assinatura do Cliente", pageWidth - margin - 60, signY + 8, { align: "center" });

  const filename = `fechamento_detalhado_${cliente.nome.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`;
  doc.save(`${filename}.pdf`);
};
