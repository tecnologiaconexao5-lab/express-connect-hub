import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { Orcamento, STATUS_CONFIG } from "./types";
import { resolverValorFinal } from "./orcamentoCalculo";
import { LOGO_BASE64 } from "./logoBase64";

const AZUL = [15, 26, 46];
const LARANJA = [249, 115, 22];
const BRANCO = [255, 255, 255];
const CNPJ_EMPRESA = "31.227.975/0001-80";

// TMS-COM-ORC-04 — diagramação compacta (cabe 1 página no caso base) mantendo
// legibilidade; paginação automática preservada para orçamentos maiores.
const HEADER_H = 32;
const FOOTER_H = 12;
const PH = 297;
const W = 210;
const M = 15;
const CW = W - 2 * M;
const CONTENT_BOTTOM = PH - FOOTER_H - 8; // ~277

const fmt = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// TMS-COM-ORC-02/03 — data ausente/inválida NÃO vira data futura fictícia.
const fmtDate = (d: string) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR");
};

// TMS-COM-ORC-03/04 — nunca imprimir "undefined"/"null"/"NaN".
const txt = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s === "" || s === "undefined" || s === "null" || s === "NaN" ? "—" : s;
};

// TMS-COM-ORC-04 — normalização SOMENTE visual (não altera enum/banco).
const cap = (v: unknown): string => {
  const t = txt(v);
  if (t === "—") return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
};

// Número opcional: 0/ausente => "—" (evita poluição visual e valores falsos).
const numOrDash = (v: unknown): string => {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return "—";
  return n.toLocaleString("pt-BR");
};

const moneyOrDash = (v: unknown): string => {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return "—";
  return fmt(n);
};

const veiculoLabel = (tipo: string): string => {
  const map: Record<string, string> = {
    van: "Van / Utilitário",
    vuc: "VUC",
    caminhao_3_4: "Caminhão 3/4",
    toco: "Caminhão Toco",
    truck: "Caminhão Truck",
    carreta: "Carreta",
    bitrem: "Bitrem",
    rodotrem: "Rodotrem",
    fiorino: "Fiorino",
    hr: "HR",
  };
  return map[tipo] || txt(tipo);
};

/**
 * Constrói o PDF (sem salvar) — permite uso em Node/E2E e reuso pelo browser.
 */
export const construirPdfOrcamento = async (orc: Orcamento): Promise<jsPDF> => {
  const doc = new jsPDF("p", "mm", "a4");

  const setColor = (rgb: number[]) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setFill = (rgb: number[]) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);

  const valores = orc.valores || ({} as Orcamento["valores"]);
  const carga = orc.carga || ({} as Orcamento["carga"]);
  const veiculo = orc.veiculo || ({} as Orcamento["veiculo"]);
  const enderecos = Array.isArray(orc.enderecos) ? orc.enderecos : [];

  // ---- Logo: tenta arquivo estático; fallback embutido (nunca sem logo) ----
  // TMS-COM-ORC-05B — usar a variante CLARA (fundo azul-marinho) já adotada
  // por outros PDFs. Fallback embutido (LOGO_BASE64) permanece se o fetch falhar.
  let logoStr: string | null = LOGO_BASE64 || null;
  try {
    const response = await fetch("/logos/logo-conexao-oficial.png");
    if (response.ok) {
      const blob = await response.blob();
      logoStr = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }
  } catch {
    /* usa fallback LOGO_BASE64 */
  }

  // ============================ CABEÇALHO (compacto) ============================
  setFill(AZUL);
  doc.rect(0, 0, W, HEADER_H, "F");
  setFill(LARANJA);
  doc.rect(0, HEADER_H, W, 2, "F");

  if (logoStr) {
    try {
      doc.addImage(logoStr, "PNG", M, 6, 42, 14);
    } catch {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      setColor(BRANCO);
      doc.text("CONEXÃO EXPRESS", M, 15);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("TRANSPORTES & LOGÍSTICA", M, 20.5);
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    setColor(BRANCO);
    doc.text("CONEXÃO EXPRESS", M, 15);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("TRANSPORTES & LOGÍSTICA", M, 20.5);
  }

  doc.setFontSize(10.5);
  doc.setFont("helvetica", "bold");
  setColor(BRANCO);
  doc.text(`Orçamento ${txt(orc.numero)}`, W - M, 10.5, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setColor([200, 215, 230]);
  doc.text(`Emissão: ${fmtDate(orc.dataEmissao)}`, W - M, 16.5, { align: "right" });
  doc.text(`Validade: ${fmtDate(orc.validade)}`, W - M, 22, { align: "right" });
  doc.text(`Status: ${STATUS_CONFIG[orc.status]?.label || txt(orc.status)}`, W - M, 27.5, { align: "right" });

  // ============================ TÍTULO (compacto) ============================
  let y = HEADER_H + 13;
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  setColor(AZUL);
  doc.text("ORÇAMENTO COMERCIAL", W / 2, y, { align: "center" });
  y += 3;
  setFill(LARANJA);
  doc.rect(W / 2 - 32, y, 64, 0.9, "F");
  y += 7;

  const ensureSpace = (needed: number) => {
    if (y + needed > CONTENT_BOTTOM) { doc.addPage(); y = 24; }
  };
  const sectionTitle = (label: string, needed = 18) => {
    ensureSpace(needed);
    doc.setFontSize(8.6);
    doc.setFont("helvetica", "bold");
    setColor(LARANJA);
    doc.text(label, M + 2, y);
    y += 5;
  };

  const plainTable = (body: string[][], columnStyles: Record<number, any>, foot?: any) =>
    autoTable(doc, {
      startY: y,
      body,
      foot,
      margin: { left: M, right: M },
      theme: "plain",
      styles: { fontSize: 8, cellPadding: { top: 1.2, bottom: 1.2, left: 3, right: 3 }, textColor: [40, 40, 40], lineColor: [228, 232, 236], lineWidth: 0.15 },
      columnStyles,
    });

  // ============================ 1. DADOS DO CLIENTE ============================
  sectionTitle("1. DADOS DO CLIENTE", 22);
  const cnpjDisplay = orc.clienteCnpj && orc.clienteCnpj !== "00.000.000/0000-00" ? orc.clienteCnpj : "—";
  plainTable(
    [
      ["Cliente", txt(orc.cliente), "CNPJ", cnpjDisplay],
      ["Unidade", txt(orc.unidade), "Centro de Custo", txt(orc.centroCusto)],
      ["Responsável", txt(orc.responsavel), "Modalidade", orc.modalidade === "contrato" ? "Contrato" : "Esporádico"],
      ["Tipo de Operação", txt(orc.tipoOperacao), "Prioridade", cap(orc.prioridade)],
    ],
    { 0: { fontStyle: "bold", cellWidth: 30, textColor: AZUL as any }, 1: { cellWidth: (CW - 60) / 2 }, 2: { fontStyle: "bold", cellWidth: 30, textColor: AZUL as any }, 3: { cellWidth: (CW - 60) / 2 } }
  );
  y = (doc as any).lastAutoTable.finalY + 5;

  // ============================ 2. INFORMAÇÕES DA CARGA ============================
  sectionTitle("2. INFORMAÇÕES DA CARGA", 20);
  const cargaExtras = [carga.refrigerado ? "Refrigerado" : "", carga.ajudante ? "Com ajudante" : ""].filter(Boolean).join(" · ");
  autoTable(doc, {
    startY: y,
    head: [["Descrição", "Volumes", "Peso (kg)", "Cubagem (m³)", "Pallets", "Valor Declarado"]],
    body: [[txt(carga.descricao), numOrDash(carga.volumes), numOrDash(carga.peso), numOrDash(carga.cubagem), numOrDash(carga.pallets), moneyOrDash(carga.valorDeclarado)]],
    foot: cargaExtras ? [[{ content: `Condições: ${cargaExtras}`, colSpan: 6, styles: { fontStyle: "italic", textColor: [90, 90, 90] } }]] : undefined,
    margin: { left: M, right: M },
    styles: { fontSize: 7.8, cellPadding: 1.8, textColor: [50, 50, 50], lineColor: [220, 225, 230], lineWidth: 0.2, halign: "center" },
    headStyles: { fillColor: AZUL as any, textColor: BRANCO as any, fontStyle: "bold", fontSize: 7.8 },
    columnStyles: { 0: { halign: "left" } },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  // ============================ 3. OPERAÇÃO / VEÍCULO ============================
  sectionTitle("3. OPERAÇÃO / VEÍCULO", 18);
  const veicBody: string[][] = [];
  // TMS-COM-CARGA-01 — o PDF exibe o veículo RECOMENDADO (capacidade), com
  // fallback para o veículo selecionado. Sem redesenho do layout.
  const veiculoExibicao = (veiculo as any).recomendado || veiculo.tipo;
  veicBody.push(["Veículo recomendado para a operação", veiculoExibicao ? veiculoLabel(veiculoExibicao) : "—", "Subcategoria", veiculo.subcategoria ? cap(veiculo.subcategoria) : "—"]);
  veicBody.push(["Carroceria", veiculo.carroceria ? cap(veiculo.carroceria) : "—", "Distância estimada", txt(orc.distancia_rota?.distancia_texto)]);
  // TMS-ORC-PDF-01 — a duracao da rota sai daqui e permanece na tela do formulario.
  plainTable(veicBody, { 0: { fontStyle: "bold", cellWidth: 52, textColor: AZUL as any }, 1: { cellWidth: (CW - 104) / 2 + 20 }, 2: { fontStyle: "bold", cellWidth: 38, textColor: AZUL as any } });
  y = (doc as any).lastAutoTable.finalY + 5;

  // ============================ 4. COLETA E ENTREGA / PONTOS ============================
  if (enderecos.length > 0) {
    sectionTitle("4. COLETA E ENTREGA / PONTOS", 24);
    const endBody = enderecos.map((e: any, idx: number) => {
      const linha1 = e.endereco || [e.logradouro, e.numero].filter(Boolean).join(", ");
      const bairro = e.bairro ? ` — ${e.bairro}` : "";
      const enderecoTexto = txt(`${linha1 || ""}${bairro}`.trim());
      const cidadeUf = [e.cidade, e.uf || e.estado].filter(Boolean).join("/");
      const contato = txt(e.responsavel || e.contato || e.telefone);
      const janela = e.janelaInicio && e.janelaFim ? `${e.janelaInicio} - ${e.janelaFim}` : "—";
      return [
        String(e.sequencia ?? idx + 1),
        e.tipo === "coleta" ? "Coleta" : e.tipo === "entrega" ? "Entrega" : "Retorno",
        `${enderecoTexto}${cidadeUf ? `\n${cidadeUf}` : ""}`,
        contato,
        janela,
      ];
    });
    autoTable(doc, {
      startY: y,
      head: [["#", "Tipo", "Endereço", "Contato", "Janela"]],
      body: endBody,
      margin: { left: M, right: M },
      styles: { fontSize: 7.4, cellPadding: 1.8, textColor: [50, 50, 50], lineColor: [220, 225, 230], lineWidth: 0.2 },
      headStyles: { fillColor: AZUL as any, textColor: BRANCO as any, fontStyle: "bold", fontSize: 7.8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 9, halign: "center" }, 1: { cellWidth: 17 }, 4: { cellWidth: 26 } },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  }

  // ============================ 5. RESUMO FINANCEIRO ============================
  sectionTitle("5. RESUMO FINANCEIRO", 26);
  // TMS-ORC-PDF-01 — nomenclatura profissional da primeira linha do resumo.
  const linhasFin: string[][] = [["Valor Base do Frete", fmt(Number(valores.valorBase) || 0)]];
  const extrasFin: [string, number][] = [
    ["Adicionais", Number(valores.adicionais) || 0],
    ["Pedágio", Number(valores.pedagio) || 0],
    ["Km Excedente", Number(valores.kmExcedente) || 0],
    ["Ajudante", Number(valores.ajudante) || 0],
    ["Devolução", Number(valores.devolucao) || 0],
    ["Reentrega", Number(valores.reentrega) || 0],
  ];
  for (const [label, v] of extrasFin) if (v > 0) linhasFin.push([label, fmt(v)]);
  if ((Number(valores.descontos) || 0) > 0) linhasFin.push(["Descontos", `- ${fmt(Number(valores.descontos))}`]);

  plainTable(linhasFin, { 0: { fontStyle: "bold", cellWidth: 90, textColor: [80, 80, 80] as any }, 1: { halign: "right" } });
  y = (doc as any).lastAutoTable.finalY + 1.5;

  ensureSpace(12);
  setFill(LARANJA);
  doc.roundedRect(M, y, CW, 10, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  setColor(BRANCO);
  // TMS-ORC-PDF-01 — total pela regra canônica (linha legada pode ter valorFinal=0).
  doc.text("VALOR FINAL DA PROPOSTA", M + 6, y + 6.8);
  doc.text(fmt(resolverValorFinal(valores)), M + CW - 6, y + 6.8, { align: "right" });
  y += 14;

  // ============================ 6. CONDIÇÕES / OBSERVAÇÕES ============================
  const condicoes = [
    orc.tipoOperacao ? `Tipo de Operação: ${orc.tipoOperacao}` : "",
    `Modalidade: ${orc.modalidade === "contrato" ? "Contrato" : "Esporádico"}`,
    orc.prioridade ? `Prioridade: ${cap(orc.prioridade)}` : "",
    `Validade da Proposta: ${fmtDate(orc.validade)}`,
    valores.tabelaVinculada ? `Tabela de Valores: ${valores.tabelaVinculada}` : "",
  ].filter(Boolean);
  sectionTitle("6. CONDIÇÕES COMERCIAIS", condicoes.length * 4.2 + (orc.observacoesGerais ? 12 : 4));
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setColor([60, 60, 60]);
  condicoes.forEach((c, i) => doc.text(`•  ${c}`, M + 2, y + i * 4.2));
  y += condicoes.length * 4.2 + 3;

  if (orc.observacoesGerais) {
    ensureSpace(12);
    doc.setFontSize(8.6);
    doc.setFont("helvetica", "bold");
    setColor(LARANJA);
    doc.text("OBSERVAÇÕES", M + 2, y);
    y += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor([60, 60, 60]);
    const lines = doc.splitTextToSize(orc.observacoesGerais, CW - 4);
    doc.text(lines, M + 2, y);
    y += lines.length * 4 + 4;
  }

  // ============================ ASSINATURAS (logo após o conteúdo) ============================
  ensureSpace(20);
  y += 6;
  const assinaturaY = y;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(M + 10, assinaturaY, M + 80, assinaturaY);
  doc.setFontSize(7.6);
  doc.setFont("helvetica", "bold");
  setColor([60, 60, 60]);
  doc.text("Conexão Express Transportes", M + 45, assinaturaY + 4.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  setColor([120, 120, 120]);
  doc.text(`CNPJ: ${CNPJ_EMPRESA}`, M + 45, assinaturaY + 8, { align: "center" });

  doc.line(W - M - 80, assinaturaY, W - M - 10, assinaturaY);
  doc.setFontSize(7.6);
  doc.setFont("helvetica", "bold");
  setColor([60, 60, 60]);
  doc.text(txt(orc.cliente), W - M - 45, assinaturaY + 4.5, { align: "center" });
  if (orc.clienteCnpj && orc.clienteCnpj !== "00.000.000/0000-00") {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    setColor([120, 120, 120]);
    doc.text(`CNPJ: ${orc.clienteCnpj}`, W - M - 45, assinaturaY + 8, { align: "center" });
  }

  // ============================ RODAPÉ (todas as páginas) ============================
  const totalPaginas = doc.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    setFill(AZUL);
    doc.rect(0, PH - FOOTER_H, W, FOOTER_H, "F");
    setFill(LARANJA);
    doc.rect(0, PH - FOOTER_H, W, 1.2, "F");
    doc.setFontSize(6.8);
    doc.setFont("helvetica", "bold");
    setColor([200, 210, 220]);
    doc.text(`Conexão Express Transportes LTDA — CNPJ: ${CNPJ_EMPRESA}`, W / 2, PH - 6.8, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.4);
    setColor([160, 175, 190]);
    doc.text(`Conectando negócios com excelência logística  •  Página ${p} de ${totalPaginas}`, W / 2, PH - 3.2, { align: "center" });
  }
  doc.setPage(1);

  return doc;
};

/** Gera e baixa o PDF (nome profissional; sem UUID). */
export const gerarPdfOrcamento = async (orc: Orcamento) => {
  const doc = await construirPdfOrcamento(orc);
  // TMS-COM-ORC-02/03/04 — filename preservado; fallback seguro se numero ausente.
  doc.save(`${orc.numero || "ORC"}_Orcamento_Comercial.pdf`);
};
