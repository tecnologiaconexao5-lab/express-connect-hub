import { motion, AnimatePresence } from 'framer-motion'
import { useDrop } from './useDrop'
import { KanbanCard, KanbanCardSkeleton } from './KanbanCard'
import type { EnterpriseCandidate, PipelineStage } from './enterpriseKanbanTypes'
import { PIPELINE_COLUMNS, STAGE_TRANSITIONS } from './enterpriseKanbanTypes'
import { cn } from '../../utils/cn'

interface KanbanColumnProps {
  stage: PipelineStage
  candidates: EnterpriseCandidate[]
  loading?: boolean
  onMove: (id: string, stage: PipelineStage) => void
  draggingId: string | null
  pageSize: number
  page: number
  onLoadMore?: () => void
}

const STAGE_ICONS: Record<string, React.ReactNode> = {
  novo_cadastro: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" x2="19" y1="8" y2="14" /><line x1="22" x2="16" y1="11" y2="11" />
    </svg>
  ),
  em_analise: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" x2="16.65" y1="21" y2="16.65" />
    </svg>
  ),
  documentacao_pendente: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" x2="15" y1="15" y2="15" />
    </svg>
  ),
  em_validacao: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  entrevista: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  em_treinamento: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  aprovado: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  ativo: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  bloqueado: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  reprovado: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
}

export function KanbanColumn({
  stage,
  candidates,
  loading,
  onMove,
  draggingId,
  pageSize,
  page,
}: KanbanColumnProps) {
  const col = PIPELINE_COLUMNS.find(c => c.id === stage)!
  const possibleStages = STAGE_TRANSITIONS[stage] ?? []
  const dropRef = useDrop(stage, onMove)

  const visibleCandidates = candidates.slice(0, (page + 1) * pageSize)
  const hasMore = visibleCandidates.length < candidates.length

  return (
    <div
      ref={dropRef}
      className="flex flex-col min-w-[300px] w-[320px] max-w-[340px] shrink-0"
    >
      <div className={cn(
        'flex items-center justify-between px-3 py-2.5 rounded-t-xl border-t-2 bg-gradient-to-r',
        col.gradient,
      )}
        style={{ borderTopColor: col.color }}
      >
        <div className="flex items-center gap-2">
          <span className="text-foreground/70" style={{ color: col.color }}>
            {STAGE_ICONS[stage]}
          </span>
          <span className="text-sm font-semibold text-foreground">{col.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full tabular-nums">
            {candidates.length}
          </span>
        </div>
      </div>

      <div className={cn(
        'flex-1 space-y-2 p-2 rounded-b-xl min-h-[200px] transition-colors duration-200',
        'bg-muted/10 border-x border-b border-border/40',
      )}>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <KanbanCardSkeleton key={i} />)
        ) : (
          <AnimatePresence mode="popLayout">
            {visibleCandidates.map((candidate) => (
              <KanbanCard
                key={candidate.id}
                candidate={candidate}
                onMove={onMove}
                possibleStages={possibleStages}
                isDragging={draggingId === candidate.id}
              />
            ))}
          </AnimatePresence>
        )}

        {!loading && candidates.length === 0 && (
          <div className="flex flex-col items-center justify-center h-24 rounded-lg border border-dashed border-border/20 text-xs text-muted-foreground/30 gap-1">
            <svg className="w-6 h-6 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" /><path d="M5 12h14" />
            </svg>
            <span>Arraste cards para cá</span>
          </div>
        )}

        {hasMore && (
          <button
            onClick={() => {}}
            className="w-full py-2 text-[11px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors border border-dashed border-border/20 rounded-lg hover:border-border/40"
          >
            + {candidates.length - visibleCandidates.length} mais
          </button>
        )}
      </div>
    </div>
  )
}
