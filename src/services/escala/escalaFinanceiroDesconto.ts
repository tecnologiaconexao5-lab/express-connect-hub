// A31-J1.12 — Split/reconstrução do desconto na Escala sob o contrato oficial:
//   valor_desconto            = desconto CLIENTE
//   valor_desconto_prestador  = desconto/ajuste PRESTADOR
// Funções puras (testáveis) — a Escala passa a gravar/ler SEM contaminar pernas.

export interface SplitEscalaDesconto {
  valorFrete: number; // base cliente + parte POSITIVA do ajuste (desconto vai separado)
  valorDescontoCliente: number; // → valor_desconto (ajuste cliente negativo)
  valorDescontoPrestador: number; // → valor_desconto_prestador
}

/**
 * Divide o ajuste cliente (único campo da Escala, positivo=adicional / negativo=desconto)
 * e o desconto do prestador nos campos oficiais. Garante que o Total Cliente reconstruído
 * na Central (frete − desconto) seja igual a base + ajuste, SEM duplicidade.
 */
export function dividirDescontosEscala(
  ajusteCliente: number,
  descontoPrestador: number,
  valorBaseCliente: number
): SplitEscalaDesconto {
  const a = Number(ajusteCliente) || 0;
  return {
    valorFrete: valorBaseCliente + Math.max(a, 0),
    valorDescontoCliente: Math.max(0, -a),
    valorDescontoPrestador: Number(descontoPrestador) || 0,
  };
}

export interface ReconstruidoEscalaDesconto {
  ajusteCliente: number; // desconto cliente volta como ajuste negativo (campo Cliente da Escala)
  descontoPrestador: number; // campo Prestador da Escala
}

/**
 * Reabre a alocação: valor_desconto → campo Cliente (ajuste negativo);
 * valor_desconto_prestador → campo Prestador (com fallback legado para valor_desconto,
 * pois alocações antigas gravavam o desconto do prestador em valor_desconto).
 */
export function reconstruirDescontosEscala(
  valorDesconto: number,
  valorDescontoPrestador: number
): ReconstruidoEscalaDesconto {
  const cliente = Number(valorDesconto) || 0;
  const prestador = Number(valorDescontoPrestador) || 0;
  if (prestador > 0) {
    // contrato novo: campos separados → valor_desconto é desconto do CLIENTE
    return { ajusteCliente: cliente > 0 ? -cliente : 0, descontoPrestador: prestador };
  }
  // legado: sem campo prestador → valor_desconto era o desconto do PRESTADOR
  return { ajusteCliente: 0, descontoPrestador: cliente };
}
