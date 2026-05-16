import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const AZUL = [15, 26, 46];
const LARANJA = [249, 115, 22];
const CINZA_CLARO = [248, 250, 252];
const BRANCO = [255, 255, 255];
const TEXTO = [50, 50, 50];
const CNPJ_EMPRESA = "42.796.040/0001-31";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d?: string) => {
  try { return d ? new Date(d).toLocaleDateString("pt-BR") : "—"; } catch { return "—"; }
};

// ===================== BUSCAR LOGO =====================
const getLogoBase64 = async (isDark: boolean = false): Promise<string | null> => {
  try {
    // 1. Logo do sistema (configurado em localStorage)
    const stored = localStorage.getItem('empresa_identidade_visual');
    if (stored) {
      const config = JSON.parse(stored);
      const url = isDark ? config.logoDarkUrl : config.logoUrl;
      // Retorna se existir e se estiver marcado para uso em relatórios
      if (url && config.logoUsos?.relatoriosPdf !== false) {
        return url;
      }
      // Fallback para o outro logo se o solicitado não existir
      if (config.logoUrl && config.logoUsos?.relatoriosPdf !== false) return config.logoUrl;
    }
    
    // 2. Fallback local /logo-oficial-conexao.png
    const fallbackPath = '/logo-oficial-conexao.png';
    const response = await fetch(fallbackPath);

    if (response.ok) {
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }
  } catch (e) {
    console.warn("Logo não encontrado ou erro ao carregar:", e);
  }
  return null;
};



// ===================== HEADER PADRÃO =====================
const renderHeader = (doc: jsPDF, data: any, via: "Cliente" | "Prestador", logo: string | null = null) => {
  const W = 210;
  const H = 45; // Altura do cabeçalho azul
  
  // Faixa azul topo
  doc.setFillColor(AZUL[0], AZUL[1], AZUL[2]);
  doc.rect(0, 0, W, H, "F");
  
  // Faixa laranja (divisor)
  doc.setFillColor(LARANJA[0], LARANJA[1], LARANJA[2]);
  doc.rect(0, H, W, 2.5, "F");

  // --- LADO ESQUERDO: LOGO E DADOS EMPRESA ---
  if (logo) {
    try {
      // Logo proporcional e profissional (usar aspectRatio correto para não distorcer)
      // Ajuste premium corporativo
      doc.addImage(logo, "PNG", 15, 8, 48, 16);
    } catch (e) {
      renderLogoTexto(doc, 15, 18);
    }
  } else {
    renderLogoTexto(doc, 15, 18);
  }

  // Dados da Empresa (abaixo do logo)
  doc.setTextColor(230, 235, 245); // Branco/Cinza claro
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("TRANSPORTES & LOGÍSTICA", 15, 30);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`CNPJ: ${CNPJ_EMPRESA}`, 15, 35);
  doc.text("São Paulo / SP", 15, 39);
  doc.text("Contato: (11) 98765-4321", 15, 43);


  // --- LADO DIREITO: BLOCO DE INFORMAÇÕES DA OS ---
  const rightX = W - 12;
  doc.setTextColor(BRANCO[0], BRANCO[1], BRANCO[2]);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("ORDEM DE SERVIÇO", rightX, 12, { align: "right" });
  
  doc.setFontSize(11);
  doc.setTextColor(LARANJA[0], LARANJA[1], LARANJA[2]);
  doc.text(`OS-${data.numero || "0000"}`, rightX, 18, { align: "right" });
  
  doc.setTextColor(200, 210, 225);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Emissão: ${fmtDate(data.data)}`, rightX, 26, { align: "right" });
  doc.text(`Status: ${(data.status || "Pendente").toUpperCase()}`, rightX, 31, { align: "right" });
  
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRANCO[0], BRANCO[1], BRANCO[2]);
  doc.text(`Via: ${via}`, rightX, 38, { align: "right" });

  return H + 12; // y inicial após header
};

const renderLogoTexto = (doc: jsPDF, x: number, y: number) => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(BRANCO[0], BRANCO[1], BRANCO[2]);
  doc.text("CONEXÃO EXPRESS", x, y);
};



// ===================== BOX PADRÃO =====================
const renderBox = (doc: jsPDF, x: number, y: number, w: number, h: number) => {
  doc.setFillColor(CINZA_CLARO[0], CINZA_CLARO[1], CINZA_CLARO[2]);
  doc.roundedRect(x, y, w, h, 2, 2, "F");
  doc.setDrawColor(220, 225, 230);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2, 2, "S");
};

// ===================== PDF CLIENTE =====================
export const generatePDFCliente = async (data: any) => {
  const doc = new jsPDF("p", "mm", "a4");
  const logo = await getLogoBase64(true); // Usa versão white para o header azul

  
  const W = 210;
  const M = 15;
  const CW = W - 2 * M;
  let y = renderHeader(doc, data, "Cliente", logo);


  // Espaçamento inicial reduzido pois o header já tem as informações principais
  y -= 5;


  // Dados do Cliente
  renderBox(doc, M, y, CW, 30);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(LARANJA[0], LARANJA[1], LARANJA[2]);
  doc.text("DADOS DO CLIENTE", M + 5, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(TEXTO[0], TEXTO[1], TEXTO[2]);
  doc.text(`Cliente: ${data.cliente || "—"}`, M + 5, y + 14);
  doc.text(`Unidade: ${data.unidade || "—"}`, M + CW / 2, y + 14);
  doc.text(`Tipo de Operação: ${data.tipoOperacao || "—"}`, M + 5, y + 20);
  doc.text(`Responsável: ${data.responsavel || "—"}`, M + CW / 2, y + 20);
  y += 36;

  // Rota / Endereços
  if (data.enderecos?.length > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(LARANJA[0], LARANJA[1], LARANJA[2]);
    doc.text("ITINERÁRIO / ROTA", M + 5, y + 5);
    y += 9;

    const endBody = (data.enderecos || []).map((e: any, i: number) => [
      String(i + 1),
      e.tipo === "coleta" ? "Coleta" : e.tipo === "entrega" ? "Entrega" : "Parada",
      `${e.nomeLocal || ""} - ${e.endereco || ""}\n${e.cidade || ""}/${e.estado || ""}`,
      e.responsavel || "—",
      e.janelaInicio && e.janelaFim ? `${e.janelaInicio} - ${e.janelaFim}` : "—",
    ]);

    autoTable(doc, {
      startY: y,
      head: [["#", "Tipo", "Local / Endereço", "Contato", "Janela"]],
      body: endBody,
      margin: { left: M, right: M },
      styles: { fontSize: 7.5, cellPadding: 3, textColor: TEXTO, lineColor: [220, 225, 230], lineWidth: 0.2 },
      headStyles: { fillColor: AZUL, textColor: BRANCO, fontStyle: "bold", fontSize: 7.5 },
      alternateRowStyles: { fillColor: CINZA_CLARO },
      columnStyles: { 0: { cellWidth: 10, halign: "center" }, 1: { cellWidth: 20 }, 4: { cellWidth: 28 } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Carga
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(LARANJA[0], LARANJA[1], LARANJA[2]);
  doc.text("DETALHAMENTO DA CARGA", M + 5, y + 5);
  y += 9;

  autoTable(doc, {
    startY: y,
    head: [["Descrição", "Volumes", "Peso (kg)", "Cubagem (m³)", "Valor Declarado"]],
    body: [[
      data.carga?.descricao || "—",
      String(data.carga?.volumes || 0),
      String(data.carga?.peso || 0),
      String(data.carga?.cubagem || 0),
      fmt(data.carga?.valorDeclarado || 0),
    ]],
    margin: { left: M, right: M },
    styles: { fontSize: 7.5, cellPadding: 3, textColor: TEXTO, lineColor: [220, 225, 230], lineWidth: 0.2 },
    headStyles: { fillColor: AZUL, textColor: BRANCO, fontStyle: "bold", fontSize: 7.5 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Veículo
  if (data.veiculoTipo) {
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(TEXTO[0], TEXTO[1], TEXTO[2]);
    const veicInfo = [
      `Veículo: ${data.veiculoTipo}`,
      data.veiculoPlaca ? `Placa: ${data.veiculoPlaca}` : "",
      data.veiculoCarroceria ? `Carroceria: ${data.veiculoCarroceria}` : "",
    ].filter(Boolean).join("  |  ");
    doc.text(veicInfo, M + 5, y);
    y += 8;
  }

  // Valor (apenas para cliente)
  if (y > 240) { doc.addPage(); y = 20; }
  renderBox(doc, M, y, CW, 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(AZUL[0], AZUL[1], AZUL[2]);
  doc.text("VALOR", M + 10, y + 10);
  doc.text(fmt(data.valorCliente || 0), M + CW - 10, y + 10, { align: "right" });
  y += 22;

  // Instruções Operacionais
  if (data.instrucoesOperacionaisOS) {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(LARANJA[0], LARANJA[1], LARANJA[2]);
    doc.text("INSTRUÇÕES OPERACIONAIS", M + 5, y + 5);
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(TEXTO[0], TEXTO[1], TEXTO[2]);
    const lines = doc.splitTextToSize(data.instrucoesOperacionaisOS, CW - 10);
    doc.text(lines, M + 5, y);
    y += lines.length * 4.5 + 6;
  }

  // Assinaturas
  if (y > 245) { doc.addPage(); y = 20; }
  y = Math.max(y + 8, 245);
  const assY = y + 5;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(M + 10, assY, M + 80, assY);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(TEXTO[0], TEXTO[1], TEXTO[2]);
  doc.text("Conexão Express", M + 45, assY + 5, { align: "center" });
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`CNPJ: ${CNPJ_EMPRESA}`, M + 45, assY + 9, { align: "center" });

  doc.line(W - M - 80, assY, W - M - 10, assY);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(data.cliente || "Cliente", W - M - 45, assY + 5, { align: "center" });

  // Rodapé
  const pH = 297;
  doc.setFillColor(AZUL[0], AZUL[1], AZUL[2]);
  doc.rect(0, pH - 16, W, 16, "F");
  doc.setFillColor(LARANJA[0], LARANJA[1], LARANJA[2]);
  doc.rect(0, pH - 16, W, 1.5, "F");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(200, 210, 220);
  doc.text(`Conexão Express Transportes LTDA — CNPJ: ${CNPJ_EMPRESA}`, W / 2, pH - 9, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(160, 175, 190);
  doc.text("Conectando negócios com excelência logística", W / 2, pH - 4, { align: "center" });

  doc.save(`OS_CLIENTE_${data.numero || "0000"}.pdf`);
};

// ===================== PDF PRESTADOR =====================
export const generatePDFPrestador = async (data: any) => {
  const doc = new jsPDF("p", "mm", "a4");
  const logo = await getLogoBase64(true); // Usa versão white para o header azul


  const W = 210;
  const M = 15;
  const CW = W - 2 * M;
  let y = renderHeader(doc, data, "Prestador", logo);


  // Espaçamento inicial reduzido
  y -= 5;


  // Dados do Prestador
  if (data.prestador) {
    renderBox(doc, M, y, CW, 18);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(LARANJA[0], LARANJA[1], LARANJA[2]);
    doc.text("PRESTADOR", M + 5, y + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(TEXTO[0], TEXTO[1], TEXTO[2]);
    doc.text(data.prestador, M + 5, y + 14);
    y += 24;
  }

  // Veículo
  if (data.veiculoTipo) {
    renderBox(doc, M, y, CW, 18);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(LARANJA[0], LARANJA[1], LARANJA[2]);
    doc.text("DADOS DO VEÍCULO", M + 5, y + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(TEXTO[0], TEXTO[1], TEXTO[2]);
    const veicInfo = [
      `Tipo: ${data.veiculoTipo}`,
      data.veiculoPlaca ? `Placa: ${data.veiculoPlaca}` : "",
      data.veiculoCarroceria ? `Carroceria: ${data.veiculoCarroceria}` : "",
      data.veiculoTermica ? `Termica: ${data.veiculoTermica}` : "",
    ].filter(Boolean).join("  |  ");
    doc.text(veicInfo, M + 5, y + 14);
    y += 24;
  }

  // Rota completa
  if (data.enderecos?.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(LARANJA[0], LARANJA[1], LARANJA[2]);
    doc.text("ITINERÁRIO COMPLETO", M + 5, y + 5);
    y += 9;

    const endBody = (data.enderecos || []).map((e: any, i: number) => [
      String(i + 1),
      e.tipo === "coleta" ? "Coleta" : e.tipo === "entrega" ? "Entrega" : "Parada",
      `${e.nomeLocal || ""}\n${e.endereco || ""}\n${e.cidade || ""}/${e.estado || ""}`,
      `${e.responsavel || "—"}\n${e.telefone || ""}`,
      e.janelaInicio && e.janelaFim ? `${e.janelaInicio} - ${e.janelaFim}` : "—",
    ]);

    autoTable(doc, {
      startY: y,
      head: [["#", "Tipo", "Local / Endereço Completo", "Contato", "Janela"]],
      body: endBody,
      margin: { left: M, right: M },
      styles: { fontSize: 7.5, cellPadding: 3, textColor: TEXTO, lineColor: [220, 225, 230], lineWidth: 0.2 },
      headStyles: { fillColor: AZUL, textColor: BRANCO, fontStyle: "bold", fontSize: 7.5 },
      alternateRowStyles: { fillColor: CINZA_CLARO },
      columnStyles: { 0: { cellWidth: 10, halign: "center" }, 1: { cellWidth: 20 }, 2: { cellWidth: 80 }, 4: { cellWidth: 28 } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Carga
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(LARANJA[0], LARANJA[1], LARANJA[2]);
  doc.text("DETALHAMENTO DA CARGA", M + 5, y + 5);
  y += 9;

  autoTable(doc, {
    startY: y,
    head: [["Descrição", "Volumes", "Peso (kg)", "Cubagem (m³)", "Valor Declarado"]],
    body: [[
      data.carga?.descricao || "—",
      String(data.carga?.volumes || 0),
      String(data.carga?.peso || 0),
      String(data.carga?.cubagem || 0),
      fmt(data.carga?.valorDeclarado || 0),
    ]],
    margin: { left: M, right: M },
    styles: { fontSize: 7.5, cellPadding: 3, textColor: TEXTO, lineColor: [220, 225, 230], lineWidth: 0.2 },
    headStyles: { fillColor: AZUL, textColor: BRANCO, fontStyle: "bold", fontSize: 7.5 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Valor que será pago (nunca "Repasse" ou "Valor Cliente")
  if (y > 240) { doc.addPage(); y = 20; }
  renderBox(doc, M, y, CW, 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(AZUL[0], AZUL[1], AZUL[2]);
  doc.text("VALOR QUE SERÁ PAGO", M + 10, y + 10);
  doc.text(fmt(data.custoPrestador || 0), M + CW - 10, y + 10, { align: "right" });
  y += 22;

  // Instruções ao Prestador
  if (data.instrucoesOperacionaisOS) {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(LARANJA[0], LARANJA[1], LARANJA[2]);
    doc.text("INSTRUÇÕES AO PRESTADOR", M + 5, y + 5);
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(TEXTO[0], TEXTO[1], TEXTO[2]);
    const lines = doc.splitTextToSize(data.instrucoesOperacionaisOS, CW - 10);
    doc.text(lines, M + 5, y);
    y += lines.length * 4.5 + 6;
  }

  // Assinatura Prestador
  if (y > 245) { doc.addPage(); y = 20; }
  y = Math.max(y + 8, 245);
  const assY = y + 5;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(M + 10, assY, M + 80, assY);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(TEXTO[0], TEXTO[1], TEXTO[2]);
  doc.text("Conexão Express", M + 45, assY + 5, { align: "center" });
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`CNPJ: ${CNPJ_EMPRESA}`, M + 45, assY + 9, { align: "center" });

  doc.line(W - M - 80, assY, W - M - 10, assY);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(data.prestador || "Prestador", W - M - 45, assY + 5, { align: "center" });

  // Rodapé
  const pH = 297;
  doc.setFillColor(AZUL[0], AZUL[1], AZUL[2]);
  doc.rect(0, pH - 16, W, 16, "F");
  doc.setFillColor(LARANJA[0], LARANJA[1], LARANJA[2]);
  doc.rect(0, pH - 16, W, 1.5, "F");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(200, 210, 220);
  doc.text(`Conexão Express Transportes LTDA — CNPJ: ${CNPJ_EMPRESA}`, W / 2, pH - 9, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(160, 175, 190);
  doc.text("Conectando negócios com excelência logística", W / 2, pH - 4, { align: "center" });

  doc.save(`OS_PRESTADOR_${data.numero || "0000"}.pdf`);
};

// ===================== WHATSAPP =====================
export const gerarMensagemWhatsAppOS = (data: any): string => {
  const enderecos = data.enderecos || [];
  const origem = enderecos.find((e: any) => e.tipo === "coleta") || enderecos[0];
  const destino = [...enderecos].reverse().find((e: any) => e.tipo === "entrega") || enderecos[enderecos.length - 1];

  let msg = `🚚 *OS ${data.numero || 'N/A'} - ${data.tipoOperacao || 'Serviço'}*\n\n`;
  msg += `📦 *CARGA*: ${data.carga?.tipo || 'Seca'} | ${data.carga?.volumes || 0} vol | ${data.carga?.peso || 0} kg\n`;
  msg += `🚛 *VEÍCULO*: ${data.veiculoTipo?.toUpperCase() || 'Não definido'} | Placa: ${data.veiculoPlaca || 'Pendente'}\n\n`;

  if (enderecos.length > 0) {
    msg += `📍 *ITINERÁRIO*:\n`;
    enderecos.forEach((end: any, idx: number) => {
      const icon = end.tipo === 'coleta' ? '1️⃣ RETIRAR' : end.tipo === 'entrega' ? `${idx + 1}️⃣ ENTREGAR` : `${idx + 1}️⃣ PARADA`;
      msg += `*${icon}*\n`;
      msg += `${end.nomeLocal ? end.nomeLocal + ' - ' : ''}${end.endereco || 'Endereço não informado'}\n`;
      if (end.responsavel) msg += `👤 Contato: ${end.responsavel}${end.telefone ? ' (' + end.telefone + ')' : ''}\n`;
      if (idx < enderecos.length - 1) msg += `\n`;
    });
    msg += `\n`;
  }

  msg += `🛣️ *DISTÂNCIA*: ${data.distanciaRota?.distanciaKm?.toFixed(1) || data.distanciaKm || 0} km\n`;
  msg += `⏱️ *TEMPO ESTIMADO*: ${data.distanciaRota?.duracaoTexto || data.tempoEstimado || "—"}\n\n`;
  
  msg += `💰 *VALOR QUE SERÁ PAGO*: R$ ${(data.custoPrestador || 0).toFixed(2)}\n`;
  if (data.pedagio > 0) msg += `💳 Pedágio: R$ ${data.pedagio.toFixed(2)}\n`;
  msg += `💳 Pagamento: ${data.statusFaturamento || "Pendente"}\n\n`;

  msg += `📝 *INSTRUÇÕES*:\n${data.instrucoesOperacionaisOS || "Sem instruções adicionais."}`;

  return msg;
};

export const copiarWhatsApp = () => {
  const msg = "Para usar, chame gerarMensagemWhatsAppOS(data) com os dados da OS";
  navigator.clipboard.writeText(msg);
};

export const generateProfessionalPDF = async (data: any, type: "ORÇAMENTO" | "ORDEM DE SERVIÇO") => {
  await generatePDFCliente(data);
};
