import { Truck, MapPin, Phone, Mail, Star, FileText, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { PremiumCard, PremiumCardHeader, PremiumCardTitle, PremiumCardContent, PremiumCardFooter } from '../design-system/PremiumCard'
import { PremiumBadge } from '../design-system/PremiumBadge'
import { StatusDot } from '../design-system/StatusDot'
import { ScoreMeter } from '../score/ScoreMeter'
import { cn, statusLabel, statusPrestadorColor } from '../../utils/cn'
import type { Prestador } from '../../types/recrutamento'

interface PrestadorCardProps {
  prestador: Prestador
  onClick?: () => void
}

export function PrestadorCard({ prestador, onClick }: PrestadorCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <PremiumCard hover onClick={onClick} className="cursor-pointer">
        <PremiumCardHeader>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <PremiumCardTitle>{prestador.nome}</PremiumCardTitle>
              <PremiumBadge variant={
                prestador.status === 'ativo' ? 'success' :
                prestador.status === 'qualificado' ? 'info' :
                prestador.status === 'suspenso' ? 'danger' : 'default'
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
            {prestador.contatos.find(c => c.tipo === 'whatsapp') && (
              <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> {prestador.contatos.find(c => c.tipo === 'whatsapp')?.valor}</div>
            )}
            {prestador.contatos.find(c => c.tipo === 'email') && (
              <div className="flex items-center gap-1.5 truncate"><Mail className="w-3 h-3" /> {prestador.contatos.find(c => c.tipo === 'email')?.valor}</div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            {prestador.documentos.slice(0, 4).map((doc) => (
              <StatusDot key={doc.id} status={doc.status} />
            ))}
            {prestador.documentos.length > 4 && (
              <span className="text-[10px] text-muted-foreground/50">+{prestador.documentos.length - 4}</span>
            )}
          </div>
        </PremiumCardContent>

        <PremiumCardFooter>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 ml-auto" />
        </PremiumCardFooter>
      </PremiumCard>
    </motion.div>
  )
}