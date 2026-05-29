import { useState, useEffect, useCallback } from 'react'
import { useRecrutamentoStore } from '../store/recrutamentoStore'
import { prestadoresService } from '../services/prestadoresService'
import type { Prestador, FiltrosPrestador, StatusPrestador } from '../types/recrutamento'
import type { DivergenciaSync } from '../services/prestadoresService'

export function usePrestadores() {
  const { prestadores, setPrestadores, setPrestadoresLoading } = useRecrutamentoStore()
  const [filtros, setFiltros] = useState<FiltrosPrestador>({
    busca: '',
    status: [],
    scoreMin: 0,
    scoreMax: 100,
    tipoVeiculo: [],
    regiao: [],
    origemCadastro: [],
    onboarding: [],
    canalCaptacao: [],
  })
  const [loading, setLoading] = useState(false)
  const [divergencias, setDivergencias] = useState<DivergenciaSync[]>([])
  const [auditando, setAuditando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setPrestadoresLoading(true)
    try {
      const data = await prestadoresService.listar(filtros)
      setPrestadores(data)
      return data
    } catch (error) {
      console.error('Erro ao carregar prestadores:', error)
      return []
    } finally {
      setLoading(false)
      setPrestadoresLoading(false)
    }
  }, [filtros, setPrestadores, setPrestadoresLoading])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    if (prestadores.length > 0) {
      setAuditando(true)
      prestadoresService.auditarDivergencias(prestadores).then(divs => {
        setDivergencias(divs)
        setAuditando(false)
      })
    }
  }, [prestadores])

  const criar = useCallback(async (data: Partial<Prestador>) => {
    const result = await prestadoresService.criar(data)
    await carregar()
    return result
  }, [carregar])

  const atualizar = useCallback(async (id: string, data: Partial<Prestador>) => {
    const result = await prestadoresService.atualizar(id, data)
    await carregar()
    return result
  }, [carregar])

  const atualizarStatus = useCallback(async (id: string, status: StatusPrestador) => {
    await prestadoresService.atualizarStatus(id, status)
    await carregar()
  }, [carregar])

  const remover = useCallback(async (id: string) => {
    await prestadoresService.remover(id)
    await carregar()
  }, [carregar])

  const recalcularScore = useCallback(async (id: string) => {
    await prestadoresService.recalcularScore(id)
    await carregar()
  }, [carregar])

  const executarAuditoria = useCallback(async () => {
    if (prestadores.length === 0) return
    setAuditando(true)
    try {
      const divs = await prestadoresService.auditarDivergencias(prestadores)
      setDivergencias(divs)
    } catch (err) {
      console.error('[Auditoria] Erro:', err)
    } finally {
      setAuditando(false)
    }
  }, [prestadores])

  const corrigirDivergencia = useCallback(async (divergencia: DivergenciaSync): Promise<{ success: boolean; message: string }> => {
    const prestador = prestadores.find(p => p.id === divergencia.prestadorId)
    if (!prestador) return { success: false, message: 'Prestador não encontrado em memória.' }
    const resultado = await prestadoresService.corrigirDivergencia(divergencia, prestador)
    if (resultado.success) {
      await executarAuditoria()
    }
    return resultado
  }, [prestadores, executarAuditoria])

  const metricas = prestadoresService.obterMetricas(prestadores)

  return {
    prestadores,
    loading,
    filtros,
    setFiltros,
    criar,
    atualizar,
    atualizarStatus,
    remover,
    recalcularScore,
    metricas,
    recarregar: carregar,
    divergencias,
    auditando,
    corrigirDivergencia,
  }
}