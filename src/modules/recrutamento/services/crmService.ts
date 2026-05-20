import type { CrmInteracao } from '../types/recrutamento'

const STORAGE_KEY = 'prestadores_crm_interacoes'

function generateId(): string {
  return `crm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function getStorage(): CrmInteracao[] {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try { return JSON.parse(saved) } catch { }
  }
  return []
}

function persist(data: CrmInteracao[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function delay(ms = 200): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

export const crmService = {
  async listar(): Promise<CrmInteracao[]> {
    await delay()
    return getStorage().sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
  },

  async listarPorPrestador(prestadorId: string): Promise<CrmInteracao[]> {
    await delay()
    return getStorage()
      .filter(i => i.prestadorId === prestadorId)
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
  },

  async criar(data: Omit<CrmInteracao, 'id' | 'createdAt'>): Promise<CrmInteracao> {
    await delay()
    const interacao: CrmInteracao = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
    }
    const list = getStorage()
    list.push(interacao)
    persist(list)
    return interacao
  },

  async atualizar(id: string, data: Partial<CrmInteracao>): Promise<CrmInteracao | null> {
    await delay()
    const list = getStorage()
    const idx = list.findIndex(i => i.id === id)
    if (idx === -1) return null
    list[idx] = { ...list[idx], ...data }
    persist(list)
    return list[idx]
  },

  async remover(id: string): Promise<void> {
    await delay()
    const list = getStorage().filter(i => i.id !== id)
    persist(list)
  },
}
