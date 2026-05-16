import { supabase } from '@/lib/supabase'
import type { Operacao, FinanceiroOperacao, MetaOperacao, FiltrosOperacao, StatusOperacao } from '../types/recrutamento'

const STORAGE_KEY = 'recrutamento_operacoes_v2'

function getMockOperacoes(): Operacao[] {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try { return JSON.parse(saved) } catch { /* ignore */ }
  }
  return []
}

function persistMock(ops: Operacao[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ops))
}

function generateId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function calcularFinanceiro(data: Partial<Operacao>): FinanceiroOperacao {
  const valorCliente = data.financeiro?.valorCliente ?? 0
  const valorPrestador = data.financeiro?.valorPrestador ?? 0
  const percentualImposto = data.financeiro?.percentualImposto ?? 0
  const percentualSeguro = data.financeiro?.percentualSeguro ?? 0
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
  }
}

export const operacoesService = {
  async listar(filtros?: FiltrosOperacao): Promise<Operacao[]> {
    let ops = getMockOperacoes()

    if (filtros) {
      if (filtros.busca) {
        const q = filtros.busca.toLowerCase()
        ops = ops.filter(o =>
          o.nome.toLowerCase().includes(q) ||
          o.cliente.toLowerCase().includes(q) ||
          o.regiao.toLowerCase().includes(q)
        )
      }
      if (filtros.status?.length) {
        ops = ops.filter(o => filtros.status!.includes(o.status))
      }
      if (filtros.prioridade?.length) {
        ops = ops.filter(o => filtros.prioridade!.includes(o.prioridade))
      }
      if (filtros.cliente?.length) {
        ops = ops.filter(o => filtros.cliente!.includes(o.cliente))
      }
    }

    return ops.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },

  async obter(id: string): Promise<Operacao | null> {
    const ops = getMockOperacoes()
    return ops.find(o => o.id === id) ?? null
  },

  async criar(data: Partial<Operacao>): Promise<Operacao> {
    const now = new Date().toISOString()
    const financeiro = calcularFinanceiro(data)

    const operacao: Operacao = {
      id: generateId(),
      nome: data.nome ?? '',
      cliente: data.cliente ?? '',
      regiao: data.regiao ?? '',
      rotaOrigem: data.rotaOrigem ?? '',
      rotaDestino: data.rotaDestino ?? '',
      tipoVeiculo: data.tipoVeiculo ?? '',
      tipoCarga: data.tipoCarga ?? 'seco',
      metodoCarga: data.metodoCarga ?? 'paletizado',
      pesoCarga: data.pesoCarga ?? '',
      dimensoes: data.dimensoes ?? '',
      localCarregamento: data.localCarregamento ?? '',
      localDescarregamento: data.localDescarregamento ?? '',
      horarioCarregamento: data.horarioCarregamento ?? '',
      horarioDescarregamento: data.horarioDescarregamento ?? '',
      dataInicio: data.dataInicio ?? '',
      dataFim: data.dataFim ?? '',
      recurrencia: data.recurrencia ?? 'unica',
      status: data.status ?? 'aberta',
      prioridade: data.prioridade ?? 'media',
      observacoes: data.observacoes ?? '',
      financeiro,
      meta: {
        vagasTotais: data.meta?.vagasTotais ?? 1,
        vagasPreenchidas: data.meta?.vagasPreenchidas ?? 0,
        vagasPendentes: (data.meta?.vagasTotais ?? 1) - (data.meta?.vagasPreenchidas ?? 0),
        diariasPorVaga: data.meta?.diariasPorVaga ?? 1,
        totalDiarias: (data.meta?.vagasTotais ?? 1) * (data.meta?.diariasPorVaga ?? 1),
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

    const ops = getMockOperacoes()
    ops.unshift(operacao)
    persistMock(ops)

    try {
      await supabase.from('operacoes').insert(operacao)
    } catch { /* fallback local */ }

    return operacao
  },

  async atualizar(id: string, data: Partial<Operacao>): Promise<Operacao> {
    const ops = getMockOperacoes()
    const index = ops.findIndex(o => o.id === id)
    if (index === -1) throw new Error('Operação não encontrada')

    const now = new Date().toISOString()
    const updated = {
      ...ops[index],
      ...data,
      financeiro: data.financeiro ? calcularFinanceiro(data) : ops[index].financeiro,
      updatedAt: now,
      historico: [
        ...ops[index].historico,
        { id: generateId(), acao: 'Atualização', data: now, usuario: 'admin', observacao: 'Dados atualizados' },
      ],
    }

    ops[index] = updated
    persistMock(ops)
    return updated
  },

  async atualizarStatus(id: string, status: StatusOperacao): Promise<void> {
    const ops = getMockOperacoes()
    const index = ops.findIndex(o => o.id === id)
    if (index === -1) throw new Error('Operação não encontrada')

    ops[index] = {
      ...ops[index],
      status,
      updatedAt: new Date().toISOString(),
      historico: [
        ...ops[index].historico,
        { id: generateId(), acao: `Status: ${status}`, data: new Date().toISOString(), usuario: 'admin', observacao: `Status alterado para ${status}` },
      ],
    }
    persistMock(ops)
  },

  async remover(id: string): Promise<void> {
    const ops = getMockOperacoes().filter(o => o.id !== id)
    persistMock(ops)
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
    const ativas = operacoes.filter(o => o.status === 'aberta' || o.status === 'em_andamento')
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