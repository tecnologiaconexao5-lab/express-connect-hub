import { cn } from '../../utils/cn'

interface StatusDotProps {
  status: string
  className?: string
  pulse?: boolean
}

const dotColors: Record<string, string> = {
  ativo: 'bg-emerald-400',
  aberta: 'bg-blue-400',
  em_andamento: 'bg-emerald-400',
  qualificado: 'bg-cyan-400',
  potencial: 'bg-blue-400',
  em_triagem: 'bg-violet-400',
  documentacao: 'bg-amber-400',
  pausada: 'bg-amber-400',
  suspenso: 'bg-rose-400',
  inativo: 'bg-zinc-400',
  encerrada: 'bg-rose-400',
  arquivada: 'bg-zinc-400',
  rascunho: 'bg-zinc-400',
  pendente: 'bg-amber-400',
  enviado: 'bg-blue-400',
  validando: 'bg-violet-400',
  aprovado: 'bg-emerald-400',
  reprovado: 'bg-rose-400',
  vencido: 'bg-red-400',
  baixa: 'bg-zinc-400',
  media: 'bg-blue-400',
  alta: 'bg-orange-400',
  urgente: 'bg-rose-400',
}

export function StatusDot({ status, className, pulse }: StatusDotProps) {
  return (
    <span
      className={cn(
        'inline-block w-2 h-2 rounded-full',
        dotColors[status] || 'bg-zinc-400',
        pulse && 'animate-pulse',
        className
      )}
    />
  )
}