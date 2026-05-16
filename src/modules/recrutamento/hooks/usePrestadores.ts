import { useState, useEffect, useCallback } from 'react'
import { useRecrutamentoStore } from '../store/recrutamentoStore'
import { prestadoresService } from '../services/prestadoresService'
import type { Prestador, FiltrosPrestador, StatusPrestador } from '../types/recrutamento'

export function usePrestadores() {
  const { prestadores, setPrestadores, setPrestadoresLoading } = useRecrutamentoStore()
  const [filtros, setFiltros] = useState<FiltrosPrestador>({
    busca: '',
    status: [],
    scoreMin: 0,
    scoreMax: 100,
    tipoVeiculo: [],
    regiao: [],
    onboarding: [],
    canalCaptacao: [],
  })
  const [loading, setLoading] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setPrestadoresLoading(true)
    try {
      const data = await prestadoresService.listar(filtros)
      setPrestadores(data)
    } catch (error) {
      console.error('Erro ao carregar prestadores:', error)
    } finally {
      setLoading(false)
      setPrestadoresLoading(false)
    }
  }, [filtros, setPrestadores, setPrestadoresLoading])

  useEffect(() => { carregar() }, [carregar])

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
  }
}