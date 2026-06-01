import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, Filter, Star, MapPin, Truck, Phone, MessageSquare, ArrowUpDown, TrendingUp, AlertCircle } from 'lucide-react'
import { PremiumCard, PremiumCardHeader, PremiumCardTitle, PremiumCardContent } from '../design-system/PremiumCard'
import { PremiumBadge } from '../design-system/PremiumBadge'
import { EmptyState } from '../design-system/EmptyState'
import { ScoreMeter } from '../score/ScoreMeter'
import { cn } from '../../utils/cn'
import type { TalentosCandidato } from '../../types/recrutamento'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface BancoTalentosProps {
  candidatos: TalentosCandidato[]
}

type ScoreClassificacao = 'Excelente' | 'Bom' | 'Regular' | 'Baixo'
type OrderField = 'score' | 'recente' | 'nome'

const SCORE_LABELS: Record<ScoreClassificacao, string> = {
  Excelente: 'Excelente',
  Bom: 'Bom',
  Regular: 'Regular',
  Baixo: 'Baixo',
}

const SCORE_COLORS: Record<ScoreClassificacao, string> = {
  Excelente: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Bom: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Regular: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Baixo: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const SCORE_RANGES: { min: number; max: number; label: ScoreClassificacao }[] = [
  { min: 80, max: 100, label: 'Excelente' },
  { min: 60, max: 79, label: 'Bom' },
  { min: 40, max: 59, label: 'Regular' },
  { min: 0, max: 39, label: 'Baixo' },
]

function getClassificacao(score: number): ScoreClassificacao {
  if (score >= 80) return 'Excelente'
  if (score >= 60) return 'Bom'
  if (score >= 40) return 'Regular'
  return 'Baixo'
}

function calcularScoreAderencia(c: TalentosCandidato): number {
  if (c.score > 0) return c.score
  let s = 0
  if (c.tipoVeiculo && c.tipoVeiculo.trim()) s += 25
  if (c.regiao && c.regiao.trim()) s += 20
  if (c.documentosAprovados >= 3 || c.statusDocumental === 'completo') s += 20
  if (c.disponibilidade === 'imediata' || c.disponibilidade === 'parcial') s += 20
  if (c.status === 'aprovado' || c.status === 'agregado' || c.status === 'reserva') s += 15
  return s
}

function getMotivosPositivos(c: TalentosCandidato): string[] {
  const m: string[] = []
  if (c.tipoVeiculo?.trim()) m.push('Veiculo cadastrado')
  if (c.regiao?.trim()) m.push('Regiao definida')
  if (c.documentosAprovados >= 3 || c.statusDocumental === 'completo') m.push('Documentacao completa')
  if (c.disponibilidade === 'imediata' || c.disponibilidade === 'parcial') m.push('Disponibilidade ativa')
  if (c.status === 'aprovado' || c.status === 'agregado') m.push('Aprovado / Agregado')
  if (c.experiencia?.trim()) m.push('Experiencia informada')
  return m
}

function getPendencias(c: TalentosCandidato): string[] {
  const p: string[] = []
  if (!c.tipoVeiculo?.trim()) p.push('Sem veiculo')
  if (!c.regiao?.trim()) p.push('Regiao nao definida')
  if (c.documentosAprovados < 3 && c.statusDocumental !== 'completo') p.push('Documentacao incompleta')
  if (!c.disponibilidade || c.disponibilidade === 'indisponivel') p.push('Indisponivel')
  if (c.status !== 'aprovado' && c.status !== 'agregado') p.push('Status pendente (' + (c.status || 'novo') + ')')
  return p
}

export function BancoTalentos({ candidatos }: BancoTalentosProps) {
  const [busca, setBusca] = useState('')
  const [filtroScore, setFiltroScore] = useState<ScoreClassificacao | 'todas'>('todas')
  const [ordem, setOrdem] = useState<OrderField>('score')

  const enriched = useMemo(() => {
    return candidatos.map(c => ({
      ...c,
      scoreAderencia: calcularScoreAderencia(c),
      classificacao: getClassificacao(calcularScoreAderencia(c)),
      motivos: getMotivosPositivos(c),
      pendencias: getPendencias(c),
    }))
  }, [candidatos])

  const filtered = useMemo(() => {
    return enriched
      .filter(c => {
        if (busca) {
          const q = busca.toLowerCase()
          if (!c.nome.toLowerCase().includes(q) &&
              !c.regiao.toLowerCase().includes(q) &&
              !c.tipoVeiculo.toLowerCase().includes(q)) return false
        }
        if (filtroScore !== 'todas' && c.classificacao !== filtroScore) return false
        return true
      })
      .sort((a, b) => {
        if (ordem === 'score') return b.scoreAderencia - a.scoreAderencia
        if (ordem === 'recente') return (b.dataContato || '').localeCompare(a.dataContato || '')
        return a.nome.localeCompare(b.nome)
      })
  }, [enriched, busca, filtroScore, ordem])

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <Input
            placeholder="Buscar talentos por nome, regiao ou veiculo..."
            className="pl-9 h-9 bg-card"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Select value={ordem} onValueChange={(v) => setOrdem(v as OrderField)}>
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Maior Score</SelectItem>
              <SelectItem value="recente">Mais Recente</SelectItem>
              <SelectItem value="nome">Nome (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant={filtroScore === 'todas' ? 'default' : 'outline'}
          className="h-7 text-[10px]"
          onClick={() => setFiltroScore('todas')}
        >
          Todas
        </Button>
        {SCORE_RANGES.map(({ label }) => (
          <Button
            key={label}
            size="sm"
            variant={filtroScore === label ? 'default' : 'outline'}
            className="h-7 text-[10px]"
            onClick={() => setFiltroScore(filtroScore === label ? 'todas' : label)}
          >
            {label}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum talento encontrado"
          description="Cadastre candidatos no Pipeline ou importe contatos."
          action={
            <Button size="sm" onClick={() => window.dispatchEvent(new CustomEvent('navegar-recrutamento', { detail: 'pipeline-kanban' }))}>
              <MessageSquare className="w-4 h-4 mr-1.5" /> Ir para Pipeline
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((candidato) => (
            <motion.div
              key={candidato.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <PremiumCard hover>
                <PremiumCardHeader>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <PremiumCardTitle>{candidato.nome}</PremiumCardTitle>
                      <PremiumBadge className={SCORE_COLORS[candidato.classificacao]} size="sm">
                        {candidato.classificacao}
                      </PremiumBadge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Truck className="w-3 h-3 text-muted-foreground/50" />
                      <span className="text-xs text-muted-foreground/60">{candidato.tipoVeiculo || '—'}</span>
                    </div>
                  </div>
                  <ScoreMeter score={candidato.scoreAderencia} size="sm" />
                </PremiumCardHeader>

                <PremiumCardContent className="space-y-2 text-xs text-muted-foreground/60">
                  <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {candidato.regiao || '—'}</div>
                  <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> {candidato.telefone}</div>
                  {candidato.disponibilidade && (
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${candidato.disponibilidade === 'imediata' ? 'bg-emerald-400' : candidato.disponibilidade === 'parcial' ? 'bg-amber-400' : 'bg-red-400'}`} />
                      {candidato.disponibilidade === 'imediata' ? 'Disponivel imediato' : candidato.disponibilidade === 'parcial' ? 'Disponivel parcial' : 'Indisponivel'}
                    </div>
                  )}
                  {candidato.experiencia && (
                    <div className="flex items-center gap-1.5"><Star className="w-3 h-3" /> {candidato.experiencia}</div>
                  )}

                  {candidato.motivos.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {candidato.motivos.slice(0, 2).map((m, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/10 text-emerald-400">
                          <TrendingUp className="w-2.5 h-2.5 inline mr-0.5" />{m}
                        </span>
                      ))}
                    </div>
                  )}

                  {candidato.pendencias.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {candidato.pendencias.slice(0, 2).map((p, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/10 text-amber-400">
                          <AlertCircle className="w-2.5 h-2.5 inline mr-0.5" />{p}
                        </span>
                      ))}
                    </div>
                  )}
                </PremiumCardContent>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
                  <PremiumBadge variant={candidato.canalCaptacao === 'whatsapp' ? 'success' : 'info'} size="sm">
                    {candidato.canalCaptacao}
                  </PremiumBadge>
                  <button className="text-xs text-primary/70 hover:text-primary flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Contatar
                  </button>
                </div>
              </PremiumCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
