import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useEnterpriseKanbanStore } from '../components/enterprise-kanban/enterpriseKanbanStore'
import { enterpriseKanbanService } from '../components/enterprise-kanban/enterpriseKanbanService'

const TABLE = 'recrutamento_candidatos'

export function useKanbanRealtime(onReload: () => void) {
  const onReloadRef = useRef(onReload)
  onReloadRef.current = onReload

  useEffect(() => {
    const channel = supabase
      .channel('kanban-candidatos-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLE },
        () => {
          onReloadRef.current?.()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])
}
