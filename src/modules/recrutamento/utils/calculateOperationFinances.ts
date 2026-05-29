/**
 * Cálculos Bidirecionais Inteligentes para Financeiro
 * 
 * Sincronização sem loop infinito:
 * - Se preencher valor prestador → calcula %
 * - Se preencher % prestador → calcula valor
 * - Mesma lógica para KM excedente
 * 
 * Utiliza debounce e validação para evitar ciclos
 */

import type { FinanceiroOperacaoExpandido } from '../types/operationAnnouncement'

export interface CalculoTrigger {
  tipo: 'valorPrestador' | 'percentualPrestador' | 'kmExcedentePrestador' | 'percentualKmExcedente'
  novoValor: number
  financeiro: FinanceiroOperacaoExpandido
}

export interface ResultadoCalculo extends FinanceiroOperacaoExpandido {
  warnings?: string[]
  calculosRealizados: string[]
}

/**
 * Calcula sincronização bidirecional inteligente
 * Evita loops usando tracking de qual campo disparou a mudança
 */
export function calcularFinanceiroInteligente(
  trigger: CalculoTrigger
): ResultadoCalculo {
  const resultado = { ...trigger.financeiro } as ResultadoCalculo
  resultado.warnings = []
  resultado.calculosRealizados = []

  const { tipo, novoValor, financeiro: fin } = trigger

  // Validações básicas
  if (novoValor < 0) {
    resultado.warnings?.push('Valores negativos não são permitidos')
    return resultado
  }

  // ===========================
  // GRUPO 1: VALOR PRESTADOR ↔ PERCENTUAL
  // ===========================

  if (tipo === 'valorPrestador') {
    resultado.valorPrestador = novoValor

    // Se cliente foi informado, calcular %
    if (fin.valorCliente && fin.valorCliente > 0) {
      const percentual = (novoValor / fin.valorCliente) * 100
      resultado.percentualPrestadorVsCliente = Math.round(percentual * 100) / 100
      resultado.calculosRealizados.push(
        `Percentual calculado: ${resultado.percentualPrestadorVsCliente}%`
      )
    } else {
      resultado.warnings?.push('Cliente não informado. Percentual não pode ser calculado.')
    }
  }

  if (tipo === 'percentualPrestador') {
    resultado.percentualPrestadorVsCliente = novoValor

    // Se cliente foi informado, calcular valor
    if (fin.valorCliente && fin.valorCliente > 0) {
      const valor = (fin.valorCliente * novoValor) / 100
      resultado.valorPrestador = Math.round(valor * 100) / 100
      resultado.calculosRealizados.push(
        `Valor prestador calculado: R$ ${resultado.valorPrestador.toFixed(2)}`
      )
    } else {
      resultado.warnings?.push('Cliente não informado. Valor não pode ser calculado.')
    }
  }

  // ===========================
  // GRUPO 2: KM EXCEDENTE ↔ PERCENTUAL KM
  // ===========================

  if (tipo === 'kmExcedentePrestador') {
    resultado.kmExcedentePrestador = novoValor

    // Se cliente km foi informado, calcular %
    if (fin.kmExcedenteCliente && fin.kmExcedenteCliente > 0) {
      const percentual = (novoValor / fin.kmExcedenteCliente) * 100
      resultado.percentualKmExcedentePrestador = Math.round(percentual * 100) / 100
      resultado.calculosRealizados.push(
        `% KM excedente calculado: ${resultado.percentualKmExcedentePrestador}%`
      )
    }
  }

  if (tipo === 'percentualKmExcedente') {
    resultado.percentualKmExcedentePrestador = novoValor

    // Se cliente km foi informado, calcular valor
    if (fin.kmExcedenteCliente && fin.kmExcedenteCliente > 0) {
      const valor = (fin.kmExcedenteCliente * novoValor) / 100
      resultado.kmExcedentePrestador = Math.round(valor * 100) / 100
      resultado.calculosRealizados.push(
        `Valor KM excedente calculado: R$ ${resultado.kmExcedentePrestador.toFixed(2)}`
      )
    }
  }

  // ===========================
  // CÁLCULOS DERIVADOS
  // ===========================

  // Calcular margem transportadora (confidencial, mas necessário internamente)
  if (fin.valorCliente && resultado.valorPrestador) {
    const margem = fin.valorCliente - resultado.valorPrestador
    resultado.margemTransportadora = Math.round(margem * 100) / 100
  }

  return resultado
}

/**
 * Formata valores para display em campos de input
 * Remove zeros desnecessários
 */
export function formatarValorExibicao(valor: number | undefined): string {
  if (valor === undefined || valor === null) return ''
  if (valor === 0) return '0'
  return valor.toFixed(2).replace(/\.?0+$/, '')
}

/**
 * Parsa valor digitado do usuário
 * Remove formatação e converte para número
 */
export function parseValorUsuario(texto: string): number {
  // Remove R$, espaços, pontos de milhar
  const limpo = texto
    .replace(/R\$\s?/g, '')
    .replace(/\./g, '') // Remove pontos
    .replace(',', '.') // Converte vírgula em ponto

  const numero = parseFloat(limpo)
  return isNaN(numero) ? 0 : numero
}

/**
 * Formata moeda em padrão brasileiro
 */
export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor)
}

/**
 * Formata percentual
 */
export function formatarPercentual(valor: number | undefined): string {
  if (valor === undefined || valor === null) return ''
  return `${valor.toFixed(2).replace(/\.?0+$/, '')}%`
}

/**
 * Valida se valor para prestador é razoável
 * (não pode ser > valor cliente)
 */
export function validarValorPrestador(
  valorPrestador: number,
  valorCliente: number
): { valido: boolean; mensagem?: string } {
  if (valorPrestador > valorCliente) {
    return {
      valido: false,
      mensagem: 'Valor do prestador não pode ser maior que o valor do cliente',
    }
  }

  if (valorCliente > 0 && valorPrestador / valorCliente < 0.5) {
    return {
      valido: true, // Aviso, mas não invalida
      mensagem: 'Atenção: Prestador receberá menos de 50% do valor cliente',
    }
  }

  return { valido: true }
}

/**
 * Calcula margem e lucro da operação
 */
export interface AnaliseFinanceira {
  margemBruta: number
  margemPercentual: number
  lucroEstimado: number
  status: 'saudavel' | 'alerta' | 'critico'
}

export function analisarFinanceiro(
  financeiro: FinanceiroOperacaoExpandido,
  vagasTotais: number
): AnaliseFinanceira {
  const margemBruta = (financeiro.valorCliente || 0) - (financeiro.valorPrestador || 0)
  const margemPercentual =
    (financeiro.valorCliente || 0) > 0
      ? (margemBruta / (financeiro.valorCliente || 1)) * 100
      : 0

  const lucroEstimado = margemBruta * vagasTotais

  let status: 'saudavel' | 'alerta' | 'critico' = 'saudavel'
  if (margemPercentual < 15) status = 'alerta'
  if (margemPercentual < 10) status = 'critico'

  return {
    margemBruta,
    margemPercentual,
    lucroEstimado,
    status,
  }
}

/**
 * Hook de debounce para evitar cálculos excessivos
 * Deve ser usado em useEffect com delay apropriado
 */
export function debounce<T extends (...args: any[]) => any>(func: T, delay: number) {
  let timeoutId: NodeJS.Timeout
  return function (...args: Parameters<T>) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  } as T
}

/**
 * Compara dois objetos financeiros para detectar mudanças
 */
export function detectarMudancasFinanceiras(
  anterior: FinanceiroOperacaoExpandido,
  atual: FinanceiroOperacaoExpandido
): {
  houveMudanca: boolean
  camposMudados: (keyof FinanceiroOperacaoExpandido)[]
} {
  const campos = Object.keys(anterior) as (keyof FinanceiroOperacaoExpandido)[]
  const camposMudados: (keyof FinanceiroOperacaoExpandido)[] = []

  campos.forEach((campo) => {
    if (anterior[campo] !== atual[campo]) {
      camposMudados.push(campo)
    }
  })

  return {
    houveMudanca: camposMudados.length > 0,
    camposMudados,
  }
}

/**
 * Gera relatório financeiro para exibição interna
 * (NUNCA mostrar para prestador)
 */
export interface RelatórioFinanceiro {
  titulo: string
  linhas: string[]
  rodape: string
}

export function gerarRelatórioFinanceiro(
  financeiro: FinanceiroOperacaoExpandido,
  meta: { vagasTotais: number; vagasPreenchidas: number }
): RelatórioFinanceiro {
  const linhas: string[] = []

  linhas.push(`Valor Cliente: ${formatarMoeda(financeiro.valorCliente || 0)}`)
  linhas.push(`Valor Prestador: ${formatarMoeda(financeiro.valorPrestador || 0)}`)
  linhas.push(`Margem Bruta: ${formatarMoeda((financeiro.valorCliente || 0) - (financeiro.valorPrestador || 0))}`)

  if (financeiro.percentualImposto) {
    linhas.push(`Imposto (${financeiro.percentualImposto}%): ${formatarMoeda(financeiro.valorImposto || 0)}`)
  }
  if (financeiro.percentualSeguro) {
    linhas.push(`Seguro (${financeiro.percentualSeguro}%): ${formatarMoeda(financeiro.valorSeguro || 0)}`)
  }

  linhas.push('')
  linhas.push(`Margem Transportadora: ${formatarMoeda(financeiro.margemTransportadora || 0)}`)
  linhas.push(`Receita Líquida (por unidade): ${formatarMoeda(financeiro.receitaLiquida || 0)}`)

  linhas.push('')
  linhas.push(`Vagas Totais: ${meta.vagasTotais}`)
  linhas.push(`Vagas Preenchidas: ${meta.vagasPreenchidas}`)
  linhas.push(`Lucro Total Estimado: ${formatarMoeda((financeiro.receitaLiquida || 0) * meta.vagasPreenchidas)}`)

  return {
    titulo: 'ANÁLISE FINANCEIRA OPERAÇÃO',
    linhas,
    rodape: '⚠️ CONFIDENCIAL - Não compartilhar com prestadores',
  }
}
