import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

export const formatPercent = (value: number): string =>
  `${value.toFixed(1)}%`

export const formatDate = (date: string): string =>
  new Date(date).toLocaleDateString('pt-BR')

export const formatDateTime = (date: string): string =>
  new Date(date).toLocaleString('pt-BR')

export const formatNumber = (value: number): string =>
  new Intl.NumberFormat('pt-BR').format(value)

export const statusOperacaoColor: Record<string, string> = {
  rascunho: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  aberta: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  em_andamento: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  pausada: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  encerrada: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  arquivada: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
}

export const statusPrestadorColor: Record<string, string> = {
  potencial: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  em_triagem: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  documentacao: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  qualificado: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  ativo: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  suspenso: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  inativo: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
}

export const prioridadeColor: Record<string, string> = {
  baixa: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  media: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  alta: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  urgente: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
}

export const statusDocumentoColor: Record<string, string> = {
  pendente: 'bg-amber-500/20 text-amber-400',
  enviado: 'bg-blue-500/20 text-blue-400',
  validando: 'bg-violet-500/20 text-violet-400',
  aprovado: 'bg-emerald-500/20 text-emerald-400',
  reprovado: 'bg-rose-500/20 text-rose-400',
  vencido: 'bg-red-500/20 text-red-400',
}

export const statusLabel: Record<string, string> = {
  rascunho: 'Rascunho',
  aberta: 'Aberta',
  em_andamento: 'Em Andamento',
  pausada: 'Pausada',
  encerrada: 'Encerrada',
  arquivada: 'Arquivada',
  potencial: 'Potencial',
  em_triagem: 'Em Triagem',
  documentacao: 'Documentação',
  qualificado: 'Qualificado',
  ativo: 'Ativo',
  suspenso: 'Suspenso',
  inativo: 'Inativo',
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
  pendente: 'Pendente',
  enviado: 'Enviado',
  validando: 'Validando',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  vencido: 'Vencido',
} 