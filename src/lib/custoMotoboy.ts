// ============================================================
// OVERHAUL-OS-MOBILE-APP-REGRAS-CUSTO
// Motor EXATO de "Custo do Prestador" — tabela Motoboy (Moto).
//
// Inputs: distância total (km), paradas (qtd), peso (kg),
//         retorno (Sim/Não), pagamento, tempo de espera (min).
//
// Regras de matemática (aplicadas à letra):
//   a) À vista (até 24h) ..: 0 a 6 km = R$ 20,00 fixo
//                            6,1 a 16 km = R$ 25,00 fixo
//                            acima de 16 km (17+) = R$ 1,50 por CADA km rodado
//   b) Faturado (após 24h): 0 a 6 km = R$ 20,00 fixo
//                            6,1 a 12 km = R$ 25,00 fixo
//                            acima de 12 km (13+) = R$ 2,00 por CADA km rodado
//   c) À vista mesmo dia ..: R$ 2,00 por CADA km rodado (até 23:59)
//                            — mantido apenas para DADOS LEGADOS; a UI oferece
//                            somente as 2 opções de prazo (a) e (b)
//   d) Paradas ............: Ponto A (1ª) e Ponto B (2ª) gratuitos;
//                            do Ponto C (3ª) em diante = + R$ 2,00 cada
//   e) Retorno ............: + R$ 1,50 por km do trajeto de retorno
//                            (última parada → origem; usa o km total quando
//                            não há km de retorno informado separadamente)
//   f) Peso ...............: acima de 20 kg = + R$ 1,00 por CADA kg excedente
//   g) Espera .............: franquia 20 min; excedente = + R$ 0,40/min
//
// Puro e sem dependências de UI — reusado por /os-mobile (e testável).
// ============================================================

export type TipoPagamentoPrestador = "faturado" | "avista" | "avista_mesmo_dia";

/**
 * Opções de UI — EXATAMENTE 2 faixas de prazo (A e B).
 * `avista_mesmo_dia` sai da UI mas permanece no motor para dados legados.
 * Ordem: A (à vista, até 24h) primeiro; B (faturado, após 24h) segundo.
 */
export const OPCOES_PAGAMENTO_PRESTADOR: {
  value: TipoPagamentoPrestador;
  label: string;
  desc: string;
}[] = [
  {
    value: "avista",
    label: "À vista (até 24h)",
    desc: "0–6 R$ 20 · 6,1–16 R$ 25 · 17+ R$ 1,50/km",
  },
  {
    value: "faturado",
    label: "Faturado (após 24h)",
    desc: "0–6 R$ 20 · 6,1–12 R$ 25 · 13+ R$ 2,00/km",
  },
];

export const PARADAS_GRATUITAS = 2;
export const VALOR_PARADA_EXTRA = 2;
export const VALOR_KM_RETORNO = 1.5;
export const FRANQUIA_PESO_KG = 20;
export const VALOR_KG_EXCEDENTE = 1;
export const FRANQUIA_ESPERA_MIN = 20;
export const VALOR_ESPERA_EXCEDENTE = 0.4;

const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

const fmtKm = (km: number) =>
  km.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export interface CustoMotoboyInput {
  /** Distância total da rota (km). */
  km: number;
  /** Quantidade de paradas da rota (Ponto A, B, C...). */
  paradas: number;
  /** Peso total da carga (kg). */
  peso: number;
  /** Retorno à origem após a última parada. */
  retorno: boolean;
  /**
   * Km do trajeto de retorno (última parada → origem).
   * Opcional — quando ausente ou ≤ 0 usa o km total da rota.
   */
  kmRetorno?: number;
  /** Tipo de pagamento do prestador. */
  pagamento: TipoPagamentoPrestador;
  /** Tempo de espera acumulado (min). */
  esperaMin: number;
}

export interface CustoMotoboyItem {
  chave: string;
  label: string;
  detalhe: string;
  valor: number;
}

export interface CustoMotoboyResultado {
  total: number;
  base: number;
  itens: CustoMotoboyItem[];
}

/**
 * Calcula o custo do prestador (Motoboy) conforme a regra exata.
 * Sem efeitos colaterais — mesma entrada ⇒ mesma saída.
 */
export function calcularCustoMotoboy(input: CustoMotoboyInput): CustoMotoboyResultado {
  const km = Math.max(0, Number.isFinite(input.km) ? input.km : 0);
  const paradas = Math.max(0, Math.floor(input.paradas));
  const peso = Math.max(0, Number.isFinite(input.peso) ? input.peso : 0);
  const espera = Math.max(0, Number.isFinite(input.esperaMin) ? input.esperaMin : 0);

  // a/b/c — base por distância + forma de pagamento
  let base = 0;
  let baseDetalhe = "";
  if (input.pagamento === "avista_mesmo_dia") {
    base = r2(km * 2);
    baseDetalhe = `R$ 2,00 × ${fmtKm(km)} km · até 23:59`;
  } else if (input.pagamento === "avista") {
    if (km <= 6) {
      base = 20;
      baseDetalhe = "R$ 20,00 fixo · 0 a 6 km";
    } else if (km <= 16) {
      base = 25;
      baseDetalhe = "R$ 25,00 fixo · 6,1 a 16 km";
    } else {
      base = r2(km * 1.5);
      baseDetalhe = `R$ 1,50 × ${fmtKm(km)} km`;
    }
  } else {
    // faturado (padrão)
    if (km <= 6) {
      base = 20;
      baseDetalhe = "R$ 20,00 fixo · 0 a 6 km";
    } else if (km <= 12) {
      base = 25;
      baseDetalhe = "R$ 25,00 fixo · 6,1 a 12 km";
    } else {
      base = r2(km * 2);
      baseDetalhe = `R$ 2,00 × ${fmtKm(km)} km`;
    }
  }

  // d — pontos de parada (1ª e 2ª gratuitas)
  const extrasParada = Math.max(0, paradas - PARADAS_GRATUITAS);
  const valorParadas = r2(extrasParada * VALOR_PARADA_EXTRA);

  // e — retorno à origem (última parada → origem)
  const kmRetorno =
    input.retorno && Number.isFinite(input.kmRetorno) && (input.kmRetorno ?? 0) > 0
      ? Math.max(0, input.kmRetorno as number)
      : km;
  const valorRetorno = input.retorno ? r2(kmRetorno * VALOR_KM_RETORNO) : 0;

  // f — peso excedente
  const kgExcedente = Math.max(0, peso - FRANQUIA_PESO_KG);
  const valorPeso = r2(kgExcedente * VALOR_KG_EXCEDENTE);

  // g — espera excedente
  const minExcedente = Math.max(0, espera - FRANQUIA_ESPERA_MIN);
  const valorEspera = r2(minExcedente * VALOR_ESPERA_EXCEDENTE);

  const itens: CustoMotoboyItem[] = [
    {
      chave: "base",
      label: "Serviço (faixa de km)",
      detalhe: baseDetalhe,
      valor: base,
    },
    {
      chave: "paradas",
      label: "Pontos de parada",
      detalhe:
        extrasParada > 0
          ? `R$ 2,00 × ${extrasParada} ponto(s) a partir da 3ª parada`
          : "1ª e 2ª paradas gratuitas",
      valor: valorParadas,
    },
    {
      chave: "retorno",
      label: "Retorno à origem",
      detalhe: input.retorno
        ? `R$ 1,50 × ${fmtKm(kmRetorno)} km de retorno (última parada → origem)`
        : "Sem retorno à origem",
      valor: valorRetorno,
    },
    {
      chave: "peso",
      label: "Peso",
      detalhe:
        kgExcedente > 0
          ? `R$ 1,00 × ${fmtKm(kgExcedente)} kg acima de ${FRANQUIA_PESO_KG} kg`
          : `Até ${FRANQUIA_PESO_KG} kg (franquia)`,
      valor: valorPeso,
    },
    {
      chave: "espera",
      label: "Tempo de espera",
      detalhe:
        minExcedente > 0
          ? `R$ 0,40 × ${fmtKm(minExcedente)} min após ${FRANQUIA_ESPERA_MIN} min`
          : `Franquia de ${FRANQUIA_ESPERA_MIN} min`,
      valor: valorEspera,
    },
  ];

  const total = r2(itens.reduce((acc, item) => acc + item.valor, 0));

  return { total, base, itens };
}

// ============================================================
// FIX-CUBAGEM-RECEITA-CLIENTE-E-DASHBOARD-MOBILE
// REGRA DE COBRANÇA DO CLIENTE — tabela MOTO (receita).
//   • Franquia: R$ 28,00 (cobre de 0 até 6 km).
//   • Km adicional: R$ 2,25 por cada km acima de 6 km.
//   Ex.: 15 km → (15 − 6) = 9 km extras × 2,25 = 20,25 → total R$ 48,25.
// ============================================================
export const RECEITA_CLIENTE_MOTO = {
  franquia: 28,
  franquiaKm: 6,
  valorKmAdicional: 2.25,
} as const;

export interface ReceitaClienteMotoResultado {
  total: number;
  franquia: number;
  kmExcedente: number;
  valorKm: number;
}

/** Calcula o valor ao cliente (receita) para MOTO conforme a regra exata. */
export function calcularReceitaClienteMoto(km: number): ReceitaClienteMotoResultado {
  const distancia = Math.max(0, Number.isFinite(km) ? km : 0);
  const kmExcedente = Math.max(0, distancia - RECEITA_CLIENTE_MOTO.franquiaKm);
  const total = r2(
    RECEITA_CLIENTE_MOTO.franquia + kmExcedente * RECEITA_CLIENTE_MOTO.valorKmAdicional,
  );
  return {
    total,
    franquia: RECEITA_CLIENTE_MOTO.franquia,
    kmExcedente: r2(kmExcedente),
    valorKm: RECEITA_CLIENTE_MOTO.valorKmAdicional,
  };
}
