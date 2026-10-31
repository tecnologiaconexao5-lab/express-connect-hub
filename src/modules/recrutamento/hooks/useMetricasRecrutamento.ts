import { useState, useEffect, useCallback } from 'react'
import { enterpriseKanbanService } from '../components/enterprise-kanban/enterpriseKanbanService'

export interface MetricasOperacionais {
  totalCandidatos: number
  aptos: number
  pendentes: number
  bloqueados: number
  preSelecionados: number
  onboardingConcluido: number
  onboardingEmAndamento: number
  disponiveisImediatos: number
  indisponiveis: number
  pipelinePorEtapa: { etapa: string; quantidade: number }[]
  statusDocumental: { status: string; quantidade: number }[]
  taxaConversaoPipeline: number
  tempoMedioOnboarding: string
}

export function useMetricasRecrutamento() {
  const [metricas, setMetricas] = useState<MetricasOperacionais | null>(null)
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const todos = await enterpriseKanbanService.listar()
      const aptos = todos.filter(c => c.statusOperacional === 'apto')
      const preSelecionados = todos.filter(c => c.tags.includes('preSelecionado' as any))
      const onboardingC = todos.filter(c => c.onboardingStatus === 'concluido')
      const onboardingE = todos.filter(c => c.onboardingStatus === 'em_andamento')
      const dispImediata = todos.filter(c => c.disponibilidadeTipo === 'imediata')
      const indisponivel = todos.filter(c => c.disponibilidadeTipo === 'indisponivel')

      const pipelineMap: Record<string, number> = {}
      for (const c of todos) {
        pipelineMap[c.stage] = (pipelineMap[c.stage] || 0) + 1
      }
      const pipelinePorEtapa = Object.entries(pipelineMap)
        .map(([etapa, quantidade]) => ({ etapa, quantidade }))
        .sort((a, b) => b.quantidade - a.quantidade)

      const docMap: Record<string, number> = {}
      for (const c of todos) {
        docMap[c.statusDocumental] = (docMap[c.statusDocumental] || 0) + 1
      }
      const statusDocumental = Object.entries(docMap)
        .map(([status, quantidade]) => ({ status, quantidade }))

      const total = todos.length
      const aprovados =
        (pipelineMap['homologado_disponivel'] ?? 0) +
        (pipelineMap['homologado_indisponivel'] ?? 0) +
        (pipelineMap['aprovado'] ?? 0)
      const taxaConversaoPipeline = total > 0 ? Math.round((aprovados / total) * 100) : 0

      const tempoMedioOnboarding = onboardingC.length > 0
        ? '~3 dias (estimado)'
        : '—'

      setMetricas({
        totalCandidatos: total,
        aptos: aptos.length,
        pendentes: todos.filter(c => c.statusOperacional === 'pendente').length,
        bloqueados: todos.filter(c => c.statusOperacional === 'bloqueado').length,
        preSelecionados: preSelecionados.length,
        onboardingConcluido: onboardingC.length,
        onboardingEmAndamento: onboardingE.length,
        disponiveisImediatos: dispImediata.length,
        indisponiveis: indisponivel.length,
        pipelinePorEtapa,
        statusDocumental,
        taxaConversaoPipeline,
        tempoMedioOnboarding,
      })
    } catch {
      setMetricas(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  return { metricas, loading, recarregar: carregar }
}
