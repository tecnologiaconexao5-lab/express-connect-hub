import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

function calcularDiferencaTempo(t1: string, t2: string): string {
  if (!t1 || !t2) return "0 min";
  const [h1, m1] = t1.split(":").map(Number);
  const [h2, m2] = t2.split(":").map(Number);
  let diffMin = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (diffMin < 0) diffMin += 24 * 60;
  const hrs = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins} min`;
}

interface AlocacaoHistoricoOperacionalProps {
  horarioInicio: string
  onHorarioInicioChange: (value: string) => void
  tempoChegadaPatio: string
  onTempoChegadaPatioChange: (value: string) => void
  tempoInicioCarregamento: string
  onTempoInicioCarregamentoChange: (value: string) => void
  tempoFimCarregamento: string
  onTempoFimCarregamentoChange: (value: string) => void
  tempoSaidaRua: string
  onTempoSaidaRuaChange: (value: string) => void
  tempoFinalizacaoEntregas: string
  onTempoFinalizacaoEntregasChange: (value: string) => void
}

export function AlocacaoHistoricoOperacional({
  horarioInicio,
  onHorarioInicioChange,
  tempoChegadaPatio,
  onTempoChegadaPatioChange,
  tempoInicioCarregamento,
  onTempoInicioCarregamentoChange,
  tempoFimCarregamento,
  onTempoFimCarregamentoChange,
  tempoSaidaRua,
  onTempoSaidaRuaChange,
  tempoFinalizacaoEntregas,
  onTempoFinalizacaoEntregasChange,
}: AlocacaoHistoricoOperacionalProps) {
  const diffAguardando = calcularDiferencaTempo(tempoChegadaPatio, tempoInicioCarregamento);
  const diffCarregamento = calcularDiferencaTempo(tempoInicioCarregamento, tempoFimCarregamento);
  const diffEmRota = calcularDiferencaTempo(tempoSaidaRua, tempoFinalizacaoEntregas);
  const diffTotal = calcularDiferencaTempo(tempoChegadaPatio, tempoFinalizacaoEntregas);

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
      <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2 flex items-center justify-between">
        <span>Histórico Operacional</span>
        <Badge variant="outline" className="bg-white text-slate-600 font-semibold text-[10px]">
          Tempos Operacionais
        </Badge>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-slate-500 font-semibold">Horário Agendado</Label>
            <Input
              type="time"
              value={horarioInicio}
              onChange={(e) => onHorarioInicioChange(e.target.value)}
              className="bg-white text-xs h-8 border-slate-200"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500 font-semibold">Chegada no Pátio</Label>
            <Input
              type="time"
              value={tempoChegadaPatio}
              onChange={(e) => onTempoChegadaPatioChange(e.target.value)}
              className="bg-white text-xs h-8 border-slate-200"
            />
          </div>
        </div>

        <div className="p-2 bg-amber-50 border border-amber-100 rounded-lg flex justify-between items-center text-xs font-semibold text-amber-800">
          <span>Tempo Aguardando:</span>
          <span className="font-bold">{diffAguardando}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-slate-500 font-semibold">Início Carregamento</Label>
            <Input
              type="time"
              value={tempoInicioCarregamento}
              onChange={(e) => onTempoInicioCarregamentoChange(e.target.value)}
              className="bg-white text-xs h-8 border-slate-200"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500 font-semibold">Fim Carregamento</Label>
            <Input
              type="time"
              value={tempoFimCarregamento}
              onChange={(e) => onTempoFimCarregamentoChange(e.target.value)}
              className="bg-white text-xs h-8 border-slate-200"
            />
          </div>
        </div>

        <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-lg flex justify-between items-center text-xs font-semibold text-emerald-800">
          <span>Tempo de Carregamento:</span>
          <span className="font-bold">{diffCarregamento}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-slate-500 font-semibold">Saída para Rua</Label>
            <Input
              type="time"
              value={tempoSaidaRua}
              onChange={(e) => onTempoSaidaRuaChange(e.target.value)}
              className="bg-white text-xs h-8 border-slate-200"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500 font-semibold">Finalização das Entregas</Label>
            <Input
              type="time"
              value={tempoFinalizacaoEntregas}
              onChange={(e) => onTempoFinalizacaoEntregasChange(e.target.value)}
              className="bg-white text-xs h-8 border-slate-200"
            />
          </div>
        </div>

        <div className="p-2 bg-cyan-50 border border-cyan-100 rounded-lg flex justify-between items-center text-xs font-semibold text-cyan-800">
          <span>Tempo em Rota:</span>
          <span className="font-bold">{diffEmRota}</span>
        </div>

        <div className="pt-2 border-t flex justify-between items-center text-xs text-slate-600 font-bold">
          <span>Tempo Total de Operação:</span>
          <span className="text-slate-800">{diffTotal}</span>
        </div>
      </div>
    </div>
  )
}
