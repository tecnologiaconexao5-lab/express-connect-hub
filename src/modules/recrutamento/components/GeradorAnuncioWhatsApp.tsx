import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Copy, MessageSquare, Save, AlertTriangle, CheckCircle, Send, Megaphone, X, Pencil } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, statusLabel, cn } from '../utils/cn'
import type { Operacao } from '../types/recrutamento'

interface GeradorAnuncioWhatsAppProps {
  operacao: Operacao
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface CampoAusente {
  campo: string
  label: string
}

function gerarAnuncio(op: Operacao): string {
  const linhas: string[] = [
    `🚛 *VAGA PARA PRESTADOR* 🚛`,
    ``,
    `🛻 *Veículo:* ${op.tipoVeiculo || 'Não informado'}`,
  ]

  if (op.cliente) linhas.push(`🏢 *Cliente:* ${op.cliente}`)
  if (op.rotaOrigem) linhas.push(`📍 *Origem:* ${op.rotaOrigem}`)
  if (op.regiao) linhas.push(`🎯 *Região de Entrega:* ${op.regiao}`)

  const produto = op.tipoCarga ? {
    seco: 'Carga Seca',
    refrigerado: 'Carga Refrigerada',
    perigoso: 'Carga Perigosa',
    fragil: 'Carga Frágil',
    alimenticio: 'Carga Alimentícia',
  }[op.tipoCarga] : null
  if (produto) linhas.push(`📦 *Produto:* ${produto}`)

  if (op.temperatura) linhas.push(`🌡️ *Temperatura:* ${op.temperatura}`)

  linhas.push('')
  linhas.push(`💰 *Valor do Frete:* ${formatCurrency(op.financeiro.valorPrestador)}`)

  if (op.financeiro.franquiaKm > 0) linhas.push(`📏 *Franquia KM:* ${op.financeiro.franquiaKm} km`)
  if (op.financeiro.valorKmExcedente > 0) linhas.push(`➕ *KM Excedente:* ${formatCurrency(op.financeiro.valorKmExcedente)}/km`)
  if (op.financeiro.formaPagamento) linhas.push(`💳 *Pagamento:* ${op.financeiro.formaPagamento}${op.financeiro.prazoPagamento ? ` (${op.financeiro.prazoPagamento} dias)` : ''}`)

  const freqLabel = statusLabel[op.frequencia] || op.frequencia
  if (freqLabel) linhas.push(`🔄 *Recorrência:* ${freqLabel}`)

  linhas.push('')
  linhas.push(`📊 *Vagas Disponíveis:* ${op.meta.vagasTotais}`)
  if (op.meta.diariasPorVaga > 1) linhas.push(`📅 *Diárias por Vaga:* ${op.meta.diariasPorVaga}`)

  linhas.push('')
  linhas.push(`👤 *Perfil Desejado:* Motorista com veículo compatível (${op.tipoVeiculo || 'categoria informada'}), documentação regular e disponibilidade para embarque imediato.`)

  if (op.observacoes) {
    linhas.push('')
    linhas.push(`📝 *Observações:* ${op.observacoes}`)
  }

  linhas.push('')
  linhas.push(`_📢 Vaga divulgada pelo Express Connect Hub_`)

  return linhas.join('\n')
}

function validarCampos(op: Operacao): CampoAusente[] {
  const ausentes: CampoAusente[] = []
  if (!op.tipoVeiculo) ausentes.push({ campo: 'tipoVeiculo', label: 'Tipo de Veículo' })
  if (!op.cliente) ausentes.push({ campo: 'cliente', label: 'Cliente' })
  if (!op.rotaOrigem) ausentes.push({ campo: 'rotaOrigem', label: 'Origem' })
  if (!op.regiao) ausentes.push({ campo: 'regiao', label: 'Região de Entrega' })
  if (!op.tipoCarga) ausentes.push({ campo: 'tipoCarga', label: 'Produto/Tipo de Carga' })
  if (op.financeiro.valorPrestador <= 0) ausentes.push({ campo: 'valorPrestador', label: 'Valor do Prestador' })
  if (op.financeiro.franquiaKm <= 0) ausentes.push({ campo: 'franquiaKm', label: 'Franquia KM' })
  if (op.financeiro.valorKmExcedente <= 0) ausentes.push({ campo: 'valorKmExcedente', label: 'KM Excedente' })
  if (!op.financeiro.formaPagamento) ausentes.push({ campo: 'formaPagamento', label: 'Forma de Pagamento' })
  if (!op.frequencia) ausentes.push({ campo: 'frequencia', label: 'Recorrência' })
  if (!op.meta.vagasTotais || op.meta.vagasTotais <= 0) ausentes.push({ campo: 'vagasTotais', label: 'Quantidade de Vagas' })
  return ausentes
}

export function GeradorAnuncioWhatsApp({ operacao: op, open, onOpenChange }: GeradorAnuncioWhatsAppProps) {
  const [editando, setEditando] = useState(false)
  const [textoEditado, setTextoEditado] = useState('')

  const anuncio = useMemo(() => gerarAnuncio(op), [op])
  const camposAusentes = useMemo(() => validarCampos(op), [op])

  const textoFinal = editando ? textoEditado : anuncio

  const handleCopiar = () => {
    navigator.clipboard.writeText(textoFinal)
    toast.success('Anúncio copiado para área de transferência!')
  }

  const handleWhatsApp = () => {
    const encoded = encodeURIComponent(textoFinal)
    window.open(`https://wa.me/?text=${encoded}`, '_blank')
  }

  const handleSalvarModelo = async () => {
    const titulo = `Anúncio - ${op.nome || op.tipoVeiculo || 'Operação'}`

    const msg = {
      id: `anuncio_${Date.now()}`,
      titulo: titulo.slice(0, 100),
      categoria: 'Captação de prestadores',
      texto: textoFinal,
      cliente_id: null,
      cliente_nome: null,
      cliente_documento: null,
    }

    const localKey = 'conexao_mensagens_rapidas'
    try {
      const local = localStorage.getItem(localKey)
      const msgs = local ? JSON.parse(local) : []
      msgs.push(msg)
      localStorage.setItem(localKey, JSON.stringify(msgs))
    } catch { /* ignore */ }

    try {
      await supabase.from('modelos_mensagens').upsert([{
        id: msg.id,
        titulo: msg.titulo,
        categoria: msg.categoria,
        texto: msg.texto,
        cliente_id: null,
        cliente_nome: null,
        cliente_documento: null,
        updated_at: new Date().toISOString(),
      }], { onConflict: 'id' })
    } catch {
      toast.warning('Salvo localmente. Tabela modelos_mensagens indisponível no servidor.')
    }

    toast.success('Modelo salvo em Biblioteca > Mensagens Rápidas!')
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setEditando(false) }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Megaphone className="w-5 h-5 text-primary" />
            Gerar Anúncio para Prestador
          </DialogTitle>
          <DialogDescription>
            Anúncio profissional para divulgação em WhatsApp e grupos de prestadores
          </DialogDescription>
        </DialogHeader>

        {camposAusentes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20"
          >
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-300">
              <p className="font-semibold mb-1">Campos não preenchidos — o anúncio pode ficar incompleto:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {camposAusentes.map(c => (
                  <li key={c.campo}>{c.label}</li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}

        {camposAusentes.length === 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
            <CheckCircle className="w-4 h-4 shrink-0" />
            Todos os campos obrigatórios preenchidos. Anúncio completo!
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Prévia do Anúncio</Label>
            <button
              onClick={() => {
                if (editando) {
                  setTextoEditado(anuncio)
                  setEditando(false)
                } else {
                  setTextoEditado(anuncio)
                  setEditando(true)
                }
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {editando ? <X className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
              {editando ? 'Cancelar edição' : 'Editar'}
            </button>
          </div>
          {editando ? (
            <Textarea
              value={textoEditado}
              onChange={e => setTextoEditado(e.target.value)}
              className="font-mono text-xs leading-relaxed min-h-[300px] resize-y"
            />
          ) : (
            <div className="font-mono text-xs leading-relaxed whitespace-pre-wrap p-4 rounded-lg bg-muted/30 border border-border/40 min-h-[200px] max-h-[400px] overflow-y-auto">
              {anuncio}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopiar}>
            <Copy className="w-3.5 h-3.5" /> Copiar
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleWhatsApp}>
            <MessageSquare className="w-3.5 h-3.5" /> Enviar WhatsApp
          </Button>
          <Button size="sm" className="gap-1.5" onClick={handleSalvarModelo}>
            <Save className="w-3.5 h-3.5" /> Salvar como Modelo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
