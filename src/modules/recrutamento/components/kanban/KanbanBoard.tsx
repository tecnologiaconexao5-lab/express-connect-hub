import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Truck, MapPin, Phone, Star } from 'lucide-react'
import { PremiumBadge } from '../design-system/PremiumBadge'
import { StatusDot } from '../design-system/StatusDot'
import { cn, formatCurrency, statusLabel } from '../../utils/cn'
import type { Prestador, StatusPrestador } from '../../types/recrutamento'

interface KanbanColumn {
  id: StatusPrestador
  title: string
  color: string
  icon: React.ReactNode
}

const columns: KanbanColumn[] = [
  { id: 'potencial', title: 'Potencial', color: 'border-t-blue-500', icon: <Star className="w-3.5 h-3.5" /> },
  { id: 'em_triagem', title: 'Em Triagem', color: 'border-t-violet-500', icon: <Star className="w-3.5 h-3.5" /> },
  { id: 'documentacao', title: 'Documentação', color: 'border-t-amber-500', icon: <Star className="w-3.5 h-3.5" /> },
  { id: 'qualificado', title: 'Qualificado', color: 'border-t-cyan-500', icon: <Star className="w-3.5 h-3.5" /> },
  { id: 'ativo', title: 'Ativo', color: 'border-t-emerald-500', icon: <Star className="w-3.5 h-3.5" /> },
]

interface KanbanBoardProps {
  prestadores: Prestador[]
  onStatusChange?: (id: string, status: StatusPrestador) => void
}

export function KanbanBoard({ prestadores, onStatusChange }: KanbanBoardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 overflow-x-auto pb-4">
      {columns.map((col) => {
        const items = prestadores.filter(p => p.status === col.id)
        return (
          <div key={col.id} className="flex flex-col min-w-[260px]">
            <div className={cn('flex items-center justify-between mb-3 px-3 py-2 rounded-lg bg-muted/30 border-t-2', col.color)}>
              <div className="flex items-center gap-2">
                <span className="text-foreground/70">{col.icon}</span>
                <span className="text-sm font-medium text-foreground">{col.title}</span>
              </div>
              <span className="text-xs font-bold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                {items.length}
              </span>
            </div>

            <div className="flex-1 space-y-2 min-h-[200px]">
              {items.map((prestador) => (
                <KanbanCard
                  key={prestador.id}
                  prestador={prestador}
                  onPromote={() => onStatusChange?.(prestador.id, proximoStatus(prestador.status))}
                />
              ))}
              {items.length === 0 && (
                <div className="flex items-center justify-center h-20 rounded-lg border border-dashed border-border/30 text-xs text-muted-foreground/40">
                  Arraste para cá
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function KanbanCard({ prestador, onPromote }: { prestador: Prestador; onPromote: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 rounded-lg bg-card border border-border/50 hover:border-primary/30 transition-all cursor-pointer group shadow-sm"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{prestador.nome}</p>
          <p className="text-xs text-muted-foreground/60">{prestador.tipoVeiculo}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn(
            'text-xs font-bold px-1.5 py-0.5 rounded',
            prestador.score.geral >= 70 ? 'text-emerald-400 bg-emerald-500/10' :
            prestador.score.geral >= 40 ? 'text-amber-400 bg-amber-500/10' :
            'text-rose-400 bg-rose-500/10'
          )}>
            {prestador.score.geral}
          </span>
        </div>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground/60">
        <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {prestador.endereco.cidade || 'N/I'}</div>
        {prestador.contatos[0] && (
          <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> {prestador.contatos[0].valor}</div>
        )}
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
        <div className="flex -space-x-1">
          {prestador.documentos.slice(0, 3).map((doc) => (
            <StatusDot key={doc.id} status={doc.status} className="w-1.5 h-1.5 ring-1 ring-card" />
          ))}
        </div>
        <button
          onClick={onPromote}
          className="text-[10px] font-medium text-primary/70 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
        >
          Avançar →
        </button>
      </div>
    </motion.div>
  )
}

function proximoStatus(atual: StatusPrestador): StatusPrestador {
  const ordem: StatusPrestador[] = ['potencial', 'em_triagem', 'documentacao', 'qualificado', 'ativo']
  const idx = ordem.indexOf(atual)
  return idx < ordem.length - 1 ? ordem[idx + 1] : atual
}