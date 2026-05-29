import { Activity, CheckCircle } from "lucide-react"
import { montarTimelineAlocacao } from "@/helpers/montarTimelineAlocacao"
import type { DadosTimeline } from "@/helpers/montarTimelineAlocacao"

interface TimelineOperacionalProps {
  dados: DadosTimeline
}

export function TimelineOperacional({ dados }: TimelineOperacionalProps) {
  const eventos = montarTimelineAlocacao(dados)

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2 flex items-center gap-1.5">
        <Activity className="w-3.5 h-3.5 text-primary" />
        Linha do Tempo
      </div>
      {eventos.length === 0 ? (
        <p className="text-xs text-slate-400 italic">Sem eventos registrados.</p>
      ) : (
        <div className="relative pl-5 border-l-2 border-slate-200 space-y-3">
          {eventos.map((evt) => (
            <div key={evt.id} className="relative">
              <div className={`absolute -left-[22px] top-0.5 w-3 h-3 rounded-full border-2 bg-white ${
                evt.done ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'
              }`} />
              <div className="flex justify-between items-start text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className={`font-bold ${evt.done ? 'text-slate-800' : 'text-slate-400'}`}>
                    {evt.label}
                  </span>
                  {evt.done && (
                    <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                  )}
                </div>
                {evt.timestamp !== '—' && (
                  <span className="text-[9px] font-semibold text-slate-400 whitespace-nowrap ml-2">
                    {evt.timestamp}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
