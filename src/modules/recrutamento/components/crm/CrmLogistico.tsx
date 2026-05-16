import { useState } from 'react'
import { motion } from 'framer-motion'
import { Phone, MessageSquare, Calendar, Mail, Plus, MoreHorizontal, Clock, User, CheckCircle, XCircle } from 'lucide-react'
import { PremiumCard, PremiumCardHeader, PremiumCardTitle, PremiumCardContent, PremiumCardFooter } from '../design-system/PremiumCard'
import { PremiumBadge } from '../design-system/PremiumBadge'
import { EmptyState } from '../design-system/EmptyState'
import { cn, formatDate, formatDateTime } from '../../utils/cn'
import type { CrmInteracao } from '../../types/recrutamento'
import { Button } from '@/components/ui/button'

interface CrmLogisticoProps {
  interacoes: CrmInteracao[]
  prestadorNome?: string
}

const tipoIconMap: Record<string, React.ReactNode> = {
  ligacao: <Phone className="w-4 h-4" />,
  whatsapp: <MessageSquare className="w-4 h-4" />,
  email: <Mail className="w-4 h-4" />,
  reuniao: <Calendar className="w-4 h-4" />,
  visita: <Calendar className="w-4 h-4" />,
  observacao: <Clock className="w-4 h-4" />,
}

const tipoColors: Record<string, string> = {
  ligacao: 'bg-blue-500/10 text-blue-400',
  whatsapp: 'bg-emerald-500/10 text-emerald-400',
  email: 'bg-violet-500/10 text-violet-400',
  reuniao: 'bg-amber-500/10 text-amber-400',
  visita: 'bg-cyan-500/10 text-cyan-400',
  observacao: 'bg-zinc-500/10 text-zinc-400',
}

export function CrmLogistico({ interacoes, prestadorNome }: CrmLogisticoProps) {
  return (
    <div className="space-y-4">
      {prestadorNome && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Histórico de:</span>
            <PremiumBadge variant="info" dot size="md">{prestadorNome}</PremiumBadge>
          </div>
          <Button size="sm" variant="outline" className="h-8 gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Novo Registro
          </Button>
        </div>
      )}

      {interacoes.length === 0 ? (
        <EmptyState
          title="Nenhuma interação registrada"
          description="Registre ligações, mensagens e reuniões para acompanhar o relacionamento com o prestador."
          action={<Button size="sm"><Plus className="w-4 h-4 mr-1.5" /> Registrar Interação</Button>}
        />
      ) : (
        <div className="space-y-2">
          {interacoes.map((interacao) => (
            <motion.div
              key={interacao.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border/50 hover:border-primary/30 transition-all"
            >
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', tipoColors[interacao.tipo])}>
                {tipoIconMap[interacao.tipo]}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{interacao.titulo}</span>
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded font-medium',
                    interacao.status === 'realizado' ? 'bg-emerald-500/10 text-emerald-400' :
                    interacao.status === 'agendado' ? 'bg-blue-500/10 text-blue-400' :
                    'bg-rose-500/10 text-rose-400'
                  )}>
                    {interacao.status}
                  </span>
                </div>
                {interacao.descricao && (
                  <p className="text-xs text-muted-foreground/60 mt-0.5 line-clamp-2">{interacao.descricao}</p>
                )}
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground/40">
                  <span className="flex items-center gap-1"><User className="w-3 h-3" /> {interacao.usuario}</span>
                  <span>{formatDateTime(interacao.data)}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}