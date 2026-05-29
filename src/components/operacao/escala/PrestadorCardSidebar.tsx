import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { InfoRecrutamento } from "@/hooks/usePrestadoresAptosRecrutamento"

interface PrestadorSidebar {
  id: string
  nome: string
  veiculo: string
  placa: string
  regiao: string
  status: string
  avatar: string
}

interface PrestadorCardSidebarProps {
  prestador: PrestadorSidebar
  isSelected: boolean
  alocadoHoje: boolean
  infoRecrutamento?: InfoRecrutamento | null
  onClick: () => void
}

const STATUS_CORES: Record<string, string> = {
  rota: 'bg-orange-500',
  disponivel: 'bg-emerald-500',
  ocupado: 'bg-red-500',
}

const STATUS_LABELS: Record<string, string> = {
  rota: 'Em rota',
  disponivel: 'Disponível',
  ocupado: 'Ocupado',
  indisponivel: 'Indisponível',
}

export function PrestadorCardSidebar({
  prestador,
  isSelected,
  alocadoHoje,
  infoRecrutamento,
  onClick,
}: PrestadorCardSidebarProps) {
  const statusKey = alocadoHoje ? 'rota' : prestador.status === 'disponivel' ? 'disponivel' : prestador.status === 'ocupado' ? 'ocupado' : 'indisponivel'
  const statusCor = STATUS_CORES[statusKey] || 'bg-muted-foreground/40'
  const statusLabel = STATUS_LABELS[statusKey] || 'Indisponível'

  return (
    <div
      onClick={onClick}
      className={`p-3 border rounded-lg transition cursor-pointer flex gap-3 items-center group escala-prestador-card ${
        isSelected
          ? 'bg-primary/5 border-primary shadow-sm'
          : 'bg-card border-border hover:border-primary/50'
      }`}
    >
      <Avatar className="w-10 h-10 border border-border shadow-sm">
        <AvatarFallback className="bg-muted text-muted-foreground font-bold">{prestador.avatar}</AvatarFallback>
      </Avatar>
      <div className="flex-1 overflow-hidden">
        <p className="text-sm font-bold text-foreground truncate">{prestador.nome}</p>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
          {prestador.veiculo} {prestador.placa ? `• ${prestador.placa}` : ''} • {prestador.regiao}
        </p>
        <p className="text-[9px] text-muted-foreground/60 mt-0.5">{statusLabel}</p>
        {infoRecrutamento && (
          <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${infoRecrutamento.cor}`}>
            {infoRecrutamento.label}
          </span>
        )}
      </div>
      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusCor}`} />
    </div>
  )
}

export type { PrestadorSidebar }
