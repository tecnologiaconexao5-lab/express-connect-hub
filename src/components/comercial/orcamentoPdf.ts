import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Orcamento, STATUS_CONFIG } from "./types";
import { LOGO_BASE64 } from "./logoBase64";

const AZUL = [15, 26, 46];
const LARANJA = [249, 115, 22];
const CINZA_CLARO = [248, 250, 252];
const BRANCO = [255, 255, 255];
const CNPJ_EMPRESA = "42.796.040/0001-31";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string) => {
  if (!d) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR");
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR");
  return dt.toLocaleDateString("pt-BR");
};

export const gerarPdfOrcamento = async (orc: Orcamento) => {
  const doc = new jsPDF("p", "mm", "a4");
  const W = 210;
  const M = 15;
  const CW = W - 2 * M;
  let y = 0;

  const setColor = (rgb: number[]) => { doc.setTextColor(rgb[0], rgb[1], rgb[2]); };
  const setFill = (rgb: number[]) => { doc.setFillColor(rgb[0], rgb[1], rgb[2]); };

  // Fetch logo-oficial-conexao.png
  let logoStr = null;
  try {
    const response = await fetch('/logo-oficial-conexao.png');
    if (response.ok) {
      const blob = await response.blob();
      logoStr = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }
  } catch (e) {
    console.warn("Logo não encontrado:", e);
  }

  // ========= HEADER BAR =========
  setFill(AZUL);
  doc.rect(0, 0, W, 42, "F");
  setFill(LARANJA);
  doc.rect(0, 42, W, 2.5, "F");

  // Logo
  if (logoStr) {
    try {
      doc.addImage(logoStr, "PNG", M, 8, 36, 12);
    } catch {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      setColor(BRANCO);
      doc.text("CONEXÃO EXPRESS", M, 18);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("TRANSPORTES & LOGÍSTICA", M, 24);
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    setColor(BRANCO);
    doc.text("CONEXÃO EXPRESS", M, 18);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("TRANSPORTES & LOGÍSTICA", M, 24);
  }

  // Right side - doc info
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  setColor(BRANCO);
  doc.text(`Orçamento ${orc.numero}`, W - M, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setColor([200, 215, 230]);
  doc.text(`Emissão: ${fmtDate(orc.dataEmissao)}`, W - M, 21, { align: "right" });
  doc.text(`Validade: ${fmtDate(orc.validade)}`, W - M, 27, { align: "right" });
  doc.text(`Status: ${STATUS_CONFIG[orc.status].label}`, W - M, 33, { align: "right" });

  y = 52;

  // ========= TÍTULO =========
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  setColor(AZUL);
  doc.text("ORÇAMENTO COMERCIAL", W / 2, y, { align: "center" });
  y += 4;
  setFill(LARANJA);
  doc.rect(W / 2 - 35, y, 70, 1, "F");
  y += 10;

  // ========= DADOS DO CLIENTE =========
  setFill([240, 244, 248]);
  doc.roundedRect(M, y, CW, 34, 2, 2, "F");
  doc.setDrawColor(220, 225, 230);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, CW, 34, 2, 2, "S");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  setColor(LARANJA);
  doc.text("DADOS DO CLIENTE", M + 5, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setColor([40, 40, 40]);

  const cnpjDisplay = orc.clienteCnpj && orc.clienteCnpj !== "00.000.000/0000-00" ? orc.clienteCnpj : "—";
  const clienteLines = [
    [`Cliente: ${orc.cliente || "—"}`, `CNPJ: ${cnpjDisplay}`],
    [`Unidade: ${orc.unidade || "—"}`, `Centro de Custo: ${orc.centroCusto || "—"}`],
    [`Responsável: ${orc.responsavel || "—"}`, `Modalidade: ${orc.modalidade === "contrato" ? "Contrato" : "Esporádico"}`],
  ];
  clienteLines.forEach((pair, i) => {
    doc.setFont("helvetica", "bold");
    const label1 = pair[0].split(":")[0] + ":";
    const val1 = pair[0].substring(label1.length).trim();
    doc.text(label1, M + 5, y + 14 + i * 6);
    doc.setFont("helvetica", "normal");
    doc.text(val1, M + 5 + doc.getTextWidth(label1) + 2, y + 14 + i * 6);

    doc.setFont("helvetica", "bold");
    const label2 = pair[1].split(":")[0] + ":";
    const val2 = pair[1].substring(label2.length).trim();
    doc.text(label2, M + CW / 2, y + 14 + i * 6);
    doc.setFont("helvetica", "normal");
    doc.text(val2, M + CW / 2 + doc.getTextWidth(label2) + 2, y + 14 + i * 6);
  });
  y += 40;

  // ========= RESUMO EXECUTIVO =========
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  setColor(LARANJA);
  doc.text("RESUMO EXECUTIVO", M + 5, y + 5);
  y += 9;

  const resumoItems = [
    { label: "Valor Transporte", value: fmt(orc.valores.valorBase), raw: orc.valores.valorBase },
    { label: "Pedágio", value: fmt(orc.valores.pedagio), raw: orc.valores.pedagio },
    { label: "Adicionais", value: fmt(orc.valores.adicionais), raw: orc.valores.adicionais },
    orc.valores.descontos > 0 ? { label: "Descontos", value: `- ${fmt(orc.valores.descontos)}`, raw: orc.valores.descontos } : null,
  ].filter((r): r is NonNullable<typeof r> => r !== null && r.raw !== 0);

  const boxH = resumoItems.length * 6.5 + 18;
  setFill([245, 248, 252]);
  doc.roundedRect(M, y, CW, boxH, 2, 2, "F");
  doc.setDrawColor(220, 225, 230);
  doc.roundedRect(M, y, CW, boxH, 2, 2, "S");

  doc.setFontSize(8.5);
  resumoItems.forEach((item, i) => {
    doc.setFont("helvetica", "normal");
    setColor([80, 80, 80]);
    doc.text(item.label, M + 10, y + 8 + i * 6.5);
    doc.setFont("helvetica", "bold");
    setColor([40, 40, 40]);
    doc.text(item.value, M + CW - 10, y + 8 + i * 6.5, { align: "right" });
  });

  const totalY = y + 8 + resumoItems.length * 6.5 + 1;
  setFill(LARANJA);
  doc.roundedRect(M + 4, totalY - 4, CW - 8, 11, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setColor(BRANCO);
  doc.text("VALOR FINAL", M + 12, totalY + 4);
  doc.text(fmt(orc.valores.valorFinal), M + CW - 12, totalY + 4, { align: "right" });

  y = totalY + 16;

  // ========= ENDEREÇOS =========
  if (orc.enderecos.length > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    setColor(LARANJA);
    doc.text("DETALHAMENTO DE PONTOS", M + 5, y + 5);
    y += 9;

    const endBody = orc.enderecos.map((e) => [
      String(e.sequencia),
      e.tipo === "coleta" ? "Coleta" : e.tipo === "entrega" ? "Entrega" : "Retorno",
      `${e.endereco}\n${e.cidade}/${e.uf}`,
      e.contato || "—",
      e.janelaInicio && e.janelaFim ? `${e.janelaInicio} - ${e.janelaFim}` : "—",
    ]);

    autoTable(doc, {
      startY: y,
      head: [["#", "Tipo", "Endereço", "Contato", "Janela"]],
      body: endBody,
      margin: { left: M, right: M },
      styles: { fontSize: 7.5, cellPadding: 3, textColor: [50, 50, 50], lineColor: [220, 225, 230], lineWidth: 0.2 },
      headStyles: { fillColor: AZUL as any, textColor: BRANCO as any, fontStyle: "bold", fontSize: 7.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 10, halign: "center" }, 1: { cellWidth: 20 }, 4: { cellWidth: 28 } },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ========= CARGA =========
  if (y > 235) { doc.addPage(); y = 20; }
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  setColor(LARANJA);
  doc.text("INFORMAÇÕES DA CARGA", M + 5, y + 5);
  y += 9;

  autoTable(doc, {
    startY: y,
    head: [["Descrição", "Volumes", "Peso (kg)", "Cubagem (m³)", "Pallets", "Valor Declarado"]],
    body: [[orc.carga.descricao || "—", String(orc.carga.volumes), String(orc.carga.peso), String(orc.carga.cubagem), String(orc.carga.pallets), fmt(orc.carga.valorDeclarado)]],
    margin: { left: M, right: M },
    styles: { fontSize: 7.5, cellPadding: 3, textColor: [50, 50, 50], lineColor: [220, 225, 230], lineWidth: 0.2 },
    headStyles: { fillColor: AZUL as any, textColor: BRANCO as any, fontStyle: "bold", fontSize: 7.5 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ========= VEÍCULO =========
  if (orc.veiculo.tipo) {
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    setColor([60, 60, 60]);
    const veicInfo = [`Veículo: ${orc.veiculo.tipo}`, orc.veiculo.subcategoria ? `Subcategoria: ${orc.veiculo.subcategoria}` : "", orc.veiculo.carroceria ? `Carroceria: ${orc.veiculo.carroceria}` : ""].filter(Boolean).join("  |  ");
    doc.text(veicInfo, M + 5, y);
    y += 8;
  }

  // ========= TOTALIZAÇÃO =========
  if (y > 220) { doc.addPage(); y = 20; }
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  setColor(LARANJA);
  doc.text("TOTALIZAÇÃO", M + 5, y + 5);
  y += 9;

  const totBody = [
    ["Valor Transporte", fmt(orc.valores.valorBase)],
    ["Pedágio", fmt(orc.valores.pedagio)],
    ["Adicionais", fmt(orc.valores.adicionais)],
    orc.valores.descontos > 0 ? ["Descontos", `- ${fmt(orc.valores.descontos)}`] : null,
  ].filter(Boolean) as string[][];

  autoTable(doc, {
    startY: y,
    body: totBody,
    margin: { left: M, right: M },
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [50, 50, 50], lineColor: [230, 233, 236], lineWidth: 0.15 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 80 }, 1: { halign: "right" } },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  y = (doc as any).lastAutoTable.finalY + 3;

  // Total highlight
  setFill(AZUL);
  doc.roundedRect(M, y, CW, 11, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setColor(BRANCO);
  doc.text("TOTAL GERAL", M + 10, y + 7.5);
  doc.text(fmt(orc.valores.valorFinal), M + CW - 10, y + 7.5, { align: "right" });
  y += 18;

  // ========= CONDIÇÕES COMERCIAIS =========
  if (y > 235) { doc.addPage(); y = 20; }
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  setColor(LARANJA);
  doc.text("CONDIÇÕES COMERCIAIS", M + 5, y + 5);
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setColor([60, 60, 60]);
  const condicoes = [
    orc.tipoOperacao ? `Tipo de Operação: ${orc.tipoOperacao}` : "",
    `Modalidade: ${orc.modalidade === "contrato" ? "Contrato" : "Esporádico"}`,
    `Prioridade: ${orc.prioridade}`,
    `Validade da Proposta: ${fmtDate(orc.validade)}`,
    orc.valores.tabelaVinculada ? `Tabela de Valores: ${orc.valores.tabelaVinculada}` : "",
  ].filter(Boolean);
  condicoes.forEach((c, i) => { doc.text(c, M + 5, y + i * 5.5); });
  y += condicoes.length * 5.5 + 4;

  // Observações
  if (orc.observacoesGerais) {
    if (y > 245) { doc.addPage(); y = 20; }
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    setColor(LARANJA);
    doc.text("OBSERVAÇÕES", M + 5, y + 5);
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setColor([60, 60, 60]);
    const lines = doc.splitTextToSize(orc.observacoesGerais, CW - 10);
    doc.text(lines, M + 5, y);
    y += lines.length * 4.5 + 6;
  }

  // ========= ASSINATURAS =========
  if (y > 245) { doc.addPage(); y = 20; }
  y = Math.max(y + 8, 245);
  const assinaturaY = y + 5;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(M + 10, assinaturaY, M + 80, assinaturaY);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  setColor([60, 60, 60]);
  doc.text("Conexão Express Transportes", M + 45, assinaturaY + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  setColor([120, 120, 120]);
  doc.text(`CNPJ: ${CNPJ_EMPRESA}`, M + 45, assinaturaY + 9, { align: "center" });

  doc.setDrawColor(180, 180, 180);
  doc.line(W - M - 80, assinaturaY, W - M - 10, assinaturaY);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  setColor([60, 60, 60]);
  doc.text(orc.cliente || "Cliente", W - M - 45, assinaturaY + 5, { align: "center" });
  if (orc.clienteCnpj && orc.clienteCnpj !== "00.000.000/0000-00") {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setColor([120, 120, 120]);
    doc.text(`CNPJ: ${orc.clienteCnpj}`, W - M - 45, assinaturaY + 9, { align: "center" });
  }

  // ========= RODAPÉ =========
  const pH = 297;
  setFill(AZUL);
  doc.rect(0, pH - 16, W, 16, "F");
  setFill(LARANJA);
  doc.rect(0, pH - 16, W, 1.5, "F");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  setColor([200, 210, 220]);
  doc.text(`Conexão Express Transportes LTDA — CNPJ: ${CNPJ_EMPRESA}`, W / 2, pH - 9, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  setColor([160, 175, 190]);
  doc.text("Conectando negócios com excelência logística", W / 2, pH - 4, { align: "center" });

  // Save
  doc.save(`${orc.numero}_Orcamento_Comercial.pdf`);
};
