import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Send, User, Sparkles, AlertCircle } from 'lucide-react'
import { PremiumCard } from '../design-system/PremiumCard'
import { PremiumBadge } from '../design-system/PremiumBadge'
import { cn } from '../../utils/cn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

interface IAChatProps {
  contexto?: string
  onSend?: (message: string) => Promise<string>
}

export function IAChat({ contexto = 'recrutamento', onSend }: IAChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'system',
      content: 'Olá! Sou a IA do Recrutamento. Posso ajudar com análise de prestadores, sugestões de match, criação de operações e muito mais.',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const response = onSend
        ? await onSend(input)
        : gerarRespostaMock(input, contexto)

      const assistantMsg: Message = {
        id: `assist_${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMsg])
    } catch {
      setMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        role: 'system',
        content: 'Desculpe, ocorreu um erro ao processar sua solicitação.',
        timestamp: new Date(),
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <PremiumCard className="flex flex-col h-[500px]">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">IA Operacional</p>
            <p className="text-[10px] text-muted-foreground/50">Contexto: {contexto}</p>
          </div>
        </div>
        <PremiumBadge variant="success" dot size="sm">Online</PremiumBadge>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 mb-3 custom-scrollbar">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'flex gap-2.5',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {msg.role !== 'user' && (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                  {msg.role === 'system' ? <Sparkles className="w-3.5 h-3.5 text-primary" /> : <Bot className="w-3.5 h-3.5 text-primary" />}
                </div>
              )}
              <div className={cn(
                'max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-tr-md'
                  : msg.role === 'system'
                    ? 'bg-muted/50 text-foreground/80 rounded-tl-md'
                    : 'bg-muted/30 text-foreground/80 rounded-tl-md'
              )}>
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              )}
            </motion.div>
          ))}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-2.5"
            >
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="bg-muted/30 rounded-2xl rounded-tl-md px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Digite sua mensagem..."
          className="h-9 bg-muted/30"
          disabled={loading}
        />
        <Button size="sm" className="h-9 w-9 p-0" onClick={handleSend} disabled={loading || !input.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </PremiumCard>
  )
}

function gerarRespostaMock(input: string, contexto: string): string {
  const lower = input.toLowerCase()
  if (lower.includes('score') || lower.includes('nota')) {
    return 'A pontuação média dos prestadores no banco é de 74 pontos. Os fatores considerados são: documentação (25%), experiência (25%), perfil (15%), reputação (15%), regularidade (10%) e tendência (10%).'
  }
  if (lower.includes('match') || lower.includes('compat')) {
    return 'O match inteligente considera: tipo de veículo (35%), região de atuação (30%), score geral (20%) e status do prestador (15%). Recomendo filtrar prestadores com score acima de 60 para melhores resultados.'
  }
  if (lower.includes('document') || lower.includes('doc')) {
    return 'Atualmente existem documentos pendentes de análise. Recomendo priorizar a validação dos documentos com prazo de validade próximo do vencimento para evitar bloqueios nas operações.'
  }
  if (lower.includes('oper') || lower.includes('vaga')) {
    return `Temos ${Math.floor(Math.random() * 10) + 3} operações ativas no momento. A taxa média de preenchimento de vagas é de 68%. Posso sugerir estratégias de divulgação para acelerar a captação.`
  }
  return 'Entendi sua solicitação! Com base nos dados disponíveis, posso ajudar com: análise de prestadores, match inteligente com operações, sugestões de melhoria de score, alertas de documentos pendentes e otimização do funil de recrutamento. Como posso ajudar?'
}