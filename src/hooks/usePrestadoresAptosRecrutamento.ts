import { useState, useEffect } from 'react'
import { enterpriseKanbanService } from '@/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanService'
import type { EnterpriseCandidate } from '@/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanTypes'

export interface InfoRecrutamento {
  candidato: EnterpriseCandidate
  prioridade: 'enviado_escala' | 'pre_selecionado' | 'onboarding_concluido' | 'disponivel_imediato'
  label: string
  cor: string
}

function determinarPrioridade(c: EnterpriseCandidate): InfoRecrutamento['prioridade'] {
  if (c.tags.includes('enviadoEscala')) return 'enviado_escala'
  if (c.tags.includes('preSelecionado')) return 'pre_selecionado'
  if (c.onboardingStatus === 'concluido') return 'onboarding_concluido'
  return 'disponivel_imediato'
}

function determinarLabel(prioridade: InfoRecrutamento['prioridade']): string {
  switch (prioridade) {
    case 'enviado_escala': return 'Enviado p/ Programação'
    case 'pre_selecionado': return 'Pré-selecionado'
    case 'onboarding_concluido': return 'Onboarding OK'
    case 'disponivel_imediato': return 'Disponível'
  }
}

function determinarCor(prioridade: InfoRecrutamento['prioridade']): string {
  switch (prioridade) {
    case 'enviado_escala': return 'bg-orange-100 text-orange-800 border-orange-300'
    case 'pre_selecionado': return 'bg-violet-100 text-violet-800 border-violet-300'
    case 'onboarding_concluido': return 'bg-emerald-100 text-emerald-800 border-emerald-300'
    case 'disponivel_imediato': return 'bg-sky-100 text-sky-800 border-sky-300'
  }
}

export function usePrestadoresAptosRecrutamento() {
  const [aptosPorPrestadorId, setAptosPorPrestadorId] = useState<Map<string, InfoRecrutamento> | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    setLoading(true)
    setErro(null)

    enterpriseKanbanService.listarPrestadoresAptos()
      .then((candidatos) => {
        if (!ativo) return
        const mapa = new Map<string, InfoRecrutamento>()
        for (const c of candidatos) {
          if (!c.prestadorId) continue
          const prioridade = determinarPrioridade(c)
          mapa.set(c.prestadorId, {
            candidato: c,
            prioridade,
            label: determinarLabel(prioridade),
            cor: determinarCor(prioridade),
          })
        }
        setAptosPorPrestadorId(mapa)
        setLoading(false)
      })
      .catch((err) => {
        if (!ativo) return
        console.warn('[Escala] Falha ao carregar prestadores aptos do Recrutamento:', err)
        setErro(String(err))
        setAptosPorPrestadorId(new Map())
        setLoading(false)
      })

    return () => { ativo = false }
  }, [])

  return { aptosPorPrestadorId, loading, erro }
}
