import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRecrutamentoStore } from '../store/recrutamentoStore'

type TabelaRealtime = 'operacoes' | 'prestadores' | 'recrutamento_whatsapp_conversas'

export function useRecrutamentoRealtime(tabelas?: TabelaRealtime[]) {
  const { setOperacoes, setPrestadores } = useRecrutamentoStore()
  const subscriptions = useRef<{ unsubscribe: () => void }[]>([])

  useEffect(() => {
    const tables = tabelas ?? ['operacoes', 'prestadores']
    const subs = tables.map((tabela) => {
      return supabase
        .channel(`recrutamento_${tabela}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: tabela },
          () => {
            if (tabela === 'operacoes') {
              import('../services/operacoesService').then(({ operacoesService }) =>
                operacoesService.listar().then(setOperacoes)
              )
            }
            if (tabela === 'prestadores') {
              import('../services/prestadoresService').then(({ prestadoresService }) =>
                prestadoresService.listar().then(setPrestadores)
              )
            }
          }
        )
        .subscribe()
    })

    subscriptions.current = subs

    return () => {
      subs.forEach((s) => s.unsubscribe())
    }
  }, [tabelas?.join(',')])

  return { subscriptions: subscriptions.current }
}