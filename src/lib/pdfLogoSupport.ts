// Suporte dinâmico para logos light/dark com fallback automático

interface LogoConfig {
  logoUrl?: string;
  logoDarkUrl?: string;
  logoUsos?: { relatoriosPdf?: boolean };
}

export const getLogoWithFallback = async (
  isDark: boolean = false,
  scale: number = 1
): Promise<{ base64: string | null; isText: boolean }> => {
  try {
    // 1. Tentar localStorage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("empresa_identidade_visual");
      if (stored) {
        const config = JSON.parse(stored) as LogoConfig;

        if (config.logoUsos?.relatoriosPdf === false) {
          return { base64: null, isText: true };
        }

        const logoUrl = isDark ? config.logoDarkUrl : config.logoUrl;

        if (logoUrl) {
          const base64 = await fetchLogoAsBase64(logoUrl);
          if (base64) {
            return { base64, isText: false };
          }
        }

        // Fallback para outro logo se o solicitado não existir
        if (config.logoUrl) {
          const base64 = await fetchLogoAsBase64(config.logoUrl);
          if (base64) {
            return { base64, isText: false };
          }
        }
      }
    }

    // 2. Fallback local - logo oficial
    const fallbackPath = "/logo-oficial-conexao.png";
    const base64 = await fetchLogoAsBase64(fallbackPath);
    if (base64) {
      return { base64, isText: false };
    }

    // 3. Fallback - renderizar como texto
    return { base64: null, isText: true };
  } catch (e) {
    console.warn("Erro ao carregar logo:", e);
    return { base64: null, isText: true };
  }
};

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
    console.warn("Erro ao buscar logo:", e);
    return null;
  }
};

export const renderLogoTextFallback = (
  doc: any,
  x: number,
  y: number,
  text: string = "CONEXÃO EXPRESS"
) => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text(text, x, y);
};

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
    doc.addImage(base64, "PNG", x, y, w, h);
  } catch (e) {
    console.warn("Erro ao adicionar imagem ao PDF:", e);
    if (onFallback) {
      onFallback();
    }
  }
};
