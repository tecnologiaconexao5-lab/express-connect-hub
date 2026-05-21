// ============================================================
// Helper global de logo para PDFs do TMS Conexão Express
// - Suporte automático a light/dark
// - Preserva aspect ratio (sem distorção)
// - Centraliza corretamente no cabeçalho
// - Fallback em cascata: localStorage -> public/ -> bundle -> texto
// - Compatível com toda a base existente (não quebra API antiga)
// ============================================================

// Asset oficial empacotado pelo Vite — garante que o logo SEMPRE existe,
// mesmo se localStorage estiver vazio e o arquivo público sumir.
import logoBundledLight from "@/assets/logo-conexao-light.webp";

interface LogoConfig {
  logoUrl?: string;
  logoDarkUrl?: string;
  logoUsos?: { relatoriosPdf?: boolean };
}

interface LogoResult {
  base64: string | null;
  isText: boolean;
  /** Dimensões naturais do logo (para preservar aspect ratio) */
  naturalWidth?: number;
  naturalHeight?: number;
}

// Cache em memória para evitar refetch repetido durante a mesma sessão
const logoCache = new Map<string, { base64: string; w: number; h: number }>();

/**
 * Carrega o logo da Conexão Express com fallback automático em cascata.
 *
 * Ordem de tentativas:
 *  1. localStorage (logo customizado da empresa — dark ou light conforme contexto)
 *  2. /logo-conexao-light.webp (servido em public/)
 *  3. /logo-oficial-conexao.png (legado, compatibilidade)
 *  4. Asset empacotado pelo Vite (garantia final)
 *  5. Texto "CONEXÃO EXPRESS"
 *
 * @param isDark true quando o header tem fundo escuro (usa versão light/branca)
 * @param _scale (mantido por compatibilidade — não utilizado)
 */
export const getLogoWithFallback = async (
  isDark: boolean = false,
  _scale: number = 1
): Promise<LogoResult> => {
  try {
    // 1. localStorage — config personalizada da empresa
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("empresa_identidade_visual");
      if (stored) {
        try {
          const config = JSON.parse(stored) as LogoConfig;

          if (config.logoUsos?.relatoriosPdf === false) {
            return { base64: null, isText: true };
          }

          const preferida = isDark ? config.logoDarkUrl : config.logoUrl;
          for (const url of [preferida, config.logoDarkUrl, config.logoUrl]) {
            if (!url) continue;
            const loaded = await loadLogo(url);
            if (loaded) return { ...loaded, isText: false };
          }
        } catch {
          // JSON inválido — ignora e segue fallback
        }
      }
    }

    // 2. Logo oficial servido em /public (nova versão light)
    const publicLight = await loadLogo("/logo-conexao-light.webp");
    if (publicLight) return { ...publicLight, isText: false };

    // 3. Legado (compatibilidade com instalações anteriores)
    const publicLegacy = await loadLogo("/logo-oficial-conexao.png");
    if (publicLegacy) return { ...publicLegacy, isText: false };

    // 4. Asset empacotado — garantia final
    const bundled = await loadLogo(logoBundledLight);
    if (bundled) return { ...bundled, isText: false };

    // 5. Texto
    return { base64: null, isText: true };
  } catch (e) {
    console.warn("[pdfLogoSupport] Erro ao carregar logo:", e);
    return { base64: null, isText: true };
  }
};

/** Busca e converte uma URL de imagem para base64 + dimensões naturais. */
async function loadLogo(
  url: string
): Promise<{ base64: string; w: number; h: number } | null> {
  if (logoCache.has(url)) return logoCache.get(url)!;
  try {
    const base64 = await fetchLogoAsBase64(url);
    if (!base64) return null;
    const dims = await measureBase64(base64);
    const result = { base64, w: dims.w, h: dims.h };
    logoCache.set(url, result);
    return result;
  } catch {
    return null;
  }
}

/** Lê as dimensões naturais de uma imagem base64 (no browser). */
function measureBase64(base64: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof Image === "undefined") {
      resolve({ w: 0, h: 0 });
      return;
    }
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 0, h: 0 });
    img.src = base64;
  });
}

export const fetchLogoAsBase64 = async (
  url: string
): Promise<string | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string | null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("[pdfLogoSupport] Erro ao buscar logo:", e);
    return null;
  }
};

export const renderLogoTextFallback = (
  doc: any,
  x: number,
  y: number,
  text: string = "CONEXÃO EXPRESS",
  onDark: boolean = true
) => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  if (onDark) {
    doc.setTextColor(255, 255, 255);
  } else {
    doc.setTextColor(15, 26, 46);
  }
  doc.text(text, x, y);
};

/**
 * Adição direta de imagem com try/catch (compatibilidade).
 * Para novos PDFs prefira `drawLogoSafe` que respeita aspect ratio.
 */
export const addImageSafely = (
  doc: any,
  base64: string,
  x: number,
  y: number,
  w: number,
  h: number,
  onFallback?: () => void
) => {
  try {
    const format = detectFormat(base64);
    doc.addImage(base64, format, x, y, w, h, undefined, "FAST");
  } catch (e) {
    console.warn("[pdfLogoSupport] Erro ao adicionar imagem ao PDF:", e);
    if (onFallback) onFallback();
  }
};

interface DrawLogoOptions {
  /** X da caixa onde o logo deve ser desenhado (mm) */
  x: number;
  /** Y do topo da caixa (mm) */
  y: number;
  /** Largura máxima permitida (mm) */
  maxWidth: number;
  /** Altura máxima permitida (mm) */
  maxHeight: number;
  /** "left" | "center" | "right" — alinhamento horizontal dentro da caixa */
  align?: "left" | "center" | "right";
  /** "top" | "middle" | "bottom" — alinhamento vertical dentro da caixa */
  valign?: "top" | "middle" | "bottom";
  /** Função executada se a renderização falhar */
  onFallback?: () => void;
}

/**
 * Desenha o logo preservando o aspect ratio e centralizando dentro de
 * uma caixa (x, y, maxWidth, maxHeight). Helper global reutilizável
 * para todos os PDFs do sistema.
 *
 * Uso típico (header escuro):
 *   const logo = await getLogoWithFallback(true);
 *   if (logo.base64) {
 *     drawLogoSafe(doc, logo, { x: 15, y: 8, maxWidth: 62, maxHeight: 28 });
 *   }
 */
export const drawLogoSafe = (
  doc: any,
  logo: LogoResult,
  opts: DrawLogoOptions
) => {
  if (!logo.base64) {
    opts.onFallback?.();
    return;
  }

  const { x, y, maxWidth, maxHeight } = opts;
  const align = opts.align ?? "left";
  const valign = opts.valign ?? "middle";

  // Aspect ratio do logo (fallback ~1.57 baseado na arte oficial)
  const naturalW = logo.naturalWidth || 1545;
  const naturalH = logo.naturalHeight || 982;
  const ratio = naturalW / naturalH;

  // Escala para caber dentro da caixa sem distorcer
  let w = maxWidth;
  let h = w / ratio;
  if (h > maxHeight) {
    h = maxHeight;
    w = h * ratio;
  }

  // Posiciona dentro da caixa conforme alinhamento
  let drawX = x;
  if (align === "center") drawX = x + (maxWidth - w) / 2;
  else if (align === "right") drawX = x + (maxWidth - w);

  let drawY = y;
  if (valign === "middle") drawY = y + (maxHeight - h) / 2;
  else if (valign === "bottom") drawY = y + (maxHeight - h);

  try {
    const format = detectFormat(logo.base64);
    doc.addImage(logo.base64, format, drawX, drawY, w, h, undefined, "FAST");
  } catch (e) {
    console.warn("[pdfLogoSupport] Falha ao desenhar logo, usando fallback:", e);
    opts.onFallback?.();
  }
};

/** Detecta o formato do data URL para passar corretamente ao jsPDF. */
function detectFormat(base64: string): "PNG" | "JPEG" | "WEBP" {
  if (base64.startsWith("data:image/webp")) return "WEBP";
  if (base64.startsWith("data:image/jpeg") || base64.startsWith("data:image/jpg"))
    return "JPEG";
  return "PNG";
}
