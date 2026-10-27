// ============================================================
// COTACAO-EXPRESS PREMIUM — motor de indicação de veículo + SLA
// Módulo puro (sem I/O) usado pelo chat /cotacao-express.
//
// Combina a regra fixa de peso (veiculoPeso.ts: 40/150/600/1000/
// 1800/2500 kg) com a cubagem real (cubagem.ts: A×L×P / 1000) para
// indicar o veículo certo ao cliente ANTES do cálculo do frete:
//   • cabe em moto (peso ≤ 40 kg e ≤ 90 L no baú) → atendimento imediato
//   • precisa de veículo maior → agendamento com 24h de antecedência
//
// Substitui o aviso genérico "acima de 40kg é outro veículo" por uma
// recomendação consultiva: veículo nomeado + regra de SLA na mesma frase.
// ============================================================
import { veiculoPorPeso } from "@/lib/veiculoPeso";
import { alertaBauMoto, calcularLitros, BAU_MOTO_PADRAO_L } from "@/lib/cubagem";

export interface EntradaAnaliseCarga {
  pesoKg: number | null;
  alturaCm?: number | null;
  larguraCm?: number | null;
  profundidadeCm?: number | null;
}

export interface RecomendacaoVeiculoCotacao {
  /** Código do veículo (mesma taxonomia de veiculoPeso). */
  tipo: string;
  /** Nome de apresentação ao cliente (ex.: "Fiorino"). */
  nome: string;
  /** true = cabe em moto e o cliente pode pedir agora. */
  cabeMoto: boolean;
  /** Horas mínimas de antecedência: 0 = imediato, 24 = agendado. */
  agendamentoHoras: number;
  /** Rótulo curto do SLA para chips/badges. */
  slaRotulo: string;
  /** Cubagem em litros quando as 3 dimensões foram informadas. */
  litros: number | null;
  /** Frase consultiva exibida no chat (contrato com a operação). */
  mensagemBot: string;
  /** Justificativa técnica resumida (exibe em tooltip/detalhe). */
  justificativa: string;
}

/** Nomes de apresentação por tipo de veículo. */
export const NOMES_VEICULO_COTACAO: Record<string, string> = {
  moto: "Moto",
  passeio: "Veículo de Passeio",
  fiorino: "Fiorino",
  kombi: "Kombi",
  hr: "Van / HR",
  vuc: "VUC",
  truck: "Caminhão",
};

const nomeDoVeiculo = (tipo: string): string =>
  NOMES_VEICULO_COTACAO[tipo] || tipo.charAt(0).toUpperCase() + tipo.slice(1);

/**
 * Analisa peso + dimensões e devolve o veículo indicado, o SLA e a
 * frase que o bot fala com o cliente.
 *
 * Regras:
 *  1. Peso mapeia pela tabela oficial (veiculoPorPeso) — acima de
 *     2.500 kg vira Caminhão com aviso de confirmação operacional.
 *  2. Dimensões (quando informadas) podem ELEVAR o veículo: se a
 *     cubagem não cabe no baú da moto (90 L), sai da moto mesmo
 *     com peso leve; se excede 160 L, já vai direto para Fiorino.
 *  3. SLA: moto = imediato; qualquer outro veículo = 24h.
 */
export function analisarCargaCotacao(entrada: EntradaAnaliseCarga): RecomendacaoVeiculoCotacao {
  const peso =
    typeof entrada.pesoKg === "number" && Number.isFinite(entrada.pesoKg) && entrada.pesoKg > 0
      ? entrada.pesoKg
      : null;

  const altura = Number(entrada.alturaCm) || 0;
  const largura = Number(entrada.larguraCm) || 0;
  const profundidade = Number(entrada.profundidadeCm) || 0;
  const temDimensoes = altura > 0 && largura > 0 && profundidade > 0;
  const litros = temDimensoes ? calcularLitros({ comprimento: profundidade, largura, altura }) : null;

  // 1) Base: veículo pelo peso (regra fixa do projeto).
  let tipo = veiculoPorPeso(peso ?? 0) || (peso === null ? "passeio" : "truck");
  const motivos: string[] = [];
  if (peso !== null) motivos.push(`${String(peso).replace(".", ",")} kg`);
  else motivos.push("sem peso informado");

  // 2) Ajuste por dimensões: cubagem grande derruba a moto.
  if (litros !== null) {
    motivos.push(`${String(litros).replace(".", ",")} L (A×L×P)`);
    if (tipo === "moto" && litros > BAU_MOTO_PADRAO_L) {
      const alerta = alertaBauMoto(litros);
      if (litros > 160) {
        tipo = "fiorino";
        motivos.push("cubagem acima da capacidade máxima de moto (>160 L)");
      } else {
        tipo = "passeio";
        motivos.push(alerta ? `${alerta.texto.replace("⚠️ ", "")} — indicamos veículo de passeio` : "cubagem acima do baú padrão da moto (90 L)");
      }
    }
  }

  // 3) SLA por tipo de veículo.
  const cabeMoto = tipo === "moto";
  const agendamentoHoras = cabeMoto ? 0 : 24;
  const slaRotulo = cabeMoto ? "Atendimento imediato" : "Agende com 24h de antecedência";
  const nome = nomeDoVeiculo(tipo);

  // Frase consultiva (contrato literal com a operação).
  const mensagemBot = cabeMoto
    ? "Conforme peso e dimensões da sua mercadoria, o veículo indicado é: Moto. Este veículo você já consegue pedir de imediato."
    : `Conforme peso e dimensões da sua mercadoria, o veículo indicado é: ${nome}. Para este veículo, você precisa agendar com ao menos 24 horas de antecedência.`;

  return {
    tipo,
    nome,
    cabeMoto,
    agendamentoHoras,
    slaRotulo,
    litros,
    mensagemBot,
    justificativa: `Analisei ${motivos.join(" · ")}.`,
  };
}

/** Formata a cubagem para exibição ("64 L"). */
export function formatarLitros(litros: number | null): string {
  if (litros === null || !Number.isFinite(litros)) return "";
  return `${String(litros).replace(".", ",")} L`;
}
