import { motion } from 'framer-motion'
import { cn } from '../../utils/cn'
import { scoreService } from '../../services/scoreService'

interface ScoreMeterProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

const sizeConfig = {
  sm: { w: 40, h: 40, stroke: 4, fontSize: 'text-[10px]' },
  md: { w: 52, h: 52, stroke: 5, fontSize: 'text-xs' },
  lg: { w: 72, h: 72, stroke: 6, fontSize: 'text-sm' },
}

export function ScoreMeter({ score, size = 'md', showLabel = true, className }: ScoreMeterProps) {
  const config = sizeConfig[size]
  const { label, color } = scoreService.obterNivel(score)
  const radius = (config.w - config.stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <div className="relative" style={{ width: config.w, height: config.h }}>
        <svg width={config.w} height={config.h} className="-rotate-90">
          <circle
            cx={config.w / 2}
            cy={config.h / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={config.stroke}
            fill="none"
            className="text-muted/20"
          />
          <motion.circle
            cx={config.w / 2}
            cy={config.h / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={config.stroke}
            fill="none"
            strokeLinecap="round"
            className={color}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('font-bold', config.fontSize, color)}>{score}</span>
        </div>
      </div>
      {showLabel && (
        <span className={cn('text-[10px] font-medium', color)}>{label}</span>
      )}
    </div>
  )
}