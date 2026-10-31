import { useState, useMemo, useCallback } from 'react'
import { promptAction } from '@/lib/confirmDialog'
import {
  MapPin, Truck, Phone, Mail, Shield,
  FileText, MessageSquare,
  UserCheck, Ban, Send, Star, Calendar, Save, Award, XCircle,
  UserCircle, Clock, Users, Link2, History, ClipboardCheck, CheckCircle2, Circle,
  TrendingUp, AlertTriangle, Zap, ClipboardList, Heart, ThumbsUp, Target,
} from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { SafeImage } from '@/components/ui/safe-image'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Textarea } from '@/components/ui/textarea'
import { useEnterpriseKanbanStore } from './enterpriseKanbanStore'
import { enterpriseKanbanService } from './enterpriseKanbanService'
import { conversaoCandidatoService } from '../../services/conversaoCandidatoService'
import { prestadoresService } from '../../services/prestadoresService'
import { recrutamentoScoreService } from '@/services/recrutamento/recrutamentoScoreService'
import type { CandidatoScoreInput } from '@/services/recrutamento/recrutamentoScoreService'
import { PIPELINE_COLUMNS, STAGE_TRANSITIONS, DOCS_MINIMOS_OBRIGATORIOS, DOCS_MINIMOS_OPCIONAIS, ONBOARDING_ITENS } from './enterpriseKanbanTypes'
import type { PipelineStage, DocumentoCandidato } from './enterpriseKanbanTypes'
import { cn } from '../../utils/cn'
import { useRecrutamentoStore } from '../../store/recrutamentoStore'
import { toast } from 'sonner'

interface DetalhesCandidatoPipelineSheetProps {
  candidateId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const STAGE_LABELS: Record<string, string> = {
  novo_candidato: 'Novo Candidato',
  cadastro_iniciado: 'Cadastro Iniciado',
  cadastro_concluido: 'Cadastro Concluído',
  em_triagem: 'Em Triagem',
  em_analise_perfil: 'Análise de Perfil',
  aguardando_documentacao: 'Aguardando Documentação',
  em_verificacao_documental: 'Verificação Documental',
  em_avaliacao_situacional: 'Avaliação Situacional',
  em_entrevista: 'Entrevista',
  em_homologacao: 'Homologação',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  cadastro_incompleto: 'Cadastro Incompleto',
  banco_de_talentos: 'Banco de Talentos',
  homologado_disponivel: 'Homologado Disponível',
  homologado_indisponivel: 'Homologado Indisponível',
  processo_encerrado: 'Processo Encerrado',
}

const STAGE_COLORS: Record<string, string> = {
  novo_candidato: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  cadastro_iniciado: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
  cadastro_concluido: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
  em_triagem: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
  em_analise_perfil: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  aguardando_documentacao: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  em_verificacao_documental: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  em_avaliacao_situacional: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  em_entrevista: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
  em_homologacao: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
  aprovado: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  reprovado: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
  cadastro_incompleto: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  banco_de_talentos: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  homologado_disponivel: 'text-green-400 bg-green-500/10 border-green-500/30',
  homologado_indisponivel: 'text-lime-400 bg-lime-500/10 border-lime-500/30',
  processo_encerrado: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
}

export function DetalhesCandidatoPipelineSheet({ candidateId, open, onOpenChange }: DetalhesCandidatoPipelineSheetProps) {
  const store = useEnterpriseKanbanStore()
  const recrutamentoStore = useRecrutamentoStore()
  const [novoContato, setNovoContato] = useState('')
  const [salvandoContato, setSalvandoContato] = useState(false)
  const [convertendo, setConvertendo] = useState(false)
  const [stageAlvo, setStageAlvo] = useState<PipelineStage | ''>('')

  const candidate = useMemo(
    () => store.candidates.find(c => c.id === candidateId) ?? null,
    [store.candidates, candidateId],
  )

  // AG-07J.11.2 — Gate documental UX: estado derivado do statusDocumental
  const documentacaoApta = candidate?.statusDocumental === 'completo'

  const MOTIVO_BLOQUEIO_DOCUMENTAL: Record<string, string> = {
    parcial: 'Complete os documentos obrigatórios antes da conversão.',
    pendente: 'Documentação obrigatória pendente.',
    vencido: 'Existe documentação vencida. Regularize antes da conversão.',
    bloqueado: 'Documentação com bloqueio. Regularize antes da conversão.',
  }

  const feedbackDocumentacao = candidate && !documentacaoApta
    ? MOTIVO_BLOQUEIO_DOCUMENTAL[candidate.statusDocumental]
      ?? 'Documentação não validada. Conversão indisponível.'
    : null

  const possibleStages = candidate ? STAGE_TRANSITIONS[candidate.stage] ?? [] : []

  const handleConverterTop = async () => {
    if (!candidate) return
    await handleConverter()
  }

  const handleMover = async (stage: PipelineStage) => {
    if (!candidate) return
    // G21 — bloqueio exige motivo; persistido no historico (estrutura existente).
    let motivo: string | undefined
    if (stage === 'reprovado' || stage === 'processo_encerrado') {
      const input = (await promptAction({
        title: stage === 'reprovado' ? 'Reprovar candidato' : 'Encerrar processo',
        description: 'Informe o motivo (opcional, fica registrado no histórico).',
        inputLabel: 'Motivo',
        placeholder: 'Ex.: documentação irregular',
        confirmText: stage === 'reprovado' ? 'Reprovar' : 'Encerrar',
        cancelText: 'Cancelar',
      })) ?? ''
      motivo = input.trim()
    }
    const previousStage = candidate.stage
    store.moveCandidate(candidate.id, stage)
    try {
      const result = await enterpriseKanbanService.mover(candidate.id, stage, motivo)
      if (result.error) {
        store.moveCandidate(candidate.id, previousStage)
        toast.error(result.error)
        return
      }
      toast.success(`Candidato movido para "${STAGE_LABELS[stage] ?? stage}"`)
      onOpenChange(false)
    } catch {
      store.moveCandidate(candidate.id, previousStage)
      toast.error('Erro ao mover candidato')
    }
  }

  const handleWhatsApp = () => {
    if (!candidate) return
    window.open(`https://wa.me/55${candidate.telefone.replace(/\D/g, '')}`, '_blank')
  }

  const handleConverter = async () => {
    if (!candidate) return
    setConvertendo(true)
    try {
      const resultado = await conversaoCandidatoService.converterCandidatoParaPrestador(candidate.id)
      if (resultado.success) {
        toast.success(resultado.mensagem)
        store.moveCandidate(candidate.id, 'homologado_disponivel')
        if (resultado.prestadorId) {
          const prestador = await prestadoresService.obter(resultado.prestadorId)
          if (prestador) {
            recrutamentoStore.setPrestadores([prestador, ...recrutamentoStore.prestadores.filter(p => p.id !== prestador.id)])
            recrutamentoStore.setSelectedPrestadorId(prestador.id)
          }
        }
        recrutamentoStore.setCurrentSection('prestadores')
        onOpenChange(false)
      } else {
        toast.error(resultado.mensagem)
      }
    } catch {
      toast.error('Erro ao converter candidato')
    } finally {
      setConvertendo(false)
    }
  }

  const handleRegistrarContato = async () => {
    if (!candidate || !novoContato.trim()) return
    setSalvandoContato(true)
    const obsAnterior = candidate.observacoesIA || ''
    const obsAtual = candidate.observacoesIA || ''
    const novaObs = `[${new Date().toLocaleString('pt-BR')}] Contato: ${novoContato.trim()}\n${obsAtual}`
    store.updateCandidate(candidate.id, { observacoesIA: novaObs })
    try {
      await enterpriseKanbanService.adicionarObservacao(candidate.id, novaObs)
      toast.success('Contato registrado!')
      setNovoContato('')
    } catch {
      store.updateCandidate(candidate.id, { observacoesIA: obsAnterior })
      toast.error('Erro ao registrar contato')
    } finally {
      setSalvandoContato(false)
    }
  }

  const toggleOnboardingItem = useCallback(async (itemNome: string, concluido: boolean) => {
    if (!candidate) return
    const tagName = `onboarding_${itemNome.replace(/\s+/g, '_')}`
    const novasTags = concluido
      ? [...candidate.tags.filter(t => t !== tagName)]
      : [...candidate.tags, tagName as any]
    const tagsAnteriores = candidate.tags

    store.updateCandidate(candidate.id, { tags: novasTags } as any)
    try {
      await enterpriseKanbanService.atualizar(candidate.id, { tags: novasTags } as any)
      await enterpriseKanbanService.registrarEvento(candidate.id, {
        tipo: 'observacao_adicionada',
        descricao: `Onboarding: ${itemNome} ${concluido ? 'desmarcado' : 'concluído'}`,
        data: new Date().toISOString(),
      })
      toast.success(`Onboarding: ${itemNome} ${concluido ? 'desmarcado' : 'concluído'}`)
    } catch {
      store.updateCandidate(candidate.id, { tags: tagsAnteriores } as any)
      toast.error('Erro ao atualizar onboarding')
    }
  }, [candidate])

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
              <SafeImage src={candidate.foto} alt={candidate.nome} className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg truncate">{candidate.nome}</SheetTitle>
              <SheetDescription className="flex items-center gap-2 mt-1">
                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border', STAGE_COLORS[candidate.stage] ?? 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30')}>
                  {STAGE_LABELS[candidate.stage] ?? candidate.stage}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border text-amber-400 bg-amber-500/10 border-amber-500/30">
                  <Star className="w-3 h-3 fill-current" />
                  {candidate.score}
                </span>
                {candidate.prestadorId && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border text-emerald-400 bg-emerald-500/10 border-emerald-500/30">
                    <Link2 className="w-3 h-3" />
                    Prestador Vinculado
                  </span>
                )}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mb-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                className="w-full text-xs h-9 gap-1.5" 
                variant="outline"
                onClick={handleConverterTop}
                disabled={convertendo || !documentacaoApta}
              >
                <UserCircle className="w-4 h-4 text-primary" />
                Converter em Prestador
              </Button>
            </TooltipTrigger>
            {!documentacaoApta && (
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="text-xs">{feedbackDocumentacao}</p>
              </TooltipContent>
            )}
          </Tooltip>
          {feedbackDocumentacao && (
            <p className="mt-1.5 text-[11px] text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              {feedbackDocumentacao}
            </p>
          )}
        </div>

        <Tabs defaultValue="perfil" className="w-full">
          <TabsList className="w-full grid grid-cols-7 h-9 mb-4">
            <TabsTrigger value="perfil" className="text-[10px] gap-1"><MapPin className="w-3 h-3" /> Perfil</TabsTrigger>
            <TabsTrigger value="comprometimento" className="text-[10px] gap-1"><TrendingUp className="w-3 h-3" /> Compromet.</TabsTrigger>
            <TabsTrigger value="documentos" className="text-[10px] gap-1"><FileText className="w-3 h-3" /> Documentos</TabsTrigger>
            <TabsTrigger value="questionario" className="text-[10px] gap-1"><ClipboardList className="w-3 h-3" /> Questionário</TabsTrigger>
            <TabsTrigger value="onboarding" className="text-[10px] gap-1"><ClipboardCheck className="w-3 h-3" /> Onboarding</TabsTrigger>
            <TabsTrigger value="historico" className="text-[10px] gap-1"><History className="w-3 h-3" /> Histórico</TabsTrigger>
            <TabsTrigger value="acoes" className="text-[10px] gap-1"><Send className="w-3 h-3" /> Ações</TabsTrigger>
          </TabsList>

          <TabsContent value="perfil" className="space-y-4 mt-0">
            <div>
              <SectionDivider title="Identificação" />
              <InfoRow icon={<MapPin className="w-4 h-4" />} label="Cidade / UF" value={`${candidate.cidade}, ${candidate.uf}`} />
              <InfoRow icon={<Truck className="w-4 h-4" />} label="Veículo" value={`${candidate.veiculo} - ${candidate.placa}`} />
              <InfoRow icon={<Calendar className="w-4 h-4" />} label="Data Entrada" value={candidate.dataEntrada ? new Date(candidate.dataEntrada).toLocaleDateString('pt-BR') : 'Não informado'} />
              <InfoRow icon={<Calendar className="w-4 h-4" />} label="Última Atualização" value={candidate.dataAtualizacao ? new Date(candidate.dataAtualizacao).toLocaleDateString('pt-BR') : 'Não informado'} />
            </div>
            <div>
              <SectionDivider title="Contato" />
              <InfoRow icon={<Phone className="w-4 h-4" />} label="Telefone" value={candidate.telefone} />
              <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={candidate.email} />
            </div>
            <div>
              <SectionDivider title="Informações de Recrutamento" />
              <InfoRow icon={<Calendar className="w-4 h-4" />} label="Data do primeiro contato" value={candidate.dataEntrada ? new Date(candidate.dataEntrada).toLocaleDateString('pt-BR') : 'Não informado'} />
              <InfoRow icon={<Users className="w-4 h-4" />} label="Origem do lead" value={(() => {
                const origensConhecidas: Record<string, string> = {
                  fretebras: 'Fretebras',
                  indicacao: 'Indicação',
                  indicado: 'Indicação',
                  facebook: 'Facebook',
                  whatsapp: 'WhatsApp',
                  site: 'Site',
                  linkedin: 'LinkedIn',
                  manual: 'Manual',
                  outro: 'Outro',
                }
                const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                const tagEncontrada = candidate.tags.find(t => origensConhecidas[normalizar(t)])
                return tagEncontrada ? origensConhecidas[normalizar(tagEncontrada)] : 'Não informado'
              })()} />
              <InfoRow icon={<Calendar className="w-4 h-4" />} label="Último contato" value={candidate.dataAtualizacao ? new Date(candidate.dataAtualizacao).toLocaleDateString('pt-BR') : 'Não informado'} />
              <InfoRow icon={<Clock className="w-4 h-4" />} label="Status do contato" value={STAGE_LABELS[candidate.stage] ?? candidate.stage} />
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
              <InfoRow icon={<UserCheck className="w-4 h-4" />} label="Status Operacional" value={candidate.statusOperacional === 'apto' ? 'Apto' : candidate.statusOperacional === 'pendente' ? 'Pendente' : candidate.statusOperacional === 'bloqueado' ? 'Bloqueado' : 'Indisponível'} />
              <InfoRow icon={<Clock className="w-4 h-4" />} label="Disponibilidade" value={candidate.disponibilidadeTipo === 'imediata' ? 'Imediata' : candidate.disponibilidadeTipo === 'parcial' ? 'Parcial' : 'Indisponível'} />
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

          <TabsContent value="comprometimento" className="space-y-4 mt-0">
            {(() => {
              const scoreInput: CandidatoScoreInput = {
                tempoMedioRespostaHoras: candidate.tempoMedioRespostaHoras,
                statusDocumental: candidate.statusDocumental,
                quantidadeCobrancas: candidate.quantidadeCobrancas,
                stage: candidate.stage,
                compareceuPrimeiroDia: candidate.compareceuPrimeiroDia,
                completou30Dias: candidate.completou30Dias,
                quantidadeReclamacoes: candidate.quantidadeReclamacoes,
                historicoDesistencias: candidate.historicoDesistencias,
                possuiOutraOperacaoFixa: candidate.possuiOutraOperacaoFixa,
                disponibilidadeRecrutamento: candidate.disponibilidadeRecrutamento,
                confirmouInteresse: candidate.confirmouInteresse,
                confirmouPreInicio: candidate.confirmouPreInicio,
                questionarioRespostas: candidate.questionarioRespostas,
              }
              const scoreComp = candidate.scoreComprometimento || recrutamentoScoreService.calcularScoreComprometimento(scoreInput)
              const classif = scoreComp !== null && scoreComp !== undefined
                ? (candidate.classificacaoComprometimento || recrutamentoScoreService.classificarComprometimento(scoreComp))
                : recrutamentoScoreService.classificarComprometimento(null)
              const risco = candidate.riscoDesistencia || recrutamentoScoreService.calculcarRiscoDesistencia(scoreInput)
              const etiquetas = candidate.etiquetasAutomaticas.length > 0 ? candidate.etiquetasAutomaticas : recrutamentoScoreService.gerarEtiquetasAutomaticas(scoreInput)
              const parecer = candidate.parecerIA ? { parecer: candidate.parecerIA, riscos: candidate.principaisRiscos, pontosPositivos: candidate.principaisPontosPositivos, proximaAcao: candidate.proximaAcaoSugerida } : recrutamentoScoreService.gerarParecerOperacional(scoreInput)
              const corClassif = recrutamentoScoreService.getCorClassificacao(classif)
              const scorePercent = scoreComp ?? 0

              const handleConfirmarComprometimento = async () => {
                if (!candidate) return
                const novoScore = recrutamentoScoreService.calcularScoreComprometimento(scoreInput)
                const novaClassif = recrutamentoScoreService.classificarComprometimento(novoScore)
                const novoRisco = recrutamentoScoreService.calcularRiscoDesistencia(scoreInput)
                const novasEtiquetas = recrutamentoScoreService.gerarEtiquetasAutomaticas(scoreInput)
                const novoParecer = recrutamentoScoreService.gerarParecerOperacional(scoreInput)
                const update = {
                  scoreComprometimento: novoScore,
                  classificacaoComprometimento: novaClassif,
                  riscoDesistencia: novoRisco,
                  etiquetasAutomaticas: novasEtiquetas,
                  parecerIA: novoParecer.parecer,
                  principaisRiscos: novoParecer.riscos,
                  principaisPontosPositivos: novoParecer.pontosPositivos,
                  proximaAcaoSugerida: novoParecer.proximaAcao,
                }
                store.updateCandidate(candidate.id, update as any)
                try { await enterpriseKanbanService.atualizar(candidate.id, update as any); toast.success('Comprometimento recalculado!') } catch { toast.error('Erro ao salvar') }
              }

              return (
                <>
                  <div>
                    <SectionDivider title="Score de Comprometimento" />
                    <div className="mt-2 p-4 rounded-xl bg-muted/10 border border-border/20">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium">Score</span>
                        <div className="flex items-center gap-2">
                          {scoreComp !== null && scoreComp !== undefined ? (
                            <>
                              <div className="w-32 h-4 rounded-full bg-muted/30 overflow-hidden">
                                <div className={cn('h-full rounded-full transition-all', scoreComp >= 90 ? 'bg-emerald-500' : scoreComp >= 75 ? 'bg-blue-500' : scoreComp >= 50 ? 'bg-amber-500' : 'bg-rose-500')} style={{ width: `${Math.min(100, scorePercent)}%` }} />
                              </div>
                              <span className="text-xl font-bold tabular-nums">{scoreComp}</span>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground italic">—</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium border', corClassif)}>{classif}</span>
                        <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium border', risco === 'Crítico' || risco === 'Alto' ? 'text-rose-400 bg-rose-500/10 border-rose-500/30' : risco === 'Moderado' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30')}>
                          <AlertTriangle className="w-3 h-3" /> Risco: {risco}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <SectionDivider title="Checklist de Comprometimento" />
                    <div className="space-y-1.5 mt-2">
                      {[
                        { label: 'Respondeu em menos de 24h', ok: candidate.tempoMedioRespostaHoras !== null && candidate.tempoMedioRespostaHoras > 0 && candidate.tempoMedioRespostaHoras <= 24 },
                        { label: 'Documentação completa sem cobrança', ok: candidate.statusDocumental === 'completo' && candidate.quantidadeCobrancas === 0 },
                        { label: 'Avaliação situacional / entrevista concluída', ok: candidate.stage === 'em_avaliacao_situacional' || candidate.stage === 'em_entrevista' || candidate.stage === 'em_homologacao' || candidate.confirmouPreInicio },
                        { label: 'Concluiu treinamento', ok: candidate.confirmouPreInicio },
                        { label: 'Confirmou disponibilidade pós-treinamento', ok: candidate.confirmouInteresse },
                        { label: 'Compareceu ao primeiro dia', ok: candidate.compareceuPrimeiroDia },
                        { label: 'Completou 30 dias de operação', ok: candidate.completou30Dias },
                        { label: 'Sem reclamações operacionais', ok: candidate.quantidadeReclamacoes === 0 },
                      ].map((item, idx) => (
                        <div key={idx} className={cn('flex items-center gap-3 p-2.5 rounded-lg border', item.ok ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-muted/10 border-border/30')}>
                          {item.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <Circle className="w-4 h-4 text-muted-foreground/30 shrink-0" />}
                          <span className={cn('text-xs', item.ok ? 'text-emerald-300' : 'text-muted-foreground')}>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {etiquetas.length > 0 && (
                    <div>
                      <SectionDivider title="Etiquetas Automáticas" />
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {etiquetas.map((etq: string, idx: number) => <span key={idx} className="px-2 py-1 rounded-md bg-muted/30 text-[10px] font-medium text-muted-foreground border border-border/30">{etq}</span>)}
                      </div>
                    </div>
                  )}
                  <div>
                    <SectionDivider title="Parecer IA" />
                    <div className="p-3 rounded-lg bg-muted/20 text-xs text-muted-foreground leading-relaxed mt-2">{parecer.parecer}</div>
                  </div>
                  {parecer.riscos.length > 0 && (
                    <div>
                      <SectionDivider title="Principais Riscos" />
                      <div className="space-y-1 mt-2">{parecer.riscos.map((r: string, idx: number) => <div key={idx} className="flex items-center gap-2 text-xs text-rose-400"><AlertTriangle className="w-3 h-3 shrink-0" /> {r}</div>)}</div>
                    </div>
                  )}
                  {parecer.pontosPositivos.length > 0 && (
                    <div>
                      <SectionDivider title="Pontos Positivos" />
                      <div className="space-y-1 mt-2">{parecer.pontosPositivos.map((p: string, idx: number) => <div key={idx} className="flex items-center gap-2 text-xs text-emerald-400"><ThumbsUp className="w-3 h-3 shrink-0" /> {p}</div>)}</div>
                    </div>
                  )}
                  <div>
                    <SectionDivider title="Próxima Ação Sugerida" />
                    <div className="flex items-start gap-2 mt-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                      <Target className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <span className="text-xs text-blue-300">{parecer.proximaAcao}</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={handleConfirmarComprometimento}><Zap className="w-3.5 h-3.5" /> Recalcular Comprometimento</Button>
                </>
              )
            })()}
          </TabsContent>

          <TabsContent value="questionario" className="space-y-4 mt-0">
            <QuestionarioTab candidate={candidate} onSave={async (respostas: Record<string, string>) => {
              const update = { questionarioRespostas: respostas }
              store.updateCandidate(candidate.id, update as any)
              try { await enterpriseKanbanService.atualizar(candidate.id, update as any); toast.success('Questionário salvo!') } catch { toast.error('Erro ao salvar questionário') }
            }} />
          </TabsContent>

          <TabsContent value="documentos" className="space-y-4 mt-0">
            <SectionDivider title="Status Operacional" />
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="p-3 rounded-lg bg-muted/20 border border-border/30 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Status Geral</p>
                <p className={cn('text-sm font-bold mt-1', {
                  'text-emerald-400': candidate.statusDocumental === 'completo',
                  'text-amber-400': candidate.statusDocumental === 'parcial',
                  'text-blue-400': candidate.statusDocumental === 'pendente',
                  'text-rose-400': candidate.statusDocumental === 'vencido',
                  'text-red-400': candidate.statusDocumental === 'bloqueado',
                })}>
                  {candidate.statusDocumental === 'completo' ? ' Completo' :
                   candidate.statusDocumental === 'parcial' ? 'Parcial' :
                   candidate.statusDocumental === 'pendente' ? 'Pendente' :
                   candidate.statusDocumental === 'bloqueado' ? ' Bloqueado' : 'Vencido'}
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

            <SectionDivider title="Checklist Obrigatório" />
            <div className="space-y-1.5">
              {[...DOCS_MINIMOS_OBRIGATORIOS].map(nomeDoc => {
                const doc = candidate.documentos.find(d => d.nome === nomeDoc)
                const presente = doc && doc.status === 'ok'
                const vencido = doc && doc.status === 'vencido'
                const pendente = !doc || doc.status === 'pendente'

                return (
                  <div key={nomeDoc} className={cn(
                    'flex items-center gap-3 p-2.5 rounded-lg border transition-colors',
                    presente ? 'bg-emerald-500/5 border-emerald-500/20' :
                    vencido ? 'bg-rose-500/5 border-rose-500/20' :
                    'bg-amber-500/5 border-amber-500/20',
                  )}>
                    <div className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center shrink-0',
                      presente ? 'bg-emerald-500/20 text-emerald-400' :
                      vencido ? 'bg-rose-500/20 text-rose-400' :
                      'bg-amber-500/20 text-amber-400',
                    )}>
                      <div className={cn(
                        'w-2 h-2 rounded-full',
                        presente ? 'bg-emerald-400' :
                        vencido ? 'bg-rose-400' :
                        'bg-amber-400',
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-xs font-medium',
                        presente ? 'text-emerald-300' :
                        vencido ? 'text-rose-300' :
                        'text-amber-300',
                      )}>{nomeDoc}</p>
                      {doc?.dataValidade && (
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                          Validade: {new Date(doc.dataValidade).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                    <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', {
                      'text-emerald-400 bg-emerald-500/10': presente,
                      'text-rose-400 bg-rose-500/10': vencido,
                      'text-amber-400 bg-amber-500/10': pendente,
                    })}>
                      {presente ? 'OK' : vencido ? 'Vencido' : 'Pendente'}
                    </span>
                  </div>
                )
              })}
            </div>

            <SectionDivider title="Documentos Opcionais" />
            <div className="space-y-1.5">
              {[...DOCS_MINIMOS_OPCIONAIS].map(nomeDoc => {
                const doc = candidate.documentos.find(d => d.nome === nomeDoc)
                const presente = doc && doc.status === 'ok'
                const pendente = !doc || doc.status === 'pendente'

                return (
                  <div key={nomeDoc} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/10 border border-border/20">
                    <div className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center shrink-0',
                      presente ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted/30 text-muted-foreground/40',
                    )}>
                      <div className={cn(
                        'w-2 h-2 rounded-full',
                        presente ? 'bg-emerald-400' : 'bg-muted-foreground/30',
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-xs font-medium',
                        presente ? 'text-emerald-300' : 'text-muted-foreground/50',
                      )}>{nomeDoc}</p>
                    </div>
                    <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', {
                      'text-emerald-400 bg-emerald-500/10': presente,
                      'text-muted-foreground/40 bg-muted/20': pendente,
                    })}>
                      {presente ? 'OK' : 'Não informado'}
                    </span>
                  </div>
                )
              })}

              {candidate.documentos.filter(d =>
                ![...DOCS_MINIMOS_OBRIGATORIOS, ...DOCS_MINIMOS_OPCIONAIS].includes(d.nome as any)
              ).length > 0 && (
                <>
                  <SectionDivider title="Outros Documentos" />
                  {candidate.documentos.filter(d =>
                    ![...DOCS_MINIMOS_OBRIGATORIOS, ...DOCS_MINIMOS_OPCIONAIS].includes(d.nome as any)
                  ).map(doc => (
                    <div key={doc.nome} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 border border-border/30">
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
                  ))}
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="onboarding" className="space-y-4 mt-0">
            <SectionDivider title="Progresso" />
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      candidate.onboardingProgress === 100 ? 'bg-emerald-500' :
                      candidate.onboardingProgress >= 50 ? 'bg-amber-500' :
                      'bg-blue-500',
                    )}
                    style={{ width: `${candidate.onboardingProgress}%` }}
                  />
                </div>
                <span className={cn(
                  'text-xs font-bold tabular-nums shrink-0',
                  candidate.onboardingProgress === 100 ? 'text-emerald-400' :
                  candidate.onboardingProgress >= 50 ? 'text-amber-400' :
                  'text-blue-400',
                )}>
                  {candidate.onboardingProgress}%
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground/50">
                Status: {candidate.onboardingStatus === 'pendente' ? 'Pendente' :
                         candidate.onboardingStatus === 'em_andamento' ? 'Em andamento' :
                         'Concluído'}
              </p>
            </div>

            <SectionDivider title="Checklist Operacional" />
            <div className="space-y-1.5">
              {(candidate.onboardingChecklist ?? []).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  Nenhum item de onboarding disponível
                </div>
              ) : (
                candidate.onboardingChecklist.map(item => (
                  <button
                    key={item.nome}
                    onClick={() => toggleOnboardingItem(item.nome, item.concluido)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
                      item.concluido
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : 'bg-muted/10 border-border/30 hover:border-border/60',
                    )}
                  >
                    <div className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors',
                      item.concluido
                        ? 'text-emerald-400'
                        : 'text-muted-foreground/30',
                    )}>
                      {item.concluido
                        ? <CheckCircle2 className="w-5 h-5" />
                        : <Circle className="w-5 h-5" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-xs font-medium capitalize',
                        item.concluido ? 'text-emerald-300' : 'text-muted-foreground',
                      )}>
                        {item.nome}
                      </p>
                    </div>
                    <span className={cn(
                      'text-[10px] font-medium px-2 py-0.5 rounded-full',
                      item.concluido
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : 'text-muted-foreground/40 bg-muted/20',
                    )}>
                      {item.concluido ? 'OK' : 'Pendente'}
                    </span>
                  </button>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="historico" className="space-y-4 mt-0">
            <SectionDivider title="Linha do Tempo" />
            {(!candidate.historico || candidate.historico.length === 0) ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                Nenhum histórico registrado
              </div>
            ) : (
              <div className="relative space-y-0">
                {[...candidate.historico].reverse().map((evento, idx) => {
                  const isLast = idx === candidate.historico.length - 1
                  const iconColor = evento.tipo === 'criado' ? 'bg-blue-500'
                    : evento.tipo === 'convertido' ? 'bg-emerald-500'
                    : evento.tipo === 'aprovado' ? 'bg-green-500'
                    : evento.tipo === 'bloqueado' ? 'bg-rose-500'
                    : evento.tipo === 'observacao_adicionada' ? 'bg-amber-500'
                    : 'bg-gray-500'

                  return (
                    <div key={idx} className="flex gap-3 pb-4 relative">
                      {!isLast && (
                        <div className="absolute left-[11px] top-5 bottom-0 w-px bg-border/40" />
                      )}
                      <div className="shrink-0 mt-1">
                        <div className={`w-[22px] h-[22px] rounded-full ${iconColor} flex items-center justify-center`}>
                          <div className="w-[6px] h-[6px] rounded-full bg-white" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 -mt-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-foreground capitalize">
                            {evento.tipo === 'criado' ? 'Criado'
                              : evento.tipo === 'mudou_etapa' ? 'Mudou de Etapa'
                              : evento.tipo === 'convertido' ? 'Convertido'
                              : evento.tipo === 'bloqueado' ? 'Bloqueado'
                              : evento.tipo === 'aprovado' ? 'Aprovado'
                              : evento.tipo === 'observacao_adicionada' ? 'Observação'
                              : evento.tipo}
                          </span>
                          <span className="text-[10px] text-muted-foreground/50">
                            {new Date(evento.data).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                          {evento.descricao}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
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
                        stage === 'processo_encerrado' ? 'border-rose-500/40 text-rose-400 hover:bg-rose-500/15 hover:border-rose-500/60' :
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
                  onClick={() => possibleStages.includes('banco_de_talentos') && handleMover('banco_de_talentos')}
                  disabled={!possibleStages.includes('banco_de_talentos')}
                >
                  <Star className="w-3.5 h-3.5" /> Banco de Talentos
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-blue-400 border-blue-500/30 hover:bg-blue-500/10 hover:border-blue-500/50"
                  onClick={handleWhatsApp}
                >
                  <Send className="w-3.5 h-3.5" /> WhatsApp
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-1.5 col-span-2 bg-indigo-600 hover:bg-indigo-500 text-white"
                      onClick={handleConverter}
                      disabled={convertendo || !documentacaoApta}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      {convertendo ? 'Convertendo...' : 'Converter em Prestador'}
                    </Button>
                  </TooltipTrigger>
                  {!documentacaoApta && (
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="text-xs">{feedbackDocumentacao}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
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

const PERGUNTAS_QUESTIONARIO = [
  { key: 'empresas_atuais', pergunta: 'Atualmente trabalha para quais empresas?' },
  { key: 'intencao_renda', pergunta: 'Sua intenção é renda principal ou complementar?' },
  { key: 'dias_iniciar', pergunta: 'Caso aprovado, em quantos dias consegue iniciar?' },
  { key: 'disponibilidade_tipo', pergunta: 'Disponibilidade integral ou parcial?' },
  { key: 'possui_outra_operacao', pergunta: 'Possui outra operação fixa?' },
  { key: 'o_que_faria_desistir', pergunta: 'O que faria você desistir de uma operação?' },
  { key: 'restricao_regiao', pergunta: 'Tem restrição de região?' },
  { key: 'restricao_horario', pergunta: 'Tem restrição de horário?' },
  { key: 'restricao_peso', pergunta: 'Tem restrição de peso/paradas?' },
  { key: 'ja_desistiu', pergunta: 'Já desistiu de operação após aprovado?' },
]

function QuestionarioTab({ candidate, onSave }: { candidate: any; onSave: (respostas: Record<string, string>) => Promise<void> }) {
  const [respostas, setRespostas] = useState<Record<string, string>>(candidate.questionarioRespostas || {})
  const [salvando, setSalvando] = useState(false)

  const handleChange = (key: string, value: string) => {
    setRespostas(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSalvando(true)
    try {
      await onSave(respostas)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-muted/10 border border-border/20 text-xs text-muted-foreground">
        Questionário de perfil operacional. As respostas são usadas para cálculo de score de comprometimento e risco de desistência.
      </div>
      <div className="space-y-3">
        {PERGUNTAS_QUESTIONARIO.map(({ key, pergunta }) => (
          <div key={key} className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">{pergunta}</label>
            <input
              type="text"
              value={respostas[key] || ''}
              onChange={e => handleChange(key, e.target.value)}
              placeholder="Digite a resposta..."
              className="w-full h-9 rounded-md border border-border/50 bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
          </div>
        ))}
      </div>
      <Button size="sm" className="w-full gap-1.5" onClick={handleSave} disabled={salvando}>
        <Save className="w-3.5 h-3.5" />
        {salvando ? 'Salvando...' : 'Salvar Questionário'}
      </Button>
      {Object.keys(respostas).length > 0 && (
        <div>
          <div className="flex items-center gap-2 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">Resumo</span>
            <div className="flex-1 h-px bg-border/30" />
          </div>
          <div className="space-y-1 mt-2">
            {PERGUNTAS_QUESTIONARIO.filter(q => respostas[q.key]).map(({ key, pergunta }) => (
              <div key={key} className="flex items-start gap-2 text-[11px]">
                <span className="text-muted-foreground/70 shrink-0">{pergunta}</span>
                <span className="text-foreground font-medium">{respostas[key]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
