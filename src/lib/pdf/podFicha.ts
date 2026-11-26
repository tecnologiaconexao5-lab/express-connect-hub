import { jsPDF } from "jspdf";
import {
  drawContentHeader,
  drawContentFooter,
  drawInfoBlock,
  loadLogo,
  BORDER,
  NAVY,
  TEXT_BODY,
  TEXT_MUTED,
} from "@/lib/pdf/foundation";
import type { ComprovanteResumo } from "@/services/portalCliente/portalClienteService";

const MARGIN = 15;

interface ImagemCarregada {
  dataUrl: string;
  formato: string;
}

async function carregarImagem(url?: string | null): Promise<ImagemCarregada | null> {
  if (!url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    if (!dataUrl.startsWith("data:image/")) return null;
    const formato = blob.type.includes("png")
      ? "PNG"
      : blob.type.includes("webp")
        ? "WEBP"
        : "JPEG";
    return { dataUrl, formato };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function fmtDataHora(d?: string | null): string {
  if (!d) return "Não informado";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "Não informado" : dt.toLocaleString("pt-BR");
}

function numeroSeguro(valor?: string | null): string {
  return String(valor || "POD").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 60);
}

/**
 * Ficha de Comprovante de Entrega (POD) — PDF imprimível.
 * Contém cabeçalho institucional, OS/Pedido, data/hora, recebedor, documento,
 * assinatura digitalizada e fotos anexadas. Sem qualquer custo/margem interna.
 */
export async function gerarFichaPODPDF(comp: ComprovanteResumo): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const logo = await loadLogo();
  const numeroOs = comp.numero_os || comp.titulo || "POD";

  let y = drawContentHeader(doc, pageW, MARGIN, logo, {
    title: "FICHA DE COMPROVANTE DE ENTREGA",
    subtitle: `POD • OS ${numeroOs}`,
    pageLabel: "POD",
  });

  y = drawInfoBlock(doc, MARGIN, y, pageW - MARGIN * 2, "DADOS DA ENTREGA", [
    { label: "OS / Pedido", value: numeroOs },
    { label: "Tipo", value: comp.tipo || "Entrega", col: "right" },
    { label: "Data / Hora da baixa", value: fmtDataHora(comp.data_entrega) },
    { label: "Recebedor", value: comp.nome_recebedor || "Não informado", col: "right" },
    { label: "Documento", value: comp.documento_recebedor || "Não informado" },
    { label: "Observação", value: comp.observacao || "—", col: "right" },
  ]);

  const [fotoEntrega, canhoto, assinatura] = await Promise.all([
    carregarImagem(comp.foto_entrega_url),
    carregarImagem(comp.foto_canhoto_url),
    carregarImagem(comp.assinatura_url),
  ]);

  const larguraBloco = (pageW - MARGIN * 2 - 6) / 2;
  const alturaFoto = 55;

  const desenharBloco = (
    titulo: string,
    img: ImagemCarregada | null,
    x: number,
    largura: number,
    altura: number,
  ) => {
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.setLineWidth(0.3);
    doc.rect(x, y, largura, altura, "S");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text(titulo, x + 2, y + 5);

    if (!img) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
      doc.text("Imagem não disponível", x + largura / 2, y + altura / 2, { align: "center" });
      return;
    }

    try {
      const props = doc.getImageProperties(img.dataUrl);
      const maxW = largura - 6;
      const maxH = altura - 10;
      const ratio = props.width / props.height;
      let w = maxW;
      let h = w / ratio;
      if (h > maxH) {
        h = maxH;
        w = h * ratio;
      }
      const imgX = x + (largura - w) / 2;
      const imgY = y + 8 + (maxH - h) / 2;
      doc.addImage(img.dataUrl, img.formato, imgX, imgY, w, h, undefined, "FAST");
    } catch {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
      doc.text("Falha ao incorporar imagem", x + largura / 2, y + altura / 2, { align: "center" });
    }
  };

  const precisaNovaPagina = (altura: number) => {
    if (y + altura > pageH - 25) {
      doc.addPage();
      y = drawContentHeader(doc, pageW, MARGIN, null, {
        title: "FICHA DE COMPROVANTE DE ENTREGA",
        subtitle: `POD • OS ${numeroOs}`,
        pageLabel: "POD",
      });
    }
  };

  precisaNovaPagina(alturaFoto + 8);
  desenharBloco("FOTO DA ENTREGA", fotoEntrega, MARGIN, larguraBloco, alturaFoto);
  desenharBloco("CANHOTO", canhoto, MARGIN + larguraBloco + 6, larguraBloco, alturaFoto);
  y += alturaFoto + 8;

  precisaNovaPagina(48);
  desenharBloco("ASSINATURA DIGITALIZADA", assinatura, MARGIN, pageW - MARGIN * 2, 42);
  y += 42 + 8;

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(TEXT_BODY[0], TEXT_BODY[1], TEXT_BODY[2]);
  doc.text(
    `Documento gerado em ${new Date().toLocaleString("pt-BR")} — Conexão Express Transportes.`,
    MARGIN,
    y,
  );

  drawContentFooter(doc, pageW, pageH, MARGIN);
  doc.save(`POD-${numeroSeguro(numeroOs)}.pdf`);
}

export default gerarFichaPODPDF;
