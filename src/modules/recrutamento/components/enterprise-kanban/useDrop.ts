import { useRef, useEffect } from 'react'
import type { PipelineStage } from './enterpriseKanbanTypes'

export function useDrop(stage: PipelineStage, onMove: (id: string, stage: PipelineStage) => void) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.dataTransfer!.dropEffect = 'move'
      el.classList.add('bg-primary/5', 'border-primary/30')
    }

    const handleDragLeave = () => {
      el.classList.remove('bg-primary/5', 'border-primary/30')
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      el.classList.remove('bg-primary/5', 'border-primary/30')
      const id = e.dataTransfer?.getData('text/plain')
      if (id) {
        onMove(id, stage)
      }
    }

    el.addEventListener('dragover', handleDragOver)
    el.addEventListener('dragleave', handleDragLeave)
    el.addEventListener('drop', handleDrop)

    return () => {
      el.removeEventListener('dragover', handleDragOver)
      el.removeEventListener('dragleave', handleDragLeave)
      el.removeEventListener('drop', handleDrop)
    }
  }, [stage, onMove])

  return ref
}
