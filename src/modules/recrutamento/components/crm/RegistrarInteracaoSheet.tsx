import { useState, useMemo } from 'react'
import { Save, X } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRecrutamentoStore } from '../../store/recrutamentoStore'
import { crmService } from '../../services/crmService'
import type { CrmInteracao } from '../../types/recrutamento'
import { toast } from 'sonner'

type TipoInteracao = CrmInteracao['tipo']

const TIPO_OPTIONS: { value: TipoInteracao; label: string }[] = [
  { value: 'ligacao', label: 'Ligação' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'E-mail' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'observacao', label: 'Observação' },
  { value: 'proposta_enviada', label: 'Proposta Enviada' },
  { value: 'retorno_prestador', label: 'Retorno do Prestador' },
]

const STATUS_OPTIONS: { value: CrmInteracao['status']; label: string }[] = [
  { value: 'realizado', label: 'Realizado' },
  { value: 'agendado', label: 'Agendado' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'cancelado', label: 'Cancelado' },
]

interface RegistrarInteracaoSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  prestadorId?: string
  onSuccess?: () => void
}

export function RegistrarInteracaoSheet({ open, onOpenChange, prestadorId, onSuccess }: RegistrarInteracaoSheetProps) {
  const { prestadores } = useRecrutamentoStore()
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    prestadorId: prestadorId ?? '',
    tipo: '' as TipoInteracao | '',
    titulo: '',
    descricao: '',
    data: new Date().toISOString().slice(0, 16),
    usuario: 'Admin',
    proximaAcao: '',
    dataProximoContato: '',
    status: 'realizado' as CrmInteracao['status'],
  })

  const prestadorNome = useMemo(() => {
    if (form.prestadorId) {
      return prestadores.find(p => p.id === form.prestadorId)?.nome ?? ''
    }
    return ''
  }, [form.prestadorId, prestadores])

  const handleSubmit = async () => {
    if (!form.prestadorId || !form.tipo || !form.titulo.trim()) {
      toast.error('Preencha prestador, tipo e título da interação')
      return
    }

    setSaving(true)
    try {
      await crmService.criar({
        prestadorId: form.prestadorId,
        prestadorNome: prestadorNome || form.prestadorId,
        tipo: form.tipo as TipoInteracao,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        data: new Date(form.data).toISOString(),
        usuario: form.usuario.trim() || 'Admin',
        proximaAcao: form.proximaAcao.trim(),
        dataProximoContato: form.dataProximoContato
          ? new Date(form.dataProximoContato).toISOString()
          : '',
        status: form.status,
        anexos: [],
      })

      toast.success('Interação registrada com sucesso!')
      onOpenChange(false)
      setForm({
        prestadorId: prestadorId ?? '',
        tipo: '',
        titulo: '',
        descricao: '',
        data: new Date().toISOString().slice(0, 16),
        usuario: 'Admin',
        proximaAcao: '',
        dataProximoContato: '',
        status: 'realizado',
      })
      onSuccess?.()
    } catch {
      toast.error('Erro ao registrar interação')
    } finally {
      setSaving(false)
    }
  }

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-1.5">
      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</Label>
      {children}
    </div>
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-lg flex items-center gap-2">
            Registrar Interação
          </SheetTitle>
          <SheetDescription>
            Registre ligações, WhatsApp, reuniões, propostas e retornos de prestadores
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          {!prestadorId && (
            <Field label="Prestador">
              <Select
                value={form.prestadorId}
                onValueChange={v => setForm({ ...form, prestadorId: v })}
              >
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione o prestador" /></SelectTrigger>
                <SelectContent>
                  {prestadores.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo de Interação">
              <Select
                value={form.tipo}
                onValueChange={v => setForm({ ...form, tipo: v as TipoInteracao })}
              >
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {TIPO_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Data / Hora">
              <Input
                type="datetime-local"
                value={form.data}
                onChange={e => setForm({ ...form, data: e.target.value })}
                className="h-9 text-xs"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Responsável">
              <Input
                value={form.usuario}
                onChange={e => setForm({ ...form, usuario: e.target.value })}
                className="h-9 text-xs"
                placeholder="Nome do responsável"
              />
            </Field>

            <Field label="Status do Contato">
              <Select
                value={form.status}
                onValueChange={v => setForm({ ...form, status: v as CrmInteracao['status'] })}
              >
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Título">
            <Input
              value={form.titulo}
              onChange={e => setForm({ ...form, titulo: e.target.value })}
              className="h-9 text-xs"
              placeholder="Ex: Proposta enviada, Retorno sobre documentação..."
            />
          </Field>

          <Field label="Resumo">
            <Textarea
              value={form.descricao}
              onChange={e => setForm({ ...form, descricao: e.target.value })}
              className="text-xs min-h-[60px] resize-none"
              placeholder="Descreva o conteúdo da interação..."
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Próxima Ação">
              <Input
                value={form.proximaAcao}
                onChange={e => setForm({ ...form, proximaAcao: e.target.value })}
                className="h-9 text-xs"
                placeholder="Ex: Aguardar retorno, Enviar contrato..."
              />
            </Field>

            <Field label="Data do Próximo Contato">
              <Input
                type="date"
                value={form.dataProximoContato}
                onChange={e => setForm({ ...form, dataProximoContato: e.target.value })}
                className="h-9 text-xs"
              />
            </Field>
          </div>

          <div className="flex items-center gap-2 pt-4 border-t border-border/30">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onOpenChange(false)}
            >
              <X className="w-3.5 h-3.5" /> Cancelar
            </Button>
            <Button
              size="sm"
              className="gap-1.5 flex-1"
              onClick={handleSubmit}
              disabled={saving}
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Salvando...' : 'Registrar Interação'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
