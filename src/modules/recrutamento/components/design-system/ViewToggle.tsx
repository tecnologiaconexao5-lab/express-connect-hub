import { LayoutGrid, List, Columns3 } from 'lucide-react'
import { cn } from '../../utils/cn'

type ViewMode = 'grid' | 'list' | 'kanban'

interface ViewToggleProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
  className?: string
}

const options = [
  { value: 'grid' as const, icon: LayoutGrid, label: 'Cards' },
  { value: 'list' as const, icon: List, label: 'Lista' },
  { value: 'kanban' as const, icon: Columns3, label: 'Kanban' },
]

export function ViewToggle({ value, onChange, className }: ViewToggleProps) {
  return (
    <div className={cn('flex items-center gap-1 rounded-lg border border-border/60 bg-card p-0.5', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
            value === opt.value
              ? 'bg-primary/15 text-primary shadow-sm'
              : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50'
          )}
        >
          <opt.icon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  )
}