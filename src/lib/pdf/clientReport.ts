// ============================================================
// RELATÓRIO CLIENTE — Ordem de Serviço / Ordem de Carregamento
//
// Documento executivo corporativo para o cliente contratante.
// Página 1: Capa institucional
// Páginas 2+: Conteúdo editorial corporativo
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
  getPageSetup,
  type PdfLogo,
  type InfoField,
  type FinancialLine,
  fmtBRL,
  fmtDate,
} from "./foundation";
import { resolverNomenclaturaPorTipo } from "@/config/nomenclatura";
import { obterStatusGlobalOS } from "@/components/operacao/osTypes";
import { STATUS_GLOBAL_INFO } from "@/components/operacao/statusGlobal";

const CNPJ_EMPRESA = "42.796.040/0001-31";

/**
 * Gera o PDF profissional da OS para o CLIENTE.
 */
export async function generateClientReport(data: any): Promise<void> {
  const doc = new jsPDF("p", "mm", "a4");
  const page = getPageSetup(doc, 15);

  // Nomenclatura variável (OS vs OC)
  const nomenclatura = resolverNomenclaturaPorTipo(data?.tipoOperacao);
  const statusGlobal = obterStatusGlobalOS(data.status || "rascunho");
  const statusLabel =
    STATUS_GLOBAL_INFO[statusGlobal]?.label || data.status || "Pendente";

  // ===================== PÁGINA 1: CAPA =====================
  const logo = await drawCoverPage(doc, {
    documentType: nomenclatura.labelOS.toUpperCase(),
    documentNumber: `${nomenclatura.siglaSO}-${data.numero || "0000"}`,
    entityName: data.cliente || "—",
    entitySubtitle: data.unidade || undefined,
    status: statusLabel,
    date: fmtDate(data.data),
    via: "Cliente",
  });

  // ===================== PÁGINA 2+: CONTEÚDO =====================
  doc.addPage();

  let y = 20;

  const drawContentPageHeader = (d: jsPDF, pg: typeof page, l: PdfLogo | null) => {
    drawContentHeader(d, pg.pageWidth, pg.margin, l, {
      title: `${nomenclatura.labelOS} — ${nomenclatura.siglaSO}-${data.numero || "0000"}`,
      subtitle: `Via: Cliente — ${data.cliente || ""}`,
    });
  };

  drawContentPageHeader(doc, page, logo);

  // --- DADOS DO CLIENTE ---
  y = drawSectionTitle(doc, page.margin, y, "DADOS DO CLIENTE", page);

  const clientFields: InfoField[] = [
    { label: "Razão Social", value: data.cliente || "—" },
    { label: "Unidade", value: data.unidade || "—" },
    { label: "Tipo de Operação", value: data.tipoOperacao || "—" },
    { label: "Responsável", value: data.responsavel || "—" },
  ];

  y = drawInfoBlock(doc, page.margin, y, page.contentWidth, "IDENTIFICAÇÃO DO CONTRATANTE", clientFields);

  // --- VEÍCULO (se informado) ---
  if (data.veiculoTipo || data.veiculoPlaca) {
    y = drawSectionTitle(doc, page.margin, y, "DADOS DO VEÍCULO", page);
    const veicParts = [
      data.veiculoTipo ? `Tipo: ${data.veiculoTipo}` : null,
      data.veiculoPlaca ? `Placa: ${data.veiculoPlaca}` : null,
      data.veiculoCarroceria ? `Carroceria: ${data.veiculoCarroceria}` : null,
    ].filter(Boolean);
    if (veicParts.length > 0) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(veicParts.join("  |  "), page.margin, y + 5);
      y += 12;
    }
  }

  // --- ITINERÁRIO ---
  if (data.enderecos?.length > 0) {
    if (y > 230) {
      doc.addPage();
      y = 20;
      drawContentPageHeader(doc, page, logo);
    }

    y = drawSectionTitle(doc, page.margin, y, "ITINERÁRIO / ROTA", page);
    y += 2;

    const routeRows = data.enderecos.map((e: any, i: number) => [
      String(i + 1),
      e.tipo === "coleta" ? "Coleta" : e.tipo === "entrega" ? "Entrega" : "Parada",
      `${e.nomeLocal ? e.nomeLocal + "\n" : ""}${e.endereco || ""}\n${e.cidade || ""}/${e.estado || ""}`,
      e.responsavel || "—",
      e.janelaInicio && e.janelaFim ? `${e.janelaInicio} - ${e.janelaFim}` : "—",
    ]);

    y = drawCorporateTable(doc, page, logo, {
      startY: y,
      columns: ["#", "Tipo", "Local / Endereço", "Contato", "Janela"],
      rows: routeRows,
      columnWidths: { 0: 10, 1: 22, 2: 70, 4: 30 },
      columnAligns: { 0: "center", 1: "center", 4: "center" },
      onPageDraw: drawContentPageHeader,
    });
    y += 6;
  }

  // --- CARGA ---
  if (y > 235) {
    doc.addPage();
    y = 20;
    drawContentPageHeader(doc, page, logo);
  }

  y = drawSectionTitle(doc, page.margin, y, "DETALHAMENTO DA CARGA", page);
  y += 2;

  const cargoRows = [[
    data.carga?.descricao || "—",
    String(data.carga?.volumes || 0),
    String(data.carga?.peso || 0),
    String(data.carga?.cubagem || 0),
    fmtBRL(data.carga?.valorDeclarado || 0),
  ]];

  y = drawCorporateTable(doc, page, logo, {
    startY: y,
    columns: ["Descrição", "Volumes", "Peso (kg)", "Cubagem (m³)", "Valor Declarado"],
    rows: cargoRows,
    columnWidths: { 0: 60, 1: 25, 2: 25, 3: 25, 4: 35 },
    columnAligns: { 1: "center", 2: "center", 3: "center", 4: "right" },
    onPageDraw: drawContentPageHeader,
  });
  y += 6;

  // --- COMPOSIÇÃO FINANCEIRA ---
  if (y > 215) {
    doc.addPage();
    y = 20;
    drawContentPageHeader(doc, page, logo);
  }

  const valorCliente = Number(data.valorCliente) || 0;
  const valorPedagio = Number(data.pedagio) || 0;
  const valorAdicionais = Number(data.adicionais) || 0;
  const valorDescontos = Number(data.descontos) || 0;
  const valorTotal = valorCliente + valorPedagio + valorAdicionais - valorDescontos;

  const financialLines: FinancialLine[] = [
    { label: "Valor da Operação", value: valorCliente },
  ];

  if (valorPedagio > 0) {
    financialLines.push({ label: "Pedágio", value: valorPedagio, indent: true });
  }
  if (valorAdicionais > 0) {
    financialLines.push({ label: "Adicionais", value: valorAdicionais, indent: true });
  }
  if (valorDescontos > 0) {
    financialLines.push({ label: "Descontos", value: valorDescontos, indent: true });
  }
  financialLines.push({ label: "TOTAL", value: valorTotal, isTotal: true, highlight: true });

  y = drawFinancialComposition(
    doc,
    page.margin,
    y,
    page.contentWidth,
    "COMPOSIÇÃO FINANCEIRA",
    financialLines
  );

  // --- INSTRUÇÕES OPERACIONAIS ---
  if (data.instrucoesOperacionaisOS) {
    if (y > 220) {
      doc.addPage();
      y = 20;
      drawContentPageHeader(doc, page, logo);
    }

    y = drawSectionTitle(doc, page.margin, y, "INSTRUÇÕES OPERACIONAIS", page);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    const lines = doc.splitTextToSize(data.instrucoesOperacionaisOS, page.contentWidth - 4);
    doc.text(lines, page.margin, y + 5);
    y += lines.length * 4.5 + 10;
  }

  // --- OBSERVAÇÕES ---
  if (y > 235) {
    doc.addPage();
    y = 20;
    drawContentPageHeader(doc, page, logo);
  }

  y = drawObservations(
    doc,
    page.margin,
    y,
    page.contentWidth,
    "Este documento é uma ordem de serviço oficial emitida pela Conexão Express. " +
    "Em caso de divergências, comunicar o setor financeiro em até 24 horas úteis. " +
    "O faturamento será processado conforme as condições comerciais acordadas."
  );

  // --- ASSINATURA ---
  if (y > 255) {
    doc.addPage();
    y = 20;
    drawContentPageHeader(doc, page, logo);
  }

  y = Math.max(y + 6, 235);
  drawSignatureBlock(doc, page.margin, y, page.contentWidth, {
    leftLabel: "Conexão Express Transportes LTDA",
    leftSub: `CNPJ: ${CNPJ_EMPRESA}`,
    rightLabel: data.cliente || "Cliente",
    rightSub: "Recebimento / Ciência",
  });

  // Rodapé na última página
  drawContentFooter(doc, page.pageWidth, page.pageHeight, page.margin);

  const filename = `OS_${nomenclatura.siglaSO}_${data.numero || "0000"}_CLIENTE.pdf`;
  doc.save(filename);
}
