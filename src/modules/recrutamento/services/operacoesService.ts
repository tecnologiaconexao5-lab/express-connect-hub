import { supabase } from '@/lib/supabase'
import type { Operacao, FinanceiroOperacao, MetaOperacao, FiltrosOperacao, StatusOperacao } from '../types/recrutamento'

function generateId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

const TABLE = 'recrutamento_operacoes'

function fromDB(row: Record<string, unknown>): Operacao {
  return {
    id: row.id as string,
    nome: (row.nome as string) ?? '',
    cliente: (row.cliente as string) ?? '',
    regiao: (row.regiao as string) ?? '',
    rotaOrigem: (row.rota_origem as string) ?? '',
    rotaDestino: (row.rota_destino as string) ?? '',
    tipoVeiculo: (row.tipo_veiculo as string) ?? '',
    tipoCarga: (row.tipo_carga as string ?? 'seco') as Operacao['tipoCarga'],
    metodoCarga: (row.metodo_carga as string ?? 'paletizado') as Operacao['metodoCarga'],
    temperatura: (row.temperatura as string) ?? '',
    pesoCarga: (row.peso_carga as string) ?? '',
    dimensoes: (row.dimensoes as string) ?? '',
    localCarregamento: (row.local_carregamento as string) ?? '',
    localDescarregamento: (row.local_descarregamento as string) ?? '',
    horarioCarregamento: (row.horario_carregamento as string) ?? '',
    horarioDescarregamento: (row.horario_descarregamento as string) ?? '',
    dataInicio: (row.data_inicio as string) ?? '',
    dataFim: (row.data_fim as string) ?? '',
    recurrencia: (row.recurrencia as string ?? 'unica') as Operacao['recurrencia'],
    frequencia: (row.frequencia as string ?? 'fixa') as Operacao['frequencia'],
    status: (row.status as string ?? 'aberta') as StatusOperacao,
    prioridade: (row.prioridade as string ?? 'media') as Operacao['prioridade'],
    observacoes: (row.observacoes as string) ?? '',
    financeiro: (row.financeiro as FinanceiroOperacao) ?? {} as FinanceiroOperacao,
    meta: (row.meta as MetaOperacao) ?? {} as MetaOperacao,
    historico: (row.historico as Operacao['historico']) ?? [],
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
    createdBy: (row.created_by as string) ?? 'admin',
  }
}

function toDB(op: Partial<Operacao>): Record<string, unknown> {
  const db: Record<string, unknown> = {}
  if (op.nome !== undefined) db.nome = op.nome
  if (op.cliente !== undefined) db.cliente = op.cliente
  if (op.regiao !== undefined) db.regiao = op.regiao
  if (op.rotaOrigem !== undefined) db.rota_origem = op.rotaOrigem
  if (op.rotaDestino !== undefined) db.rota_destino = op.rotaDestino
  if (op.tipoVeiculo !== undefined) db.tipo_veiculo = op.tipoVeiculo
  if (op.tipoCarga !== undefined) db.tipo_carga = op.tipoCarga
  if (op.metodoCarga !== undefined) db.metodo_carga = op.metodoCarga
  if (op.temperatura !== undefined) db.temperatura = op.temperatura
  if (op.pesoCarga !== undefined) db.peso_carga = op.pesoCarga
  if (op.dimensoes !== undefined) db.dimensoes = op.dimensoes
  if (op.localCarregamento !== undefined) db.local_carregamento = op.localCarregamento
  if (op.localDescarregamento !== undefined) db.local_descarregamento = op.localDescarregamento
  if (op.horarioCarregamento !== undefined) db.horario_carregamento = op.horarioCarregamento
  if (op.horarioDescarregamento !== undefined) db.horario_descarregamento = op.horarioDescarregamento
  if (op.dataInicio !== undefined) db.data_inicio = op.dataInicio
  if (op.dataFim !== undefined) db.data_fim = op.dataFim
  if (op.recurrencia !== undefined) db.recurrencia = op.recurrencia
  if (op.frequencia !== undefined) db.frequencia = op.frequencia
  if (op.status !== undefined) db.status = op.status
  if (op.prioridade !== undefined) db.prioridade = op.prioridade
  if (op.observacoes !== undefined) db.observacoes = op.observacoes
  if (op.financeiro !== undefined) db.financeiro = op.financeiro
  if (op.meta !== undefined) db.meta = op.meta
  if (op.historico !== undefined) db.historico = op.historico
  if (op.createdBy !== undefined) db.created_by = op.createdBy
  return db
}

// --- Business logic ---

function calcularFinanceiro(data: Partial<Operacao>): FinanceiroOperacao {
  const valorCliente = data.financeiro?.valorCliente ?? 0
  const valorPrestador = data.financeiro?.valorPrestador ?? 0
  const percentualImposto = data.financeiro?.percentualImposto ?? 0
  const percentualSeguro = data.financeiro?.percentualSeguro ?? 0
  const percentualPrestador = data.financeiro?.percentualPrestador ?? 0
  const margemTransportadora = data.financeiro?.margemTransportadora ?? 0
  const valorImposto = valorCliente * (percentualImposto / 100)
  const valorSeguro = valorCliente * (percentualSeguro / 100)
  const receitaLiquida = valorCliente - valorImposto
  const custoTotal = valorPrestador + valorSeguro
  const lucroUnitario = receitaLiquida - custoTotal
  const vagas = data.meta?.vagasTotais ?? 1
  const diarias = data.meta?.diariasPorVaga ?? 1
  const totalDiarias = vagas * diarias
  const lucroTotal = lucroUnitario * totalDiarias
  const margem = receitaLiquida > 0 ? (lucroUnitario / receitaLiquida) * 100 : 0

  return {
    valorCliente,
    valorPrestador,
    percentualImposto,
    percentualSeguro,
    percentualPrestador,
    margemTransportadora,
    valorImposto,
    valorSeguro,
    receitaLiquida,
    custoTotal,
    lucroUnitario,
    lucroTotal,
    margem,
    valorKmExcedente: data.financeiro?.valorKmExcedente ?? 0,
    franquiaKm: data.financeiro?.franquiaKm ?? 0,
    formaPagamento: data.financeiro?.formaPagamento ?? '',
    prazoPagamento: data.financeiro?.prazoPagamento ?? 30,
    dataPagamento: data.financeiro?.dataPagamento ?? '',
  }
}

function buildOperacao(data: Partial<Operacao>, now: string): Operacao {
  const financeiro = calcularFinanceiro(data)
  const vagasTotais = data.meta?.vagasTotais ?? 1
  const vagasPreenchidas = data.meta?.vagasPreenchidas ?? 0
  const diariasPorVaga = data.meta?.diariasPorVaga ?? 1

  return {
    id: generateId(),
    nome: data.nome ?? '',
    cliente: data.cliente ?? '',
    regiao: data.regiao ?? '',
    rotaOrigem: data.rotaOrigem ?? '',
    rotaDestino: data.rotaDestino ?? '',
    tipoVeiculo: data.tipoVeiculo ?? '',
    tipoCarga: data.tipoCarga ?? 'seco',
    metodoCarga: data.metodoCarga ?? 'paletizado',
    temperatura: data.temperatura ?? '',
    pesoCarga: data.pesoCarga ?? '',
    dimensoes: data.dimensoes ?? '',
    localCarregamento: data.localCarregamento ?? '',
    localDescarregamento: data.localDescarregamento ?? '',
    horarioCarregamento: data.horarioCarregamento ?? '',
    horarioDescarregamento: data.horarioDescarregamento ?? '',
    dataInicio: data.dataInicio ?? '',
    dataFim: data.dataFim ?? '',
    recurrencia: data.recurrencia ?? 'unica',
    frequencia: data.frequencia ?? 'fixa',
    status: data.status ?? 'aberta',
    prioridade: data.prioridade ?? 'media',
    observacoes: data.observacoes ?? '',
    financeiro,
    meta: {
      vagasTotais,
      vagasPreenchidas,
      vagasPendentes: vagasTotais - vagasPreenchidas,
      diariasPorVaga,
      totalDiarias: vagasTotais * diariasPorVaga,
      captados: data.meta?.captados ?? 0,
      aprovados: data.meta?.aprovados ?? 0,
      emAnalise: data.meta?.emAnalise ?? 0,
      recusados: data.meta?.recusados ?? 0,
    },
    historico: [{
      id: generateId(),
      acao: 'Criação',
      data: now,
      usuario: 'admin',
      observacao: 'Operação criada via sistema',
    }],
    createdAt: now,
    updatedAt: now,
    createdBy: 'admin',
  }
}

export const operacoesService = {
  async listar(filtros?: FiltrosOperacao): Promise<Operacao[]> {
    let query = supabase.from(TABLE).select('*')

    if (filtros) {
      if (filtros.status?.length) {
        query = query.in('status', filtros.status)
      }
      if (filtros.prioridade?.length) {
        query = query.in('prioridade', filtros.prioridade)
      }
      if (filtros.cliente?.length) {
        query = query.in('cliente', filtros.cliente)
      }
      if (filtros.busca) {
        const q = filtros.busca.toLowerCase()
        query = query.or(`nome.ilike.%${q}%,cliente.ilike.%${q}%,regiao.ilike.%${q}%`)
      }
    }

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) throw new Error(`Erro ao listar operações: ${error.message}`)

    return (data ?? []).map(fromDB)
  },

  async obter(id: string): Promise<Operacao | null> {
    try {
      const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single()
      if (error) throw error
      return data ? fromDB(data) : null
    } catch (err) {
      console.error('[operacoesService] obter() falhou:', err)
      throw err
    }
  },

  async criar(data: Partial<Operacao>): Promise<Operacao> {
    const now = new Date().toISOString()
    const operacao = buildOperacao(data, now)

    const dbData = toDB(operacao)
    const { data: inserted, error } = await supabase.from(TABLE).insert(dbData).select().single()
    if (error) throw new Error(`Erro ao criar operação no Supabase: ${error.message}`)
    const result = inserted ? fromDB(inserted) : operacao

    return result
  },

  async atualizar(id: string, data: Partial<Operacao>): Promise<Operacao> {
    const now = new Date().toISOString()

    const existing = await this.obter(id)
    if (!existing) throw new Error('Operação não encontrada')

    const dbData = toDB({
      ...data,
      financeiro: data.financeiro ? calcularFinanceiro(data) : existing.financeiro,
      updatedAt: now,
      historico: [
        ...existing.historico,
        { id: generateId(), acao: 'Atualização', data: now, usuario: 'admin', observacao: 'Dados atualizados' },
      ],
    })

    const { data: updated, error } = await supabase.from(TABLE).update(dbData).eq('id', id).select().single()
    if (error) throw new Error(`Erro ao atualizar operação: ${error.message}`)

    return updated ? fromDB(updated) : existing
  },

  async atualizarStatus(id: string, status: StatusOperacao): Promise<void> {
    const now = new Date().toISOString()

    const { data: existing, error: fetchError } = await supabase.from(TABLE).select('*').eq('id', id).single()
    if (fetchError) throw new Error(`Erro ao buscar operação: ${fetchError.message}`)

    const historico = (existing?.historico as Operacao['historico']) ?? []
    const entry = { id: generateId(), acao: `Status: ${status}`, data: now, usuario: 'admin', observacao: `Status alterado para ${status}` }

    const { error } = await supabase.from(TABLE).update({
      status,
      updated_at: now,
      historico: [...historico, entry],
    } as any).eq('id', id)
    if (error) throw new Error(`Erro ao atualizar status: ${error.message}`)
  },

  async remover(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (error) throw new Error(`Erro ao remover operação: ${error.message}`)
  },

  async duplicar(id: string): Promise<Operacao> {
    const op = await this.obter(id)
    if (!op) throw new Error('Operação não encontrada')
    return this.criar({
      ...op,
      nome: `${op.nome} (Cópia)`,
      status: 'rascunho',
      meta: { ...op.meta, captados: 0, aprovados: 0, vagasPreenchidas: 0 },
    })
  },

  obterMetricas(operacoes: Operacao[]) {
    const ativas = operacoes.filter(o => o.status === 'aberta' || o.status === 'em_captacao')
    return {
      total: operacoes.length,
      ativas: ativas.length,
      vagasAbertas: ativas.reduce((a, o) => a + o.meta.vagasTotais, 0),
      vagasPreenchidas: ativas.reduce((a, o) => a + o.meta.vagasPreenchidas, 0),
      totalCaptados: operacoes.reduce((a, o) => a + o.meta.captados, 0),
      totalAprovados: operacoes.reduce((a, o) => a + o.meta.aprovados, 0),
      faturamentoPrevisto: ativas.reduce((a, o) => a + o.financeiro.receitaLiquida * o.meta.vagasTotais * o.meta.diariasPorVaga, 0),
      lucroPrevisto: ativas.reduce((a, o) => a + o.financeiro.lucroTotal, 0),
    }
  },
}