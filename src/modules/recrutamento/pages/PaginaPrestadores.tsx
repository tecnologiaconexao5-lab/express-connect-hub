import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Truck, MapPin, Phone, Star, Filter, Plus, ChevronRight, Users, Target, Shield, Award, Eye, Pen, Activity } from 'lucide-react'
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
]

export function PaginaPrestadores() {
  const { prestadores, loading, metricas, atualizarStatus, remover } = usePrestadores()
  const { selectedPrestadorId, setSelectedPrestadorId } = useRecrutamentoStore()
  const { navegar } = useRecrutamentoUI()
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<StatusPrestador | 'todas'>('todas')
  const [origemFiltro, setOrigemFiltro] = useState<OrigemCadastro | 'todas'>('todas')
  const [targetTab, setTargetTab] = useState<'perfil' | 'veiculo' | 'historico' | 'score' | 'documentos' | 'crm' | 'operacoes'>('perfil')
  const [initialEdit, setInitialEdit] = useState(false)

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
          <Button size="sm" className="h-9 gap-1.5" onClick={() => navegar('nova-operacao')}>
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
          title="Nenhum prestador encontrado"
          description="Cadastre prestadores ou ajuste os filtros."
          action={
            <Button size="sm" onClick={() => navegar('nova-operacao')}><Plus className="w-4 h-4 mr-1.5" /> Novo Prestador</Button>
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

function PrestadorCard({ prestador, onClick, onAction }: { 
  prestador: Prestador
  onClick: () => void
  onAction: (id: string, tab: 'perfil' | 'veiculo' | 'historico' | 'score' | 'documentos' | 'crm' | 'operacoes', edit?: boolean) => void 
}) {
  const contato = prestador.contatos.find(c => c.tipo === 'whatsapp' || c.tipo === 'telefone')

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
            <ScoreMeter score={prestador.score.geral} size="sm" />
          </PremiumCardHeader>

          <PremiumCardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground/70">
              <div className="flex items-center gap-1.5"><Truck className="w-3 h-3" /> {prestador.tipoVeiculo}</div>
              <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {prestador.endereco.cidade}/{prestador.endereco.uf}</div>
              {contato && (
                <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> {contato.valor}</div>
              )}
              <div className="flex items-center gap-1.5"><Star className="w-3 h-3" /> {prestador.historico?.quantidadeOperacoes || 0} ops</div>
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
            className="text-[10px] h-7 px-1.5 text-muted-foreground hover:text-primary gap-1"
            onClick={(e) => { e.stopPropagation(); onAction(prestador.id, 'historico', false) }}
          >
            <Activity className="w-3 h-3" />
            <span>Histórico</span>
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-[10px] h-7 px-1.5 text-muted-foreground hover:text-primary gap-1"
            onClick={(e) => { e.stopPropagation(); onAction(prestador.id, 'operacoes', false) }}
          >
            <Truck className="w-3 h-3" />
            <span>Compatíveis</span>
          </Button>
        </PremiumCardFooter>
      </PremiumCard>
    </motion.div>
  )
}
