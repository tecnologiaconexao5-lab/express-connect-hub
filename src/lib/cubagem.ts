// ============================================================
// FIX-CUBAGEM-RECEITA-CLIENTE-E-DASHBOARD-MOBILE
// Calculadora de cubagem (dimensões → litros) + alerta de capacidade
// do baú da MOTO. Puro e sem dependências de UI (reusado por /os-mobile).
//
//   Fórmula: litros = (Comprimento × Largura × Altura) / 1000   [cm]
// ============================================================

const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export interface DimensoesCm {
  comprimento: number;
  largura: number;
  altura: number;
}

/** Litros a partir das dimensões em cm: (C × L × A) / 1000. */
export function calcularLitros({ comprimento, largura, altura }: DimensoesCm): number {
  const c = Number(comprimento) || 0;
  const l = Number(largura) || 0;
  const a = Number(altura) || 0;
  if (c <= 0 || l <= 0 || a <= 0) return 0;
  return r2((c * l * a) / 1000);
}

// Faixas críticas do baú da moto (litros).
export const BAU_MOTO_PADRAO_L = 90;
export const BAU_MOTO_120_L = 120;
export const BAU_MOTO_140_L = 140;
export const BAU_MOTO_MAX_L = 160;

export interface AlertaBauMoto {
  /** 1=90L, 2=120L, 3=140L, 4=capacidade excedida (>160L). */
  nivel: 1 | 2 | 3 | 4;
  texto: string;
}

/**
 * Alerta de capacidade do baú da moto.
 * Retorna null quando a carga está dentro do baú padrão (≤ 90L).
 */
export function alertaBauMoto(litros: number): AlertaBauMoto | null {
  const l = Number(litros);
  if (!Number.isFinite(l) || l <= 0) return null;
  if (l > BAU_MOTO_MAX_L) {
    return {
      nivel: 4,
      texto:
        "⚠️ Capacidade máxima de moto excedida (>160L). Sugerido trocar para Fiorino/Carro.",
    };
  }
  if (l > BAU_MOTO_140_L) return { nivel: 3, texto: "⚠️ Requer Baú de 140L" };
  if (l > BAU_MOTO_120_L) return { nivel: 2, texto: "⚠️ Requer Baú de 120L" };
  if (l > BAU_MOTO_PADRAO_L) return { nivel: 1, texto: "⚠️ Requer Baú de 90L" };
  return null;
}
