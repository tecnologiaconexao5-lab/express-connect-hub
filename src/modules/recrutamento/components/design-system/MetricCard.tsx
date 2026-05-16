import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '../../utils/cn'

interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
  icon?: React.ReactNode
  trend?: number
  trendLabel?: string
  className?: string
  loading?: boolean
}

export function MetricCard({ title, value, subtitle, icon, trend, trendLabel, className, loading }: MetricCardProps) {
  if (loading) {
    return (
      <div className={cn('rounded-xl border border-border/60 bg-card p-5', className)}>
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-24 bg-muted rounded" />
          <div className="h-7 w-32 bg-muted rounded" />
          <div className="h-3 w-20 bg-muted rounded" />
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'relative rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5',
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
          {title}
        </span>
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
            {icon}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <span className="text-2xl font-bold tracking-tight text-foreground">
          {value}
        </span>
        {subtitle && (
          <p className="text-xs text-muted-foreground/60">{subtitle}</p>
        )}
      </div>

      {trend !== undefined && (
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/40">
          {trend >= 0 ? (
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
          )}
          <span className={cn(
            'text-xs font-medium',
            trend >= 0 ? 'text-emerald-400' : 'text-rose-400'
          )}>
            {Math.abs(trend)}%
          </span>
          {trendLabel && (
            <span className="text-xs text-muted-foreground/50">{trendLabel}</span>
          )}
        </div>
      )}
    </motion.div>
  )
}