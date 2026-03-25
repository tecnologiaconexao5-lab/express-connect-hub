import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Orcamento, STATUS_CONFIG } from "./types";

const AZUL = [15, 26, 46];
const LARANJA = [249, 115, 22];
const CINZA_CLARO = [248, 250, 252];
const BRANCO = [255, 255, 255];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; } };

export const gerarPdfOrcamento = (orc: Orcamento) => {
  const doc = new jsPDF("p", "mm", "a4");
  const W = 210;
  const M = 15;
  const CW = W - 2 * M;
  let y = 0;

  const setColor = (rgb: number[]) => { doc.setTextColor(rgb[0], rgb[1], rgb[2]); };
  const setFill = (rgb: number[]) => { doc.setFillColor(rgb[0], rgb[1], rgb[2]); };

  // ========= HEADER BAR =========
  setFill(AZUL);
  doc.rect(0, 0, W, 38, "F");
  // Orange accent bar
  setFill(LARANJA);
  doc.rect(0, 38, W, 3, "F");

  // Logo text (since we don't have an image)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  setColor(BRANCO);
  doc.text("CONEXÃO EXPRESS", M, 16);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("TRANSPORTES & LOGÍSTICA", M, 22);

  // Right side - doc info
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Orçamento ${orc.numero}`, W - M, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Emissão: ${fmtDate(orc.dataEmissao)}`, W - M, 20, { align: "right" });
  doc.text(`Validade: ${fmtDate(orc.validade)}`, W - M, 25, { align: "right" });
  doc.text(`Status: ${STATUS_CONFIG[orc.status].label}`, W - M, 30, { align: "right" });

  y = 48;

  // ========= TÍTULO =========
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  setColor(AZUL);
  doc.text("ORÇAMENTO COMERCIAL", W / 2, y, { align: "center" });
  y += 3;
  setFill(LARANJA);
  doc.rect(W / 2 - 30, y, 60, 0.8, "F");
  y += 10;

  // ========= DADOS DO CLIENTE =========
  setFill(CINZA_CLARO);
  doc.roundedRect(M, y, CW, 30, 2, 2, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  setColor(AZUL);
  doc.text("DADOS DO CLIENTE", M + 5, y + 7);
  doc.setFont("helvetica", "normal");
  setColor([60, 60, 60]);
  doc.setFontSize(8.5);
  const clienteLines = [
    [`Cliente: ${orc.cliente}`, `CNPJ: ${orc.clienteCnpj}`],
    [`Unidade: ${orc.unidade}`, `Centro de Custo: ${orc.centroCusto}`],
    [`Responsável: ${orc.responsavel}`, `Modalidade: ${orc.modalidade === "contrato" ? "Contrato" : "Esporádico"}`],
  ];
  clienteLines.forEach((pair, i) => {
    doc.text(pair[0], M + 5, y + 13 + i * 5);
    doc.text(pair[1], M + CW / 2, y + 13 + i * 5);
  });
  y += 36;

  // ========= RESUMO EXECUTIVO =========
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  setColor(AZUL);
  doc.text("RESUMO EXECUTIVO", M + 5, y + 5);
  y += 8;

  const resumoItems = [
    { label: "Valor Base", value: fmt(orc.valores.valorBase) },
    { label: "Adicionais", value: fmt(orc.valores.adicionais) },
    { label: "Pedágio", value: fmt(orc.valores.pedagio) },
    { label: "Km Excedente", value: fmt(orc.valores.kmExcedente) },
    { label: "Ajudante", value: fmt(orc.valores.ajudante) },
    { label: "Descontos", value: `(${fmt(orc.valores.descontos)})` },
  ].filter((r) => {
    const num = parseFloat(r.value.replace(/[^\d,-]/g, "").replace(",", "."));
    return num !== 0;
  });

  setFill([240, 245, 250]);
  doc.roundedRect(M, y, CW, resumoItems.length * 6 + 16, 2, 2, "F");

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  setColor([60, 60, 60]);
  resumoItems.forEach((item, i) => {
    doc.text(item.label, M + 8, y + 7 + i * 6);
    doc.text(item.value, M + CW - 8, y + 7 + i * 6, { align: "right" });
  });

  const totalY = y + 7 + resumoItems.length * 6;
  setFill(LARANJA);
  doc.roundedRect(M + 4, totalY - 4, CW - 8, 10, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(BRANCO);
  doc.text("VALOR FINAL", M + 10, totalY + 3);
  doc.text(fmt(orc.valores.valorFinal), M + CW - 10, totalY + 3, { align: "right" });

  y = totalY + 14;

  // ========= ENDEREÇOS =========
  if (orc.enderecos.length > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    setColor(AZUL);
    doc.text("DETALHAMENTO DE PONTOS", M + 5, y + 5);
    y += 8;

    const endBody = orc.enderecos.map((e) => [
      String(e.sequencia),
      e.tipo === "coleta" ? "Coleta" : e.tipo === "entrega" ? "Entrega" : "Retorno",
      `${e.endereco}\n${e.cidade}/${e.uf}`,
      e.contato,
      e.janelaInicio && e.janelaFim ? `${e.janelaInicio} - ${e.janelaFim}` : "—",
    ]);

    autoTable(doc, {
      startY: y,
      head: [["#", "Tipo", "Endereço", "Contato", "Janela"]],
      body: endBody,
      margin: { left: M, right: M },
      styles: { fontSize: 7.5, cellPadding: 2.5, textColor: [50, 50, 50] },
      headStyles: { fillColor: AZUL as any, textColor: BRANCO as any, fontStyle: "bold", fontSize: 7.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 18 }, 4: { cellWidth: 28 } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ========= CARGA =========
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  setColor(AZUL);
  doc.text("INFORMAÇÕES DA CARGA", M + 5, y + 5);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [["Descrição", "Volumes", "Peso (kg)", "Cubagem (m³)", "Pallets", "Valor Declarado"]],
    body: [[orc.carga.descricao, String(orc.carga.volumes), String(orc.carga.peso), String(orc.carga.cubagem), String(orc.carga.pallets), fmt(orc.carga.valorDeclarado)]],
    margin: { left: M, right: M },
    styles: { fontSize: 7.5, cellPadding: 2.5, textColor: [50, 50, 50] },
    headStyles: { fillColor: AZUL as any, textColor: BRANCO as any, fontStyle: "bold", fontSize: 7.5 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ========= VEÍCULO =========
  if (orc.veiculo.tipo) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    setColor([60, 60, 60]);
    doc.text(`Veículo: ${orc.veiculo.tipo} | Subcategoria: ${orc.veiculo.subcategoria} | Carroceria: ${orc.veiculo.carroceria}`, M + 5, y);
    y += 8;
  }

  // ========= TOTALIZAÇÃO =========
  if (y > 230) { doc.addPage(); y = 20; }
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  setColor(AZUL);
  doc.text("TOTALIZAÇÃO", M + 5, y + 5);
  y += 8;

  const totBody = [
    ["Valor Base", fmt(orc.valores.valorBase)],
    ["Adicionais", fmt(orc.valores.adicionais)],
    ["Pedágio", fmt(orc.valores.pedagio)],
    ["Km Excedente", fmt(orc.valores.kmExcedente)],
    ["Ajudante", fmt(orc.valores.ajudante)],
    ["Devolução", fmt(orc.valores.devolucao)],
    ["Reentrega", fmt(orc.valores.reentrega)],
    ["Descontos", `(${fmt(orc.valores.descontos)})`],
  ];

  autoTable(doc, {
    startY: y,
    body: totBody,
    margin: { left: M, right: M },
    styles: { fontSize: 8, cellPadding: 2, textColor: [50, 50, 50] },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 80 }, 1: { halign: "right" } },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didDrawCell: (data: any) => {
      // No custom drawing needed
    },
  });
  y = (doc as any).lastAutoTable.finalY + 2;

  // Total highlight
  setFill(AZUL);
  doc.roundedRect(M, y, CW, 10, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(BRANCO);
  doc.text("TOTAL GERAL", M + 8, y + 7);
  doc.text(fmt(orc.valores.valorFinal), M + CW - 8, y + 7, { align: "right" });
  y += 16;

  // ========= CONDIÇÕES COMERCIAIS =========
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  setColor(AZUL);
  doc.text("CONDIÇÕES COMERCIAIS", M + 5, y + 5);
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setColor([60, 60, 60]);
  const condicoes = [
    `Tipo de Operação: ${orc.tipoOperacao}`,
    `Modalidade: ${orc.modalidade === "contrato" ? "Contrato" : "Esporádico"}`,
    `Prioridade: ${orc.prioridade}`,
    `Validade da Proposta: ${fmtDate(orc.validade)}`,
    orc.valores.tabelaVinculada ? `Tabela de Valores: ${orc.valores.tabelaVinculada}` : "",
  ].filter(Boolean);
  condicoes.forEach((c, i) => { doc.text(c, M + 5, y + i * 5); });
  y += condicoes.length * 5 + 4;

  // Observações
  if (orc.observacoesGerais) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    setColor(AZUL);
    doc.text("OBSERVAÇÕES", M + 5, y + 5);
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor([60, 60, 60]);
    const lines = doc.splitTextToSize(orc.observacoesGerais, CW - 10);
    doc.text(lines, M + 5, y);
    y += lines.length * 4 + 6;
  }

  // ========= ASSINATURAS =========
  if (y > 250) { doc.addPage(); y = 20; }
  y = Math.max(y, 245);
  const assinaturaY = y + 5;
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  // Left
  doc.line(M + 10, assinaturaY, M + 75, assinaturaY);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  setColor([60, 60, 60]);
  doc.text("Conexão Express Transportes", M + 42, assinaturaY + 5, { align: "center" });
  // Right
  doc.line(W - M - 75, assinaturaY, W - M - 10, assinaturaY);
  doc.text(orc.cliente || "Cliente", W - M - 42, assinaturaY + 5, { align: "center" });

  // ========= RODAPÉ =========
  const pH = 297;
  setFill(AZUL);
  doc.rect(0, pH - 14, W, 14, "F");
  setFill(LARANJA);
  doc.rect(0, pH - 14, W, 1.5, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  setColor([200, 210, 220]);
  doc.text("Conexão Express Transportes LTDA — CNPJ: 00.000.000/0001-00", W / 2, pH - 7, { align: "center" });
  doc.text("Conectando negócios com excelência logística", W / 2, pH - 3, { align: "center" });

  // Save
  doc.save(`${orc.numero}_Orcamento_Comercial.pdf`);
};
