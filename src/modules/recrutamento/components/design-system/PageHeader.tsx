import { motion } from 'framer-motion'
import { cn } from '../../utils/cn'

interface PageHeaderProps {
  icon?: React.ReactNode
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ icon, title, description, actions, className }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={cn('flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8', className)}
    >
      <div className="flex items-center gap-4">
        {icon && (
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
            <div className="relative w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
              {icon}
            </div>
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground/80 mt-0.5 max-w-xl">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-3">{actions}</div>
      )}
    </motion.div>
  )
}