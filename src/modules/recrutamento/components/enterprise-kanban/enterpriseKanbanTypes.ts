/**
 * Funil oficial do Talent Intelligence — exatamente 17 etapas (Fase 3/4).
 * A ordem abaixo é a ordem de exibição no Kanban.
 */
export const PIPELINE_STAGES = [
  'novo_candidato',
  'cadastro_iniciado',
  'cadastro_concluido',
  'em_triagem',
  'em_analise_perfil',
  'aguardando_documentacao',
  'em_verificacao_documental',
  'em_avaliacao_situacional',
  'em_entrevista',
  'em_homologacao',
  'aprovado',
  'reprovado',
  'cadastro_incompleto',
  'banco_de_talentos',
  'homologado_disponivel',
  'homologado_indisponivel',
  'processo_encerrado',
] as const

export type PipelineStage = (typeof PIPELINE_STAGES)[number]

/** Etapas legadas (banco antigo) → etapa canônica das 17 fases. */
export const LEGACY_STAGE_MAP: Record<string, PipelineStage> = {
  novo_cadastro: 'novo_candidato',
  pre_triagem: 'em_triagem',
  interesse_confirmado: 'em_triagem',
  em_analise: 'em_analise_perfil',
  documentacao_pendente: 'aguardando_documentacao',
  em_validacao: 'em_verificacao_documental',
  entrevista: 'em_entrevista',
  em_treinamento: 'em_avaliacao_situacional',
  homologacao: 'em_homologacao',
  confirmacao_inicio: 'em_homologacao',
  prestador_apto: 'homologado_disponivel',
  ativo: 'homologado_disponivel',
  operacao_ativa: 'homologado_disponivel',
  bloqueado: 'reprovado',
}

/** Normaliza qualquer etapa (nova ou legada) para uma das 17 canônicas. */
export function normalizePipelineStage(stage: string | null | undefined): PipelineStage {
  const valor = String(stage || '').trim()
  if ((PIPELINE_STAGES as readonly string[]).includes(valor)) {
    return valor as PipelineStage
  }
  return LEGACY_STAGE_MAP[valor] ?? 'novo_candidato'
}

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
  { id: 'novo_candidato', title: 'Novo Candidato', color: '#3b82f6', gradient: 'from-blue-500/20 via-blue-500/5 to-transparent', icon: 'UserPlus' },
  { id: 'cadastro_iniciado', title: 'Cadastro Iniciado', color: '#6366f1', gradient: 'from-indigo-500/20 via-indigo-500/5 to-transparent', icon: 'UserPen' },
  { id: 'cadastro_concluido', title: 'Cadastro Concluído', color: '#8b5cf6', gradient: 'from-violet-500/20 via-violet-500/5 to-transparent', icon: 'UserCheck' },
  { id: 'em_triagem', title: 'Em Triagem', color: '#ec4899', gradient: 'from-pink-500/20 via-pink-500/5 to-transparent', icon: 'Filter' },
  { id: 'em_analise_perfil', title: 'Análise de Perfil', color: '#a855f7', gradient: 'from-purple-500/20 via-purple-500/5 to-transparent', icon: 'Search' },
  { id: 'aguardando_documentacao', title: 'Aguardando Documentação', color: '#f59e0b', gradient: 'from-amber-500/20 via-amber-500/5 to-transparent', icon: 'FileText' },
  { id: 'em_verificacao_documental', title: 'Verificação Documental', color: '#06b6d4', gradient: 'from-cyan-500/20 via-cyan-500/5 to-transparent', icon: 'ShieldCheck' },
  { id: 'em_avaliacao_situacional', title: 'Avaliação Situacional', color: '#f97316', gradient: 'from-orange-500/20 via-orange-500/5 to-transparent', icon: 'ClipboardList' },
  { id: 'em_entrevista', title: 'Entrevista', color: '#14b8a6', gradient: 'from-teal-500/20 via-teal-500/5 to-transparent', icon: 'MessageCircle' },
  { id: 'em_homologacao', title: 'Homologação', color: '#0ea5e9', gradient: 'from-sky-500/20 via-sky-500/5 to-transparent', icon: 'Award' },
  { id: 'aprovado', title: 'Aprovado', color: '#10b981', gradient: 'from-emerald-500/20 via-emerald-500/5 to-transparent', icon: 'CheckCircle' },
  { id: 'reprovado', title: 'Reprovado', color: '#6b7280', gradient: 'from-gray-500/20 via-gray-500/5 to-transparent', icon: 'XCircle' },
  { id: 'cadastro_incompleto', title: 'Cadastro Incompleto', color: '#ef4444', gradient: 'from-red-500/20 via-red-500/5 to-transparent', icon: 'AlertTriangle' },
  { id: 'banco_de_talentos', title: 'Banco de Talentos', color: '#eab308', gradient: 'from-yellow-500/20 via-yellow-500/5 to-transparent', icon: 'Star' },
  { id: 'homologado_disponivel', title: 'Homologado Disponível', color: '#22c55e', gradient: 'from-green-500/20 via-green-500/5 to-transparent', icon: 'Zap' },
  { id: 'homologado_indisponivel', title: 'Homologado Indisponível', color: '#84cc16', gradient: 'from-lime-500/20 via-lime-500/5 to-transparent', icon: 'Clock' },
  { id: 'processo_encerrado', title: 'Processo Encerrado', color: '#475569', gradient: 'from-slate-500/20 via-slate-500/5 to-transparent', icon: 'Lock' },
]

export const STAGE_TRANSITIONS: Record<PipelineStage, PipelineStage[]> = {
  novo_candidato: ['cadastro_iniciado', 'em_triagem', 'cadastro_incompleto', 'reprovado', 'processo_encerrado'],
  cadastro_iniciado: ['cadastro_concluido', 'em_triagem', 'cadastro_incompleto', 'reprovado', 'processo_encerrado'],
  cadastro_concluido: ['em_triagem', 'em_analise_perfil', 'cadastro_incompleto', 'reprovado', 'processo_encerrado'],
  em_triagem: ['em_analise_perfil', 'aguardando_documentacao', 'em_avaliacao_situacional', 'banco_de_talentos', 'reprovado', 'processo_encerrado'],
  em_analise_perfil: ['aguardando_documentacao', 'em_verificacao_documental', 'em_avaliacao_situacional', 'em_entrevista', 'banco_de_talentos', 'reprovado', 'processo_encerrado'],
  aguardando_documentacao: ['em_verificacao_documental', 'cadastro_incompleto', 'em_avaliacao_situacional', 'reprovado', 'processo_encerrado'],
  em_verificacao_documental: ['em_avaliacao_situacional', 'em_entrevista', 'cadastro_incompleto', 'banco_de_talentos', 'reprovado', 'processo_encerrado'],
  em_avaliacao_situacional: ['em_entrevista', 'em_homologacao', 'banco_de_talentos', 'reprovado', 'processo_encerrado'],
  em_entrevista: ['em_homologacao', 'aprovado', 'banco_de_talentos', 'reprovado', 'processo_encerrado'],
  em_homologacao: ['aprovado', 'homologado_disponivel', 'homologado_indisponivel', 'cadastro_incompleto', 'reprovado', 'processo_encerrado'],
  aprovado: ['homologado_disponivel', 'homologado_indisponivel', 'processo_encerrado'],
  reprovado: ['banco_de_talentos', 'processo_encerrado'],
  cadastro_incompleto: ['cadastro_iniciado', 'cadastro_concluido', 'aguardando_documentacao', 'reprovado', 'processo_encerrado'],
  banco_de_talentos: ['em_triagem', 'em_analise_perfil', 'em_avaliacao_situacional', 'reprovado', 'processo_encerrado'],
  homologado_disponivel: ['homologado_indisponivel', 'processo_encerrado'],
  homologado_indisponivel: ['homologado_disponivel', 'processo_encerrado'],
  processo_encerrado: [],
}
