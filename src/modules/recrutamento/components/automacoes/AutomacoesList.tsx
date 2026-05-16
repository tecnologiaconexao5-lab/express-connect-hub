import { useState } from 'react'
import { motion } from 'framer-motion'
import { Zap, Plus, PlayCircle, PauseCircle, Trash2, Webhook, MessageSquare, Mail, Bell, Settings } from 'lucide-react'
import { PremiumCard, PremiumCardHeader, PremiumCardTitle, PremiumCardContent, PremiumCardFooter } from '../design-system/PremiumCard'
import { PremiumBadge } from '../design-system/PremiumBadge'
import { EmptyState } from '../design-system/EmptyState'
import { StatusDot } from '../design-system/StatusDot'
import { automacoesService } from '../../services/automacoesService'
import { cn, statusLabel } from '../../utils/cn'
import type { AutomacaoRegra, StatusAutomacao } from '../../types/recrutamento'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface AutomacoesListProps {
  automacoes: AutomacaoRegra[]
  onRefresh: () => void
}

const tipoIcons: Record<string, React.ReactNode> = {
  whatsapp: <MessageSquare className="w-4 h-4" />,
  email: <Mail className="w-4 h-4" />,
  notificacao: <Bell className="w-4 h-4" />,
  webhook: <Webhook className="w-4 h-4" />,
  score: <Zap className="w-4 h-4" />,
}

export function AutomacoesList({ automacoes, onRefresh }: AutomacoesListProps) {
  const handleStatus = async (id: string, status: StatusAutomacao) => {
    await automacoesService.atualizarStatus(id, status)
    toast.success(`Automação ${status === 'ativa' ? 'ativada' : 'pausada'}!`)
    onRefresh()
  }

  const handleRemover = async (id: string) => {
    if (window.confirm('Remover esta automação?')) {
      await automacoesService.remover(id)
      toast.success('Automação removida!')
      onRefresh()
    }
  }

  if (automacoes.length === 0) {
    return (
      <EmptyState
        title="Nenhuma automação configurada"
        description="Crie regras automáticas para WhatsApp, email, webhooks e mais."
        action={
          <Button size="sm"><Zap className="w-4 h-4 mr-1.5" /> Criar Automação</Button>
        }
      />
    )
  }

  return (
    <div className="space-y-3">
      {automacoes.map((auto) => (
        <motion.div
          key={auto.id}
          layout
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <PremiumCard hover={false}>
            <div className="flex items-center gap-4">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                auto.status === 'ativa' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-muted/30 text-muted-foreground/40'
              )}>
                {tipoIcons[auto.tipo] || <Zap className="w-4 h-4" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{auto.nome}</span>
                  <StatusDot status={auto.status === 'ativa' ? 'ativo' : 'pausada'} pulse={auto.status === 'ativa'} />
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground/50 mt-0.5">
                  <PremiumBadge variant={auto.status === 'ativa' ? 'success' : 'default'} size="sm">
                    {auto.tipo}
                  </PremiumBadge>
                  {auto.totalExecucoes > 0 && (
                    <span>{auto.totalExecucoes} execuções</span>
                  )}
                  {auto.ultimaExecucao && (
                    <span>Última: {new Date(auto.ultimaExecucao).toLocaleDateString()}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleStatus(auto.id, auto.status === 'ativa' ? 'pausada' : 'ativa')}
                  className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"
                >
                  {auto.status === 'ativa' ? <PauseCircle className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => handleRemover(auto.id)}
                  className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </PremiumCard>
        </motion.div>
      ))}
    </div>
  )
}