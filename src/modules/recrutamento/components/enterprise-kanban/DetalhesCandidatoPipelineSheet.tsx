import { useState, useMemo } from 'react'
import {
  MapPin, Truck, Phone, Mail, Shield,
  FileText, MessageSquare,
  UserCheck, Ban, Send, Star, Calendar, Save, Award, XCircle,
  UserCircle, Clock, Users,
} from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useEnterpriseKanbanStore } from './enterpriseKanbanStore'
import { enterpriseKanbanService } from './enterpriseKanbanService'
import { PIPELINE_COLUMNS, STAGE_TRANSITIONS } from './enterpriseKanbanTypes'
import type { PipelineStage } from './enterpriseKanbanTypes'
import { cn } from '../../utils/cn'
import { useRecrutamentoStore } from '../../store/recrutamentoStore'
import { toast } from 'sonner'

interface DetalhesCandidatoPipelineSheetProps {
  candidateId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const STAGE_LABELS: Record<string, string> = {
  novo_cadastro: 'Novo Cadastro',
  em_analise: 'Em Análise',
  documentacao_pendente: 'Doc. Pendente',
  em_validacao: 'Em Validação',
  entrevista: 'Entrevista',
  em_treinamento: 'Em Treinamento',
  aprovado: 'Aprovado',
  ativo: 'Ativo',
  bloqueado: 'Bloqueado',
  reprovado: 'Reprovado',
}

const STAGE_COLORS: Record<string, string> = {
  novo_cadastro: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  em_analise: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
  documentacao_pendente: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  em_validacao: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  entrevista: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  em_treinamento: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  aprovado: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  ativo: 'text-green-400 bg-green-500/10 border-green-500/30',
  bloqueado: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  reprovado: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
}

export function DetalhesCandidatoPipelineSheet({ candidateId, open, onOpenChange }: DetalhesCandidatoPipelineSheetProps) {
  const store = useEnterpriseKanbanStore()
  const recrutamentoStore = useRecrutamentoStore()
  const [novoContato, setNovoContato] = useState('')
  const [salvandoContato, setSalvandoContato] = useState(false)
  const [stageAlvo, setStageAlvo] = useState<PipelineStage | ''>('')

  const candidate = useMemo(
    () => store.candidates.find(c => c.id === candidateId) ?? null,
    [store.candidates, candidateId],
  )

  const possibleStages = candidate ? STAGE_TRANSITIONS[candidate.stage] ?? [] : []

  const handleAbrirCadastroCompleto = () => {
    if (!candidate) return
    const prestadorExistente = recrutamentoStore.prestadores.find(p => p.id === candidate.id || p.nome === candidate.nome)
    
    if (!prestadorExistente) {
      const novoPrestador = {
        id: candidate.id,
        nome: candidate.nome,
        razaoSocial: candidate.nome,
        cpfCnpj: 'Não informado',
        rg: '',
        dataNascimento: '',
        contatos: [
          { tipo: 'telefone' as const, valor: candidate.telefone, principal: true },
          { tipo: 'email' as const, valor: candidate.email, principal: false }
        ],
        endereco: {
          cep: '',
          logradouro: '',
          numero: '',
          complemento: '',
          bairro: '',
          cidade: candidate.cidade,
          uf: candidate.uf
        },
        tipoVeiculo: candidate.veiculo,
        placaVeiculo: candidate.placa || '',
        eixos: 2,
        capacidadeKg: 0,
        capacidadeM3: 0,
        tipoCargaVeiculo: 'seco' as const,
        disponibilidade: 'Imediata',
        regioesAtuacao: [candidate.cidade],
        origemCadastro: 'manual' as const,
        status: candidate.stage === 'aprovado' || candidate.stage === 'ativo' ? 'aprovado' as const : 'em_analise' as const,
        score: {
          geral: candidate.score,
          documentacao: 50,
          experiencia: 50,
          reputacao: 50,
          regularidade: 50,
          perfil: 50,
          tendencia: 0,
          ultimaAtualizacao: new Date().toISOString(),
          historico: []
        },
        documentos: [],
        onboarding: 'nao_iniciado' as const,
        canalCaptacao: 'manual' as const,
        indicadoPor: '',
        historico: {
          jaCarregouConosco: false,
          quantidadeOperacoes: 0,
          ultimaOperacao: '',
          clientesAtendidos: [],
          mediaPontualidade: 100,
          mediaOcorrencias: 0,
          avaliacaoOperacional: 5,
          melhorPerfilOperacao: ''
        },
        dataCadastro: candidate.dataEntrada || new Date().toISOString(),
        dataAtivacao: '',
        ultimaAtividade: candidate.dataAtualizacao || new Date().toISOString(),
        observacoes: candidate.observacoesIA || '',
        tags: candidate.tags || [],
        createdAt: candidate.dataEntrada || new Date().toISOString(),
        updatedAt: candidate.dataAtualizacao || new Date().toISOString()
      }
      recrutamentoStore.setPrestadores([novoPrestador, ...recrutamentoStore.prestadores])
      recrutamentoStore.setSelectedPrestadorId(novoPrestador.id)
    } else {
      recrutamentoStore.setSelectedPrestadorId(prestadorExistente.id)
    }
    recrutamentoStore.setCurrentSection('prestadores')
    onOpenChange(false)
  }

  const handleMover = async (stage: PipelineStage) => {
    if (!candidate) return
    store.moveCandidate(candidate.id, stage)
    await enterpriseKanbanService.mover(candidate.id, stage)
    toast.success(`Candidato movido para "${STAGE_LABELS[stage] ?? stage}"`)
    onOpenChange(false)
  }

  const handleWhatsApp = () => {
    if (!candidate) return
    window.open(`https://wa.me/55${candidate.telefone.replace(/\D/g, '')}`, '_blank')
  }

  const handleRegistrarContato = async () => {
    if (!candidate || !novoContato.trim()) return
    setSalvandoContato(true)
    try {
      const obsAtual = candidate.observacoesIA || ''
      const novaObs = `[${new Date().toLocaleString('pt-BR')}] Contato: ${novoContato.trim()}\n${obsAtual}`
      store.updateCandidate(candidate.id, { observacoesIA: novaObs })
      await enterpriseKanbanService.adicionarObservacao(candidate.id, novaObs)
      toast.success('Contato registrado!')
      setNovoContato('')
    } catch {
      toast.error('Erro ao registrar contato')
    } finally {
      setSalvandoContato(false)
    }
  }

  if (!candidate) return null

  const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
    <div className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
      <span className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center text-muted-foreground shrink-0">{icon}</span>
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
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden ring-2 ring-border/40 bg-muted shadow-sm shrink-0">
              <img src={candidate.foto} alt={candidate.nome} className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg truncate">{candidate.nome}</SheetTitle>
              <SheetDescription className="flex items-center gap-2 mt-1">
                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border', STAGE_COLORS[candidate.stage])}>
                  {STAGE_LABELS[candidate.stage] ?? candidate.stage}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border text-amber-400 bg-amber-500/10 border-amber-500/30">
                  <Star className="w-3 h-3 fill-current" />
                  {candidate.score}
                </span>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mb-4">
          <Button 
            className="w-full text-xs h-9 gap-1.5" 
            variant="outline"
            onClick={handleAbrirCadastroCompleto}
          >
            <UserCircle className="w-4 h-4 text-primary" />
            Abrir cadastro completo
          </Button>
        </div>

        <Tabs defaultValue="perfil" className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-9 mb-4">
            <TabsTrigger value="perfil" className="text-[10px] gap-1"><MapPin className="w-3 h-3" /> Perfil</TabsTrigger>
            <TabsTrigger value="documentos" className="text-[10px] gap-1"><FileText className="w-3 h-3" /> Documentos</TabsTrigger>
            <TabsTrigger value="acoes" className="text-[10px] gap-1"><Send className="w-3 h-3" /> Ações</TabsTrigger>
          </TabsList>

          <TabsContent value="perfil" className="space-y-4 mt-0">
            <div>
              <SectionDivider title="Identificação" />
              <InfoRow icon={<MapPin className="w-4 h-4" />} label="Cidade / UF" value={`${candidate.cidade}, ${candidate.uf}`} />
              <InfoRow icon={<Truck className="w-4 h-4" />} label="Veículo" value={`${candidate.veiculo} - ${candidate.placa}`} />
              <InfoRow icon={<Calendar className="w-4 h-4" />} label="Data Entrada" value={new Date(candidate.dataEntrada).toLocaleDateString('pt-BR')} />
              <InfoRow icon={<Calendar className="w-4 h-4" />} label="Última Atualização" value={new Date(candidate.dataAtualizacao).toLocaleDateString('pt-BR')} />
            </div>
            <div>
              <SectionDivider title="Contato" />
              <InfoRow icon={<Phone className="w-4 h-4" />} label="Telefone" value={candidate.telefone} />
              <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={candidate.email} />
            </div>
            <div>
              <SectionDivider title="Informações de Recrutamento" />
              <InfoRow icon={<Calendar className="w-4 h-4" />} label="Data do primeiro contato" value={candidate.dataEntrada ? new Date(candidate.dataEntrada).toLocaleDateString('pt-BR') : '15/05/2026'} />
              <InfoRow icon={<Users className="w-4 h-4" />} label="Origem do lead" value={candidate.tags.includes('indicado') ? 'Indicação' : 'Fretebras'} />
              <InfoRow icon={<Calendar className="w-4 h-4" />} label="Último contato" value={candidate.dataAtualizacao ? new Date(candidate.dataAtualizacao).toLocaleDateString('pt-BR') : '18/05/2026'} />
              <InfoRow icon={<Clock className="w-4 h-4" />} label="Status do contato" value="Ativo / Em análise" />
              <InfoRow icon={<MessageSquare className="w-4 h-4" />} label="Observação comercial/recrutamento" value={candidate.observacoesIA || 'Sem observações comerciais registradas.'} />
            </div>
            {candidate.tags.length > 0 && (
              <div>
                <SectionDivider title="Tags" />
                <div className="flex flex-wrap gap-1.5">
                  {candidate.tags.map(tag => (
                    <span key={tag} className="px-2 py-1 rounded-md bg-muted/30 text-[10px] font-medium text-muted-foreground">{tag}</span>
                  ))}
                </div>
              </div>
            )}
            <div>
              <SectionDivider title="Classificação" />
              <InfoRow icon={<Award className="w-4 h-4" />} label="Score" value={String(candidate.score)} />
              <InfoRow icon={<MessageSquare className="w-4 h-4" />} label="Prioridade" value={candidate.prioridade} />
            </div>
            {candidate.observacoesIA && (
              <div>
                <SectionDivider title="Observações IA" />
                <div className="p-3 rounded-lg bg-muted/20 text-sm text-muted-foreground leading-relaxed">
                  {candidate.observacoesIA}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="documentos" className="space-y-4 mt-0">
            <SectionDivider title="Status Documental" />
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="p-3 rounded-lg bg-muted/20 border border-border/30 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Status Geral</p>
                <p className={cn('text-sm font-bold mt-1', {
                  'text-emerald-400': candidate.statusDocumental === 'completo',
                  'text-amber-400': candidate.statusDocumental === 'parcial',
                  'text-blue-400': candidate.statusDocumental === 'pendente',
                  'text-rose-400': candidate.statusDocumental === 'vencido',
                })}>
                  {candidate.statusDocumental === 'completo' ? 'Completo' :
                   candidate.statusDocumental === 'parcial' ? 'Parcial' :
                   candidate.statusDocumental === 'pendente' ? 'Pendente' : 'Vencido'}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/20 border border-border/30 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">CNH</p>
                <p className={cn('text-sm font-bold mt-1', {
                  'text-emerald-400': candidate.validadeCNH === 'valida',
                  'text-amber-400': candidate.validadeCNH === 'vencendo',
                  'text-rose-400': candidate.validadeCNH === 'vencida',
                })}>
                  {candidate.validadeCNH === 'valida' ? 'OK' :
                   candidate.validadeCNH === 'vencendo' ? 'Vencendo' : 'Vencida'}
                </p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">{candidate.dataValidadeCNH}</p>
              </div>
            </div>
            <SectionDivider title="Documentos" />
            {candidate.documentos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                Nenhum documento cadastrado
              </div>
            ) : (
              candidate.documentos.map(doc => (
                <div key={doc.nome} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/30">
                  <div className={cn(
                    'w-2 h-2 rounded-full shrink-0',
                    doc.status === 'ok' ? 'bg-emerald-400' : doc.status === 'pendente' ? 'bg-amber-400' : 'bg-rose-400',
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{doc.nome}</p>
                  </div>
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', {
                    'text-emerald-400 bg-emerald-500/10': doc.status === 'ok',
                    'text-amber-400 bg-amber-500/10': doc.status === 'pendente',
                    'text-rose-400 bg-rose-500/10': doc.status === 'vencido',
                  })}>
                    {doc.status === 'ok' ? 'OK' : doc.status === 'pendente' ? 'Pendente' : 'Vencido'}
                  </span>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="acoes" className="space-y-5 mt-0">
            <div>
              <SectionDivider title="Mover Etapa" />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {possibleStages.length === 0 ? (
                  <p className="text-xs text-muted-foreground/50">Nenhuma transição disponível.</p>
                ) : (
                  possibleStages.map(stage => (
                    <button
                      key={stage}
                      onClick={() => handleMover(stage)}
                      className={cn(
                        'text-[11px] px-3 py-1.5 rounded-full border font-medium transition-all',
                        stage === 'aprovado' ? 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/15 hover:border-emerald-500/60' :
                        stage === 'reprovado' ? 'border-gray-500/40 text-gray-400 hover:bg-gray-500/15 hover:border-gray-500/60' :
                        stage === 'bloqueado' ? 'border-rose-500/40 text-rose-400 hover:bg-rose-500/15 hover:border-rose-500/60' :
                        'border-border/40 text-muted-foreground/70 hover:text-foreground hover:border-primary/30 hover:bg-primary/5',
                      )}
                    >
                      {STAGE_LABELS[stage] ?? stage}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div>
              <SectionDivider title="Ações Rápidas" />
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500/50"
                  onClick={() => possibleStages.includes('aprovado') && handleMover('aprovado')}
                  disabled={!possibleStages.includes('aprovado')}
                >
                  <UserCheck className="w-3.5 h-3.5" /> Aprovar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-rose-400 border-rose-500/30 hover:bg-rose-500/10 hover:border-rose-500/50"
                  onClick={() => possibleStages.includes('reprovado') && handleMover('reprovado')}
                  disabled={!possibleStages.includes('reprovado')}
                >
                  <XCircle className="w-3.5 h-3.5" /> Reprovar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-amber-400 border-amber-500/30 hover:bg-amber-500/10 hover:border-amber-500/50"
                  onClick={() => possibleStages.includes('bloqueado') && handleMover('bloqueado')}
                  disabled={!possibleStages.includes('bloqueado')}
                >
                  <Ban className="w-3.5 h-3.5" /> Reserva
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-blue-400 border-blue-500/30 hover:bg-blue-500/10 hover:border-blue-500/50"
                  onClick={handleWhatsApp}
                >
                  <Send className="w-3.5 h-3.5" /> WhatsApp
                </Button>
              </div>
            </div>

            <div>
              <SectionDivider title="Registrar Contato" />
              <div className="space-y-2 mt-2">
                <Textarea
                  value={novoContato}
                  onChange={e => setNovoContato(e.target.value)}
                  placeholder="Descreva o contato realizado..."
                  className="text-xs min-h-[60px] resize-none"
                />
                <Button
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={handleRegistrarContato}
                  disabled={!novoContato.trim() || salvandoContato}
                >
                  <Save className="w-3.5 h-3.5" />
                  {salvandoContato ? 'Salvando...' : 'Registrar Contato'}
                </Button>
              </div>
            </div>

            <div>
              <SectionDivider title="Alterar Etapa Manual" />
              <div className="flex items-center gap-2 mt-2">
                <select
                  value={stageAlvo}
                  onChange={e => setStageAlvo(e.target.value as PipelineStage)}
                  className="flex-1 h-8 rounded-md border border-border/50 bg-background px-2 text-xs text-foreground"
                >
                  <option value="">Selecione...</option>
                  {PIPELINE_COLUMNS.map(col => (
                    <option key={col.id} value={col.id}>{col.title}</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { if (stageAlvo) handleMover(stageAlvo); setStageAlvo('') }}
                  disabled={!stageAlvo}
                >
                  Mover
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
