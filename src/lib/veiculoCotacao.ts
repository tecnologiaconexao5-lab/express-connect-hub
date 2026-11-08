// ============================================================
// COTACAO-EXPRESS PREMIUM — motor de indicação de veículo + SLA
// Módulo puro (sem I/O) usado pelo chat /cotacao-express.
//
// Combina a regra fixa de peso (veiculoPeso.ts: 40/150/600/1000/
// 1800/2500 kg) com a cubagem real (cubagem.ts: A×L×P / 1000) para
// indicar o veículo certo ao cliente ANTES do cálculo do frete:
//   • cabe em moto (peso ≤ 40 kg e ≤ 90 L no baú) → atendimento imediato
//   • precisa de veículo maior → agendamento com 24h de antecedência
//   • cubagem total (volumes) vs capacidade em m³ por veículo → eleva
//     até Carreta; se nenhum couber, mantém o veículo atual
//
// Substitui o aviso genérico "acima de 40kg é outro veículo" por uma
// recomendação consultiva: veículo nomeado + regra de SLA na mesma frase.
//
// Entrada aceita tanto as 3 dimensões unitárias (legado) quanto uma
// lista de `volumes` (etapa 4 do wizard: qtd × A×L×P por item).
// ============================================================
import { veiculoPorPeso } from "@/lib/veiculoPeso";
import { alertaBauMoto, calcularLitros, BAU_MOTO_PADRAO_L } from "@/lib/cubagem";

/** Item/volume informado na etapa 4 do wizard (qtd × dimensões em cm). */
export interface VolumeCarga {
  /** Quantidade de itens iguais (≥ 1). */
  qtd: number;
  alturaCm: number;
  larguraCm: number;
  profundidadeCm: number;
}

export interface EntradaAnaliseCarga {
  pesoKg: number | null;
  alturaCm?: number | null;
  larguraCm?: number | null;
  profundidadeCm?: number | null;
  /**
   * Lista dinâmica de itens/volumes (preferida quando presente e não
   * vazia). A cubagem total passa a ser Σ(qtd × A×L×P/1000).
   */
  volumes?: VolumeCarga[];
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
  carreta: "Carreta",
};

const nomeDoVeiculo = (tipo: string): string =>
  NOMES_VEICULO_COTACAO[tipo] || tipo.charAt(0).toUpperCase() + tipo.slice(1);

/**
 * Capacidade de carga útil em m³ por tipo de veículo (cross-check da
 * cubagem total). Moto é tratada pelas regras do baú (litros) antes
 * deste passo — por isso não entra na tabela.
 */
export const CAPACIDADE_VEICULO_M3: Record<string, number> = {
  passeio: 1,
  fiorino: 3,
  kombi: 6,
  hr: 12,
  vuc: 15,
  truck: 35,
  carreta: 70,
};

/** Ordem crescente de capacidade (elevação só "para cima"). */
const ORDEM_CAPACIDADE = ["passeio", "fiorino", "kombi", "hr", "vuc", "truck", "carreta"];

const r2 = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100;

const fmtM3 = (m3: number): string => `${String(r2(m3)).replace(".", ",")} m³`;

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
 *     Depois, a cubagem total em m³ é cruzada com a capacidade
 *     por veículo (CAPACIDADE_VEICULO_M3) — eleva até Carreta
 *     quando necessário, nunca rebaixa e nunca baixa de moto
 *     (moto é decidida só pelas regras do baú acima).
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
  // Cubagem: lista de volumes (etapa 4) quando existe; senão legado A×L×P.
  const volumes = (entrada.volumes ?? []).filter(
    (v) => v && v.qtd > 0 && v.alturaCm > 0 && v.larguraCm > 0 && v.profundidadeCm > 0,
  );
  const usouVolumes = volumes.length > 0;
  const litros = usouVolumes
    ? r2(
        volumes.reduce(
          (soma, v) =>
            soma + calcularLitros({ comprimento: v.profundidadeCm, largura: v.larguraCm, altura: v.alturaCm }) * v.qtd,
          0,
        ),
      )
    : temDimensoes
      ? calcularLitros({ comprimento: profundidade, largura, altura })
      : null;

  // 1) Base: veículo pelo peso (regra fixa do projeto).
  let tipo = veiculoPorPeso(peso ?? 0) || (peso === null ? "passeio" : "truck");
  const motivos: string[] = [];
  if (peso !== null) motivos.push(`${String(peso).replace(".", ",")} kg`);
  else motivos.push("sem peso informado");

  // 2) Ajuste por dimensões: cubagem grande derruba a moto.
  if (litros !== null) {
    if (usouVolumes) {
      const totalItens = volumes.reduce((soma, v) => soma + v.qtd, 0);
      motivos.push(`${String(litros).replace(".", ",")} L em ${totalItens} volume(ns)`);
    } else {
      motivos.push(`${String(litros).replace(".", ",")} L (A×L×P)`);
    }
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

  // 2b) Cross-check: cubagem total (m³) × capacidade do veículo.
  //     Só eleva (nunca rebaixa) até Carreta; sem encaixe, mantém.
  if (litros !== null && litros > 0) {
    const cubagemM3 = litros / 1000;
    const capAtual = CAPACIDADE_VEICULO_M3[tipo];
    if (capAtual !== undefined && cubagemM3 > capAtual) {
      const alvo = ORDEM_CAPACIDADE.find(
        (t) => (CAPACIDADE_VEICULO_M3[t] ?? Number.POSITIVE_INFINITY) >= cubagemM3,
      );
      const rankAtual = ORDEM_CAPACIDADE.indexOf(tipo);
      if (alvo && ORDEM_CAPACIDADE.indexOf(alvo) > rankAtual) {
        const anterior = nomeDoVeiculo(tipo);
        tipo = alvo;
        motivos.push(`cubagem total ${fmtM3(cubagemM3)} excede os ${fmtM3(capAtual)} do ${anterior}`);
      } else if (!alvo) {
        motivos.push(`cubagem total ${fmtM3(cubagemM3)} acima de todos os veículos — mantemos ${nomeDoVeiculo(tipo)}`);
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

/**
 * Formata a cubagem total para o resumo: ≥ 1000 L vira m³
 * ("1,5 m³"); abaixo disso mantém litros ("64 L").
 */
export function formatarCubagem(litros: number | null): string {
  if (litros === null || !Number.isFinite(litros)) return "";
  return litros >= 1000 ? fmtM3(litros / 1000) : formatarLitros(litros);
}
