import { supabase } from '@/lib/supabase'
import type { AutomacaoRegra, TipoAutomacao, StatusAutomacao } from '../types/recrutamento'

const TABLE = 'recrutamento_automacoes'

function fromDB(row: any): AutomacaoRegra {
  return {
    id: row.id,
    nome: row.nome,
    tipo: row.tipo,
    trigger: row.trigger || {},
    acao: row.acao || {},
    status: row.status,
    ultimaExecucao: row.ultima_execucao || '',
    totalExecucoes: row.total_execucoes || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toDB(data: Partial<AutomacaoRegra>): Record<string, any> {
  const out: Record<string, any> = {}
  if (data.nome !== undefined) out.nome = data.nome
  if (data.tipo !== undefined) out.tipo = data.tipo
  if (data.trigger !== undefined) out.trigger = data.trigger
  if (data.acao !== undefined) out.acao = data.acao
  if (data.status !== undefined) out.status = data.status
  if (data.ultimaExecucao !== undefined) out.ultima_execucao = data.ultimaExecucao || null
  if (data.totalExecucoes !== undefined) out.total_execucoes = data.totalExecucoes
  return out
}

export const automacoesService = {
  async listar(): Promise<AutomacaoRegra[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      console.error('[Automacoes] Erro ao listar:', error)
      return []
    }
    return (data || []).map(fromDB)
  },

  async criar(data: Partial<AutomacaoRegra>): Promise<AutomacaoRegra> {
    const payload = toDB({
      nome: data.nome ?? 'Nova Automação',
      tipo: data.tipo ?? 'whatsapp',
      trigger: data.trigger ?? {},
      acao: data.acao ?? {},
      status: data.status ?? 'ativa',
    })

    const { data: row, error } = await supabase
      .from(TABLE)
      .insert([payload])
      .select('*')
      .single()

    if (error) throw error
    return fromDB(row)
  },

  async atualizar(id: string, data: Partial<AutomacaoRegra>): Promise<AutomacaoRegra> {
    const payload = toDB(data)

    const { data: row, error } = await supabase
      .from(TABLE)
      .update(payload)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      if (error.code === 'PGRST116') throw new Error('Automação não encontrada')
      throw error
    }
    return fromDB(row)
  },

  async atualizarStatus(id: string, status: StatusAutomacao): Promise<void> {
    await this.atualizar(id, { status })
  },

  async remover(id: string): Promise<void> {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', id)

    if (error) throw error
  },
}
