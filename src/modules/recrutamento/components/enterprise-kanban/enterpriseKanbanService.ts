import { supabase } from '@/lib/supabase'
import type {
  EnterpriseCandidate, PipelineStage, KanbanFilter, HistoricoEvento,
  DocumentoCandidato, StatusDocumental, StatusOperacional, DisponibilidadeTipo,
  OnboardingItem, OnboardingStatus, ReservaContexto,
} from './enterpriseKanbanTypes'
import { DOCS_MINIMOS_OBRIGATORIOS, DOCS_MINIMOS_OPCIONAIS, ONBOARDING_ITENS, STAGE_TRANSITIONS, normalizePipelineStage } from './enterpriseKanbanTypes'
const TABLE = 'recrutamento_candidatos'
const PRESTADORES_TABLE = 'prestadores'

const ORIGEM_APP = 'app_motorista'

const STATUS_APP_TO_STAGE: Record<string, PipelineStage> = {
  em_analise: 'em_analise_perfil',
  aprovado: 'aprovado',
  ativo: 'homologado_disponivel',
  bloqueado: 'reprovado',
  inativo: 'processo_encerrado',
  novo: 'novo_candidato',
  analise: 'em_analise_perfil',
}

function recalcularDocsValidade(docs: DocumentoCandidato[]): DocumentoCandidato[] {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return docs.map(doc => {
    if (doc.dataValidade) {
      const val = new Date(doc.dataValidade)
      val.setHours(0, 0, 0, 0)
      if (val < hoje) {
        return { ...doc, status: 'vencido' }
      }
    }
    return doc
  })
}

function calcularStatusDocumentalOperacional(docs: DocumentoCandidato[]): { status: StatusDocumental; validadeCNH: string; dataValidadeCNH: string } {
  const atualizados = recalcularDocsValidade(docs)
  const docsReais = atualizados.length > 0 ? atualizados : docs

  let validadeCNH = 'valida'
  let dataValidadeCNH = ''

  const todosDocs = [...DOCS_MINIMOS_OBRIGATORIOS, ...DOCS_MINIMOS_OPCIONAIS]

  for (const nome of todosDocs) {
    const doc = docsReais.find(d => d.nome === nome)
    if (!doc || doc.status === 'pendente') {
      if (nome === 'ANTT') continue
      const okCount = docsReais.filter(d => todosDocs.includes(d.nome as any) && d.status === 'ok').length
      if (okCount === 0) return { status: 'pendente', validadeCNH, dataValidadeCNH }
      return { status: 'parcial', validadeCNH, dataValidadeCNH }
    }
    if (doc.status === 'vencido') {
      if (doc.nome === 'CNH') {
        validadeCNH = 'vencida'
        dataValidadeCNH = doc.dataValidade ?? ''
        return { status: 'bloqueado', validadeCNH: 'vencida', dataValidadeCNH: doc.dataValidade ?? '' }
      }
      return { status: 'vencido', validadeCNH, dataValidadeCNH }
    }
    if (doc.nome === 'CNH' && doc.dataValidade) {
      dataValidadeCNH = doc.dataValidade
      const trintaDias = new Date()
      trintaDias.setDate(trintaDias.getDate() + 30)
      const val = new Date(doc.dataValidade)
      if (val < trintaDias) {
        validadeCNH = 'vencendo'
      }
    }
  }

  return { status: 'completo', validadeCNH, dataValidadeCNH }
}

function extrairOnboarding(tags: string[]): { checklist: OnboardingItem[]; status: OnboardingStatus; progress: number } {
  const itens = ONBOARDING_ITENS.map(nome => {
    const concluido = tags.includes(`onboarding_${nome.replace(/\s+/g, '_')}`)
    return { nome, concluido }
  })
  const concluidos = itens.filter(i => i.concluido).length
  const total = itens.length
  const progress = total > 0 ? Math.round((concluidos / total) * 100) : 0
  const status: OnboardingStatus = concluidos === 0 ? 'pendente'
    : concluidos === total ? 'concluido'
    : 'em_andamento'
  return { checklist: itens, status, progress }
}

function getDisponibilidadeTipo(tags: string[]): DisponibilidadeTipo {
  if (tags.includes('disponivel_imediato')) return 'imediata'
  if (tags.includes('risco')) return 'indisponivel'
  return 'parcial'
}

function calcularStatusOperacional(
  statusDocumental: StatusDocumental,
  stage: PipelineStage,
  disponibilidade: DisponibilidadeTipo,
): StatusOperacional {
  if (stage === 'reprovado' || stage === 'processo_encerrado') return 'bloqueado'
  if (disponibilidade === 'indisponivel') return 'indisponivel'
  if (statusDocumental === 'bloqueado' || statusDocumental === 'vencido') return 'bloqueado'
  if (statusDocumental === 'pendente') return 'pendente'
  if (statusDocumental === 'parcial') return 'pendente'
  if (disponibilidade === 'parcial' && statusDocumental !== 'completo') return 'pendente'
  if (statusDocumental === 'completo' && (disponibilidade === 'imediata' || disponibilidade === 'parcial')) return 'apto'
  return 'pendente'
}

function fromDB(row: any): EnterpriseCandidate {
  const docs: DocumentoCandidato[] = Array.isArray(row.documentos) ? row.documentos : []
  const docCalc = calcularStatusDocumentalOperacional(docs)
  const tags: string[] = Array.isArray(row.tags) ? row.tags : []
  const dispTipo = getDisponibilidadeTipo(tags)
  const onboarding = extrairOnboarding(tags)
  const stage = normalizePipelineStage(row.stage)
  const statusOp = calcularStatusOperacional(docCalc.status, stage, dispTipo)
  const regioes: string[] = Array.isArray(row.regioes_atuacao) ? row.regioes_atuacao
    : row.cidade ? [row.cidade, row.uf].filter(Boolean) : []

  return {
    id: row.id,
    nome: row.nome ?? '',
    foto: row.foto ?? '',
    score: row.score ?? 50,
    cidade: row.cidade ?? '',
    uf: row.uf ?? '',
    veiculo: row.veiculo ?? '',
    placa: row.placa ?? '',
    statusDocumental: docCalc.status,
    statusOperacional: statusOp,
    disponibilidadeTipo: dispTipo,
    prioridade: (row.prioridade ?? 'media') as any,
    validadeCNH: docCalc.validadeCNH as any,
    dataValidadeCNH: docCalc.dataValidadeCNH,
    tags: tags as any,
    observacoesIA: row.observacoes_ia ?? '',
    telefone: row.telefone ?? '',
    email: row.email ?? '',
    stage,
    dataEntrada: row.data_entrada ?? '',
    dataAtualizacao: row.data_atualizacao ?? '',
    documentos: docs,
    prestadorId: row.prestador_id ?? undefined,
    historico: Array.isArray(row.historico) ? row.historico : [],
    regioesAtuacao: regioes,
    horariosDisponiveis: row.horarios_disponiveis ?? '',
    diasDisponiveis: Array.isArray(row.dias_disponiveis) ? row.dias_disponiveis : [],
    onboardingStatus: onboarding.status,
    onboardingProgress: onboarding.progress,
    onboardingChecklist: onboarding.checklist,
    reservaContexto: row.reserva_contexto ?? undefined,
    scoreComprometimento: row.score_comprometimento ?? 0,
    classificacaoComprometimento: row.classificacao_comprometimento ?? '',
    riscoDesistencia: row.risco_desistencia ?? '',
    tempoMedioRespostaHoras: row.tempo_medio_resposta_horas ?? null,
    quantidadeCobrancas: row.quantidade_cobrancas ?? 0,
    confirmouInteresse: row.confirmou_interesse ?? false,
    dataConfirmacaoInteresse: row.data_confirmacao_interesse ?? null,
    confirmouPreInicio: row.confirmou_pre_inicio ?? false,
    dataConfirmacaoPreInicio: row.data_confirmacao_pre_inicio ?? null,
    compareceuPrimeiroDia: row.compareceu_primeiro_dia ?? false,
    completou30Dias: row.completou_30_dias ?? false,
    quantidadeReclamacoes: row.quantidade_reclamacoes ?? 0,
    possuiOutraOperacaoFixa: row.possui_outra_operacao_fixa ?? false,
    disponibilidadeRecrutamento: row.disponibilidade_recrutamento ?? '',
    historicoDesistencias: row.historico_desistencias ?? 0,
    etiquetasAutomaticas: Array.isArray(row.etiquetas_automaticas) ? row.etiquetas_automaticas : [],
    parecerIA: row.parecer_ia ?? '',
    principaisRiscos: Array.isArray(row.principais_riscos) ? row.principais_riscos : [],
    principaisPontosPositivos: Array.isArray(row.principais_pontos_positivos) ? row.principais_pontos_positivos : [],
    proximaAcaoSugerida: row.proxima_acao_sugerida ?? '',
    questionarioRespostas: row.questionario_respostas ?? null,
  }
}

function toDB(candidate: Partial<EnterpriseCandidate>): Record<string, unknown> {
  const map: [keyof EnterpriseCandidate, string][] = [
    ['nome', 'nome'],
    ['foto', 'foto'],
    ['score', 'score'],
    ['cidade', 'cidade'],
    ['uf', 'uf'],
    ['veiculo', 'veiculo'],
    ['placa', 'placa'],
    ['statusDocumental', 'status_documental'],
    ['prioridade', 'prioridade'],
    ['validadeCNH', 'validade_cnh'],
    ['dataValidadeCNH', 'data_validade_cnh'],
    ['tags', 'tags'],
    ['observacoesIA', 'observacoes_ia'],
    ['telefone', 'telefone'],
    ['email', 'email'],
    ['stage', 'stage'],
    ['dataEntrada', 'data_entrada'],
    ['dataAtualizacao', 'data_atualizacao'],
    ['documentos', 'documentos'],
    ['prestadorId', 'prestador_id'],
    ['historico', 'historico'],
    ['reservaContexto', 'reserva_contexto'],
    ['scoreComprometimento', 'score_comprometimento'],
    ['classificacaoComprometimento', 'classificacao_comprometimento'],
    ['riscoDesistencia', 'risco_desistencia'],
    ['tempoMedioRespostaHoras', 'tempo_medio_resposta_horas'],
    ['quantidadeCobrancas', 'quantidade_cobrancas'],
    ['confirmouInteresse', 'confirmou_interesse'],
    ['dataConfirmacaoInteresse', 'data_confirmacao_interesse'],
    ['confirmouPreInicio', 'confirmou_pre_inicio'],
    ['dataConfirmacaoPreInicio', 'data_confirmacao_pre_inicio'],
    ['compareceuPrimeiroDia', 'compareceu_primeiro_dia'],
    ['completou30Dias', 'completou_30_dias'],
    ['quantidadeReclamacoes', 'quantidade_reclamacoes'],
    ['possuiOutraOperacaoFixa', 'possui_outra_operacao_fixa'],
    ['disponibilidadeRecrutamento', 'disponibilidade_recrutamento'],
    ['historicoDesistencias', 'historico_desistencias'],
    ['etiquetasAutomaticas', 'etiquetas_automaticas'],
    ['parecerIA', 'parecer_ia'],
    ['principaisRiscos', 'principais_riscos'],
    ['principaisPontosPositivos', 'principais_pontos_positivos'],
    ['proximaAcaoSugerida', 'proxima_acao_sugerida'],
    ['questionarioRespostas', 'questionario_respostas'],
  ]
  const row: Record<string, unknown> = {}
  for (const [camel, snake] of map) {
    if (camel in candidate) {
      row[snake] = candidate[camel] ?? null
    }
  }
  return row
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

function verificarBloqueioPipeline(candidate: EnterpriseCandidate, novoStage: PipelineStage): string | null {
  // Bloqueio 1: Sem confirmação de interesse, não avança para Homologação.
  if (novoStage === 'em_homologacao' && !candidate.confirmouInteresse) {
    return 'É necessário confirmar o interesse do candidato antes de avançar para Homologação.'
  }

  // Bloqueio 2: Homologação exige entrevista/avaliação situacional concluída.
  if (
    novoStage === 'em_homologacao' &&
    !['em_entrevista', 'em_avaliacao_situacional', 'aprovado'].includes(candidate.stage)
  ) {
    return 'O candidato precisa concluir a Avaliação Situacional/Entrevista antes da Homologação.'
  }

  // Bloqueio 3: Sem confirmação de início, não avança para Homologado Disponível.
  if (novoStage === 'homologado_disponivel' && !candidate.confirmouPreInicio) {
    return 'É necessário confirmar o pré-início antes de tornar o candidato Homologado Disponível.'
  }

  return null
}

async function registrarEvento(id: string, evento: HistoricoEvento): Promise<void> {
  const now = new Date().toISOString()
  const { data: current, error: selectError } = await supabase
    .from(TABLE)
    .select('historico')
    .eq('id', id)
    .single()

  if (selectError) {
    console.error('[registrarEvento] Erro ao selecionar historico:', selectError)
    return
  }

  const historicoAtual = current?.historico ?? []
  const historico = Array.isArray(historicoAtual) ? [...historicoAtual, evento] : [evento]

  const { error: updateError } = await supabase
    .from(TABLE)
    .update({ historico, data_atualizacao: now, updated_at: now })
    .eq('id', id)

  if (updateError) {
    console.error('[registrarEvento] Erro ao salvar historico:', updateError)
  }
}

function normalizeCandidate(c: any): EnterpriseCandidate {
  const tags: string[] = Array.isArray(c.tags) ? c.tags : []
  const docs: DocumentoCandidato[] = Array.isArray(c.documentos) ? c.documentos : []
  const docCalc = calcularStatusDocumentalOperacional(docs)
  const dispTipo = getDisponibilidadeTipo(tags)
  const onboarding = extrairOnboarding(tags)
  const stage = normalizePipelineStage(c.stage)

  return {
    id: c.id ?? '',
    nome: c.nome ?? '',
    foto: c.foto ?? '',
    score: c.score ?? 50,
    cidade: c.cidade ?? '',
    uf: c.uf ?? '',
    veiculo: c.veiculo ?? '',
    placa: c.placa ?? '',
    statusDocumental: docCalc.status,
    statusOperacional: calcularStatusOperacional(docCalc.status, stage, dispTipo),
    disponibilidadeTipo: dispTipo,
    prioridade: (c.prioridade ?? 'media') as any,
    validadeCNH: docCalc.validadeCNH as any,
    dataValidadeCNH: docCalc.dataValidadeCNH,
    tags: tags as any,
    observacoesIA: c.observacoesIA ?? '',
    telefone: c.telefone ?? '',
    email: c.email ?? '',
    stage,
    dataEntrada: c.dataEntrada ?? '',
    dataAtualizacao: c.dataAtualizacao ?? '',
    documentos: docs,
    prestadorId: c.prestadorId ?? undefined,
    historico: Array.isArray(c.historico) ? c.historico : [],
    regioesAtuacao: Array.isArray(c.regioesAtuacao) ? c.regioesAtuacao : [],
    horariosDisponiveis: c.horariosDisponiveis ?? '',
    diasDisponiveis: Array.isArray(c.diasDisponiveis) ? c.diasDisponiveis : [],
    onboardingStatus: onboarding.status,
    onboardingProgress: onboarding.progress,
    onboardingChecklist: onboarding.checklist,
    reservaContexto: c.reservaContexto ?? undefined,
    scoreComprometimento: c.scoreComprometimento ?? 0,
    classificacaoComprometimento: c.classificacaoComprometimento ?? '',
    riscoDesistencia: c.riscoDesistencia ?? '',
    tempoMedioRespostaHoras: c.tempoMedioRespostaHoras ?? null,
    quantidadeCobrancas: c.quantidadeCobrancas ?? 0,
    confirmouInteresse: c.confirmouInteresse ?? false,
    dataConfirmacaoInteresse: c.dataConfirmacaoInteresse ?? null,
    confirmouPreInicio: c.confirmouPreInicio ?? false,
    dataConfirmacaoPreInicio: c.dataConfirmacaoPreInicio ?? null,
    compareceuPrimeiroDia: c.compareceuPrimeiroDia ?? false,
    completou30Dias: c.completou30Dias ?? false,
    quantidadeReclamacoes: c.quantidadeReclamacoes ?? 0,
    possuiOutraOperacaoFixa: c.possuiOutraOperacaoFixa ?? false,
    disponibilidadeRecrutamento: c.disponibilidadeRecrutamento ?? '',
    historicoDesistencias: c.historicoDesistencias ?? 0,
    etiquetasAutomaticas: Array.isArray(c.etiquetasAutomaticas) ? c.etiquetasAutomaticas : [],
    parecerIA: c.parecerIA ?? '',
    principaisRiscos: Array.isArray(c.principaisRiscos) ? c.principaisRiscos : [],
    principaisPontosPositivos: Array.isArray(c.principaisPontosPositivos) ? c.principaisPontosPositivos : [],
    proximaAcaoSugerida: c.proximaAcaoSugerida ?? '',
    questionarioRespostas: c.questionarioRespostas ?? null,
  }
}

function applyFilters(list: EnterpriseCandidate[], filtros?: KanbanFilter): EnterpriseCandidate[] {
  if (!filtros) return list
  let filtered = [...list]

  if (filtros.busca) {
    const q = filtros.busca.toLowerCase()
    filtered = filtered.filter(c =>
      c.nome.toLowerCase().includes(q) ||
      c.cidade.toLowerCase().includes(q) ||
      c.veiculo.toLowerCase().includes(q) ||
      c.placa.toLowerCase().includes(q) ||
      c.telefone.includes(q)
    )
  }
  if (filtros.scoreMin > 0) filtered = filtered.filter(c => c.score >= filtros.scoreMin)
  if (filtros.scoreMax < 100) filtered = filtered.filter(c => c.score <= filtros.scoreMax)
  if (filtros.prioridade?.length) filtered = filtered.filter(c => filtros.prioridade.includes(c.prioridade as any))
  if (filtros.statusDocumental?.length) filtered = filtered.filter(c => filtros.statusDocumental.includes(c.statusDocumental as any))
  if (filtros.validadeCNH?.length) filtered = filtered.filter(c => filtros.validadeCNH.includes(c.validadeCNH as any))
  if (filtros.tags?.length) filtered = filtered.filter(c => c.tags.some(t => filtros.tags.includes(t)))
  if (filtros.statusOperacional?.length) filtered = filtered.filter(c => filtros.statusOperacional.includes(c.statusOperacional as any))
  if (filtros.disponibilidade?.length) filtered = filtered.filter(c => filtros.disponibilidade.includes(c.disponibilidadeTipo as any))
  if (filtros.cidade) filtered = filtered.filter(c => c.cidade.toLowerCase().includes(filtros.cidade.toLowerCase()))
  if (filtros.veiculo) filtered = filtered.filter(c => c.veiculo.toLowerCase().includes(filtros.veiculo.toLowerCase()))

  return filtered.sort((a, b) => new Date(b.dataAtualizacao).getTime() - new Date(a.dataAtualizacao).getTime())
}

/**
 * AG-07J.1 — Busca prestadores criados pelo App (origem_cadastro='app_motorista')
 * e cria registros correspondentes em recrutamento_candidatos quando inexistentes.
 * Retorna a lista de candidatos App como EnterpriseCandidate[] prontos para o Kanban.
 *
 * NÃO cria segundo prestador. NÃO duplica pessoa.
 * O prestador_id vincula candidato ↔ prestador operacional.
 */
async function buscarECadastrarAppPrestadores(): Promise<EnterpriseCandidate[]> {
  try {
    const { data: appPrestadores, error: appError } = await supabase
      .from(PRESTADORES_TABLE)
      .select('id, nome_completo, cpf_cnpj, telefone, whatsapp, email, status, liberado_app, origem_cadastro, veiculos, endereco')
      .eq('origem_cadastro', ORIGEM_APP)
      .order('created_at', { ascending: false })

    if (appError || !appPrestadores || appPrestadores.length === 0) return []

    const { data: existentes } = await supabase
      .from(TABLE)
      .select('prestador_id')
      .not('prestador_id', 'is', null)

    const prestadorIdsExistentes = new Set(
      (existentes ?? []).map((r: any) => r.prestador_id).filter(Boolean)
    )

    const novos = appPrestadores.filter((p: any) => !prestadorIdsExistentes.has(p.id))
    if (novos.length > 0) {
      const now = new Date().toISOString()
      const rows = novos.map((p: any) => {
        const veiculoArr = Array.isArray(p.veiculos) ? p.veiculos : []
        const veiculo = veiculoArr[0] ?? {}
        const stage = STATUS_APP_TO_STAGE[p.status] ?? normalizePipelineStage(p.status)
        return toDB({
          nome: p.nome_completo ?? '',
          telefone: p.telefone ?? '',
          email: p.email ?? '',
          cidade: p.endereco?.cidade ?? '',
          uf: p.endereco?.estado ?? '',
          veiculo: veiculo.tipo ?? '',
          placa: veiculo.placa ?? '',
          stage,
          dataEntrada: now,
          dataAtualizacao: now,
          prestadorId: p.id,
          tags: ['veiculo_proprio', 'disponivel_imediato'] as any,
          historico: [{
            tipo: 'criado' as const,
            descricao: 'Prestador App — cadastro automático via bridge AG-07J.1',
            data: now,
          }],
        })
      })
      await supabase.from(TABLE).insert(rows)
    }

    const { data: todos } = await supabase
      .from(TABLE)
      .select('*')
      .not('prestador_id', 'is', null)
      .order('data_atualizacao', { ascending: false })

    return (todos ?? []).map(fromDB)
  } catch (err) {
    console.error('[buscarECadastrarAppPrestadores] Erro:', err)
    return []
  }
}

export const enterpriseKanbanService = {
  async listar(filtros?: KanbanFilter): Promise<EnterpriseCandidate[]> {
    try {
      await buscarECadastrarAppPrestadores()

      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .order('data_atualizacao', { ascending: false })

      if (!error && data) {
        const candidates = data.map(fromDB)
        return filtros ? applyFilters(candidates, filtros) : candidates
      }
    } catch { }

    return []
  },

  async mover(id: string, novoStage: PipelineStage, motivo?: string): Promise<{ error?: string }> {
    const now = new Date().toISOString()

    const candidate = await this.getCandidateById(id)
    if (!candidate) return { error: 'Candidato não encontrado' }

    if (candidate.stage === novoStage) return { error: 'Candidato já está neste estágio' }

    // Motivo é opcional (persistido no histórico JSONB quando informado).
    const motivoBloqueio = (motivo ?? '').trim()

    const allowedTransitions = STAGE_TRANSITIONS[candidate.stage] ?? []
    if (!allowedTransitions.includes(novoStage)) {
      return { error: `Transição de "${STAGE_LABELS[candidate.stage]}" para "${STAGE_LABELS[novoStage]}" não é permitida.` }
    }

    const bloqueio = verificarBloqueioPipeline(candidate, novoStage)
    if (bloqueio) return { error: bloqueio }

    const stageAnterior = candidate.stage

    const { error: updateError } = await supabase
      .from(TABLE)
      .update({ stage: novoStage, data_atualizacao: now, updated_at: now })
      .eq('id', id)

    if (updateError) return { error: updateError.message }

    const tipo = novoStage === 'reprovado' || novoStage === 'processo_encerrado'
      ? 'bloqueado' as const
      : novoStage === 'aprovado' || novoStage === 'homologado_disponivel' || novoStage === 'homologado_indisponivel'
        ? 'aprovado' as const
        : 'mudou_etapa' as const
    const descricao = `${STAGE_LABELS[stageAnterior] ?? stageAnterior} → ${STAGE_LABELS[novoStage] ?? novoStage}`

    await registrarEvento(id, {
      tipo,
      descricao,
      data: now,
      stageAnterior,
      stageNovo: novoStage,
      ...(motivoBloqueio ? { motivo: motivoBloqueio } : {}),
    })

    return {}
  },

  async adicionarObservacao(id: string, obs: string): Promise<void> {
    const now = new Date().toISOString()
    const { error: obsError } = await supabase
      .from(TABLE)
      .update({ observacoes_ia: obs, data_atualizacao: now, updated_at: now })
      .eq('id', id)

    if (obsError) throw obsError

    const descricao = obs.length > 80 ? obs.slice(0, 80) + '...' : obs
    await registrarEvento(id, {
      tipo: 'observacao_adicionada',
      descricao: `Observação: ${descricao}`,
      data: now,
    })
  },

  async atualizar(id: string, data: Partial<EnterpriseCandidate>): Promise<void> {
    const now = new Date().toISOString()
    const updateData = { ...toDB(data), data_atualizacao: now, updated_at: now }
    const { error: updateError } = await supabase
      .from(TABLE)
      .update(updateData)
      .eq('id', id)

    if (updateError) throw updateError
  },

  async criar(candidate: Partial<EnterpriseCandidate>): Promise<EnterpriseCandidate> {
    const now = new Date().toISOString()
    const tags = candidate.tags ?? []
    const dispTipo = getDisponibilidadeTipo(tags)
    const onboarding = extrairOnboarding(tags as string[])
    const statusDoc = candidate.statusDocumental ?? 'pendente' as any
    const stage = normalizePipelineStage(candidate.stage)

    const newCandidate: EnterpriseCandidate = {
      id: `ec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      nome: candidate.nome ?? 'Novo Candidato',
      foto: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(candidate.nome ?? 'Novo')}&backgroundColor=3b82f6&backgroundType=gradientLinear&fontSize=40`,
      score: candidate.score ?? 50,
      cidade: candidate.cidade ?? '',
      uf: candidate.uf ?? '',
      veiculo: candidate.veiculo ?? '',
      placa: candidate.placa ?? '',
      statusDocumental: statusDoc,
      statusOperacional: calcularStatusOperacional(statusDoc, stage, dispTipo),
      disponibilidadeTipo: dispTipo,
      prioridade: candidate.prioridade ?? 'media' as any,
      validadeCNH: candidate.validadeCNH ?? 'valida' as any,
      dataValidadeCNH: candidate.dataValidadeCNH ?? '',
      tags,
      observacoesIA: candidate.observacoesIA ?? '',
      telefone: candidate.telefone ?? '',
      email: candidate.email ?? '',
      stage,
      dataEntrada: candidate.dataEntrada ?? now,
      dataAtualizacao: now,
      documentos: candidate.documentos ?? [],
      prestadorId: candidate.prestadorId,
      historico: [{
        tipo: 'criado',
        descricao: 'Candidato cadastrado no pipeline',
        data: now,
      }],
      regioesAtuacao: candidate.regioesAtuacao ?? [],
      horariosDisponiveis: candidate.horariosDisponiveis ?? '',
      diasDisponiveis: candidate.diasDisponiveis ?? [],
      onboardingStatus: onboarding.status,
      onboardingProgress: onboarding.progress,
      onboardingChecklist: onboarding.checklist as any,
      reservaContexto: candidate.reservaContexto ?? undefined,
      scoreComprometimento: 0,
      classificacaoComprometimento: '',
      riscoDesistencia: 'Moderado',
      tempoMedioRespostaHoras: null,
      quantidadeCobrancas: 0,
      confirmouInteresse: false,
      dataConfirmacaoInteresse: null,
      confirmouPreInicio: false,
      dataConfirmacaoPreInicio: null,
      compareceuPrimeiroDia: false,
      completou30Dias: false,
      quantidadeReclamacoes: 0,
      possuiOutraOperacaoFixa: false,
      disponibilidadeRecrutamento: '',
      historicoDesistencias: 0,
      etiquetasAutomaticas: [],
      parecerIA: '',
      principaisRiscos: [],
      principaisPontosPositivos: [],
      proximaAcaoSugerida: 'Realizar primeiro contato com o candidato',
      questionarioRespostas: null,
    }

    const dbData = toDB(newCandidate)
    console.log('[criar] payload enviado:', JSON.stringify(dbData, null, 2))

    const { data: inserted, error } = await supabase
      .from(TABLE)
      .insert(dbData)
      .select()
      .single()

    if (error) {
      console.error('[criar] erro Supabase:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      })
      throw error
    }
    if (!inserted) throw new Error('Falha ao inserir candidato')

    const mapped = fromDB(inserted)
    return mapped
  },

  async getCandidateById(id: string): Promise<EnterpriseCandidate | null> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .eq('id', id)
        .single()

      if (!error && data) return fromDB(data)
    } catch { }

    return null
  },

  async resetStorage(): Promise<void> {
    try {
      await supabase.from(TABLE).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    } catch { }
  },

  async registrarEvento(id: string, evento: HistoricoEvento): Promise<void> {
    return registrarEvento(id, evento)
  },

  async salvarReservaContexto(id: string, contexto: ReservaContexto): Promise<void> {
    const now = new Date().toISOString()
    try {
      await supabase
        .from(TABLE)
        .update({ reserva_contexto: contexto, data_atualizacao: now, updated_at: now })
        .eq('id', id)
    } catch { }

    await registrarEvento(id, {
      tipo: 'observacao_adicionada',
      descricao: `Contexto da reserva atualizado: ${contexto.cliente ?? '—'} / ${contexto.operacao ?? '—'} (${contexto.prioridade})`,
      data: now,
    })
  },

  async listarPrestadoresAptos(filtros?: { regiao?: string; veiculo?: string; disponibilidade?: DisponibilidadeTipo }): Promise<EnterpriseCandidate[]> {
    const todos = await this.listar()
    let aptos = todos.filter(c =>
      c.statusOperacional === 'apto' &&
      c.disponibilidadeTipo !== 'indisponivel' &&
      c.statusDocumental === 'completo'
    )

    if (filtros?.regiao) {
      const q = filtros.regiao.toLowerCase()
      aptos = aptos.filter(c =>
        c.cidade.toLowerCase().includes(q) ||
        c.uf.toLowerCase().includes(q) ||
        c.regioesAtuacao.some(r => r.toLowerCase().includes(q))
      )
    }
    if (filtros?.veiculo) {
      const q = filtros.veiculo.toLowerCase()
      aptos = aptos.filter(c => c.veiculo.toLowerCase().includes(q))
    }
    if (filtros?.disponibilidade) {
      aptos = aptos.filter(c => c.disponibilidadeTipo === filtros.disponibilidade)
    }

    return aptos.sort((a, b) => b.score - a.score)
  },

  async getStageCounts(): Promise<Record<PipelineStage, number>> {
    const list = await this.listar()
    const counts: Record<string, number> = {}
    for (const c of list) {
      counts[c.stage] = (counts[c.stage] || 0) + 1
    }
    return counts as Record<PipelineStage, number>
  },
}
