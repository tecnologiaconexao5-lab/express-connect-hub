import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { MapPin, Truck, Route, Calendar, DollarSign, Target, Users, Copy, MessageSquare, XCircle, Building2, Thermometer, Hash, Clock, Percent, Megaphone } from 'lucide-react'
import { GeradorAnuncioWhatsApp } from './GeradorAnuncioWhatsApp'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { PremiumBadge } from './design-system/PremiumBadge'
import { StatusDot } from './design-system/StatusDot'
import { useRecrutamentoStore } from '../store/recrutamentoStore'
import { useOperacoes } from '../hooks/useOperacoes'
import { formatCurrency, formatDate, statusOperacaoColor, statusLabel, prioridadeColor, cn, formatPercent } from '../utils/cn'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface DetalhesOperacaoSheetProps {
  operacaoId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DetalhesOperacaoSheet({ operacaoId, open, onOpenChange }: DetalhesOperacaoSheetProps) {
  const { operacoes } = useRecrutamentoStore()
  const { atualizarStatus } = useOperacoes()
  const [showGerador, setShowGerador] = useState(false)

  const op = useMemo(() => operacoes.find(o => o.id === operacaoId), [operacoes, operacaoId])

  if (!op) return null

  const handleCopiarAnuncio = () => {
    const texto = [
      `🚛 *VAGA PARA PRESTADOR* 🚛`,
      ``,
      `*${op.nome}*`,
      `📍 ${op.rotaOrigem} → ${op.rotaDestino}`,
      `🏢 Cliente: ${op.cliente}`,
      `🛻 Veículo: ${op.tipoVeiculo}`,
      `🌎 Região: ${op.regiao}`,
      `💰 Valor: ${formatCurrency(op.financeiro.valorPrestador)}`,
      `📅 ${op.dataInicio}${op.dataFim ? ` a ${op.dataFim}` : ''}`,
      op.observacoes ? `\n📝 ${op.observacoes}` : '',
      ``,
      `_Vaga divulgada pelo Express Connect Hub_`,
    ].join('\n')

    navigator.clipboard.writeText(texto)
    toast.success('Anúncio copiado para área de transferência!')
  }

  const handleWhatsApp = () => {
    const texto = encodeURIComponent([
      `🚛 *VAGA PARA PRESTADOR* 🚛`,
      ``,
      `*${op.nome}*`,
      `📍 ${op.rotaOrigem} → ${op.rotaDestino}`,
      `🏢 Cliente: ${op.cliente}`,
      `🛻 Veículo: ${op.tipoVeiculo}`,
      `🌎 Região: ${op.regiao}`,
      `💰 Valor: ${formatCurrency(op.financeiro.valorPrestador)}`,
      `📅 ${op.dataInicio}${op.dataFim ? ` a ${op.dataFim}` : ''}`,
      op.observacoes ? `\n📝 ${op.observacoes}` : '',
      ``,
      `_Vaga divulgada pelo Express Connect Hub_`,
    ].join('\n'))
    window.open(`https://wa.me/?text=${texto}`, '_blank')
  }

  const handleEncerrar = async () => {
    if (window.confirm('Tem certeza que deseja encerrar esta operação?')) {
      await atualizarStatus(op.id, 'encerrada')
      toast.success('Operação encerrada!')
      onOpenChange(false)
    }
  }

  const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0">
      <span className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center text-muted-foreground shrink-0">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  )

  const SectionDivider = ({ title }: { title: string }) => (
    <div className="flex items-center gap-2 py-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">{title}</span>
      <div className="flex-1 h-px bg-border/30" />
    </div>
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <SheetTitle className="text-lg">{op.nome}</SheetTitle>
          </div>
          <SheetDescription className="flex items-center gap-2">
            <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border', statusOperacaoColor[op.status])}>
              <StatusDot status={op.status} pulse={op.status === 'em_captacao'} />
              {statusLabel[op.status]}
            </span>
            <PremiumBadge variant={op.prioridade === 'urgente' ? 'danger' : op.prioridade === 'alta' ? 'warning' : 'info'} size="sm">
              {statusLabel[op.prioridade]}
            </PremiumBadge>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          <div>
            <SectionDivider title="Identificação" />
            <InfoRow icon={<Building2 className="w-4 h-4" />} label="Cliente" value={op.cliente} />
            <InfoRow icon={<Hash className="w-4 h-4" />} label="Frequência" value={statusLabel[op.frequencia] || op.frequencia} />
          </div>

          <div>
            <SectionDivider title="Logística" />
            <InfoRow icon={<Truck className="w-4 h-4" />} label="Tipo Veículo" value={op.tipoVeiculo} />
            <InfoRow icon={<Route className="w-4 h-4" />} label="Rota" value={`${op.rotaOrigem} → ${op.rotaDestino}`} />
            <InfoRow icon={<MapPin className="w-4 h-4" />} label="Região" value={op.regiao} />
            {op.temperatura && <InfoRow icon={<Thermometer className="w-4 h-4" />} label="Temperatura" value={op.temperatura} />}
            <InfoRow icon={<Calendar className="w-4 h-4" />} label="Período" value={`${formatDate(op.dataInicio)}${op.dataFim ? ` a ${formatDate(op.dataFim)}` : ''}`} />
            <InfoRow icon={<Clock className="w-4 h-4" />} label="Horários" value={`${op.horarioCarregamento || '---'} → ${op.horarioDescarregamento || '---'}`} />
            <InfoRow icon={<MapPin className="w-4 h-4" />} label="Local Carregamento" value={op.localCarregamento || '---'} />
            <InfoRow icon={<MapPin className="w-4 h-4" />} label="Local Descarregamento" value={op.localDescarregamento || '---'} />
          </div>

          <div>
            <SectionDivider title="Capacidade" />
            <InfoRow icon={<Target className="w-4 h-4" />} label="Vagas" value={`${op.meta.vagasPreenchidas}/${op.meta.vagasTotais} preenchidas`} />
            <InfoRow icon={<Users className="w-4 h-4" />} label="Captação" value={`${op.meta.captados} captados, ${op.meta.aprovados} aprovados`} />
          </div>

          <div>
            <SectionDivider title="Financeiro" />
            <InfoRow icon={<DollarSign className="w-4 h-4" />} label="Valor Cliente" value={formatCurrency(op.financeiro.valorCliente)} />
            <InfoRow icon={<DollarSign className="w-4 h-4" />} label="Valor Prestador" value={formatCurrency(op.financeiro.valorPrestador)} />
            {op.financeiro.percentualPrestador > 0 && (
              <InfoRow icon={<Percent className="w-4 h-4" />} label="% Prestador" value={formatPercent(op.financeiro.percentualPrestador)} />
            )}
            {op.financeiro.margemTransportadora > 0 && (
              <InfoRow icon={<Percent className="w-4 h-4" />} label="Margem Transportadora" value={formatPercent(op.financeiro.margemTransportadora)} />
            )}
            <InfoRow icon={<DollarSign className="w-4 h-4" />} label="Receita Líquida" value={formatCurrency(op.financeiro.receitaLiquida)} />
            <InfoRow icon={<DollarSign className="w-4 h-4" />} label="Lucro Total" value={formatCurrency(op.financeiro.lucroTotal)} />
            <InfoRow icon={<Percent className="w-4 h-4" />} label="Margem" value={formatPercent(op.financeiro.margem)} />
            <InfoRow icon={<DollarSign className="w-4 h-4" />} label="Franquia KM" value={String(op.financeiro.franquiaKm)} />
            <InfoRow icon={<DollarSign className="w-4 h-4" />} label="KM Excedente" value={formatCurrency(op.financeiro.valorKmExcedente)} />
            <InfoRow icon={<Calendar className="w-4 h-4" />} label="Forma Pagamento" value={op.financeiro.formaPagamento || '---'} />
            <InfoRow icon={<Calendar className="w-4 h-4" />} label="Prazo" value={`${op.financeiro.prazoPagamento} dias`} />
            {op.financeiro.dataPagamento && (
              <InfoRow icon={<Calendar className="w-4 h-4" />} label="Data Pagamento" value={formatDate(op.financeiro.dataPagamento)} />
            )}
          </div>

          {op.observacoes && (
            <div>
              <SectionDivider title="Observações" />
              <div className="p-3 rounded-lg bg-muted/20 text-sm text-muted-foreground leading-relaxed">
                {op.observacoes}
              </div>
            </div>
          )}

          <div className="pt-4 space-y-2">
            <SectionDivider title="Ações" />
            <Button size="sm" className="w-full gap-2 mb-2" onClick={() => setShowGerador(true)}>
              <Megaphone className="w-4 h-4" /> Gerar Anúncio para Prestador
            </Button>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopiarAnuncio}>
                <Copy className="w-3.5 h-3.5" /> Copiar Anúncio
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleWhatsApp}>
                <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-rose-400 hover:text-rose-300 border-rose-500/30 hover:border-rose-500/50" onClick={handleEncerrar}>
                <XCircle className="w-3.5 h-3.5" /> Encerrar
              </Button>
            </div>
          </div>
        </div>

        <GeradorAnuncioWhatsApp
          operacao={op}
          open={showGerador}
          onOpenChange={setShowGerador}
        />
      </SheetContent>
    </Sheet>
  )
}
