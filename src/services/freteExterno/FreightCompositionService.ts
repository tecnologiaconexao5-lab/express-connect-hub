import { FreightProviderRegistry } from "./FreightProviderRegistry";

export type ComposicaoPerna = {
  executor: string;
  descricao: string;
  custo: number;
};

export type FreightCompositionResult = {
  pernaColeta: ComposicaoPerna;
  pernaPrincipal: ComposicaoPerna;
  pernaEntrega: ComposicaoPerna | null;
  custoOperacionalTotal: number;
  nivelServico: "PORTA_A_PORTA" | "RETIRADA_AEROPORTO";
  prazoTotal: number;
};

const CUSTO_COLETA_PADRAO = 150;
const PRAZO_COLETA_PADRAO = 1;
const CUSTO_ENTREGA_PADRAO = 120;
const PRAZO_ENTREGA_PADRAO = 1;
const DIGITOS_FORA_DE_AREA = ["0", "1", "2"];

export class FreightCompositionService {
  static async calcularRotaCompleta(
    provedorId: string,
    cepOrigem: string,
    cepDestino: string,
    volumes: any[],
    valorNota: number
  ): Promise<FreightCompositionResult> {
    const pernaColeta: ComposicaoPerna = {
      executor: "Conexão Express",
      descricao: `Coleta na origem (${cepOrigem}) até o hub`,
      custo: CUSTO_COLETA_PADRAO,
    };

    const provider = FreightProviderRegistry.obterProvedor(provedorId);
    const resultado = await provider.calcularCotacao({
      cepOrigem,
      cepDestino,
      volumes,
      valorNota,
    });

    const custoPrincipal = Number(resultado?.valor) || 0;
    const prazoPrincipal = Number(resultado?.prazo) || PRAZO_COLETA_PADRAO;
    const pernaPrincipal: ComposicaoPerna = {
      executor: resultado?.provedor || provedorId,
      descricao: `Frete principal ${resultado?.provedor || provedorId}`,
      custo: custoPrincipal,
    };

    const digitosDestino = (cepDestino || "").replace(/\D/g, "");
    const ultimoDigito = digitosDestino.slice(-1);
    const foraDeArea = DIGITOS_FORA_DE_AREA.includes(ultimoDigito);

    const pernaEntrega: ComposicaoPerna | null = foraDeArea
      ? null
      : {
          executor: "Parceiro Local",
          descricao: `Entrega no destino (${cepDestino})`,
          custo: CUSTO_ENTREGA_PADRAO,
        };

    const nivelServico: FreightCompositionResult["nivelServico"] = foraDeArea
      ? "RETIRADA_AEROPORTO"
      : "PORTA_A_PORTA";

    const custoOperacionalTotal =
      pernaColeta.custo + pernaPrincipal.custo + (pernaEntrega?.custo ?? 0);

    const prazoTotal =
      PRAZO_COLETA_PADRAO +
      prazoPrincipal +
      (pernaEntrega ? PRAZO_ENTREGA_PADRAO : 0);

    return {
      pernaColeta,
      pernaPrincipal,
      pernaEntrega,
      custoOperacionalTotal,
      nivelServico,
      prazoTotal,
    };
  }
}
