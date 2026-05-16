import { motion, AnimatePresence } from 'framer-motion'
import { Filter, X, RotateCcw, SlidersHorizontal } from 'lucide-react'
import type { KanbanFilter, Prioridade, StatusDocumental, ValidadeCNH, TagType } from './enterpriseKanbanTypes'
import { cn } from '../../utils/cn'

interface KanbanFiltersProps {
  filters: KanbanFilter
  onFilterChange: (filters: Partial<KanbanFilter>) => void
  onReset: () => void
  show: boolean
  onToggle: () => void
  hasActiveFilters: boolean
}

const PRIORIDADE_OPTIONS: { value: Prioridade; label: string; color: string }[] = [
  { value: 'baixa', label: 'Baixa', color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' },
  { value: 'media', label: 'Média', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { value: 'alta', label: 'Alta', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  { value: 'urgente', label: 'Urgente', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
]

const STATUS_DOC_OPTIONS: { value: StatusDocumental; label: string }[] = [
  { value: 'completo', label: 'Completo' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'vencido', label: 'Vencido' },
]

const CNH_OPTIONS: { value: ValidadeCNH; label: string }[] = [
  { value: 'valida', label: 'Válida' },
  { value: 'vencendo', label: 'Vencendo' },
  { value: 'vencida', label: 'Vencida' },
]

const TAG_OPTIONS: { value: TagType; label: string }[] = [
  { value: 'experiente', label: 'Experiente' },
  { value: 'veiculo_proprio', label: 'Veículo Próprio' },
  { value: 'indicado', label: 'Indicado' },
  { value: 'recorrente', label: 'Recorrente' },
  { value: 'disponivel_imediato', label: 'Disponível Imediato' },
  { value: 'recomendado', label: 'Recomendado' },
  { value: 'risco', label: 'Risco' },
  { value: 'prioritario', label: 'Prioritário' },
]

function FilterChip({
  label,
  active,
  onClick,
  color,
}: {
  label: string
  active: boolean
  onClick: () => void
  color?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-200',
        active
          ? color ?? 'bg-primary/15 text-primary border-primary/30 shadow-sm'
          : 'bg-transparent text-muted-foreground/50 border-border/30 hover:border-border/60 hover:text-muted-foreground/70',
      )}
    >
      {label}
    </button>
  )
}

export function KanbanFilters({ filters, onFilterChange, onReset, show, onToggle, hasActiveFilters }: KanbanFiltersProps) {
  const toggleArrayFilter = <T,>(key: keyof KanbanFilter, value: T) => {
    const current = (filters[key] as unknown as T[]) ?? []
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value]
    onFilterChange({ [key]: next } as any)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={onToggle}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border',
            show
              ? 'bg-primary/10 text-primary border-primary/30'
              : 'text-muted-foreground/50 border-border/30 hover:border-border/60 hover:text-muted-foreground/70',
          )}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filtros
          {hasActiveFilters && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 transition-all"
          >
            <RotateCcw className="w-3 h-3" />
            Limpar
          </button>
        )}
      </div>

      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="bg-card border border-border/50 rounded-xl p-4 space-y-4">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Score</p>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={filters.scoreMin}
                    onChange={(e) => onFilterChange({ scoreMin: Number(e.target.value) })}
                    className="w-24 h-1.5 appearance-none bg-muted rounded-full accent-primary cursor-pointer"
                  />
                  <span className="text-xs text-muted-foreground tabular-nums min-w-[60px]">
                    {filters.scoreMin} - {filters.scoreMax}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={filters.scoreMax}
                    onChange={(e) => onFilterChange({ scoreMax: Number(e.target.value) })}
                    className="w-24 h-1.5 appearance-none bg-muted rounded-full accent-primary cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Prioridade</p>
                <div className="flex flex-wrap gap-1.5">
                  {PRIORIDADE_OPTIONS.map((opt) => (
                    <FilterChip
                      key={opt.value}
                      label={opt.label}
                      active={filters.prioridade.includes(opt.value)}
                      onClick={() => toggleArrayFilter('prioridade', opt.value)}
                      color={filters.prioridade.includes(opt.value) ? opt.color : undefined}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Status Documental</p>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_DOC_OPTIONS.map((opt) => (
                    <FilterChip
                      key={opt.value}
                      label={opt.label}
                      active={filters.statusDocumental.includes(opt.value)}
                      onClick={() => toggleArrayFilter('statusDocumental', opt.value)}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Validade CNH</p>
                <div className="flex flex-wrap gap-1.5">
                  {CNH_OPTIONS.map((opt) => (
                    <FilterChip
                      key={opt.value}
                      label={opt.label}
                      active={filters.validadeCNH.includes(opt.value)}
                      onClick={() => toggleArrayFilter('validadeCNH', opt.value)}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Tags</p>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {TAG_OPTIONS.map((opt) => (
                    <FilterChip
                      key={opt.value}
                      label={opt.label}
                      active={filters.tags.includes(opt.value)}
                      onClick={() => toggleArrayFilter('tags', opt.value)}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Cidade</p>
                  <input
                    type="text"
                    value={filters.cidade}
                    onChange={(e) => onFilterChange({ cidade: e.target.value })}
                    placeholder="Filtrar por cidade..."
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border/40 bg-muted/20 text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Veículo</p>
                  <input
                    type="text"
                    value={filters.veiculo}
                    onChange={(e) => onFilterChange({ veiculo: e.target.value })}
                    placeholder="Filtrar por veículo..."
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border/40 bg-muted/20 text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40 transition-colors"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
