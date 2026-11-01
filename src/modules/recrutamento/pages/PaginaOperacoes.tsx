import { useState } from 'react'
import { confirmAction } from '@/lib/confirmDialog'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Filter, Plus, Briefcase, MapPin, Truck, Target, Calendar, DollarSign, TrendingUp, Users, MoreHorizontal, PlayCircle, PauseCircle, Archive, Copy, Edit, Trash2, CheckCircle, XCircle, Route, Clock, Bot, MessageSquare, Eye } from 'lucide-react'
import { PageHeader } from '../components/design-system/PageHeader'
import { PremiumCard, PremiumCardHeader, PremiumCardTitle, PremiumCardDescription, PremiumCardContent, PremiumCardFooter } from '../components/design-system/PremiumCard'
import { PremiumBadge } from '../components/design-system/PremiumBadge'
import { MetricCard } from '../components/design-system/MetricCard'
import { EmptyState } from '../components/design-system/EmptyState'
import { SkeletonCard } from '../components/design-system/SkeletonCard'
import { ViewToggle } from '../components/design-system/ViewToggle'
import { StatusDot } from '../components/design-system/StatusDot'
import { DetalhesOperacaoSheet } from '../components/DetalhesOperacaoSheet'
import { useOperacoes } from '../hooks/useOperacoes'
import { useRecrutamentoStore } from '../store/recrutamentoStore'
import { useRecrutamentoUI } from '../hooks/useRecrutamentoUI'
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
  const { currentView, setCurrentView, selectedOperacaoId, setSelectedOperacaoId } = useRecrutamentoStore()
  const { navegar } = useRecrutamentoUI()
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
    const confirmado = await confirmAction({
      title: 'Excluir operação',
      description: 'Excluir esta operação permanentemente?',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    })
    if (confirmado) {
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
            <Button size="sm" className="h-9 gap-1.5" onClick={() => navegar('nova-operacao')}>
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
          {['todas', 'aberta', 'em_captacao', 'preenchida', 'pausada', 'encerrada'].map((s) => (
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
            <Button size="sm" onClick={() => navegar('nova-operacao')}><Plus className="w-4 h-4 mr-1.5" /> Nova Operação</Button>
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
              onDetalhes={() => setSelectedOperacaoId(op.id)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2E1065]/15 bg-[#2E1065]/5">
                <th className="text-left p-3 font-bold text-[#2E1065] text-xs uppercase tracking-wider">Operação</th>
                <th className="text-left p-3 font-bold text-[#2E1065] text-xs uppercase tracking-wider hidden md:table-cell">Cliente</th>
                <th className="text-left p-3 font-bold text-[#2E1065] text-xs uppercase tracking-wider hidden lg:table-cell">Região</th>
                <th className="text-left p-3 font-bold text-[#2E1065] text-xs uppercase tracking-wider hidden xl:table-cell">Veículo</th>
                <th className="text-center p-3 font-bold text-[#2E1065] text-xs uppercase tracking-wider">Status</th>
                <th className="text-right p-3 font-bold text-[#2E1065] text-xs uppercase tracking-wider">Valor Prest.</th>
                <th className="text-right p-3 font-bold text-[#2E1065] text-xs uppercase tracking-wider">Vagas</th>
                <th className="text-right p-3 w-20 text-[#2E1065]">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((op) => (
                <tr key={op.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setSelectedOperacaoId(op.id)}>
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
                  <td className="p-3 text-right font-medium">{formatCurrency(op.financeiro.valorPrestador)}</td>
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
      <DetalhesOperacaoSheet
        operacaoId={selectedOperacaoId}
        open={!!selectedOperacaoId}
        onOpenChange={(open) => { if (!open) setSelectedOperacaoId(null) }}
      />
    </div>
  )
}

function OperacaoCard({ operacao: op, onStatusChange, onDuplicar, onRemover, onDetalhes }: {
  operacao: Operacao
  onStatusChange: (id: string, status: StatusOperacao) => Promise<void>
  onDuplicar: (id: string) => Promise<void>
  onRemover: (id: string) => Promise<void>
  onDetalhes: () => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <PremiumCard hover onClick={onDetalhes}>
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
            <StatusDot status={op.status} pulse={op.status === 'em_captacao'} />
            {statusLabel[op.status]}
          </span>
        </PremiumCardHeader>

        <PremiumCardContent className="space-y-3">
          <div className="rounded-lg border border-[#2E1065]/15 bg-gradient-to-br from-violet-50 to-orange-50/70 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#2E1065]/70">
                  Veículo / Operação
                </p>
                <p className="truncate text-sm font-black text-[#2E1065]">
                  {op.logistica?.tipoVeiculoDetalhado || op.tipoVeiculo}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1">
                <PremiumBadge variant="info" size="sm">{op.tipoCarga}</PremiumBadge>
                {op.temperatura && (
                  <PremiumBadge variant="warning" size="sm">{op.temperatura}</PremiumBadge>
                )}
                {op.logistica?.aceitaRefrigerado && (
                  <PremiumBadge variant="success" size="sm">Refrigerada</PremiumBadge>
                )}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-orange-500" /> {op.regiao}</span>
              <span className="flex items-center gap-1"><Target className="h-3 w-3 text-orange-500" /> {op.meta.vagasPreenchidas}/{op.meta.vagasTotais} vagas</span>
              <span className="flex items-center gap-1"><Users className="h-3 w-3 text-orange-500" /> {op.meta.captados} captados</span>
            </div>
            {op.rotaOrigem && (
              <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-slate-500">
                <Route className="h-3 w-3 shrink-0 text-[#2E1065]" /> {op.rotaOrigem} → {op.rotaDestino}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-lg border border-[#2E1065]/10 bg-[#2E1065]/5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#2E1065]/70">Repasse ao prestador</span>
            <span className="text-sm font-black text-[#2E1065]">{formatCurrency(op.financeiro.valorPrestador)}</span>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground/60">
            <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {op.meta.vagasPreenchidas}/{op.meta.vagasTotais}</span>
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {op.meta.diariasPorVaga}d</span>
            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {op.meta.captados} captados</span>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-[10px] font-semibold text-slate-500">
              <span>Funil de preenchimento</span>
              <span>{Math.round((op.meta.vagasPreenchidas / Math.max(op.meta.vagasTotais, 1)) * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-violet-100">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(op.meta.vagasPreenchidas / Math.max(op.meta.vagasTotais, 1)) * 100}%` }}
                className="h-full rounded-full bg-gradient-to-r from-[#2E1065] via-violet-500 to-orange-500"
              />
            </div>
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