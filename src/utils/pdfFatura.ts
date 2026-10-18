// ═══════════════════════════════════════════════════════════════════════════════
// MISSÃO A30 — MODELOS DE FATURA
// TMS-S04 — FATURA + RELATÓRIO DE FATURAMENTO PREMIUM DO CLIENTE
// pdfFatura.ts — Geradores de PDF de Fatura (documento externo ao cliente).
//
// Dois modelos:
//   1. "conexao_express" — PADRÃO CORPORATIVO PREMIUM (navy, logo oficial
//                          letras brancas + X colorido, cliente, resumo,
//                          tabela detalhada, documentos fiscais, condições de
//                          pagamento, observação, TOTAL em faixa e rodapé).
//   2. "calvo"           — Padrão Calvo (homologado em A31-D; mantido).
//
// NENHUM modelo exibe valor do prestador, margem, custos internos, semáforo ou
// status operacional — documento externo apropriado ao cliente.
// Paginação automática (autoTable) — suporta 1, 10 ou 30 itens, múltiplas
// páginas com cabeçalho repetido, sem corte de linha e TOTAL somente no final.
// ═══════════════════════════════════════════════════════════════════════════════

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getLogoWithFallback, drawLogoSafe } from "@/lib/pdfLogoSupport";
import { loadLogo } from "@/lib/pdf/foundation";
import type { DadosEmpresaFatura, DadosClienteFatura } from "@/services/financeiro/faturaService";
import type { ModeloFatura } from "@/services/financeiro/faturaTypes";

const navyRGB: [number, number, number] = [15, 26, 46];
const orangeRGB: [number, number, number] = [249, 115, 22];
const slate500: [number, number, number] = [100, 116, 139];
const slate700: [number, number, number] = [51, 65, 85];
const lightBg: [number, number, number] = [248, 250, 252];

export interface ItemPDFFatura {
  data: string;
  os: string;
  romaneio: string;
  descricao: string;
  valor: number;
  // TMS-S04 — enriquecimento do documento do cliente
  numeroOS?: string;
  servicoTrajeto?: string;
  valorBase?: number;
  valorAdicionais?: number;
  valorDescontos?: number;
  kmExcedente?: number;
  pedagioCliente?: number;
  ajudanteCliente?: number;
  diariaCliente?: number;
  saidasAdicionaisCliente?: number;
  nfse?: string;
  cte?: string;
}

export interface PdfFaturaInput {
  modelo: ModeloFatura;
  /** Nº Conexão (global) — aparece apenas como número da fatura (coluna FATURA/rodapé). */
  numero: string;
  /** Nº Cliente — interno do TMS; NÃO é renderizado no PDF do cliente (FATURA-CLIENTE-01). */
  numeroCliente?: number | null;
  descricao: string;
  cliente: string;
  clienteCnpj: string | null;
  clienteIe: string | null;
  data: string;
  vencimento: string;
  itens: ItemPDFFatura[];
  subtotal: number;
  acrescimos: number;
  descontos: number;
  total: number;
  observacao: string;
  empresa: DadosEmpresaFatura;
  dadosCliente: DadosClienteFatura | null;
  /** Parcela da fatura (ex.: "1"). Exibida como "1/1" no modelo CALVO. */
  parcela?: string;
  // TMS-S04 — enriquecimento do documento do cliente
  competenciaInicio?: string | null;
  competenciaFim?: string | null;
  statusComercial?: string;
  documentosFiscais?: { nfse?: string; cte?: string; chave?: string }[];
  logoBase64?: string;
}

const fmt = (v: number) =>
  (v || 0)
    .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    .replace(/\u00a0/g, " ");

function fmtData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

function fmtDataHora(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Limpa texto do documento do cliente: remove espaçamento artificial entre
 * letras ("G u a r u l h o s" → "Guarulhos") e troca "→" (não suportado pelas
 * fontes padrão do jsPDF) por "›" (render-safe na codificação WinAnsi).
 */
function limparTexto(valor?: string): string {
  if (!valor) return "";
  let texto = String(valor).replace(/\u2192/g, "›").replace(/\s+/g, " ").trim();
  const tokens = texto.split(" ");
  if (tokens.length > 1) {
    const partes: string[] = [];
    let grupo = "";
    const flush = () => {
      if (grupo) {
        partes.push(grupo);
        grupo = "";
      }
    };
    for (const t of tokens) {
      if (t.length === 1 && /[0-9A-Za-zÀ-ÖØ-öø-ÿ]/.test(t)) {
        grupo += t;
      } else {
        flush();
        partes.push(t);
      }
    }
    flush();
    texto = partes.join(" ");
  }
  return texto;
}

function numeroExib(input: PdfFaturaInput): string {
  return input.numero && input.numero !== "Rascunho" ? input.numero : "Rascunho";
}

/** Carrega o logo oficial para fundo navy (letras brancas + X colorido). */
async function carregarLogo(input: { logoBase64?: string }) {
  if (input.logoBase64) {
    return {
      base64: input.logoBase64,
      isText: false,
      naturalWidth: 1024,
      naturalHeight: 682,
    };
  }
  const oficial = await loadLogo();
  if (oficial && oficial.base64) {
    return {
      base64: oficial.base64,
      isText: false,
      naturalWidth: oficial.naturalWidth,
      naturalHeight: oficial.naturalHeight,
    };
  }
  return getLogoWithFallback(true);
}

function rodapePadrao(doc: jsPDF, input: PdfFaturaInput, labelRodape: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const footerY = pageHeight - 22;
  doc.setDrawColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
  doc.setLineWidth(0.6);
  doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(slate500[0], slate500[1], slate500[2]);
  doc.text(labelRodape, pageWidth / 2, footerY, { align: "center" });
  doc.text(`Documento gerado em ${fmtDataHora()}`, pageWidth / 2, footerY + 10, { align: "center" });
}

/**
 * MODELO 1 — PADRÃO CORPORATIVO PREMIUM (Conexão Express)
 * Cabeçalho navy com logo oficial (branco + X colorido), empresa à direita,
 * identificação (Fatura nº/Emissão/Vencimento/Período), bloco CLIENTE,
 * RESUMO DA FATURA, tabela detalhada (Data | OS Conexão | Romaneio/OC |
 * Serviço/Trajeto | Valor Base | Adicionais | Total), DOCUMENTOS FISCAIS
 * (quando houver), CONDIÇÕES DE PAGAMENTO, OBSERVAÇÕES, faixa TOTAL DA FATURA
 * e rodapé profissional. Multi-página com cabeçalho repetido.
 */
async function gerarPdfConexaoExpress(input: PdfFaturaInput): Promise<jsPDF> {
  const doc = new jsPDF("portrait", "pt", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const logo = await carregarLogo(input);

  // ══ CABEÇALHO INSTITUCIONAL (faixa navy + logo oficial + empresa) ══════════
  const bandH = 104;
  doc.setFillColor(navyRGB[0], navyRGB[1], navyRGB[2]);
  doc.rect(0, 0, pageWidth, bandH, "F");

  drawLogoSafe(doc, logo, {
    x: margin, y: (bandH - 44) / 2, maxWidth: 68, maxHeight: 44, align: "left", valign: "middle",
    onFallback: () => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text("CONEXÃO EXPRESS", margin, 52);
    },
  });

  // Empresa em BRANCO à direita
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text(input.empresa.razaoSocial || input.empresa.nomeFantasia || "Conexão Express Transportes LTDA", pageWidth - margin, 44, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(215, 224, 240);
  const linhaCnpj = [`CNPJ: ${input.empresa.cnpj || "—"}`];
  if (input.empresa.ie) linhaCnpj.push(`IE: ${input.empresa.ie}`);
  if (input.empresa.inscricaoMunicipal) linhaCnpj.push(`IM: ${input.empresa.inscricaoMunicipal}`);
  doc.text(linhaCnpj.join("   "), pageWidth - margin, 62, { align: "right" });
  const cidadeUf = input.empresa.cidade && input.empresa.uf ? `${input.empresa.cidade}/${input.empresa.uf}` : "";
  doc.text(cidadeUf, pageWidth - margin, 76, { align: "right" });
  if (input.empresa.telefone || input.empresa.emailFinanceiro || input.empresa.email) {
    const contatos = [input.empresa.telefone, input.empresa.emailFinanceiro || input.empresa.email].filter(Boolean).join("  ·  ");
    if (contatos) {
      doc.setFontSize(8);
      doc.setTextColor(190, 200, 215);
      doc.text(contatos, pageWidth - margin, 90, { align: "right" });
    }
  }

  doc.setDrawColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
  doc.setLineWidth(1.2);
  doc.line(0, bandH, pageWidth, bandH);
  doc.setLineWidth(0.1);

  // ══ IDENTIFICAÇÃO PRINCIPAL ════════════════════════════════════════════════
  let y = bandH + 34;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(navyRGB[0], navyRGB[1], navyRGB[2]);
  doc.text("FATURA DE SERVIÇOS DE TRANSPORTE", pageWidth / 2, y, { align: "center" });

  // Status comercial (traduzido — nunca draft/pending/issued)
  const status = (input.statusComercial || "").trim();
  const mostraStatus = status && status !== "Emitida";
  if (mostraStatus) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
    doc.text(status.toUpperCase(), pageWidth - margin, y, { align: "right" });
  }

  y += 20;
  // Caixa de identificação (Emissão / Vencimento / Período)
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(220, 226, 236);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y - 14, contentWidth, 54, 4, 4, "FD");
  doc.setLineWidth(0.1);

  const colMid = margin + contentWidth / 2;
  const identField = (x: number, label: string, value: string, bold = false, cor: [number, number, number] = navyRGB) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(slate500[0], slate500[1], slate500[2]);
    doc.text(label, x, y);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 13 : 9.5);
    doc.setTextColor(cor[0], cor[1], cor[2]);
    doc.text(value, x, y + 13);
  };

  // FATURA-CLIENTE-01 — "Nº Conexão" (número interno do sistema) NÃO é
  // renderizado no documento destinado ao cliente (mantido apenas no TMS).
  identField(colMid + 8, "Emissão", fmtData(input.data), false, slate700);

  // Linha 2: Vencimento + Período
  const y2 = y + 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(slate500[0], slate500[1], slate500[2]);
  doc.text("Vencimento", margin + 8, y2);
  doc.setFontSize(9.5);
  doc.setTextColor(slate700[0], slate700[1], slate700[2]);
  doc.text(fmtData(input.vencimento), margin + 8, y2 + 13);
  doc.setFontSize(7.5);
  doc.setTextColor(slate500[0], slate500[1], slate500[2]);
  doc.text("Período", colMid + 8, y2);
  doc.setFontSize(9.5);
  doc.setTextColor(slate700[0], slate700[1], slate700[2]);
  const periodo = [input.competenciaInicio, input.competenciaFim].some(Boolean)
    ? `${fmtData(input.competenciaInicio)} a ${fmtData(input.competenciaFim)}`
    : "—";
  doc.text(periodo, colMid + 8, y2 + 13);

  y = y2 + 26;

  // ══ DADOS DO CLIENTE ═══════════════════════════════════════════════════════
  y += 6;
  drawSectionTitle(doc, margin, y, "CLIENTE");
  y += 16;
  const clienteLinhas: { label: string; valor: string }[] = [];
  const dc = input.dadosCliente;
  const razao = limparTexto(dc?.razaoSocial || input.cliente || "");
  if (razao) clienteLinhas.push({ label: "Razão Social", valor: razao });
  if (dc?.nomeFantasia) clienteLinhas.push({ label: "Nome Fantasia", valor: limparTexto(dc.nomeFantasia) });
  if (dc?.cnpj || input.clienteCnpj) clienteLinhas.push({ label: "CNPJ/CPF", valor: String(dc?.cnpj || input.clienteCnpj) });
  if (dc?.ie || input.clienteIe) clienteLinhas.push({ label: "Inscrição Estadual", valor: String(dc?.ie || input.clienteIe) });
  const endCompleto = dc?.enderecoCompleto || (dc?.endereco ? `${dc.endereco}${dc.cidade ? ` — ${dc.cidade}/${dc.uf || ""}` : ""}` : "");
  if (endCompleto) clienteLinhas.push({ label: "Endereço", valor: limparTexto(endCompleto) });
  else if (dc?.cidade) clienteLinhas.push({ label: "Cidade/UF", valor: `${dc.cidade}${dc.uf ? `/${dc.uf}` : ""}` });
  // FATURA-CLIENTE-01 — "Nº Cliente" (sequencial interno) NÃO é renderizado
  // no documento destinado ao cliente (mantido apenas no TMS).

  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(margin, y - 6, contentWidth, Math.max(clienteLinhas.length * 15 + 12, 16), 3, 3, "F");
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  if (clienteLinhas.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(slate500[0], slate500[1], slate500[2]);
    doc.text("Cliente não informado", margin + 10, y + 6);
    y += 22;
  } else {
    clienteLinhas.forEach((l) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(slate500[0], slate500[1], slate500[2]);
      doc.text(`${l.label}:`, margin + 10, y + 4);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(slate700[0], slate700[1], slate700[2]);
      const labelW = doc.getTextWidth(`${l.label}: `);
      doc.text(l.valor, margin + 12 + labelW, y + 4, { maxWidth: contentWidth - 26 - labelW });
      y += 15;
    });
  }
  y += 10;

  // ══ RESUMO DA FATURA ═══════════════════════════════════════════════════════
  drawSectionTitle(doc, margin, y, "RESUMO DA FATURA");
  y += 16;
  const resumoLinhas: { label: string; valor: string; destaque?: boolean }[] = [
    { label: "Quantidade de serviços", valor: String(input.itens.length) },
    { label: "Subtotal dos serviços", valor: fmt(input.subtotal) },
  ];
  if (input.acrescimos > 0) resumoLinhas.push({ label: "Adicionais", valor: fmt(input.acrescimos) });
  if (input.descontos > 0) resumoLinhas.push({ label: "Descontos", valor: fmt(input.descontos) });
  resumoLinhas.push({ label: "TOTAL DA FATURA", valor: fmt(input.total), destaque: true });

  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(margin, y - 6, contentWidth, resumoLinhas.length * 16 + 10, 3, 3, "F");
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  resumoLinhas.forEach((l) => {
    doc.setFont("helvetica", l.destaque ? "bold" : "normal");
    doc.setFontSize(l.destaque ? 11 : 9);
    doc.setTextColor(l.destaque ? orangeRGB[0] : slate700[0], l.destaque ? orangeRGB[1] : slate700[1], l.destaque ? orangeRGB[2] : slate700[2]);
    doc.text(l.label, margin + 10, y + 6);
    doc.text(l.valor, pageWidth - margin - 10, y + 6, { align: "right" });
    y += 16;
  });
  y += 10;

  // ══ TABELA DE SERVIÇOS (paginação automática + cabeçalho repetido) ═════════
  autoTable(doc, {
    startY: y,
    head: [["Data", "OS Conexão", "Romaneio / OC", "Serviço / Trajeto", "Valor Base", "Adicionais", "Total"]],
    body: input.itens.map((i) => {
      const adicionais = Number(i.valorAdicionais) || 0;
      return [
        fmtData(i.data),
        limparTexto(i.numeroOS || i.os) || "—",
        limparTexto(i.romaneio) || "—",
        limparTexto(i.servicoTrajeto || i.descricao) || "Serviço de transporte",
        fmt(Number(i.valorBase) || 0),
        adicionais > 0 ? fmt(adicionais) : "—",
        fmt(i.valor),
      ];
    }),
    theme: "striped",
    headStyles: {
      fillColor: navyRGB,
      textColor: [255, 255, 255],
      fontSize: 8,
      halign: "center",
      valign: "middle",
      cellPadding: 4,
    },
    bodyStyles: { fontSize: 8, textColor: slate700, valign: "middle", cellPadding: 3.5 },
    columnStyles: {
      0: { cellWidth: 52, halign: "center" },
      1: { cellWidth: 58, halign: "center" },
      2: { cellWidth: 78, halign: "center" },
      3: { cellWidth: 116, halign: "left" },
      4: { cellWidth: 70, halign: "right" },
      5: { cellWidth: 66, halign: "right" },
      6: { cellWidth: 75, halign: "right", fontStyle: "bold" },
    },
    margin: { left: margin, right: margin, bottom: 60 },
    didDrawPage: (data) => {
      // Identificação da fatura nas páginas seguintes (rodapé final é
      // desenhado no loop ao final, com a paginação real já conhecida).
      if (data.pageNumber > 1) {
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(slate500[0], slate500[1], slate500[2]);
        doc.text(
          `Conexão Express — Fatura ${numeroExib(input)} — Página ${data.pageNumber}`,
          margin, 22
        );
      }
    },
  });

  const last = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable;
  let afterY = (last?.finalY ?? y) + 18;
  if (afterY > pageHeight - 130) {
    doc.addPage();
    afterY = 50;
  }

  // ══ DOCUMENTOS FISCAIS (somente quando houver informação real) ═════════════
  const fiscais = (input.documentosFiscais || []).filter((f) => f?.nfse || f?.cte);
  if (fiscais.length > 0) {
    drawSectionTitle(doc, margin, afterY, "DOCUMENTOS FISCAIS");
    afterY += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(slate700[0], slate700[1], slate700[2]);
    fiscais.forEach((f) => {
      const partes: string[] = [];
      if (f.nfse) partes.push(`NFS-e nº ${f.nfse}`);
      if (f.cte) partes.push(`CT-e nº ${f.cte}`);
      if (f.chave) partes.push(`Chave: ${f.chave}`);
      if (partes.length > 0) {
        doc.text(partes.join("  ·  "), margin, afterY);
        afterY += 14;
      }
    });
    afterY += 8;
  }

  // ══ CONDIÇÕES DE PAGAMENTO ═════════════════════════════════════════════════
  const temBanco = input.empresa.banco || input.empresa.agencia || input.empresa.conta || input.empresa.pix;
  if (temBanco || input.vencimento || input.dadosCliente?.vencimentoPadraoDias) {
    if (afterY > pageHeight - 150) {
      doc.addPage();
      afterY = 50;
    }
    drawSectionTitle(doc, margin, afterY, "CONDIÇÕES DE PAGAMENTO");
    afterY += 16;
    const pagtoLinhas: { label: string; valor: string }[] = [];
    if (input.vencimento) pagtoLinhas.push({ label: "Vencimento", valor: fmtData(input.vencimento) });
    const prazoDias = input.dadosCliente?.vencimentoPadraoDias;
    if (prazoDias) pagtoLinhas.push({ label: "Prazo", valor: `${prazoDias} dia(s)` });
    if (input.dadosCliente?.tipoCobranca) pagtoLinhas.push({ label: "Forma de pagamento", valor: limparTexto(input.dadosCliente.tipoCobranca) });
    if (input.empresa.banco) pagtoLinhas.push({ label: "Banco", valor: input.empresa.banco });
    if (input.empresa.agencia) pagtoLinhas.push({ label: "Agência", valor: input.empresa.agencia });
    if (input.empresa.conta) pagtoLinhas.push({ label: "Conta", valor: input.empresa.conta });
    if (input.empresa.pix) pagtoLinhas.push({ label: "PIX", valor: input.empresa.pix });
    pagtoLinhas.forEach((l) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(slate500[0], slate500[1], slate500[2]);
      doc.text(`${l.label}:`, margin + 6, afterY);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(slate700[0], slate700[1], slate700[2]);
      const labelW = doc.getTextWidth(`${l.label}: `);
      doc.text(l.valor, margin + 8 + labelW, afterY, { maxWidth: contentWidth - 20 - labelW });
      afterY += 14;
    });
    afterY += 8;
  }

  // ══ OBSERVAÇÕES (somente observações reais) ════════════════════════════════
  if (input.observacao) {
    if (afterY > pageHeight - 110) {
      doc.addPage();
      afterY = 50;
    }
    drawSectionTitle(doc, margin, afterY, "OBSERVAÇÕES");
    afterY += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(slate500[0], slate500[1], slate500[2]);
    const linhasObs = doc.splitTextToSize(limparTexto(input.observacao), contentWidth);
    doc.text(linhasObs, margin, afterY);
    afterY += linhasObs.length * 11 + 10;
  }

  // ══ TOTAL DA FATURA — FAIXA DE DESTAQUE FINAL ══════════════════════════════
  if (afterY > pageHeight - 70) {
    doc.addPage();
    afterY = 50;
  }
  doc.setFillColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
  doc.roundedRect(margin, afterY, contentWidth, 30, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL DA FATURA", margin + 12, afterY + 19);
  doc.text(fmt(input.total), pageWidth - margin - 12, afterY + 19, { align: "right" });

  // Rodapé (todas as páginas) — via loop final (garante paginação real)
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawRodapeFatura(doc, input, i, pageCount);
  }
  return doc;
}

/** Rodapé profissional da fatura (linha + identificação + geração + página). */
function drawRodapeFatura(doc: jsPDF, input: PdfFaturaInput, paginaAtual: number, totalPaginas: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const footerY = pageHeight - 24;
  doc.setDrawColor(200, 210, 225);
  doc.setLineWidth(0.4);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
  doc.setLineWidth(0.1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(slate500[0], slate500[1], slate500[2]);
  const razao = input.empresa.razaoSocial || input.empresa.nomeFantasia || "Conexão Express Transportes LTDA";
  doc.text(`${razao} — Fatura ${numeroExib(input)}`, pageWidth / 2, footerY, { align: "center" });
  doc.text(`Gerado em ${fmtDataHora()}`, pageWidth / 2, footerY + 9, { align: "center" });
  doc.text(`Página ${paginaAtual} de ${totalPaginas}`, pageWidth - margin, footerY, { align: "right" });
}

/** Título de seção com sublinhado laranja curto. */
function drawSectionTitle(doc: jsPDF, x: number, y: number, text: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(navyRGB[0], navyRGB[1], navyRGB[2]);
  doc.text(text, x, y);
  doc.setDrawColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
  doc.setLineWidth(0.6);
  doc.line(x, y + 2, x + 42, y + 2);
  doc.setLineWidth(0.1);
}

/**
 * MODELO 2 — PADRÃO CALVO
 * Logo grande, "CONEXÃO SERVIÇOS EXPRESS LTDA", CNPJ/IE/endereço/e-mail,
 * faixa "Cobrança para: [RAZÃO SOCIAL]", dados do cliente, tabela
 * FATURA | DESCRIÇÃO | PARCELA | VENCIMENTO | VALOR, dados para transferência
 * bancária (BANCO/AGÊNCIA/CONTA/PIX) e rodapé "Fatura [nº] - Conexão Express".
 */
async function gerarPdfCalvo(input: PdfFaturaInput): Promise<jsPDF> {
  const doc = new jsPDF("portrait", "pt", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;
  const logo = await getLogoWithFallback(false); // fundo claro → logo colorido grande

  const azulEscuroRGB: [number, number, number] = [0, 51, 153];
  const salmaoRGB: [number, number, number] = [250, 190, 150];
  const cinzaFaixaRGB: [number, number, number] = [210, 210, 210];

  // ── LOGO GRANDE CENTRALIZADO (referência: bastante espaço branco) ──────────
  let y = 84;
  const logoMaxW = Math.min(420, contentWidth);
  const logoMaxH = 150;
  if (logo.base64) {
    const naturalW = logo.naturalWidth || 1545;
    const naturalH = logo.naturalHeight || 982;
    const ratio = naturalW / naturalH;
    let logoW = logoMaxW;
    let logoH = logoW / ratio;
    if (logoH > logoMaxH) {
      logoH = logoMaxH;
      logoW = logoH * ratio;
    }
    const logoX = (pageWidth - logoW) / 2;
    drawLogoSafe(doc, logo, {
      x: logoX, y: 24, maxWidth: logoW, maxHeight: logoH, align: "left", valign: "middle",
      onFallback: () => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(30);
        doc.setTextColor(azulEscuroRGB[0], azulEscuroRGB[1], azulEscuroRGB[2]);
        doc.text("CONEXÃO EXPRESS", pageWidth / 2, 78, { align: "center" });
      },
    });
    y = 24 + logoH + 42;
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(30);
    doc.setTextColor(azulEscuroRGB[0], azulEscuroRGB[1], azulEscuroRGB[2]);
    doc.text("CONEXÃO EXPRESS", pageWidth / 2, 78, { align: "center" });
    y = 104;
  }

  // ── FAIXA SALMÃO FINA: razão social dinâmica (Config. Financeiras) ─────────
  doc.setFillColor(salmaoRGB[0], salmaoRGB[1], salmaoRGB[2]);
  doc.rect(margin, y - 14, contentWidth, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(azulEscuroRGB[0], azulEscuroRGB[1], azulEscuroRGB[2]);
  // FIN-CONFIG-PDF-01: substituído hardcoded "CONEXÃO SERVIÇOS EXPRESS LTDA"
  // por razão social dinâmica da Config. Financeiras (config_financeira_empresa).
  const razaoCalvo = input.empresa.razaoSocial || input.empresa.nomeFantasia || "Conexão Express";
  doc.text(razaoCalvo, pageWidth / 2, y, { align: "center" });
  y += 22;

  // ── DADOS DA EMPRESA em fundo BRANCO, centralizados (abaixo da faixa) ─────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(slate700[0], slate700[1], slate700[2]);
  const linhasEmpresa = [
    input.empresa.cnpj ? `CNPJ: ${input.empresa.cnpj}` : "",
    input.empresa.ie ? `INSCRIÇÃO ESTADUAL: ${input.empresa.ie}` : "",
    input.empresa.endereco ? `${input.empresa.endereco} — ${input.empresa.cidade}/${input.empresa.uf}` : "",
    input.empresa.email ? `E-MAIL: ${input.empresa.email}` : "",
  ].filter(Boolean);
  linhasEmpresa.forEach((l) => { doc.text(l, pageWidth / 2, y, { align: "center" }); y += 14; });
  y += 18;

  // ── FAIXA CINZA FINA "Cobrança para:" ─────────────────────────────────────
  doc.setFillColor(cinzaFaixaRGB[0], cinzaFaixaRGB[1], cinzaFaixaRGB[2]);
  doc.rect(margin, y - 14, contentWidth, 22, "F");
  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.5);
  doc.rect(margin, y - 14, contentWidth, 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text(`Cobrança para: ${input.cliente || "—"}`, margin + 10, y);
  y += 16;

  // FATURA-CLIENTE-01 — "Nº Conexão" + "Nº Cliente" (informações internas do
  // sistema) NÃO são renderizadas no documento destinado ao cliente.
  // Os números continuam existindo no banco e na tela do TMS.

  // ── DADOS DO CLIENTE em fundo BRANCO, alinhados à esquerda ────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(slate700[0], slate700[1], slate700[2]);
  if (input.clienteCnpj) { doc.text(`CNPJ: ${input.clienteCnpj}`, margin + 10, y); y += 12; }
  if (input.clienteIe) { doc.text(`IE: ${input.clienteIe}`, margin + 10, y); y += 12; }
  // FATURA-CLIENTE-02 — endereço REAL cadastrado do cliente (aba Endereços →
  // enderecos_clientes via enderecoCompleto), com fallback para o endereço do
  // cadastro do cliente. Sem endereço fixo/manual.
  const endClienteCobranca =
    input.dadosCliente?.enderecoCompleto ||
    (input.dadosCliente?.endereco
      ? `${input.dadosCliente.endereco}${input.dadosCliente.cidade ? ` — ${input.dadosCliente.cidade}/${input.dadosCliente.uf}` : ""}`
      : "");
  if (endClienteCobranca) {
    doc.text(endClienteCobranca, margin + 10, y);
    y += 12;
  }
  y += 18;

  // ── TABELA PRINCIPAL ───────────────────────────────────────────────────────
  const parcelaExib = input.parcela ? `${input.parcela}/1` : "1/1";
  autoTable(doc, {
    startY: y,
    head: [["FATURA", "DESCRIÇÃO", "PARCELA", "VENCIMENTO", "VALOR"]],
    body: input.itens.map((i) => [
      numeroExib(input), i.descricao || i.romaneio || "Serviço de transporte", parcelaExib,
      fmtData(input.vencimento), fmt(i.valor),
    ]),
    theme: "grid",
    headStyles: {
      fillColor: [220, 220, 220], textColor: [40, 40, 40], fontSize: 10,
      halign: "center", valign: "middle", lineColor: [60, 60, 60], lineWidth: 0.3,
      cellPadding: 6,
    },
    bodyStyles: {
      fontSize: 9.5, textColor: [51, 65, 85], lineColor: [120, 120, 120], lineWidth: 0.2,
      valign: "middle", cellPadding: 5,
    },
    columnStyles: {
      0: { cellWidth: 95, halign: "center", valign: "middle" },
      1: { cellWidth: "auto", halign: "left", valign: "middle" },
      2: { cellWidth: 65, halign: "center", valign: "middle" },
      3: { cellWidth: 95, halign: "center", valign: "middle" },
      4: { cellWidth: 105, halign: "center", valign: "middle", fontStyle: "bold" },
    },
    margin: { left: margin, right: margin },
  });

  const last = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable;
  let afterY = (last?.finalY ?? y) + 18;
  if (afterY > pageHeight - 120) { doc.addPage(); afterY = 50; }

  // ── DADOS PARA TRANSFERÊNCIA BANCÁRIA (à esquerda, sem card) ───────────────
  const temBanco = input.empresa.banco || input.empresa.agencia || input.empresa.conta || input.empresa.pix;
  if (temBanco) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(azulEscuroRGB[0], azulEscuroRGB[1], azulEscuroRGB[2]);
    doc.text("Dados para Transferência Bancária", margin, afterY);
    afterY += 15;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(slate700[0], slate700[1], slate700[2]);
    const dados = [
      input.empresa.banco ? `Banco ${input.empresa.banco}` : "",
      input.empresa.agencia ? `AG: ${input.empresa.agencia}` : "",
      input.empresa.conta ? `C/C: ${input.empresa.conta}` : "",
      input.empresa.pix ? `CHAVE PIX: ${input.empresa.pix}` : "",
    ].filter(Boolean);
    dados.forEach((l) => { doc.text(l, margin, afterY); afterY += 12; });
  }

  // ── RODAPÉ discreto — centralizado ─────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    const labelRodape = `Fatura ${numeroExib(input)} - Conexão Express`;
    doc.text(labelRodape, pageWidth / 2, ph - 16, { align: "center" });
    doc.text(`Gerado em ${fmtDataHora()}`, pageWidth / 2, ph - 6, { align: "center" });
  }

  return doc;
}

/** Gera o PDF da Fatura conforme o modelo escolhido. */
export async function gerarPDFFatura(input: PdfFaturaInput): Promise<jsPDF> {
  if (input.modelo === "calvo") return gerarPdfCalvo(input);
  return gerarPdfConexaoExpress(input);
}

// ═══════════════════════════════════════════════════════════════════════════
// TMS-S04C — RELATÓRIO INDIVIDUAL DE FATURAMENTO DO CLIENTE
// Documento profissional enviado ao cliente para conferência de faturamento.
// Mesma identidade institucional da Fatura (navy + logo oficial).
// ═══════════════════════════════════════════════════════════════════════════

export interface ItemRelatorioFaturamentoIndividual {
  data: string;
  romaneio: string;
  veiculo: string;
  trajeto: string;
  valorBase: number;
  kmAdicional: number;
  pedagio: number;
  reembolso: number;
  descontos: number;
  valorTotal: number;
}

export interface RelatorioFaturamentoIndividualInput {
  cliente: string;
  clienteCnpj?: string;
  periodo: string;
  itens: ItemRelatorioFaturamentoIndividual[];
  resumo: {
    quantidade: number;
    valorBase: number;
    kmAdicional: number;
    pedagio: number;
    reembolso: number;
    descontos: number;
    totalFaturado: number;
  };
  empresa: DadosEmpresaFatura;
  logoBase64?: string;
}

/**
 * Gera o PDF do Relatório Individual de Faturamento do Cliente (landscape).
 * Cliente no topo, tabela definitiva (Data | Romaneio/OC | Veículo/Placa |
 * Valor Base | KM Adicional | Pedágio | Reembolso | Descontos | Valor Total),
 * RESUMO FINANCEIRO e TOTAL FATURADO em destaque. Multi-página.
 */
export async function gerarPDFRelatorioFaturamentoIndividual(input: RelatorioFaturamentoIndividualInput): Promise<jsPDF> {
  const doc = new jsPDF("landscape", "pt", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const logo = await carregarLogo(input);

  // ══ CABEÇALHO INSTITUCIONAL (faixa navy + logo oficial + empresa) ══════════
  const bandH = 88;
  doc.setFillColor(navyRGB[0], navyRGB[1], navyRGB[2]);
  doc.rect(0, 0, pageWidth, bandH, "F");

  // Logo com presença institucional clara (máximo confortável dentro da faixa).
  drawLogoSafe(doc, logo, {
    x: margin, y: (bandH - 62) / 2, maxWidth: 96, maxHeight: 62, align: "left", valign: "middle",
    onFallback: () => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text("CONEXÃO EXPRESS", margin, 48);
    },
  });

  // Bloco da empresa à direita — centralizado no eixo visual do logo, compacto,
  // sem encostar na borda inferior nem na margem direita.
  const rightEmpresaX = pageWidth - margin - 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(input.empresa.razaoSocial || input.empresa.nomeFantasia || "Conexão Express Transportes LTDA", rightEmpresaX, 25, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(215, 224, 240);
  const linhaCnpj = [`CNPJ: ${input.empresa.cnpj || "—"}`];
  if (input.empresa.ie) linhaCnpj.push(`IE: ${input.empresa.ie}`);
  doc.text(linhaCnpj.join("   "), rightEmpresaX, 43, { align: "right" });
  const cidadeUf = input.empresa.cidade && input.empresa.uf ? `${input.empresa.cidade}/${input.empresa.uf}` : "";
  doc.text(cidadeUf, rightEmpresaX, 57, { align: "right" });
  if (input.empresa.telefone || input.empresa.emailFinanceiro || input.empresa.email) {
    const contatos = [input.empresa.telefone, input.empresa.emailFinanceiro || input.empresa.email].filter(Boolean).join("  ·  ");
    if (contatos) {
      doc.setFontSize(7.5);
      doc.setTextColor(190, 200, 215);
      doc.text(contatos, rightEmpresaX, 70, { align: "right" });
    }
  }

  doc.setDrawColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
  doc.setLineWidth(1.2);
  doc.line(0, bandH, pageWidth, bandH);
  doc.setLineWidth(0.1);

  // ══ TÍTULO + SUBTÍTULO ═══════════════════════════════════════════════════
  let y = bandH + 36;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(navyRGB[0], navyRGB[1], navyRGB[2]);
  doc.text("RELATÓRIO DE FATURAMENTO", pageWidth / 2, y, { align: "center" });
  y += 15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(slate500[0], slate500[1], slate500[2]);
  doc.text("Detalhamento dos serviços realizados", pageWidth / 2, y, { align: "center" });
  y += 14;

  // ══ IDENTIFICAÇÃO DO CLIENTE (no topo do conteúdo) ════════════════════════
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(220, 226, 236);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y - 10, contentWidth, 46, 4, 4, "FD");
  doc.setLineWidth(0.1);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(navyRGB[0], navyRGB[1], navyRGB[2]);
  doc.text(limparTexto(input.cliente) || "Cliente", margin + 12, y + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(slate500[0], slate500[1], slate500[2]);
  if (input.clienteCnpj) doc.text(`CNPJ: ${input.clienteCnpj}`, margin + 12, y + 18);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(slate700[0], slate700[1], slate700[2]);
  const rightX = pageWidth - margin - 12;
  doc.text("Período:", rightX, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(slate500[0], slate500[1], slate500[2]);
  doc.text(limparTexto(input.periodo) || "—", rightX, y + 13, { align: "right" });
  doc.text(`Data de geração: ${fmtDataHora()}`, rightX, y + 26, { align: "right" });
  y += 46;

  // ══ TABELA PRINCIPAL (paginada, cabeçalho repetido) ═══════════════════════
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [["Data", "Romaneio / OC", "Veículo / Placa", "Valor Base", "KM Adic.", "Pedágio", "Reembolso", "Descontos", "Valor Total"]],
    body: input.itens.map((i) => {
      // Romaneio/OC + trajeto em duas linhas limpas (nunca "—,trajeto").
      const romaneio = limparTexto(i.romaneio) || "—";
      const trajeto = i.trajeto ? limparTexto(i.trajeto) : "";
      const celulaRomaneio = trajeto ? `${romaneio}\n${trajeto}` : romaneio;
      return [
        fmtData(i.data),
        celulaRomaneio,
        limparTexto(i.veiculo) || "—",
        fmt(Number(i.valorBase) || 0),
        Number(i.kmAdicional) > 0 ? fmt(Number(i.kmAdicional) || 0) : "—",
        Number(i.pedagio) > 0 ? fmt(Number(i.pedagio) || 0) : "—",
        Number(i.reembolso) > 0 ? fmt(Number(i.reembolso) || 0) : "—",
        Number(i.descontos) > 0 ? fmt(-(Number(i.descontos) || 0)) : "—",
        fmt(Number(i.valorTotal) || 0),
      ];
    }),
    theme: "striped",
    headStyles: {
      fillColor: navyRGB,
      textColor: [255, 255, 255],
      fontSize: 8,
      valign: "middle",
      cellPadding: 4,
    },
    bodyStyles: { fontSize: 8, textColor: slate700, valign: "middle", cellPadding: 3.5 },
    columnStyles: {
      // Alinhamento idêntico em cabeçalho e conteúdo (valores à direita).
      0: { cellWidth: 55, halign: "center" },
      1: { cellWidth: 118, halign: "left" },
      2: { cellWidth: 98, halign: "left" },
      3: { cellWidth: 82, halign: "right" },
      4: { cellWidth: 74, halign: "right" },
      5: { cellWidth: 70, halign: "right" },
      6: { cellWidth: 70, halign: "right" },
      7: { cellWidth: 78, halign: "right" },
      8: { cellWidth: 90, halign: "right", fontStyle: "bold" },
    },
    margin: { left: margin, right: margin, bottom: 56 },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(slate500[0], slate500[1], slate500[2]);
        doc.text(
          `Conexão Express — Relatório de Faturamento — ${limparTexto(input.cliente)} — Página ${data.pageNumber}`,
          margin, 20
        );
      }
    },
  });

  const last = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable;
  let afterY = (last?.finalY ?? y) + 16;
  if (afterY > pageHeight - 140) {
    doc.addPage();
    afterY = 40;
  }

  // ══ RESUMO FINANCEIRO ═════════════════════════════════════════════════════
  drawSectionTitle(doc, margin, afterY, "RESUMO FINANCEIRO");
  afterY += 14;
  const resumo = input.resumo;
  const linhasResumo: { label: string; valor: string; destaque?: boolean }[] = [
    { label: "Quantidade de serviços", valor: String(resumo.quantidade || 0) },
    { label: "Valor Base", valor: fmt(Number(resumo.valorBase) || 0) },
    { label: "KM Adicional", valor: fmt(Number(resumo.kmAdicional) || 0) },
    { label: "Pedágios", valor: fmt(Number(resumo.pedagio) || 0) },
    { label: "Reembolsos", valor: fmt(Number(resumo.reembolso) || 0) },
    { label: "Descontos", valor: fmt(-(Number(resumo.descontos) || 0)) },
    { label: "TOTAL FATURADO", valor: fmt(Number(resumo.totalFaturado) || 0), destaque: true },
  ];
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(margin, afterY - 6, contentWidth, linhasResumo.length * 16 + 10, 3, 3, "F");
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  linhasResumo.forEach((l) => {
    doc.setFont("helvetica", l.destaque ? "bold" : "normal");
    doc.setFontSize(l.destaque ? 11 : 9);
    doc.setTextColor(l.destaque ? orangeRGB[0] : slate700[0], l.destaque ? orangeRGB[1] : slate700[1], l.destaque ? orangeRGB[2] : slate700[2]);
    doc.text(l.label, margin + 10, afterY + 6);
    doc.text(l.valor, pageWidth - margin - 10, afterY + 6, { align: "right" });
    afterY += 16;
  });

  // ══ RODAPÉ (todas as páginas) ═════════════════════════════════════════════
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawRodapeRelatorio(doc, input, i, pageCount);
  }
  return doc;
}

/** Rodapé profissional do Relatório Individual de Faturamento. */
function drawRodapeRelatorio(
  doc: jsPDF,
  input: RelatorioFaturamentoIndividualInput,
  paginaAtual: number,
  totalPaginas: number
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const footerY = pageHeight - 24;
  doc.setDrawColor(200, 210, 225);
  doc.setLineWidth(0.4);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
  doc.setLineWidth(0.1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(slate500[0], slate500[1], slate500[2]);
  const razao = input.empresa.razaoSocial || input.empresa.nomeFantasia || "Conexão Express Transportes LTDA";
  doc.text(razao, pageWidth / 2, footerY, { align: "center" });
  doc.text(`Gerado em ${fmtDataHora()}`, pageWidth / 2, footerY + 9, { align: "center" });
  doc.text(`Página ${paginaAtual} de ${totalPaginas}`, pageWidth - margin, footerY, { align: "right" });
}

/** Baixa o PDF da Fatura. */
export async function baixarPDFFatura(input: PdfFaturaInput, nomeArquivo?: string): Promise<void> {
  const doc = await gerarPDFFatura(input);
  const num = (input.numero && input.numero !== "Rascunho" ? input.numero : "rascunho")
    .replace(/[^\w-]/g, "_");
  const nome = nomeArquivo || `Fatura_${num}.pdf`;
  doc.save(nome);
}

/** Baixa o PDF do Relatório Individual de Faturamento do Cliente. */
export async function baixarPDFRelatorioFaturamentoIndividual(
  input: RelatorioFaturamentoIndividualInput,
  nomeArquivo?: string
): Promise<void> {
  const doc = await gerarPDFRelatorioFaturamentoIndividual(input);
  const nomeCliente = input.cliente.replace(/[^\w-]/g, "_").toLowerCase().replace(/_+/g, "_");
  doc.save(nomeArquivo || `Relatorio_Faturamento_${nomeCliente}.pdf`);
}
