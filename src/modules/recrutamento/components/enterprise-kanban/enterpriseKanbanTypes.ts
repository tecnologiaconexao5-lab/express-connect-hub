export type PipelineStage =
  | 'novo_cadastro'
  | 'em_analise'
  | 'documentacao_pendente'
  | 'em_validacao'
  | 'entrevista'
  | 'em_treinamento'
  | 'aprovado'
  | 'ativo'
  | 'bloqueado'
  | 'reprovado'

export type Prioridade = 'baixa' | 'media' | 'alta' | 'urgente'
export type StatusDocumental = 'completo' | 'parcial' | 'pendente' | 'vencido'
export type ValidadeCNH = 'valida' | 'vencendo' | 'vencida'

export type TagType =
  | 'experiente'
  | 'veiculo_proprio'
  | 'indicado'
  | 'recorrente'
  | 'disponivel_imediato'
  | 'recomendado'
  | 'risco'
  | 'prioritario'

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
  documentos: { nome: string; status: 'ok' | 'pendente' | 'vencido' }[]
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
  validadeCNH: ValidadeCNH[]
  tags: TagType[]
  cidade: string
  veiculo: string
}

export const PIPELINE_COLUMNS: PipelineColumn[] = [
  { id: 'novo_cadastro', title: 'Novo Cadastro', color: '#3b82f6', gradient: 'from-blue-500/20 via-blue-500/5 to-transparent', icon: 'UserPlus' },
  { id: 'em_analise', title: 'Em Análise', color: '#8b5cf6', gradient: 'from-violet-500/20 via-violet-500/5 to-transparent', icon: 'Search' },
  { id: 'documentacao_pendente', title: 'Doc. Pendente', color: '#f59e0b', gradient: 'from-amber-500/20 via-amber-500/5 to-transparent', icon: 'FileText' },
  { id: 'em_validacao', title: 'Em Validação', color: '#06b6d4', gradient: 'from-cyan-500/20 via-cyan-500/5 to-transparent', icon: 'ShieldCheck' },
  { id: 'entrevista', title: 'Entrevista', color: '#a855f7', gradient: 'from-purple-500/20 via-purple-500/5 to-transparent', icon: 'MessageCircle' },
  { id: 'em_treinamento', title: 'Em Treinamento', color: '#f97316', gradient: 'from-orange-500/20 via-orange-500/5 to-transparent', icon: 'BookOpen' },
  { id: 'aprovado', title: 'Aprovado', color: '#10b981', gradient: 'from-emerald-500/20 via-emerald-500/5 to-transparent', icon: 'CheckCircle' },
  { id: 'ativo', title: 'Ativo', color: '#22c55e', gradient: 'from-green-500/20 via-green-500/5 to-transparent', icon: 'Zap' },
  { id: 'bloqueado', title: 'Bloqueado', color: '#ef4444', gradient: 'from-red-500/20 via-red-500/5 to-transparent', icon: 'ShieldBan' },
  { id: 'reprovado', title: 'Reprovado', color: '#6b7280', gradient: 'from-gray-500/20 via-gray-500/5 to-transparent', icon: 'XCircle' },
]

export const STAGE_TRANSITIONS: Record<PipelineStage, PipelineStage[]> = {
  novo_cadastro: ['em_analise', 'bloqueado', 'reprovado'],
  em_analise: ['documentacao_pendente', 'entrevista', 'bloqueado', 'reprovado'],
  documentacao_pendente: ['em_validacao', 'bloqueado', 'reprovado'],
  em_validacao: ['entrevista', 'aprovado', 'reprovado'],
  entrevista: ['em_treinamento', 'aprovado', 'reprovado'],
  em_treinamento: ['aprovado', 'reprovado'],
  aprovado: ['ativo', 'bloqueado'],
  ativo: ['bloqueado', 'reprovado'],
  bloqueado: ['em_analise', 'reprovado'],
  reprovado: [],
}
