import jsPDF from "jspdf";

const fmt = (v: number) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";
const fmtKg = (v: number) => `${v?.toLocaleString("pt-BR") || "0"} kg`;

function drawWatermark(doc: jsPDF, text: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.saveGraphicsState();
  doc.setGState(new doc.GState({ opacity: 0.06 }));
  doc.setFontSize(72);
  doc.setTextColor(255, 0, 0);
  doc.setFont("helvetica", "bold");
  const angle = -40;
  const x = pageW / 2 - 100;
  const y = pageH / 2 + 20;
  doc.text(text, x, y, { angle, align: "center" });
  doc.restoreGraphicsState();
}

function drawHeader(doc: jsPDF, cte: any) {
  const pf = cte.metadata?.payload_focus || {};
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text("CONEXAO SERVICOS EXPRESS LTDA", 14, 15);
  doc.setFontSize(7);
  doc.text(`CNPJ: ${pf.emitente?.cnpj || "N/D"}`, 14, 20);
  doc.setFontSize(11);
  doc.setTextColor(180, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text("PREVIA DO CT-e — SEM VALOR FISCAL", 14, 28);
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.setFont("helvetica", "normal");
  doc.text("NAO AUTORIZADO SEFAZ — Documento interno de conferencia", 14, 33);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 37);
  doc.setDrawColor(200, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(14, 40, doc.internal.pageSize.getWidth() - 14, 40);
  return 44;
}

function drawSection(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text(title, 14, y);
  doc.setDrawColor(180, 180, 180);
  doc.line(14, y + 2, doc.internal.pageSize.getWidth() - 14, y + 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  return y + 8;
}

function drawField(doc: jsPDF, label: string, value: string, x: number, y: number, w: number) {
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(6);
  doc.text(label, x, y);
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(8);
  doc.text(value || "-", x, y + 5, { maxWidth: w - 2 });
}

export function gerarPdfPreviaCteSemValorFiscal(cte: any): jsPDF {
  const pf = cte.metadata?.payload_focus || {};
  const real = cte.metadata?.endereco_real_entrega_usado || cte.metadata?.endereco_real_entrega || {};
  const rateio = cte.metadata?.rateio || {};
  const docs = pf.documentos_vinculados || [];
  const primeiroDoc = docs[0] || {};

  const origemCidade = pf.origem?.cidade
    || cte.metadata?.origem_municipio
    || pf.emitente?.endereco?.cidade
    || cte.metadata?.emitente_cidade
    || null;

  const origemUf = pf.origem?.uf
    || cte.metadata?.origem_uf
    || pf.emitente?.endereco?.uf
    || cte.metadata?.emitente_uf
    || null;

  const tomadorNome = pf.tomador?.nome
    || cte.metadata?.tomador_nome
    || cte.metadata?.cliente_nome
    || null;

  const cfop = pf.fiscal?.cfop || pf.carga?.cfop || cte.metadata?.cfop || null;

  const doc = new jsPDF("p", "mm", "a4");
  const pageW = doc.internal.pageSize.getWidth();

  let y = drawHeader(doc, cte);
  drawWatermark(doc, "SEM VALOR FISCAL");

  // Dados do CT-e
  y = drawSection(doc, "DADOS DO CT-e", y);
  const col1 = 14, col2 = pageW / 2 + 5;
  drawField(doc, "Tipo CT-e", "Normal", col1, y, 60);
  drawField(doc, "Modal", "Rodoviario", col2, y, 60);
  drawField(doc, "CFOP", cfop || "-", col1, y + 14, 60);
  drawField(doc, "Natureza Operacao", pf.fiscal?.natureza_operacao || pf.carga?.natureza_operacao || cte.metadata?.natureza_operacao || "-", col2, y + 14, 60);
  drawField(doc, "Origem", `${origemCidade || "-"}/${origemUf || "-"}`, col1, y + 28, 60);
  drawField(doc, "Destino", `${pf.destino?.cidade || "-"}/${pf.destino?.uf || "-"}`, col2, y + 28, 60);
  drawField(doc, "Valor do Frete", fmt(cte.valor || pf.valores?.valor_total || 0), col1, y + 42, 60);
  drawField(doc, "Tomador", tomadorNome || "-", col2, y + 42, 60);
  y += 58;

  // Remetente
  y = drawSection(doc, "REMETENTE", y);
  drawField(doc, "Nome", tomadorNome || pf.emitente?.nome || "-", col1, y, pageW - 28);
  drawField(doc, "CNPJ", pf.tomador?.cnpj || "-", col1, y + 12, 60);
  drawField(doc, "Endereco Origem", "Rua Jamil Joao Zarif, 684 — Guarulhos/SP", col2, y + 12, 80);
  y += 24;

  // Destinatario
  y = drawSection(doc, "DESTINATARIO / ENTREGA", y);
  drawField(doc, "Nome", pf.destinatario?.cidade ? `Entrega em ${pf.destinatario.cidade}/${pf.destinatario.uf || ""}` : (real.municipio ? `Entrega em ${real.municipio}/${real.uf || ""}` : "-"), col1, y, pageW - 28);
  drawField(doc, "Endereco Fiscal XML", `${primeiroDoc.numero ? `NF-e ${primeiroDoc.numero}` : ""}`, col1, y + 12, 80);
  drawField(doc, "Endereco Real Entrega", real.logradouro
    ? [real.logradouro, real.numero ? `, ${real.numero}` : "", real.bairro ? `, ${real.bairro}` : "", real.municipio ? `, ${real.municipio}/${real.uf || ""}` : "", real.cep ? ` CEP ${real.cep}` : ""].join("")
    : "-", col2, y + 12, 80);
  drawField(doc, "Municipio Destino Prestacao", `${pf.destino?.cidade || real.municipio || "-"}/${pf.destino?.uf || real.uf || ""}`, col1, y + 26, 80);
  y += 40;

  // Documento Originario
  y = drawSection(doc, "DOCUMENTO ORIGINARIO", y);
  drawField(doc, "Tipo", "NF-e", col1, y, 40);
  drawField(doc, "Numero", primeiroDoc.numero || "-", col1 + 50, y, 40);
  drawField(doc, "Serie", primeiroDoc.serie || "-", col1 + 100, y, 40);
  drawField(doc, "Chave NF-e", primeiroDoc.chave_acesso || "-", col1, y + 12, pageW - 28);
  drawField(doc, "Valor NF-e", fmt(primeiroDoc.valor || 0), col1, y + 24, 60);
  y += 38;

  // Carga
  y = drawSection(doc, "CARGA", y);
  drawField(doc, "Produto", pf.carga?.descricao || cte.metadata?.payload_focus?.carga?.descricao || "Diversos", col1, y, 80);
  drawField(doc, "Peso", fmtKg(pf.carga?.peso_kg || 0), col1, y + 12, 40);
  drawField(doc, "Volumes/Caixas", String(pf.carga?.volumes || "-"), col2, y + 12, 40);
  drawField(doc, "Valor Mercadoria", fmt(pf.carga?.valor_declarado || 0), col1, y + 24, 60);
  drawField(doc, "Valor Frete Rateado", fmt(cte.valor || rateio.valor_rateado || 0), col2, y + 24, 60);
  y += 38;

  // Observacoes
  y = drawSection(doc, "OBSERVACOES", y);
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(8);
  const obs = pf.observacao || cte.metadata?.observacao_cte || "—";
  const obsLines = doc.splitTextToSize(obs, pageW - 28);
  doc.text(obsLines, col1, y + 2);
  y += obsLines.length * 5 + 8;

  doc.setTextColor(180, 0, 0);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.text("Documento gerado apenas para conferencia interna. Nao possui validade fiscal.", 14, y);
  y += 10;

  // Rateio info
  if (rateio.lote_id) {
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(6);
    doc.text(`Lote: ${rateio.lote_id} | Indice: ${rateio.indice || "?"}/${rateio.total_documentos || "?"} | Regra: ${rateio.regra_rateio || "-"}`, 14, y);
    y += 6;
  }

  // Rodape
  doc.setDrawColor(200, 200, 200);
  doc.line(14, y + 2, pageW - 14, y + 2);
  doc.setFontSize(6);
  doc.setTextColor(150, 150, 150);
  doc.text("PREVIA SEM VALOR FISCAL", 14, y + 8);
  const pageCount = doc.getNumberOfPages();
  doc.text(`Pagina 1/${pageCount}`, pageW - 30, y + 8);

  return doc;
}

export function baixarPreviaCte(cte: any) {
  const doc = gerarPdfPreviaCteSemValorFiscal(cte);
  const filename = `previa_cte_${cte.numero || "s_n"}_sem_valor_fiscal.pdf`;
  doc.save(filename);
}

export function abrirPreviaCte(cte: any) {
  const doc = gerarPdfPreviaCteSemValorFiscal(cte);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}
