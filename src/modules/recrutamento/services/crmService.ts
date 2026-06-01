import { supabase } from '@/lib/supabase'
import type { CrmInteracao } from '../types/recrutamento'

const TABLE = 'crm_interacoes_prestadores'

function fromDB(row: any): CrmInteracao {
  return {
    id: row.id,
    prestadorId: row.prestador_id,
    prestadorNome: row.prestador_nome || '',
    tipo: row.tipo,
    titulo: row.titulo || '',
    descricao: row.descricao || '',
    data: row.data,
    usuario: row.usuario || '',
    proximaAcao: row.proxima_acao || '',
    dataProximoContato: row.data_proximo_contato || '',
    status: row.status || 'realizado',
    anexos: row.anexos || [],
    createdAt: row.created_at,
  }
}

function toDB(data: Partial<CrmInteracao>): Record<string, any> {
  const out: Record<string, any> = {}
  if (data.prestadorId !== undefined) out.prestador_id = data.prestadorId
  if (data.prestadorNome !== undefined) out.prestador_nome = data.prestadorNome
  if (data.tipo !== undefined) out.tipo = data.tipo
  if (data.titulo !== undefined) out.titulo = data.titulo
  if (data.descricao !== undefined) out.descricao = data.descricao
  if (data.data !== undefined) out.data = data.data
  if (data.usuario !== undefined) out.usuario = data.usuario
  if (data.proximaAcao !== undefined) out.proxima_acao = data.proximaAcao
  if (data.dataProximoContato !== undefined) out.data_proximo_contato = data.dataProximoContato
  if (data.status !== undefined) out.status = data.status
  if (data.anexos !== undefined) out.anexos = data.anexos
  return out
}

export const crmService = {
  async listar(): Promise<CrmInteracao[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('data', { ascending: false })
      .limit(200)

    if (error) {
      console.error('[CRM] Erro ao listar:', error)
      return []
    }
    return (data || []).map(fromDB)
  },

  async listarPorPrestador(prestadorId: string): Promise<CrmInteracao[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('prestador_id', prestadorId)
      .order('data', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[CRM] Erro ao listar por prestador:', error)
      return []
    }
    return (data || []).map(fromDB)
  },

  async criar(dados: Pick<CrmInteracao, 'prestadorId' | 'prestadorNome' | 'tipo' | 'titulo' | 'descricao' | 'data' | 'usuario' | 'proximaAcao' | 'dataProximoContato' | 'status' | 'anexos'>): Promise<CrmInteracao> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert([toDB(dados)])
      .select('*')
      .single()

    if (error) throw error
    return fromDB(data)
  },

  async atualizar(id: string, dados: Partial<CrmInteracao>): Promise<CrmInteracao | null> {
    const { data, error } = await supabase
      .from(TABLE)
      .update(toDB(dados))
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('[CRM] Erro ao atualizar:', error)
      return null
    }
    return fromDB(data)
  },

  async remover(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (error) console.error('[CRM] Erro ao remover:', error)
  },
}
