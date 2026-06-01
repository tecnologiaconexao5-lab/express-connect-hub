import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Truck, MapPin, Phone, Star, Filter, Plus, ChevronRight, Users, Target, Shield, Award, Eye, Pen, Activity, Ban, Trash2, AlertTriangle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '../components/design-system/PageHeader'
import { PremiumCard, PremiumCardHeader, PremiumCardTitle, PremiumCardContent, PremiumCardFooter } from '../components/design-system/PremiumCard'
import { PremiumBadge } from '../components/design-system/PremiumBadge'
import { MetricCard } from '../components/design-system/MetricCard'
import { EmptyState } from '../components/design-system/EmptyState'
import { SkeletonCard } from '../components/design-system/SkeletonCard'
import { StatusDot } from '../components/design-system/StatusDot'
import { ScoreMeter } from '../components/score/ScoreMeter'
import { DetalhesPrestadorSheet } from '../components/DetalhesPrestadorSheet'
import { usePrestadores } from '../hooks/usePrestadores'
import { useRecrutamentoStore } from '../store/recrutamentoStore'
import { useRecrutamentoUI } from '../hooks/useRecrutamentoUI'
import { formatCurrency, formatDate, statusPrestadorColor, statusLabel, cn } from '../utils/cn'
import type { StatusPrestador, OrigemCadastro, Prestador } from '../types/recrutamento'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const ORIGEM_OPTIONS: { value: OrigemCadastro; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'site', label: 'Site' },
  { value: 'manual', label: 'Manual' },
  { value: 'fretebras', label: 'Fretebras' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'anuncio', label: 'Anúncio' },
  { value: 'outro', label: 'Outro' },
]

export function PaginaPrestadores() {
  const { prestadores, loading, metricas, atualizarStatus, remover, divergencias, corrigirDivergencia } = usePrestadores()
  const { selectedPrestadorId, setSelectedPrestadorId } = useRecrutamentoStore()
  const { navegar } = useRecrutamentoUI()
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<StatusPrestador | 'todas'>('todas')
  const [origemFiltro, setOrigemFiltro] = useState<OrigemCadastro | 'todas'>('todas')
  const [targetTab, setTargetTab] = useState<'perfil' | 'veiculo' | 'historico' | 'score' | 'documentos' | 'crm' | 'operacoes'>('perfil')
  const [initialEdit, setInitialEdit] = useState(false)
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set())

  const handleSync = async (d: typeof divergencias[number]) => {
    setSyncingIds(prev => new Set(prev).add(d.prestadorId))
    try {
      const result = await corrigirDivergencia(d)
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    } catch (err) {
      toast.error('Erro ao re-sincronizar prestador')
    } finally {
      setSyncingIds(prev => {
        const next = new Set(prev)
        next.delete(d.prestadorId)
        return next
      })
    }
  }

  const handleOpenSheet = (id: string, tab: typeof targetTab, edit = false) => {
    setTargetTab(tab)
    setInitialEdit(edit)
    setSelectedPrestadorId(id)
  }

  const filtered = prestadores.filter(p => {
    if (statusFiltro !== 'todas' && p.status !== statusFiltro) return false
    if (origemFiltro !== 'todas' && p.origemCadastro !== origemFiltro) return false
    if (busca) {
      const q = busca.toLowerCase()
      if (!p.nome.toLowerCase().includes(q) &&
          !p.cpfCnpj.includes(q) &&
          !p.contatos.some(c => c.valor.includes(q))) return false
    }
    return true
  })

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Truck className="w-5 h-5 text-primary" />}
        title="Prestadores"
        description="Banco operacional de agregados — gerencie cadastro, histórico e frota"
        actions={
          <Button size="sm" className="h-9 gap-1.5" onClick={() => {
            navegar('pipeline-kanban')
            toast.info('Cadastre um interessado no Pipeline Enterprise para iniciar o fluxo: interessado → candidato → aprovado → prestador')
          }}>
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo Prestador</span>
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard title="Total" value={String(metricas.total)} icon={<Users className="w-4 h-4" />} loading={loading} />
        <MetricCard title="Agregados" value={String(metricas.agregados)} icon={<Award className="w-4 h-4" />} loading={loading} />
        <MetricCard title="Em Análise" value={String(metricas.analise)} icon={<Shield className="w-4 h-4" />} loading={loading} />
        <MetricCard title="Score Médio" value={String(Math.round(metricas.scoreMedio))} icon={<Star className="w-4 h-4" />} loading={loading} />
      </div>

      {divergencias.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-medium">
              {divergencias.length} divergência{divergencias.length > 1 ? 's' : ''} de sincronização detectada{divergencias.length > 1 ? 's' : ''}
            </span>
            <span className="text-amber-400/60 text-xs ml-auto">
              recrutamento &harr; operacional
            </span>
          </div>
          <div className="grid gap-1.5">
            {divergencias.map(d => {
              const isSyncing = syncingIds.has(d.prestadorId)
              return (
              <div key={d.prestadorId} className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/30 border border-border/30 text-xs">
                <span className={`shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full ${
                  d.tipo === 'ausente' ? 'bg-red-400' : 'bg-amber-400'
                }`} />
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-foreground/80">{d.prestadorNome}</span>
                  <span className="text-muted-foreground/60 ml-1">
                    {d.tipo === 'ausente' ? '— sem registro operacional' : `— status "${d.statusOperacional}" (esperado: "${d.statusRecrutamento === 'bloqueado' ? 'inativo' : 'ativo'}")`}
                  </span>
                </div>
                <span className="shrink-0 text-muted-foreground/40 whitespace-nowrap">{d.telefone}</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isSyncing}
                  className="h-6 px-2 text-[10px] gap-1 border-amber-500/40 text-amber-300 hover:bg-amber-500/10 hover:text-amber-200 shrink-0"
                  onClick={(e) => { e.stopPropagation(); handleSync(d) }}
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? '...' : 'Re-sincronizar'}</span>
                </Button>
              </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <Input
            placeholder="Buscar por nome, CPF ou telefone..."
            className="pl-9 h-9 bg-card"
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Select value={statusFiltro} onValueChange={v => setStatusFiltro(v as StatusPrestador | 'todas')}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos os Status</SelectItem>
              {(['novo', 'em_analise', 'aprovado', 'reserva', 'agregado', 'bloqueado'] as StatusPrestador[]).map(s => (
                <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={origemFiltro} onValueChange={v => setOrigemFiltro(v as OrigemCadastro | 'todas')}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas Origens</SelectItem>
              {ORIGEM_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} lines={5} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum prestador agregado encontrado"
          description="Cadastre ou converta candidatos do Banco de Talentos."
          action={
            <div className="flex gap-2">
              <Button size="sm" onClick={() => {
                navegar('pipeline-kanban')
                toast.info('Cadastre um interessado no Pipeline Enterprise para iniciar o fluxo: interessado → candidato → aprovado → prestador')
              }}><Plus className="w-4 h-4 mr-1.5" /> Novo Prestador</Button>
              <Button size="sm" variant="outline" onClick={() => navegar('talentos')}><Users className="w-4 h-4 mr-1.5" /> Ver Banco de Talentos</Button>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <PrestadorCard
              key={p.id}
              prestador={p}
              onAction={handleOpenSheet}
              onClick={() => handleOpenSheet(p.id, 'perfil', false)}
              onToggleBlock={async (id) => {
                try {
                  const prestador = prestadores.find(p => p.id === id)
                  if (!prestador) return
                  const novoStatus = prestador.status === 'bloqueado' ? 'aprovado' : 'bloqueado'
                  await atualizarStatus(id, novoStatus)
                  toast.success(prestador.status === 'bloqueado' ? 'Prestador desbloqueado' : 'Prestador bloqueado')
                } catch { toast.error('Erro ao alterar status') }
              }}
              onRemove={async (id) => {
                const prestador = prestadores.find(p => p.id === id)
                if (!window.confirm(`Remover definitivamente ${prestador?.nome ?? 'prestador'}?`)) return
                try {
                  await remover(id)
                  toast.success('Prestador removido')
                } catch (err) {
                  const mensagem = err instanceof Error ? err.message : 'Erro ao remover prestador'
                  if (mensagem.includes('vínculos operacionais')) {
                    toast.error(mensagem, { duration: 6000 })
                  } else {
                    toast.error('Erro ao remover prestador')
                  }
                }
              }}
            />
          ))}
        </div>
      )}

      <DetalhesPrestadorSheet
        prestadorId={selectedPrestadorId}
        open={!!selectedPrestadorId}
        onOpenChange={(open) => { if (!open) setSelectedPrestadorId(null) }}
        defaultTab={targetTab}
        initialEdit={initialEdit}
      />
    </div>
  )
}

function PrestadorCard({ prestador, onClick, onAction, onToggleBlock, onRemove }: { 
  prestador: Prestador
  onClick: () => void
  onAction: (id: string, tab: 'perfil' | 'veiculo' | 'historico' | 'score' | 'documentos' | 'crm' | 'operacoes', edit?: boolean) => void 
  onToggleBlock: (id: string) => void
  onRemove: (id: string) => void
}) {
  const contato = prestador.contatos.find(c => c.tipo === 'whatsapp' || c.tipo === 'telefone')
  const docsCount = prestador.documentos?.length || 0
  const docsAprovados = prestador.documentos?.filter(d => d.status === 'aprovado').length || 0
  const temVeiculo = !!(prestador.tipoVeiculo || prestador.placaVeiculo)
  const temDocIncompleta = docsAprovados < 3
  const ultimaOp = prestador.historico?.ultimaOperacao
  const qtdOps = prestador.historico?.quantidadeOperacoes || 0

  const scoreSimples = (
    (docsAprovados >= 3 ? 30 : 0) +
    (temVeiculo ? 20 : 0) +
    (prestador.disponibilidade && prestador.disponibilidade !== 'indisponivel' ? 20 : 0) +
    (prestador.status === 'agregado' || prestador.status === 'aprovado' ? 20 : 0) +
    (qtdOps > 0 ? 10 : 0)
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <PremiumCard hover onClick={onClick} className="cursor-pointer h-full flex flex-col justify-between">
        <div>
          <PremiumCardHeader>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <PremiumCardTitle className="truncate max-w-[150px] sm:max-w-none">{prestador.nome}</PremiumCardTitle>
                <PremiumBadge variant={
                  prestador.status === 'agregado' ? 'success' :
                  prestador.status === 'aprovado' ? 'info' :
                  prestador.status === 'bloqueado' ? 'danger' : 'default'
                } dot size="sm">
                  {statusLabel[prestador.status]}
                </PremiumBadge>
              </div>
              <p className="text-xs text-muted-foreground/60">{prestador.cpfCnpj}</p>
            </div>
            <ScoreMeter score={prestador.score.geral || scoreSimples} size="sm" />
          </PremiumCardHeader>

          <PremiumCardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground/70">
              <div className="flex items-center gap-1.5"><Truck className="w-3 h-3" /> {prestador.tipoVeiculo || '—'}</div>
              <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {prestador.endereco.cidade}/{prestador.endereco.uf}</div>
              {contato && (
                <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> {contato.valor}</div>
              )}
              <div className="flex items-center gap-1.5"><Star className="w-3 h-3" /> {qtdOps} ops</div>
            </div>

            {ultimaOp && (
              <div className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                <Activity className="w-2.5 h-2.5" />
                Ultima operacao: {formatDate(ultimaOp)}
              </div>
            )}

            <div className="flex flex-wrap gap-1">
              {prestador.status === 'agregado' && <PremiumBadge variant="success" size="sm">Apto</PremiumBadge>}
              {prestador.status === 'bloqueado' && <PremiumBadge variant="danger" size="sm">Bloqueado</PremiumBadge>}
              {prestador.disponibilidade === 'indisponivel' && <PremiumBadge variant="warning" size="sm">Indisponivel</PremiumBadge>}
              {temDocIncompleta && prestador.status !== 'bloqueado' && <PremiumBadge variant="warning" size="sm">Documentacao incompleta</PremiumBadge>}
              {!temVeiculo && <PremiumBadge variant="warning" size="sm">Sem veiculo</PremiumBadge>}
            </div>

            {prestador.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {prestador.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted/30 text-muted-foreground">{tag}</span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              {prestador.disponibilidade && (
                <span className="text-[10px] text-muted-foreground/50">{prestador.disponibilidade}</span>
              )}
              {prestador.historico?.avaliacaoOperacional > 0 && (
                <span className="text-[10px] flex items-center gap-1">
                  <Star className="w-2.5 h-2.5 text-amber-400" />
                  {prestador.historico.avaliacaoOperacional.toFixed(1)}
                </span>
              )}
            </div>
          </PremiumCardContent>
        </div>

        <PremiumCardFooter className="flex flex-wrap items-center justify-between gap-1 pt-2 border-t border-border/40 mt-3">
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-[10px] h-7 px-1.5 text-muted-foreground hover:text-primary gap-1"
            onClick={(e) => { e.stopPropagation(); onAction(prestador.id, 'perfil', false) }}
          >
            <Eye className="w-3 h-3" />
            <span>Ver</span>
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-[10px] h-7 px-1.5 text-muted-foreground hover:text-primary gap-1"
            onClick={(e) => { e.stopPropagation(); onAction(prestador.id, 'perfil', true) }}
          >
            <Pen className="w-3 h-3" />
            <span>Editar</span>
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            className={`text-[10px] h-7 px-1.5 gap-1 ${prestador.status === 'bloqueado' ? 'text-amber-400 hover:text-amber-300' : 'text-rose-400/60 hover:text-rose-400'}`}
            onClick={(e) => { e.stopPropagation(); onToggleBlock(prestador.id) }}
          >
            <Ban className="w-3 h-3" />
            <span>{prestador.status === 'bloqueado' ? 'Desbloquear' : 'Bloquear'}</span>
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-[10px] h-7 px-1.5 text-muted-foreground/40 hover:text-rose-400 gap-1"
            onClick={(e) => { e.stopPropagation(); onRemove(prestador.id) }}
          >
            <Trash2 className="w-3 h-3" />
            <span>Remover</span>
          </Button>
        </PremiumCardFooter>
      </PremiumCard>
    </motion.div>
  )
}
