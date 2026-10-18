import { memo } from "react";
import { LucideIcon, LucideProps, Clock, Package, Truck, CheckCircle, AlertTriangle, AlertCircle, Navigation } from "lucide-react";

type BadgeStatus =
  | "saudavel"
  | "atencao"
  | "critico"
  | "em_andamento"
  | "concluido"
  | "atrasado"
  | "pendente"
  | "programacao"
  | "coleta"
  | "saiu_para_rota"
  | "em_rota"
  | "entregue"
  | "problema";

interface PortalStatusBadgeProps {
  status: BadgeStatus;
  label?: string;
  showIcon?: boolean;
  iconProps?: LucideProps;
  className?: string;
}

const statusConfig: Record<BadgeStatus, { bg: string; text: string; border: string; label: string; icon: LucideIcon }> = {
  saudavel: {
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800/50",
    label: "Saudável",
    icon: CheckCircle,
  },
  atencao: {
    bg: "bg-amber-50 dark:bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800/50",
    label: "Atenção",
    icon: AlertTriangle,
  },
  critico: {
    bg: "bg-red-50 dark:bg-red-500/10",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-800/50",
    label: "Crítico",
    icon: AlertCircle,
  },
  em_andamento: {
    bg: "bg-orange-50 dark:bg-orange-500/10",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-200 dark:border-orange-800/50",
    label: "Em Andamento",
    icon: Navigation,
  },
  concluido: {
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800/50",
    label: "Concluído",
    icon: CheckCircle,
  },
  atrasado: {
    bg: "bg-red-50 dark:bg-red-500/10",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-800/50",
    label: "Atrasado",
    icon: Clock,
  },
  pendente: {
    bg: "bg-slate-50 dark:bg-slate-800/40",
    text: "text-slate-600 dark:text-slate-400",
    border: "border-slate-200 dark:border-slate-700/50",
    label: "Pendente",
    icon: Clock,
  },
  programacao: {
    bg: "bg-slate-50 dark:bg-slate-800/40",
    text: "text-slate-600 dark:text-slate-400",
    border: "border-slate-200 dark:border-slate-700/50",
    label: "Programado",
    icon: Clock,
  },
  coleta: {
    bg: "bg-blue-50 dark:bg-blue-500/10",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800/50",
    label: "Em Coleta",
    icon: Package,
  },
  saiu_para_rota: {
    bg: "bg-indigo-50 dark:bg-indigo-500/10",
    text: "text-indigo-700 dark:text-indigo-400",
    border: "border-indigo-200 dark:border-indigo-800/50",
    label: "Distribuicao Iniciada",
    icon: Truck,
  },
  em_rota: {
    bg: "bg-orange-50 dark:bg-orange-500/10",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-200 dark:border-orange-800/50",
    label: "Em Distribuicao",
    icon: Navigation,
  },
  entregue: {
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800/50",
    label: "Entrega Concluida",
    icon: CheckCircle,
  },
  problema: {
    bg: "bg-rose-50 dark:bg-rose-500/10",
    text: "text-rose-700 dark:text-rose-400",
    border: "border-rose-200 dark:border-rose-800/50",
    label: "Com Problema",
    icon: AlertCircle,
  },
};

export const PortalStatusBadge = memo(function PortalStatusBadge({
  status,
  label,
  showIcon = true,
  iconProps,
  className = "",
}: PortalStatusBadgeProps) {
  const resolvedStatus = status && statusConfig[status] ? status : "pendente";
  const config = statusConfig[resolvedStatus];
  const displayLabel = label || config.label;
  const IconComponent = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border ${config.bg} ${config.text} ${config.border} shadow-sm transition-all duration-300 hover:scale-105 active:scale-95 whitespace-nowrap ${className}`}
    >
      {showIcon && IconComponent && (
        <IconComponent className="w-3.5 h-3.5" {...iconProps} />
      )}
      <span className="uppercase tracking-wider">{displayLabel}</span>
    </span>
  );
});