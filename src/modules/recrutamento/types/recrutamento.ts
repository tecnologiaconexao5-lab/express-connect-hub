export type StatusOperacao = 'rascunho' | 'aberta' | 'em_captacao' | 'preenchida' | 'pausada' | 'encerrada' | 'arquivada'
export type PrioridadeOperacao = 'baixa' | 'media' | 'alta' | 'urgente'
export type Recurrencia = 'unica' | 'diaria' | 'semanal' | 'quinzenal' | 'mensal'
export type FrequenciaOperacao = 'fixa' | 'recorrente' | 'esporadica'
export type TipoCarga = 'seco' | 'refrigerado' | 'perigoso' | 'fragil' | 'alimenticio'
export type MetodoCarga = 'carga_solta' | 'paletizado' | 'granel' | 'líquido' | 'gasoso'
export type StatusPrestador = 'novo' | 'em_analise' | 'aprovado' | 'reserva' | 'agregado' | 'bloqueado'
export type OrigemCadastro = 'whatsapp' | 'indicacao' | 'site' | 'manual' | 'fretebras' | 'facebook' | 'linkedin' | 'anuncio' | 'outro'
export type TipoCargaVeiculo = 'seco' | 'refrigerado' | 'termico' | 'ambos'
export type StatusDocumento = 'pendente' | 'enviado' | 'validando' | 'aprovado' | 'reprovado' | 'vencido'
export type TipoDocumento = 'cnh' | 'cnpj' | 'certidao_federal' | 'certidao_estadual' | 'certidao_municipal' | 'crlv' | 'seguro' | 'antt' | 'contrato_social' | 'comprovante_endereco' | 'certificado_curso_mopp' | 'certidao_trabalhista'
export type CanalCaptacao = 'whatsapp' | 'indicacao' | 'site' | 'landing_page' | 'presencial' | 'parceiro' | 'anuncio' | 'fretebras' | 'facebook' | 'linkedin' | 'manual' | 'outro'
export type StatusMatch = 'pendente' | 'interessado' | 'contatado' | 'em_analise' | 'aprovado' | 'recusado'
export type StatusOnboarding = 'nao_iniciado' | 'em_andamento' | 'documentacao' | 'treinamento' | 'homologado' | 'concluido'
export type StatusAutomacao = 'ativa' | 'pausada' | 'desativada'
export type TipoAutomacao = 'whatsapp' | 'email' | 'notificacao' | 'webhook' | 'score' | 'validade_documento'

export interface FinanceiroOperacao {
  valorCliente: number
  valorPrestador: number
  percentualImposto: number
  percentualSeguro: number
  percentualPrestador: number
  margemTransportadora: number
  valorImposto: number
  valorSeguro: number
  receitaLiquida: number
  custoTotal: number
  lucroUnitario: number
  lucroTotal: number
  margem: number
  valorKmExcedente: number
  franquiaKm: number
  franquiaKmIda: number
  franquiaKmVolta: number
  kmExcedenteCliente: number
  kmExcedentePrestador: number
  percentualKmPrestador: number
  formaPagamento: string
  prazoPagamento: number
  dataPagamento: string
}

export interface MetaOperacao {
  vagasTotais: number
  vagasPreenchidas: number
  vagasPendentes: number
  diariasPorVaga: number
  totalDiarias: number
  captados: number
  aprovados: number
  emAnalise: number
  recusados: number
}

export interface HistoricoItem {
  id: string
  acao: string
  data: string
  usuario: string
  observacao: string
}

export interface Operacao {
  id: string
  nome: string
  cliente: string
  regiao: string
  rotaOrigem: string
  rotaDestino: string
  tipoVeiculo: string
  tipoCarga: TipoCarga
  metodoCarga: MetodoCarga
  temperatura: string
  pesoCarga: string
  dimensoes: string
  localCarregamento: string
  localDescarregamento: string
  horarioCarregamento: string
  horarioDescarregamento: string
  dataInicio: string
  dataFim: string
  recurrencia: Recurrencia
  frequencia: FrequenciaOperacao
  status: StatusOperacao
  prioridade: PrioridadeOperacao
  observacoes: string
  financeiro: FinanceiroOperacao
  meta: MetaOperacao
  historico: HistoricoItem[]
  // Novo: dados logísticos estruturados (opcional por compatibilidade)
  logistica?: {
    quantidadeMediaParadas?: number
    tipoOperacao?: 'fixa' | 'recorrente' | 'esporadica' | 'customizada'
    textoResumidoOperacional?: string
    programacaoOperacional?: Array<{
      saida: string
      retorno?: string
      tipoEntrega: 'D+0' | 'D+1' | 'D+2' | 'outro'
      observacao?: string
    }>
    tipoVeiculoDetalhado?: string
    volumeM3?: number
    aceitaTermo?: boolean
    aceitaRefrigerado?: boolean
    perfilCarga?: string
    temperaturaMinima?: number
    temperaturaMaxima?: number
  }
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface EnderecoPrestador {
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
}

export interface DocumentoPrestador {
  id: string
  prestadorId: string
  tipo: TipoDocumento
  status: StatusDocumento
  url: string
  nomeArquivo: string
  dataEnvio: string
  dataValidade: string
  dataAprovacao: string
  aprovadoPor: string
  observacao: string
  versao: number
}

export interface ContatoPrestador {
  tipo: 'telefone' | 'email' | 'whatsapp'
  valor: string
  principal: boolean
}

export interface ScorePrestador {
  geral: number
  documentacao: number
  experiencia: number
  reputacao: number
  regularidade: number
  perfil: number
  tendencia: number
  ultimaAtualizacao: string
  historico: ScoreHistoricoItem[]
}

export interface ScoreHistoricoItem {
  data: string
  score: number
  motivo: string
}

export interface HistoricoPrestador {
  jaCarregouConosco: boolean
  quantidadeOperacoes: number
  ultimaOperacao: string
  clientesAtendidos: string[]
  mediaPontualidade: number
  mediaOcorrencias: number
  avaliacaoOperacional: number
  melhorPerfilOperacao: string
}

export interface Prestador {
  id: string
  nome: string
  razaoSocial: string
  cpfCnpj: string
  rg: string
  dataNascimento: string
  contatos: ContatoPrestador[]
  endereco: EnderecoPrestador
  tipoVeiculo: string
  placaVeiculo: string
  eixos: number
  capacidadeKg: number
  capacidadeM3: number
  tipoCargaVeiculo: TipoCargaVeiculo
  disponibilidade: string
  regioesAtuacao: string[]
  origemCadastro: OrigemCadastro
  status: StatusPrestador
  score: ScorePrestador
  documentos: DocumentoPrestador[]
  onboarding: StatusOnboarding
  canalCaptacao: CanalCaptacao
  indicadoPor: string
  historico: HistoricoPrestador
  dataCadastro: string
  dataAtivacao: string
  ultimaAtividade: string
  observacoes: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface MatchOperacao {
  id: string
  operacaoId: string
  prestadorId: string
  prestadorNome: string
  prestadorVeiculo: string
  prestadorRegiao: string
  prestadorTelefone: string
  scoreMatch: number
  scoreDetalhes: Record<string, number>
  status: StatusMatch
  dataMatch: string
  dataContato: string
  dataResposta: string
  observacao: string
}

export interface ConversaWhatsApp {
  id: string
  prestadorId: string
  prestadorNome: string
  telefone: string
  ultimaMensagem: string
  status: 'ativa' | 'pendente' | 'finalizada'
  iaAtiva: boolean
  humanoAssumiu: boolean
  mensagens: MensagemWhatsApp[]
  createdAt: string
  updatedAt: string
}

export interface MensagemWhatsApp {
  id: string
  conversaId: string
  origem: 'ia' | 'humano' | 'prestador' | 'sistema'
  tipo: 'texto' | 'imagem' | 'documento' | 'template'
  mensagem: string
  payload: Record<string, unknown>
  lida: boolean
  createdAt: string
}

export interface AnaliseIA {
  id: string
  prestadorId: string
  scorePerfil: number
  scoreDocumentacao: number
  scoreComportamental: number
  scoreGeral: number
  pontosFortes: string[]
  pontosAtencao: string[]
  recomendacao: 'aprovado' | 'reprovado' | 'em_analise'
  confianca: number
  analiseDetalhada: string
  dataAnalise: string
  modeloUtilizado: string
}

export interface CrmInteracao {
  id: string
  prestadorId: string
  prestadorNome?: string
  tipo: 'ligacao' | 'whatsapp' | 'email' | 'reuniao' | 'visita' | 'observacao' | 'proposta_enviada' | 'retorno_prestador'
  titulo: string
  descricao: string
  data: string
  usuario: string
  proximaAcao: string
  dataProximoContato: string
  status: 'agendado' | 'realizado' | 'cancelado' | 'pendente'
  anexos: string[]
  createdAt: string
}

export interface TalentosCandidato {
  id: string
  nome: string
  telefone: string
  email: string
  tipoVeiculo: string
  regiao: string
  experiencia: string
  score: number
  status: StatusPrestador
  canalCaptacao: CanalCaptacao
  dataContato: string
  ultimoContato: string
  observacoes: string
  documentosAprovados: number
  statusDocumental: string
  disponibilidade: string
  scoreComprometimento?: number
  riscoDesistencia?: string
  tempoMedioRespostaHoras?: number | null
  classificacaoComprometimento?: string
}

export interface AutomacaoRegra {
  id: string
  nome: string
  tipo: TipoAutomacao
  trigger: Record<string, unknown>
  acao: Record<string, unknown>
  status: StatusAutomacao
  ultimaExecucao: string
  totalExecucoes: number
  createdAt: string
  updatedAt: string
}

export interface FiltrosOperacao {
  busca: string
  status: StatusOperacao[]
  prioridade: PrioridadeOperacao[]
  cliente: string[]
  regiao: string[]
  tipoVeiculo: string[]
  dataInicio: string
  dataFim: string
}

export interface FiltrosPrestador {
  busca: string
  status: StatusPrestador[]
  scoreMin: number
  scoreMax: number
  tipoVeiculo: string[]
  regiao: string[]
  origemCadastro: OrigemCadastro[]
  onboarding: StatusOnboarding[]
  canalCaptacao: CanalCaptacao[]
}

export interface MetricasRecrutamento {
  totalOperacoes: number
  operacoesAtivas: number
  totalPrestadores: number
  prestadoresAtivos: number
  prestadoresTriagem: number
  vagasAbertas: number
  vagasPreenchidas: number
  taxaPreenchimento: number
  taxaConversao: number
  scoreMedio: number
  faturamentoPrevisto: number
  lucroPrevisto: number
  candidatosNovos: number
  matchRealizados: number
  documentosPendentes: number
} 