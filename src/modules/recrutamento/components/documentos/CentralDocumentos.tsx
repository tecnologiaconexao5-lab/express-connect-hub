import { useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Upload, CheckCircle, XCircle, AlertTriangle, Clock, Search, Filter, Eye } from 'lucide-react'
import { PremiumCard, PremiumCardHeader, PremiumCardTitle, PremiumCardContent } from '../design-system/PremiumCard'
import { PremiumBadge } from '../design-system/PremiumBadge'
import { MetricCard } from '../design-system/MetricCard'
import { EmptyState } from '../design-system/EmptyState'
import { StatusDot } from '../design-system/StatusDot'
import { documentosService } from '../../services/documentosService'
import { cn, statusDocumentoColor, statusLabel, formatDate } from '../../utils/cn'
import type { DocumentoPrestador, StatusDocumento } from '../../types/recrutamento'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface CentralDocumentosProps {
  documentos: DocumentoPrestador[]
  prestadorNome?: string
  onStatusChange?: (docId: string, status: StatusDocumento, obs?: string) => void
}

export function CentralDocumentos({ documentos, prestadorNome, onStatusChange }: CentralDocumentosProps) {
  const [busca, setBusca] = useState('')
  const metricas = documentosService.obterMetricas(documentos)

  const filtered = documentos.filter(d =>
    d.tipo.toLowerCase().includes(busca.toLowerCase()) ||
    d.nomeArquivo.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard title="Total" value={String(metricas.total)} icon={<FileText className="w-4 h-4" />} />
        <MetricCard title="Pendentes" value={String(metricas.pendentes)} icon={<Clock className="w-4 h-4" />} />
        <MetricCard title="Validando" value={String(metricas.validando)} icon={<AlertTriangle className="w-4 h-4" />} />
        <MetricCard title="Aprovados" value={String(metricas.aprovados)} icon={<CheckCircle className="w-4 h-4" />} />
        <MetricCard title="Taxa" value={`${metricas.taxaAprovacao}%`} icon={<Eye className="w-4 h-4" />} />
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <Input placeholder="Buscar documentos..." className="pl-9 h-9 bg-card" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        {prestadorNome && (
          <PremiumBadge variant="info" dot size="md">{prestadorNome}</PremiumBadge>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Nenhum documento" description="Os documentos enviados pelos prestadores aparecerão aqui." />
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => (
            <DocumentoRow key={doc.id} documento={doc} onStatusChange={onStatusChange} />
          ))}
        </div>
      )}
    </div>
  )
}

function DocumentoRow({ documento: doc, onStatusChange }: {
  documento: DocumentoPrestador
  onStatusChange?: (docId: string, status: StatusDocumento, obs?: string) => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 p-3 rounded-lg bg-card border border-border/50 hover:border-primary/30 transition-all group"
    >
      <div className="w-9 h-9 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{statusLabel[doc.tipo] || doc.tipo}</span>
          <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium', statusDocumentoColor[doc.status])}>
            <StatusDot status={doc.status} />
            {statusLabel[doc.status]}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground/50 mt-0.5">
          <span>{doc.nomeArquivo || 'Sem arquivo'}</span>
          {doc.dataEnvio && <span>Enviado: {formatDate(doc.dataEnvio)}</span>}
          {doc.dataValidade && <span>Validade: {formatDate(doc.dataValidade)}</span>}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {doc.status === 'pendente' && (
          <>
            <button
              onClick={() => onStatusChange?.(doc.id, 'aprovado', 'Aprovado via análise')}
              className="w-7 h-7 rounded-md hover:bg-emerald-500/10 flex items-center justify-center text-emerald-400"
            >
              <CheckCircle className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onStatusChange?.(doc.id, 'reprovado', 'Documento inválido')}
              className="w-7 h-7 rounded-md hover:bg-rose-500/10 flex items-center justify-center text-rose-400"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </motion.div>
  )
}