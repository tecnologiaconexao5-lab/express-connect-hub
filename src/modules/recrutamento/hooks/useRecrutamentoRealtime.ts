import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const TABLE = 'recrutamento_prestadores'

export function usePrestadoresRealtime(onReload: () => void) {
  const onReloadRef = useRef(onReload)
  onReloadRef.current = onReload

  useEffect(() => {
    const channel = supabase
      .channel('prestadores-realtime')
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