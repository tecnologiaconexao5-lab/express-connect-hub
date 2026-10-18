import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ExtratoFechamentoPrestador, OperacaoFinanceira } from '@/services/financeiro/extratoPrestadorService';
import { drawLogoSafe, getLogoWithFallback } from '@/lib/pdfLogoSupport';
import { loadLogo } from '@/lib/pdf/foundation';
import { empresaConfig } from '@/utils/empresaConfig';

interface PDFOptions {
  includeLogo?: boolean;
  logoBase64?: string;
  logoWidth?: number;
  logoHeight?: number;
  empresaNome?: string;
  empresaCNPJ?: string;
  empresaEndereco?: string;
  includeWatermark?: boolean;
  /** false evita doc.save() (útil p/ geração de bytes em testes) */
  save?: boolean;
}

// Dados reais da empresa (fonte: src/utils/empresaConfig.ts — mesma usada por
// foundation.ts, pdfFatura/faturaService e OSPDF).
const DEFAULT_OPTIONS: PDFOptions = {
  includeLogo: true,
  includeWatermark: false,
  save: true,
  empresaNome: empresaConfig.razaoSocial,
  empresaCNPJ: empresaConfig.cnpj,
  empresaEndereco: `${empresaConfig.cidade}/${empresaConfig.uf}`,
};

// ── Paleta corporativa Conexão Express ──────────────────────────────────────
const NAVY: [number, number, number] = [15, 26, 46];
const PRIMARY: [number, number, number] = [0, 102, 204];
const ORANGE: [number, number, number] = [249, 115, 22];
const GREEN: [number, number, number] = [16, 185, 129];
const RED: [number, number, number] = [220, 38, 38];
const SLATE: [number, number, number] = [51, 65, 85];
const GRAY: [number, number, number] = [100, 116, 139];
const LIGHT: [number, number, number] = [248, 250, 252];

const MARGIN = 16;

export async function generateExtratoPrestadorPDF(
  extrato: ExtratoFechamentoPrestador,
  options: PDFOptions = DEFAULT_OPTIONS
): Promise<jsPDF> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const contentWidth = pageWidth - MARGIN * 2;
  const rightX = pageWidth - MARGIN;

  // ═══════════════════════════════════════════════════════════════════════
  // 1. CABEÇALHO AZUL INSTITUCIONAL — FAIXA COMPACTA (logo + empresa)
  // Logo oficial: letras brancas + X colorido (asset /logos/logo-conexao-oficial.png)
  // carregado pelo método seguro do próprio projeto (foundation.loadLogo()).
  // ═══════════════════════════════════════════════════════════════════════
  const bandHeight = 22;
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, 0, pageWidth, bandHeight, 'F');

  // Logo à esquerda (proporções oficiais preservadas)
  if (opts.includeLogo) {
    let logo: {
      base64: string | null;
      isText: boolean;
      naturalWidth?: number;
      naturalHeight?: number;
    };
    if (opts.logoBase64) {
      logo = {
        base64: opts.logoBase64,
        isText: false,
        naturalWidth: opts.logoWidth,
        naturalHeight: opts.logoHeight,
      };
    } else {
      const oficial = await loadLogo();
      if (oficial && oficial.base64) {
        logo = {
          base64: oficial.base64,
          isText: false,
          naturalWidth: oficial.naturalWidth,
          naturalHeight: oficial.naturalHeight,
        };
      } else {
        logo = await getLogoWithFallback(true);
      }
    }
    drawLogoSafe(doc, logo, {
      x: MARGIN,
      y: 2.5,
      maxWidth: 54,
      maxHeight: 17,
      align: 'left',
      valign: 'middle',
      onFallback: () => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(255, 255, 255);
        doc.text('CONEXÃO EXPRESS', MARGIN, 13);
      },
    });
  }

  // Empresa em BRANCO à direita (razão em destaque, CNPJ/cidade menores)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(opts.empresaNome!, rightX, 9.2, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(215, 224, 240);
  doc.text(`CNPJ: ${opts.empresaCNPJ}`, rightX, 12.6, { align: 'right' });
  doc.text(opts.empresaEndereco!, rightX, 15.6, { align: 'right' });

  // Linha de acento laranja na base da faixa (toque institucional)
  doc.setDrawColor(ORANGE[0], ORANGE[1], ORANGE[2]);
  doc.setLineWidth(0.6);
  doc.line(0, bandHeight, pageWidth, bandHeight);
  doc.setLineWidth(0.1);

  // Título + subtítulo + nº do extrato (referência útil para o prestador)
  const titleY = bandHeight + 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text('EXTRATO DE FECHAMENTO DO PRESTADOR', pageWidth / 2, titleY, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.text('Fechamento de serviços e reembolsos', pageWidth / 2, titleY + 4, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
  doc.text(`Extrato Nº ${extrato.numero}`, rightX, titleY, { align: 'right' });

  let yPos = titleY + 8;

  // ═══════════════════════════════════════════════════════════════════════
  // 2. LINHA SUPERIOR: PRESTADOR (esquerda) x CLIENTE (direita)
  // ═══════════════════════════════════════════════════════════════════════
  const colW = contentWidth / 2;
  const colX = MARGIN + colW;

  // PRESTADOR (esquerda)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
  doc.text('PRESTADOR', MARGIN, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
  doc.text(extrato.prestador.nome_completo || '—', MARGIN, yPos + 4.6);

  const prestadorLines: string[] = [];
  if (extrato.prestador.cpf_cnpj)
    prestadorLines.push(`CPF/CNPJ: ${mascararDocumento(extrato.prestador.cpf_cnpj)}`);
  if (extrato.prestador.veiculo_tipo)
    prestadorLines.push(`Veículo: ${extrato.prestador.veiculo_tipo}`);
  if (extrato.prestador.veiculo_placa)
    prestadorLines.push(`Placa: ${extrato.prestador.veiculo_placa}`);
  let py = yPos + 8.6;
  doc.setFontSize(8);
  for (const line of prestadorLines) {
    doc.text(line, MARGIN, py);
    py += 4;
  }
  const blocoSuperiorEsqY = py;

  // CLIENTE (direita) — bloco próprio
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
  doc.text('CLIENTE', colX, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
  const clienteLinhas = doc.splitTextToSize(formatarClienteLabel(extrato.clienteLabel), colW - 2);
  let cy = yPos + 4.6;
  for (const linha of clienteLinhas) {
    doc.text(String(linha), colX, cy);
    cy += 4;
  }
  const blocoSuperiorDirY = cy;

  // Fim da linha superior
  const blocoSuperiorY = Math.max(blocoSuperiorEsqY, blocoSuperiorDirY);

  // ═══════════════════════════════════════════════════════════════════════
  // 3. LINHA INFERIOR: PERÍODO (esquerda, datas na mesma linha)
  //    x PAGAMENTO/STATUS (direita)
  // ═══════════════════════════════════════════════════════════════════════
  const yPos2 = blocoSuperiorY + 3;

  // PERÍODO — datas na MESMA linha
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
  doc.text('PERÍODO', MARGIN, yPos2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
  doc.text(
    `${formatarDataPDF(extrato.periodo_inicio)} a ${formatarDataPDF(extrato.periodo_fim)}`,
    MARGIN,
    yPos2 + 4.4
  );

  // Origem/Tipo discreto abaixo do período
  doc.setFontSize(7.5);
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.text(`Origem: ${mapearOrigemExterna(extrato.origemLabel)}`, MARGIN, yPos2 + 8.6);

  // PAGAMENTO / STATUS (direita)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
  doc.text('PAGAMENTO', colX, yPos2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);

  const statusPag = extrato.status_pagamento || 'pendente';
  const pago = statusPag === 'pago' || extrato.status === 'pago';
  let pyDir = yPos2 + 4.4;

  if (pago) {
    const dataPago = extrato.data_pagamento || undefined;
    doc.text(`Pago em: ${dataPago ? formatarDataPDF(dataPago) : '—'}`, colX, pyDir);
    pyDir += 4.2;
    doc.text('Status: Pago', colX, pyDir);
  } else {
    const previsao = extrato.data_prevista_pagamento
      || extrato.data_programada_pagamento
      || obterPrevisaoLegada(extrato);
    if (previsao) {
      doc.text(`Previsão para: ${formatarDataPDF(previsao)}`, colX, pyDir);
      pyDir += 4.2;
    }
    doc.text(`Status: ${getPagamentoStatusLabel(statusPag)}`, colX, pyDir);
  }

  yPos = Math.max(yPos2 + 8.6, pyDir) + 4.5;

  // ═══════════════════════════════════════════════════════════════════════
  // 4. OPERAÇÕES DO PERÍODO (PRIMEIRO) — tabela real sem romaneio
  //    Colunas: Data | Serviço / Trajeto | Adicionais | Valor
  // ═══════════════════════════════════════════════════════════════════════
  drawSectionTitle(doc, MARGIN, yPos, 'OPERAÇÕES DO PERÍODO', 55);
  yPos += 3;

  if (extrato.operacoes.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('Nenhuma operação registrada neste período.', MARGIN, yPos + 8);
    yPos += 12;
  } else {
    const rows = extrato.operacoes.map((op) => {
      return [
        formatarDataPDF(op.data_operacao),
        montarTrajetoServico(op),
        montarAdicionais(op),
        formatarMoedaPDF(calcularValorExibidoOperacao(op)),
      ];
    });

    autoTable(doc, {
      startY: yPos,
      margin: { left: MARGIN, right: MARGIN, bottom: 12 },
      head: [['Data', 'Serviço / Trajeto', 'Adicionais', 'Valor']],
      body: rows,
      theme: 'striped',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        textColor: SLATE,
        lineWidth: 0.1,
        lineColor: [220, 226, 236],
      },
      headStyles: {
        fillColor: NAVY,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 24, halign: 'center' },
        1: { cellWidth: 72 },
        2: { cellWidth: 38, halign: 'center' },
        3: { cellWidth: 44, halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const raw = String(data.cell.raw ?? '');
          data.cell.styles.textColor = raw.startsWith('-') ? RED : GREEN;
        }
      },
    });

    yPos = obterFinalUltimaTabela(doc) + 5;
  }

  // OBSERVAÇÕES (compactas, antes do fechamento financeiro)
  const observacao = extrato.observacoes
    || `Extrato referente à produção do período selecionado. Cliente: ${formatarClienteLabel(extrato.clienteLabel)}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  const obsLines = doc.splitTextToSize(observacao, contentWidth);
  doc.text(obsLines as string[], MARGIN, yPos + 3);
  yPos += (obsLines.length * 3.6) + 7;

  // ═══════════════════════════════════════════════════════════════════════
  // 5. RESUMO FINANCEIRO (compacto, duas colunas + total)
  // ═══════════════════════════════════════════════════════════════════════
  if (yPos > pageHeight - 55) {
    doc.addPage();
    yPos = MARGIN;
  }
  drawSectionTitle(doc, MARGIN, yPos, 'RESUMO FINANCEIRO', 40);
  yPos += 2.5;

  const outrosCreditos =
    Math.max(0, extrato.valor_total_creditos - (extrato.valor_servicos + extrato.valor_pedagio + extrato.valor_adicionais + extrato.valor_reembolsos + extrato.valor_bonus));
  const outrosDebitos =
    Math.max(0, extrato.valor_total_debitos - (extrato.valor_descontos + extrato.valor_adiantamentos + extrato.valor_combustivel));

  autoTable(doc, {
    startY: yPos,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'plain',
    head: [['Créditos', 'Valor', 'Débitos', 'Valor']],
    body: [
      ['Serviços/Base', formatarMoedaPDF(extrato.valor_servicos), 'Descontos', formatarMoedaPDF(extrato.valor_descontos)],
      ['Pedágio', formatarMoedaPDF(extrato.valor_pedagio), 'Adiantamentos', formatarMoedaPDF(extrato.valor_adiantamentos)],
      ['Adicionais', formatarMoedaPDF(extrato.valor_adicionais), 'Combustível', formatarMoedaPDF(extrato.valor_combustivel)],
      ['Reembolsos', formatarMoedaPDF(extrato.valor_reembolsos), 'Outros débitos', formatarMoedaPDF(outrosDebitos)],
      ['Bônus', formatarMoedaPDF(extrato.valor_bonus), '', ''],
      ['Outros créditos', formatarMoedaPDF(outrosCreditos), '', ''],
      ['TOTAL CRÉDITOS', formatarMoedaPDF(extrato.valor_total_creditos), 'TOTAL DÉBITOS', formatarMoedaPDF(extrato.valor_total_debitos)],
    ],
    styles: {
      fontSize: 8.5,
      cellPadding: 2,
      textColor: SLATE,
      lineWidth: 0.1,
      lineColor: [220, 226, 236],
    },
    headStyles: {
      fillColor: LIGHT,
      textColor: NAVY,
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: (contentWidth / 2) * 0.62 },
      1: { cellWidth: (contentWidth / 2) * 0.38, halign: 'right', fontStyle: 'bold' },
      2: { cellWidth: (contentWidth / 2) * 0.62 },
      3: { cellWidth: (contentWidth / 2) * 0.38, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        if (data.row.index === 6) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [238, 242, 250];
          data.cell.styles.textColor = NAVY;
        }
        if (data.column.index === 1) data.cell.styles.textColor = GREEN;
        if (data.column.index === 3 && data.row.index < 6) data.cell.styles.textColor = RED;
      }
    },
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 6. VALOR LÍQUIDO — FECHAMENTO VISUAL FINAL (faixa laranja institucional)
  // ═══════════════════════════════════════════════════════════════════════
  let liquidY = obterFinalUltimaTabela(doc) + 5;
  if (liquidY > pageHeight - 24) {
    doc.addPage();
    liquidY = MARGIN;
  }
  doc.setFillColor(ORANGE[0], ORANGE[1], ORANGE[2]);
  doc.roundedRect(MARGIN, liquidY, contentWidth, 11, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('VALOR LÍQUIDO', MARGIN + 5, liquidY + 7);
  doc.text(formatarMoedaPDF(extrato.valor_liquido), pageWidth - MARGIN - 5, liquidY + 7, { align: 'right' });

  // ═══════════════════════════════════════════════════════════════════════
  // 7. RODAPÉ DISCRETO + PAGINAÇÃO REAL (após todas as páginas)
  // ═══════════════════════════════════════════════════════════════════════
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.height;
    doc.setDrawColor(200, 210, 225);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, pageH - 14, pageWidth - MARGIN, pageH - 14);
    doc.setLineWidth(0.1);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text(
      `Conexão Express · Gerado em ${formatarDataHoraPDF(new Date().toISOString())}`,
      pageWidth / 2,
      pageH - 10,
      { align: 'center' }
    );
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - MARGIN, pageH - 10, { align: 'right' });
  }

  // Salvar (ou retornar o doc para geração de bytes em testes)
  const fileName = `Extrato_${extrato.numero}_${extrato.prestador.nome_completo.replace(/\s+/g, '_')}.pdf`;
  if (opts.save !== false) {
    doc.save(fileName);
  }
  return doc;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Y final da última autoTable renderizada (campos injetados pelo plugin). */
function obterFinalUltimaTabela(doc: jsPDF): number {
  const t = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  return t ? t.finalY : MARGIN;
}

/** Previsão de pagamento — inclui campo legado opcional fora da interface. */
function obterPrevisaoLegada(extrato: ExtratoFechamentoPrestador): string | undefined {
  return (extrato as unknown as { previsao_pagamento?: string }).previsao_pagamento;
}

/** Desenha título de seção com sublinhado laranja curto. */
function drawSectionTitle(doc: jsPDF, x: number, y: number, text: string, lineWidth: number): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(text, x, y);
  doc.setDrawColor(ORANGE[0], ORANGE[1], ORANGE[2]);
  doc.setLineWidth(0.4);
  doc.line(x, y + 1.2, x + lineWidth, y + 1.2);
  doc.setLineWidth(0.1);
}

/** Mapeia a origem interna para a nomenclatura externa (somente apresentação). */
function mapearOrigemExterna(origem?: string): string {
  const o = (origem || '').toLowerCase();
  if (o === 'escala') return 'Ordem de Carregamento';
  if (o === 'ordem_servico') return 'Ordem de Serviço';
  if (o === 'manual') return 'Lançamento Manual';
  if (!o || o === 'todos') return 'Todos';
  return origem || 'Todos';
}

/**
 * Limpa texto de trajeto: remove espaços múltiplos e espaçamento artificial
 * entre letras ("G u a r u l h o s" → "Guarulhos"). Preserva palavras reais
 * compostas ("São Paulo") e siglas de mais de uma letra.
 */
function limparTrajetoTexto(valor?: string): string {
  if (!valor) return '';
  const textoLimpo = String(valor).replace(/\s+/g, ' ').trim();
  const tokens = textoLimpo.split(' ');
  if (tokens.length <= 1) return textoLimpo;

  const partes: string[] = [];
  let grupo = '';
  const flush = () => {
    if (grupo) {
      partes.push(grupo);
      grupo = '';
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
  return partes.join(' ');
}

/** Detecta se o texto parece um UUID (id técnico) — evita imprimir UUID no PDF. */
function pareceUuid(valor?: string): boolean {
  if (!valor) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(valor).trim());
}

/** Cliente exibível: nome real se houver; "Todos os clientes" para Todos; "—" se UUID ou ausente. */
function formatarClienteLabel(valor?: string): string {
  if (!valor) return '—';
  const t = String(valor).trim();
  if (t === 'Todos' || t === 'todos') return 'Todos os clientes';
  if (pareceUuid(t)) return 'Cliente selecionado';
  return t;
}

/**
 * Serviço / Trajeto em texto natural para o prestador (sem UUID, sem código
 * técnico, sem romaneio). Manual → descrição; produção → "Origem → Destino".
 */
function montarTrajetoServico(op: OperacaoFinanceira): string {
  if (op.tipoOrigem === 'manual') {
    return limparTrajetoTexto(op.descricao) || 'Lançamento manual';
  }
  const origem = pareceUuid(op.origem) ? '' : limparTrajetoTexto(op.origem);
  const destino = pareceUuid(op.destino) ? '' : limparTrajetoTexto(op.destino);
  // Separador direcional render-safe (› está na codificação WinAnsi padrão do
  // PDF; "→" não é suportada pelas fontes padrão do jsPDF e viraria caixa/em branco).
  const trajeto = origem && destino ? `${origem} › ${destino}` : origem || destino || '';
  const km = Number(op.km_total);
  const kmTxt = Number.isFinite(km) && km > 0 ? `${km.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km` : '';
  return [trajeto, kmTxt].filter(Boolean).join(' · ') || '—';
}

/**
 * Valor exibido da linha da operação (somente apresentação do sinal).
 * Crédito sempre positivo; débito sempre negativo — usando o valor real da
 * operação, sem recalcular nada.
 */
function calcularValorExibidoOperacao(op: OperacaoFinanceira): number {
  const v = Number(op.valor ?? op.valor_base) || 0;
  return op.tipo === 'debito' ? -Math.abs(v) : Math.abs(v);
}

/**
 * Adicionais REAIS da própria operação (somente labels, sem recalcular valor).
 * Usa apenas campos já existentes no fechamento. Se não houver: "—".
 */
function montarAdicionais(op: OperacaoFinanceira): string {
  const partes: string[] = [];
  if (Number(op.valor_pedagio) > 0) partes.push('Pedágio');
  if (Number(op.valor_ajudante) > 0) partes.push('Ajudante');
  if (Number(op.valor_adicionais) > 0) partes.push('Adicional');
  if (Number(op.valor_reembolso_outros) > 0) partes.push('Reembolso');
  if (Number(op.valor_combustivel) > 0) partes.push('Combustível');
  return partes.length > 0 ? partes.join(' · ') : '—';
}

function formatarMoedaPDF(valor: number): string {
  // "R$ 520,00" com espaço comum (normaliza o espaço não separável do Intl)
  return (valor || 0)
    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    .replace(/\u00a0/g, ' ');
}

function formatarDataPDF(data: string): string {
  if (!data) return '—';
  // Data pura (YYYY-MM-DD) é interpretada como UTC; "T12:00" evita virada de dia
  // por fuso horário e garante o dia correto exibido ao prestador.
  const d = data.length === 10 && data.includes('-') ? `${data}T12:00:00` : data;
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('pt-BR');
}

function formatarDataCurtaPDF(data: string): string {
  if (!data) return '—';
  const d = data.length === 10 && data.includes('-') ? `${data}T12:00:00` : data;
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatarDataHoraPDF(data: string): string {
  if (!data) return '—';
  return new Date(data).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function mascararDocumento(documento: string): string {
  if (!documento) return '';
  if (documento.length === 11) {
    return documento.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  } else if (documento.length === 14) {
    return documento.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return documento;
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'em_conferencia': return 'Em Conferência';
    case 'conferido': return 'Conferido';
    case 'aprovado': return 'Aprovado';
    case 'pago': return 'Pago';
    case 'cancelado': return 'Cancelado';
    default: return status;
  }
}

function getPagamentoStatusLabel(status: string): string {
  switch (status) {
    case 'pendente': return 'Aguardando';
    case 'programado': return 'Programado';
    case 'em_lote': return 'Em Lote';
    case 'pago': return 'Pago';
    case 'cancelado': return 'Cancelado';
    default: return status;
  }
}

// Exportar funções auxiliares para uso em outros componentes/testes
export {
  formatarMoedaPDF,
  formatarDataPDF,
  formatarDataCurtaPDF,
  mascararDocumento,
  montarAdicionais,
  montarTrajetoServico,
  limparTrajetoTexto,
  calcularValorExibidoOperacao,
};
