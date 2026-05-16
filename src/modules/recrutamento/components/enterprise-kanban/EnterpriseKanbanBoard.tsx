import { useCallback, useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, ChevronLeft, ChevronRight, Users, TrendingUp, Award, AlertCircle } from 'lucide-react'
import { useEnterpriseKanban } from './useEnterpriseKanban'
import { KanbanColumn } from './KanbanColumn'
import { KanbanFilters } from './KanbanFilters'
import { PIPELINE_COLUMNS } from './enterpriseKanbanTypes'
import { enterpriseKanbanService } from './enterpriseKanbanService'
import { cn } from '../../utils/cn'

export function EnterpriseKanbanBoard() {
  const {
    filteredCandidates,
    loading,
    searchQuery,
    filters,
    draggingId,
    showFilters,
    page,
    pageSize,
    columns,
    filteredCount,
    totalCount,
    hasActiveFilters,
    handleSearchChange,
    handleFilterChange,
    handleResetFilters,
    handleMoveCandidate,
    toggleShowFilters,
    setDraggingId,
    nextPage,
    prevPage,
    setPage,
    setSelectedCandidateId,
  } = useEnterpriseKanban()

  const scrollRef = useRef<HTMLDivElement>(null)
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({})
  const [totalByStage, setTotalByStage] = useState<Record<string, number>>({})

  useEffect(() => {
    enterpriseKanbanService.getStageCounts().then((counts) => {
      const plain: Record<string, number> = {}
      for (const [k, v] of Object.entries(counts)) {
        plain[k] = v
      }
      setTotalByStage(plain)
    })
  }, [filteredCandidates])

  useEffect(() => {
    const counts: Record<string, number> = {}
    for (const [stage, candidates] of Object.entries(columns)) {
      counts[stage] = candidates.length
    }
    setStageCounts(counts)
  }, [columns])

  const handleDragStart = useCallback((e: React.DragEvent) => {
    const el = (e.target as HTMLElement).closest('[data-candidate-id]') as HTMLElement | null
    if (el?.dataset.candidateId) {
      setDraggingId(el.dataset.candidateId)
    }
  }, [setDraggingId])

  const handleDragEnd = useCallback(() => {
    setDraggingId(null)
  }, [setDraggingId])

  const hasMore = filteredCount > (page + 1) * pageSize * 10

  const avgScore = filteredCandidates.length > 0
    ? Math.round(filteredCandidates.reduce((a, c) => a + c.score, 0) / filteredCandidates.length)
    : 0

  return (
    <div className="flex flex-col h-full" onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Buscar por nome, cidade, placa, telefone..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-border/50 bg-card text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            )}
          </div>

          <KanbanFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onReset={handleResetFilters}
            show={showFilters}
            onToggle={toggleShowFilters}
            hasActiveFilters={hasActiveFilters}
          />
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground/60">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            <span className="font-medium text-foreground/80 tabular-nums">{filteredCount}</span>
            <span>de {totalCount} candidatos</span>
            {hasActiveFilters && (
              <span className="text-primary/60">(filtrado)</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Score médio:</span>
            <span className={cn(
              'font-bold tabular-nums',
              avgScore >= 70 ? 'text-emerald-400' : avgScore >= 50 ? 'text-amber-400' : 'text-rose-400',
            )}>
              {avgScore}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5" />
            <span>{PIPELINE_COLUMNS.length} estágios</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex gap-3 h-full overflow-x-auto pb-4">
            {PIPELINE_COLUMNS.map((col) => (
              <div key={col.id} className="flex flex-col min-w-[300px] w-[320px] shrink-0">
                <div className="flex items-center justify-between px-3 py-2.5 rounded-t-xl border-t-2 bg-muted/10 animate-pulse" style={{ borderTopColor: col.color }}>
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-5 w-8 bg-muted rounded-full" />
                </div>
                <div className="flex-1 space-y-2 p-2 rounded-b-xl bg-muted/5 border-x border-b border-border/40">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-border/60 bg-card p-3.5 animate-pulse">
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="w-11 h-11 rounded-xl bg-muted" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-4 w-32 bg-muted rounded" />
                            <div className="h-3 w-24 bg-muted rounded" />
                            <div className="h-3 w-28 bg-muted rounded" />
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <div className="h-4 w-16 bg-muted rounded" />
                          <div className="h-4 w-14 bg-muted rounded" />
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          <div className="h-6 bg-muted rounded-md" />
                          <div className="h-6 bg-muted rounded-md" />
                          <div className="h-6 bg-muted rounded-md" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div
              ref={scrollRef}
              className="flex gap-3 h-full overflow-x-auto pb-4 custom-scrollbar"
            >
              {PIPELINE_COLUMNS.map((col) => (
                <KanbanColumn
                  key={col.id}
                  stage={col.id}
                  candidates={columns[col.id] ?? []}
                  loading={false}
                  onMove={handleMoveCandidate}
                  draggingId={draggingId}
                  pageSize={pageSize}
                  page={page}
                />
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border/30 mt-2">
              <div className="flex items-center gap-3 text-xs text-muted-foreground/50">
                <span>Cards por coluna: {pageSize}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground/50 tabular-nums">
                  Página {page + 1}
                </span>
                <button
                  onClick={prevPage}
                  disabled={page === 0}
                  className="p-1 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={nextPage}
                  disabled={!hasMore}
                  className="p-1 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export { useEnterpriseKanban }
