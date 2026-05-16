export interface MensagemWhatsAppNormalizada {
  telefone: string
  nome: string
  mensagem: string
  tipoMensagem: string
  horario: string
}

export type Setor = 'comercial' | 'operacional' | 'motorista' | ''
export type Intencao = 'orcamento' | 'coleta' | 'status' | 'ocorrencia' | ''

export interface MensagemIAReady {
  telefone: string
  nome: string
  mensagem: string
  setor: Setor
  intencao: Intencao
}

function safeStr(val: unknown, fallback = ''): string {
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  if (typeof val === 'boolean') return String(val)
  return fallback
}

function extrairTelefone(raw: unknown): string {
  if (typeof raw === 'string') return raw.replace(/@s\.whatsapp\.net$/, '').replace(/\D/g, '')
  return ''
}

function extrairMensagem(message: Record<string, unknown> | undefined): string {
  if (!message || typeof message !== 'object') return ''
  const conv = message['conversation']
  if (typeof conv === 'string' && conv) return conv
  const ext = message['extendedTextMessage']
  if (ext && typeof ext === 'object') {
    const txt = (ext as Record<string, unknown>)['text']
    if (typeof txt === 'string' && txt) return txt
  }
  const img = message['imageMessage']
  if (img && typeof img === 'object') return '[Imagem]'
  const audio = message['audioMessage']
  if (audio && typeof audio === 'object') return '[Áudio]'
  const video = message['videoMessage']
  if (video && typeof video === 'object') return '[Vídeo]'
  const doc = message['documentMessage']
  if (doc && typeof doc === 'object') return '[Documento]'
  const sticker = message['stickerMessage']
  if (sticker && typeof sticker === 'object') return '[Figurinha]'
  return '[Mídia não identificada]'
}

function extrairTipoMensagem(message: Record<string, unknown> | undefined): string {
  if (!message || typeof message !== 'object') return 'unknown'
  const keys = Object.keys(message)
  if (keys.length === 0) return 'unknown'
  if (keys[0] === 'conversation') return 'text'
  return keys[0]
}

function inferirSetor(mensagem: string): Setor {
  const msg = mensagem.toLowerCase()
  if (/orçamento|orcam|preço|preco|quanto custa|valor|taxa/i.test(msg)) return 'comercial'
  if (/coleta|retirar|buscar|pegar|agendar/i.test(msg)) return 'operacional'
  if (/entrega|entregar|destinatário|destinatario|descarregar/i.test(msg)) return 'operacional'
  if (/rota|roteirização|roteirizacao|trajeto/i.test(msg)) return 'operacional'
  if (/status|rastreio|rastrear|onde está|cadê|cade/i.test(msg)) return 'motorista'
  if (/ocorrência|ocorrencia|problema|avaria|atraso|extravi/i.test(msg)) return 'ocorrencia'
  return ''
}

function inferirIntencao(mensagem: string): Intencao {
  const msg = mensagem.toLowerCase()
  if (/orçamento|orcam|preço|preco|quanto custa|valor|taxa|cotação|cotacao/i.test(msg)) return 'orcamento'
  if (/coleta|retirar|buscar|pegar|agendar coleta/i.test(msg)) return 'coleta'
  if (/status|rastreio|rastrear|onde está|cadê|cade|situação|situacao/i.test(msg)) return 'status'
  if (/ocorrência|ocorrencia|problema|avaria|atraso|extravi|reclamação|reclamacao/i.test(msg)) return 'ocorrencia'
  return ''
}

export function interpretarMensagemWhatsApp(rawPayload: unknown): MensagemIAReady {
  try {
    if (!rawPayload || typeof rawPayload !== 'object') {
      return { telefone: '', nome: '', mensagem: '', setor: '', intencao: '' }
    }

    const body = (rawPayload as Record<string, unknown>)['body'] as Record<string, unknown> | undefined
    const data = body?.['data'] as Record<string, unknown> | undefined

    if (!data) {
      return { telefone: '', nome: '', mensagem: '', setor: '', intencao: '' }
    }

    const key = data['key'] as Record<string, unknown> | undefined
    const telefone = extrairTelefone(key?.['remoteJid'])
    const nome = safeStr(data['pushName'])
    const message = data['message'] as Record<string, unknown> | undefined
    const mensagem = extrairMensagem(message)
    const tipoMensagem = extrairTipoMensagem(message)
    const horario = safeStr(data['messageTimestamp'])

    const setor = telefone ? inferirSetor(mensagem) : ''
    const intencao = telefone ? inferirIntencao(mensagem) : ''

    const resultado: MensagemWhatsAppNormalizada = {
      telefone,
      nome,
      mensagem,
      tipoMensagem,
      horario,
    }

    if (telefone) {
      console.log('[WhatsAppInboundParser] Mensagem recebida:', JSON.stringify(resultado))
    }

    return {
      telefone: resultado.telefone,
      nome: resultado.nome,
      mensagem: resultado.mensagem,
      setor,
      intencao,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[WhatsAppInboundParser] Erro ao interpretar mensagem:', msg)
    return { telefone: '', nome: '', mensagem: '', setor: '', intencao: '' }
  }
}
