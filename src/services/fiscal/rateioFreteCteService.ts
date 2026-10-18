export interface DocumentoParaRateio {
  id: string;
  numero_nfe?: string | null;
  destinatario_nome?: string | null;
  peso_bruto?: number | null;
  valor_total?: number | null;
  municipio_destino?: string | null;
  uf_destino?: string | null;
}

export interface RateioItem {
  documentoId: string;
  valorRateado: number;
  percentual: number;
  ajuste: number;
}

export interface RateioLoteConfig {
  regra: "quantidade" | "peso" | "valor_nf" | "manual";
  valorTotal: number;
  valoresManuais?: Record<string, number>;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function calcularRateioPorQuantidade(
  documentos: DocumentoParaRateio[],
  valorTotal: number
): RateioItem[] {
  const qtd = documentos.length;
  if (qtd === 0) return [];

  const valorBase = round2(Math.floor((valorTotal / qtd) * 100) / 100);
  const rateios: RateioItem[] = documentos.map((doc, i) => ({
    documentoId: doc.id,
    valorRateado: valorBase,
    percentual: round2((1 / qtd) * 100),
    ajuste: 0,
  }));

  ajustarCentavos(rateios, valorTotal);
  return rateios;
}

export function calcularRateioPorPeso(
  documentos: DocumentoParaRateio[],
  valorTotal: number
): { rateios: RateioItem[]; erros: string[] } {
  const erros: string[] = [];
  const semPeso = documentos.filter((d) => !d.peso_bruto || d.peso_bruto <= 0);
  if (semPeso.length > 0) {
    erros.push(
      `${semPeso.length} documento(s) sem peso informado: ${
        semPeso.map((d) => d.numero_nfe || d.id.substring(0, 8)).join(", ")
      }. Use rateio por quantidade ou preencha o peso.`
    );
  }

  if (erros.length > 0) return { rateios: [], erros };

  const pesoTotal = documentos.reduce((sum, d) => sum + (d.peso_bruto || 0), 0);
  if (pesoTotal <= 0) {
    erros.push("Peso total zerado. Verifique os documentos.");
    return { rateios: [], erros };
  }

  const rateios: RateioItem[] = documentos.map((doc) => {
    const percentual = (doc.peso_bruto || 0) / pesoTotal;
    const valorRateado = round2(valorTotal * percentual);
    return {
      documentoId: doc.id,
      valorRateado,
      percentual: round2(percentual * 100),
      ajuste: 0,
    };
  });

  ajustarCentavos(rateios, valorTotal);
  return { rateios, erros };
}

export function calcularRateioPorValorNf(
  documentos: DocumentoParaRateio[],
  valorTotal: number
): { rateios: RateioItem[]; erros: string[] } {
  const erros: string[] = [];
  const semValor = documentos.filter((d) => !d.valor_total || d.valor_total <= 0);
  if (semValor.length > 0) {
    erros.push(
      `${semValor.length} documento(s) sem valor de NF-e: ${
        semValor.map((d) => d.numero_nfe || d.id.substring(0, 8)).join(", ")
      }.`
    );
  }

  if (erros.length > 0) return { rateios: [], erros };

  const valorNfTotal = documentos.reduce((sum, d) => sum + (d.valor_total || 0), 0);
  if (valorNfTotal <= 0) {
    erros.push("Valor total das NF-es zerado.");
    return { rateios: [], erros };
  }

  const rateios: RateioItem[] = documentos.map((doc) => {
    const percentual = (doc.valor_total || 0) / valorNfTotal;
    const valorRateado = round2(valorTotal * percentual);
    return {
      documentoId: doc.id,
      valorRateado,
      percentual: round2(percentual * 100),
      ajuste: 0,
    };
  });

  ajustarCentavos(rateios, valorTotal);
  return { rateios, erros };
}

export function validarRateioManual(
  valoresIndividuais: Record<string, number>,
  valorTotal: number
): { valido: boolean; soma: number; diferenca: number; mensagem?: string } {
  const soma = round2(Object.values(valoresIndividuais).reduce((s, v) => s + v, 0));
  const diferenca = round2(valorTotal - soma);

  if (Math.abs(diferenca) > 0.01) {
    return {
      valido: false,
      soma,
      diferenca,
      mensagem: `A soma dos valores individuais (${soma.toFixed(2)}) difere do valor total da rota (${valorTotal.toFixed(2)}). Diferença: ${diferenca.toFixed(2)}`,
    };
  }

  return { valido: true, soma, diferenca: 0 };
}

export function ajustarCentavos(rateios: RateioItem[], valorTotal: number): void {
  const somaAtual = round2(rateios.reduce((s, r) => s + r.valorRateado, 0));
  let diferenca = round2(valorTotal - somaAtual);

  if (Math.abs(diferenca) < 0.001) return;

  const centavosParaAjustar = Math.round(diferenca * 100);
  const sinal = centavosParaAjustar > 0 ? 1 : -1;

  const ultimoIdx = rateios.length - 1;
  rateios[ultimoIdx].valorRateado = round2(rateios[ultimoIdx].valorRateado + diferenca);
  rateios[ultimoIdx].ajuste = round2(diferenca);
}

export function calcularRateio(
  documentos: DocumentoParaRateio[],
  config: RateioLoteConfig
): { rateios: RateioItem[]; erros: string[] } {
  switch (config.regra) {
    case "quantidade":
      return { rateios: calcularRateioPorQuantidade(documentos, config.valorTotal), erros: [] };

    case "peso":
      return calcularRateioPorPeso(documentos, config.valorTotal);

    case "valor_nf":
      return calcularRateioPorValorNf(documentos, config.valorTotal);

    case "manual": {
      if (!config.valoresManuais) {
        return { rateios: [], erros: ["Valores manuais nao fornecidos."] };
      }
      const validacao = validarRateioManual(config.valoresManuais, config.valorTotal);
      if (!validacao.valido) {
        return { rateios: [], erros: [validacao.mensagem || "Erro na validacao manual."] };
      }
      const rateios: RateioItem[] = documentos.map((doc) => ({
        documentoId: doc.id,
        valorRateado: config.valoresManuais![doc.id] || 0,
        percentual: round2(((config.valoresManuais![doc.id] || 0) / config.valorTotal) * 100),
        ajuste: 0,
      }));
      return { rateios, erros: [] };
    }

    default:
      return { rateios: [], erros: ["Regra de rateio invalida."] };
  }
}
