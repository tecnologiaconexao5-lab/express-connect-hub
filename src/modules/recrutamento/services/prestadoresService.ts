import type { Prestador, FiltrosPrestador, StatusPrestador, ScorePrestador } from '../types/recrutamento'
import { scoreService } from './scoreService'

const STORAGE_KEY = 'recrutamento_prestadores_v2'

function generateId(): string {
  return `pre_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function getMock(): Prestador[] {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try { return JSON.parse(saved) } catch { /* ignore */ }
  }
  return []
}

function persist(data: Prestador[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export const prestadoresService = {
  async listar(filtros?: FiltrosPrestador): Promise<Prestador[]> {
    let list = getMock()

    if (filtros) {
      if (filtros.busca) {
        const q = filtros.busca.toLowerCase()
        list = list.filter(p =>
          p.nome.toLowerCase().includes(q) ||
          p.cpfCnpj.includes(q) ||
          p.razaoSocial.toLowerCase().includes(q) ||
          p.contatos.some(c => c.valor.includes(q))
        )
      }
      if (filtros.status?.length) {
        list = list.filter(p => filtros.status!.includes(p.status))
      }
      if (filtros.tipoVeiculo?.length) {
        list = list.filter(p => filtros.tipoVeiculo!.includes(p.tipoVeiculo))
      }
      if (filtros.regiao?.length) {
        list = list.filter(p => p.regioesAtuacao.some(r => filtros.regiao!.includes(r)))
      }
      if (filtros.scoreMin !== undefined) {
        list = list.filter(p => p.score.geral >= filtros.scoreMin!)
      }
    }

    return list.sort((a, b) => b.score.geral - a.score.geral)
  },

  async obter(id: string): Promise<Prestador | null> {
    return getMock().find(p => p.id === id) ?? null
  },

  async criar(data: Partial<Prestador>): Promise<Prestador> {
    const now = new Date().toISOString()
    const prestador: Prestador = {
      id: generateId(),
      nome: data.nome ?? '',
      razaoSocial: data.razaoSocial ?? data.nome ?? '',
      cpfCnpj: data.cpfCnpj ?? '',
      rg: data.rg ?? '',
      dataNascimento: data.dataNascimento ?? '',
      contatos: data.contatos ?? [],
      endereco: data.endereco ?? { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' },
      tipoVeiculo: data.tipoVeiculo ?? '',
      placaVeiculo: data.placaVeiculo ?? '',
      eixos: data.eixos ?? 0,
      capacidadeKg: data.capacidadeKg ?? 0,
      capacidadeM3: data.capacidadeM3 ?? 0,
      regioesAtuacao: data.regioesAtuacao ?? [],
      status: data.status ?? 'potencial',
      score: data.score ?? await scoreService.calcularScore(data),
      documentos: data.documentos ?? [],
      onboarding: data.onboarding ?? 'nao_iniciado',
      canalCaptacao: data.canalCaptacao ?? 'site',
      indicadoPor: data.indicadoPor ?? '',
      dataCadastro: data.dataCadastro ?? now,
      dataAtivacao: data.dataAtivacao ?? '',
      ultimaAtividade: now,
      observacoes: data.observacoes ?? '',
      tags: data.tags ?? [],
      createdAt: now,
      updatedAt: now,
    }

    const list = getMock()
    list.unshift(prestador)
    persist(list)
    return prestador
  },

  async atualizar(id: string, data: Partial<Prestador>): Promise<Prestador> {
    const list = getMock()
    const index = list.findIndex(p => p.id === id)
    if (index === -1) throw new Error('Prestador não encontrado')

    list[index] = {
      ...list[index],
      ...data,
      updatedAt: new Date().toISOString(),
    }
    persist(list)
    return list[index]
  },

  async atualizarStatus(id: string, status: StatusPrestador): Promise<void> {
    await this.atualizar(id, { status })
  },

  async remover(id: string): Promise<void> {
    persist(getMock().filter(p => p.id !== id))
  },

  async recalcularScore(id: string): Promise<void> {
    const list = getMock()
    const index = list.findIndex(p => p.id === id)
    if (index === -1) throw new Error('Prestador não encontrado')
    list[index].score = await scoreService.calcularScore(list[index])
    list[index].updatedAt = new Date().toISOString()
    persist(list)
  },

  obterMetricas(prestadores: Prestador[]) {
    return {
      total: prestadores.length,
      ativos: prestadores.filter(p => p.status === 'ativo').length,
      triagem: prestadores.filter(p => p.status === 'em_triagem').length,
      documentacao: prestadores.filter(p => p.status === 'documentacao').length,
      qualificados: prestadores.filter(p => p.status === 'qualificado').length,
      scoreMedio: prestadores.reduce((a, p) => a + p.score.geral, 0) / (prestadores.length || 1),
      documentosPendentes: prestadores.reduce((a, p) => a + p.documentos.filter(d => d.status === 'pendente' || d.status === 'vencido').length, 0),
    }
  },

  async buscarMock(): Promise<Prestador[]> {
    return getMock()
  },
}