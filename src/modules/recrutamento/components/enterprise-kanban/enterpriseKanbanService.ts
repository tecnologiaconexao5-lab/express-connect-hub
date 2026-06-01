import { supabase } from '@/lib/supabase'
import type {
  EnterpriseCandidate, PipelineStage, KanbanFilter, HistoricoEvento,
  DocumentoCandidato, StatusDocumental, StatusOperacional, DisponibilidadeTipo,
  OnboardingItem, OnboardingStatus, ReservaContexto,
} from './enterpriseKanbanTypes'
import { DOCS_MINIMOS_OBRIGATORIOS, DOCS_MINIMOS_OPCIONAIS, ONBOARDING_ITENS } from './enterpriseKanbanTypes'
import { TIPOS_VEICULO } from '@/constants/tiposVeiculo'

const STORAGE_KEY = 'enterprise_kanban_candidates_v2'
const TABLE = 'recrutamento_candidatos'

const NOMES = [
  'Ana Clara Oliveira', 'Bruno Santos Lima', 'Carlos Eduardo Pereira',
  'Daniela Souza Costa', 'Eduardo Almeida Neto', 'Fernanda Lima Rocha',
  'Gabriel Barbosa Santos', 'Helena Martins Dias', 'Igor Costa Ribeiro',
  'Julia Oliveira Campos', 'Lucas Henrique Silva', 'Mariana Fernandes Souza',
  'Nelson Batista Alves', 'Patricia Gomes Correia', 'Rafael Torres Mendes',
  'Sabrina Castro Lima', 'Thiago Nogueira Pinto', 'Vanessa Oliveira Rios',
  'William Cardoso Braga', 'Yasmin Santos Teixeira', 'Adriano Melo Costa',
  'Beatriz Campos Rodrigues', 'Caio Vinicius Pereira', 'Débora Farias Lima',
]

const CIDADES = [
  'São Paulo', 'Guarulhos', 'Campinas', 'Santo André', 'Osasco',
  'Rio de Janeiro', 'Niterói', 'Duque de Caxias', 'Belo Horizonte',
  'Contagem', 'Uberlândia', 'Curitiba', 'Londrina', 'Porto Alegre',
  'Florianópolis', 'Joinville', 'Salvador', 'Recife', 'Fortaleza',
  'Brasília', 'Goiânia', 'Manaus', 'Belém', 'Sorocaba',
]

const UFS = ['SP', 'RJ', 'MG', 'PR', 'RS', 'SC', 'BA', 'PE', 'CE', 'DF', 'GO', 'AM', 'PA']

const VEICULOS = TIPOS_VEICULO

const TAGS: string[] = [
  'experiente', 'veiculo_proprio', 'indicado', 'recorrente',
  'disponivel_imediato', 'recomendado', 'risco', 'prioritario',
]

const OBSERVACOES_IA = [
  'Candidato com perfil alinhado às necessidades da operação. Recomenda-se agilizar análise documental.',
  'Pontos fortes: experiência em rotas noturnas. Atenção: documentação incompleta.',
  'Perfil compatível. Sugere-se validação de referências anteriores.',
  'Alta pontuação em avaliação comportamental. Baixo risco de turnover.',
  'Motorista experimental recomendado pelo time de frota. Priorizar entrevista.',
  'Documentação regularizada. Histórico de entregas sem ocorrências nos últimos 12 meses.',
  'Treinamento obrigatório: MOPP. CNH com validade próxima ao vencimento.',
  'Perfil analítico com experiência em operações logísticas integradas.',
  'Disponibilidade imediata para viagens longas. Veículo próprio em bom estado.',
  'Indicação do prestador Rafael Mendes. Score de confiança elevado.',
  'Candidato com restrições cadastrais. Necessário análise complementar.',
  'Perfil proativo com ótimo feedback em operações anteriores.',
  'Documentação pendente há 15 dias. Recomenda-se contato para regularização.',
  'Veículo adequado para operações urbanas. Experiência comprovada em entregas.',
]

function generateMockPhone(): string {
  const ddd = Math.floor(11 + Math.random() * 18)
  return `(${ddd}) 9${Math.floor(3000 + Math.random() * 7000)}-${Math.floor(1000 + Math.random() * 9000)}`
}

function generateMockCNHDate(): { validade: string; data: string } {
  const r = Math.random()
  if (r < 0.6) {
    const d = new Date()
    d.setFullYear(d.getFullYear() + 1 + Math.floor(Math.random() * 4))
    return { validade: 'valida', data: d.toISOString().slice(0, 10) }
  } else if (r < 0.8) {
    const d = new Date()
    d.setMonth(d.getMonth() + 1 + Math.floor(Math.random() * 2))
    return { validade: 'vencendo', data: d.toISOString().slice(0, 10) }
  } else {
    const d = new Date()
    d.setMonth(d.getMonth() - Math.floor(Math.random() * 12) - 1)
    return { validade: 'vencida', data: d.toISOString().slice(0, 10) }
  }
}

function gerarDataValidade(anosValidade: number, chanceVencido = 0.15): string {
  if (Math.random() < chanceVencido) {
    const d = new Date()
    d.setMonth(d.getMonth() - Math.floor(Math.random() * 6) - 1)
    return d.toISOString().slice(0, 10)
  }
  const d = new Date()
  d.setFullYear(d.getFullYear() + anosValidade + Math.floor(Math.random() * 2))
  return d.toISOString().slice(0, 10)
}

function generateMockDocumentos(): DocumentoCandidato[] {
  const docs: DocumentoCandidato[] = [
    { nome: 'CNH', status: 'ok', dataValidade: gerarDataValidade(3, 0.15) },
    { nome: 'CRLV', status: Math.random() > 0.15 ? 'ok' : 'pendente', dataValidade: Math.random() > 0.15 ? gerarDataValidade(1, 0.1) : undefined },
    { nome: 'Comprovante Residência', status: Math.random() > 0.2 ? 'ok' : 'pendente' },
    { nome: 'ANTT', status: Math.random() > 0.35 ? 'ok' : 'pendente', dataValidade: Math.random() > 0.35 ? gerarDataValidade(1, 0.1) : undefined },
    { nome: 'Foto Veículo', status: Math.random() > 0.25 ? 'ok' : 'pendente' },
  ]
  return docs
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
  if (stage === 'reprovado' || stage === 'bloqueado') return 'bloqueado'
  if (disponibilidade === 'indisponivel') return 'indisponivel'
  if (statusDocumental === 'bloqueado' || statusDocumental === 'vencido') return 'bloqueado'
  if (statusDocumental === 'pendente') return 'pendente'
  if (statusDocumental === 'parcial') return 'pendente'
  if (disponibilidade === 'parcial' && statusDocumental !== 'completo') return 'pendente'
  if (statusDocumental === 'completo' && (disponibilidade === 'imediata' || disponibilidade === 'parcial')) return 'apto'
  return 'pendente'
}

function getRandomTags(): string[] {
  const count = 1 + Math.floor(Math.random() * 3)
  const shuffled = [...TAGS].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

function getRandomPrioridade(): string {
  const r = Math.random()
  if (r < 0.5) return 'baixa'
  if (r < 0.8) return 'media'
  if (r < 0.95) return 'alta'
  return 'urgente'
}

function buildMockData(): EnterpriseCandidate[] {
  const stages: string[] = [
    'novo_cadastro', 'em_analise', 'documentacao_pendente', 'em_validacao',
    'entrevista', 'em_treinamento', 'aprovado', 'ativo', 'bloqueado', 'reprovado',
  ]

  return NOMES.map((nome, idx) => {
    const docs = generateMockDocumentos()
    const docCalc = calcularStatusDocumentalOperacional(docs)
    const tags = getRandomTags() as string[]
    const dispTipo = getDisponibilidadeTipo(tags)
    const onboarding = extrairOnboarding(tags)
    const stage = stages[idx % stages.length] as PipelineStage
    const statusOp = calcularStatusOperacional(docCalc.status, stage, dispTipo)
    const dias = Math.floor(Math.random() * 60)
    const dataEntrada = new Date(Date.now() - dias * 86400000).toISOString()
    const regioesPossiveis = [['SP', 'RJ', 'MG'], ['SP', 'PR', 'SC'], ['RJ', 'ES', 'BA'], ['SP', 'GO', 'DF'], ['RS', 'SC', 'PR']]

    return {
      id: `ec_${idx}`,
      nome,
      foto: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(nome)}&backgroundColor=3b82f6,6366f1,8b5cf6,ec4899,10b981,14b8a6&backgroundType=gradientLinear&fontSize=40`,
      score: Math.floor(35 + Math.random() * 60),
      cidade: CIDADES[idx % CIDADES.length],
      uf: UFS[idx % UFS.length],
      veiculo: VEICULOS[idx % VEICULOS.length].value,
      placa: `ABC${String(1000 + Math.floor(Math.random() * 9000)).slice(0, 4)}`,
      statusDocumental: docCalc.status,
      statusOperacional: statusOp,
      disponibilidadeTipo: dispTipo,
      prioridade: getRandomPrioridade() as any,
      validadeCNH: docCalc.validadeCNH as any,
      dataValidadeCNH: docCalc.dataValidadeCNH,
      tags: tags as any,
      observacoesIA: OBSERVACOES_IA[idx % OBSERVACOES_IA.length],
      telefone: generateMockPhone(),
      email: `${nome.toLowerCase().replace(/\s+/g, '.')}@email.com`,
      stage,
      dataEntrada,
      dataAtualizacao: new Date(Date.now() - Math.floor(Math.random() * 7) * 86400000).toISOString(),
      documentos: docs,
      prestadorId: undefined,
      historico: [{
        tipo: 'criado' as const,
        descricao: 'Candidato cadastrado no pipeline',
        data: dataEntrada,
      }],
      regioesAtuacao: regioesPossiveis[idx % regioesPossiveis.length],
      horariosDisponiveis: ['06:00-14:00', '08:00-18:00', '14:00-22:00', '22:00-06:00', '06:00-18:00'][idx % 5],
      diasDisponiveis: ['Seg-Sex', 'Seg-Sab', 'Dom-Dom', 'Seg-Dom', 'Seg-Sex'][idx % 5].split('-'),
      onboardingStatus: onboarding.status,
      onboardingProgress: onboarding.progress,
      onboardingChecklist: onboarding.checklist,
      reservaContexto: undefined,
    }
  })
}

function fromDB(row: any): EnterpriseCandidate {
  const docs: DocumentoCandidato[] = Array.isArray(row.documentos) ? row.documentos : []
  const docCalc = calcularStatusDocumentalOperacional(docs)
  const tags: string[] = Array.isArray(row.tags) ? row.tags : []
  const dispTipo = getDisponibilidadeTipo(tags)
  const onboarding = extrairOnboarding(tags)
  const stage = (row.stage ?? 'novo_cadastro') as PipelineStage
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
  }
}

function toDB(candidate: Partial<EnterpriseCandidate>): Record<string, unknown> {
  const ignored = ['id']
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
    ['regioesAtuacao', 'regioes_atuacao'],
    ['horariosDisponiveis', 'horarios_disponiveis'],
    ['diasDisponiveis', 'dias_disponiveis'],
    ['reservaContexto', 'reserva_contexto'],
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

  const list = getLocalData()
  const idx = list.findIndex(c => c.id === id)
  if (idx >= 0) {
    const hist = list[idx].historico ?? []
    list[idx] = { ...list[idx], historico: [...hist, evento], dataAtualizacao: now }
    persistLocal(list)
  }
}

function normalizeCandidate(c: any): EnterpriseCandidate {
  const tags: string[] = Array.isArray(c.tags) ? c.tags : []
  const docs: DocumentoCandidato[] = Array.isArray(c.documentos) ? c.documentos : []
  const docCalc = calcularStatusDocumentalOperacional(docs)
  const dispTipo = getDisponibilidadeTipo(tags)
  const onboarding = extrairOnboarding(tags)
  const stage = (c.stage ?? 'novo_cadastro') as PipelineStage

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
  }
}

function getLocalData(): EnterpriseCandidate[] {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try { return JSON.parse(saved).map(normalizeCandidate) } catch { }
  }
  return []
}

function persistLocal(data: EnterpriseCandidate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
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
  if (filtros.prioridade.length) filtered = filtered.filter(c => filtros.prioridade.includes(c.prioridade as any))
  if (filtros.statusDocumental.length) filtered = filtered.filter(c => filtros.statusDocumental.includes(c.statusDocumental as any))
  if (filtros.validadeCNH.length) filtered = filtered.filter(c => filtros.validadeCNH.includes(c.validadeCNH as any))
  if (filtros.tags.length) filtered = filtered.filter(c => c.tags.some(t => filtros.tags.includes(t)))
  if (filtros.statusOperacional.length) filtered = filtered.filter(c => filtros.statusOperacional.includes(c.statusOperacional as any))
  if (filtros.disponibilidade.length) filtered = filtered.filter(c => filtros.disponibilidade.includes(c.disponibilidadeTipo as any))
  if (filtros.cidade) filtered = filtered.filter(c => c.cidade.toLowerCase().includes(filtros.cidade.toLowerCase()))
  if (filtros.veiculo) filtered = filtered.filter(c => c.veiculo.toLowerCase().includes(filtros.veiculo.toLowerCase()))

  return filtered.sort((a, b) => new Date(b.dataAtualizacao).getTime() - new Date(a.dataAtualizacao).getTime())
}

export const enterpriseKanbanService = {
  async listar(filtros?: KanbanFilter): Promise<EnterpriseCandidate[]> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .order('data_atualizacao', { ascending: false })

      if (!error && data) {
        const candidates = data.map(fromDB)
        persistLocal(candidates)
        return filtros ? applyFilters(candidates, filtros) : candidates
      }
    } catch { }

    // Fallback: dados offline — usado apenas quando Supabase indisponivel
    console.warn('[Talentos] Supabase indisponivel — usando dados offline (localStorage).')
    const local = getLocalData()
    return filtros ? applyFilters(local, filtros) : local
  },

  async seedInitialData(): Promise<EnterpriseCandidate[]> {
    const mockData = buildMockData()
    try {
      const rows = mockData.map(c => toDB(c))
      const { data: inserted, error } = await supabase
        .from(TABLE)
        .insert(rows)
        .select()

      if (!error && inserted) {
        return inserted.map(fromDB)
      }
    } catch { }
    return mockData
  },

  async mover(id: string, novoStage: PipelineStage): Promise<void> {
    const now = new Date().toISOString()

    let stageAnterior: string | undefined
    const list = getLocalData()
    const idx = list.findIndex(c => c.id === id)
    if (idx >= 0) {
      stageAnterior = list[idx].stage
    }

    const { error: updateError } = await supabase
      .from(TABLE)
      .update({ stage: novoStage, data_atualizacao: now, updated_at: now })
      .eq('id', id)

    if (updateError) throw updateError

    if (idx >= 0) {
      const tipo = novoStage === 'bloqueado' ? 'bloqueado' as const
        : novoStage === 'aprovado' ? 'aprovado' as const
        : 'mudou_etapa' as const
      const descricao = `${STAGE_LABELS[stageAnterior ?? ''] ?? stageAnterior} → ${STAGE_LABELS[novoStage] ?? novoStage}`

      list[idx] = { ...list[idx], stage: novoStage, dataAtualizacao: now }
      persistLocal(list)

      await registrarEvento(id, {
        tipo,
        descricao,
        data: now,
        stageAnterior,
        stageNovo: novoStage,
      })
    }
  },

  async adicionarObservacao(id: string, obs: string): Promise<void> {
    const now = new Date().toISOString()
    const { error: obsError } = await supabase
      .from(TABLE)
      .update({ observacoes_ia: obs, data_atualizacao: now, updated_at: now })
      .eq('id', id)

    if (obsError) throw obsError

    const list = getLocalData()
    const idx = list.findIndex(c => c.id === id)
    if (idx >= 0) {
      list[idx] = { ...list[idx], observacoesIA: obs, dataAtualizacao: now }
      persistLocal(list)
    }

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

    const list = getLocalData()
    const idx = list.findIndex(c => c.id === id)
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...data, dataAtualizacao: now }
      persistLocal(list)
    }
  },

  async criar(candidate: Partial<EnterpriseCandidate>): Promise<EnterpriseCandidate> {
    const now = new Date().toISOString()
    const tags = candidate.tags ?? []
    const dispTipo = getDisponibilidadeTipo(tags)
    const onboarding = extrairOnboarding(tags as string[])
    const statusDoc = candidate.statusDocumental ?? 'pendente' as any
    const stage = candidate.stage ?? 'novo_cadastro'

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
    }

    const { data: inserted, error } = await supabase
      .from(TABLE)
      .insert({
        nome: newCandidate.nome,
        foto: newCandidate.foto,
        score: newCandidate.score,
        cidade: newCandidate.cidade,
        uf: newCandidate.uf,
        veiculo: newCandidate.veiculo,
        placa: newCandidate.placa,
        status_documental: newCandidate.statusDocumental,
        prioridade: newCandidate.prioridade,
        validade_cnh: newCandidate.validadeCNH,
        data_validade_cnh: newCandidate.dataValidadeCNH,
        tags: newCandidate.tags,
        observacoes_ia: newCandidate.observacoesIA,
        telefone: newCandidate.telefone,
        email: newCandidate.email,
        stage: newCandidate.stage,
        data_entrada: newCandidate.dataEntrada,
        data_atualizacao: newCandidate.dataAtualizacao,
        documentos: newCandidate.documentos,
        historico: newCandidate.historico,
        prestador_id: newCandidate.prestadorId ?? null,
      })
      .select()
      .single()

    if (error) throw error
    if (!inserted) throw new Error('Falha ao inserir candidato')

    const mapped = fromDB(inserted)
    const list = getLocalData()
    list.unshift(mapped)
    persistLocal(list)
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

    return getLocalData().find(c => c.id === id) ?? null
  },

  async resetStorage(): Promise<void> {
    try {
      await supabase.from(TABLE).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    } catch { }
    localStorage.removeItem(STORAGE_KEY)
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

    const list = getLocalData()
    const idx = list.findIndex(c => c.id === id)
    if (idx >= 0) {
      list[idx] = { ...list[idx], reservaContexto: contexto, dataAtualizacao: now }
      persistLocal(list)
    }

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
