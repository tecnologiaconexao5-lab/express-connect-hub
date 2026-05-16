import type { EnterpriseCandidate, PipelineStage, KanbanFilter, Prioridade, StatusDocumental, ValidadeCNH, TagType } from './enterpriseKanbanTypes'

const STORAGE_KEY = 'enterprise_kanban_candidates_v2'

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

const VEICULOS = [
  'VUC 3/4', 'VUC 7 Ton', 'Toco 12 Ton', 'Truck 23 Ton',
  'Carreta 2 Eixos', 'Carreta 3 Eixos', 'Bitrem', 'Rodotrem',
  'Van 1 Ton', 'Van 2 Ton', 'Caminhão Baú', 'Caminhão Sider',
  'Cegonha', 'Bau Traseiro', 'Frigorífico', 'Tanque',
]

const TAGS: TagType[] = [
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

let dataInicial: EnterpriseCandidate[] = []

function generateMockPhone(): string {
  const ddd = Math.floor(11 + Math.random() * 18)
  return `(${ddd}) 9${Math.floor(3000 + Math.random() * 7000)}-${Math.floor(1000 + Math.random() * 9000)}`
}

function generateMockCNHDate(): { validade: ValidadeCNH; data: string } {
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

function generateMockDocumentos(): { nome: string; status: 'ok' | 'pendente' | 'vencido' }[] {
  const docs = [
    { nome: 'CNH', status: Math.random() > 0.2 ? 'ok' as const : Math.random() > 0.5 ? 'pendente' as const : 'vencido' as const },
    { nome: 'CNPJ', status: Math.random() > 0.15 ? 'ok' as const : 'pendente' as const },
    { nome: 'Certidão Federal', status: Math.random() > 0.25 ? 'ok' as const : 'pendente' as const },
    { nome: 'CRLV', status: Math.random() > 0.2 ? 'ok' as const : 'pendente' as const },
    { nome: 'Seguro', status: Math.random() > 0.3 ? 'ok' as const : Math.random() > 0.5 ? 'pendente' as const : 'vencido' as const },
    { nome: 'ANTT', status: Math.random() > 0.4 ? 'ok' as const : 'pendente' as const },
    { nome: 'Curso MOPP', status: Math.random() > 0.5 ? 'ok' as const : 'pendente' as const },
  ]
  return docs
}

function getStatusDocumental(docs: { nome: string; status: string }[]): StatusDocumental {
  const ok = docs.filter(d => d.status === 'ok').length
  const total = docs.length
  if (ok === total) return 'completo'
  if (ok >= total / 2) return 'parcial'
  const vencidos = docs.filter(d => d.status === 'vencido').length
  if (vencidos > 0) return 'vencido'
  return 'pendente'
}

function getRandomTags(): TagType[] {
  const count = 1 + Math.floor(Math.random() * 3)
  const shuffled = [...TAGS].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count) as TagType[]
}

function getRandomPrioridade(): Prioridade {
  const r = Math.random()
  if (r < 0.5) return 'baixa'
  if (r < 0.8) return 'media'
  if (r < 0.95) return 'alta'
  return 'urgente'
}

function generateId(): string {
  return `ec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function buildMockData(): EnterpriseCandidate[] {
  const stages: PipelineStage[] = [
    'novo_cadastro', 'em_analise', 'documentacao_pendente', 'em_validacao',
    'entrevista', 'em_treinamento', 'aprovado', 'ativo', 'bloqueado', 'reprovado',
  ]

  return NOMES.map((nome, idx) => {
    const docs = generateMockDocumentos()
    const cnh = generateMockCNHDate()
    const dias = Math.floor(Math.random() * 60)
    const dataEntrada = new Date(Date.now() - dias * 86400000).toISOString()

    return {
      id: `ec_${idx}`,
      nome,
      foto: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(nome)}&backgroundColor=3b82f6,6366f1,8b5cf6,ec4899,10b981,14b8a6&backgroundType=gradientLinear&fontSize=40`,
      score: Math.floor(35 + Math.random() * 60),
      cidade: CIDADES[idx % CIDADES.length],
      uf: UFS[idx % UFS.length],
      veiculo: VEICULOS[idx % VEICULOS.length],
      placa: `ABC${String(1000 + Math.floor(Math.random() * 9000)).slice(0, 4)}`,
      statusDocumental: getStatusDocumental(docs),
      prioridade: getRandomPrioridade(),
      validadeCNH: cnh.validade,
      dataValidadeCNH: cnh.data,
      tags: getRandomTags(),
      observacoesIA: OBSERVACOES_IA[idx % OBSERVACOES_IA.length],
      telefone: generateMockPhone(),
      email: `${nome.toLowerCase().replace(/\s+/g, '.')}@email.com`,
      stage: stages[idx % stages.length],
      dataEntrada,
      dataAtualizacao: new Date(Date.now() - Math.floor(Math.random() * 7) * 86400000).toISOString(),
      documentos: docs,
    }
  })
}

function getStorage(): EnterpriseCandidate[] {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try { return JSON.parse(saved) } catch { }
  }
  if (dataInicial.length === 0) {
    dataInicial = buildMockData()
  }
  return dataInicial
}

function persist(data: EnterpriseCandidate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export const enterpriseKanbanService = {
  async listar(filtros?: KanbanFilter): Promise<EnterpriseCandidate[]> {
    let list = getStorage()

    if (filtros) {
      if (filtros.busca) {
        const q = filtros.busca.toLowerCase()
        list = list.filter(c =>
          c.nome.toLowerCase().includes(q) ||
          c.cidade.toLowerCase().includes(q) ||
          c.veiculo.toLowerCase().includes(q) ||
          c.placa.toLowerCase().includes(q) ||
          c.telefone.includes(q)
        )
      }
      if (filtros.scoreMin > 0) list = list.filter(c => c.score >= filtros.scoreMin)
      if (filtros.scoreMax < 100) list = list.filter(c => c.score <= filtros.scoreMax)
      if (filtros.prioridade.length) list = list.filter(c => filtros.prioridade.includes(c.prioridade))
      if (filtros.statusDocumental.length) list = list.filter(c => filtros.statusDocumental.includes(c.statusDocumental))
      if (filtros.validadeCNH.length) list = list.filter(c => filtros.validadeCNH.includes(c.validadeCNH))
      if (filtros.tags.length) list = list.filter(c => c.tags.some(t => filtros.tags.includes(t)))
      if (filtros.cidade) list = list.filter(c => c.cidade.toLowerCase().includes(filtros.cidade.toLowerCase()))
      if (filtros.veiculo) list = list.filter(c => c.veiculo.toLowerCase().includes(filtros.veiculo.toLowerCase()))
    }

    return list.sort((a, b) => new Date(b.dataAtualizacao).getTime() - new Date(a.dataAtualizacao).getTime())
  },

  async mover(id: string, novoStage: PipelineStage): Promise<void> {
    const list = getStorage()
    const idx = list.findIndex(c => c.id === id)
    if (idx === -1) return
    list[idx] = {
      ...list[idx],
      stage: novoStage,
      dataAtualizacao: new Date().toISOString(),
    }
    persist(list)
  },

  async adicionarObservacao(id: string, obs: string): Promise<void> {
    const list = getStorage()
    const idx = list.findIndex(c => c.id === id)
    if (idx === -1) return
    list[idx].observacoesIA = obs
    list[idx].dataAtualizacao = new Date().toISOString()
    persist(list)
  },

  async atualizar(id: string, data: Partial<EnterpriseCandidate>): Promise<void> {
    const list = getStorage()
    const idx = list.findIndex(c => c.id === id)
    if (idx === -1) return
    list[idx] = { ...list[idx], ...data, dataAtualizacao: new Date().toISOString() }
    persist(list)
  },

  async criar(candidate: Partial<EnterpriseCandidate>): Promise<EnterpriseCandidate> {
    const list = getStorage()
    const now = new Date().toISOString()
    const newCandidate: EnterpriseCandidate = {
      id: generateId(),
      nome: candidate.nome ?? 'Novo Candidato',
      foto: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(candidate.nome ?? 'Novo')}&backgroundColor=3b82f6&backgroundType=gradientLinear&fontSize=40`,
      score: candidate.score ?? 50,
      cidade: candidate.cidade ?? '',
      uf: candidate.uf ?? '',
      veiculo: candidate.veiculo ?? '',
      placa: candidate.placa ?? '',
      statusDocumental: candidate.statusDocumental ?? 'pendente',
      prioridade: candidate.prioridade ?? 'media',
      validadeCNH: candidate.validadeCNH ?? 'valida',
      dataValidadeCNH: candidate.dataValidadeCNH ?? '',
      tags: candidate.tags ?? [],
      observacoesIA: candidate.observacoesIA ?? '',
      telefone: candidate.telefone ?? '',
      email: candidate.email ?? '',
      stage: candidate.stage ?? 'novo_cadastro',
      dataEntrada: now,
      dataAtualizacao: now,
      documentos: candidate.documentos ?? [],
    }
    list.unshift(newCandidate)
    persist(list)
    return newCandidate
  },

  async getCandidateById(id: string): Promise<EnterpriseCandidate | null> {
    return getStorage().find(c => c.id === id) ?? null
  },

  async resetStorage(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY)
    dataInicial = []
  },

  async getStageCounts(): Promise<Record<PipelineStage, number>> {
    const list = getStorage()
    const counts: Record<string, number> = {}
    for (const c of list) {
      counts[c.stage] = (counts[c.stage] || 0) + 1
    }
    return counts as Record<PipelineStage, number>
  },
}
