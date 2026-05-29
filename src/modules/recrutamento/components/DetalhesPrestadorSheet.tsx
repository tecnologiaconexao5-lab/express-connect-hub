import { useState, useMemo, useEffect } from 'react'
import { Truck, MapPin, Phone, Mail, Star, FileText, Calendar, User, Shield, Award, Copy, Save, MessageSquare, XCircle, CheckCircle, Clock, Thermometer, Hash, HeartHandshake, BarChart3, Activity, AlertTriangle, Plus } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PremiumBadge } from './design-system/PremiumBadge'
import { StatusDot } from './design-system/StatusDot'
import { ScoreMeter } from './score/ScoreMeter'
import { CrmLogistico } from './crm/CrmLogistico'
import { useRecrutamentoStore } from '../store/recrutamentoStore'
import { usePrestadores } from '../hooks/usePrestadores'
import { crmService } from '../services/crmService'
import { formatCurrency, formatDate, statusPrestadorColor, statusLabel, cn, formatPercent } from '../utils/cn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import type { Prestador, StatusPrestador, TipoCargaVeiculo, OrigemCadastro, CrmInteracao } from '../types/recrutamento'

interface DetalhesPrestadorSheetProps {
  prestadorId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTab?: string
  initialEdit?: boolean
}

const TIPO_CARGA_OPTIONS: { value: TipoCargaVeiculo; label: string }[] = [
  { value: 'seco', label: 'Seco' },
  { value: 'refrigerado', label: 'Refrigerado' },
  { value: 'termico', label: 'Térmico' },
  { value: 'ambos', label: 'Ambos' },
]

const ORIGEM_OPTIONS: { value: OrigemCadastro; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'site', label: 'Site' },
  { value: 'manual', label: 'Manual' },
  { value: 'fretebras', label: 'Fretebras' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'anuncio', label: 'Anúncio' },
  { value: 'outro', label: 'Outro' },
]

const STATUS_OPTIONS: StatusPrestador[] = ['novo', 'em_analise', 'aprovado', 'reserva', 'agregado', 'bloqueado']

export function DetalhesPrestadorSheet({ prestadorId, open, onOpenChange, defaultTab = 'perfil', initialEdit = false }: DetalhesPrestadorSheetProps) {
  const { prestadores } = useRecrutamentoStore()
  const { atualizar } = usePrestadores()
  const [editando, setEditando] = useState(initialEdit)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState(defaultTab)

  const prestador = useMemo(() => prestadores.find(p => p.id === prestadorId), [prestadores, prestadorId])

  const [form, setForm] = useState<Partial<Prestador> | null>(null)
  const [crmInteracoes, setCrmInteracoes] = useState<CrmInteracao[]>([])

  useEffect(() => {
    if (prestador && !editando) {
      setForm({ ...prestador })
    }
  }, [prestador, editando])

  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab)
      setEditando(initialEdit)
      if (prestadorId) {
        crmService.listarPorPrestador(prestadorId).then(setCrmInteracoes)
      }
    }
  }, [open, prestadorId, defaultTab, initialEdit])

  const handleCrmRefresh = () => {
    if (prestadorId) {
      crmService.listarPorPrestador(prestadorId).then(setCrmInteracoes)
    }
  }

  if (!prestador || !form) return null

  const handleSave = async () => {
    if (!form || !prestador) return
    setSaving(true)
    try {
      await atualizar(prestador.id, form)
      toast.success('Prestador atualizado!')
      setEditando(false)
    } catch {
      setForm({ ...prestador })
      toast.error('Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0">
      <span className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center text-muted-foreground shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  )

  const SectionDivider = ({ title }: { title: string }) => (
    <div className="flex items-center gap-2 py-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">{title}</span>
      <div className="flex-1 h-px bg-border/30" />
    </div>
  )

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</Label>
      {children}
    </div>
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg flex items-center gap-2">
                {prestador.nome}
                <button
                  onClick={() => setEditando(!editando)}
                  className="text-[10px] text-primary/70 hover:text-primary"
                >
                  {editando ? 'Cancelar' : 'Editar'}
                </button>
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2 mt-1">
                <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border', statusPrestadorColor[prestador.status])}>
                  <StatusDot status={prestador.status} />
                  {statusLabel[prestador.status]}
                </span>
                <ScoreMeter score={prestador.score.geral} size="sm" />
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-4 h-9 mb-4">
            <TabsTrigger value="perfil" className="text-[10px] gap-1"><User className="w-3 h-3" /> Perfil</TabsTrigger>
            <TabsTrigger value="veiculo" className="text-[10px] gap-1"><Truck className="w-3 h-3" /> Veículo</TabsTrigger>
            <TabsTrigger value="historico" className="text-[10px] gap-1"><Activity className="w-3 h-3" /> Histórico</TabsTrigger>
            <TabsTrigger value="score" className="text-[10px] gap-1"><Award className="w-3 h-3" /> Score</TabsTrigger>
          </TabsList>
          <TabsList className="w-full grid grid-cols-3 h-9 mb-4">
            <TabsTrigger value="documentos" className="text-[10px] gap-1"><FileText className="w-3 h-3" /> Documentos</TabsTrigger>
            <TabsTrigger value="crm" className="text-[10px] gap-1"><HeartHandshake className="w-3 h-3" /> CRM</TabsTrigger>
            <TabsTrigger value="operacoes" className="text-[10px] gap-1"><Truck className="w-3 h-3" /> Operações</TabsTrigger>
          </TabsList>

          <TabsContent value="perfil" className="space-y-4 mt-0">
            {editando ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nome">
                  <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} className="h-8 text-xs" />
                </Field>
                <Field label="CPF/CNPJ">
                  <Input value={form.cpfCnpj} onChange={e => setForm({ ...form, cpfCnpj: e.target.value })} className="h-8 text-xs" />
                </Field>
                <Field label="RG/IE">
                  <Input value={form.rg} onChange={e => setForm({ ...form, rg: e.target.value })} className="h-8 text-xs" />
                </Field>
                <Field label="Data Nascimento">
                  <Input type="date" value={form.dataNascimento} onChange={e => setForm({ ...form, dataNascimento: e.target.value })} className="h-8 text-xs" />
                </Field>
                <Field label="Status">
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as StatusPrestador })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Origem Cadastro">
                  <Select value={form.origemCadastro} onValueChange={v => setForm({ ...form, origemCadastro: v as OrigemCadastro })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ORIGEM_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Telefone WhatsApp">
                  <Input value={form.contatos?.find(c => c.tipo === 'whatsapp' || c.tipo === 'telefone')?.valor || ''}
                    onChange={e => setForm({ ...form, contatos: [...(form.contatos?.filter(c => c.tipo !== 'whatsapp' && c.tipo !== 'telefone') || []), { tipo: 'whatsapp' as const, valor: e.target.value, principal: true }] })}
                    className="h-8 text-xs" />
                </Field>
                <Field label="Email">
                  <Input value={form.contatos?.find(c => c.tipo === 'email')?.valor || ''}
                    onChange={e => setForm({ ...form, contatos: [...(form.contatos?.filter(c => c.tipo !== 'email') || []), { tipo: 'email' as const, valor: e.target.value, principal: false }] })}
                    className="h-8 text-xs" />
                </Field>
                <div className="col-span-2">
                  <Field label="Cidade / UF">
                    <div className="grid grid-cols-3 gap-2">
                      <Input value={form.endereco?.cidade || ''} onChange={e => setForm({ ...form, endereco: { ...form.endereco!, cidade: e.target.value } })} placeholder="Cidade" className="col-span-2 h-8 text-xs" />
                      <Input value={form.endereco?.uf || ''} onChange={e => setForm({ ...form, endereco: { ...form.endereco!, uf: e.target.value } })} placeholder="UF" className="h-8 text-xs" />
                    </div>
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="Regiões Atendidas (separadas por vírgula)">
                    <Input value={form.regioesAtuacao?.join(', ') || ''}
                      onChange={e => setForm({ ...form, regioesAtuacao: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                      placeholder="São Paulo, Rio de Janeiro, Minas Gerais" className="h-8 text-xs" />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="Tags (separadas por vírgula)">
                    <Input value={form.tags?.join(', ') || ''}
                      onChange={e => setForm({ ...form, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                      placeholder="refrigerado, emergência, sênior" className="h-8 text-xs" />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="Observações">
                    <Textarea value={form.observacoes || ''} onChange={e => setForm({ ...form, observacoes: e.target.value })} className="text-xs min-h-[60px] resize-none" />
                  </Field>
                </div>
              </div>
            ) : (
              <div>
                <SectionDivider title="Identificação" />
                <InfoRow icon={<User className="w-4 h-4" />} label="Nome / Razão Social" value={`${prestador.nome} (${prestador.razaoSocial})`} />
                <InfoRow icon={<Hash className="w-4 h-4" />} label="CPF/CNPJ" value={prestador.cpfCnpj} />
                <InfoRow icon={<Calendar className="w-4 h-4" />} label="Data Nascimento" value={prestador.dataNascimento ? formatDate(prestador.dataNascimento) : '---'} />
                <InfoRow icon={<MapPin className="w-4 h-4" />} label="Localização" value={`${prestador.endereco.cidade}/${prestador.endereco.uf}`} />
                <InfoRow icon={<Star className="w-4 h-4" />} label="Origem Cadastro" value={(() => {
                  const labels: Record<string, string> = {
                    whatsapp: 'WhatsApp', indicacao: 'Indicação', site: 'Site',
                    manual: 'Manual', fretebras: 'Fretebras', facebook: 'Facebook',
                    linkedin: 'LinkedIn', anuncio: 'Anúncio', outro: 'Outro',
                  }
                  return labels[prestador.origemCadastro] || prestador.origemCadastro
                })()} />
                <InfoRow icon={<Calendar className="w-4 h-4" />} label="Cadastro" value={formatDate(prestador.dataCadastro)} />

                <SectionDivider title="Contato" />
                {prestador.contatos.map((c, i) => (
                  <InfoRow key={i} icon={c.tipo === 'email' ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                    label={c.tipo === 'email' ? 'Email' : c.tipo === 'whatsapp' ? 'WhatsApp' : 'Telefone'}
                    value={`${c.valor}${c.principal ? ' (principal)' : ''}`} />
                ))}

                {prestador.regioesAtuacao.length > 0 && (
                  <>
                    <SectionDivider title="Regiões Atendidas" />
                    <div className="flex flex-wrap gap-1.5">
                      {prestador.regioesAtuacao.map(r => (
                        <span key={r} className="px-2 py-1 rounded-md bg-muted/30 text-[10px] font-medium text-muted-foreground">{r}</span>
                      ))}
                    </div>
                  </>
                )}

                {prestador.tags.length > 0 && (
                  <>
                    <SectionDivider title="Tags" />
                    <div className="flex flex-wrap gap-1.5">
                      {prestador.tags.map(t => (
                        <span key={t} className="px-2 py-1 rounded-md bg-primary/10 text-[10px] font-medium text-primary">{t}</span>
                      ))}
                    </div>
                  </>
                )}

                {prestador.observacoes && (
                  <>
                    <SectionDivider title="Observações" />
                    <div className="p-3 rounded-lg bg-muted/20 text-sm text-muted-foreground leading-relaxed">{prestador.observacoes}</div>
                  </>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="veiculo" className="space-y-4 mt-0">
            {editando ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo Veículo">
                  <Input value={form.tipoVeiculo} onChange={e => setForm({ ...form, tipoVeiculo: e.target.value })} className="h-8 text-xs" />
                </Field>
                <Field label="Placa">
                  <Input value={form.placaVeiculo} onChange={e => setForm({ ...form, placaVeiculo: e.target.value })} className="h-8 text-xs" />
                </Field>
                <Field label="Tipo Carga">
                  <Select value={form.tipoCargaVeiculo} onValueChange={v => setForm({ ...form, tipoCargaVeiculo: v as TipoCargaVeiculo })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPO_CARGA_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Disponibilidade">
                  <Select value={form.disponibilidade} onValueChange={v => setForm({ ...form, disponibilidade: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Imediata">Imediata</SelectItem>
                      <SelectItem value="24h">24 horas</SelectItem>
                      <SelectItem value="48h">48 horas</SelectItem>
                      <SelectItem value="Semanal">Semanal</SelectItem>
                      <SelectItem value="Sob consulta">Sob consulta</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Capacidade (kg)">
                  <Input type="number" value={form.capacidadeKg || ''} onChange={e => setForm({ ...form, capacidadeKg: parseInt(e.target.value) || 0 })} className="h-8 text-xs" />
                </Field>
                <Field label="Capacidade (m³)">
                  <Input type="number" value={form.capacidadeM3 || ''} onChange={e => setForm({ ...form, capacidadeM3: parseInt(e.target.value) || 0 })} className="h-8 text-xs" />
                </Field>
                <Field label="Eixos">
                  <Input type="number" value={form.eixos || ''} onChange={e => setForm({ ...form, eixos: parseInt(e.target.value) || 0 })} className="h-8 text-xs" />
                </Field>
              </div>
            ) : (
              <div>
                <SectionDivider title="Informações do Veículo" />
                <InfoRow icon={<Truck className="w-4 h-4" />} label="Tipo Veículo" value={prestador.tipoVeiculo || '---'} />
                <InfoRow icon={<Hash className="w-4 h-4" />} label="Placa" value={prestador.placaVeiculo || '---'} />
                <InfoRow icon={<Thermometer className="w-4 h-4" />} label="Tipo Carga" value={statusLabel[prestador.tipoCargaVeiculo] || prestador.tipoCargaVeiculo} />
                <InfoRow icon={<Clock className="w-4 h-4" />} label="Disponibilidade" value={prestador.disponibilidade || '---'} />
                <InfoRow icon={<Award className="w-4 h-4" />} label="Capacidade" value={`${prestador.capacidadeKg} kg / ${prestador.capacidadeM3} m³`} />
                <InfoRow icon={<Hash className="w-4 h-4" />} label="Eixos" value={String(prestador.eixos)} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="historico" className="space-y-4 mt-0">
            {editando ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Já carregou conosco?">
                  <Select value={form.historico?.jaCarregouConosco ? 'sim' : 'nao'} onValueChange={v => setForm({ ...form, historico: { ...form.historico!, jaCarregouConosco: v === 'sim' } })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Qtd. Operações">
                  <Input type="number" value={form.historico?.quantidadeOperacoes || 0}
                    onChange={e => setForm({ ...form, historico: { ...form.historico!, quantidadeOperacoes: parseInt(e.target.value) || 0 } })}
                    className="h-8 text-xs" />
                </Field>
                <Field label="Última Operação">
                  <Input type="date" value={form.historico?.ultimaOperacao || ''}
                    onChange={e => setForm({ ...form, historico: { ...form.historico!, ultimaOperacao: e.target.value } })}
                    className="h-8 text-xs" />
                </Field>
                <Field label="Clientes Atendidos">
                  <Input value={form.historico?.clientesAtendidos?.join(', ') || ''}
                    onChange={e => setForm({ ...form, historico: { ...form.historico!, clientesAtendidos: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } })}
                    className="h-8 text-xs" placeholder="Cliente A, Cliente B" />
                </Field>
                <Field label="Média Pontualidade (0-10)">
                  <Input type="number" min="0" max="10" step="0.1" value={form.historico?.mediaPontualidade || 0}
                    onChange={e => setForm({ ...form, historico: { ...form.historico!, mediaPontualidade: parseFloat(e.target.value) || 0 } })}
                    className="h-8 text-xs" />
                </Field>
                <Field label="Média Ocorrências">
                  <Input type="number" min="0" step="0.1" value={form.historico?.mediaOcorrencias || 0}
                    onChange={e => setForm({ ...form, historico: { ...form.historico!, mediaOcorrencias: parseFloat(e.target.value) || 0 } })}
                    className="h-8 text-xs" />
                </Field>
                <Field label="Avaliação Operacional (0-10)">
                  <Input type="number" min="0" max="10" step="0.1" value={form.historico?.avaliacaoOperacional || 0}
                    onChange={e => setForm({ ...form, historico: { ...form.historico!, avaliacaoOperacional: parseFloat(e.target.value) || 0 } })}
                    className="h-8 text-xs" />
                </Field>
                <Field label="Melhor Perfil Operação">
                  <Input value={form.historico?.melhorPerfilOperacao || ''}
                    onChange={e => setForm({ ...form, historico: { ...form.historico!, melhorPerfilOperacao: e.target.value } })}
                    className="h-8 text-xs" placeholder="Ex: Rota Curta, Carga Fracionada" />
                </Field>
              </div>
            ) : (
              <div>
                <SectionDivider title="Histórico Operacional" />
                <InfoRow icon={prestador.historico?.jaCarregouConosco ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}
                  label="Já carregou conosco?" value={prestador.historico?.jaCarregouConosco ? 'Sim' : 'Não'} />
                <InfoRow icon={<BarChart3 className="w-4 h-4" />} label="Operações Realizadas" value={String(prestador.historico?.quantidadeOperacoes || 0)} />
                {prestador.historico?.ultimaOperacao && (
                  <InfoRow icon={<Calendar className="w-4 h-4" />} label="Última Operação" value={formatDate(prestador.historico.ultimaOperacao)} />
                )}
                {prestador.historico?.clientesAtendidos && prestador.historico.clientesAtendidos.length > 0 && (
                  <>
                    <SectionDivider title="Clientes Atendidos" />
                    <div className="flex flex-wrap gap-1.5">
                      {prestador.historico.clientesAtendidos.map(c => (
                        <span key={c} className="px-2 py-1 rounded-md bg-muted/30 text-[10px] font-medium text-muted-foreground">{c}</span>
                      ))}
                    </div>
                  </>
                )}
                <SectionDivider title="Indicadores" />
                <InfoRow icon={<Activity className="w-4 h-4" />} label="Média Pontualidade" value={prestador.historico?.mediaPontualidade ? `${prestador.historico.mediaPontualidade.toFixed(1)}/10` : '---'} />
                <InfoRow icon={<AlertTriangle className="w-4 h-4" />} label="Média Ocorrências" value={String(prestador.historico?.mediaOcorrencias ?? '---')} />
                <InfoRow icon={<Star className="w-4 h-4" />} label="Avaliação Operacional" value={prestador.historico?.avaliacaoOperacional ? `${prestador.historico.avaliacaoOperacional.toFixed(1)}/10` : '---'} />
                {prestador.historico?.melhorPerfilOperacao && (
                  <InfoRow icon={<Truck className="w-4 h-4" />} label="Melhor Perfil" value={prestador.historico.melhorPerfilOperacao} />
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="score" className="space-y-4 mt-0">
            <div className="flex flex-col items-center py-4">
              <ScoreMeter score={prestador.score.geral} size="lg" />
              <p className="text-lg font-bold text-foreground mt-2">{prestador.score.geral}</p>
              <p className="text-xs text-muted-foreground">Score Geral</p>
            </div>

            <SectionDivider title="Detalhamento" />
            <div className="space-y-2">
              {[
                { label: 'Documentação', value: prestador.score.documentacao },
                { label: 'Experiência', value: prestador.score.experiencia },
                { label: 'Perfil', value: prestador.score.perfil },
                { label: 'Reputação', value: prestador.score.reputacao },
                { label: 'Regularidade', value: prestador.score.regularidade },
                { label: 'Tendência', value: prestador.score.tendencia },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3 py-1.5">
                  <span className="text-xs text-muted-foreground w-24">{item.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
                    <div className="h-full rounded-full bg-primary/60" style={{ width: `${Math.min(100, item.value)}%` }} />
                  </div>
                  <span className="text-xs font-medium text-foreground w-8 text-right">{item.value}</span>
                </div>
              ))}
            </div>

            {prestador.score.ultimaAtualizacao && (
              <p className="text-[10px] text-muted-foreground/50 text-center pt-2">
                Última atualização: {formatDate(prestador.score.ultimaAtualizacao)}
              </p>
            )}
          </TabsContent>

          <TabsContent value="documentos" className="space-y-4 mt-0">
            {prestador.documentos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                Nenhum documento cadastrado
              </div>
            ) : (
              prestador.documentos.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/30">
                  <StatusDot status={doc.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{(() => {
                      const tipos: Record<string, string> = {
                        cnh: 'CNH', cnpj: 'CNPJ', crlv: 'CRLV', antt: 'ANTT',
                        seguro: 'Seguro', contrato_social: 'Contrato Social',
                        comprovante_endereco: 'Comprovante', certificado_curso_mopp: 'MOPP',
                        certidao_federal: 'Cert. Federal', certidao_estadual: 'Cert. Estadual',
                        certidao_municipal: 'Cert. Municipal', certidao_trabalhista: 'Cert. Trabalhista',
                      }
                      return tipos[doc.tipo] || doc.tipo
                    })()}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {doc.dataValidade ? `Validade: ${formatDate(doc.dataValidade)}` : 'Sem validade'}
                    </p>
                  </div>
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', {
                    'text-emerald-400 bg-emerald-500/10': doc.status === 'aprovado',
                    'text-amber-400 bg-amber-500/10': doc.status === 'pendente' || doc.status === 'enviado' || doc.status === 'validando',
                    'text-rose-400 bg-rose-500/10': doc.status === 'reprovado' || doc.status === 'vencido',
                  })}>
                    {statusLabel[doc.status]}
                  </span>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="crm" className="space-y-4 mt-0">
            <CrmLogistico
              interacoes={crmInteracoes}
              prestadorId={prestador?.id}
              prestadorNome={prestador?.nome}
              onRefresh={handleCrmRefresh}
            />
          </TabsContent>

          <TabsContent value="operacoes" className="space-y-4 mt-0">
            <div className="text-center py-8 text-muted-foreground text-xs">
              <Truck className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
              Operações indicadas para este prestador serão exibidas aqui.
            </div>
          </TabsContent>
        </Tabs>

        {editando && (
          <div className="sticky bottom-0 pt-4 pb-2 bg-background border-t border-border/40 mt-4">
            <Button onClick={handleSave} disabled={saving} className="w-full gap-1.5">
              {saving ? 'Salvando...' : <><Save className="w-4 h-4" /> Salvar Alterações</>}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
