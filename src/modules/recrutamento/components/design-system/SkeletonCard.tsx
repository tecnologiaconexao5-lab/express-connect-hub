import { cn } from '../../utils/cn'

interface SkeletonCardProps {
  className?: string
  lines?: number
}

export function SkeletonCard({ className, lines = 3 }: SkeletonCardProps) {
  return (
    <div className={cn('rounded-xl border border-border/60 bg-card p-5', className)}>
      <div className="animate-pulse space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-8 w-8 bg-muted rounded-lg" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className="h-3 bg-muted rounded"
              style={{ width: `${70 - i * 15}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="animate-pulse">
        <div className="grid grid-cols-5 gap-4 p-4 border-b border-border/50 bg-muted/20">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-3 bg-muted rounded" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="grid grid-cols-5 gap-4 p-4 border-b border-border/30 last:border-0">
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="h-3 bg-muted/60 rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}