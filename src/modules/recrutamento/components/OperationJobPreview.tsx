/**
 * OperationJobPreview.tsx
 * Preview em tempo real do anúncio operacional profissional
 * Formatado como WhatsApp, atualiza enquanto usuário preenche
 */

import { useMemo, useState } from 'react'
import { Copy, MessageSquare, AlertCircle, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  buildOperationAnnouncement,
  exportarAnuncioTexto,
  validarOperacaoParaAnuncio,
} from '../utils/buildOperationAnnouncement'
import type { Operacao } from '../types/recrutamento'
import type { LogisticaOperacao } from '../types/operationAnnouncement'

interface OperationJobPreviewProps {
  operacao: Operacao
  logistica: LogisticaOperacao
  // Props opcionais para controle de UI
  tamanho?: 'pequeno' | 'medio' | 'grande'
  mostrarValidacao?: boolean
  mostrarBotoesAcao?: boolean
  className?: string
}

/**
 * Componente principal de preview
 */
export function OperationJobPreview({
  operacao,
  logistica,
  tamanho = 'medio',
  mostrarValidacao = true,
  mostrarBotoesAcao = true,
  className = '',
}: OperationJobPreviewProps) {
  const [copiado, setCopiado] = useState(false)

  // Construir anúncio profissional
  const anuncio = useMemo(() => {
    return buildOperationAnnouncement(operacao, logistica, {
      incluirCTA: true,
      mostrarObservacoes: true,
      temaEmojis: true,
      formatoWhatsApp: true,
    })
  }, [operacao, logistica])

  // Exportar como texto
  const textoAnuncio = useMemo(() => {
    return exportarAnuncioTexto(anuncio)
  }, [anuncio])

  // Validar campos
  const validacao = useMemo(() => {
    return validarOperacaoParaAnuncio(operacao, logistica)
  }, [operacao, logistica])

  // Dimensões do card baseado no tamanho
  const alturas = {
    pequeno: 'h-64',
    medio: 'h-96',
    grande: 'h-screen',
  }

  const handleCopiar = () => {
    navigator.clipboard.writeText(textoAnuncio)
    setCopiado(true)
    toast.success('Anúncio copiado para clipboard!')
    setTimeout(() => setCopiado(false), 2000)
  }

  const handleEnviarWhatsApp = () => {
    // URL encoded para WhatsApp Web
    const mensagem = encodeURIComponent(textoAnuncio)
    const url = `https://api.whatsapp.com/send?text=${mensagem}`
    window.open(url, '_blank')
    toast.success('Abrindo WhatsApp...')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      <Card className="border-2 border-dashed border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
        <CardHeader className="border-b bg-white">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5 text-purple-600" />
              Prévia da Divulgação
            </CardTitle>
            <Badge variant={validacao.valido ? 'default' : 'destructive'}>
              {validacao.valido ? '✓ Pronto' : '⚠ Incompleto'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="flex gap-4 p-4">
            {/* SEÇÃO DE PREVIEW */}
            <div className={`flex-1 ${alturas[tamanho]} overflow-y-auto rounded-lg bg-white p-4 shadow-sm`}>
              {/* Renderizar anúncio formatado */}
              <PreviewConteudo textoAnuncio={textoAnuncio} />
            </div>

            {/* SEÇÃO DE VALIDAÇÃO E AÇÕES */}
            <div className="flex w-64 flex-col gap-3">
              {/* Validação */}
              {mostrarValidacao && !validacao.valido && (
                <Alert variant="destructive" className="border-red-300 bg-red-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <div className="font-semibold">Campos faltantes:</div>
                    <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
                      {validacao.erros.map((erro, idx) => (
                        <li key={idx}>{erro}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {mostrarValidacao && validacao.valido && (
                <Alert className="border-green-300 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-sm text-green-800">
                    ✓ Anúncio validado e pronto para divulgação
                  </AlertDescription>
                </Alert>
              )}

              {/* Botões de ação */}
              {mostrarBotoesAcao && validacao.valido && (
                <div className="space-y-2">
                  <Button
                    onClick={handleCopiar}
                    variant="outline"
                    size="sm"
                    className="w-full justify-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    {copiado ? 'Copiado!' : 'Copiar Texto'}
                  </Button>

                  <Button
                    onClick={handleEnviarWhatsApp}
                    size="sm"
                    className="w-full justify-center gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Enviar WhatsApp
                  </Button>
                </div>
              )}

              {/* Info de campos confidenciais */}
              <div className="rounded-md bg-blue-50 p-2 text-xs text-blue-700">
                <div className="font-semibold mb-1">🔒 Confidencial</div>
                <p>Este preview mostra SOMENTE informações públicas. Dados financeiros internos não aparecem.</p>
              </div>

              {/* Estatísticas */}
              <div className="rounded-md bg-gray-100 p-2 text-xs text-gray-700 space-y-1">
                <div>
                  <span className="font-semibold">Caracteres:</span> {textoAnuncio.length}
                </div>
                <div>
                  <span className="font-semibold">Linhas:</span> {textoAnuncio.split('\n').length}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/**
 * Sub-componente: renderiza conteúdo formatado do anúncio
 */
function PreviewConteudo({ textoAnuncio }: { textoAnuncio: string }) {
  // Renderizar com quebras de linha, emojis e formatação WhatsApp-like
  const linhas = textoAnuncio.split('\n')

  return (
    <div className="space-y-0 text-sm leading-relaxed font-mono text-gray-800 whitespace-pre-wrap break-words">
      <AnimatePresence mode="popLayout">
        {linhas.map((linha, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.01 }}
            className={getStylesParaLinha(linha)}
          >
            {renderizarLinha(linha)}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/**
 * Retorna classes CSS baseado no conteúdo da linha
 */
function getStylesParaLinha(linha: string): string {
  if (!linha.trim()) return 'h-1'
  if (linha.includes('━━')) return 'text-gray-300 font-light opacity-70'
  if (linha.match(/^\*[^*]+\*$/)) return 'font-bold text-gray-900 mt-2'
  if (linha.startsWith('✔') || linha.startsWith('•')) return 'text-gray-700 ml-2'
  if (linha.startsWith('📌')) return 'text-blue-600 font-semibold ml-1'
  if (linha.includes('IMPORTANTE')) return 'font-bold text-orange-600 mt-2'
  if (linha.startsWith('_')) return 'text-gray-500 italic text-xs'
  return 'text-gray-700'
}

/**
 * Renderiza linha com formatação WhatsApp
 */
function renderizarLinha(linha: string): string {
  // Remover _ (itálico WhatsApp) para melhor legibilidade
  return linha.replace(/^_/, '').replace(/_$/, '')
}

/**
 * Versão compacta para sidebar/lateral
 */
export function OperationJobPreviewCompacto({
  operacao,
  logistica,
}: {
  operacao: Operacao
  logistica: LogisticaOperacao
}) {
  const anuncio = useMemo(() => {
    return buildOperationAnnouncement(operacao, logistica)
  }, [operacao, logistica])

  const textoAnuncio = useMemo(() => {
    return exportarAnuncioTexto(anuncio)
  }, [anuncio])

  const validacao = useMemo(() => {
    return validarOperacaoParaAnuncio(operacao, logistica)
  }, [operacao, logistica])

  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
      <div className="mb-2 text-xs font-semibold text-purple-900">PREVIEW</div>
      <div className="mb-2 max-h-40 overflow-y-auto rounded bg-white p-2 text-xs leading-tight text-gray-700 font-mono">
        {textoAnuncio.split('\n').slice(0, 15).join('\n')}
        {textoAnuncio.split('\n').length > 15 && '\n... [continua]'}
      </div>
      <Badge
        variant={validacao.valido ? 'default' : 'destructive'}
        className="w-full justify-center py-1"
      >
        {validacao.valido ? '✓ Pronto' : '⚠ Incomplete'}
      </Badge>
    </div>
  )
}

export default OperationJobPreview
