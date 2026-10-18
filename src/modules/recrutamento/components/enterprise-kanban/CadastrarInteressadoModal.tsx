import { useState } from 'react'
import { Plus, User, Phone, MapPin, Truck, HelpCircle, FileText } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { enterpriseKanbanService } from './enterpriseKanbanService'
import type { PipelineStage } from './enterpriseKanbanTypes'
import { toast } from 'sonner'
import { TIPOS_VEICULO } from '@/constants/tiposVeiculo'

interface CadastrarInteressadoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const VEICULO_OPTIONS = TIPOS_VEICULO

const STAGE_OPTIONS: { value: PipelineStage; label: string }[] = [
  { value: 'novo_cadastro', label: 'Novo Cadastro' },
  { value: 'em_analise', label: 'Em Análise' },
  { value: 'documentacao_pendente', label: 'Documentação Pendente' },
  { value: 'em_validacao', label: 'Em Validação' },
  { value: 'entrevista', label: 'Entrevista' },
  { value: 'em_treinamento', label: 'Em Treinamento' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'ativo', label: 'Ativo' },
]

const ORIGEM_OPTIONS = [
  { value: 'Fretebras', label: 'Fretebras' },
  { value: 'indicação', label: 'Indicação' },
  { value: 'Facebook', label: 'Facebook' },
  { value: 'LinkedIn', label: 'LinkedIn' },
  { value: 'WhatsApp', label: 'WhatsApp' },
  { value: 'site', label: 'Site' },
  { value: 'manual', label: 'Manual' },
  { value: 'outro', label: 'Outro' },
]

export function CadastrarInteressadoModal({ open, onOpenChange, onSuccess }: CadastrarInteressadoModalProps) {
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cidadeUf, setCidadeUf] = useState('')
  const [veiculo, setVeiculo] = useState(TIPOS_VEICULO[7]?.value ?? 'vuc')
  const [placa, setPlaca] = useState('')
  const [origem, setOrigem] = useState('Fretebras')
  const [observacoes, setObservacoes] = useState('')
  const [stage, setStage] = useState<PipelineStage>('novo_cadastro')
  const [salvando, setSalvando] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim() || !telefone.trim() || !cidadeUf.trim()) {
      toast.error('Preencha os campos obrigatórios: Nome, Telefone e Cidade/UF')
      return
    }

    setSalvando(true)

    try {
      let cidade = cidadeUf.trim()
      let uf = ''
      const parts = cidadeUf.split(/[/,-]/)
      if (parts.length > 1) {
        cidade = parts[0].trim()
        uf = parts[1].trim().toUpperCase()
      }

      const origemNormalizada = origem.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const tags = [origemNormalizada]
      if (origemNormalizada === 'indicacao') {
        tags.push('indicado')
      }

      await enterpriseKanbanService.criar({
        nome: nome.trim(),
        telefone: telefone.trim(),
        cidade,
        uf,
        veiculo,
        placa: placa.trim().toUpperCase(),
        observacoesIA: observacoes.trim(),
        stage,
        tags,
        score: 65, // Default initial score
      })

      toast.success('Interessado cadastrado com sucesso!')
      onOpenChange(false)
      onSuccess()

      // Reset Form
      setNome('')
      setTelefone('')
      setCidadeUf('')
      setVeiculo(TIPOS_VEICULO[7]?.value ?? 'vuc')
      setPlaca('')
      setOrigem('Fretebras')
      setObservacoes('')
      setStage('novo_cadastro')
    } catch (error) {
      console.error('[CadastrarInteressadoModal] Erro ao cadastrar:', error)
      toast.error('Erro ao cadastrar candidato')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-lg flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Cadastrar interessado / mover para análise
          </SheetTitle>
          <SheetDescription>
            Registre um novo motorista interessado diretamente em qualquer etapa do pipeline de recrutamento.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> Nome Completo *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: João da Silva"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Phone className="w-3.5 h-3.5" /> Telefone (com DDD) *
            </label>
            <input
              type="tel"
              required
              placeholder="Ex: (11) 98765-4321"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> Cidade/UF *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Sorocaba/SP"
              value={cidadeUf}
              onChange={(e) => setCidadeUf(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Truck className="w-3.5 h-3.5" /> Tipo de Veículo
              </label>
              <select
                value={veiculo}
                onChange={(e) => setVeiculo(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
              >
                {VEICULO_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" /> Placa (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: ABC1D23"
                value={placa}
                onChange={(e) => setPlaca(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5" /> Origem do Lead
              </label>
              <select
                value={origem}
                onChange={(e) => setOrigem(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
              >
                {ORIGEM_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Etapa Inicial
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as PipelineStage)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
              >
                {STAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              Observações
            </label>
            <textarea
              placeholder="Ex: Motorista com ótima experiência em rotas de mineração..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 resize-none"
            />
          </div>

          <div className="pt-4 flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={salvando}
            >
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
