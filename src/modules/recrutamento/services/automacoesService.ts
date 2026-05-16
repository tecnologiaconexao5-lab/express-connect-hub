import type { AutomacaoRegra, TipoAutomacao, StatusAutomacao } from '../types/recrutamento'

const STORAGE_KEY = 'recrutamento_automacoes_v2'

function generateId(): string {
  return `auto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function getMock(): AutomacaoRegra[] {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try { return JSON.parse(saved) } catch { /* ignore */ }
  }
  return []
}

function persist(data: AutomacaoRegra[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export const automacoesService = {
  async listar(): Promise<AutomacaoRegra[]> {
    return getMock()
  },

  async criar(data: Partial<AutomacaoRegra>): Promise<AutomacaoRegra> {
    const now = new Date().toISOString()
    const regra: AutomacaoRegra = {
      id: generateId(),
      nome: data.nome ?? 'Nova Automação',
      tipo: data.tipo ?? 'whatsapp',
      trigger: data.trigger ?? {},
      acao: data.acao ?? {},
      status: data.status ?? 'ativa',
      ultimaExecucao: '',
      totalExecucoes: 0,
      createdAt: now,
      updatedAt: now,
    }
    const list = getMock()
    list.push(regra)
    persist(list)
    return regra
  },

  async atualizar(id: string, data: Partial<AutomacaoRegra>): Promise<AutomacaoRegra> {
    const list = getMock()
    const index = list.findIndex(r => r.id === id)
    if (index === -1) throw new Error('Automação não encontrada')
    list[index] = { ...list[index], ...data, updatedAt: new Date().toISOString() }
    persist(list)
    return list[index]
  },

  async atualizarStatus(id: string, status: StatusAutomacao): Promise<void> {
    await this.atualizar(id, { status })
  },

  async remover(id: string): Promise<void> {
    persist(getMock().filter(r => r.id !== id))
  },
}