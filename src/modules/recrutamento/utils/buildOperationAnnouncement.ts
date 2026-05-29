/**
 * Builder de Anúncios Operacionais Profissionais
 * Transforma dados de operação em anúncio formatado para prestadores
 * Separação rigorosa: SOMENTE campos públicos aparecem
 */

import type { Operacao } from '../types/recrutamento'
import type { LogisticaOperacao, ProgramacaoOperacional, OperationAnnouncementPublic } from '../types/operationAnnouncement'

interface BuilderConfig {
  incluirCTA?: boolean
  mostrarObservacoes?: boolean
  temaEmojis?: boolean
  formatoWhatsApp?: boolean
}

/**
 * Constrói o anúncio profissional conforme padrão Conexão Express
 * Exemplo esperado:
 * 🚚 *SELEÇÃO DE PRESTADORES — OPERAÇÃO FIXA E RECORRENTE*
 * Estamos ampliando nossa base de prestadores...
 * ━━━━━━━━━━━━━━━━━━━
 * [seções organizadas]
 */
export function buildOperationAnnouncement(
  operacao: Operacao,
  logistica: LogisticaOperacao,
  config: BuilderConfig = {}
): OperationAnnouncementPublic {
  const {
    incluirCTA = true,
    mostrarObservacoes = true,
    temaEmojis = true,
    formatoWhatsApp = true,
  } = config

  // ===========================
  // SEÇÃO 1: CABEÇALHO
  // ===========================
  const titulo = temaEmojis
    ? `🚚 *SELEÇÃO DE PRESTADORES — OPERAÇÃO ${operacao.frequencia?.toUpperCase() || 'RECORRENTE'}*`
    : `SELEÇÃO DE PRESTADORES — OPERAÇÃO ${operacao.frequencia?.toUpperCase() || 'RECORRENTE'}`

  const introducao = `Estamos ampliando nossa base de prestadores parceiros para atuação em uma operação já consolidada, com demanda contínua e recorrência ao longo do ano.`

  // ===========================
  // SEÇÃO 2: VEÍCULO DA OPERAÇÃO
  // ===========================
  const secaoVeiculo = buildSecaoVeiculo(operacao, logistica, temaEmojis)

  // ===========================
  // SEÇÃO 3: RESUMO DA OPERAÇÃO
  // ===========================
  const secaoOperacao = buildSecaoOperacao(operacao, logistica, temaEmojis)

  // ===========================
  // SEÇÃO 4: PROGRAMAÇÃO OPERACIONAL
  // ===========================
  const secaoProgramacao = buildSecaoProgramacao(logistica, temaEmojis)

  // ===========================
  // SEÇÃO 5: VALORES
  // ===========================
  const secaoValores = buildSecaoValores(operacao, temaEmojis)

  // ===========================
  // SEÇÃO 6: PERFIL
  // ===========================
  const secaoPerfil = buildSecaoPerfil(temaEmojis)

  // ===========================
  // SEÇÃO 7: PAGAMENTO
  // ===========================
  const secaoPagamento = buildSecaoPagamento(operacao, temaEmojis)

  // ===========================
  // SEÇÃO 8: IMPORTANTE + CTA
  // ===========================
  const secaoImportante = buildSecaoImportante(incluirCTA, temaEmojis)

  return {
    titulo,
    introducao,
    secaoVeiculo,
    secaoOperacao,
    secaoProgramacao,
    secaoValores,
    secaoPerfil,
    secaoPagamento,
    secaoImportante,
    dataCriacao: new Date().toISOString(),
    operacaoId: operacao.id,
    clienteNome: operacao.cliente,
    publicoDestino: 'prestador',
  }
}

/**
 * Exporta anúncio em formato texto puro (para WhatsApp, copy-paste, etc)
 */
export function exportarAnuncioTexto(anuncio: OperationAnnouncementPublic): string {
  const linhas: string[] = [
    anuncio.titulo,
    '',
    anuncio.introducao,
    '',
    '━━━━━━━━━━━━━━━━━━━',
    '',
    `🚛 *VEÍCULO DA OPERAÇÃO*`,
    '',
    anuncio.secaoVeiculo,
    '',
    '━━━━━━━━━━━━━━━━━━━',
    '',
    `📦 *RESUMO DA OPERAÇÃO*`,
    '',
    anuncio.secaoOperacao,
    '',
    '━━━━━━━━━━━━━━━━━━━',
    '',
    `⏰ *PROGRAMAÇÃO OPERACIONAL*`,
    '',
    anuncio.secaoProgramacao,
    '',
    '━━━━━━━━━━━━━━━━━━━',
    '',
    `💰 *VALORES DA OPERAÇÃO*`,
    '',
    anuncio.secaoValores,
    '',
    '━━━━━━━━━━━━━━━━━━━',
    '',
    `🎯 *PERFIL ALINHADO À OPERAÇÃO*`,
    '',
    anuncio.secaoPerfil,
    '',
    '━━━━━━━━━━━━━━━━━━━',
    '',
    `💳 *FORMA DE PAGAMENTO*`,
    '',
    anuncio.secaoPagamento,
    '',
    '━━━━━━━━━━━━━━━━━━━',
    '',
    `📦 *IMPORTANTE*`,
    '',
    anuncio.secaoImportante,
    '',
    '━━━━━━━━━━━━━━━━━━━',
  ]

  return linhas.join('\n')
}

// ===========================
// BUILDERS DE SEÇÕES
// ===========================

function buildSecaoVeiculo(op: Operacao, log: LogisticaOperacao, emojis: boolean): string {
  const linhas: string[] = []

  if (log.tipoVeiculoDetalhado) {
    linhas.push(`${emojis ? '✔' : '•'} ${log.tipoVeiculoDetalhado}`)
  } else if (op.tipoVeiculo) {
    linhas.push(`${emojis ? '✔' : '•'} ${op.tipoVeiculo}`)
  }

  if (log.volumeM3) {
    linhas.push(`${emojis ? '✔' : '•'} Baú ${log.volumeM3}m³`)
  }

  // Tipo de carga aceita
  if (log.aceitaTermo || log.aceitaRefrigerado) {
    const tipos: string[] = []
    if (log.aceitaTermo) tipos.push('Térmico')
    if (log.aceitaRefrigerado) tipos.push('Refrigerado')
    linhas.push(`${emojis ? '✔' : '•'} Aceita: ${tipos.join(', ')}`)
  }

  return linhas.join('\n')
}

function buildSecaoOperacao(op: Operacao, log: LogisticaOperacao, emojis: boolean): string {
  const linhas: string[] = []

  if (log.textoResumidoOperacional) {
    linhas.push(log.textoResumidoOperacional)
    linhas.push('')
  }

  if (log.perfilCarga) {
    linhas.push(`${emojis ? '✔' : '•'} Produto: ${log.perfilCarga}`)
  } else if (op.tipoCarga) {
    const tipoCargaLabel: Record<string, string> = {
      seco: 'Carga Seca',
      refrigerado: 'Carga Refrigerada',
      perigoso: 'Carga Perigosa',
      fragil: 'Carga Frágil',
      alimenticio: 'Carga Alimentícia',
    }
    linhas.push(`${emojis ? '✔' : '•'} Produto: ${tipoCargaLabel[op.tipoCarga] || op.tipoCarga}`)
  }

  if (op.localCarregamento) {
    linhas.push(`${emojis ? '✔' : '•'} Carregamento: ${op.localCarregamento} – ${op.regiao || 'SP'}`)
  }

  if (op.localDescarregamento || op.regiao) {
    const destino = op.localDescarregamento || op.regiao
    linhas.push(`${emojis ? '✔' : '•'} Entregas: ${destino}${log.quantidadeMediaParadas ? ` conforme roteirização operacional` : ''}`)
  }

  if (log.quantidadeMediaParadas) {
    linhas.push(`${emojis ? '✔' : '•'} Média de ${log.quantidadeMediaParadas} paradas por saída`)
  }

  return linhas.join('\n')
}

function buildSecaoProgramacao(log: LogisticaOperacao, emojis: boolean): string {
  const linhas: string[] = []

  if (log.programacaoOperacional && log.programacaoOperacional.length > 0) {
    log.programacaoOperacional.forEach((prog) => {
      const emoji = emojis ? '📌' : '•'
      linhas.push(`${emoji} Saídas às ${prog.saida} → entregas ${prog.tipoEntrega}`)
      if (prog.observacao) {
        linhas.push(`   ${prog.observacao}`)
      }
    })
  } else {
    linhas.push(`${emojis ? '📌' : '•'} Saídas conforme demanda operacional`)
  }

  return linhas.join('\n')
}

function buildSecaoValores(op: Operacao, emojis: boolean): string {
  const linhas: string[] = []

  const fin = op.financeiro
  const emoji = emojis ? '✔' : '•'

  if (fin.valorPrestador > 0) {
    linhas.push(`${emoji} Repasse por saída: ${formatCurrency(fin.valorPrestador)}`)
  }

  if (fin.franquiaKm > 0) {
    linhas.push(`${emoji} Franquia inclusa: ${fin.franquiaKm} km ida + ${fin.franquiaKm} km volta`)
  }

  if (fin.kmExcedentePrestador > 0) {
    linhas.push(`${emoji} KM excedente: ${formatCurrency(fin.kmExcedentePrestador)} por km adicional`)
  }

  return linhas.join('\n')
}

function buildSecaoPerfil(emojis: boolean): string {
  const perfis = [
    'Compromisso com horários e rotas',
    'Organização nas entregas',
    'Boa comunicação com a operação',
    'Interesse em atuação contínua',
    'Perfil operacional e responsabilidade diária',
  ]

  const emoji = emojis ? '✔' : '•'
  return perfis.map((p) => `${emoji} ${p}`).join('\n')
}

function buildSecaoPagamento(op: Operacao, emojis: boolean): string {
  const linhas: string[] = []
  const emoji = emojis ? '✔' : '•'

  if (op.financeiro.formaPagamento) {
    linhas.push(`${emoji} ${op.financeiro.formaPagamento}`)

    // Indicar possível evolução
    if (op.financeiro.formaPagamento.toLowerCase().includes('quinzenal')) {
      linhas.push(`${emoji} Evolução para semanal conforme estabilidade operacional`)
    }
  }

  return linhas.join('\n')
}

function buildSecaoImportante(comCTA: boolean, emojis: boolean): string {
  const linhas: string[] = [
    `Operação estruturada, recorrente e com acompanhamento operacional durante toda a execução.`,
  ]

  if (comCTA) {
    linhas.push('')
    linhas.push(`${emojis ? '📲' : ''} Se estiver dentro do perfil, pode chamar para alinharmos início e disponibilidade operacional.`)
  }

  return linhas.join('\n')
}

// ===========================
// UTILITÁRIOS
// ===========================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

/**
 * Validação: verifica se operação tem campos suficientes para gerar anúncio
 */
export function validarOperacaoParaAnuncio(
  op: Operacao,
  log: LogisticaOperacao
): { valido: boolean; erros: string[] } {
  const erros: string[] = []

  if (!op.cliente) erros.push('Cliente não informado')
  if (!op.tipoVeiculo && !log.tipoVeiculoDetalhado) erros.push('Tipo de veículo não informado')
  if (!op.localCarregamento && !log.textoResumidoOperacional) erros.push('Local de carregamento ou descrição operacional não informado')
  if (!op.regiao) erros.push('Região de atuação não informada')
  if (op.financeiro.valorPrestador <= 0) erros.push('Valor do prestador deve ser maior que zero')
  if (op.financeiro.franquiaKm < 0) erros.push('Franquia KM não informada')
  if (!op.financeiro.formaPagamento) erros.push('Forma de pagamento não informada')

  return {
    valido: erros.length === 0,
    erros,
  }
}
