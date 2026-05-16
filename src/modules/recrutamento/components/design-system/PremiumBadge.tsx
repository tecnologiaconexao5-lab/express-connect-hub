import { cn } from '../../utils/cn'

interface PremiumBadgeProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  dot?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const variantStyles = {
  default: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  danger: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
  info: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
}

const sizeStyles = {
  sm: 'text-[10px] px-1.5 py-0.5 gap-1',
  md: 'text-xs px-2.5 py-1 gap-1.5',
  lg: 'text-sm px-3 py-1.5 gap-2',
}

export function PremiumBadge({ children, className, variant = 'default', dot = false, size = 'sm' }: PremiumBadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border font-medium transition-colors',
      variantStyles[variant],
      sizeStyles[size],
      className
    )}>
      {dot && (
        <span className={cn(
          'w-1.5 h-1.5 rounded-full',
          variant === 'success' && 'bg-emerald-400',
          variant === 'warning' && 'bg-amber-400',
          variant === 'danger' && 'bg-rose-400',
          variant === 'info' && 'bg-blue-400',
          variant === 'default' && 'bg-zinc-400',
        )} />
      )}
      {children}
    </span>
  )
}