import { describe, it, expect } from 'vitest'
import {
  calcularScoreComprometimento,
  classificarComprometimento,
  getCorClassificacao,
  calcularRiscoDesistencia,
  gerarEtiquetasAutomaticas,
  gerarParecerOperacional,
} from '@/services/recrutamento/recrutamentoScoreService'
import type { CandidatoScoreInput } from '@/services/recrutamento/recrutamentoScoreService'

const base: CandidatoScoreInput = {
  stage: 'contato_inicial',
  statusDocumental: '',
  quantidadeCobrancas: 0,
  compareceuPrimeiroDia: false,
  completou30Dias: false,
  quantidadeReclamacoes: 0,
  historicoDesistencias: 0,
  disponibilidadeRecrutamento: '',
  confirmouInteresse: false,
  confirmouPreInicio: false,
  tempoMedioRespostaHoras: null,
  questionarioRespostas: null,
}

describe('REC-06.2D.2 — Score de Comprometimento Real', () => {
  describe('calcularScoreComprometimento — score minimo/maximo', () => {
    it('score minimo com dados ruins (etapa final) = 5 (desistencia=0 + reclamacao=0 sobre 100)', () => {
      const input: CandidatoScoreInput = {
        ...base,
        stage: 'operacao_ativa',
        statusDocumental: 'pendente',
        quantidadeCobrancas: 5,
        confirmouInteresse: false,
        disponibilidadeRecrutamento: 'indisponivel',
        tempoMedioRespostaHoras: 200,
        compareceuPrimeiroDia: false,
        completou30Dias: false,
        historicoDesistencias: 5,
        quantidadeReclamacoes: 10,
      }
      expect(calcularScoreComprometimento(input)).toBe(5)
    })

    it('score = 100 quando todos os fatores aplicaveis estao maximos (etapa final)', () => {
      const input: CandidatoScoreInput = {
        ...base,
        stage: 'operacao_ativa',
        statusDocumental: 'completo',
        quantidadeCobrancas: 0,
        confirmouInteresse: true,
        disponibilidadeRecrutamento: 'integral',
        tempoMedioRespostaHoras: 5,
        compareceuPrimeiroDia: true,
        completou30Dias: true,
        historicoDesistencias: 0,
        quantidadeReclamacoes: 0,
      }
      expect(calcularScoreComprometimento(input)).toBe(100)
    })
  })

  describe('calcularScoreComprometimento — normalizacao por etapa', () => {
    it('contato_inicial: so desistencia + reclamacao aplicaveis (10 pts)', () => {
      const input: CandidatoScoreInput = { ...base, stage: 'contato_inicial' }
      const score = calcularScoreComprometimento(input)
      expect(score).toBe(100)
    })

    it('prospecção: mesmo que contato_inicial (10 pts)', () => {
      const input: CandidatoScoreInput = { ...base, stage: 'prospeccao' }
      const score = calcularScoreComprometimento(input)
      expect(score).toBe(100)
    })

    it('em_treinamento: 6 fatores aplicaveis (80 pts)', () => {
      const input: CandidatoScoreInput = {
        ...base,
        stage: 'em_treinamento',
        statusDocumental: 'completo',
        quantidadeCobrancas: 0,
        confirmouInteresse: true,
        disponibilidadeRecrutamento: 'integral',
        tempoMedioRespostaHoras: 10,
        compareceuPrimeiroDia: true,
        historicoDesistencias: 0,
        quantidadeReclamacoes: 0,
      }
      expect(calcularScoreComprometimento(input)).toBe(100)
    })

    it('aprovado: 7 fatores aplicaveis + 2 sempre ativos = 90/100', () => {
      const input: CandidatoScoreInput = {
        ...base,
        stage: 'aprovado',
        statusDocumental: 'completo',
        quantidadeCobrancas: 0,
        confirmouInteresse: true,
        disponibilidadeRecrutamento: 'integral',
        tempoMedioRespostaHoras: 10,
        compareceuPrimeiroDia: true,
        completou30Dias: false,
        historicoDesistencias: 0,
        quantidadeReclamacoes: 0,
      }
      const score = calcularScoreComprometimento(input)
      expect(score).toBe(90)
    })

    it('operacao_ativa: todos os 8 fatores aplicaveis (100 pts)', () => {
      const input: CandidatoScoreInput = {
        ...base,
        stage: 'operacao_ativa',
        statusDocumental: 'completo',
        quantidadeCobrancas: 0,
        confirmouInteresse: true,
        disponibilidadeRecrutamento: 'integral',
        tempoMedioRespostaHoras: 10,
        compareceuPrimeiroDia: true,
        completou30Dias: true,
        historicoDesistencias: 0,
        quantidadeReclamacoes: 0,
      }
      expect(calcularScoreComprometimento(input)).toBe(100)
    })
  })

  describe('calcularScoreComprometimento — cada fator individual', () => {
    it('documentacao: completo + sem cobranca = 25/25', () => {
      const input: CandidatoScoreInput = {
        ...base,
        stage: 'operacao_ativa',
        statusDocumental: 'completo',
        quantidadeCobrancas: 0,
      }
      const score = calcularScoreComprometimento(input)
      expect(score).toBeGreaterThanOrEqual(25)
    })

    it('documentacao: completo + com cobranca = 15/25', () => {
      const input: CandidatoScoreInput = {
        ...base,
        stage: 'operacao_ativa',
        statusDocumental: 'completo',
        quantidadeCobrancas: 3,
      }
      const score = calcularScoreComprometimento(input)
      expect(score).toBeGreaterThan(0)
    })

    it('documentacao: pendente = 5/25', () => {
      const input: CandidatoScoreInput = {
        ...base,
        stage: 'operacao_ativa',
        statusDocumental: 'pendente',
      }
      const score = calcularScoreComprometimento(input)
      expect(score).toBeGreaterThan(0)
    })

    it('confirmacao: confirmou = 15/15', () => {
      const input: CandidatoScoreInput = {
        ...base,
        stage: 'em_treinamento',
        confirmouInteresse: true,
      }
      const score = calcularScoreComprometimento(input)
      expect(score).toBeGreaterThanOrEqual(15)
    })

    it('disponibilidade: integral = 15/15', () => {
      const input: CandidatoScoreInput = {
        ...base,
        stage: 'em_treinamento',
        disponibilidadeRecrutamento: 'integral',
      }
      const score = calcularScoreComprometimento(input)
      expect(score).toBeGreaterThanOrEqual(15)
    })

    it('disponibilidade: parcial = 8/15', () => {
      const input: CandidatoScoreInput = {
        ...base,
        stage: 'em_treinamento',
        disponibilidadeRecrutamento: 'parcial',
      }
      const score = calcularScoreComprometimento(input)
      expect(score).toBeGreaterThan(0)
    })

    it('tempo: <=24h = 15/15', () => {
      const input: CandidatoScoreInput = {
        ...base,
        stage: 'em_treinamento',
        tempoMedioRespostaHoras: 12,
      }
      const score = calcularScoreComprometimento(input)
      expect(score).toBeGreaterThanOrEqual(15)
    })

    it('tempo: 25-48h = 10/15', () => {
      const input: CandidatoScoreInput = {
        ...base,
        stage: 'em_treinamento',
        tempoMedioRespostaHoras: 36,
      }
      const score = calcularScoreComprometimento(input)
      expect(score).toBeGreaterThan(0)
    })

    it('tempo: 49-72h = 5/15', () => {
      const input: CandidatoScoreInput = {
        ...base,
        stage: 'em_treinamento',
        tempoMedioRespostaHoras: 60,
      }
      const score = calcularScoreComprometimento(input)
      expect(score).toBeGreaterThan(0)
    })

    it('comparecimento: sim = 10/10', () => {
      const input: CandidatoScoreInput = {
        ...base,
        stage: 'em_treinamento',
        compareceuPrimeiroDia: true,
      }
      const score = calcularScoreComprometimento(input)
      expect(score).toBeGreaterThanOrEqual(10)
    })

    it('permanencia: completou30 = 10/10', () => {
      const input: CandidatoScoreInput = {
        ...base,
        stage: 'aprovado',
        completou30Dias: true,
      }
      const score = calcularScoreComprometimento(input)
      expect(score).toBeGreaterThanOrEqual(10)
    })

    it('desistencia: historico 0 = 5/5', () => {
      const input: CandidatoScoreInput = {
        ...base,
        stage: 'contato_inicial',
        historicoDesistencias: 0,
      }
      expect(calcularScoreComprometimento(input)).toBe(100)
    })

    it('desistencia: historico 3 = 0/5', () => {
      const input: CandidatoScoreInput = {
        ...base,
        stage: 'contato_inicial',
        historicoDesistencias: 3,
      }
      expect(calcularScoreComprometimento(input)).toBe(50)
    })

    it('reclamacoes: nenhuma = 5/5', () => {
      const input: CandidatoScoreInput = {
        ...base,
        stage: 'contato_inicial',
        quantidadeReclamacoes: 0,
      }
      expect(calcularScoreComprometimento(input)).toBe(100)
    })

    it('reclamacoes: 2 reclamacoes = 0/5', () => {
      const input: CandidatoScoreInput = {
        ...base,
        stage: 'contato_inicial',
        quantidadeReclamacoes: 2,
      }
      expect(calcularScoreComprometimento(input)).toBe(50)
    })
  })

  describe('calcularScoreComprometimento — dados ausentes', () => {
    it('todos os campos null/undefined = 100 (etapa inicial, 2 fatores sempre aplicaveis)', () => {
      const input: CandidatoScoreInput = { stage: 'contato_inicial' }
      expect(calcularScoreComprometimento(input)).toBe(100)
    })

    it('stage vazio = comporta como contato_inicial', () => {
      const input: CandidatoScoreInput = { ...base, stage: '' }
      expect(calcularScoreComprometimento(input)).toBe(100)
    })
  })

  describe('calcularScoreComprometimento — variação com fato reais', () => {
    it('score aumenta quando documento muda de pendente para completo', () => {
      const antes: CandidatoScoreInput = {
        ...base,
        stage: 'operacao_ativa',
        statusDocumental: 'pendente',
      }
      const depois: CandidatoScoreInput = {
        ...base,
        stage: 'operacao_ativa',
        statusDocumental: 'completo',
        quantidadeCobrancas: 0,
      }
      expect(calcularScoreComprometimento(depois)).toBeGreaterThan(calcularScoreComprometimento(antes))
    })

    it('score aumenta quando confirma interesse', () => {
      const antes: CandidatoScoreInput = {
        ...base,
        stage: 'em_treinamento',
        confirmouInteresse: false,
      }
      const depois: CandidatoScoreInput = {
        ...base,
        stage: 'em_treinamento',
        confirmouInteresse: true,
      }
      expect(calcularScoreComprometimento(depois)).toBeGreaterThan(calcularScoreComprometimento(antes))
    })

    it('score cai quando tempo de resposta piora', () => {
      const antes: CandidatoScoreInput = {
        ...base,
        stage: 'em_treinamento',
        tempoMedioRespostaHoras: 10,
      }
      const depois: CandidatoScoreInput = {
        ...base,
        stage: 'em_treinamento',
        tempoMedioRespostaHoras: 100,
      }
      expect(calcularScoreComprometimento(depois)).toBeLessThan(calcularScoreComprometimento(antes))
    })
  })

  describe('classificarComprometimento — faixas', () => {
    it('80-100 = Excelente', () => {
      expect(classificarComprometimento(100)).toBe('Excelente')
      expect(classificarComprometimento(80)).toBe('Excelente')
      expect(classificarComprometimento(90)).toBe('Excelente')
    })

    it('65-79 = Bom', () => {
      expect(classificarComprometimento(79)).toBe('Bom')
      expect(classificarComprometimento(65)).toBe('Bom')
      expect(classificarComprometimento(70)).toBe('Bom')
    })

    it('50-64 = Regular', () => {
      expect(classificarComprometimento(64)).toBe('Regular')
      expect(classificarComprometimento(50)).toBe('Regular')
      expect(classificarComprometimento(55)).toBe('Regular')
    })

    it('30-49 = Baixo', () => {
      expect(classificarComprometimento(49)).toBe('Baixo')
      expect(classificarComprometimento(30)).toBe('Baixo')
      expect(classificarComprometimento(40)).toBe('Baixo')
    })

    it('0-29 = Crítico', () => {
      expect(classificarComprometimento(29)).toBe('Crítico')
      expect(classificarComprometimento(0)).toBe('Crítico')
      expect(classificarComprometimento(15)).toBe('Crítico')
    })
  })

  describe('getCorClassificacao — cores', () => {
    it('Excelente = emerald', () => {
      expect(getCorClassificacao('Excelente')).toContain('emerald')
    })

    it('Bom = blue', () => {
      expect(getCorClassificacao('Bom')).toContain('blue')
    })

    it('Regular = amber', () => {
      expect(getCorClassificacao('Regular')).toContain('amber')
    })

    it('Baixo = orange', () => {
      expect(getCorClassificacao('Baixo')).toContain('orange')
    })

    it('Crítico = rose', () => {
      expect(getCorClassificacao('Crítico')).toContain('rose')
    })

    it('desconhecido = muted', () => {
      expect(getCorClassificacao('qualquer')).toContain('muted')
    })
  })

  describe('calcularRiscoDesistencia', () => {
    it('historico 0 = Baixo', () => {
      expect(calcularRiscoDesistencia({ ...base, historicoDesistencias: 0 })).toBe('Baixo')
    })

    it('historico 1 = Baixo (1 fator < 2)', () => {
      expect(calcularRiscoDesistencia({ ...base, historicoDesistencias: 1 })).toBe('Baixo')
    })

    it('historico 3 = Baixo (so 1 fator checado, precisa >= 2 para Moderado)', () => {
      expect(calcularRiscoDesistencia({ ...base, historicoDesistencias: 3 })).toBe('Baixo')
    })
  })

  describe('gerarEtiquetasAutomaticas', () => {
    it('em_treinamento + confirmou = Em Processo + Interesse Confirmado', () => {
      const tags = gerarEtiquetasAutomaticas({ ...base, stage: 'em_treinamento', confirmouInteresse: true })
      expect(tags).toContain('Em Processo')
      expect(tags).toContain('Interesse Confirmado')
    })

    it('contato_inicial sem confirmacao = vazio', () => {
      const tags = gerarEtiquetasAutomaticas({ ...base, stage: 'contato_inicial' })
      expect(tags).toHaveLength(0)
    })
  })

  describe('gerarParecerOperacional', () => {
    it('gera riscos quando documento pendente', () => {
      const parecer = gerarParecerOperacional({ ...base, statusDocumental: 'pendente' })
      expect(parecer.riscos.some(r => r.includes('Documentação'))).toBe(true)
    })

    it('gera pontos positivos quando docs completos', () => {
      const parecer = gerarParecerOperacional({ ...base, statusDocumental: 'completo' })
      expect(parecer.pontosPositivos.some(p => p.includes('Documentação'))).toBe(true)
    })
  })
})
