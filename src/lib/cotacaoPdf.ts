// ============================================================
// PROPOSTA COMERCIAL — COTAÇÃO EXPRESS
// PDF Enterprise emitido exclusivamente pela Conexão Express.
// Nunca usa nome de pessoa como remetente.
// ============================================================
import { jsPDF } from "jspdf";
import {
  drawCoverPage,
  drawContentHeader,
  drawCorporateTable,
  drawSectionTitle,
  drawInfoBlock,
  getPageSetup,
  fmtBRL,
  fmtDate,
  NAVY,
  ORANGE,
  WHITE,
  TEXT_DARK,
  TEXT_BODY,
  BORDER,
  BG_WARM,
  BG_LIGHT,
} from "./pdf/foundation";
import { empresaConfig } from "@/utils/empresaConfig";

export interface CotacaoPropostaPdfInput {
  cotacaoId?: string | null;
  nomeCliente: string;
  telefone: string;
  descricao: string;
  peso: string | number;
  dimensoes: string;
  paradas: Array<{ endereco: string; tipo: string; janela?: string }>;
  veiculo: string;
  sla?: string;
  mensagemVeiculo?: string;
  cubagem?: string;
  valor: number;
  km?: number | null;
  duracaoMin?: number | null;
  paradasCount: number;
  aviso?: string;
  fonte?: string | null;
  dataDesejada?: string;
  janelaHorario?: string;
}

const numeroProposta = (input: CotacaoPropostaPdfInput): string => {
  const base = (input.cotacaoId || "").replace(/-/g, "").slice(0, 8).toUpperCase();
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `PROP-${stamp}-${base || String(Date.now()).slice(-6)}`;
};

const dataHoraEmissao = (): string =>
  new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const limparNomeArquivo = (valor: string): string =>
  valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "cliente";

export async function gerarPropostaCotacaoPDF(input: CotacaoPropostaPdfInput): Promise<void> {
  const doc = new jsPDF("p", "mm", "a4");
  const page = getPageSetup(doc, 15);
  const numero = numeroProposta(input);
  const emissao = dataHoraEmissao();
  const validade = fmtDate(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );

  // ===================== CAPA CORPORATIVA =====================
  const logo = await drawCoverPage(doc, {
    documentType: "PROPOSTA COMERCIAL",
    documentNumber: numero,
    entityName: input.nomeCliente || "Cliente",
    entitySubtitle: "Transporte de cargas",
    status: "COTAÇÃO INSTANTÂNEA",
    date: emissao,
    via: "Cliente",
  });

  // ===================== CONTEÚDO =====================
  doc.addPage();

  const drawHeader = () => {
    drawContentHeader(doc, page.pageWidth, page.margin, logo, {
      title: `PROPOSTA COMERCIAL — ${numero}`,
      subtitle: `Emitida por ${empresaConfig.razaoSocial}`,
    });
  };

  drawHeader();

  let y = 35;

  // --- Dados da proposta ---
  y = drawSectionTitle(doc, page.margin, y, "DADOS DA PROPOSTA", page);
  y = drawInfoBlock(doc, page.margin, y, page.contentWidth, "IDENTIFICAÇÃO", [
    { label: "Cliente", value: input.nomeCliente || "—" },
    { label: "WhatsApp", value: input.telefone || "—" },
    { label: "Emissão", value: emissao },
    { label: "Validade", value: `${validade} (7 dias)` },
    { label: "Referência", value: numero },
    {
      label: "Agendamento",
      value:
        [input.dataDesejada ? fmtDate(input.dataDesejada) : "", input.janelaHorario || ""]
          .filter(Boolean)
          .join(" · ") || "A confirmar",
    },
  ]);

  // --- Rota ---
  y = drawSectionTitle(doc, page.margin, y, "ROTA COTADA", page);
  const rotaRows = input.paradas.map((parada, index) => [
    String(index + 1),
    parada.tipo || "Parada",
    parada.endereco || "—",
    parada.janela || "—",
  ]);
  y = drawCorporateTable(doc, page, logo, {
    startY: y,
    columns: ["#", "Tipo", "Endereço / Referência", "Janela"],
    rows: rotaRows.length > 0 ? rotaRows : [["1", "Rota", "A confirmar", "—"]],
    columnWidths: { 0: 10, 1: 25, 2: 115, 3: 30 },
    columnAligns: { 0: "center", 1: "center", 3: "center" },
    onPageDraw: drawHeader,
  });
  y += 6;

  if (y > 225) {
    doc.addPage();
    drawHeader();
    y = 35;
  }

  // --- Veículo em destaque ---
  y = drawSectionTitle(doc, page.margin, y, "VEÍCULO INDICADO", page);
  const veiculoH = 28;
  doc.setFillColor(255, 247, 237);
  doc.setDrawColor(ORANGE[0], ORANGE[1], ORANGE[2]);
  doc.setLineWidth(0.4);
  doc.roundedRect(page.margin, y, page.contentWidth, veiculoH, 2.5, 2.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(input.veiculo || "A confirmar", page.margin + 5, y + 8);

  if (input.sla) {
    doc.setFontSize(7.5);
    doc.setTextColor(ORANGE[0], ORANGE[1], ORANGE[2]);
    doc.text(input.sla, page.margin + 5, y + 14);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(TEXT_BODY[0], TEXT_BODY[1], TEXT_BODY[2]);
  if (input.mensagemVeiculo) {
    doc.text(input.mensagemVeiculo, page.margin + 5, y + 19, {
      maxWidth: page.contentWidth - 10,
    });
  }
  if (input.cubagem) {
    doc.text(input.cubagem, page.margin + 5, y + 24);
  }
  y += veiculoH + 7;

  // --- Valor em destaque ---
  if (y > 210) {
    doc.addPage();
    drawHeader();
    y = 35;
  }

  y = drawSectionTitle(doc, page.margin, y, "VALOR DA PROPOSTA", page);
  const valorH = 34;
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.roundedRect(page.margin, y, page.contentWidth, valorH, 2.5, 2.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text("VALOR DO FRETE", page.margin + 5, y + 7);

  doc.setFontSize(24);
  doc.setTextColor(ORANGE[0], ORANGE[1], ORANGE[2]);
  doc.text(fmtBRL(input.valor), page.margin + 5, y + 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(220, 225, 235);
  const infoValor = [
    input.km != null ? `${input.km.toFixed(1).replace(".", ",")} km` : null,
    input.duracaoMin != null ? `${Math.round(input.duracaoMin)} min de percurso` : null,
    `${input.paradasCount} parada(s)`,
  ]
    .filter(Boolean)
    .join("  •  ");
  doc.text(infoValor, page.margin + 5, y + 25);

  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text("Cotação estimada — sujeita a confirmação operacional.", page.margin + 5, y + 30);
  y += valorH + 7;

  // --- Carga ---
  if (y > 235) {
    doc.addPage();
    drawHeader();
    y = 35;
  }

  y = drawSectionTitle(doc, page.margin, y, "DADOS DA CARGA", page);
  y = drawInfoBlock(doc, page.margin, y, page.contentWidth, "CARGA DECLARADA", [
    { label: "Descrição", value: input.descricao || "—" },
    { label: "Peso", value: `${String(input.peso).replace(".", ",")} kg` },
    { label: "Dimensões", value: input.dimensoes || "Não informadas" },
    { label: "Paradas", value: String(input.paradasCount) },
  ]);

  // --- Condições comerciais ---
  y = drawSectionTitle(doc, page.margin, y, "CONDIÇÕES COMERCIAIS", page);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(TEXT_BODY[0], TEXT_BODY[1], TEXT_BODY[2]);
  const condicoes = [
    `Proposta válida até ${validade}.`,
    input.aviso || "Valor estimado — sujeito a confirmação operacional (distância, pedágio e disponibilidade).",
    input.fonte ? `Fonte da precificação: ${input.fonte}.` : "Fonte da precificação: tabela Conexão Express.",
    "A contratação está sujeita à disponibilidade de veículo e à confirmação da operação.",
  ];
  for (const linha of condicoes) {
    doc.text(`• ${linha}`, page.margin, y, { maxWidth: page.contentWidth });
    y += doc.getTextDimensions(linha, { maxWidth: page.contentWidth }).h + 2;
  }

  y += 4;

  // --- Emissor institucional ---
  if (y > 235) {
    doc.addPage();
    drawHeader();
    y = 35;
  }

  doc.setFillColor(BG_LIGHT[0], BG_LIGHT[1], BG_LIGHT[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.2);
  doc.roundedRect(page.margin, y, page.contentWidth, 24, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(empresaConfig.razaoSocial, page.margin + 5, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(TEXT_BODY[0], TEXT_BODY[1], TEXT_BODY[2]);
  doc.text(
    `CNPJ: ${empresaConfig.cnpj}  •  ${empresaConfig.telefone}  •  ${empresaConfig.email}`,
    page.margin + 5,
    y + 13,
  );
  doc.text(
    `${empresaConfig.endereco} — ${empresaConfig.cidade}/${empresaConfig.uf}  •  ${empresaConfig.site}`,
    page.margin + 5,
    y + 18,
  );

  doc.save(`proposta-conexao-express-${limparNomeArquivo(input.nomeCliente)}-${numero}.pdf`);
}
