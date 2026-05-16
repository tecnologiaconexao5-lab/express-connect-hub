import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PlusCircle, Save, ArrowRight, ArrowLeft, Send, DollarSign, Truck, MapPin, Route, Calendar, Target, FileText, Info, AlertTriangle } from 'lucide-react'
import { PageHeader } from '../components/design-system/PageHeader'
import { PremiumCard, PremiumCardHeader, PremiumCardTitle, PremiumCardContent } from '../components/design-system/PremiumCard'
import { PremiumBadge } from '../components/design-system/PremiumBadge'
import { useOperacoes } from '../hooks/useOperacoes'
import { useRecrutamentoUI } from '../hooks/useRecrutamentoUI'
import { formatCurrency, cn } from '../utils/cn'
import type { Operacao, TipoCarga, Recurrencia, PrioridadeOperacao } from '../types/recrutamento'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

const TIPOS_VEICULO = ['Fiorino', 'Kangoo', 'Kombi', 'Van', 'VUC', 'HR', '3/4', 'Toco', 'Truck', 'Carreta', 'Bitrem', 'Carreta LS']

export function PaginaNovaOperacao() {
  const { criar } = useOperacoes()
  const { navegar } = useRecrutamentoUI()
  const [passo, setPasso] = useState(1)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<Operacao>>({
    nome: '',
    cliente: '',
    regiao: '',
    rotaOrigem: '',
    rotaDestino: '',
    tipoVeiculo: '',
    tipoCarga: 'seco',
    pesoCarga: '',
    dimensoes: '',
    localCarregamento: '',
    localDescarregamento: '',
    horarioCarregamento: '',
    horarioDescarregamento: '',
    dataInicio: '',
    dataFim: '',
    recurrencia: 'diaria',
    prioridade: 'media',
    observacoes: '',
    financeiro: {
      valorCliente: 0,
      valorPrestador: 0,
      percentualImposto: 0,
      percentualSeguro: 0,
      valorImposto: 0,
      valorSeguro: 0,
      receitaLiquida: 0,
      custoTotal: 0,
      lucroUnitario: 0,
      lucroTotal: 0,
      margem: 0,
      valorKmExcedente: 0,
      franquiaKm: 0,
      formaPagamento: '',
      prazoPagamento: 30,
    },
    meta: {
      vagasTotais: 1,
      vagasPreenchidas: 0,
      vagasPendentes: 1,
      diariasPorVaga: 1,
      totalDiarias: 1,
      captados: 0,
      aprovados: 0,
      emAnalise: 0,
      recusados: 0,
    },
  })

  const calcularFinanceiro = () => {
    const f = form.financeiro!
    const valorCliente = f.valorCliente || 0
    const valorPrestador = f.valorPrestador || 0
    const imposto = f.percentualImposto || 0
    const seguro = f.percentualSeguro || 0
    const valorImposto = valorCliente * (imposto / 100)
    const valorSeguro = valorCliente * (seguro / 100)
    const receitaLiquida = valorCliente - valorImposto
    const custoTotal = valorPrestador + valorSeguro
    const lucroUnitario = receitaLiquida - custoTotal
    const vagas = form.meta?.vagasTotais || 1
    const diarias = form.meta?.diariasPorVaga || 1
    const lucroTotal = lucroUnitario * vagas * diarias
    const margem = receitaLiquida > 0 ? (lucroUnitario / receitaLiquida) * 100 : 0
    return { valorImposto, valorSeguro, receitaLiquida, custoTotal, lucroUnitario, lucroTotal, margem }
  }

  const handleSalvar = async () => {
    if (!form.nome || !form.cliente || !form.tipoVeiculo) {
      toast.error('Preencha nome, cliente e tipo de veículo')
      return
    }

    setSaving(true)
    try {
      await criar(form)
      toast.success('Operação criada! Match inteligente será processado.')
      navegar('operacoes')
    } catch {
      toast.error('Erro ao criar operação')
    } finally {
      setSaving(false)
    }
  }

  const fin = calcularFinanceiro()

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        icon={<PlusCircle className="w-5 h-5 text-primary" />}
        title="Nova Operação"
        description="Cadastre uma nova vaga para recrutamento inteligente de prestadores"
      />

      <div className="flex items-center gap-3 mb-6">
        {[1, 2, 3, 4].map((p) => (
          <button
            key={p}
            onClick={() => setPasso(p)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all',
              passo === p
                ? 'bg-primary/10 text-primary'
                : passo > p
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-muted/30 text-muted-foreground/50'
            )}
          >
            <span className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
              passo === p ? 'bg-primary text-primary-foreground' : passo > p ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
            )}>
              {passo > p ? '✓' : p}
            </span>
            <span className="hidden sm:inline">{['Identificação', 'Logística', 'Capacidade', 'Financeiro'][p - 1]}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {passo === 1 && (
          <motion.div key={1} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <PremiumCard>
              <PremiumCardHeader><PremiumCardTitle>Identificação da Operação</PremiumCardTitle></PremiumCardHeader>
              <PremiumCardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Nome da Operação</Label>
                  <Input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: Rota Sul D+1" />
                </div>
                <div>
                  <Label>Cliente</Label>
                  <Input value={form.cliente} onChange={e => setForm({...form, cliente: e.target.value})} placeholder="Ex: Magazine Luiza" />
                </div>
                <div>
                  <Label>Prioridade</Label>
                  <Select value={form.prioridade} onValueChange={v => setForm({...form, prioridade: v as PrioridadeOperacao})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Recorrência</Label>
                  <Select value={form.recurrencia} onValueChange={v => setForm({...form, recurrencia: v as Recurrencia})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unica">Única</SelectItem>
                      <SelectItem value="diaria">Diária</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="quinzenal">Quinzenal</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data Início</Label>
                  <Input type="date" value={form.dataInicio} onChange={e => setForm({...form, dataInicio: e.target.value})} />
                </div>
                <div>
                  <Label>Data Fim (opcional)</Label>
                  <Input type="date" value={form.dataFim} onChange={e => setForm({...form, dataFim: e.target.value})} />
                </div>
              </PremiumCardContent>
            </PremiumCard>
          </motion.div>
        )}

        {passo === 2 && (
          <motion.div key={2} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <PremiumCard>
              <PremiumCardHeader><PremiumCardTitle>Detalhes Logísticos</PremiumCardTitle></PremiumCardHeader>
              <PremiumCardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Tipo Veículo</Label>
                  <Select value={form.tipoVeiculo} onValueChange={v => setForm({...form, tipoVeiculo: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_VEICULO.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo Carga</Label>
                  <Select value={form.tipoCarga} onValueChange={v => setForm({...form, tipoCarga: v as TipoCarga})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seco">Seco</SelectItem>
                      <SelectItem value="refrigerado">Refrigerado</SelectItem>
                      <SelectItem value="perigoso">Perigoso</SelectItem>
                      <SelectItem value="fragil">Frágil</SelectItem>
                      <SelectItem value="alimenticio">Alimentício</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Região</Label>
                  <Input value={form.regiao} onChange={e => setForm({...form, regiao: e.target.value})} placeholder="Ex: São Paulo" />
                </div>
                <div>
                  <Label>Peso da Carga</Label>
                  <Input value={form.pesoCarga} onChange={e => setForm({...form, pesoCarga: e.target.value})} placeholder="Ex: 500kg" />
                </div>
                <div>
                  <Label>Dimensões</Label>
                  <Input value={form.dimensoes} onChange={e => setForm({...form, dimensoes: e.target.value})} placeholder="Ex: 2x2x2m" />
                </div>
                <div>
                  <Label>Local Carregamento</Label>
                  <Input value={form.localCarregamento} onChange={e => setForm({...form, localCarregamento: e.target.value})} />
                </div>
                <div>
                  <Label>Local Descarregamento</Label>
                  <Input value={form.localDescarregamento} onChange={e => setForm({...form, localDescarregamento: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Horário Carregamento</Label>
                    <Input type="time" value={form.horarioCarregamento} onChange={e => setForm({...form, horarioCarregamento: e.target.value})} />
                  </div>
                  <div>
                    <Label>Horário Descarregamento</Label>
                    <Input type="time" value={form.horarioDescarregamento} onChange={e => setForm({...form, horarioDescarregamento: e.target.value})} />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Label>Rota Origem → Destino</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={form.rotaOrigem} onChange={e => setForm({...form, rotaOrigem: e.target.value})} placeholder="Origem" />
                    <Input value={form.rotaDestino} onChange={e => setForm({...form, rotaDestino: e.target.value})} placeholder="Destino" />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Label>Observações Operacionais</Label>
                  <Textarea value={form.observacoes} onChange={e => setForm({...form, observacoes: e.target.value})} className="resize-none h-20" />
                </div>
              </PremiumCardContent>
            </PremiumCard>
          </motion.div>
        )}

        {passo === 3 && (
          <motion.div key={3} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <PremiumCard>
              <PremiumCardHeader><PremiumCardTitle>Capacidade e Metas</PremiumCardTitle></PremiumCardHeader>
              <PremiumCardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Quantidade de Veículos</Label>
                  <Input type="number" min={1} value={form.meta?.vagasTotais || 1}
                    onChange={e => setForm({...form, meta: {...form.meta!, vagasTotais: parseInt(e.target.value) || 1, vagasPendentes: parseInt(e.target.value) || 1}})} />
                </div>
                <div>
                  <Label>Diárias por Veículo</Label>
                  <Input type="number" min={1} value={form.meta?.diariasPorVaga || 1}
                    onChange={e => setForm({...form, meta: {...form.meta!, diariasPorVaga: parseInt(e.target.value) || 1}})} />
                </div>
              </PremiumCardContent>
            </PremiumCard>

            <PremiumCard>
              <PremiumCardHeader><PremiumCardTitle>Resumo de Capacidade</PremiumCardTitle></PremiumCardHeader>
              <PremiumCardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Veículos', value: String(form.meta?.vagasTotais || 1) },
                    { label: 'Diárias/Veículo', value: String(form.meta?.diariasPorVaga || 1) },
                    { label: 'Total Diárias', value: String((form.meta?.vagasTotais || 1) * (form.meta?.diariasPorVaga || 1)) },
                    { label: 'Status', value: 'Rascunho' },
                  ].map((item) => (
                    <div key={item.label} className="p-3 rounded-lg bg-muted/30 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                      <p className="text-lg font-bold text-foreground mt-1">{item.value}</p>
                    </div>
                  ))}
                </div>
              </PremiumCardContent>
            </PremiumCard>
          </motion.div>
        )}

        {passo === 4 && (
          <motion.div key={4} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <PremiumCard>
              <PremiumCardHeader><PremiumCardTitle>Financeiro</PremiumCardTitle></PremiumCardHeader>
              <PremiumCardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Valor Cliente (R$)</Label>
                  <Input type="number" step="0.01" value={form.financeiro?.valorCliente || ''}
                    onChange={e => setForm({...form, financeiro: {...form.financeiro!, valorCliente: parseFloat(e.target.value) || 0}})} />
                </div>
                <div>
                  <Label>Valor Prestador (R$)</Label>
                  <Input type="number" step="0.01" value={form.financeiro?.valorPrestador || ''}
                    onChange={e => setForm({...form, financeiro: {...form.financeiro!, valorPrestador: parseFloat(e.target.value) || 0}})} />
                </div>
                <div>
                  <Label>Imposto (%)</Label>
                  <Input type="number" step="0.01" value={form.financeiro?.percentualImposto || ''}
                    onChange={e => setForm({...form, financeiro: {...form.financeiro!, percentualImposto: parseFloat(e.target.value) || 0}})} />
                </div>
                <div>
                  <Label>Seguro (%)</Label>
                  <Input type="number" step="0.01" value={form.financeiro?.percentualSeguro || ''}
                    onChange={e => setForm({...form, financeiro: {...form.financeiro!, percentualSeguro: parseFloat(e.target.value) || 0}})} />
                </div>
                <div>
                  <Label>Franquia KM</Label>
                  <Input type="number" value={form.financeiro?.franquiaKm || ''}
                    onChange={e => setForm({...form, financeiro: {...form.financeiro!, franquiaKm: parseInt(e.target.value) || 0}})} />
                </div>
                <div>
                  <Label>KM Excedente (R$)</Label>
                  <Input type="number" step="0.01" value={form.financeiro?.valorKmExcedente || ''}
                    onChange={e => setForm({...form, financeiro: {...form.financeiro!, valorKmExcedente: parseFloat(e.target.value) || 0}})} />
                </div>
                <div>
                  <Label>Forma Pagamento</Label>
                  <Input value={form.financeiro?.formaPagamento || ''} onChange={e => setForm({...form, financeiro: {...form.financeiro!, formaPagamento: e.target.value}})} placeholder="Ex: Quinzenal" />
                </div>
                <div>
                  <Label>Prazo (dias)</Label>
                  <Input type="number" value={form.financeiro?.prazoPagamento || 30}
                    onChange={e => setForm({...form, financeiro: {...form.financeiro!, prazoPagamento: parseInt(e.target.value) || 30}})} />
                </div>
              </PremiumCardContent>
            </PremiumCard>

            <PremiumCard borderAccent="emerald-500/30">
              <PremiumCardHeader>
                <PremiumCardTitle className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  Simulador Financeiro
                </PremiumCardTitle>
                <PremiumBadge variant="success" dot size="sm">Estimativa</PremiumBadge>
              </PremiumCardHeader>
              <PremiumCardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-[10px] text-muted-foreground">Receita Líquida</p>
                    <p className="text-sm font-bold text-foreground">{formatCurrency(fin.receitaLiquida)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-[10px] text-muted-foreground">Custo Total</p>
                    <p className="text-sm font-bold text-foreground">{formatCurrency(fin.custoTotal)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-[10px] text-muted-foreground">Lucro Unitário</p>
                    <p className="text-sm font-bold text-emerald-400">{formatCurrency(fin.lucroUnitario)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-[10px] text-muted-foreground">Margem</p>
                    <p className="text-sm font-bold" style={{ color: fin.margem >= 15 ? '#34d399' : fin.margem >= 5 ? '#fbbf24' : '#f87171' }}>
                      {fin.margem.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-muted/20 border border-border/40">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Lucro Total Estimado</p>
                      <p className="text-xs text-muted-foreground">
                        {(form.meta?.vagasTotais || 1)} veículos × {(form.meta?.diariasPorVaga || 1)} diárias
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-emerald-400">{formatCurrency(fin.lucroTotal)}</p>
                  </div>
                </div>
                {fin.margem < 5 && (
                  <div className="flex items-center gap-2 p-3 mt-3 rounded-lg bg-amber-500/10 text-amber-400 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Margem muito baixa. Considere ajustar os valores.
                  </div>
                )}
              </PremiumCardContent>
            </PremiumCard>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between pt-4 border-t border-border/50">
        <Button variant="outline" onClick={() => setPasso(p => Math.max(1, p - 1))} disabled={passo === 1}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Anterior
        </Button>
        {passo < 4 ? (
          <Button onClick={() => setPasso(p => Math.min(4, p + 1))}>
            Próximo <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        ) : (
          <Button onClick={handleSalvar} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500">
            {saving ? 'Salvando...' : <><Send className="w-4 h-4 mr-1.5" /> Criar Operação</>}
          </Button>
        )}
      </div>
    </div>
  )
}