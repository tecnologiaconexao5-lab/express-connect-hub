import { useState, useEffect } from 'react'
import { confirmAction } from '@/lib/confirmDialog'
import { motion } from 'framer-motion'
import { Zap, PlayCircle, PauseCircle, Trash2, Webhook, MessageSquare, Mail, Bell, Settings, Sparkles, Check, Save } from 'lucide-react'
import { PremiumCard, PremiumCardHeader, PremiumCardTitle, PremiumCardContent, PremiumCardFooter } from '../design-system/PremiumCard'
import { PremiumBadge } from '../design-system/PremiumBadge'
import { EmptyState } from '../design-system/EmptyState'
import { StatusDot } from '../design-system/StatusDot'
import { automacoesService } from '../../services/automacoesService'
import { cn, statusLabel } from '../../utils/cn'
import type { AutomacaoRegra, StatusAutomacao } from '../../types/recrutamento'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { toast } from 'sonner'

interface AutomacoesListProps {
  automacoes: AutomacaoRegra[]
  onRefresh: () => void
}

const tipoIcons: Record<string, React.ReactNode> = {
  whatsapp: <MessageSquare className="w-4 h-4 text-emerald-400" />,
  email: <Mail className="w-4 h-4 text-sky-400" />,
  notificacao: <Bell className="w-4 h-4 text-amber-400" />,
  webhook: <Webhook className="w-4 h-4 text-violet-400" />,
  score: <Zap className="w-4 h-4 text-primary" />,
}

const SEED_AUTOMACOES: Partial<AutomacaoRegra>[] = [
  {
    nome: 'Disparo de novas vagas',
    tipo: 'whatsapp',
    status: 'ativa',
    trigger: { evento: 'nova_vaga_publicada' },
    acao: { canal: 'whatsapp', template: 'aviso_nova_vaga' },
  },
  {
    nome: 'Coleta de documentos',
    tipo: 'notificacao',
    status: 'ativa',
    trigger: { evento: 'mudanca_etapa_documentacao' },
    acao: { canal: 'whatsapp', template: 'solicitacao_documentos' },
  },
  {
    nome: 'Reativação de inativos',
    tipo: 'email',
    status: 'ativa',
    trigger: { inatividade_dias: 30 },
    acao: { canal: 'whatsapp', template: 'reativacao_inativo' },
  },
  {
    nome: 'Alerta de CNH vencendo',
    tipo: 'webhook',
    status: 'ativa',
    trigger: { validade_cnh_dias: 15 },
    acao: { canal: 'sistema', notificacao: 'cnh_vencendo' },
  },
]

export function AutomacoesList({ automacoes, onRefresh }: AutomacoesListProps) {
  const [configOpen, setConfigOpen] = useState(false)
  const [selectedAuto, setSelectedAuto] = useState<AutomacaoRegra | null>(null)
  
  // Settings Form
  const [autoNome, setAutoNome] = useState('')
  const [autoStatus, setAutoStatus] = useState<StatusAutomacao>('ativa')
  const [salvando, setSalvando] = useState(false)

  // Seed automations if none exist
  useEffect(() => {
    if (automacoes.length === 0) {
      const seed = async () => {
        for (const item of SEED_AUTOMACOES) {
          await automacoesService.criar(item)
        }
        onRefresh()
      }
      seed()
    }
  }, [automacoes, onRefresh])

  const handleStatusToggle = async (id: string, currentStatus: StatusAutomacao) => {
    const nextStatus = currentStatus === 'ativa' ? 'pausada' : 'ativa'
    await automacoesService.atualizarStatus(id, nextStatus)
    toast.success(`Automação ${nextStatus === 'ativa' ? 'ativada' : 'pausada'} com sucesso!`)
    onRefresh()
  }

  const handleOpenConfig = (auto: AutomacaoRegra) => {
    setSelectedAuto(auto)
    setAutoNome(auto.nome)
    setAutoStatus(auto.status)
    setConfigOpen(true)
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAuto) return

    setSalvando(true)
    try {
      await automacoesService.atualizar(selectedAuto.id, {
        nome: autoNome,
        status: autoStatus,
      })
      toast.success('Configuração da automação salva com sucesso!')
      setConfigOpen(false)
      onRefresh()
    } catch {
      toast.error('Erro ao salvar configurações')
    } finally {
      setSalvando(false)
    }
  }

  const handleRemover = async (id: string) => {
    const confirmado = await confirmAction({
      title: 'Remover automação',
      description: 'Deseja realmente remover esta regra de automação?',
      confirmText: 'Remover',
      cancelText: 'Cancelar',
      variant: 'destructive',
    })
    if (confirmado) {
      await automacoesService.remover(id)
      toast.success('Automação removida!')
      onRefresh()
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {automacoes.map((auto) => {
          const isActived = auto.status === 'ativa'

          return (
            <motion.div
              key={auto.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <PremiumCard hover={true} className="border-border/60 bg-card/60 backdrop-blur-sm h-full flex flex-col justify-between">
                <PremiumCardHeader className="flex items-start justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all',
                      isActived 
                        ? 'bg-primary/10 text-primary border-primary/25 shadow-sm shadow-primary/5' 
                        : 'bg-muted/30 text-muted-foreground/40 border-border/20'
                    )}>
                      {tipoIcons[auto.tipo] || <Zap className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        {auto.nome}
                        <StatusDot status={isActived ? 'ativo' : 'pausada'} pulse={isActived} />
                      </h4>
                      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mt-0.5">{auto.tipo}</p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    onClick={() => handleStatusToggle(auto.id, auto.status)}
                    className={cn(
                      "w-9 h-5 rounded-full transition-colors relative shrink-0 focus:outline-none border border-border/50",
                      isActived ? "bg-emerald-500" : "bg-muted/80"
                    )}
                  >
                    <span 
                      className={cn(
                        "w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform shadow-sm",
                        isActived ? "right-0.5" : "left-0.5"
                      )} 
                    />
                  </button>
                </PremiumCardHeader>

                <PremiumCardContent className="py-2.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground/60">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                        <Sparkles className="w-2.5 h-2.5 animate-pulse" />
                        Pronto para integrar
                      </span>
                    </div>
                    {auto.totalExecucoes > 0 && (
                      <span className="font-semibold text-foreground/80">{auto.totalExecucoes} disparos</span>
                    )}
                  </div>
                </PremiumCardContent>

                <PremiumCardFooter className="pt-2 border-t border-border/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      size="xs"
                      variant="outline"
                      className="text-[10px] h-7 gap-1"
                      onClick={() => handleOpenConfig(auto)}
                    >
                      <Settings className="w-3 h-3 text-primary" />
                      <span>Configurar</span>
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      className="text-[10px] h-7 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                      onClick={() => handleRemover(auto.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  {auto.ultimaExecucao && (
                    <span className="text-[10px] text-muted-foreground/45">Atividade: {new Date(auto.ultimaExecucao).toLocaleDateString()}</span>
                  )}
                </PremiumCardFooter>
              </PremiumCard>
            </motion.div>
          )
        })}
      </div>

      {/* Configuration Drawer/Sheet */}
      <Sheet open={configOpen} onOpenChange={setConfigOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-lg flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Configurar Regra de Automação
            </SheetTitle>
            <SheetDescription>
              Ajuste as condições de disparo, canais de mensageria e templates para esta automação.
            </SheetDescription>
          </SheetHeader>

          {selectedAuto && (
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Nome da Automação</label>
                <input
                  type="text"
                  required
                  value={autoNome}
                  onChange={(e) => setAutoNome(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Canal de Disparo</label>
                <input
                  type="text"
                  disabled
                  value={selectedAuto.tipo.toUpperCase()}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/30 text-muted-foreground focus:outline-none cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Status do Gatilho</label>
                <select
                  value={autoStatus}
                  onChange={(e) => setAutoStatus(e.target.value as StatusAutomacao)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                >
                  <option value="ativa">Ativo (Pronto para Execução)</option>
                  <option value="pausada">Pausado (Inativo)</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Configuração de Parâmetros (Mock)</span>
                <p className="text-xs text-muted-foreground/80 leading-relaxed">
                  Esta automação está conectada à API do Conexão Express e utiliza inteligência n8n para validação de dados de forma assíncrona.
                </p>
              </div>

              <div className="pt-4 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setConfigOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={salvando}
                >
                  {salvando ? 'Salvando...' : <><Save className="w-4 h-4 mr-1.5" /> Salvar Configurações</>}
                </Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}