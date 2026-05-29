import { Truck, CheckCircle, Clock, MapPin, Check, AlertCircle, AlertTriangle } from "lucide-react"
import type { KpisEscala } from "@/helpers/calcularKpisEscala"

interface KpiCardsProps {
  kpis: KpisEscala
}

export function KpiCards({ kpis }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 mb-4">
      <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
        <Truck className="w-5 h-5 text-primary shrink-0" />
        <div>
          <p className="text-xs text-muted-foreground font-medium">Total</p>
          <p className="text-lg font-bold text-foreground">{kpis.total}</p>
        </div>
      </div>
      <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
        <div>
          <p className="text-xs text-muted-foreground font-medium">Confirmadas</p>
          <p className="text-lg font-bold text-emerald-600">{kpis.confirmadas}</p>
        </div>
      </div>
      <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
        <Clock className="w-5 h-5 text-amber-500 shrink-0" />
        <div>
          <p className="text-xs text-muted-foreground font-medium">Pendentes</p>
          <p className="text-lg font-bold text-amber-600">{kpis.pendentes}</p>
        </div>
      </div>
      <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
        <MapPin className="w-5 h-5 text-orange-500 shrink-0" />
        <div>
          <p className="text-xs text-muted-foreground font-medium">Em Rota</p>
          <p className="text-lg font-bold text-orange-600">{kpis.emRota}</p>
        </div>
      </div>
      <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
        <Check className="w-5 h-5 text-sky-500 shrink-0" />
        <div>
          <p className="text-xs text-muted-foreground font-medium">Finalizadas</p>
          <p className="text-lg font-bold text-sky-600">{kpis.finalizadas}</p>
        </div>
      </div>
      <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
        <div>
          <p className="text-xs text-muted-foreground font-medium">Canceladas</p>
          <p className="text-lg font-bold text-red-600">{kpis.canceladas}</p>
        </div>
      </div>
      <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-violet-500 shrink-0" />
        <div>
          <p className="text-xs text-muted-foreground font-medium">Conflitos</p>
          <p className="text-lg font-bold text-violet-600">—</p>
        </div>
      </div>
    </div>
  )
}
