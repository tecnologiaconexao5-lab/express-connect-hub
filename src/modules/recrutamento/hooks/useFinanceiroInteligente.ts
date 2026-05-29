/**
 * useFinanceiroInteligente.ts
 * Hook para sincronização bidirecional inteligente de valores financeiros
 * Evita loops infinitos com tracking de mudanças e debounce
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  calcularFinanceiroInteligente,
  detectarMudancasFinanceiras,
  parseValorUsuario,
  debounce,
} from '../utils/calculateOperationFinances'
import type { FinanceiroOperacaoExpandido } from '../types/operationAnnouncement'
import type { CalculoTrigger } from '../utils/calculateOperationFinances'

interface UseFinanceiroInteligenteConfig {
  delayMs?: number // Debounce delay
  onMudanca?: (novoFinanceiro: FinanceiroOperacaoExpandido) => void
}

/**
 * Hook que gerencia sincronização de campos financeiros
 * Sem loop infinito, com validação e debounce
 */
export function useFinanceiroInteligente(
  financeiro: FinanceiroOperacaoExpandido,
  config: UseFinanceiroInteligenteConfig = {}
) {
  const { delayMs = 300, onMudanca } = config

  // Estado local para rastreamento
  const [estado, setEstado] = useState<FinanceiroOperacaoExpandido>(financeiro)
  const [ultimosCamposMudados, setUltimosCSamposMudados] = useState<
    (keyof FinanceiroOperacaoExpandido)[]
  >([])
  const [warnings, setWarnings] = useState<string[]>([])
  const ultimoFinanceiroRef = useRef(financeiro)

  // Detector de mudanças externas (prop changes)
  useEffect(() => {
    const { houveMudanca, camposMudados } = detectarMudancasFinanceiras(
      ultimoFinanceiroRef.current,
      financeiro
    )

    if (houveMudanca) {
      setEstado(financeiro)
      ultimoFinanceiroRef.current = financeiro
    }
  }, [financeiro])

  /**
   * Debounced handler de mudança de campo
   */
  const debouncedCalcular = useCallback(
    debounce((trigger: CalculoTrigger) => {
      const resultado = calcularFinanceiroInteligente(trigger)

      setEstado(resultado)
      setWarnings(resultado.warnings || [])
      ultimoFinanceiroRef.current = resultado

      if (onMudanca) {
        onMudanca(resultado)
      }
    }, delayMs),
    [delayMs, onMudanca]
  )

  /**
   * Handler para alteração de valor prestador
   * Trigger cálculo automático de percentual
   */
  const setValorPrestador = useCallback(
    (valor: string | number) => {
      const numerico = typeof valor === 'string' ? parseValorUsuario(valor) : valor

      debouncedCalcular({
        tipo: 'valorPrestador',
        novoValor: numerico,
        financeiro: estado,
      })
    },
    [estado, debouncedCalcular]
  )

  /**
   * Handler para alteração de percentual prestador
   * Trigger cálculo automático de valor
   */
  const setPercentualPrestador = useCallback(
    (valor: string | number) => {
      const numerico = typeof valor === 'string' ? parseFloat(valor) || 0 : valor

      debouncedCalcular({
        tipo: 'percentualPrestador',
        novoValor: numerico,
        financeiro: estado,
      })
    },
    [estado, debouncedCalcular]
  )

  /**
   * Handler para alteração de KM excedente prestador
   */
  const setKmExcedentePrestador = useCallback(
    (valor: string | number) => {
      const numerico = typeof valor === 'string' ? parseValorUsuario(valor) : valor

      debouncedCalcular({
        tipo: 'kmExcedentePrestador',
        novoValor: numerico,
        financeiro: estado,
      })
    },
    [estado, debouncedCalcular]
  )

  /**
   * Handler para alteração de % KM excedente
   */
  const setPercentualKmExcedente = useCallback(
    (valor: string | number) => {
      const numerico = typeof valor === 'string' ? parseFloat(valor) || 0 : valor

      debouncedCalcular({
        tipo: 'percentualKmExcedente',
        novoValor: numerico,
        financeiro: estado,
      })
    },
    [estado, debouncedCalcular]
  )

  /**
   * Atualiza campos simples (sem cálculo automático)
   */
  const atualizarCampoSimples = useCallback(
    (campo: keyof FinanceiroOperacaoExpandido, valor: any) => {
      const novoEstado = {
        ...estado,
        [campo]: valor,
      }
      setEstado(novoEstado)
      ultimoFinanceiroRef.current = novoEstado

      if (onMudanca) {
        onMudanca(novoEstado)
      }
    },
    [estado, onMudanca]
  )

  /**
   * Atualiza cliente (pode disparar recálculos)
   */
  const setValorCliente = useCallback(
    (valor: string | number) => {
      const numerico = typeof valor === 'string' ? parseValorUsuario(valor) : valor

      const novoEstado = {
        ...estado,
        valorCliente: numerico,
      }

      // Se prestador já foi preenchido, recalcular %
      if (estado.valorPrestador > 0) {
        const percentual = (estado.valorPrestador / numerico) * 100
        novoEstado.percentualPrestadorVsCliente = Math.round(percentual * 100) / 100
      }

      setEstado(novoEstado)
      ultimoFinanceiroRef.current = novoEstado

      if (onMudanca) {
        onMudanca(novoEstado)
      }
    },
    [estado, onMudanca]
  )

  /**
   * Atualiza cliente KM (pode disparar recálculos)
   */
  const setKmExcedenteCliente = useCallback(
    (valor: string | number) => {
      const numerico = typeof valor === 'string' ? parseValorUsuario(valor) : valor

      const novoEstado = {
        ...estado,
        kmExcedenteCliente: numerico,
      }

      // Se prestador KM já foi preenchido, recalcular %
      if (estado.kmExcedentePrestador > 0) {
        const percentual = (estado.kmExcedentePrestador / numerico) * 100
        novoEstado.percentualKmExcedentePrestador = Math.round(percentual * 100) / 100
      }

      setEstado(novoEstado)
      ultimoFinanceiroRef.current = novoEstado

      if (onMudanca) {
        onMudanca(novoEstado)
      }
    },
    [estado, onMudanca]
  )

  return {
    // Estado
    estado,
    warnings,

    // Handlers bidirecionais
    setValorPrestador,
    setPercentualPrestador,
    setKmExcedentePrestador,
    setPercentualKmExcedente,
    setValorCliente,
    setKmExcedenteCliente,

    // Handler genérico
    atualizarCampoSimples,

    // Getters formatados
    getValorPrestadorFormatado: () => {
      const valor = estado.valorPrestador
      return valor > 0 ? `R$ ${valor.toFixed(2)}` : ''
    },
    getPercentualPrestadorFormatado: () => {
      const valor = estado.percentualPrestadorVsCliente
      return valor > 0 ? `${valor.toFixed(2)}%` : ''
    },
    getKmExcedentePrestadorFormatado: () => {
      const valor = estado.kmExcedentePrestador
      return valor > 0 ? `R$ ${valor.toFixed(2)}` : ''
    },
    getPercentualKmExcedenteFormatado: () => {
      const valor = estado.percentualKmExcedentePrestador
      return valor > 0 ? `${valor.toFixed(2)}%` : ''
    },
  }
}

/**
 * Hook para gerenciar logística operacional
 */
import type { LogisticaOperacao, ProgramacaoOperacional } from '../types/operationAnnouncement'

export function useLogisticaOperacional(logistica: LogisticaOperacao) {
  const [estado, setEstado] = useState<LogisticaOperacao>(logistica)

  // Atualizar campo simples
  const atualizarCampo = useCallback(
    (campo: keyof LogisticaOperacao, valor: any) => {
      setEstado((prev) => ({
        ...prev,
        [campo]: valor,
      }))
    },
    []
  )

  // Adicionar programação operacional
  const adicionarProgramacao = useCallback((prog: ProgramacaoOperacional) => {
    setEstado((prev) => ({
      ...prev,
      programacaoOperacional: [...(prev.programacaoOperacional || []), prog],
    }))
  }, [])

  // Remover programação
  const removerProgramacao = useCallback((index: number) => {
    setEstado((prev) => ({
      ...prev,
      programacaoOperacional: prev.programacaoOperacional?.filter((_, i) => i !== index),
    }))
  }, [])

  // Atualizar programação
  const atualizarProgramacao = useCallback(
    (index: number, prog: ProgramacaoOperacional) => {
      setEstado((prev) => ({
        ...prev,
        programacaoOperacional: prev.programacaoOperacional?.map((p, i) =>
          i === index ? prog : p
        ),
      }))
    },
    []
  )

  return {
    estado,
    atualizarCampo,
    adicionarProgramacao,
    removerProgramacao,
    atualizarProgramacao,
  }
}
