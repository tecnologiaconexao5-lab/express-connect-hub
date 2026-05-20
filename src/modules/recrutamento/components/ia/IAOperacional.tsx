import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Sparkles, Users, MessageSquare, Send, Save, AlertTriangle,
  Truck, Award, ChevronDown, ChevronUp, Copy, CheckCircle, XCircle,
  Lightbulb, DollarSign, MapPin, UserCheck, Activity, Target, Megaphone,
} from 'lucide-react'
import { PremiumCard, PremiumCardContent } from '../design-system/PremiumCard'
import { PremiumBadge } from '../design-system/PremiumBadge'
import { useRecrutamentoStore } from '../../store/recrutamentoStore'
import { formatCurrency, formatDate, cn } from '../../utils/cn'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import type { Operacao, Prestador, StatusPrestador } from '../../types/recrutamento'

type ResultadoTipo = 'sugestoes' | 'mensagem' | 'analise' | 'anuncio' | 'risco' | 'ajustes' | 'erro'

interface Resultado {
  tipo: ResultadoTipo
  titulo: string
  conteudo: string
  sugestoes?: SugestaoPrestador[]
  camposAusentes?: string[]
  risco?: 'baixo' | 'medio' | 'alto'
}

interface SugestaoPrestador {
  prestador: Prestador
  score: number
  motivo: string
  pontosPositivos: string[]
  pontosAtencao: string[]
}

const PERFIL_VEICULO: Record<string, string[]> = {
  VUC: ['VUC 3/4', 'VUC 7 Ton', 'Van 1 Ton', 'Van 2 Ton'],
  Toco: ['Toco 12 Ton', 'Caminhão Baú', 'Caminhão Sider'],
  Truck: ['Truck 23 Ton', 'Carreta 2 Eixos'],
  Carreta: ['Carreta 2 Eixos', 'Carreta 3 Eixos', 'Bitrem', 'Rodotrem'],
}

function compatibilidadeVeiculo(veiculoOperacao: string, veiculoPrestador: string): number {
  const vOp = veiculoOperacao.toLowerCase()
  const vPr = veiculoPrestador.toLowerCase()
  if (vPr.includes(vOp) || vOp.includes(vPr)) return 100
  for (const [, veiculos] of Object.entries(PERFIL_VEICULO)) {
    if (veiculos.some(v => vOp.includes(v.toLowerCase()) || vPr.includes(v.toLowerCase()))) return 80
  }
  if (vPr.includes('carreta') && (vOp.includes('truck') || vOp.includes('toco'))) return 60
  if (vPr.includes('toco') && vOp.includes('vuc')) return 50
  return 30
}

function compatibilidadeRegiao(regiaoOp: string, regioesPrestador: string[]): number {
  if (!regiaoOp || regioesPrestador.length === 0) return 50
  const rOp = regiaoOp.toLowerCase()
  for (const r of regioesPrestador) {
    if (r.toLowerCase().includes(rOp) || rOp.includes(r.toLowerCase())) return 100
  }
  return 20
}

function calcularScoreCompatibilidade(op: Operacao, prestador: Prestador): { score: number; positivo: string[]; atencao: string[] } {
  const positivo: string[] = []
  const atencao: string[] = []
  let score = 0

  const compVeiculo = compatibilidadeVeiculo(op.tipoVeiculo, prestador.tipoVeiculo)
  score += compVeiculo * 0.3
  if (compVeiculo >= 80) positivo.push(`Veículo compatível: ${prestador.tipoVeiculo}`)
  else if (compVeiculo >= 50) positivo.push(`Veículo parcialmente compatível: ${prestador.tipoVeiculo}`)
  else atencao.push(`Veículo ${prestador.tipoVeiculo} pode não atender à necessidade de ${op.tipoVeiculo}`)

  const compRegiao = compatibilidadeRegiao(op.regiao, prestador.regioesAtuacao)
  score += compRegiao * 0.2
  if (compRegiao >= 80) positivo.push(`Atua na região: ${prestador.regioesAtuacao.join(', ')}`)
  else atencao.push(`Região de atuação: ${prestador.regioesAtuacao.join(', ') || 'não informada'}`)

  score += Math.min(prestador.score.geral, 100) * 0.25
  if (prestador.score.geral >= 70) positivo.push(`Score geral alto: ${prestador.score.geral}`)
  else if (prestador.score.geral >= 50) positivo.push(`Score geral: ${prestador.score.geral}`)
  else atencao.push(`Score geral baixo: ${prestador.score.geral}`)

  if (prestador.status === 'agregado' || prestador.status === 'aprovado') {
    score += 15
    positivo.push('Prestador já aprovado no processo')
  } else if (prestador.status === 'novo' || prestador.status === 'em_analise') {
    score += 5
    positivo.push('Disponível para novo processo')
  } else if (prestador.status === 'bloqueado') {
    score -= 20
    atencao.push('Prestador bloqueado')
  }

  if (prestador.historico?.jaCarregouConosco) {
    score += 5
    positivo.push('Já carregou conosco — histórico conhecido')
  }

  if (prestador.tags?.includes('experiente') || prestador.tags?.includes('recomendado')) {
    score += 5
    positivo.push('Prestador experiente/recomendado')
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    positivo,
    atencao,
  }
}

function sugerirPrestadoresParaOperacao(op: Operacao, prestadores: Prestador[]): SugestaoPrestador[] {
  if (!op) return []

  const resultado = prestadores
    .filter(p => p.status !== 'bloqueado')
    .map(p => {
      const { score, positivo, atencao } = calcularScoreCompatibilidade(op, p)
      const motivos = positivo.length > 0
        ? positivo.slice(0, 3).join('; ')
        : 'Perfil com potencial'
      return { prestador: p, score, motivo: motivos, pontosPositivos: positivo, pontosAtencao: atencao }
    })
    .filter(s => s.score >= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  return resultado
}

function analisarValorAtrativo(op: Operacao, prestadores: Prestador[]): { mensagem: string; atrativo: boolean; risco: string; sugestoes: string[] } {
  const mensagens: string[] = []
  const sugestoes: string[] = []
  let atrativo = true
  let risco = 'baixo'

  if (!op || op.financeiro.valorPrestador <= 0) {
    return { mensagem: 'Valor do prestador não informado. Não é possível analisar.', atrativo: false, risco: 'alto', sugestoes: ['Defina o valor do frete para análise.'] }
  }

  const valor = op.financeiro.valorPrestador
  const vagas = op.meta.vagasTotais
  const vagasPreenchidas = op.meta.vagasPreenchidas
  const taxaPreenchimento = vagas > 0 ? (vagasPreenchidas / vagas) * 100 : 0

  mensagens.push(`Valor ofertado: ${formatCurrency(valor)}`)

  if (op.financeiro.franquiaKm > 0) {
    const valorPorKm = op.financeiro.franquiaKm > 0 ? valor / op.financeiro.franquiaKm : 0
    mensagens.push(`Valor por km: ${formatCurrency(valorPorKm)}`)
    if (valorPorKm < 3) {
      atrativo = false
      risco = 'alto'
      sugestoes.push(`Valor por km (${formatCurrency(valorPorKm)}) está abaixo do mercado (R$ 3,00-6,00/km). Considere reajustar para ${formatCurrency(op.financeiro.franquiaKm * 4)}`)
    } else if (valorPorKm < 4.5) {
      risco = 'medio'
      sugestoes.push(`Valor por km (${formatCurrency(valorPorKm)}) está na faixa média. Um reajuste para ${formatCurrency(op.financeiro.franquiaKm * 5)} pode atrair mais prestadores.`)
    } else {
      mensagens.push(`Valor por km competitivo: ${formatCurrency(valorPorKm)}`)
    }
  }

  if (vagas > 0 && taxaPreenchimento < 30) {
    risco = 'alto'
    sugestoes.push(`Apenas ${vagasPreenchidas} de ${vagas} vagas preenchidas. Considere revisar o valor ou as condições.`)
  }

  const prestadoresCompativeis = prestadores.filter(p => {
    const { score } = calcularScoreCompatibilidade(op, p)
    return score >= 50
  }).length

  if (prestadoresCompativeis < 3) {
    risco = 'alto'
    sugestoes.push(`Apenas ${prestadoresCompativeis} prestadores compatíveis cadastrados. Considere ampliar a região ou tipo de veículo.`)
  } else if (prestadoresCompativeis < 8) {
    if (risco === 'baixo') risco = 'medio'
    sugestoes.push(`${prestadoresCompativeis} prestadores compatíveis. Capture mais candidatos.`)
  }

  return { mensagem: mensagens.join('. '), atrativo, risco, sugestoes }
}

function gerarMensagemWhatsApp(op: Operacao, prestador: Prestador | null): string {
  const linhas: string[] = [
    `Olá! Tudo bem?`,
    ``,
    `Aqui é da Conexão Express. Passando para compartilhar uma oportunidade que se encaixa no seu perfil:`,
    ``,
  ]

  if (op.nome) linhas.push(`📋 *Vaga:* ${op.nome}`)
  if (op.rotaOrigem) linhas.push(`📍 *Rota:* ${op.rotaOrigem} → ${op.rotaDestino || 'destino'}`)
  if (op.regiao) linhas.push(`🎯 *Região:* ${op.regiao}`)
  if (op.tipoVeiculo) linhas.push(`🛻 *Veículo:* ${op.tipoVeiculo}`)
  if (op.financeiro.valorPrestador > 0) linhas.push(`💰 *Valor:* ${formatCurrency(op.financeiro.valorPrestador)}`)
  if (op.meta.vagasTotais > 0) linhas.push(`📊 *Vagas:* ${op.meta.vagasTotais} disponíveis`)

  linhas.push('')
  if (prestador) {
    linhas.push(`Identificamos que seu perfil (${prestador.tipoVeiculo}, ${prestador.endereco.cidade}/${prestador.endereco.uf}) é compatível com esta operação.`)
    linhas.push('')
  }
  linhas.push(`Tem interesse em saber mais detalhes?`)
  linhas.push('')
  linhas.push(`_Equipe Express Connect Hub_`)

  return linhas.join('\n')
}

function gerarAnuncioVaga(op: Operacao): { texto: string; camposAusentes: string[] } {
  const ausentes: string[] = []
  const linhas: string[] = [
    `🚛 *VAGA PARA PRESTADOR* 🚛`,
    ``,
  ]

  if (op.nome) linhas.push(`📋 *${op.nome}*`); else ausentes.push('Nome da operação')
  if (op.cliente) linhas.push(`🏢 *Cliente:* ${op.cliente}`); else ausentes.push('Cliente')
  if (op.rotaOrigem) linhas.push(`📍 *Origem:* ${op.rotaOrigem}`); else ausentes.push('Rota de origem')
  if (op.regiao) linhas.push(`🎯 *Região de Entrega:* ${op.regiao}`); else ausentes.push('Região')
  if (op.tipoVeiculo) linhas.push(`🛻 *Veículo:* ${op.tipoVeiculo}`); else ausentes.push('Tipo de veículo')
  if (op.tipoCarga) linhas.push(`📦 *Carga:* ${op.tipoCarga}`)

  linhas.push('')
  if (op.financeiro.valorPrestador > 0) linhas.push(`💰 *Valor do Frete:* ${formatCurrency(op.financeiro.valorPrestador)}`); else ausentes.push('Valor do frete')
  if (op.financeiro.franquiaKm > 0) linhas.push(`📏 *Franquia KM:* ${op.financeiro.franquiaKm} km`)
  if (op.financeiro.valorKmExcedente > 0) linhas.push(`➕ *KM Excedente:* ${formatCurrency(op.financeiro.valorKmExcedente)}/km`)
  if (op.financeiro.formaPagamento) linhas.push(`💳 *Pagamento:* ${op.financeiro.formaPagamento} (${op.financeiro.prazoPagamento || '?'} dias)`)

  linhas.push('')
  if (op.meta.vagasTotais > 0) linhas.push(`📊 *Vagas Disponíveis:* ${op.meta.vagasTotais}`); else ausentes.push('Quantidade de vagas')

  linhas.push('')
  linhas.push(`👤 *Perfil Desejado:* Motorista com veículo compatível (${op.tipoVeiculo || 'categoria informada'}), documentação regular e disponibilidade para embarque.`)

  if (op.observacoes) {
    linhas.push('')
    linhas.push(`📝 *Observações:* ${op.observacoes}`)
  }

  linhas.push('')
  linhas.push(`_📢 Vaga divulgada pelo Express Connect Hub_`)

  return { texto: linhas.join('\n'), camposAusentes: ausentes }
}

function analisarRiscoBaixaAdesao(op: Operacao, prestadores: Prestador[]): { risco: 'baixo' | 'medio' | 'alto'; fatores: string[]; sugestoes: string[] } {
  const fatores: string[] = []
  const sugestoes: string[] = []

  if (!op) return { risco: 'alto', fatores: ['Nenhuma operação selecionada'], sugestoes: ['Selecione uma operação para análise'] }

  const prestadoresCompativeis = prestadores.filter(p => {
    const { score } = calcularScoreCompatibilidade(op, p)
    return score >= 50
  })

  const taxaPreenchimento = op.meta.vagasTotais > 0 ? (op.meta.vagasPreenchidas / op.meta.vagasTotais) * 100 : 0

  if (prestadoresCompativeis.length < 3) {
    fatores.push(`Apenas ${prestadoresCompativeis.length} prestadores compatíveis cadastrados`)
    sugestoes.push('Cadastre mais prestadores ou amplie os critérios de compatibilidade')
  }
  if (prestadores.length < 10) {
    fatores.push(`Base de prestadores pequena: ${prestadores.length} no total`)
    sugestoes.push('Invista em captação — use anúncios e banco de talentos')
  }
  if (op.financeiro.valorPrestador <= 0) {
    fatores.push('Valor do frete não definido')
    sugestoes.push('Defina o valor do frete para atrair prestadores')
  } else if (op.financeiro.valorPrestador < 500) {
    fatores.push(`Valor baixo: ${formatCurrency(op.financeiro.valorPrestador)}`)
    sugestoes.push(`Considere aumentar o valor para pelo menos ${formatCurrency(800)}`)
  }
  if (taxaPreenchimento > 70) {
    fatores.push(`Alta taxa de preenchimento (${Math.round(taxaPreenchimento)}%) — risco baixo`)
  } else if (taxaPreenchimento > 0) {
    fatores.push(`Taxa de preenchimento de ${Math.round(taxaPreenchimento)}%`)
    if (taxaPreenchimento < 30) sugestoes.push('Taxa baixa — revise valor, região ou condições')
  }
  if (op.financeiro.franquiaKm > 0 && op.financeiro.valorPrestador / op.financeiro.franquiaKm < 3) {
    fatores.push(`Valor por km (${formatCurrency(op.financeiro.valorPrestador / op.financeiro.franquiaKm)}) abaixo do mercado`)
    sugestoes.push(`Ajuste o valor para ${formatCurrency(op.financeiro.franquiaKm * 4)} (R$ 4,00/km)`)
  }
  if (op.meta.vagasTotais > 0 && op.meta.vagasPendentes === op.meta.vagasTotais) {
    fatores.push('Nenhuma vaga preenchida ainda')
  }

  if (fatores.length === 0) {
    fatores.push('Não foram identificados fatores de risco significativos')
  }

  const risco: 'baixo' | 'medio' | 'alto' =
    fatores.filter(f => f.includes('abaixo') || f.includes('pequena') || f.includes('apenas') || f.includes('nenhuma')).length >= 2
      ? 'alto'
      : fatores.length >= 3
        ? 'medio'
        : 'baixo'

  return { risco, fatores, sugestoes }
}

function sugerirAjustesProposta(op: Operacao, prestadores: Prestador[]): string[] {
  const ajustes: string[] = []

  if (!op) return ['Selecione uma operação para análise']

  if (!op.cliente) ajustes.push('**Cliente**: Preencha o nome do cliente para dar credibilidade à vaga')
  if (!op.rotaOrigem || !op.regiao) ajustes.push('**Rota**: Informe origem e região de entrega — são essenciais para o prestador avaliar')
  if (op.financeiro.valorPrestador <= 0) ajustes.push('**Valor**: Defina o valor do frete — sem ele a vaga não atrai candidatos')
  if (op.financeiro.franquiaKm <= 0 && !op.regiao) ajustes.push('**KM**: Informe a franquia de quilometragem para o prestador calcular custos')
  if (!op.financeiro.formaPagamento) ajustes.push('**Pagamento**: Informe a forma de pagamento (ex: 28 dias, frete líquido)')
  if (!op.tipoCarga) ajustes.push('**Tipo de Carga**: Especifique o tipo de carga — prestadores especializados avaliam este critério')
  if (op.meta.vagasTotais <= 0) ajustes.push('**Vagas**: Defina a quantidade de vagas disponíveis')

  const prestadoresCompativeis = prestadores.filter(p => {
    const { score } = calcularScoreCompatibilidade(op, p)
    return score >= 50
  })
  if (prestadoresCompativeis.length < 3) {
    ajustes.push(`**Captação**: Apenas ${prestadoresCompativeis.length} prestadores compatíveis. Considere divulgar em grupos de WhatsApp ou ampliar a região.`)
  }

  if (op.financeiro.valorPrestador > 0 && prestadoresCompativeis.length >= 3) {
    const scoreMedio = prestadoresCompativeis.reduce((a, p) => a + calcularScoreCompatibilidade(op, p).score, 0) / prestadoresCompativeis.length
    if (scoreMedio < 50) {
      ajustes.push('**Perfil**: O score médio dos prestadores compatíveis é baixo. Revise os requisitos da vaga.')
    }
  }

  if (ajustes.length === 0) {
    ajustes.push('**Proposta completa!** Todos os campos essenciais estão preenchidos e há prestadores compatíveis cadastrados.')
  }

  return ajustes
}

export function IAOperacional() {
  const { operacoes, prestadores } = useRecrutamentoStore()
  const [selectedOpId, setSelectedOpId] = useState<string>('')
  const [resultados, setResultados] = useState<Resultado[]>([])
  const [mensagemEditavel, setMensagemEditavel] = useState('')
  const [ultimaMensagemGerada, setUltimaMensagemGerada] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [expandidoIdx, setExpandidoIdx] = useState<number | null>(null)

  const operacoesAbertas = useMemo(() => operacoes.filter(o => o.status === 'aberta' || o.status === 'em_captacao'), [operacoes])
  const selectedOp = useMemo(() => operacoes.find(o => o.id === selectedOpId) ?? null, [operacoes, selectedOpId])

  const metricas = useMemo(() => {
    const totalAbertas = operacoesAbertas.length
    const totalVagas = operacoesAbertas.reduce((a, o) => a + o.meta.vagasTotais, 0)
    const totalPreenchidas = operacoesAbertas.reduce((a, o) => a + o.meta.vagasPreenchidas, 0)
    const scoreMedio = prestadores.length > 0 ? Math.round(prestadores.reduce((a, p) => a + p.score.geral, 0) / prestadores.length) : 0
    const prestadoresViaveis = prestadores.filter(p => p.status !== 'bloqueado').length
    return { totalAbertas, totalVagas, totalPreenchidas, scoreMedio, prestadoresViaveis }
  }, [operacoesAbertas, prestadores])

  const limparResultados = useCallback(() => {
    setResultados([])
    setMensagemEditavel('')
    setUltimaMensagemGerada('')
  }, [])

  const handleSugerirPrestadores = useCallback(() => {
    if (!selectedOp) { toast.error('Selecione uma operação primeiro'); return }
    setLoading('sugerir')

    setTimeout(() => {
      const sugestoes = sugerirPrestadoresParaOperacao(selectedOp, prestadores)
      const analiseValor = analisarValorAtrativo(selectedOp, prestadores)
      const risco = analisarRiscoBaixaAdesao(selectedOp, prestadores)

      const novosResultados: Resultado[] = []

      if (sugestoes.length === 0) {
        novosResultados.push({
          tipo: 'erro',
          titulo: 'Nenhum prestador compatível encontrado',
          conteudo: 'Não há prestadores cadastrados com perfil compatível para esta operação. Considere ampliar os critérios ou cadastrar novos prestadores.',
        })
      } else {
        const detalhes = sugestoes.map(s =>
          `*${s.prestador.nome}* — Score: ${s.score}%\n` +
          `  Veículo: ${s.prestador.tipoVeiculo} | Região: ${s.prestador.endereco.cidade}/${s.prestador.endereco.uf}\n` +
          `  Pontos fortes: ${s.pontosPositivos.slice(0, 2).join(', ') || 'Nenhum destaque'}\n` +
          `  Atenção: ${s.pontosAtencao.slice(0, 2).join(', ') || 'Nenhum'}\n`
        ).join('\n')

        novosResultados.push({
          tipo: 'sugestoes',
          titulo: `${sugestoes.length} prestadores sugeridos`,
          conteudo: detalhes,
          sugestoes,
        })
      }

      novosResultados.push({
        tipo: 'analise',
        titulo: `Valor: ${analiseValor.atrativo ? 'Atrativo' : 'Pouco atrativo'}`,
        conteudo: analiseValor.mensagem + (analiseValor.sugestoes.length > 0 ? '\n\nSugestões:\n' + analiseValor.sugestoes.map(s => `• ${s}`).join('\n') : ''),
      })

      novosResultados.push({
        tipo: 'risco',
        titulo: `Risco de baixa adesão: ${risco.risco === 'baixo' ? 'Baixo' : risco.risco === 'medio' ? 'Médio' : 'Alto'}`,
        conteudo: risco.fatores.map(f => `• ${f}`).join('\n') + '\n\nSugestões:\n' + risco.sugestoes.map(s => `• ${s}`).join('\n'),
        risco: risco.risco,
      })

      setResultados(novosResultados)
      setLoading(null)
    }, 600)
  }, [selectedOp, prestadores])

  const handleGerarMensagem = useCallback(() => {
    if (!selectedOp) { toast.error('Selecione uma operação primeiro'); return }
    setLoading('mensagem')

    setTimeout(() => {
      const sugestoes = sugerirPrestadoresParaOperacao(selectedOp, prestadores)
      const prestadorAlvo = sugestoes.length > 0 ? sugestoes[0].prestador : null
      const msg = gerarMensagemWhatsApp(selectedOp, prestadorAlvo)
      const anuncio = gerarAnuncioVaga(selectedOp)

      setUltimaMensagemGerada(msg)
      setMensagemEditavel(msg)

      setResultados([
        {
          tipo: 'mensagem',
          titulo: 'Mensagem WhatsApp gerada',
          conteudo: msg + (prestadorAlvo ? `\n\n(Mensagem personalizada para ${prestadorAlvo.nome})` : ''),
        },
        {
          tipo: 'anuncio',
          titulo: 'Anúncio da vaga',
          conteudo: anuncio.texto,
          camposAusentes: anuncio.camposAusentes,
        },
      ])
      setLoading(null)
    }, 400)
  }, [selectedOp, prestadores])

  const handleEnviarWhatsApp = useCallback(() => {
    const texto = mensagemEditavel || ultimaMensagemGerada
    if (!texto) { toast.error('Gere uma mensagem primeiro'); return }
    const encoded = encodeURIComponent(texto)
    window.open(`https://wa.me/?text=${encoded}`, '_blank')
    toast.success('WhatsApp aberto em nova aba')
  }, [mensagemEditavel, ultimaMensagemGerada])

  const handleSalvarModelo = useCallback(() => {
    const texto = mensagemEditavel || ultimaMensagemGerada
    if (!texto) { toast.error('Gere uma mensagem primeiro'); return }

    const key = 'conexao_mensagens_rapidas'
    try {
      const local = localStorage.getItem(key)
      const msgs = local ? JSON.parse(local) : []
      msgs.push({
        id: `modelo_${Date.now()}`,
        titulo: `IA - ${selectedOp?.nome || 'Operação'} ${new Date().toLocaleDateString('pt-BR')}`,
        categoria: 'Gerado por IA',
        texto,
        cliente_id: null,
        cliente_nome: null,
        cliente_documento: null,
      })
      localStorage.setItem(key, JSON.stringify(msgs))
      toast.success('Modelo salvo em Mensagens Rápidas!')
    } catch {
      toast.error('Erro ao salvar modelo')
    }
  }, [mensagemEditavel, ultimaMensagemGerada, selectedOp])

  const handleCopiarMensagem = useCallback(() => {
    const texto = mensagemEditavel || ultimaMensagemGerada
    if (!texto) { toast.error('Gere uma mensagem primeiro'); return }
    navigator.clipboard.writeText(texto)
    toast.success('Mensagem copiada!')
  }, [mensagemEditavel, ultimaMensagemGerada])

  const handleAnalisarAjustes = useCallback(() => {
    if (!selectedOp) { toast.error('Selecione uma operação primeiro'); return }
    setLoading('ajustes')

    setTimeout(() => {
      const ajustes = sugerirAjustesProposta(selectedOp, prestadores)
      setResultados(prev => [
        ...prev,
        {
          tipo: 'ajustes',
          titulo: 'Sugestões de ajustes na proposta',
          conteudo: ajustes.map(a => `• ${a}`).join('\n'),
        },
      ])
      setLoading(null)
    }, 300)
  }, [selectedOp, prestadores])

  const stats = [
    { icon: Activity, label: 'Operações abertas', value: metricas.totalAbertas, color: 'text-blue-400' },
    { icon: Truck, label: 'Vagas totais', value: metricas.totalVagas, color: 'text-violet-400' },
    { icon: Users, label: 'Prestadores disponíveis', value: metricas.prestadoresViaveis, color: 'text-emerald-400' },
    { icon: Award, label: 'Score médio', value: metricas.scoreMedio, color: 'text-amber-400' },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(s => (
          <PremiumCard key={s.label}>
            <PremiumCardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn('w-9 h-9 rounded-lg bg-muted/30 flex items-center justify-center', s.color)}>
                  <s.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground/50">{s.label}</p>
                  <p className={cn('text-lg font-bold tabular-nums', s.color)}>{s.value}</p>
                </div>
              </div>
            </PremiumCardContent>
          </PremiumCard>
        ))}
      </div>

      <PremiumCard>
        <PremiumCardContent className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">IA Operacional</p>
              <p className="text-[10px] text-muted-foreground/50">
                Sugestão inteligente de prestadores, mensagens e análise de vagas
              </p>
            </div>
            <PremiumBadge variant="success" dot size="sm">Online</PremiumBadge>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Select value={selectedOpId} onValueChange={v => { setSelectedOpId(v); limparResultados() }}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione uma operação..." />
                </SelectTrigger>
                <SelectContent>
                  {operacoesAbertas.length === 0 && (
                    <SelectItem value="_none" disabled>Nenhuma operação aberta</SelectItem>
                  )}
                  {operacoesAbertas.map(op => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.nome || op.cliente || op.id.slice(0, 8)}
                      {' '}({op.tipoVeiculo} - {formatCurrency(op.financeiro.valorPrestador)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedOp && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-8 text-xs justify-start"
                onClick={handleSugerirPrestadores}
                disabled={loading === 'sugerir'}
              >
                <Target className="w-3.5 h-3.5 text-emerald-400" />
                {loading === 'sugerir' ? 'Analisando...' : 'Sugerir prestadores'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-8 text-xs justify-start"
                onClick={handleGerarMensagem}
                disabled={loading === 'mensagem'}
              >
                <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                {loading === 'mensagem' ? 'Gerando...' : 'Gerar mensagem'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-8 text-xs justify-start"
                onClick={handleEnviarWhatsApp}
              >
                <Send className="w-3.5 h-3.5 text-emerald-400" />
                Enviar WhatsApp
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-8 text-xs justify-start"
                onClick={handleSalvarModelo}
              >
                <Save className="w-3.5 h-3.5 text-violet-400" />
                Salvar modelo
              </Button>
            </div>
          )}

          {selectedOp && (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 h-8 text-xs"
              onClick={handleAnalisarAjustes}
              disabled={loading === 'ajustes'}
            >
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              {loading === 'ajustes' ? 'Analisando...' : 'Sugerir ajustes na proposta'}
            </Button>
          )}
        </PremiumCardContent>
      </PremiumCard>

      <AnimatePresence mode="popLayout">
        {resultados.map((r, idx) => (
          <motion.div
            key={`${r.tipo}_${idx}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
          >
            <PremiumCard>
              <PremiumCardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    {r.tipo === 'sugestoes' && <Target className="w-4 h-4 text-emerald-400" />}
                    {r.tipo === 'mensagem' && <MessageSquare className="w-4 h-4 text-blue-400" />}
                    {r.tipo === 'analise' && <DollarSign className="w-4 h-4 text-amber-400" />}
                    {r.tipo === 'anuncio' && <Megaphone className="w-4 h-4 text-violet-400" />}
                    {r.tipo === 'risco' && <AlertTriangle className={cn('w-4 h-4', r.risco === 'alto' ? 'text-rose-400' : r.risco === 'medio' ? 'text-amber-400' : 'text-emerald-400')} />}
                    {r.tipo === 'ajustes' && <Lightbulb className="w-4 h-4 text-amber-400" />}
                    {r.tipo === 'erro' && <XCircle className="w-4 h-4 text-rose-400" />}
                    <span className="text-sm font-semibold text-foreground">{r.titulo}</span>
                    {r.risco && (
                      <PremiumBadge
                        variant={r.risco === 'alto' ? 'danger' : r.risco === 'medio' ? 'warning' : 'success'}
                        size="sm"
                      >
                        {r.risco === 'alto' ? 'Alto' : r.risco === 'medio' ? 'Médio' : 'Baixo'}
                      </PremiumBadge>
                    )}
                  </div>
                  <button
                    onClick={() => setExpandidoIdx(expandidoIdx === idx ? null : idx)}
                    className="text-muted-foreground/40 hover:text-foreground transition-colors"
                  >
                    {expandidoIdx === idx ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {r.sugestoes && r.sugestoes.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {r.sugestoes.slice(0, expandidoIdx === idx ? r.sugestoes.length : 3).map(s => (
                      <div key={s.prestador.id} className="p-3 rounded-lg bg-muted/20 border border-border/30">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm font-medium text-foreground">{s.prestador.nome}</span>
                          <span className={cn(
                            'text-xs font-bold px-2 py-0.5 rounded-full',
                            s.score >= 70 ? 'text-emerald-400 bg-emerald-500/10' :
                            s.score >= 50 ? 'text-amber-400 bg-amber-500/10' :
                            'text-rose-400 bg-rose-500/10',
                          )}>
                            {s.score}%
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground/60">
                          {s.prestador.tipoVeiculo} · {s.prestador.endereco.cidade}/{s.prestador.endereco.uf} · Score: {s.prestador.score.geral}
                        </p>
                        <p className="text-xs text-emerald-400/70 mt-1">{s.motivo}</p>
                        {expandidoIdx === idx && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 space-y-1">
                            {s.pontosPositivos.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {s.pontosPositivos.map(p => (
                                  <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">{p}</span>
                                ))}
                              </div>
                            )}
                            {s.pontosAtencao.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {s.pontosAtencao.map(p => (
                                  <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">{p}</span>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </div>
                    ))}
                    {r.sugestoes.length > 3 && (
                      <button
                        onClick={() => setExpandidoIdx(expandidoIdx === idx ? null : idx)}
                        className="text-[11px] text-muted-foreground/50 hover:text-foreground transition-colors w-full text-center py-1"
                      >
                        {expandidoIdx === idx ? `Mostrar menos` : `+ ${r.sugestoes.length - 3} prestadores`}
                      </button>
                    )}
                  </div>
                )}

                {r.camposAusentes && r.camposAusentes.length > 0 && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-medium text-amber-300">Campos não preenchidos:</p>
                      <ul className="text-[10px] text-amber-200/70 list-disc list-inside">
                        {r.camposAusentes.map(c => <li key={c}>{c}</li>)}
                      </ul>
                    </div>
                  </div>
                )}

                {r.tipo === 'mensagem' && (
                  <div className="space-y-2">
                    <Textarea
                      value={mensagemEditavel}
                      onChange={e => setMensagemEditavel(e.target.value)}
                      className="text-xs font-mono leading-relaxed min-h-[120px] resize-y"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="gap-1.5 h-7 text-[10px]" onClick={handleCopiarMensagem}>
                        <Copy className="w-3 h-3" /> Copiar
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 h-7 text-[10px] text-emerald-400 border-emerald-500/30" onClick={handleEnviarWhatsApp}>
                        <Send className="w-3 h-3" /> Enviar WhatsApp
                      </Button>
                    </div>
                  </div>
                )}

                {r.tipo === 'anuncio' && (
                  <div className="text-xs font-mono leading-relaxed whitespace-pre-wrap p-3 rounded-lg bg-muted/20 border border-border/30 max-h-[200px] overflow-y-auto">
                    {r.conteudo}
                  </div>
                )}

                {(r.tipo === 'analise' || r.tipo === 'risco' || r.tipo === 'ajustes' || r.tipo === 'erro') && !r.sugestoes && (
                  <div className="text-xs text-muted-foreground/70 leading-relaxed whitespace-pre-wrap">
                    {r.conteudo}
                  </div>
                )}
              </PremiumCardContent>
            </PremiumCard>
          </motion.div>
        ))}
      </AnimatePresence>

      {resultados.length === 0 && selectedOp && (
        <div className="text-center py-8 text-muted-foreground/40 text-xs">
          <Bot className="w-8 h-8 mx-auto mb-2 opacity-30" />
          Selecione uma operação e clique em um dos botões acima para começar
        </div>
      )}

      {resultados.length === 0 && !selectedOp && (
        <div className="text-center py-8 text-muted-foreground/40 text-xs">
          <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
          Selecione uma operação para receber sugestões inteligentes da IA
        </div>
      )}
    </div>
  )
}
