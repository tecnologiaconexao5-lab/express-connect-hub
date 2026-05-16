import type { DocumentoPrestador, TipoDocumento, StatusDocumento } from '../types/recrutamento'

const STORAGE_KEY = 'recrutamento_docs_v2'

function generateId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function getDocs(): DocumentoPrestador[] {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try { return JSON.parse(saved) } catch { /* ignore */ }
  }
  return []
}

function persist(data: DocumentoPrestador[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export const documentosService = {
  async listarPorPrestador(prestadorId: string): Promise<DocumentoPrestador[]> {
    return getDocs().filter(d => d.prestadorId === prestadorId)
  },

  async listarPendentes(): Promise<DocumentoPrestador[]> {
    return getDocs().filter(d => d.status === 'pendente' || d.status === 'vencido')
  },

  async adicionar(data: Partial<DocumentoPrestador>): Promise<DocumentoPrestador> {
    const doc: DocumentoPrestador = {
      id: generateId(),
      prestadorId: data.prestadorId ?? '',
      tipo: data.tipo ?? 'cnh',
      status: 'pendente',
      url: data.url ?? '',
      nomeArquivo: data.nomeArquivo ?? '',
      dataEnvio: new Date().toISOString(),
      dataValidade: data.dataValidade ?? '',
      dataAprovacao: '',
      aprovadoPor: '',
      observacao: '',
      versao: 1,
    }

    const docs = getDocs()
    docs.push(doc)
    persist(docs)
    return doc
  },

  async atualizarStatus(documentoId: string, status: StatusDocumento, aprovadoPor?: string, observacao?: string): Promise<void> {
    const docs = getDocs()
    const index = docs.findIndex(d => d.id === documentoId)
    if (index === -1) throw new Error('Documento não encontrado')

    docs[index] = {
      ...docs[index],
      status,
      dataAprovacao: status === 'aprovado' || status === 'reprovado' ? new Date().toISOString() : docs[index].dataAprovacao,
      aprovadoPor: aprovadoPor ?? docs[index].aprovadoPor,
      observacao: observacao ?? docs[index].observacao,
    }
    persist(docs)
  },

  async remover(documentoId: string): Promise<void> {
    persist(getDocs().filter(d => d.id !== documentoId))
  },

  obterMetricas(documentos: DocumentoPrestador[]) {
    return {
      total: documentos.length,
      pendentes: documentos.filter(d => d.status === 'pendente').length,
      validando: documentos.filter(d => d.status === 'validando').length,
      aprovados: documentos.filter(d => d.status === 'aprovado').length,
      reprovados: documentos.filter(d => d.status === 'reprovado').length,
      vencidos: documentos.filter(d => d.status === 'vencido').length,
      taxaAprovacao: documentos.length > 0
        ? Math.round((documentos.filter(d => d.status === 'aprovado').length / documentos.length) * 100)
        : 0,
    }
  },
}