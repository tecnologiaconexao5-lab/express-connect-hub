import type { ScorePrestador, Prestador } from '../types/recrutamento'

export const scoreService = {
  async calcularScore(data: Partial<Prestador>): Promise<ScorePrestador> {
    const agora = new Date().toISOString()

    const pesoDocs = data.documentos && data.documentos.length > 0
      ? Math.min(100, (data.documentos.filter(d => d.status === 'aprovado').length / Math.max(data.documentos.length, 1)) * 100)
      : 0

    const pesoExperiencia = data.status === 'ativo' ? 90
      : data.status === 'qualificado' ? 70
      : data.status === 'em_triagem' ? 40
      : data.status === 'potencial' ? 20
      : 10

    const pesoPerfil = data.contatos && data.contatos.length > 0
      ? Math.min(100, 60 + (data.contatos.filter(c => c.principal).length * 20))
      : 30

    const scoreDocumentacao = Math.round(pesoDocs)
    const scoreExperiencia = Math.round(pesoExperiencia)
    const scorePerfil = Math.round(pesoPerfil)
    const scoreReputacao = 70
    const scoreRegularidade = 65
    const scoreTendencia = 75

    const scoreGeral = Math.round(
      scoreDocumentacao * 0.25 +
      scoreExperiencia * 0.25 +
      scorePerfil * 0.15 +
      scoreReputacao * 0.15 +
      scoreRegularidade * 0.10 +
      scoreTendencia * 0.10
    )

    return {
      geral: Math.min(100, Math.max(0, scoreGeral)),
      documentacao: scoreDocumentacao,
      experiencia: scoreExperiencia,
      reputacao: scoreReputacao,
      regularidade: scoreRegularidade,
      perfil: scorePerfil,
      tendencia: scoreTendencia,
      ultimaAtualizacao: agora,
      historico: [],
    }
  },

  obterNivel(score: number): { label: string; color: string } {
    if (score >= 90) return { label: 'Excelente', color: 'text-emerald-400' }
    if (score >= 75) return { label: 'Bom', color: 'text-blue-400' }
    if (score >= 60) return { label: 'Regular', color: 'text-amber-400' }
    if (score >= 40) return { label: 'Baixo', color: 'text-orange-400' }
    return { label: 'Crítico', color: 'text-rose-400' }
  },
}