import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Upload, CheckCircle, XCircle, AlertTriangle,
  Clock, Search, Eye, Plus, MessageSquare, ShieldCheck,
  Calendar, Trash2, Check, AlertCircle, Sparkles, Filter, ChevronRight
} from 'lucide-react'
import { PremiumCard, PremiumCardHeader, PremiumCardTitle, PremiumCardContent } from '../design-system/PremiumCard'
import { PremiumBadge } from '../design-system/PremiumBadge'
import { MetricCard } from '../design-system/MetricCard'
import { EmptyState } from '../design-system/EmptyState'
import { StatusDot } from '../design-system/StatusDot'
import { documentosService } from '../../services/documentosService'
import { prestadoresService } from '../../services/prestadoresService'
import { useRecrutamentoStore } from '../../store/recrutamentoStore'
import { cn, statusDocumentoColor, statusLabel, formatDate } from '../../utils/cn'
import type { DocumentoPrestador, StatusDocumento, TipoDocumento } from '../../types/recrutamento'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { toast } from 'sonner'

interface CentralDocumentosProps {
  documentos?: DocumentoPrestador[]
  prestadorNome?: string
  onStatusChange?: (docId: string, status: StatusDocumento, obs?: string) => void
}

const TIPO_DOC_OPTIONS: { value: TipoDocumento; label: string }[] = [
  { value: 'cnh', label: 'CNH (Carteira Nacional de Habilitação)' },
  { value: 'cnpj', label: 'CNPJ / MEI' },
  { value: 'antt', label: 'ANTT (RNTRC)' },
  { value: 'crlv', label: 'CRLV (Documento do Veículo)' },
  { value: 'seguro', label: 'Seguro de Carga' },
  { value: 'contrato_social', label: 'Contrato Social' },
  { value: 'comprovante_endereco', label: 'Comprovante de Endereço' },
  { value: 'certificado_curso_mopp', label: 'MOPP' },
]

const TIPO_DOC_LABELS: Record<string, string> = {}
TIPO_DOC_OPTIONS.forEach(o => { TIPO_DOC_LABELS[o.value] = o.label })

export function CentralDocumentos({ onStatusChange }: CentralDocumentosProps) {
  const { prestadores, setPrestadores } = useRecrutamentoStore()
  const [buscaPrestador, setBuscaPrestador] = useState('')
  const [buscaDoc, setBuscaDoc] = useState('')
  const [selectedPrestadorId, setSelectedPrestadorId] = useState<string | null>(null)
  
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [newDocType, setNewDocType] = useState<TipoDocumento>('cnh')
  const [newDocValidade, setNewDocValidade] = useState('')
  const [newDocFile, setNewDocFile] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Select first prestador by default
  useEffect(() => {
    if (!selectedPrestadorId && prestadores.length > 0) {
      setSelectedPrestadorId(prestadores[0].id)
    }
  }, [prestadores, selectedPrestadorId])

  const selectedPrestador = useMemo(() => {
    return prestadores.find(p => p.id === selectedPrestadorId) || null
  }, [prestadores, selectedPrestadorId])

  const filteredPrestadores = useMemo(() => {
    return prestadores.filter(p => 
      p.nome.toLowerCase().includes(buscaPrestador.toLowerCase()) ||
      p.cpfCnpj.includes(buscaPrestador)
    )
  }, [prestadores, buscaPrestador])

  const prestadorDocs = useMemo(() => {
    if (!selectedPrestadorId) return []
    return (selectedPrestador?.documentos ?? []).filter(d => 
      d.tipo.toLowerCase().includes(buscaDoc.toLowerCase()) || d.nomeArquivo.toLowerCase().includes(buscaDoc.toLowerCase())
    )
  }, [selectedPrestador, buscaDoc])

  const metricas = useMemo(() => {
    return documentosService.obterMetricas(prestadorDocs)
  }, [prestadorDocs])

  const handleStatusChange = async (docId: string, status: StatusDocumento, obs?: string) => {
    if (!selectedPrestador) return
    try {
      const novosDocs = (selectedPrestador.documentos ?? []).map(doc => {
        if (doc.id === docId) {
          return {
            ...doc,
            status,
            dataAprovacao: status === 'aprovado' || status === 'reprovado' ? new Date().toISOString() : doc.dataAprovacao,
            aprovadoPor: 'Admin',
            observacao: obs ?? doc.observacao,
          }
        }
        return doc
      })
      await prestadoresService.atualizar(selectedPrestador.id, { documentos: novosDocs })
      const reloaded = await prestadoresService.listar()
      setPrestadores(reloaded)
      toast.success(`Status do documento atualizado para: ${statusLabel[status] || status}`)
      if (onStatusChange) {
        onStatusChange(docId, status, obs)
      }
    } catch {
      toast.error('Erro ao atualizar status do documento')
    }
  }

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPrestador || !selectedPrestadorId) return
    if (!newDocFile.trim()) {
      toast.error('Nome do arquivo ou anexo é obrigatório')
      return
    }

    setSalvando(true)
    try {
      const novoDoc: DocumentoPrestador = {
        id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        prestadorId: selectedPrestadorId,
        tipo: newDocType,
        status: 'pendente',
        url: '',
        nomeArquivo: newDocFile,
        dataEnvio: new Date().toISOString(),
        dataValidade: newDocValidade ? new Date(newDocValidade).toISOString() : '',
        dataAprovacao: '',
        aprovadoPor: '',
        observacao: '',
        versao: 1,
      }
      const documentosAtualizados = [...(selectedPrestador.documentos ?? []), novoDoc]
      await prestadoresService.atualizar(selectedPrestadorId, { documentos: documentosAtualizados })
      const reloaded = await prestadoresService.listar()
      setPrestadores(reloaded)
      toast.success('Documento adicionado com sucesso!')
      setAddModalOpen(false)
      setNewDocFile('')
      setNewDocValidade('')
    } catch {
      toast.error('Erro ao adicionar documento')
    } finally {
      setSalvando(false)
    }
  }

  const handleWhatsAppRequest = (docType: string) => {
    if (!selectedPrestador) return
    const whatsappContato = selectedPrestador.contatos.find(c => c.tipo === 'whatsapp' || c.tipo === 'telefone')
    const fone = whatsappContato ? whatsappContato.valor.replace(/\D/g, '') : ''
    const mensagem = encodeURIComponent(`Olá ${selectedPrestador.nome}, precisamos do envio do seu documento (${statusLabel[docType as TipoDocumento] || docType}) para ativação cadastral.`)
    
    if (fone) {
      window.open(`https://wa.me/55${fone}?text=${mensagem}`, '_blank')
    } else {
      toast.info('Contato WhatsApp não cadastrado para este prestador')
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Side: Prestadores Sidebar */}
        <PremiumCard className="lg:col-span-1 border-border/60 bg-card/60 backdrop-blur-sm h-[680px] flex flex-col justify-between overflow-hidden">
          <div className="p-4 border-b border-border/40 space-y-3">
            <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Prestadores</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
              <Input
                placeholder="Filtrar por nome ou CPF..."
                className="pl-9 h-9 text-xs bg-muted/20"
                value={buscaPrestador}
                onChange={(e) => setBuscaPrestador(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredPrestadores.map((p) => {
              const docsDoPrestador = (p.documentos ?? []) as DocumentoPrestador[]
              const count = docsDoPrestador.length
              const pend = docsDoPrestador.filter(d => d.status === 'pendente' || d.status === 'vencido').length
              const isSelected = p.id === selectedPrestadorId

              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPrestadorId(p.id)}
                  className={cn(
                    "w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between border",
                    isSelected 
                      ? "bg-primary/10 border-primary/30 text-primary shadow-sm" 
                      : "bg-transparent border-transparent hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-xs font-semibold truncate", isSelected ? "text-primary" : "text-foreground")}>{p.nome}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{p.tipoVeiculo} · {p.endereco.cidade}/{p.endereco.uf}</p>
                  </div>
                  <div className="flex items-center gap-1.5 ml-2">
                    {pend > 0 && (
                      <span className="w-4 h-4 rounded-full bg-amber-500/20 text-[9px] font-bold text-amber-500 flex items-center justify-center">
                        {pend}
                      </span>
                    )}
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted/40 text-muted-foreground/80 font-medium">
                      {count} docs
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-40 shrink-0" />
                  </div>
                </button>
              )
            })}
            {filteredPrestadores.length === 0 && (
              <p className="text-xs text-center text-muted-foreground/50 py-12">Nenhum prestador encontrado</p>
            )}
          </div>
        </PremiumCard>

        {/* Right Side: Document Central Details */}
        <div className="lg:col-span-2 space-y-4">
          {selectedPrestador ? (
            <>
              {/* Header metrics details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard title="Total" value={String(metricas.total)} icon={<FileText className="w-4 h-4" />} />
                <MetricCard title="Pendentes" value={String(metricas.pendentes)} icon={<Clock className="w-4 h-4" />} />
                <MetricCard title="Aprovados" value={String(metricas.aprovados)} icon={<CheckCircle className="w-4 h-4" />} />
                <MetricCard title="Taxa" value={`${metricas.taxaAprovacao}%`} icon={<Eye className="w-4 h-4" />} />
              </div>

              <PremiumCard className="border-border/60 bg-card/60 backdrop-blur-sm">
                <PremiumCardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/40 pb-4">
                  <div>
                    <PremiumCardTitle className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-primary" />
                      Documentos de {selectedPrestador.nome}
                    </PremiumCardTitle>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">CPF: {selectedPrestador.cpfCnpj} · {selectedPrestador.tipoVeiculo}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-xs font-medium gap-1 text-emerald-500 border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 hover:text-emerald-400"
                      onClick={() => handleWhatsAppRequest('cnh')}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Solicitar WhatsApp</span>
                    </Button>
                    <Button 
                      size="sm" 
                      className="text-xs font-semibold gap-1"
                      onClick={() => setAddModalOpen(true)}
                    >
                      <Plus className="w-4 h-4" />
                      <span>Adicionar manual</span>
                    </Button>
                  </div>
                </PremiumCardHeader>

                <PremiumCardContent className="p-4 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                    <Input 
                      placeholder="Buscar nesta lista de documentos..." 
                      className="pl-9 h-9 text-xs bg-muted/10 border-border/40" 
                      value={buscaDoc} 
                      onChange={(e) => setBuscaDoc(e.target.value)} 
                    />
                  </div>

                  <div className="space-y-2">
                    {prestadorDocs.map((doc) => (
                      <motion.div
                        key={doc.id}
                        layout
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/40 hover:border-primary/20 transition-all group"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
                            <FileText className="w-4.5 h-4.5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-foreground uppercase">
                                {TIPO_DOC_LABELS[doc.tipo] || doc.tipo}
                              </span>
                              <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-medium border', statusDocumentoColor[doc.status])}>
                                <StatusDot status={doc.status} />
                                {statusLabel[doc.status]}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50 mt-0.5">
                              <span className="truncate max-w-[150px] sm:max-w-none">{doc.nomeArquivo || 'Sem arquivo'}</span>
                              {doc.dataValidade && (
                                <span className={cn(
                                  "flex items-center gap-1",
                                  doc.status === 'vencido' ? 'text-rose-400 font-medium' : ''
                                )}>
                                  <Calendar className="w-2.5 h-2.5" />
                                  Validade: {formatDate(doc.dataValidade)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 ml-3 shrink-0">
                          {/* Approve/Reject actions for pending/validating */}
                          {(doc.status === 'pendente' || doc.status === 'validando' || doc.status === 'enviado') && (
                            <div className="flex items-center gap-1">
                              <Button
                                size="xs"
                                variant="outline"
                                className="h-7 w-7 p-0 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10"
                                onClick={() => handleStatusChange(doc.id, 'aprovado', 'Aprovado via central documental')}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                className="h-7 w-7 p-0 text-rose-400 border-rose-500/20 hover:bg-rose-500/10"
                                onClick={() => handleStatusChange(doc.id, 'reprovado', 'Documento inválido ou fora do padrão')}
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}

                          {/* Quick Whatsapp request button for each document */}
                          <Button
                            size="xs"
                            variant="ghost"
                            className="h-7 px-2 text-muted-foreground/50 hover:text-emerald-500 gap-1 text-[10px]"
                            onClick={() => handleWhatsAppRequest(doc.tipo)}
                          >
                            <MessageSquare className="w-3 h-3 text-emerald-500" />
                            <span className="hidden sm:inline">Pedir Whats</span>
                          </Button>
                        </div>
                      </motion.div>
                    ))}

                    {prestadorDocs.length === 0 && (
                      <EmptyState title="Nenhum documento" description="Cadastre novos documentos utilizando o botão acima." />
                    )}
                  </div>

                  {/* Fallback alert / notice box */}
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex gap-2.5 text-xs text-muted-foreground/80">
                    <Sparkles className="w-4.5 h-4.5 text-primary shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <p className="font-semibold text-foreground">API Integrada (Fallback Demonstrativo)</p>
                      <p className="mt-0.5 leading-relaxed">
                        A verificação automatizada de CNH e ANTT está rodando em modo sandbox de demonstração. Caso a API oficial do Denatran ou ANTT apresente instabilidade, o sistema automaticamente aplicará um algoritmo heurístico fallback baseado nos dados cadastrados do prestador.
                      </p>
                    </div>
                  </div>
                </PremiumCardContent>
              </PremiumCard>
            </>
          ) : (
            <EmptyState title="Nenhum prestador selecionado" description="Selecione um prestador na barra lateral para carregar seus documentos." />
          )}
        </div>
      </div>

      {/* Manual document adding Sheet/Modal */}
      <Sheet open={addModalOpen} onOpenChange={setAddModalOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-lg flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Adicionar documento manual
            </SheetTitle>
            <SheetDescription>
              Insira o registro e detalhes do documento do prestador selecionado para análise imediata.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleManualAdd} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Tipo de Documento</label>
              <select
                value={newDocType}
                onChange={(e) => setNewDocType(e.target.value as TipoDocumento)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
              >
                {TIPO_DOC_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Data de Validade</label>
              <input
                type="date"
                value={newDocValidade}
                onChange={(e) => setNewDocValidade(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Nome do arquivo / Descrição *</label>
              <input
                type="text"
                required
                placeholder="Ex: cnh_joao_silva.pdf"
                value={newDocFile}
                onChange={(e) => setNewDocFile(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
              />
            </div>

            <div className="pt-4 flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setAddModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={salvando}
              >
                {salvando ? 'Salvando...' : 'Salvar Documento'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}