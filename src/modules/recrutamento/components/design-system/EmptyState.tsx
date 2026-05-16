import { Inbox } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '../../utils/cn'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'flex flex-col items-center justify-center py-16 px-4',
        'rounded-xl border border-dashed border-border/50',
        'bg-card/30',
        className
      )}
    >
      <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        {icon || <Inbox className="w-6 h-6 text-muted-foreground/40" />}
      </div>
      <h3 className="text-base font-medium text-foreground/80 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground/50 text-center max-w-sm mb-4">{description}</p>
      )}
      {action}
    </motion.div>
  )
}