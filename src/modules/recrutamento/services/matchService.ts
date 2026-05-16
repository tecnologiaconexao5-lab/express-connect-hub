import type { Operacao, Prestador, MatchOperacao, StatusMatch } from '../types/recrutamento'

const STORAGE_KEY = 'recrutamento_matches_v2'

function generateId(): string {
  return `match_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function getMatches(): MatchOperacao[] {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try { return JSON.parse(saved) } catch { /* ignore */ }
  }
  return []
}

function persist(data: MatchOperacao[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function calcularScoreCompatibilidade(operacao: Operacao, prestador: Prestador): { score: number; detalhes: Record<string, number> } {
  const detalhes: Record<string, number> = {}
  let pesoTotal = 0
  let scoreTotal = 0

  if (operacao.tipoVeiculo && prestador.tipoVeiculo) {
    const matchVeiculo = operacao.tipoVeiculo.toLowerCase() === prestador.tipoVeiculo.toLowerCase() ? 100 : 50
    detalhes.veiculo = matchVeiculo
    scoreTotal += matchVeiculo * 0.35
    pesoTotal += 0.35
  }

  if (operacao.regiao && prestador.regioesAtuacao.length > 0) {
    const matchRegiao = prestador.regioesAtuacao.some(r =>
      r.toLowerCase().includes(operacao.regiao.toLowerCase()) ||
      operacao.regiao.toLowerCase().includes(r.toLowerCase())
    ) ? 100 : 30
    detalhes.regiao = matchRegiao
    scoreTotal += matchRegiao * 0.30
    pesoTotal += 0.30
  }

  detalhes.scoreGeral = prestador.score.geral
  scoreTotal += prestador.score.geral * 0.20
  pesoTotal += 0.20

  const matchStatus = prestador.status === 'ativo' || prestador.status === 'qualificado' ? 100
    : prestador.status === 'em_triagem' || prestador.status === 'documentacao' ? 60 : 20
  detalhes.status = matchStatus
  scoreTotal += matchStatus * 0.15
  pesoTotal += 0.15

  const scoreFinal = pesoTotal > 0 ? Math.round(scoreTotal / pesoTotal) : 50
  return { score: Math.min(100, Math.max(0, scoreFinal)), detalhes }
}

export const matchService = {
  async gerarMatches(operacao: Operacao, prestadores: Prestador[]): Promise<MatchOperacao[]> {
    const matches = getMatches()
    const novos: MatchOperacao[] = []

    for (const prestador of prestadores) {
      if (matches.some(m => m.operacaoId === operacao.id && m.prestadorId === prestador.id)) continue

      const { score, detalhes } = calcularScoreCompatibilidade(operacao, prestador)
      if (score < 30) continue

      novos.push({
        id: generateId(),
        operacaoId: operacao.id,
        prestadorId: prestador.id,
        prestadorNome: prestador.nome,
        prestadorVeiculo: prestador.tipoVeiculo,
        prestadorRegiao: prestador.regioesAtuacao.join(', '),
        prestadorTelefone: prestador.contatos.find(c => c.tipo === 'whatsapp')?.valor ?? prestador.contatos[0]?.valor ?? '',
        scoreMatch: score,
        scoreDetalhes: detalhes,
        status: 'pendente',
        dataMatch: new Date().toISOString(),
        dataContato: '',
        dataResposta: '',
        observacao: '',
      })
    }

    persist([...novos, ...matches])
    return novos
  },

  async listarPorOperacao(operacaoId: string): Promise<MatchOperacao[]> {
    return getMatches().filter(m => m.operacaoId === operacaoId).sort((a, b) => b.scoreMatch - a.scoreMatch)
  },

  async listarPorPrestador(prestadorId: string): Promise<MatchOperacao[]> {
    return getMatches().filter(m => m.prestadorId === prestadorId)
  },

  async atualizarStatus(matchId: string, status: StatusMatch): Promise<void> {
    const matches = getMatches()
    const index = matches.findIndex(m => m.id === matchId)
    if (index === -1) throw new Error('Match não encontrado')

    matches[index] = {
      ...matches[index],
      status,
      dataContato: status === 'contatado' ? new Date().toISOString() : matches[index].dataContato,
      dataResposta: status === 'interessado' || status === 'recusado' ? new Date().toISOString() : matches[index].dataResposta,
    }
    persist(matches)
  },

  async executarMatchInteligente(operacao: Operacao, prestadores: Prestador[]): Promise<MatchOperacao[]> {
    return this.gerarMatches(operacao, prestadores)
  },
}