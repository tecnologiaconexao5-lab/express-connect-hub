import { RecrutamentoLayout } from './layouts/RecrutamentoLayout'
import { DashboardRecrutamento } from './pages/DashboardRecrutamento'
import { PaginaOperacoes } from './pages/PaginaOperacoes'
import { PaginaNovaOperacao } from './pages/PaginaNovaOperacao'
import { PaginaPrestadores } from './pages/PaginaPrestadores'
import { useRecrutamentoStore } from './store/recrutamentoStore'
import { useRecrutamentoRealtime } from './hooks/useRecrutamentoRealtime'
import { PageHeader } from './components/design-system/PageHeader'
import { PremiumCard, PremiumCardHeader, PremiumCardTitle, PremiumCardContent } from './components/design-system/PremiumCard'
import { PremiumBadge } from './components/design-system/PremiumBadge'
import { MetricCard } from './components/design-system/MetricCard'
import { EmptyState } from './components/design-system/EmptyState'
import { KanbanBoard } from './components/kanban/KanbanBoard'
import { EnterpriseKanbanBoard } from './components/enterprise-kanban/EnterpriseKanbanBoard'
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
import { documentosService } from './services/documentosService'
import { automacoesService } from './services/automacoesService'
import { matchService } from './services/matchService'
import { crmService } from './services/crmService'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Truck, LayoutDashboard, FileText, Bot, Award, Users, HeartHandshake, MessageSquare, Sparkles, Columns3 } from 'lucide-react'
import type { DocumentoPrestador, AutomacaoRegra, StatusDocumento, CrmInteracao, TalentosCandidato } from './types/recrutamento'

export {
  RecrutamentoLayout,
  DashboardRecrutamento,
  PaginaOperacoes,
  PaginaNovaOperacao,
  PaginaPrestadores,
  useRecrutamentoStore,
  useRecrutamentoRealtime,
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

const ALL_CRIADOS = [
  'Ana Clara Oliveira',
  'Bruno Santos Lima',
  'Carlos Eduardo Pereira',
  'Daniela Souza Costa',
  'Eduardo Almeida Neto',
  'Fernanda Lima Rocha',
  'Gabriel Barbosa Santos',
  'Helena Martins Dias',
  'Igor Costa Ribeiro',
  'Julia Oliveira Campos',
]

const ALL_CANAIS = ['whatsapp', 'indicacao', 'site', 'anuncio'] as const
const ALL_VEICULOS = ['Van', 'Truck', 'Carreta', 'VUC', 'Bitrem', 'Toco', '3/4']
const ALL_REGIODAGENS = ['São Paulo', 'Rio de Janeiro', 'Minas Gerais', 'Paraná', 'Santa Catarina', 'Rio Grande do Sul', 'Bahia', 'Pernambuco', 'Ceará', 'Goiás']

function generateMockPrestadorId(): string {
  return `mock_pre_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function makeMock(id: string): TalentosCandidato {
  return {
    id,
    nome: ALL_CRIADOS[Math.floor(Math.random() * ALL_CRIADOS.length)],
    telefone: `(11) 9${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
    email: `${Math.random().toString(36).slice(2, 6)}@email.com`,
    tipoVeiculo: ALL_VEICULOS[Math.floor(Math.random() * ALL_VEICULOS.length)],
    regiao: ALL_REGIODAGENS[Math.floor(Math.random() * ALL_REGIODAGENS.length)],
    experiencia: `${Math.floor(3 + Math.random() * 15)} anos`,
    score: Math.floor(40 + Math.random() * 55),
    status: Math.random() > 0.7 ? 'agregado' : Math.random() > 0.5 ? 'em_analise' : 'novo',
    canalCaptacao: ALL_CANAIS[Math.floor(Math.random() * ALL_CANAIS.length)],
    dataContato: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000).toISOString(),
    ultimoContato: new Date(Date.now() - Math.floor(Math.random() * 7) * 86400000).toISOString(),
    observacoes: '',
  }
}

function generateMockCandidatos(count = 20): TalentosCandidato[] {
  return Array.from({ length: count }, (_, i) => makeMock(`tal_${i}_${Date.now()}`))
}

const MOCK_TALENTOS = generateMockCandidatos()

export function RecrutamentoModule() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { currentSection, setCurrentSection } = useRecrutamentoStore()
  const { operacoes, prestadores } = useRecrutamentoStore()
  const [documentos, setDocumentos] = useState<DocumentoPrestador[]>([])
  const [automacoes, setAutomacoes] = useState<AutomacaoRegra[]>([])
  const [interacoesCrm, setInteracoesCrm] = useState<CrmInteracao[]>([])

  useEffect(() => {
    documentosService.listarPendentes().then(setDocumentos)
    automacoesService.listar().then(setAutomacoes)
    crmService.listar().then(setInteracoesCrm)
  }, [])

  const handleCrmRefresh = useCallback(async () => {
    const list = await crmService.listar()
    setInteracoesCrm(list)
  }, [])

  useEffect(() => {
    const sectionParam = searchParams.get('section')
    if (sectionParam) {
      const validSections = ['dashboard', 'pipeline-kanban', 'operacoes', 'nova-operacao', 'prestadores', 'crm', 'documentos', 'ia', 'onboarding', 'score', 'automacoes', 'portal', 'talentos']
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

      case 'talentos': {
        return (
          <div className="space-y-6">
            <PageHeader
              icon={<MessageSquare className="w-5 h-5 text-primary" />}
              title="Banco de Talentos"
              description="Relação completa de candidatos e potenciais prestadores"
            />
            <BancoTalentos candidatos={MOCK_TALENTOS} />
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