import { motion } from 'framer-motion'
import { cn } from '../../utils/cn'

interface PremiumCardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  borderAccent?: string
  onClick?: () => void
}

export function PremiumCard({ children, className, hover = true, borderAccent, onClick }: PremiumCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      onClick={onClick}
      className={cn(
        'group relative rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-all duration-300',
        hover && 'hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 hover:-translate-y-0.5',
        borderAccent && `border-t-2 border-t-${borderAccent}`,
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </motion.div>
  )
}

export function PremiumCardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between mb-4', className)}>
      {children}
    </div>
  )
}

export function PremiumCardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn('text-base font-semibold text-foreground', className)}>{children}</h3>
  )
}

export function PremiumCardDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('text-sm text-muted-foreground/70', className)}>{children}</p>
  )
}

export function PremiumCardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('', className)}>{children}</div>
  )
}

export function PremiumCardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mt-4 pt-4 border-t border-border/50 flex items-center gap-3', className)}>
      {children}
    </div>
  )
}