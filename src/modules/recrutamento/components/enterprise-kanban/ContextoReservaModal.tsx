import { useState } from 'react'
import { Send, X } from 'lucide-react'
import { enterpriseKanbanService } from './enterpriseKanbanService'
import type { ReservaContexto } from './enterpriseKanbanTypes'
import { cn } from '../../utils/cn'
import { toast } from 'sonner'

interface ContextoReservaModalProps {
  candidateId: string
  contextoAtual?: ReservaContexto
  open: boolean
  onClose: () => void
  onSave: () => void
}

export function ContextoReservaModal({ candidateId, contextoAtual, open, onClose, onSave }: ContextoReservaModalProps) {
  const [cliente, setCliente] = useState(contextoAtual?.cliente ?? '')
  const [operacao, setOperacao] = useState(contextoAtual?.operacao ?? '')
  const [regiao, setRegiao] = useState(contextoAtual?.regiao ?? '')
  const [observacao, setObservacao] = useState(contextoAtual?.observacao ?? '')
  const [prioridade, setPrioridade] = useState<'baixa' | 'media' | 'alta'>(contextoAtual?.prioridade ?? 'media')
  const [salvando, setSalvando] = useState(false)

  if (!open) return null

  const handleSalvar = async () => {
    setSalvando(true)
    try {
      await enterpriseKanbanService.salvarReservaContexto(candidateId, {
        cliente: cliente || undefined,
        operacao: operacao || undefined,
        regiao: regiao || undefined,
        observacao: observacao || undefined,
        prioridade,
      })
      toast.success('Contexto da reserva salvo')
      onSave()
      onClose()
    } catch {
      toast.error('Erro ao salvar contexto')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-border/50 bg-card shadow-xl p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Contexto da Reserva</h3>
          </div>
          <button onClick={onClose} className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Cliente</label>
              <input
                value={cliente}
                onChange={e => setCliente(e.target.value)}
                placeholder="Nome do cliente..."
                className="w-full px-2.5 py-1.5 rounded-lg border border-border/40 bg-muted/20 text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Operação</label>
              <input
                value={operacao}
                onChange={e => setOperacao(e.target.value)}
                placeholder="ID da operação..."
                className="w-full px-2.5 py-1.5 rounded-lg border border-border/40 bg-muted/20 text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Região</label>
            <input
              value={regiao}
              onChange={e => setRegiao(e.target.value)}
              placeholder="SP, RJ, MG..."
              className="w-full px-2.5 py-1.5 rounded-lg border border-border/40 bg-muted/20 text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Observação</label>
            <textarea
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              placeholder="Observação opcional..."
              rows={2}
              className="w-full px-2.5 py-1.5 rounded-lg border border-border/40 bg-muted/20 text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40 resize-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Prioridade</label>
            <div className="flex gap-2">
              {(['baixa', 'media', 'alta'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPrioridade(p)}
                  className={cn(
                    'flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                    prioridade === p
                      ? p === 'alta' ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        : p === 'media' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                      : 'bg-muted/20 text-muted-foreground/50 border-border/30 hover:text-muted-foreground hover:border-border/60',
                  )}
                >
                  {p === 'alta' ? 'Alta' : p === 'media' ? 'Média' : 'Baixa'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-medium border border-border/30 text-muted-foreground/60 hover:text-foreground hover:bg-muted/30 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={salvando}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : (contextoAtual ? 'Atualizar' : 'Salvar')}
          </button>
        </div>
      </div>
    </div>
  )
}
