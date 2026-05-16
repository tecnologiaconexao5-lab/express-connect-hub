import { useState, useEffect, useCallback } from 'react'
import { useRecrutamentoStore } from '../store/recrutamentoStore'
import { operacoesService } from '../services/operacoesService'
import { matchService } from '../services/matchService'
import { prestadoresService } from '../services/prestadoresService'
import type { Operacao, FiltrosOperacao, StatusOperacao } from '../types/recrutamento'

export function useOperacoes() {
  const { operacoes, setOperacoes, setOperacoesLoading } = useRecrutamentoStore()
  const [filtros, setFiltros] = useState<FiltrosOperacao>({
    busca: '',
    status: [],
    prioridade: [],
    cliente: [],
    regiao: [],
    tipoVeiculo: [],
    dataInicio: '',
    dataFim: '',
  })
  const [loading, setLoading] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setOperacoesLoading(true)
    try {
      const data = await operacoesService.listar(filtros)
      setOperacoes(data)
    } catch (error) {
      console.error('Erro ao carregar operações:', error)
    } finally {
      setLoading(false)
      setOperacoesLoading(false)
    }
  }, [filtros, setOperacoes, setOperacoesLoading])

  useEffect(() => { carregar() }, [carregar])

  const criar = useCallback(async (data: Partial<Operacao>) => {
    const op = await operacoesService.criar(data)
    await carregar()

    const prestadores = await prestadoresService.buscarMock()
    matchService.executarMatchInteligente(op, prestadores).catch(console.warn)

    return op
  }, [carregar])

  const atualizar = useCallback(async (id: string, data: Partial<Operacao>) => {
    const result = await operacoesService.atualizar(id, data)
    await carregar()
    return result
  }, [carregar])

  const atualizarStatus = useCallback(async (id: string, status: StatusOperacao) => {
    await operacoesService.atualizarStatus(id, status)
    await carregar()
  }, [carregar])

  const remover = useCallback(async (id: string) => {
    await operacoesService.remover(id)
    await carregar()
  }, [carregar])

  const duplicar = useCallback(async (id: string) => {
    await operacoesService.duplicar(id)
    await carregar()
  }, [carregar])

  const metricas = operacoesService.obterMetricas(operacoes)

  return {
    operacoes,
    loading,
    filtros,
    setFiltros,
    criar,
    atualizar,
    atualizarStatus,
    remover,
    duplicar,
    metricas,
    recarregar: carregar,
  }
}