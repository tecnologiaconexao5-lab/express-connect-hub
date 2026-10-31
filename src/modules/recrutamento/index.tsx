import { RecrutamentoLayout } from './layouts/RecrutamentoLayout'
import { DashboardRecrutamento } from './pages/DashboardRecrutamento'
import { PaginaOperacoes } from './pages/PaginaOperacoes'
import { PaginaNovaOperacao } from './pages/PaginaNovaOperacao'
import { PaginaPrestadores } from './pages/PaginaPrestadores'
import { useRecrutamentoStore } from './store/recrutamentoStore'
import { usePrestadoresRealtime } from './hooks/useRecrutamentoRealtime'
import { PageHeader } from './components/design-system/PageHeader'
import { PremiumCard, PremiumCardHeader, PremiumCardTitle, PremiumCardContent } from './components/design-system/PremiumCard'
import { PremiumBadge } from './components/design-system/PremiumBadge'
import { MetricCard } from './components/design-system/MetricCard'
import { EmptyState } from './components/design-system/EmptyState'
import { KanbanBoard } from './components/kanban/KanbanBoard'
import { EnterpriseKanbanBoard } from './components/enterprise-kanban/EnterpriseKanbanBoard'
import { PrestadoresAptos } from './components/enterprise-kanban/PrestadoresAptos'
import { PrestadorCard } from './components/prestadores/PrestadorCard'
import { ScoreMeter } from './components/score/ScoreMeter'
import { CentralDocumentos } from './components/documentos/CentralDocumentos'
import { IAChat } from './components/ia/IAChat'
import { IAOperacional } from './components/ia/IAOperacional'
import { OnboardingWizard } from './components/portal/OnboardingWizard'
import { PortalPrestadorPreview } from './components/portal/PortalPrestadorPreview'
import { AutomacoesList } from './components/automacoes/AutomacoesList'
import { CrmLogistico } from './components/crm/CrmLogistico'
import { BancoTalentos } from './components/talentos/BancoTalentos'
import { useOperacoes } from './hooks/useOperacoes'
import { usePrestadores } from './hooks/usePrestadores'
import { prestadoresService } from './services/prestadoresService'
import { documentosService } from './services/documentosService'
import { automacoesService } from './services/automacoesService'
import { matchService } from './services/matchService'
import { crmService } from './services/crmService'
import { enterpriseKanbanService } from './components/enterprise-kanban/enterpriseKanbanService'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Truck, LayoutDashboard, FileText, Bot, Award, Users, HeartHandshake, MessageSquare, Sparkles, Columns3, CheckCircle } from 'lucide-react'
import type { DocumentoPrestador, AutomacaoRegra, StatusDocumento, CrmInteracao, TalentosCandidato } from './types/recrutamento'

export {
  RecrutamentoLayout,
  DashboardRecrutamento,
  PaginaOperacoes,
  PaginaNovaOperacao,
  PaginaPrestadores,
  useRecrutamentoStore,
  usePrestadoresRealtime,
  PageHeader,
  PremiumCard,
  PremiumCardHeader,
  PremiumCardTitle,
  PremiumCardContent,
  PremiumBadge,
  MetricCard,
  EmptyState,
  KanbanBoard,
  PrestadorCard,
  ScoreMeter,
  CentralDocumentos,
  IAChat,
  IAOperacional,
  OnboardingWizard,
  AutomacoesList,
  CrmLogistico,
  BancoTalentos,
  useOperacoes,
  usePrestadores,
  documentosService,
  automacoesService,
  matchService,
  crmService,
  Truck,
  LayoutDashboard,
  FileText,
  Bot,
  Award,
  Users,
  HeartHandshake,
  MessageSquare,
  Sparkles,
  DocumentoPrestador,
  AutomacaoRegra,
  StatusDocumento,
  CrmInteracao,
  TalentosCandidato,
}

const STAGE_TO_STATUS: Record<string, TalentosCandidato['status']> = {
  novo_candidato: 'novo',
  cadastro_iniciado: 'novo',
  cadastro_concluido: 'em_analise',
  em_triagem: 'em_analise',
  em_analise_perfil: 'em_analise',
  aguardando_documentacao: 'em_analise',
  em_verificacao_documental: 'em_analise',
  em_avaliacao_situacional: 'em_analise',
  em_entrevista: 'em_analise',
  em_homologacao: 'em_analise',
  aprovado: 'aprovado',
  reprovado: 'bloqueado',
  cadastro_incompleto: 'novo',
  banco_de_talentos: 'em_analise',
  homologado_disponivel: 'agregado',
  homologado_indisponivel: 'agregado',
  processo_encerrado: 'bloqueado',
  // legado
  novo_cadastro: 'novo',
  em_analise: 'em_analise',
  documentacao_pendente: 'em_analise',
  em_validacao: 'em_analise',
  entrevista: 'em_analise',
  em_treinamento: 'em_analise',
  ativo: 'agregado',
  bloqueado: 'bloqueado',
}

function extractOrigem(tags: string[]): string {
  const known = ['whatsapp', 'indicacao', 'site', 'anuncio', 'fretebras', 'facebook', 'linkedin', 'manual', 'outro']
  for (const tag of tags) {
    const normalized = tag.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (known.includes(normalized)) return tag
  }
  return 'manual'
}

export function RecrutamentoModule() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { currentSection, setCurrentSection } = useRecrutamentoStore()
  const { operacoes, prestadores, setPrestadores } = useRecrutamentoStore()

  usePrestadoresRealtime(useCallback(async () => {
    const data = await prestadoresService.listar()
    setPrestadores(data)
  }, [setPrestadores]))
  const [documentos, setDocumentos] = useState<DocumentoPrestador[]>([])
  const [automacoes, setAutomacoes] = useState<AutomacaoRegra[]>([])
  const [interacoesCrm, setInteracoesCrm] = useState<CrmInteracao[]>([])
  const [talentos, setTalentos] = useState<TalentosCandidato[]>([])
  const [talentosLoading, setTalentosLoading] = useState(false)

  useEffect(() => {
    documentosService.listarPendentes().then(setDocumentos)
    automacoesService.listar().then(setAutomacoes)
    crmService.listar().then(setInteracoesCrm)
  }, [])

  const carregarTalentos = useCallback(async () => {
    setTalentosLoading(true)
    try {
      const candidates = await enterpriseKanbanService.listar()
      const mapped: TalentosCandidato[] = candidates.map(c => ({
        id: c.id,
        nome: c.nome,
        telefone: c.telefone,
        email: c.email || '',
        tipoVeiculo: c.veiculo,
        regiao: `${c.cidade}, ${c.uf}`,
        experiencia: c.tags?.includes('experiente') ? 'Experiente' : c.tags?.includes('recorrente') ? 'Recorrente' : '',
        score: c.score,
        status: STAGE_TO_STATUS[c.stage] ?? 'novo',
        canalCaptacao: extractOrigem(c.tags) as TalentosCandidato['canalCaptacao'],
        dataContato: c.dataEntrada,
        ultimoContato: c.dataAtualizacao,
        observacoes: c.observacoesIA || '',
        documentosAprovados: (c.documentos || []).filter(d => d.status === 'ok').length,
        statusDocumental: c.statusDocumental,
        disponibilidade: c.disponibilidadeTipo,
        scoreComprometimento: c.scoreComprometimento,
        riscoDesistencia: c.riscoDesistencia,
        tempoMedioRespostaHoras: c.tempoMedioRespostaHoras,
        classificacaoComprometimento: c.classificacaoComprometimento,
      }))
      setTalentos(mapped)
    } catch {
      setTalentos([])
    } finally {
      setTalentosLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarTalentos()
  }, [carregarTalentos])

  const handleCrmRefresh = useCallback(async () => {
    const list = await crmService.listar()
    setInteracoesCrm(list)
  }, [])

  useEffect(() => {
    const sectionParam = searchParams.get('section')
    if (sectionParam) {
      const validSections = ['dashboard', 'pipeline-kanban', 'operacoes', 'nova-operacao', 'prestadores', 'crm', 'documentos', 'ia', 'onboarding', 'score', 'automacoes', 'portal', 'talentos', 'operacionais']
      if (validSections.includes(sectionParam)) {
        setCurrentSection(sectionParam as any)
      }
    }
  }, [])

  const handleDocStatus = async (docId: string, status: StatusDocumento, obs?: string) => {
    await documentosService.atualizarStatus(docId, status, 'admin', obs)
    setDocumentos(await documentosService.listarPendentes())
  }

  const renderSection = () => {
    switch (currentSection) {
      case 'dashboard':
        return <DashboardRecrutamento />

      case 'pipeline-kanban':
        return (
          <div className="space-y-4 h-full flex flex-col">
            <PageHeader
              icon={<Columns3 className="w-5 h-5 text-primary" />}
              title="Pipeline Enterprise"
              description="Kanban completo de recrutamento com drag-and-drop, filtros inteligentes e ações rápidas"
            />
            <EnterpriseKanbanBoard />
          </div>
        )

      case 'operacoes':
        return <PaginaOperacoes />

      case 'nova-operacao':
        return <PaginaNovaOperacao />

      case 'prestadores':
        return <PaginaPrestadores />

      case 'crm': {
        return (
          <div className="space-y-6">
            <PageHeader
              icon={<HeartHandshake className="w-5 h-5 text-primary" />}
              title="CRM Logístico"
              description="Relacionamento com prestadores — histórico completo de interações"
            />
            <CrmLogistico interacoes={interacoesCrm} onRefresh={handleCrmRefresh} />
          </div>
        )
      }

      case 'documentos': {
        return (
          <div className="space-y-6">
            <PageHeader
              icon={<FileText className="w-5 h-5 text-primary" />}
              title="Central Documental"
              description="Gestão de documentos com validação antifraude"
            />
            <CentralDocumentos documentos={documentos} onStatusChange={handleDocStatus} />
          </div>
        )
      }

      case 'ia': {
        return (
          <div className="space-y-6">
            <PageHeader
              icon={<Bot className="w-5 h-5 text-primary" />}
              title="IA Operacional"
              description="Análise inteligente de operações, sugestão de prestadores e geração de mensagens com IA"
            />
            <IAOperacional />
          </div>
        )
      }

      case 'onboarding': {
        const prestadorAtivo = prestadores.find(p => p.status === 'agregado' || p.status === 'aprovado')
        return (
          <div className="space-y-6 max-w-2xl">
            <PageHeader
              icon={<Award className="w-5 h-5 text-primary" />}
              title="Onboarding"
              description="Integração e homologação de novos prestadores"
            />
            {prestadorAtivo ? (
              <OnboardingWizard
                currentStatus={prestadorAtivo.onboarding}
                prestadorNome={prestadorAtivo.nome}
              />
            ) : (
              <EmptyState title="Nenhum prestador em onboarding" description="Prestadores em processo de integração aparecerão aqui." />
            )}
          </div>
        )
      }

      case 'score': {
        const sorted = [...prestadores].sort((a, b) => b.score.geral - a.score.geral)
        return (
          <div className="space-y-6">
            <PageHeader
              icon={<Award className="w-5 h-5 text-primary" />}
              title="Score de Prestadores"
              description="Métrica inteligente de talentos — pontuação e ranking"
            />
            {sorted.length === 0 ? (
              <EmptyState title="Nenhum score disponível" description="Cadastre prestadores para gerar scores." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {sorted.map((p, idx) => (
                  <PremiumCard key={p.id}>
                    <PremiumCardContent>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center text-sm font-bold text-muted-foreground">
                          {idx + 1}º
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{p.nome}</p>
                          <p className="text-xs text-muted-foreground/50">{p.tipoVeiculo} · {p.endereco.cidade}</p>
                        </div>
                        <ScoreMeter score={p.score.geral} size="md" />
                      </div>
                    </PremiumCardContent>
                  </PremiumCard>
                ))}
              </div>
            )}
          </div>
        )
      }

      case 'automacoes': {
        return (
          <div className="space-y-6">
            <PageHeader
              icon={<Sparkles className="w-5 h-5 text-primary" />}
              title="Automações"
              description="Regras inteligentes e triggers automáticos para o ecossistema de recrutamento"
            />
            <AutomacoesList automacoes={automacoes} onRefresh={() => automacoesService.listar().then(setAutomacoes)} />
          </div>
        )
      }

      case 'portal': {
        return (
          <div className="space-y-6">
            <PageHeader
              icon={<Users className="w-5 h-5 text-primary" />}
              title="Portal do Prestador"
              description="Autocadastro, acompanhamento, aceite de fretes e comunicação integrada"
            />
            <PortalPrestadorPreview />
          </div>
        )
      }

      case 'operacionais': {
        return (
          <div className="space-y-6">
            <PageHeader
              icon={<CheckCircle className="w-5 h-5 text-primary" />}
              title="Prestadores Aptos"
              description="Prestadores operacionalmente aptos — prontos para alocação na Programação Operacional/Torre"
            />
            <PrestadoresAptos />
          </div>
        )
      }

      case 'talentos': {
        return (
          <div className="space-y-6">
            <PageHeader
              icon={<MessageSquare className="w-5 h-5 text-primary" />}
              title="Banco de Talentos"
              description="Relação completa de candidatos e potenciais prestadores"
            />
            {talentosLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border/60 bg-card p-4 animate-pulse">
                    <div className="space-y-3">
                      <div className="h-4 w-32 bg-muted rounded" />
                      <div className="h-3 w-24 bg-muted rounded" />
                      <div className="h-3 w-28 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <BancoTalentos candidatos={talentos} />
            )}
          </div>
        )
      }

      default:
        return <DashboardRecrutamento />
    }
  }

  return (
    <RecrutamentoLayout>
      {renderSection()}
    </RecrutamentoLayout>
  )
}

export { useRecrutamentoStore as useRecrutamentoModule }