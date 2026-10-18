// ============================================================
// RELATÓRIO PRESTADOR — Ordem de Serviço / Ordem de Carregamento
//
// Documento executivo corporativo para o prestador de serviço.
// Inclui fechamento financeiro, repasse, KM, adicionais, descontos.
// Página 1: Capa institucional
// Páginas 2+: Conteúdo editorial corporativo específico do prestador
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
  fmtNumber,
} from "./foundation";
import { resolverNomenclaturaPorTipo } from "@/config/nomenclatura";
import { obterStatusGlobalOS } from "@/components/operacao/osTypes";
import { STATUS_GLOBAL_INFO } from "@/components/operacao/statusGlobal";

const CNPJ_EMPRESA = "31.227.975/0001-80";

/**
 * Gera o PDF profissional da OS para o PRESTADOR.
 */
export async function generatePrestadorReport(data: any): Promise<void> {
  const doc = new jsPDF("p", "mm", "a4");
  const page = getPageSetup(doc, 15);

  const nomenclatura = resolverNomenclaturaPorTipo(data?.tipoOperacao);
  const statusGlobal = obterStatusGlobalOS(data.status || "rascunho");
  const statusLabel =
    STATUS_GLOBAL_INFO[statusGlobal]?.label || data.status || "Pendente";

  // ===================== PÁGINA 1: CAPA =====================
  const logo = await drawCoverPage(doc, {
    documentType: nomenclatura.labelOS.toUpperCase(),
    documentNumber: `${nomenclatura.siglaSO}-${data.numero || "0000"}`,
    entityName: data.prestador || "—",
    entitySubtitle: "Prestador de Serviço de Transporte",
    status: statusLabel,
    date: fmtDate(data.data),
    via: "Prestador",
  });

  // ===================== PÁGINA 2+: CONTEÚDO =====================
  doc.addPage();

  let y = 20;

  const drawContentPageHeader = (d: jsPDF, pg: typeof page, l: PdfLogo | null) => {
    drawContentHeader(d, pg.pageWidth, pg.margin, l, {
      title: `${nomenclatura.labelOS} — ${nomenclatura.siglaSO}-${data.numero || "0000"}`,
      subtitle: `Via: Prestador — ${data.prestador || ""}`,
    });
  };

  drawContentPageHeader(doc, page, logo);

  // --- DADOS DO PRESTADOR ---
  y = drawSectionTitle(doc, page.margin, y, "DADOS DO PRESTADOR", page);

  const prestFields: InfoField[] = [
    { label: "Nome / Razão Social", value: data.prestador || "—" },
    { label: "Tipo de Operação", value: data.tipoOperacao || "—" },
  ];

  if (data.cliente) {
    prestFields.push({ label: "Cliente Contratante", value: data.cliente, col: "right" });
  }

  y = drawInfoBlock(doc, page.margin, y, page.contentWidth, "IDENTIFICAÇÃO DO PRESTADOR", prestFields);

  // --- VEÍCULO ALOCADO ---
  if (data.veiculoTipo || data.veiculoPlaca) {
    y = drawSectionTitle(doc, page.margin, y, "VEÍCULO ALOCADO", page);

    const veicFields: InfoField[] = [];
    if (data.veiculoTipo) veicFields.push({ label: "Tipo", value: data.veiculoTipo });
    if (data.veiculoPlaca) veicFields.push({ label: "Placa", value: data.veiculoPlaca });
    if (data.veiculoCarroceria) veicFields.push({ label: "Carroceria", value: data.veiculoCarroceria });
    if (data.veiculoTermica) veicFields.push({ label: "Térmica", value: data.veiculoTermica });

    if (veicFields.length > 0) {
      y = drawInfoBlock(doc, page.margin, y, page.contentWidth, "CARACTERÍSTICAS DO VEÍCULO", veicFields);
    }
  }

  // --- KM / DISTÂNCIA ---
  const distanciaKm =
    Number(data.distanciaRota?.distanciaKm) ||
    Number(data.distanciaKm) ||
    Number(data.km_total) ||
    0;

  if (distanciaKm > 0) {
    y = drawSectionTitle(doc, page.margin, y, "DADOS DA ROTA", page);

    const routeFields: InfoField[] = [
      { label: "Distância Total", value: `${fmtNumber(distanciaKm, 1)} km` },
    ];
    if (data.distanciaRota?.duracaoTexto) {
      routeFields.push({ label: "Tempo Estimado", value: data.distanciaRota.duracaoTexto });
    }
    if (data.km_excedente) {
      routeFields.push({ label: "KM Excedente", value: `${fmtNumber(data.km_excedente, 1)} km` });
    }
    if (data.valor_km) {
      routeFields.push({
        label: "Valor por KM",
        value: fmtBRL(data.valor_km),
        col: "right",
      });
    }

    y = drawInfoBlock(doc, page.margin, y, page.contentWidth, "INFORMAÇÕES DE PERCURSO", routeFields);
  }

  // --- ITINERÁRIO COMPLETO ---
  if (data.enderecos?.length > 0) {
    if (y > 225) {
      doc.addPage();
      y = 20;
      drawContentPageHeader(doc, page, logo);
    }

    y = drawSectionTitle(doc, page.margin, y, "ITINERÁRIO COMPLETO", page);
    y += 2;

    const routeRows = data.enderecos.map((e: any, i: number) => [
      String(i + 1),
      e.tipo === "coleta" ? "Coleta" : e.tipo === "entrega" ? "Entrega" : "Parada",
      `${e.nomeLocal ? e.nomeLocal + "\n" : ""}${e.endereco || ""}\n${e.cidade || ""}/${e.estado || ""}`,
      `${e.responsavel || "—"}\n${e.telefone || ""}`,
      e.janelaInicio && e.janelaFim ? `${e.janelaInicio} - ${e.janelaFim}` : "—",
    ]);

    y = drawCorporateTable(doc, page, logo, {
      startY: y,
      columns: ["#", "Tipo", "Local / Endereço Completo", "Contato / Telefone", "Janela"],
      rows: routeRows,
      columnWidths: { 0: 10, 1: 22, 2: 75, 4: 30 },
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
    columnWidths: { 0: 65, 1: 25, 2: 25, 3: 25, 4: 35 },
    columnAligns: { 1: "center", 2: "center", 3: "center", 4: "right" },
    onPageDraw: drawContentPageHeader,
  });
  y += 6;

  // ===================== FECHAMENTO FINANCEIRO =====================
  // Esta é a seção crucial para o prestador.
  // Layout próprio com composição completa.

  if (y > 165) {
    doc.addPage();
    y = 20;
    drawContentPageHeader(doc, page, logo);
  }

  y = drawSectionTitle(doc, page.margin, y, "FECHAMENTO FINANCEIRO DO PRESTADOR", page);

  const valorOperacao = Number(data.custoPrestador) || 0;
  const valorPedagio = Number(data.pedagio) || 0;
  const valorAdicionais = Number(data.adicionais) || 0;
  const valorDescontos = Number(data.descontos) || 0;
  const valorKMExcedente = (Number(data.km_excedente) || 0) * (Number(data.valor_km) || 0);
  const totalLiquido =
    valorOperacao + valorPedagio + valorAdicionais + valorKMExcedente - valorDescontos;

  const compositionLines: FinancialLine[] = [];

  // Valor base da operação
  compositionLines.push({
    label: "Valor Base (Repasse)",
    value: valorOperacao,
  });

  // KM
  if (distanciaKm > 0) {
    compositionLines.push({
      label: `Percurso Total: ${fmtNumber(distanciaKm, 1)} km`,
      value: 0,
      indent: true,
    });
  }
  if (valorKMExcedente > 0) {
    compositionLines.push({
      label: "KM Excedente",
      value: valorKMExcedente,
      indent: true,
    });
  }

  // Pedagio
  if (valorPedagio > 0) {
    compositionLines.push({ label: "Pedagio", value: valorPedagio, indent: true });
  }

  // Adicionais operacionais
  if (valorAdicionais > 0) {
    compositionLines.push({ label: "Adicionais / Reembolsos", value: valorAdicionais, indent: true });
  }

  // Descontos
  if (valorDescontos > 0) {
    compositionLines.push({ label: "Descontos / Glosas", value: valorDescontos, indent: true });
  }

  // Total Liquido
  compositionLines.push({
    label: "TOTAL LIQUIDO A RECEBER",
    value: totalLiquido,
    isTotal: true,
    highlight: true,
  });

  const breakY = drawFinancialComposition(
    doc,
    page.margin,
    y + 2,
    page.contentWidth,
    "COMPOSIÇÃO DO REPASSE",
    compositionLines
  );

  y = breakY;

  // --- INSTRUÇÕES AO PRESTADOR ---
  if (data.instrucoesOperacionaisOS) {
    if (y > 220) {
      doc.addPage();
      y = 20;
      drawContentPageHeader(doc, page, logo);
    }

    y = drawSectionTitle(doc, page.margin, y, "INSTRUÇÕES AO PRESTADOR", page);

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
    "Este documento formaliza os valores acordados para a prestação de serviço de transporte. " +
    "O pagamento será efetuado conforme o prazo contratual estabelecido, mediante conferência " +
    "da execução da operação e documentação fiscal correspondente. Em caso de divergências, " +
    "comunicar o setor financeiro em até 48 horas após a finalização da operação."
  );

  // --- ASSINATURA / CONFERÊNCIA ---
  if (y > 250) {
    doc.addPage();
    y = 20;
    drawContentPageHeader(doc, page, logo);
  }

  y = Math.max(y + 6, 230);
  drawSignatureBlock(doc, page.margin, y, page.contentWidth, {
    leftLabel: "Conexão Express Transportes LTDA",
    leftSub: `CNPJ: ${CNPJ_EMPRESA} — Financeiro`,
    rightLabel: data.prestador || "Prestador",
    rightSub: "Ciência e Aceite do Fechamento",
  });

  // Rodapé na última página
  drawContentFooter(doc, page.pageWidth, page.pageHeight, page.margin);

  const filename = `OS_${nomenclatura.siglaSO}_${data.numero || "0000"}_PRESTADOR.pdf`;
  doc.save(filename);
}
