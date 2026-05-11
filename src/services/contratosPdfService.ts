import jsPDF from "jspdf";
import { ContratoGerado } from "./contratosService";

const AZUL = [15, 26, 46];
const LARANJA = [249, 115, 22];
const CINZA_CLARO = [248, 250, 252];
const BRANCO = [255, 255, 255];
const PRETO = [50, 50, 50];

export interface PDFContractOptions {
  logoBase64?: string;
  empresaNome?: string;
  empresaCnpj?: string;
  empresaEndereco?: string;
}

/**
 * Converte HTML para texto limpo para o PDF
 */
function htmlToText(html: string): string[] {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
    .split('\n')
    .filter(line => line.trim().length > 0);
}

export async function generateContractPDF(
  contrato: ContratoGerado,
  options: PDFContractOptions = {}
): Promise<Uint8Array> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);

  // =====================================================
  // HEADER
  // =====================================================
  const logo = options.logoBase64 || null;
  const empresaNome = options.empresaNome || 'CONEXÃO EXPRESS TRANSPORTES';
  const empresaCnpj = options.empresaCnpj || '31.227.975/0001-80';
  const empresaEndereco = options.empresaEndereco || 'Avenida Goitacazes, 45 - São Caetano do Sul/SP';

  // Barra Superior (Laranja)
  doc.setFillColor(LARANJA[0], LARANJA[1], LARANJA[2]);
  doc.rect(0, 0, pageWidth, 2, 'F');

  // Logo
  if (logo) {
    try {
      const cleanLogo = logo.startsWith('data:') ? logo : `data:image/png;base64,${logo}`;
      doc.addImage(cleanLogo, 'PNG', margin, 10, 40, 15);
    } catch (e) {
      console.error('Error adding logo to PDF:', e);
      doc.setTextColor(AZUL[0], AZUL[1], AZUL[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('CONEXÃO EXPRESS', margin, 20);
    }
  } else {
    doc.setTextColor(AZUL[0], AZUL[1], AZUL[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('CONEXÃO EXPRESS', margin, 20);
  }

  // Dados da empresa (Direita)
  doc.setTextColor(AZUL[0], AZUL[1], AZUL[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(empresaNome, pageWidth - margin, 15, { align: 'right' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`CNPJ: ${empresaCnpj}`, pageWidth - margin, 19, { align: 'right' });
  doc.text(empresaEndereco, pageWidth - margin, 23, { align: 'right' });
  doc.text('vendas@conexaoexpress.com.br', pageWidth - margin, 27, { align: 'right' });

  // Título do documento e Número
  doc.setFillColor(AZUL[0], AZUL[1], AZUL[2]);
  doc.rect(margin, 35, contentWidth, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`CONTRATO OPERACIONAL: ${contrato.tipo_contrato}`, margin + 5, 40.5);
  doc.text(`Nº: ${contrato.numero_contrato}`, pageWidth - margin - 5, 40.5, { align: 'right' });

  let yPos = 55;

  // =====================================================
  // TÍTULO CENTRALIZADO
  // =====================================================
  doc.setTextColor(PRETO[0], PRETO[1], PRETO[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const titulo = 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE TRANSPORTE';
  doc.text(titulo, pageWidth / 2, yPos, { align: 'center' });
  yPos += 7;

  doc.setFontSize(11);
  const subtitulo = contrato.tipo_contrato === 'TAC' 
    ? '(TRANSPORTADOR AUTÔNOMO DE CARGA - TAC)' 
    : '(EMPRESA DE TRANSPORTE DE CARGA - ETC)';
  doc.text(subtitulo, pageWidth / 2, yPos, { align: 'center' });
  yPos += 12;

  // =====================================================
  // DADOS DO PRESTADOR
  // =====================================================
  doc.setFillColor(CINZA_CLARO[0], CINZA_CLARO[1], CINZA_CLARO[2]);
  doc.rect(margin, yPos, contentWidth, 25, 'F');
  yPos += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('I. DADOS DO PRESTADOR / CONTRATADO', margin + 5, yPos);
  yPos += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  const col1 = margin + 5;
  const col2 = margin + 100;
  let startY = yPos;

  doc.text(`Nome/Razão Social: ${contrato.prestador_nome || 'Não informado'}`, col1, yPos);
  doc.text(`Documento: ${contrato.prestador_cpf || contrato.prestador_cnpj || 'Não informado'}`, col2, yPos);
  yPos += 5;
  doc.text(`RNTRC: ${contrato.prestador_rntrc || 'Não informado'}`, col1, yPos);
  doc.text(`Telefone: ${contrato.prestador_telefone || 'Não informado'}`, col2, yPos);
  yPos += 12;

  // =====================================================
  // CONTEÚDO DO CONTRATO
  // =====================================================
  if (contrato.conteudo_html) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('II. CLÁUSULAS E CONDIÇÕES', margin, yPos);
    yPos += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    const textoLimpo = htmlToText(contrato.conteudo_html);

    textoLimpo.forEach(linha => {
      // Divide linhas longas
      const lines = doc.splitTextToSize(linha, contentWidth);
      lines.forEach((l: string) => {
        if (yPos > pageHeight - 30) {
          doc.addPage();
          // Header simplificado em novas páginas
          doc.setFillColor(LARANJA[0], LARANJA[1], LARANJA[2]);
          doc.rect(0, 0, pageWidth, 2, 'F');
          yPos = 15;
        }
        doc.text(l, margin, yPos);
        yPos += 5;
      });
    });
  }

  // =====================================================
  // ASSINATURAS
  // =====================================================
  if (yPos > pageHeight - 50) {
    doc.addPage();
    doc.setFillColor(LARANJA[0], LARANJA[1], LARANJA[2]);
    doc.rect(0, 0, pageWidth, 2, 'F');
    yPos = 30;
  } else {
    yPos += 15;
  }

  const signWidth = 70;
  const signMargin = (contentWidth - (signWidth * 2)) / 2;

  // Contratante
  doc.setDrawColor(150, 150, 150);
  doc.line(margin, yPos, margin + signWidth, yPos);
  doc.setFontSize(7);
  doc.text('CONTRATANTE', margin + (signWidth / 2), yPos + 4, { align: 'center' });
  doc.text(empresaNome, margin + (signWidth / 2), yPos + 8, { align: 'center' });

  // Contratado
  doc.line(pageWidth - margin - signWidth, yPos, pageWidth - margin, yPos);
  doc.text('CONTRATADO', pageWidth - margin - (signWidth / 2), yPos + 4, { align: 'center' });
  doc.text(contrato.prestador_nome || '', pageWidth - margin - (signWidth / 2), yPos + 8, { align: 'center' });

  // =====================================================
  // RODAPÉ (HASH E PÁGINA)
  // =====================================================
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    
    // Barra de rodapé
    doc.setFillColor(CINZA_CLARO[0], CINZA_CLARO[1], CINZA_CLARO[2]);
    doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
    
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(6);
    doc.text('Documento gerado eletronicamente com validade jurídica (MP 2.200-2/2001).', margin, pageHeight - 10);
    
    // Hash profissional
    if (contrato.hash_documento) {
      const hashCurto = contrato.hash_documento.substring(0, 6).toUpperCase();
      const numContratoLimpo = (contrato.numero_contrato || "").replace("CTR-", "");
      const hashFormatado = `CE-CTR-${numContratoLimpo}-${hashCurto}`;
      doc.setFont('helvetica', 'bold');
      doc.text(`CÓDIGO DE VALIDAÇÃO: ${hashFormatado}`, margin, pageHeight - 6);
    }

    doc.setFont('helvetica', 'normal');
    doc.text(`Página ${i} de ${paginas}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    doc.text(`Data de Emissão: ${new Date().toLocaleString('pt-BR')}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  }

  return doc.output('arraybuffer') as Uint8Array;
}

export async function generateContractPDFBase64(
  contrato: ContratoGerado,
  options: PDFContractOptions = {}
): Promise<string> {
  const pdf = await generateContractPDF(contrato, options);
  // Uso seguro de conversão para base64
  const binary = Array.from(pdf).map(b => String.fromCharCode(b)).join('');
  return btoa(binary);
}