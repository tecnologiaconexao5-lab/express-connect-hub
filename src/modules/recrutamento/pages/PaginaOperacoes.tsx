import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Filter, Plus, Briefcase, MapPin, Truck, Target, Calendar, DollarSign, TrendingUp, Users, MoreHorizontal, PlayCircle, PauseCircle, Archive, Copy, Edit, Trash2, CheckCircle, XCircle, Route, Clock, Bot, MessageSquare } from 'lucide-react'
import { PageHeader } from '../components/design-system/PageHeader'
import { PremiumCard, PremiumCardHeader, PremiumCardTitle, PremiumCardDescription, PremiumCardContent, PremiumCardFooter } from '../components/design-system/PremiumCard'
import { PremiumBadge } from '../components/design-system/PremiumBadge'
import { MetricCard } from '../components/design-system/MetricCard'
import { EmptyState } from '../components/design-system/EmptyState'
import { SkeletonCard } from '../components/design-system/SkeletonCard'
import { ViewToggle } from '../components/design-system/ViewToggle'
import { StatusDot } from '../components/design-system/StatusDot'
import { useOperacoes } from '../hooks/useOperacoes'
import { useRecrutamentoStore } from '../store/recrutamentoStore'
import { formatCurrency, formatDate, statusOperacaoColor, statusLabel, prioridadeColor, cn } from '../utils/cn'
import type { StatusOperacao, Operacao } from '../types/recrutamento'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export function PaginaOperacoes() {
  const {
    operacoes, loading, filtros, setFiltros,
    atualizarStatus, remover, duplicar, metricas,
  } = useOperacoes()
  const { currentView, setCurrentView } = useRecrutamentoStore()
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<StatusOperacao | 'todas'>('todas')

  const filtered = operacoes.filter(op => {
    if (statusFiltro !== 'todas' && op.status !== statusFiltro) return false
    if (busca && !op.nome.toLowerCase().includes(busca.toLowerCase()) && !op.cliente.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  const handleStatus = async (id: string, status: StatusOperacao) => {
    await atualizarStatus(id, status)
    toast.success(`Operação ${statusLabel[status]}!`)
  }

  const handleDuplicar = async (id: string) => {
    await duplicar(id)
    toast.success('Operação duplicada!')
  }

  const handleRemover = async (id: string) => {
    if (window.confirm('Excluir esta operação permanentemente?')) {
      await remover(id)
      toast.success('Operação excluída!')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Briefcase className="w-5 h-5 text-primary" />}
        title="Operações"
        description="Gerencie vagas, acompanhe captação e controle o pipeline de recrutamento"
        actions={
          <div className="flex items-center gap-3">
            <ViewToggle value={currentView} onChange={setCurrentView} />
            <Button size="sm" className="h-9 gap-1.5">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nova Operação</span>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard title="Total" value={String(metricas.total)} icon={<Briefcase className="w-4 h-4" />} loading={loading} />
        <MetricCard title="Ativas" value={String(metricas.ativas)} icon={<PlayCircle className="w-4 h-4" />} trend={12} loading={loading} />
        <MetricCard title="Vagas Abertas" value={String(metricas.vagasAbertas)} icon={<Target className="w-4 h-4" />} loading={loading} />
        <MetricCard title="Faturamento" value={formatCurrency(metricas.faturamentoPrevisto)} icon={<DollarSign className="w-4 h-4" />} loading={loading} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <Input
            placeholder="Buscar operações..."
            className="pl-9 h-9 bg-card"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['todas', 'aberta', 'em_andamento', 'pausada', 'encerrada'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFiltro(s as any)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border',
                statusFiltro === s
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-card text-muted-foreground/60 border-border/40 hover:border-border/80 hover:text-foreground'
              )}
            >
              {s === 'todas' ? 'Todas' : statusLabel[s]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} lines={4} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma operação encontrada"
          description="Crie sua primeira operação para começar o recrutamento inteligente."
          action={
            <Button size="sm"><Plus className="w-4 h-4 mr-1.5" /> Nova Operação</Button>
          }
        />
      ) : currentView === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((op) => (
            <OperacaoCard
              key={op.id}
              operacao={op}
              onStatusChange={handleStatus}
              onDuplicar={handleDuplicar}
              onRemover={handleRemover}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/20">
                <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Operação</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Cliente</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">Região</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden xl:table-cell">Veículo</th>
                <th className="text-center p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                <th className="text-right p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Valor</th>
                <th className="text-right p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Vagas</th>
                <th className="text-right p-3 w-20">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((op) => (
                <tr key={op.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                  <td className="p-3 font-medium text-foreground">{op.nome}</td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">{op.cliente}</td>
                  <td className="p-3 text-muted-foreground hidden lg:table-cell">{op.regiao}</td>
                  <td className="p-3 text-muted-foreground hidden xl:table-cell">{op.tipoVeiculo}</td>
                  <td className="p-3 text-center">
                    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border', statusOperacaoColor[op.status])}>
                      <StatusDot status={op.status} />
                      {statusLabel[op.status]}
                    </span>
                  </td>
                  <td className="p-3 text-right font-medium">{formatCurrency(op.financeiro.valorCliente)}</td>
                  <td className="p-3 text-right">
                    <span className="font-medium">{op.meta.vagasPreenchidas}/{op.meta.vagasTotais}</span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleStatus(op.id, op.status === 'pausada' ? 'aberta' : 'pausada')}
                        className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"
                      >
                        {op.status === 'pausada' ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => handleDuplicar(op.id)} className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleRemover(op.id)} className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-rose-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function OperacaoCard({ operacao: op, onStatusChange, onDuplicar, onRemover }: {
  operacao: Operacao
  onStatusChange: (id: string, status: StatusOperacao) => Promise<void>
  onDuplicar: (id: string) => Promise<void>
  onRemover: (id: string) => Promise<void>
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <PremiumCard hover>
        <PremiumCardHeader>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <PremiumCardTitle>{op.nome}</PremiumCardTitle>
              <PremiumBadge variant={op.prioridade === 'urgente' ? 'danger' : op.prioridade === 'alta' ? 'warning' : 'info'} size="sm">
                {statusLabel[op.prioridade]}
              </PremiumBadge>
            </div>
            <PremiumCardDescription>{op.cliente}</PremiumCardDescription>
          </div>
          <span className={cn('flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0', statusOperacaoColor[op.status])}>
            <StatusDot status={op.status} pulse={op.status === 'em_andamento'} />
            {statusLabel[op.status]}
          </span>
        </PremiumCardHeader>

        <PremiumCardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground/80">
            <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {op.regiao}</div>
            <div className="flex items-center gap-1.5"><Truck className="w-3 h-3" /> {op.tipoVeiculo}</div>
            {op.rotaOrigem && (
              <div className="flex items-center gap-1.5 col-span-2"><Route className="w-3 h-3" /> {op.rotaOrigem} → {op.rotaDestino}</div>
            )}
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">Valor</span>
            <span className="text-sm font-bold text-foreground">{formatCurrency(op.financeiro.valorCliente)}</span>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground/60">
            <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {op.meta.vagasPreenchidas}/{op.meta.vagasTotais}</span>
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {op.meta.diariasPorVaga}d</span>
            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {op.meta.captados} captados</span>
          </div>

          <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(op.meta.vagasPreenchidas / Math.max(op.meta.vagasTotais, 1)) * 100}%` }}
              className="h-full rounded-full bg-emerald-500"
            />
          </div>
        </PremiumCardContent>

        <PremiumCardFooter className="justify-between">
          <div className="flex gap-1">
            <button
              onClick={() => onStatusChange(op.id, op.status === 'pausada' ? 'aberta' : 'pausada')}
              className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"
              title={op.status === 'pausada' ? 'Ativar' : 'Pausar'}
            >
              {op.status === 'pausada' ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => onStatusChange(op.id, 'encerrada')}
              className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"
              title="Encerrar"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDuplicar(op.id)}
              className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"
              title="Duplicar"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-1">
            <button className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground" title="WhatsApp">
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onRemover(op.id)}
              className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-rose-400"
              title="Excluir"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </PremiumCardFooter>
      </PremiumCard>
    </motion.div>
  )
}