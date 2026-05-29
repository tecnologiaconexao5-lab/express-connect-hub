/**
 * Tipos para geração de anúncios operacionais profissionais
 * Separação: PUBLICO_PRESTADOR vs INTERNO_FINANCEIRO
 */

import type { Operacao } from './recrutamento'

// ===========================
// CAMPOS PÚBLICOS (Prestador)
// ===========================

export interface LogisticaOperacao {
  // Características Operacionais
  quantidadeMediaParadas?: number // ex: 10-18 paradas
  tipoOperacao?: 'fixa' | 'recorrente' | 'esporadica' | 'customizada' // tipo geral
  textoResumidoOperacional?: string // resumo narrativo da operação
  programacaoOperacional?: ProgramacaoOperacional[] // saídas, retornos

  // Veículo
  tipoVeiculoDetalhado?: string // "Van refrigerada 1.500kg" ou "Baú 8m³"
  volumeM3?: number // capacidade em m³
  aceitaTermo?: boolean // aceita veículo térmico
  aceitaRefrigerado?: boolean // aceita refrigerado

  // Carga
  perfilCarga?: string // "Cestas básicas", "Frutas/Verduras", etc
  temperaturaMinima?: number // em Celsius
  temperaturaMaxima?: number // em Celsius
}

export interface ProgramacaoOperacional {
  saida: string // horário saída (ex: "10:00")
  retorno?: string // horário retorno
  tipoEntrega: 'D+0' | 'D+1' | 'D+2' | 'outro'
  observacao?: string
}

export interface FinanceiroOperacaoExpandido {
  // Valores Prestador (PÚBLICO)
  valorPrestador: number // por saída/viagem
  franquiaKm: number // km inclusos
  kmExcedentePrestador: number // R$ por km adicional
  percentualPrestadorVsCliente?: number // % calculado automaticamente
  
  // KM Excedente Bidireccional
  kmExcedenteCliente?: number // cliente pode ter limite diferente
  percentualKmExcedentePrestador?: number // % do cliente

  // Pagamento (PÚBLICO)
  formaPagamento: string // "Quinzenal", "Semanal", etc
  prazoPagamento: number // dias
  dataPagamento?: string

  // Dados Internos/Confidenciais (NÃO MOSTRAR)
  valorCliente?: number
  percentualImposto?: number
  percentualSeguro?: number
  margemTransportadora?: number
  valorImposto?: number
  valorSeguro?: number
  receitaLiquida?: number
  custoTotal?: number
  lucroUnitario?: number
  lucroTotal?: number
  margem?: number
}

// ===========================
// ANÚNCIO PROFISSIONAL (Saída)
// ===========================

export interface OperationAnnouncementPublic {
  // Cabeçalho
  titulo: string // "SELEÇÃO DE PRESTADORES — OPERAÇÃO FIXA E RECORRENTE"
  introducao: string // descrição narrativa

  // Seções
  secaoVeiculo: string // requisitos de veículo
  secaoOperacao: string // resumo da operação
  secaoProgramacao: string // horários e programação
  secaoValores: string // valores e franquias
  secaoPerfil: string // perfil desejado
  secaoPagamento: string // forma de pagamento
  secaoImportante: string // informações importantes / CTA

  // Metadata
  dataCriacao: string
  operacaoId: string
  clienteNome: string
  publicoDestino: 'prestador' | 'supervisor' | 'gerente'
}

// ===========================
// CAMPOS CONFIDENCIAIS (Interno)
// ===========================

export type CampoConfidencial =
  | 'valorCliente'
  | 'margemTransportadora'
  | 'percentualImposto'
  | 'percentualSeguro'
  | 'valorImposto'
  | 'valorSeguro'
  | 'receitaLiquida'
  | 'custoTotal'
  | 'lucroUnitario'
  | 'lucroTotal'
  | 'margem'
  | 'percentualKmExcedenteCliente'

export interface VisibilidadeInfo {
  camposPublicos: string[]
  camposConfidenciais: CampoConfidencial[]
  mostrarEmAnuncio: boolean
}
