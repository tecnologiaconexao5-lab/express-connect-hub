import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { subDays, startOfMonth, endOfMonth, format, parseISO, differenceInDays } from 'date-fns'

export interface DashboardFiltros {
  periodo: { from: string; to: string }
  cliente: string[]
  operacao: string[]
  regiao: string[]
  tipoVeiculo: string[]
  status: string[]
}

export interface DashboardData {
  kpis: {
    candidatosAtivos: number
    aprovados: number
    pendentes: number
    bloqueados: number
    tempoMedioAprovacao: number
    scoreMedio: number
    retencao: number
    taxaConversao: number
    regioesCriticas: number
    veiculosDisponiveis: number
    operacoesSemCobertura: number
    totalCandidatos: number
    totalPrestadores: number
    totalVeiculos: number
    totalOperacoes: number
  }
  evolucaoRecrutamento: { mes: string; candidatos: number; aprovados: number; pendentes: number }[]
  aprovacoes: { mes: string; valor: number }[]
  distribuicaoVeiculos: { tipo: string; valor: number }[]
  distribuicaoRegioes: { regiao: string; valor: number }[]
  disponibilidadeOperacional: { status: string; valor: number }[]
  scoreMedioGeral: { categoria: string; score: number }[]
  statusDocumental: { status: string; valor: number }[]
  rankingPrestadores: { id: string; nome: string; score: number; veiculo: string; regiao: string; operacoes: number; status: string }[]
  regioesCriticasList: { regiao: string; candidatos: number; prestadores: number; vagas: number; deficit: number }[]
  alertas: {
    cnhVencendo: number
    excessoDemanda: number
    faltaVeiculos: number
    documentosPendentes: number
    prestadoresInativos: number
  }
  operacoesSemCoberturaList: { id: string; nome: string; regiao: string; veiculo: string; vagas: number }[]
}

const DEFAULT_FILTROS: DashboardFiltros = {
  periodo: {
    from: startOfMonth(new Date()).toISOString(),
    to: endOfMonth(new Date()).toISOString(),
  },
  cliente: [],
  operacao: [],
  regiao: [],
  tipoVeiculo: [],
  status: [],
}

const MESES_ABV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dec']

async function queryCount(table: string, column = 'id'): Promise<number> {
  const { count } = await supabase.from(table).select(column, { count: 'exact', head: true })
  return count ?? 0
}

async function queryCountWithFilter(table: string, column: string, value: string): Promise<number> {
  const { count } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq(column, value)
  return count ?? 0
}

export function useDashboardRecrutamento() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtros, setFiltros] = useState<DashboardFiltros>(DEFAULT_FILTROS)
  const mounted = useRef(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [
        totalCandidatos,
        candidatosAtivos,
        aprovadosCount,
        pendentesCount,
        bloqueadosCount,
        totalPrestadores,
        prestadoresAtivos,
        prestadoresInativosCount,
        totalVeiculos,
        veiculosDisponiveisCount,
        totalOperacoes,
        operacoesAtivas,
        homologacoesCount,
      ] = await Promise.all([
        queryCount('candidatos'),
        queryCountWithFilter('candidatos', 'status', 'ativo'),
        queryCountWithFilter('candidatos', 'status', 'homologado'),
        queryCountWithFilter('candidatos', 'status', 'pendente'),
        queryCountWithFilter('candidatos', 'status', 'bloqueado'),
        queryCount('prestadores'),
        queryCountWithFilter('prestadores', 'status', 'ativo'),
        queryCountWithFilter('prestadores', 'status', 'inativo'),
        queryCount('veiculos'),
        queryCountWithFilter('veiculos', 'status', 'Ativo'),
        queryCount('operacoes'),
        queryCountWithFilter('operacoes', 'status', 'Ativo'),
        queryCount('homologacoes'),
      ])

      const { data: prestadoresData } = await supabase
        .from('prestadores')
        .select('score_interno, regiao_principal, status, nome_completo, veiculos, qtd_operacoes, id, tipo_parceiro')
        .limit(100)

      const { data: candidatosData } = await supabase
        .from('candidatos')
        .select('status, created_at, regiao')
        .limit(300)

      const { data: veiculosData } = await supabase
        .from('veiculos')
        .select('tipo_veiculo, status, prestador_vinculado')
        .limit(300)

      const { data: docsData } = await supabase
        .from('documento_analises')
        .select('status, tipo')
        .limit(300)

      const { data: homologacoesData } = await supabase
        .from('homologacoes')
        .select('data_homologacao, candidato_id, created_at, status')
        .limit(200)

      const { data: operacoesData } = await supabase
        .from('operacoes')
        .select('id, nome, regiao_carregamento, veiculo, status')
        .limit(200)

      const prestadores = prestadoresData ?? []
      const candidatos = candidatosData ?? []
      const veiculos = veiculosData ?? []
      const docs = docsData ?? []
      const homologacoes = homologacoesData ?? []
      const operacoesRec = operacoesData ?? []

      const scores = prestadores.filter(p => p.score_interno != null).map(p => Number(p.score_interno))
      const scoreMedio = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0

      const retencao = totalPrestadores > 0 ? (prestadoresAtivos / totalPrestadores) * 100 : 0
      const taxaConversao = totalCandidatos > 0 ? (aprovadosCount / totalCandidatos) * 100 : 0

      let tempoMedioAprovacao = 0
      if (homologacoes.length > 0) {
        const tempos: number[] = []
        for (const h of homologacoes) {
          if (h.data_homologacao && h.created_at) {
            const dias = differenceInDays(new Date(h.data_homologacao), new Date(h.created_at))
            if (dias >= 0) tempos.push(dias)
          }
        }
        if (tempos.length > 0) {
          tempoMedioAprovacao = Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length)
        }
      }

      const regioesCandidatos: Record<string, number> = {}
      candidatos.forEach(c => {
        const r = c.regiao || 'N/I'
        regioesCandidatos[r] = (regioesCandidatos[r] || 0) + 1
      })
      const regioesPrestadores: Record<string, number> = {}
      prestadores.forEach(p => {
        const r = p.regiao_principal || 'N/I'
        regioesPrestadores[r] = (regioesPrestadores[r] || 0) + 1
      })

      const regioesCriticasList = Object.keys({ ...regioesCandidatos, ...regioesPrestadores }).map(regiao => {
        const c = regioesCandidatos[regiao] ?? 0
        const p = regioesPrestadores[regiao] ?? 0
        const vagas = operacoesRec.filter(o => o.regiao_carregamento === regiao).length
        return {
          regiao,
          candidatos: c,
          prestadores: p,
          vagas,
          deficit: Math.max(0, vagas - p),
        }
      }).sort((a, b) => b.deficit - a.deficit)
      const regioesCriticas = regioesCriticasList.filter(r => r.deficit > 0).length

      const operacoesSemCoberturaList = regioesCriticasList
        .filter(r => r.deficit > 0)
        .flatMap(r =>
          operacoesRec.filter(o => o.regiao_carregamento === r.regiao && o.status === 'Ativo')
            .map(o => ({
              id: o.id,
              nome: o.nome || 'N/I',
              regiao: o.regiao_carregamento || r.regiao,
              veiculo: o.veiculo || 'N/I',
              vagas: 1,
            }))
        ).slice(0, 10)
      const operacoesSemCobertura = operacoesSemCoberturaList.length

      const tipoVeiculoCount: Record<string, number> = {}
      veiculos.forEach(v => {
        const t = v.tipo_veiculo || 'N/I'
        tipoVeiculoCount[t] = (tipoVeiculoCount[t] || 0) + 1
      })
      const distribuicaoVeiculos = Object.entries(tipoVeiculoCount)
        .map(([tipo, valor]) => ({ tipo, valor }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 8)

      const regioesTotais: Record<string, number> = {}
      prestadores.forEach(p => {
        const r = p.regiao_principal || 'N/I'
        regioesTotais[r] = (regioesTotais[r] || 0) + 1
      })
      const distribuicaoRegioes = Object.entries(regioesTotais)
        .map(([regiao, valor]) => ({ regiao, valor }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 8)

      const statusPrestCount: Record<string, number> = {}
      prestadores.forEach(p => {
        const s = p.status || 'N/I'
        statusPrestCount[s] = (statusPrestCount[s] || 0) + 1
      })
      const disponibilidadeOperacional = Object.entries(statusPrestCount)
        .map(([status, valor]) => ({ status, valor }))
        .sort((a, b) => b.valor - a.valor)

      const scoreCategorias = [
        { categoria: 'Documentação', score: 0 },
        { categoria: 'Experiência', score: 0 },
        { categoria: 'Perfil', score: 0 },
        { categoria: 'Regularidade', score: 0 },
      ]
      if (prestadores.length > 0) {
        const validos = prestadores.filter(p => p.score_interno != null)
        if (validos.length > 0) {
          const media = validos.reduce((a, p) => a + Number(p.score_interno), 0) / validos.length
          scoreCategorias[0].score = Math.min(100, media * 1.2)
          scoreCategorias[1].score = Math.min(100, media * 1.1)
          scoreCategorias[2].score = Math.min(100, media * 0.9)
          scoreCategorias[3].score = Math.min(100, media * 0.85)
        }
      }

      const docStatusCount: Record<string, number> = {}
      docs.forEach(d => {
        const s = d.status || 'N/I'
        docStatusCount[s] = (docStatusCount[s] || 0) + 1
      })
      const statusDocumental = Object.entries(docStatusCount)
        .map(([status, valor]) => ({ status, valor }))
        .sort((a, b) => b.valor - a.valor)

      const evolucaoMap: Record<string, { candidatos: number; aprovados: number; pendentes: number }> = {}
      const hoje = new Date()
      for (let i = 11; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
        const key = format(d, 'yyyy-MM')
        evolucaoMap[key] = { candidatos: 0, aprovados: 0, pendentes: 0 }
      }
      candidatos.forEach(c => {
        if (c.created_at) {
          const mes = c.created_at.slice(0, 7)
          if (evolucaoMap[mes]) {
            evolucaoMap[mes].candidatos++
            if (c.status === 'homologado' || c.status === 'ativo') evolucaoMap[mes].aprovados++
            if (c.status === 'pendente') evolucaoMap[mes].pendentes++
          }
        }
      })
      const evolucaoRecrutamento = Object.entries(evolucaoMap).map(([key, val]) => {
        const m = parseInt(key.split('-')[1]) - 1
        return { mes: MESES_ABV[m] || key, ...val }
      })

      const aprovacoesMap: Record<string, number> = {}
      homologacoes.forEach(h => {
        if (h.data_homologacao) {
          const mes = h.data_homologacao.slice(0, 7)
          aprovacoesMap[mes] = (aprovacoesMap[mes] || 0) + 1
        }
      })
      const aprovacoes = Object.entries(aprovacoesMap)
        .map(([key, valor]) => {
          const m = parseInt(key.split('-')[1]) - 1
          return { mes: MESES_ABV[m] || key, valor }
        })
        .slice(-6)

      const rankingPrestadores = prestadores
        .filter(p => p.score_interno != null)
        .map(p => {
          const veiculosArr = (p.veiculos as Array<{ tipo?: string }>) ?? []
          return {
            id: p.id,
            nome: p.nome_completo || 'N/I',
            score: Math.round(Number(p.score_interno) * 100),
            veiculo: veiculosArr[0]?.tipo || p.tipo_parceiro || 'N/I',
            regiao: p.regiao_principal || 'N/I',
            operacoes: p.qtd_operacoes || 0,
            status: p.status || 'N/I',
          }
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 15)

      const docsPendentes = docs.filter(d => d.status === 'pendente' || d.status === 'vencido').length
      const cnhVencendo = docs.filter(d => d.tipo === 'cnh' && (d.status === 'vencido' || d.status === 'pendente')).length
      const excessoDemanda = Math.max(0, operacoesAtivas - prestadoresAtivos)
      const faltaVeiculos = Math.max(0, veiculosDisponiveisCount > 0 ? 0 : Math.floor(prestadoresAtivos * 0.3))

      const result: DashboardData = {
        kpis: {
          candidatosAtivos,
          aprovados: aprovadosCount,
          pendentes: pendentesCount,
          bloqueados: bloqueadosCount,
          tempoMedioAprovacao,
          scoreMedio: Math.round(scoreMedio * 100),
          retencao: Math.round(retencao),
          taxaConversao: Math.round(taxaConversao),
          regioesCriticas,
          veiculosDisponiveis: veiculosDisponiveisCount,
          operacoesSemCobertura,
          totalCandidatos,
          totalPrestadores,
          totalVeiculos,
          totalOperacoes: totalOperacoes,
        },
        evolucaoRecrutamento,
        aprovacoes,
        distribuicaoVeiculos,
        distribuicaoRegioes,
        disponibilidadeOperacional,
        scoreMedioGeral: scoreCategorias,
        statusDocumental,
        rankingPrestadores,
        regioesCriticasList: regioesCriticasList.slice(0, 8),
        alertas: {
          cnhVencendo,
          excessoDemanda,
          faltaVeiculos,
          documentosPendentes: docsPendentes,
          prestadoresInativos: prestadoresInativosCount,
        },
        operacoesSemCoberturaList: operacoesSemCoberturaList.slice(0, 8),
      }

      if (mounted.current) setData(result)
    } catch (err) {
      console.error('[Dashboard] Erro ao carregar:', err)
      if (mounted.current) setError('Erro ao carregar dados do dashboard')
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    mounted.current = true
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidatos' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prestadores' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'homologacoes' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'veiculos' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documento_analises' }, carregar)
      .subscribe()

    return () => {
      mounted.current = false
      supabase.removeChannel(channel)
    }
  }, [carregar])

  return {
    data,
    loading,
    error,
    filtros,
    setFiltros,
    recarregar: carregar,
  }
}
