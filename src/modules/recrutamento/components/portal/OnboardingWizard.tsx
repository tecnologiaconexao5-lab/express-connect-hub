import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Circle, User, FileText, Truck, Shield, Award, ArrowRight, ArrowLeft, Check } from 'lucide-react'
import { PremiumCard, PremiumCardHeader, PremiumCardTitle, PremiumCardContent } from '../design-system/PremiumCard'
import { PremiumBadge } from '../design-system/PremiumBadge'
import { cn } from '../../utils/cn'
import type { StatusOnboarding } from '../../types/recrutamento'
import { Button } from '@/components/ui/button'

interface Step {
  id: StatusOnboarding
  label: string
  description: string
  icon: React.ReactNode
}

const steps: Step[] = [
  { id: 'nao_iniciado', label: 'Cadastro Inicial', description: 'Dados básicos do prestador', icon: <User className="w-4 h-4" /> },
  { id: 'em_andamento', label: 'Documentação', description: 'Envio de documentos', icon: <FileText className="w-4 h-4" /> },
  { id: 'documentacao', label: 'Verificação', description: 'Validação documental', icon: <Shield className="w-4 h-4" /> },
  { id: 'treinamento', label: 'Treinamento', description: 'Capacitação operacional', icon: <Truck className="w-4 h-4" /> },
  { id: 'homologado', label: 'Homologação', description: 'Aprovação final', icon: <Award className="w-4 h-4" /> },
  { id: 'concluido', label: 'Concluído', description: 'Pronto para operar', icon: <CheckCircle className="w-4 h-4" /> },
]

interface OnboardingWizardProps {
  currentStatus: StatusOnboarding
  prestadorNome: string
  onStatusChange?: (status: StatusOnboarding) => void
}

export function OnboardingWizard({ currentStatus, prestadorNome, onStatusChange }: OnboardingWizardProps) {
  const currentIndex = steps.findIndex(s => s.id === currentStatus)
  const [animating, setAnimating] = useState(false)

  const handleAdvance = () => {
    if (currentIndex < steps.length - 1 && onStatusChange) {
      setAnimating(true)
      onStatusChange(steps[currentIndex + 1].id)
      setTimeout(() => setAnimating(false), 500)
    }
  }

  return (
    <PremiumCard>
      <PremiumCardHeader>
        <PremiumCardTitle className="flex items-center gap-2">
          <Award className="w-4 h-4 text-primary" />
          Onboarding de {prestadorNome}
        </PremiumCardTitle>
        <PremiumBadge variant="info" dot size="md">{statusLabel(currentStatus)}</PremiumBadge>
      </PremiumCardHeader>
      <PremiumCardContent>
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border/60 hidden sm:block" />

          <div className="space-y-6 relative">
            {steps.map((step, idx) => {
              const isCompleted = idx < currentIndex
              const isCurrent = idx === currentIndex
              const isFuture = idx > currentIndex

              return (
                <div key={step.id} className="flex items-start gap-4 relative">
                  <div className={cn(
                    'relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300',
                    isCompleted && 'bg-emerald-500 text-white',
                    isCurrent && 'bg-primary/15 text-primary ring-2 ring-primary/30',
                    isFuture && 'bg-muted/30 text-muted-foreground/40',
                  )}>
                    {isCompleted ? <Check className="w-4 h-4" /> : step.icon}
                  </div>

                  <div className={cn(
                    'flex-1 pt-1 transition-opacity',
                    isFuture && 'opacity-40'
                  )}>
                    <p className={cn(
                      'text-sm font-medium',
                      isCurrent ? 'text-primary' : isCompleted ? 'text-emerald-400' : 'text-muted-foreground'
                    )}>
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground/50 mt-0.5">{step.description}</p>

                    {isCurrent && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2"
                      >
                        <Button size="sm" variant="outline" onClick={handleAdvance} disabled={animating}>
                          Avançar para {steps[idx + 1]?.label}
                          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </Button>
                      </motion.div>
                    )}

                    {isCompleted && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="mt-1"
                      >
                        <span className="text-[10px] text-emerald-400/70">Concluído</span>
                      </motion.div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </PremiumCardContent>
    </PremiumCard>
  )
}

function statusLabel(s: StatusOnboarding): string {
  const labels: Record<string, string> = {
    nao_iniciado: 'Não Iniciado',
    em_andamento: 'Em Andamento',
    documentacao: 'Documentação',
    treinamento: 'Treinamento',
    homologado: 'Homologado',
    concluido: 'Concluído',
  }
  return labels[s] || s
}