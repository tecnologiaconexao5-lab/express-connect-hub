import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const TABELA_ALOCACOES = 'alocacoes_escala'

export function useEscalaRealtime(onChange: () => void) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const channel = supabase
      .channel('escala-operacional-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABELA_ALOCACOES },
        () => {
          onChangeRef.current?.()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])
}
