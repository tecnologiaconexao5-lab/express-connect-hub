import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

interface AlocacaoOperacionalFieldsProps {
  turno: string
  onTurnoChange: (value: string) => void
  tipo: string
  onTipoChange: (value: string) => void
  horarioInicio: string
  onHorarioInicioChange: (value: string) => void
  horarioFim: string
  onHorarioFimChange: (value: string) => void
  observacao: string
  onObservacaoChange: (value: string) => void
}

export function AlocacaoOperacionalFields({
  turno,
  onTurnoChange,
  tipo,
  onTipoChange,
  horarioInicio,
  onHorarioInicioChange,
  horarioFim,
  onHorarioFimChange,
  observacao,
  onObservacaoChange,
}: AlocacaoOperacionalFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Turno</Label>
          <Select value={turno} onValueChange={onTurnoChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="integral">Dia Integral</SelectItem>
              <SelectItem value="manha">Manhã (06-14)</SelectItem>
              <SelectItem value="tarde">Tarde (14-22)</SelectItem>
              <SelectItem value="noite">Noite (22-06)</SelectItem>
              <SelectItem value="saida">Saída</SelectItem>
              <SelectItem value="intermediario">Intermediário</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <Select value={tipo} onValueChange={onTipoChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="disponibilidade">Disponibilidade</SelectItem>
              <SelectItem value="reserva">Reserva Operacional</SelectItem>
              <SelectItem value="bloqueio">Bloqueio</SelectItem>
              <SelectItem value="afastamento">Afastamento</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Horário Início</Label>
          <Input type="time" value={horarioInicio} onChange={e => onHorarioInicioChange(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Horário Fim</Label>
          <Input type="time" value={horarioFim} onChange={e => onHorarioFimChange(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Instruções / Observações</Label>
        <Textarea placeholder="Ex: Necessário chegar 30m antes na base." rows={2} value={observacao} onChange={e => onObservacaoChange(e.target.value)} />
      </div>
    </>
  )
}
