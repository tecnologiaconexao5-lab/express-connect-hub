import type { AnaliseIA, Prestador, ConversaWhatsApp, MensagemWhatsApp } from '../types/recrutamento'

export const iaService = {
  async analisarPrestador(prestador: Partial<Prestador>): Promise<AnaliseIA> {
    await new Promise(r => setTimeout(r, 800))

    const scorePerfil = Math.round(50 + Math.random() * 45)
    const scoreDocumentacao = prestador.documentos?.length
      ? Math.round(prestador.documentos.filter(d => d.status === 'aprovado').length / prestador.documentos.length * 100)
      : 30 + Math.round(Math.random() * 40)

    const scoreComportamental = 60 + Math.round(Math.random() * 35)
    const scoreGeral = Math.round((scorePerfil * 0.3 + scoreDocumentacao * 0.4 + scoreComportamental * 0.3))

    const pontosFortes: string[] = []
    if (scoreDocumentacao > 70) pontosFortes.push('Documentação em dia')
    if (prestador.contatos && prestador.contatos.length > 1) pontosFortes.push('Múltiplos canais de contato')
    if (prestador.regioesAtuacao && prestador.regioesAtuacao.length > 2) pontosFortes.push('Ampla cobertura regional')
    if (prestador.tipoVeiculo) pontosFortes.push('Veículo adequado para operações')
    if (pontosFortes.length === 0) pontosFortes.push('Perfil com potencial')

    const pontosAtencao: string[] = []
    if (scoreDocumentacao < 60) pontosAtencao.push('Documentação pendente')
    if (scoreComportamental < 60) pontosAtencao.push('Baixo score comportamental')
    if (prestador.contatos && prestador.contatos.length === 0) pontosAtencao.push('Sem contatos cadastrados')
    if (pontosAtencao.length === 0) pontosAtencao.push('Nenhum ponto crítico identificado')

    const recomendacao = scoreGeral >= 70 ? 'aprovado' : scoreGeral >= 45 ? 'em_analise' : 'reprovado'

    return {
      id: `ia_${Date.now()}`,
      prestadorId: prestador.id ?? '',
      scorePerfil,
      scoreDocumentacao,
      scoreComportamental,
      scoreGeral,
      pontosFortes,
      pontosAtencao,
      recomendacao,
      confianca: 75 + Math.round(Math.random() * 20),
      analiseDetalhada: `Análise automatizada concluída. Score geral: ${scoreGeral}/100. ${recomendacao === 'aprovado' ? 'Candidato aprovado para prosseguir no processo.' : recomendacao === 'em_analise' ? 'Recomenda-se análise manual adicional.' : 'Candidato não atende aos critérios mínimos.'}`,
      dataAnalise: new Date().toISOString(),
      modeloUtilizado: 'gpt-4o-mini',
    }
  },

  async gerarMensagem(contexto: string): Promise<string> {
    await new Promise(r => setTimeout(r, 300))
    const templates = [
      `Olá! Tudo bem? Aqui é da Conexão Express. Temos uma oportunidade para você: ${contexto}. Gostaria de saber mais detalhes?`,
      `Bom dia! Passando para convidar você a participar de uma nova operação: ${contexto}. Tem interesse?`,
      `Olá! Identificamos que seu perfil é compatível com uma nova rota: ${contexto}. Podemos conversar?`,
    ]
    return templates[Math.floor(Math.random() * templates.length)]
  },

  async analisarSentimento(mensagem: string): Promise<{ sentimento: string; intencao: string; score: number }> {
    await new Promise(r => setTimeout(r, 200))
    const palavrasPositivas = ['interesse', 'quero', 'sim', 'ok', 'vamos', 'pode', 'gostei', 'topo']
    const palavrasNegativas = ['não', 'nunca', 'sem interesse', 'pare', 'chega', 'deixa']
    const lower = mensagem.toLowerCase()
    const scorePositivo = palavrasPositivas.filter(p => lower.includes(p)).length
    const scoreNegativo = palavrasNegativas.filter(p => lower.includes(p)).length
    const score = Math.round((scorePositivo / (scorePositivo + scoreNegativo + 1)) * 100)
    return {
      sentimento: score > 60 ? 'positivo' : score > 30 ? 'neutro' : 'negativo',
      intencao: score > 60 ? 'interessado' : 'recusado',
      score,
    }
  },
}