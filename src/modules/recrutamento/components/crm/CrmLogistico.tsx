import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Phone, MessageSquare, Calendar, Mail, Plus, Clock,
  User, CheckCircle, XCircle, Target, Send, AlertCircle,
} from 'lucide-react'
import { PremiumBadge } from '../design-system/PremiumBadge'
import { EmptyState } from '../design-system/EmptyState'
import { RegistrarInteracaoSheet } from './RegistrarInteracaoSheet'
import { cn, formatDateTime } from '../../utils/cn'
import type { CrmInteracao } from '../../types/recrutamento'
import { Button } from '@/components/ui/button'

interface CrmLogisticoProps {
  interacoes: CrmInteracao[]
  prestadorId?: string
  prestadorNome?: string
  onRefresh?: () => void
}

const tipoIconMap: Record<string, React.ReactNode> = {
  ligacao: <Phone className="w-4 h-4" />,
  whatsapp: <MessageSquare className="w-4 h-4" />,
  email: <Mail className="w-4 h-4" />,
  reuniao: <Calendar className="w-4 h-4" />,
  visita: <Calendar className="w-4 h-4" />,
  observacao: <Clock className="w-4 h-4" />,
  proposta_enviada: <Send className="w-4 h-4" />,
  retorno_prestador: <AlertCircle className="w-4 h-4" />,
}

const tipoColors: Record<string, string> = {
  ligacao: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  whatsapp: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  email: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
  reuniao: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  visita: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  observacao: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
  proposta_enviada: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  retorno_prestador: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
}

const tipoLabels: Record<string, string> = {
  ligacao: 'Ligação',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  reuniao: 'Reunião',
  visita: 'Visita',
  observacao: 'Observação',
  proposta_enviada: 'Proposta Enviada',
  retorno_prestador: 'Retorno do Prestador',
}

const statusColors: Record<string, string> = {
  realizado: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  agendado: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  pendente: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  cancelado: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
}

export function CrmLogistico({ interacoes, prestadorId, prestadorNome, onRefresh }: CrmLogisticoProps) {
  const [showRegistrar, setShowRegistrar] = useState(false)

  return (
    <div className="space-y-4">
      {(prestadorNome || prestadorId) && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Histórico de:</span>
            <PremiumBadge variant="info" dot size="md">{prestadorNome ?? prestadorId}</PremiumBadge>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={() => setShowRegistrar(true)}
          >
            <Plus className="w-3.5 h-3.5" /> Novo Registro
          </Button>
        </div>
      )}

      {interacoes.length === 0 ? (
        <EmptyState
          title="Nenhuma interação registrada"
          description="Registre ligações, mensagens, reuniões, propostas e retornos para acompanhar o relacionamento com o prestador."
          action={
            <Button size="sm" onClick={() => setShowRegistrar(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Registrar Interação
            </Button>
          }
        />
      ) : (
        <div className="relative">
          <div className="absolute left-[23px] top-2 bottom-2 w-px bg-border/40" />
          <div className="space-y-0">
            {interacoes.map((interacao, idx) => (
              <motion.div
                key={interacao.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="relative flex items-start gap-4 py-3"
              >
                <div className={cn(
                  'relative z-10 w-[46px] h-[46px] rounded-xl flex items-center justify-center shrink-0 border',
                  tipoColors[interacao.tipo] ?? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
                )}>
                  {tipoIconMap[interacao.tipo] ?? <Clock className="w-4 h-4" />}
                </div>

                <div className="flex-1 min-w-0 bg-card border border-border/40 rounded-xl p-3.5 hover:border-primary/20 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-foreground">{interacao.titulo}</span>
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded font-medium border',
                          statusColors[interacao.status] ?? 'bg-zinc-500/10 text-zinc-400',
                        )}>
                          {interacao.status}
                        </span>
                        <span className="text-[10px] text-muted-foreground/40 font-medium">
                          {tipoLabels[interacao.tipo] ?? interacao.tipo}
                        </span>
                      </div>

                      {interacao.descricao && (
                        <p className="text-xs text-muted-foreground/70 mt-1.5 leading-relaxed">
                          {interacao.descricao}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground/40 flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" /> {interacao.usuario}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {formatDateTime(interacao.data)}
                        </span>
                        {interacao.proximaAcao && (
                          <span className="flex items-center gap-1">
                            <Target className="w-3 h-3" /> Próx: {interacao.proximaAcao}
                          </span>
                        )}
                        {interacao.dataProximoContato && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Próx contato: {formatDateTime(interacao.dataProximoContato)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <RegistrarInteracaoSheet
        open={showRegistrar}
        onOpenChange={setShowRegistrar}
        prestadorId={prestadorId}
        onSuccess={onRefresh}
      />
    </div>
  )
}
