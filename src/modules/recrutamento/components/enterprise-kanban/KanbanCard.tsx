import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  MapPin, Truck, Phone, Mail, Shield, AlertTriangle,
  CheckCircle, XCircle, Clock, FileText, MessageSquare,
  UserCheck, Ban, Send, Plus, Eye, Star, ChevronDown, ChevronUp,
} from 'lucide-react'
import type { EnterpriseCandidate, PipelineStage, Prioridade, ValidadeCNH, StatusDocumental } from './enterpriseKanbanTypes'
import { cn } from '../../utils/cn'

interface KanbanCardProps {
  candidate: EnterpriseCandidate
  onMove: (id: string, stage: PipelineStage) => void
  possibleStages: PipelineStage[]
  isDragging?: boolean
}

export const PRIORIDADE_CONFIG: Record<Prioridade, { label: string; color: string; bg: string }> = {
  baixa: { label: 'Baixa', color: 'text-zinc-400', bg: 'bg-zinc-500/10' },
  media: { label: 'Média', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  alta: { label: 'Alta', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  urgente: { label: 'Urgente', color: 'text-rose-400', bg: 'bg-rose-500/10' },
}

const STATUS_DOC_CONFIG: Record<StatusDocumental, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  completo: { label: 'Completo', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: <CheckCircle className="w-3 h-3" /> },
  parcial: { label: 'Parcial', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: <Clock className="w-3 h-3" /> },
  pendente: { label: 'Pendente', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: <FileText className="w-3 h-3" /> },
  vencido: { label: 'Vencido', color: 'text-rose-400', bg: 'bg-rose-500/10', icon: <AlertTriangle className="w-3 h-3" /> },
}

const CNH_CONFIG: Record<ValidadeCNH, { label: string; color: string; bg: string }> = {
  valida: { label: 'CNH OK', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  vencendo: { label: 'Vencendo', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  vencida: { label: 'Vencida', color: 'text-rose-400', bg: 'bg-rose-500/10' },
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25'
    : score >= 55 ? 'text-amber-400 bg-amber-500/15 border-amber-500/25'
    : 'text-rose-400 bg-rose-500/15 border-rose-500/25'

  return (
    <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold', color)}>
      <Star className="w-3 h-3 fill-current" />
      {score}
    </div>
  )
}

function PriorityIndicator({ prioridade }: { prioridade: Prioridade }) {
  const cfg = PRIORIDADE_CONFIG[prioridade]
  return (
    <span className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider', cfg.color, cfg.bg)}>
      <span className={cn(
        'w-1.5 h-1.5 rounded-full',
        prioridade === 'urgente' && 'bg-rose-400 animate-pulse',
        prioridade === 'alta' && 'bg-orange-400',
        prioridade === 'media' && 'bg-blue-400',
        prioridade === 'baixa' && 'bg-zinc-400',
      )} />
      {cfg.label}
    </span>
  )
}

function TagBadge({ tag }: { tag: string }) {
  const config: Record<string, { color: string; bg: string }> = {
    experiente: { color: 'text-blue-400', bg: 'bg-blue-500/10' },
    veiculo_proprio: { color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    indicado: { color: 'text-violet-400', bg: 'bg-violet-500/10' },
    recorrente: { color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    disponivel_imediato: { color: 'text-lime-400', bg: 'bg-lime-500/10' },
    recomendado: { color: 'text-amber-400', bg: 'bg-amber-500/10' },
    risco: { color: 'text-rose-400', bg: 'bg-rose-500/10' },
    prioritario: { color: 'text-orange-400', bg: 'bg-orange-500/10' },
  }
  const cfg = config[tag] ?? { color: 'text-zinc-400', bg: 'bg-zinc-500/10' }

  const labels: Record<string, string> = {
    experiente: 'Experiente',
    veiculo_proprio: 'V. Próprio',
    indicado: 'Indicado',
    recorrente: 'Recorrente',
    disponivel_imediato: 'Disponível',
    recomendado: 'Recomendado',
    risco: 'Risco',
    prioritario: 'Prioritário',
  }

  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium', cfg.color, cfg.bg)}>
      {labels[tag] ?? tag}
    </span>
  )
}

function QuickActionButton({
  icon,
  label,
  onClick,
  variant = 'default',
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  variant?: 'default' | 'success' | 'danger' | 'warning'
}) {
  const colors = {
    default: 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/50',
    success: 'text-emerald-400/60 hover:text-emerald-400 hover:bg-emerald-500/10',
    danger: 'text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/10',
    warning: 'text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/10',
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all duration-200',
        colors[variant],
      )}
      title={label}
    >
      {icon}
      <span className="hidden group-hover/card:inline">{label}</span>
    </button>
  )
}

export function KanbanCard({ candidate, onMove, possibleStages, isDragging }: KanbanCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [obsExpanded, setObsExpanded] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const cnh = CNH_CONFIG[candidate.validadeCNH]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        'group/card relative rounded-xl border bg-card transition-all duration-300 overflow-hidden',
        isDragging
          ? 'border-primary/50 shadow-xl shadow-primary/10 scale-105 opacity-90'
          : 'border-border/60 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5',
      )}
      data-candidate-id={candidate.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', candidate.id)
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/[0.02] pointer-events-none" />

      <div className="p-3.5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div className="w-11 h-11 rounded-xl overflow-hidden ring-2 ring-border/40 bg-muted shadow-sm">
              <img
                src={candidate.foto}
                alt={candidate.nome}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <div className={cn(
              'absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-card flex items-center justify-center',
              candidate.score >= 75 ? 'bg-emerald-500' : candidate.score >= 55 ? 'bg-amber-500' : 'bg-rose-500',
            )}>
              <span className="text-[8px] font-bold text-white leading-none">{candidate.score}</span>
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-start justify-between gap-1">
              <p className="text-sm font-semibold text-foreground truncate leading-tight">{candidate.nome}</p>
              <PriorityIndicator prioridade={candidate.prioridade} />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{candidate.cidade}, {candidate.uf}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
              <Truck className="w-3 h-3 shrink-0" />
              <span className="truncate">{candidate.veiculo}</span>
              <span className="text-muted-foreground/30">·</span>
              <span className="font-mono text-[10px]">{candidate.placa}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {candidate.tags.slice(0, 3).map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
          {candidate.tags.length > 3 && (
            <span className="text-[10px] text-muted-foreground/40 font-medium px-1">
              +{candidate.tags.length - 3}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <div className={cn(
            'flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] font-medium',
            STATUS_DOC_CONFIG[candidate.statusDocumental].color,
            STATUS_DOC_CONFIG[candidate.statusDocumental].bg,
          )}>
            {STATUS_DOC_CONFIG[candidate.statusDocumental].icon}
            <span className="truncate">{STATUS_DOC_CONFIG[candidate.statusDocumental].label}</span>
          </div>
          <div className={cn('flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] font-medium', cnh.color, cnh.bg)}>
            <Shield className="w-3 h-3" />
            <span className="truncate">{cnh.label}</span>
          </div>
          <ScoreBadge score={candidate.score} />
        </div>

        <button
          onClick={() => setObsExpanded(!obsExpanded)}
          className="flex items-center gap-1.5 w-full text-left text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <MessageSquare className="w-3 h-3 shrink-0" />
          <span className="truncate">
            {obsExpanded ? candidate.observacoesIA : 'IA: clique para ver análise'}
          </span>
          {obsExpanded ? <ChevronUp className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0" />}
        </button>

        {obsExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="text-[11px] text-muted-foreground/70 leading-relaxed bg-muted/30 rounded-lg p-2.5 border border-border/30"
          >
            {candidate.observacoesIA}
          </motion.div>
        )}

        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center gap-1">
            <QuickActionButton
              icon={<UserCheck className="w-3.5 h-3.5" />}
              label="Aprovar"
              onClick={() => possibleStages.includes('aprovado') && onMove(candidate.id, 'aprovado')}
              variant="success"
            />
            <QuickActionButton
              icon={<Ban className="w-3.5 h-3.5" />}
              label="Bloquear"
              onClick={() => possibleStages.includes('bloqueado') && onMove(candidate.id, 'bloqueado')}
              variant="danger"
            />
            <QuickActionButton
              icon={<Send className="w-3.5 h-3.5" />}
              label="WhatsApp"
              onClick={() => window.open(`https://wa.me/55${candidate.telefone.replace(/\D/g, '')}`, '_blank')}
              variant="default"
            />
            <QuickActionButton
              icon={<Eye className="w-3.5 h-3.5" />}
              label="Perfil"
              onClick={() => {}}
              variant="default"
            />
          </div>
          <button
            onClick={() => setShowActions(!showActions)}
            className="text-muted-foreground/40 hover:text-foreground transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {showActions && possibleStages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap gap-1 pt-1 border-t border-border/30"
          >
            <span className="text-[10px] text-muted-foreground/40 font-medium w-full mb-0.5">Mover para:</span>
            {possibleStages.map((stage) => (
              <button
                key={stage}
                onClick={() => { onMove(candidate.id, stage); setShowActions(false) }}
                className="text-[10px] px-2 py-0.5 rounded-full border border-border/40 text-muted-foreground/60 hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all"
              >
                {stage}
              </button>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

export function KanbanCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3.5">
      <div className="animate-pulse space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-3 w-24 bg-muted rounded" />
            <div className="h-3 w-28 bg-muted rounded" />
          </div>
        </div>
        <div className="flex gap-1">
          <div className="h-4 w-16 bg-muted rounded" />
          <div className="h-4 w-14 bg-muted rounded" />
          <div className="h-4 w-12 bg-muted rounded" />
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <div className="h-6 bg-muted rounded-md" />
          <div className="h-6 bg-muted rounded-md" />
          <div className="h-6 bg-muted rounded-md" />
        </div>
        <div className="flex justify-between">
          <div className="flex gap-1">
            <div className="h-5 w-5 bg-muted rounded" />
            <div className="h-5 w-5 bg-muted rounded" />
          </div>
          <div className="h-5 w-5 bg-muted rounded" />
        </div>
      </div>
    </div>
  )
}

function StageLabel(stage: PipelineStage): string {
  const labels: Record<string, string> = {
    novo_cadastro: 'Novo Cadastro',
    em_analise: 'Em Análise',
    documentacao_pendente: 'Doc. Pendente',
    em_validacao: 'Em Validação',
    entrevista: 'Entrevista',
    em_treinamento: 'Em Treinamento',
    aprovado: 'Aprovado',
    ativo: 'Ativo',
    bloqueado: 'Bloqueado',
    reprovado: 'Reprovado',
  }
  return labels[stage] ?? stage
}
