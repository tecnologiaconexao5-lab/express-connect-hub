// Estimativa de pedágio por tipo de veículo (eixos) quando a API de rota não
// retorna valor. O Mapbox Directions não expõe pedágio; sem um provedor de
// pedágios (Maplink/Google Routes) configurado, o valor fica zerado. Este módulo
// oferece uma ESTIMATIVA conservadora (fonte "estimado") baseada em nº de eixos
// e distância — o operador pode sobrescrever manualmente a qualquer momento.

/** Quantidade de eixos tarifários por tipo de veículo (valor aproximado). */
export const EIXOS_POR_VEICULO: Record<string, number> = {
  moto: 2,
  carro_passeio: 2,
  fiorino: 2,
  kangoo: 2,
  kombi: 2,
  van: 2,
  hr: 2,
  vuc: 2,
  tres_quartos: 2,
  toco: 3,
  truck: 3,
  bitruck: 4,
  carreta: 5,
  bitrem: 5,
};

// Tarifa aproximada por praça de pedágio (R$) conforme nº de eixos.
const TARIFA_POR_PRACA: Record<number, number> = {
  2: 13.5,
  3: 20.0,
  4: 27.0,
  5: 33.0,
};

// Distância mínima (km) para considerar que a rota passa por alguma praça.
const DISTANCIA_MINIMA_PEDAGIO_KM = 40;
// Distância média entre praças em rodovias (km) usada para estimar a quantidade.
const KM_ENTRE_PRACAS = 45;

/** Normaliza o tipo de veículo (aceita snake_case e os labels do catálogo). */
const normalizarVeiculo = (valor?: string | null): string => {
  const chave = String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const alias: Record<string, string> = {
    veiculo_de_passeio: "carro_passeio",
    passeio: "carro_passeio",
    carro: "carro_passeio",
    carro_passeio: "carro_passeio",
    "3_4": "tres_quartos",
    tres_quartos: "tres_quartos",
    van_hr: "hr",
    hr: "hr",
    caminhao: "truck",
  };
  return alias[chave] || chave;
};

export interface EstimativaPedagio {
  /** Valor estimado do pedágio (R$). 0 quando não estimável. */
  valor: number;
  /** Eixos usados na estimativa (0 quando desconhecido). */
  eixos: number;
  /** Quantidade de praças estimadas. */
  pracas: number;
  /** Tarifa usada por praça (R$). */
  tarifaPorPraca: number;
}

/**
 * Estima o pedágio de uma rota a partir da distância (km) e do tipo de veículo.
 * Retorna valor 0 quando o tipo é desconhecido ou a rota é curta (urbana).
 */
export function estimarPedagio(
  distanciaKm: number,
  veiculoTipo?: string | null,
): EstimativaPedagio {
  const chave = normalizarVeiculo(veiculoTipo);
  // TRAVA RÍGIDA: moto não paga pedágio (0), independentemente da distância.
  if (chave === "moto") {
    return { valor: 0, eixos: 2, pracas: 0, tarifaPorPraca: 0 };
  }
  const eixos = chave ? EIXOS_POR_VEICULO[chave] : undefined;
  if (!eixos) {
    return { valor: 0, eixos: 0, pracas: 0, tarifaPorPraca: 0 };
  }
  if (!Number.isFinite(distanciaKm) || distanciaKm < DISTANCIA_MINIMA_PEDAGIO_KM) {
    return { valor: 0, eixos, pracas: 0, tarifaPorPraca: 0 };
  }

  const pracas = Math.max(1, Math.round(distanciaKm / KM_ENTRE_PRACAS));
  const tarifaPorPraca = TARIFA_POR_PRACA[eixos] ?? TARIFA_POR_PRACA[5];
  const valor = Number((pracas * tarifaPorPraca).toFixed(2));

  return { valor, eixos, pracas, tarifaPorPraca };
}
