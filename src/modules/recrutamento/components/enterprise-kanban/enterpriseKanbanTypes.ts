export type PipelineStage =
  | 'novo_cadastro'
  | 'pre_triagem'
  | 'interesse_confirmado'
  | 'em_analise'
  | 'documentacao_pendente'
  | 'em_validacao'
  | 'entrevista'
  | 'em_treinamento'
  | 'homologacao'
  | 'confirmacao_inicio'
  | 'aprovado'
  | 'prestador_apto'
  | 'ativo'
  | 'operacao_ativa'
  | 'bloqueado'
  | 'reprovado'

export type Prioridade = 'baixa' | 'media' | 'alta' | 'urgente'
export type StatusDocumental = 'completo' | 'parcial' | 'pendente' | 'vencido' | 'bloqueado'
export type StatusOperacional = 'apto' | 'pendente' | 'bloqueado' | 'indisponivel'
export type DisponibilidadeTipo = 'imediata' | 'parcial' | 'indisponivel'
export type OnboardingStatus = 'pendente' | 'em_andamento' | 'concluido'

export interface OnboardingItem {
  nome: string
  concluido: boolean
  data?: string
}

export const ONBOARDING_ITENS = [
  'documentação validada',
  'veículo validado',
  'treinamento realizado',
  'contrato enviado',
  'contrato aceito',
  'teste operacional',
] as const

export interface DocumentoCandidato {
  nome: string
  status: 'ok' | 'pendente' | 'vencido'
  dataValidade?: string
  observacao?: string
}

export const DOCS_MINIMOS_OBRIGATORIOS = ['CNH', 'CRLV', 'Comprovante Residência', 'Foto Veículo'] as const
export const DOCS_MINIMOS_OPCIONAIS = ['ANTT'] as const
export type ValidadeCNH = 'valida' | 'vencendo' | 'vencida'

export type HistoricoTipoEvento =
  | 'criado'
  | 'mudou_etapa'
  | 'convertido'
  | 'bloqueado'
  | 'aprovado'
  | 'observacao_adicionada'

export interface HistoricoEvento {
  tipo: HistoricoTipoEvento
  descricao: string
  data: string
  stageAnterior?: string
  stageNovo?: string
  // G21 — motivo persistido do bloqueio/desbloqueio (estrutura existente: historico JSONB).
  motivo?: string
}

export interface ReservaContexto {
  cliente?: string
  operacao?: string
  regiao?: string
  observacao?: string
  prioridade: 'baixa' | 'media' | 'alta'
}

export type TagType =
  | 'experiente'
  | 'veiculo_proprio'
  | 'indicado'
  | 'recorrente'
  | 'disponivel_imediato'
  | 'recomendado'
  | 'risco'
  | 'prioritario'
  | 'preSelecionado'
  | 'enviadoEscala'

export interface EnterpriseCandidate {
  id: string
  nome: string
  foto: string
  score: number
  cidade: string
  uf: string
  veiculo: string
  placa: string
  statusDocumental: StatusDocumental
  statusOperacional: StatusOperacional
  disponibilidadeTipo: DisponibilidadeTipo
  prioridade: Prioridade
  validadeCNH: ValidadeCNH
  dataValidadeCNH: string
  tags: TagType[]
  observacoesIA: string
  telefone: string
  email: string
  stage: PipelineStage
  dataEntrada: string
  dataAtualizacao: string
  documentos: DocumentoCandidato[]
  prestadorId?: string
  historico: HistoricoEvento[]
  regioesAtuacao: string[]
  horariosDisponiveis: string
  diasDisponiveis: string[]
  onboardingStatus: OnboardingStatus
  onboardingProgress: number
  onboardingChecklist: OnboardingItem[]
  reservaContexto?: ReservaContexto
  scoreComprometimento: number
  classificacaoComprometimento: string
  riscoDesistencia: string
  tempoMedioRespostaHoras: number | null
  quantidadeCobrancas: number
  confirmouInteresse: boolean
  dataConfirmacaoInteresse: string | null
  confirmouPreInicio: boolean
  dataConfirmacaoPreInicio: string | null
  compareceuPrimeiroDia: boolean
  completou30Dias: boolean
  quantidadeReclamacoes: number
  possuiOutraOperacaoFixa: boolean
  disponibilidadeRecrutamento: string
  historicoDesistencias: number
  etiquetasAutomaticas: string[]
  parecerIA: string
  principaisRiscos: string[]
  principaisPontosPositivos: string[]
  proximaAcaoSugerida: string
  questionarioRespostas: Record<string, string> | null
}

export interface PipelineColumn {
  id: PipelineStage
  title: string
  color: string
  gradient: string
  icon: string
}

export interface KanbanFilter {
  busca: string
  scoreMin: number
  scoreMax: number
  prioridade: Prioridade[]
  statusDocumental: StatusDocumental[]
  statusOperacional: StatusOperacional[]
  disponibilidade: DisponibilidadeTipo[]
  validadeCNH: ValidadeCNH[]
  tags: TagType[]
  cidade: string
  veiculo: string
}

export const PIPELINE_COLUMNS: PipelineColumn[] = [
  { id: 'novo_cadastro', title: 'Novo Lead', color: '#3b82f6', gradient: 'from-blue-500/20 via-blue-500/5 to-transparent', icon: 'UserPlus' },
  { id: 'pre_triagem', title: 'Pré-Triagem', color: '#6366f1', gradient: 'from-indigo-500/20 via-indigo-500/5 to-transparent', icon: 'Filter' },
  { id: 'interesse_confirmado', title: 'Interesse Confirmado', color: '#ec4899', gradient: 'from-pink-500/20 via-pink-500/5 to-transparent', icon: 'Heart' },
  { id: 'em_analise', title: 'Em Análise', color: '#8b5cf6', gradient: 'from-violet-500/20 via-violet-500/5 to-transparent', icon: 'Search' },
  { id: 'documentacao_pendente', title: 'Documentação', color: '#f59e0b', gradient: 'from-amber-500/20 via-amber-500/5 to-transparent', icon: 'FileText' },
  { id: 'em_validacao', title: 'Em Validação', color: '#06b6d4', gradient: 'from-cyan-500/20 via-cyan-500/5 to-transparent', icon: 'ShieldCheck' },
  { id: 'entrevista', title: 'Entrevista', color: '#a855f7', gradient: 'from-purple-500/20 via-purple-500/5 to-transparent', icon: 'MessageCircle' },
  { id: 'em_treinamento', title: 'Treinamento', color: '#f97316', gradient: 'from-orange-500/20 via-orange-500/5 to-transparent', icon: 'BookOpen' },
  { id: 'homologacao', title: 'Homologação', color: '#14b8a6', gradient: 'from-teal-500/20 via-teal-500/5 to-transparent', icon: 'Award' },
  { id: 'confirmacao_inicio', title: 'Conf. de Início', color: '#0ea5e9', gradient: 'from-sky-500/20 via-sky-500/5 to-transparent', icon: 'CalendarCheck' },
  { id: 'aprovado', title: 'Aprovado', color: '#10b981', gradient: 'from-emerald-500/20 via-emerald-500/5 to-transparent', icon: 'CheckCircle' },
  { id: 'prestador_apto', title: 'Prestador Apto', color: '#84cc16', gradient: 'from-lime-500/20 via-lime-500/5 to-transparent', icon: 'UserCheck' },
  { id: 'ativo', title: 'Ativo', color: '#22c55e', gradient: 'from-green-500/20 via-green-500/5 to-transparent', icon: 'Zap' },
  { id: 'operacao_ativa', title: 'Operação Ativa', color: '#16a34a', gradient: 'from-green-600/20 via-green-600/5 to-transparent', icon: 'Truck' },
  { id: 'bloqueado', title: 'Bloqueado', color: '#ef4444', gradient: 'from-red-500/20 via-red-500/5 to-transparent', icon: 'ShieldBan' },
  { id: 'reprovado', title: 'Reprovado', color: '#6b7280', gradient: 'from-gray-500/20 via-gray-500/5 to-transparent', icon: 'XCircle' },
]

export const STAGE_TRANSITIONS: Record<PipelineStage, PipelineStage[]> = {
  novo_cadastro: ['pre_triagem', 'em_analise', 'bloqueado', 'reprovado'],
  pre_triagem: ['interesse_confirmado', 'em_analise', 'bloqueado', 'reprovado'],
  interesse_confirmado: ['documentacao_pendente', 'em_analise', 'bloqueado', 'reprovado'],
  em_analise: ['documentacao_pendente', 'pre_triagem', 'entrevista', 'bloqueado', 'reprovado'],
  documentacao_pendente: ['em_validacao', 'em_treinamento', 'bloqueado', 'reprovado'],
  em_validacao: ['entrevista', 'aprovado', 'reprovado'],
  entrevista: ['em_treinamento', 'aprovado', 'reprovado'],
  em_treinamento: ['homologacao', 'aprovado', 'reprovado'],
  homologacao: ['confirmacao_inicio', 'bloqueado'],
  confirmacao_inicio: ['prestador_apto', 'bloqueado'],
  aprovado: ['prestador_apto', 'ativo', 'bloqueado'],
  prestador_apto: ['operacao_ativa', 'bloqueado'],
  ativo: ['operacao_ativa', 'bloqueado', 'reprovado'],
  operacao_ativa: ['bloqueado', 'reprovado'],
  bloqueado: ['em_analise', 'pre_triagem', 'reprovado'],
  reprovado: [],
}
