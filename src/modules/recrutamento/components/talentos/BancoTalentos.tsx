import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Filter, Star, MapPin, Truck, Phone, MessageSquare } from 'lucide-react'
import { PremiumCard, PremiumCardHeader, PremiumCardTitle, PremiumCardContent } from '../design-system/PremiumCard'
import { PremiumBadge } from '../design-system/PremiumBadge'
import { EmptyState } from '../design-system/EmptyState'
import { ScoreMeter } from '../score/ScoreMeter'
import { cn } from '../../utils/cn'
import type { TalentosCandidato } from '../../types/recrutamento'
import { Input } from '@/components/ui/input'

interface BancoTalentosProps {
  candidatos: TalentosCandidato[]
}

export function BancoTalentos({ candidatos }: BancoTalentosProps) {
  const [busca, setBusca] = useState('')
  const filtered = candidatos.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.regiao.toLowerCase().includes(busca.toLowerCase()) ||
    c.tipoVeiculo.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
        <Input
          placeholder="Buscar talentos por nome, região ou veículo..."
          className="pl-9 h-9 bg-card"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum talento encontrado"
          description="Candidate-se ou cadastre novos prestadores para alimentar o banco de talentos."
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
                    <PremiumCardTitle>{candidato.nome}</PremiumCardTitle>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Truck className="w-3 h-3 text-muted-foreground/50" />
                      <span className="text-xs text-muted-foreground/60">{candidato.tipoVeiculo}</span>
                    </div>
                  </div>
                  <ScoreMeter score={candidato.score} size="sm" />
                </PremiumCardHeader>

                <PremiumCardContent className="space-y-2 text-xs text-muted-foreground/60">
                  <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {candidato.regiao}</div>
                  <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> {candidato.telefone}</div>
                  <div className="flex items-center gap-1.5"><Star className="w-3 h-3" /> {candidato.experiencia}</div>
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