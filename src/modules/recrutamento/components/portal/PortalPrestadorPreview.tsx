import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Smartphone, UserCheck, UploadCloud, CheckSquare, DollarSign,
  MessageSquare, AlertCircle, Play, ShieldAlert, Sparkles, ExternalLink
} from 'lucide-react'
import { PremiumCard, PremiumCardHeader, PremiumCardTitle, PremiumCardContent, PremiumCardFooter } from '../design-system/PremiumCard'
import { PremiumBadge } from '../design-system/PremiumBadge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

interface PortalStage {
  id: string
  title: string
  description: string
  status: 'ativo' | 'em_breve'
  icon: React.ReactNode
}

export function PortalPrestadorPreview() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedStage, setSelectedStage] = useState<string | null>(null)

  const stages: PortalStage[] = [
    {
      id: 'autocadastro',
      title: 'Autocadastro',
      description: 'Preenchimento rápido de dados pessoais, contatos de emergência e veículo.',
      status: 'ativo',
      icon: <UserCheck className="w-5 h-5 text-emerald-400" />
    },
    {
      id: 'documentacao',
      title: 'Envio de Documentos',
      description: 'Upload simplificado e direto de CNH, CRLV, ANTT e comprovantes pelo celular.',
      status: 'ativo',
      icon: <UploadCloud className="w-5 h-5 text-emerald-400" />
    },
    {
      id: 'aceite',
      title: 'Aceite de Operações',
      description: 'Visualização e confirmação rápida de fretes compatíveis sugeridos pela IA.',
      status: 'em_breve',
      icon: <CheckSquare className="w-5 h-5 text-amber-400" />
    },
    {
      id: 'financeiro',
      title: 'Histórico de Pagamentos',
      description: 'Extrato de faturamentos, adiantamentos, pedágio e saldos de frete.',
      status: 'em_breve',
      icon: <DollarSign className="w-5 h-5 text-amber-400" />
    },
    {
      id: 'comunicacao',
      title: 'Comunicação com Recrutamento',
      description: 'Chat interativo com atendimento híbrido (IA operacional + atendente humano).',
      status: 'ativo',
      icon: <MessageSquare className="w-5 h-5 text-emerald-400" />
    }
  ]

  const handleAction = (stageId: string) => {
    setSelectedStage(stageId)
    setDialogOpen(true)
  }

  const handleSimulation = () => {
    toast.success('Simulação de notificação do portal disparada!')
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Simulator */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-primary animate-bounce" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              App do Motorista & Portal Web
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-primary/15 text-primary">Simulação</span>
            </h4>
            <p className="text-xs text-muted-foreground/80 mt-0.5">Interface responsiva otimizada para dispositivos móveis dos motoristas parceiros.</p>
          </div>
        </div>
        <Button 
          size="sm" 
          className="text-xs font-semibold gap-1.5 shrink-0"
          onClick={() => handleAction('portal_geral')}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Acessar Portal Demo</span>
        </Button>
      </div>

      {/* Responsive Grid of stages */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stages.map((stage) => {
          const isAtivo = stage.status === 'ativo'

          return (
            <motion.div
              key={stage.id}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
            >
              <PremiumCard className="border-border/60 bg-card/60 backdrop-blur-sm h-full flex flex-col justify-between">
                <PremiumCardHeader className="flex items-start justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
                      {stage.icon}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">{stage.title}</h4>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">Módulo Portal</p>
                    </div>
                  </div>
                  <PremiumBadge variant={isAtivo ? 'success' : 'info'} size="sm">
                    {isAtivo ? 'Ativo' : 'Em breve'}
                  </PremiumBadge>
                </PremiumCardHeader>

                <PremiumCardContent className="py-2.5">
                  <p className="text-xs text-muted-foreground/80 leading-relaxed">
                    {stage.description}
                  </p>
                </PremiumCardContent>

                <PremiumCardFooter className="pt-2 border-t border-border/40">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full text-[11px] h-8 justify-between hover:bg-primary/5 text-primary"
                    onClick={() => handleAction(stage.id)}
                  >
                    <span>{isAtivo ? 'Visualizar fluxo' : 'Avisar-me ao lançar'}</span>
                    <Play className="w-3 h-3 fill-current" />
                  </Button>
                </PremiumCardFooter>
              </PremiumCard>
            </motion.div>
          )
        })}
      </div>

      {/* Validation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2 text-amber-500">
              <ShieldAlert className="w-5 h-5" />
              Validação Técnica do Sistema
            </DialogTitle>
            <DialogDescription className="text-xs mt-2">
              Você tentou interagir com o fluxo do módulo <strong className="text-foreground">"{selectedStage}"</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/25 text-xs text-muted-foreground leading-relaxed space-y-2">
            <p className="font-semibold text-foreground">Status do Ambiente:</p>
            <p>
              Esta funcionalidade faz parte do **Portal do Prestador**, que está em fase de homologação técnica pelo time de arquitetura.
            </p>
            <p>
              O ambiente de produção com persistência real em banco de dados Supabase e triggers n8n integrados com o WhatsApp oficial da transportadora está temporariamente restrito e será disponibilizado na próxima janela de release.
            </p>
          </div>

          <DialogFooter className="flex sm:justify-between items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs w-full sm:w-auto"
              onClick={() => setDialogOpen(false)}
            >
              Entendido
            </Button>
            <Button
              size="sm"
              className="text-xs w-full sm:w-auto gap-1"
              onClick={() => {
                setDialogOpen(false)
                handleSimulation()
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Simular Ação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
