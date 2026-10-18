import { supabase } from '@/lib/supabase'
import { scoreService } from './scoreService'
import type { Prestador, FiltrosPrestador, StatusPrestador, ScorePrestador } from '../types/recrutamento'

const STORAGE_KEY = 'recrutamento_prestadores_v2'
const TABLE = 'recrutamento_prestadores'

export interface DivergenciaSync {
  prestadorId: string
  prestadorNome: string
  telefone: string
  statusRecrutamento: string
  statusOperacional: string | null
  operacionalId: string | null
  tipo: 'ausente' | 'status_divergente' | 'status_ativo_indevido'
  descricao: string
}

function getLocalData(): Prestador[] {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try { return JSON.parse(saved) } catch { }
  }
  return []
}

function persistLocal(data: Prestador[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function fromDB(row: any): Prestador {
  return {
    id: row.id,
    nome: row.nome ?? '',
    razaoSocial: row.razao_social ?? row.nome ?? '',
    cpfCnpj: row.cpf_cnpj ?? '',
    rg: row.rg ?? '',
    dataNascimento: row.data_nascimento ?? '',
    contatos: Array.isArray(row.contatos) ? row.contatos : [],
    endereco: row.endereco && typeof row.endereco === 'object'
      ? row.endereco
      : { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' },
    tipoVeiculo: row.tipo_veiculo ?? '',
    placaVeiculo: row.placa_veiculo ?? '',
    eixos: row.eixos ?? 0,
    capacidadeKg: row.capacidade_kg ?? 0,
    capacidadeM3: row.capacidade_m3 ?? 0,
    tipoCargaVeiculo: row.tipo_carga_veiculo ?? 'seco',
    disponibilidade: row.disponibilidade ?? '',
    regioesAtuacao: Array.isArray(row.regioes_atuacao) ? row.regioes_atuacao : [],
    origemCadastro: row.origem_cadastro ?? 'site',
    status: row.status ?? 'novo',
    score: row.score && typeof row.score === 'object'
      ? row.score
      : { geral: 0, documentacao: 0, experiencia: 0, reputacao: 0, regularidade: 0, perfil: 0, tendencia: 0, ultimaAtualizacao: '', historico: [] },
    documentos: Array.isArray(row.documentos) ? row.documentos : [],
    onboarding: row.onboarding ?? 'nao_iniciado',
    canalCaptacao: row.canal_captacao ?? 'site',
    indicadoPor: row.indicado_por ?? '',
    historico: row.historico && typeof row.historico === 'object'
      ? row.historico
      : { jaCarregouConosco: false, quantidadeOperacoes: 0, ultimaOperacao: '', clientesAtendidos: [], mediaPontualidade: 0, mediaOcorrencias: 0, avaliacaoOperacional: 0, melhorPerfilOperacao: '' },
    dataCadastro: row.data_cadastro ?? '',
    dataAtivacao: row.data_ativacao ?? '',
    ultimaAtividade: row.ultima_atividade ?? '',
    observacoes: row.observacoes ?? '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  }
}

function mapField(camel: keyof Prestador): string {
  const map: Partial<Record<keyof Prestador, string>> = {
    nome: 'nome',
    razaoSocial: 'razao_social',
    cpfCnpj: 'cpf_cnpj',
    rg: 'rg',
    dataNascimento: 'data_nascimento',
    contatos: 'contatos',
    endereco: 'endereco',
    tipoVeiculo: 'tipo_veiculo',
    placaVeiculo: 'placa_veiculo',
    eixos: 'eixos',
    capacidadeKg: 'capacidade_kg',
    capacidadeM3: 'capacidade_m3',
    tipoCargaVeiculo: 'tipo_carga_veiculo',
    disponibilidade: 'disponibilidade',
    regioesAtuacao: 'regioes_atuacao',
    origemCadastro: 'origem_cadastro',
    status: 'status',
    score: 'score',
    documentos: 'documentos',
    onboarding: 'onboarding',
    canalCaptacao: 'canal_captacao',
    indicadoPor: 'indicado_por',
    historico: 'historico',
    dataCadastro: 'data_cadastro',
    dataAtivacao: 'data_ativacao',
    ultimaAtividade: 'ultima_atividade',
    observacoes: 'observacoes',
    tags: 'tags',
  }
  return map[camel] ?? camel
}

function toDB(data: Partial<Prestador>): Record<string, unknown> {
  const ignored = ['id', 'createdAt', 'updatedAt'] as (keyof Prestador)[]
  const row: Record<string, unknown> = {}
  for (const key of Object.keys(data) as (keyof Prestador)[]) {
    if (ignored.includes(key)) continue
    row[mapField(key)] = data[key] ?? null
  }
  return row
}

function applyFilters(list: Prestador[], filtros?: FiltrosPrestador): Prestador[] {
  if (!filtros) return list
  let filtered = [...list]

  if (filtros.busca) {
    const q = filtros.busca.toLowerCase()
    filtered = filtered.filter(p =>
      p.nome.toLowerCase().includes(q) ||
      p.cpfCnpj.includes(q) ||
      p.razaoSocial.toLowerCase().includes(q) ||
      p.contatos.some(c => c.valor.includes(q))
    )
  }
  if (filtros.status?.length) {
    filtered = filtered.filter(p => filtros.status!.includes(p.status))
  }
  if (filtros.tipoVeiculo?.length) {
    filtered = filtered.filter(p => filtros.tipoVeiculo!.includes(p.tipoVeiculo))
  }
  if (filtros.regiao?.length) {
    filtered = filtered.filter(p => p.regioesAtuacao.some(r => filtros.regiao!.includes(r)))
  }
  if (filtros.scoreMin !== undefined) {
    filtered = filtered.filter(p => p.score.geral >= filtros.scoreMin!)
  }

  return filtered.sort((a, b) => b.score.geral - a.score.geral)
}

function makeDefaultPrestador(data: Partial<Prestador>, score: ScorePrestador, now: string): Prestador {
  return {
    id: data.id ?? `pre_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
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
    tipoCargaVeiculo: data.tipoCargaVeiculo ?? 'seco',
    disponibilidade: data.disponibilidade ?? '',
    regioesAtuacao: data.regioesAtuacao ?? [],
    origemCadastro: data.origemCadastro ?? 'site',
    status: data.status ?? 'novo',
    score: data.score ?? score,
    documentos: data.documentos ?? [],
    onboarding: data.onboarding ?? 'nao_iniciado',
    canalCaptacao: data.canalCaptacao ?? 'site',
    indicadoPor: data.indicadoPor ?? '',
    historico: data.historico ?? {
      jaCarregouConosco: false,
      quantidadeOperacoes: 0,
      ultimaOperacao: '',
      clientesAtendidos: [],
      mediaPontualidade: 0,
      mediaOcorrencias: 0,
      avaliacaoOperacional: 0,
      melhorPerfilOperacao: '',
    },
    dataCadastro: data.dataCadastro ?? now,
    dataAtivacao: data.dataAtivacao ?? '',
    ultimaAtividade: now,
    observacoes: data.observacoes ?? '',
    tags: data.tags ?? [],
    createdAt: now,
    updatedAt: now,
  }
}

export const prestadoresService = {
  async listar(filtros?: FiltrosPrestador): Promise<Prestador[]> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && data) {
        const prestadores = data.map(fromDB)
        persistLocal(prestadores)
        return filtros ? applyFilters(prestadores, filtros) : prestadores
      }
    } catch { }

    const local = getLocalData()
    return filtros ? applyFilters(local, filtros) : local
  },

  async obter(id: string): Promise<Prestador | null> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .eq('id', id)
        .single()

      if (!error && data) return fromDB(data)
    } catch { }

    return getLocalData().find(p => p.id === id) ?? null
  },

  async criar(data: Partial<Prestador>): Promise<Prestador> {
    const now = new Date().toISOString()
    const score = await scoreService.calcularScore(data)

    const { data: inserted, error } = await supabase
      .from(TABLE)
      .insert({
        nome: data.nome ?? '',
        razao_social: data.razaoSocial ?? data.nome ?? '',
        cpf_cnpj: data.cpfCnpj ?? '',
        rg: data.rg ?? '',
        data_nascimento: data.dataNascimento ?? '',
        contatos: data.contatos ?? [],
        endereco: data.endereco ?? { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' },
        tipo_veiculo: data.tipoVeiculo ?? '',
        placa_veiculo: data.placaVeiculo ?? '',
        eixos: data.eixos ?? 0,
        capacidade_kg: data.capacidadeKg ?? 0,
        capacidade_m3: data.capacidadeM3 ?? 0,
        tipo_carga_veiculo: data.tipoCargaVeiculo ?? 'seco',
        disponibilidade: data.disponibilidade ?? '',
        regioes_atuacao: data.regioesAtuacao ?? [],
        origem_cadastro: data.origemCadastro ?? 'site',
        status: data.status ?? 'novo',
        score,
        documentos: data.documentos ?? [],
        onboarding: data.onboarding ?? 'nao_iniciado',
        canal_captacao: data.canalCaptacao ?? 'site',
        indicado_por: data.indicadoPor ?? '',
        historico: data.historico ?? {
          jaCarregouConosco: false, quantidadeOperacoes: 0, ultimaOperacao: '',
          clientesAtendidos: [], mediaPontualidade: 0, mediaOcorrencias: 0,
          avaliacaoOperacional: 0, melhorPerfilOperacao: '',
        },
        data_cadastro: data.dataCadastro ?? now,
        data_ativacao: data.dataAtivacao ?? '',
        ultima_atividade: now,
        observacoes: data.observacoes ?? '',
        tags: data.tags ?? [],
      })
      .select()
      .single()

    if (error) throw error
    if (!inserted) throw new Error('Falha ao criar prestador')

    const prestador = fromDB(inserted)
    const list = getLocalData()
    list.unshift(prestador)
    persistLocal(list)
    return prestador
  },

  async atualizar(id: string, data: Partial<Prestador>): Promise<Prestador> {
    const now = new Date().toISOString()

    const updateData = { ...toDB(data), updated_at: now }
    const { data: updated, error } = await supabase
      .from(TABLE)
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!updated) throw new Error('Prestador não encontrado')

    const prestador = fromDB(updated)
    const list = getLocalData()
    const index = list.findIndex(p => p.id === id)
    if (index >= 0) list[index] = prestador
    else list.unshift(prestador)
    persistLocal(list)

    await this.syncAtualizarOperacional(prestador)

    return prestador
  },

  async atualizarStatus(id: string, status: StatusPrestador): Promise<void> {
    await this.atualizar(id, { status })
  },

  async verificarVinculos(prestadorId: string): Promise<{
    podeRemover: boolean
    motivo: string
    vinculos: { tabela: string; count: number }[]
  }> {
    const tabelasParaVerificar = [
      { tabela: 'recrutamento_candidatos', coluna: 'prestador_id', label: 'Candidatos vinculados' },
    ]

    const vinculos: { tabela: string; count: number }[] = []

    for (const t of tabelasParaVerificar) {
      try {
        const { count, error } = await supabase
          .from(t.tabela)
          .select('id', { count: 'exact', head: true })
          .eq(t.coluna, prestadorId)

        if (!error && count && count > 0) {
          vinculos.push({ tabela: t.label, count })
        }
    } catch (err) {
      console.error('[Verificar Vinculos] Erro:', err)
    }
    }

    if (vinculos.length > 0) {
      const total = vinculos.reduce((a, v) => a + v.count, 0)
      const labels = vinculos.map(v => `${v.count} ${v.tabela}`).join(', ')
      return {
        podeRemover: false,
        motivo: `Prestador possui vínculos operacionais e não pode ser removido: ${labels}. Sugestão: use "Bloquear" em vez de excluir.`,
        vinculos,
      }
    }

    return { podeRemover: true, motivo: '', vinculos: [] }
  },

  async syncAtualizarOperacional(prestador: Prestador): Promise<void> {
    try {
      const origemVinculo = `recrutamento:${prestador.id}`

      let existentes = await supabase
        .from('prestadores')
        .select('id')
        .eq('origem_cadastro', origemVinculo)
        .limit(1)

      if (!existentes.data || existentes.data.length === 0) {
        const telefone = prestador.contatos.find(c => c.tipo === 'telefone' || c.tipo === 'whatsapp')?.valor
        if (!telefone) return

        existentes = await supabase
          .from('prestadores')
          .select('id')
          .or(`telefone.eq.${telefone},whatsapp.eq.${telefone}`)
          .limit(1)

        if (!existentes.data || existentes.data.length === 0) return
      }

      const idOperacional = existentes.data[0].id
      const telefone = prestador.contatos.find(c => c.tipo === 'telefone' || c.tipo === 'whatsapp')?.valor

      const statusMap: Record<string, string> = {
        agregado: 'ativo', aprovado: 'ativo', bloqueado: 'inativo',
        em_analise: 'analise', novo: 'analise', reserva: 'analise',
      }
      const novoStatus = statusMap[prestador.status] ?? 'analise'

      await supabase
        .from('prestadores')
        .update({
          nome_completo: prestador.nome,
          nome_fantasia: prestador.nome,
          telefone: telefone,
          whatsapp: telefone,
          tipo_parceiro: prestador.tipoVeiculo || 'carreteiro',
          status: novoStatus,
          // AG-07F — coerência status x liberado_app: aprovação operacional
          // (ativo) libera o App; bloqueio/inativação/análise revoga.
          liberado_app: novoStatus === 'ativo',
          endereco: {
            cidade: prestador.endereco?.cidade || '',
            estado: prestador.endereco?.uf || '',
          },
          veiculos: [{
            tipo: prestador.tipoVeiculo || '',
            placa: prestador.placaVeiculo || '',
          }],
        })
        .eq('id', idOperacional)
    } catch (err) {
      console.error('[Sync Atualizar Operacional] Erro:', err)
    }
  },

  async syncRemoverOperacional(prestador: Prestador): Promise<void> {
    try {
      const origemVinculo = `recrutamento:${prestador.id}`

      let existentes = await supabase
        .from('prestadores')
        .select('id')
        .eq('origem_cadastro', origemVinculo)
        .limit(1)

      if (!existentes.data || existentes.data.length === 0) {
        const telefone = prestador.contatos.find(c => c.tipo === 'telefone' || c.tipo === 'whatsapp')?.valor
        if (!telefone) return

        existentes = await supabase
          .from('prestadores')
          .select('id')
          .or(`telefone.eq.${telefone},whatsapp.eq.${telefone}`)
          .limit(1)

        if (!existentes.data || existentes.data.length === 0) return
      }

      const idOperacional = existentes.data[0].id

      await supabase
        .from('prestadores')
        .update({ status: 'inativo', liberado_app: false })
        .eq('id', idOperacional)
      } catch (err) {
          console.error('[Sync Remover Operacional] Erro:', err)
        }
  },

  async remover(id: string): Promise<void> {
    const { podeRemover, motivo } = await this.verificarVinculos(id)
    if (!podeRemover) throw new Error(motivo)

    const prestador = await this.obter(id)
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (error) throw error
    persistLocal(getLocalData().filter(p => p.id !== id))

    if (prestador) {
      await this.syncRemoverOperacional(prestador)
    }
  },

  async recalcularScore(id: string): Promise<void> {
    const prestador = await this.obter(id)
    if (!prestador) throw new Error('Prestador não encontrado')
    const score = await scoreService.calcularScore(prestador)
    await this.atualizar(id, { score })
  },

  obterMetricas(prestadores: Prestador[]) {
    return {
      total: prestadores.length,
      agregados: prestadores.filter(p => p.status === 'agregado').length,
      analise: prestadores.filter(p => p.status === 'em_analise').length,
      aprovados: prestadores.filter(p => p.status === 'aprovado').length,
      reserva: prestadores.filter(p => p.status === 'reserva').length,
      scoreMedio: prestadores.reduce((a, p) => a + p.score.geral, 0) / (prestadores.length || 1),
      documentosPendentes: prestadores.reduce(
        (a, p) => a + p.documentos.filter(d => d.status === 'pendente' || d.status === 'vencido').length, 0
      ),
    }
  },

  async auditarDivergencias(prestadores: Prestador[]): Promise<DivergenciaSync[]> {
    const relevantes = prestadores.filter(p =>
      p.status === 'agregado' || p.status === 'aprovado' || p.status === 'bloqueado'
    )
    if (relevantes.length === 0) return []

    const phonesRaw = relevantes
      .map(p => p.contatos.find(c => c.tipo === 'telefone' || c.tipo === 'whatsapp')?.valor)
      .filter((v): v is string => !!v)

    if (phonesRaw.length === 0) return []

    try {
      const { data: operacionais, error } = await supabase
        .from('prestadores')
        .select('id, telefone, whatsapp, status, cpf_cnpj, nome_completo, origem_cadastro')

      if (error) {
        console.error('[Auditoria Sync] Erro ao consultar public.prestadores:', error.message)
        return []
      }

      const limparTel = (t: string) => t?.replace(/\D/g, '') ?? ''

      const phoneIndex = new Map<string, (typeof operacionais)[number]>()
      const origemIndex = new Map<string, (typeof operacionais)[number]>()
      for (const op of operacionais ?? []) {
        const t = limparTel(op.telefone)
        const w = limparTel(op.whatsapp)
        if (t) phoneIndex.set(t, op)
        if (w && w !== t) phoneIndex.set(w, op)
        if (op.origem_cadastro) origemIndex.set(op.origem_cadastro, op)
      }

      const statusMap: Record<string, string> = {
        agregado: 'ativo', aprovado: 'ativo', bloqueado: 'inativo',
      }

      const divergencias: DivergenciaSync[] = []

      for (const p of relevantes) {
        const telContato = p.contatos.find(c => c.tipo === 'telefone' || c.tipo === 'whatsapp')?.valor ?? ''
        const telLimpo = limparTel(telContato)
        const origemVinculo = `recrutamento:${p.id}`
        const matched = origemIndex.get(origemVinculo)
          ?? (telLimpo ? phoneIndex.get(telLimpo) : undefined)
        const statusEsperado = statusMap[p.status] ?? 'analise'

        if (!matched) {
          divergencias.push({
            prestadorId: p.id,
            prestadorNome: p.nome,
            telefone: telContato,
            statusRecrutamento: p.status,
            statusOperacional: null,
            operacionalId: null,
            tipo: 'ausente',
            descricao: `Prestador "${p.nome}" com status "${p.status}" não possui registro correspondente em public.prestadores (telefone: ${telContato}).`,
          })
          continue
        }

        if (matched.status !== statusEsperado) {
          divergencias.push({
            prestadorId: p.id,
            prestadorNome: p.nome,
            telefone: telContato,
            statusRecrutamento: p.status,
            statusOperacional: matched.status,
            operacionalId: matched.id,
            tipo: 'status_divergente',
            descricao: `Prestador "${p.nome}" está "${p.status}" no recrutamento, mas "${matched.status}" no operacional (esperado: "${statusEsperado}").`,
          })
        }
      }

      return divergencias
    } catch (err) {
      console.error('[Auditoria Sync] Falha:', err)
      return []
    }
  },

  async corrigirDivergencia(divergencia: DivergenciaSync, prestador: Prestador): Promise<{ success: boolean; message: string }> {
    const telLimpo = divergencia.telefone.replace(/\D/g, '')
    if (!telLimpo) return { success: false, message: 'Telefone inválido para correção.' }

    try {
      if (divergencia.tipo === 'ausente') {
        const cpfUnico = `REC_${telLimpo.slice(0, 11)}`
        const statusOperacional = prestador.status === 'agregado' || prestador.status === 'aprovado' ? 'ativo'
          : prestador.status === 'bloqueado' ? 'inativo' : 'analise'
        const origemVinculo = `recrutamento:${divergencia.prestadorId}`

        let existente = await supabase
          .from('prestadores')
          .select('id')
          .eq('origem_cadastro', origemVinculo)
          .limit(1)

        if (existente.data && existente.data.length > 0) {
          await supabase
            .from('prestadores')
            .update({ status: statusOperacional, liberado_app: statusOperacional === 'ativo', origem_cadastro: origemVinculo })
            .eq('id', existente.data[0].id)
          return { success: true, message: `Registro existente encontrado por vínculo. Status atualizado para "${statusOperacional}".` }
        }

        existente = await supabase
          .from('prestadores')
          .select('id')
          .or(`telefone.eq.${divergencia.telefone},whatsapp.eq.${divergencia.telefone}`)
          .limit(1)

        if (!existente.error && existente.data && existente.data.length > 0) {
          await supabase
            .from('prestadores')
            .update({ status: statusOperacional, liberado_app: statusOperacional === 'ativo', origem_cadastro: origemVinculo })
            .eq('id', existente.data[0].id)
          return { success: true, message: `Registro existente encontrado por telefone. Status atualizado para "${statusOperacional}" e vínculo registrado.` }
        }

        const email = prestador.contatos.find(c => c.tipo === 'email')?.valor ?? null

        const { error: insertError } = await supabase
          .from('prestadores')
          .insert({
            nome_completo: prestador.nome,
            nome_fantasia: prestador.nome,
            cpf_cnpj: cpfUnico,
            tipo_parceiro: prestador.tipoVeiculo || 'carreteiro',
            status: statusOperacional,
            liberado_app: statusOperacional === 'ativo',
            telefone: divergencia.telefone,
            whatsapp: divergencia.telefone,
            email,
            origem_cadastro: origemVinculo,
            endereco: {
              cidade: prestador.endereco?.cidade || '',
              estado: prestador.endereco?.uf || '',
            },
            veiculos: [{
              tipo: prestador.tipoVeiculo || '',
              placa: prestador.placaVeiculo || '',
            }],
          })

        if (insertError) {
          console.error('[Corrigir Divergencia] Erro INSERT:', insertError.message)
          return { success: false, message: `Erro ao criar registro operacional: ${insertError.message}` }
        }

        return { success: true, message: `Registro operacional criado para "${prestador.nome}" com status "${statusOperacional}".` }
      }

      if (!divergencia.operacionalId) {
        return { success: false, message: 'ID operacional não localizado para correção.' }
      }

      const statusMap: Record<string, string> = {
        agregado: 'ativo', aprovado: 'ativo', bloqueado: 'inativo',
      }
      const novoStatus = statusMap[divergencia.statusRecrutamento] ?? 'analise'

      const { error: updateError } = await supabase
        .from('prestadores')
        .update({ status: novoStatus, liberado_app: novoStatus === 'ativo' })
        .eq('id', divergencia.operacionalId)

      if (updateError) {
        console.error('[Corrigir Divergencia] Erro UPDATE:', updateError.message)
        return { success: false, message: `Erro ao atualizar status: ${updateError.message}` }
      }

      return { success: true, message: `Status do prestador "${prestador.nome}" atualizado para "${novoStatus}".` }
    } catch (err) {
      console.error('[Corrigir Divergencia] Falha:', err)
      return { success: false, message: `Falha inesperada: ${err instanceof Error ? err.message : 'Erro desconhecido'}` }
    }
  },

  async buscarMock(): Promise<Prestador[]> {
    return this.listar()
  },
}
