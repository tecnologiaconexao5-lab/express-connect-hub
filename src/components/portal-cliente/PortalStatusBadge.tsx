import { LucideIcon, LucideProps } from "lucide-react";

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
}

const statusConfig: Record<BadgeStatus, { bg: string; text: string; label: string; icon?: LucideIcon }> = {
  saudavel: {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
    text: "text-emerald-600 dark:text-emerald-400",
    label: "Saudável",
  },
  atencao: {
    bg: "bg-amber-500/10 dark:bg-amber-500/15",
    text: "text-amber-600 dark:text-amber-400",
    label: "Atenção",
  },
  critico: {
    bg: "bg-red-500/10 dark:bg-red-500/15",
    text: "text-red-600 dark:text-red-400",
    label: "Crítico",
  },
  em_andamento: {
    bg: "bg-primary/10 dark:bg-primary/15",
    text: "text-primary dark:text-primary",
    label: "Em Andamento",
  },
  concluido: {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
    text: "text-emerald-600 dark:text-emerald-400",
    label: "Concluído",
  },
  atrasado: {
    bg: "bg-red-500/10 dark:bg-red-500/15",
    text: "text-red-600 dark:text-red-400",
    label: "Atrasado",
  },
  pendente: {
    bg: "bg-muted/50",
    text: "text-muted-foreground",
    label: "Pendente",
  },
  programacao: {
    bg: "bg-muted/50",
    text: "text-muted-foreground",
    label: "Programado",
  },
  coleta: {
    bg: "bg-primary/10 dark:bg-primary/15",
    text: "text-primary dark:text-primary",
    label: "Em Coleta",
  },
  saiu_para_rota: {
    bg: "bg-primary/10 dark:bg-primary/15",
    text: "text-primary dark:text-primary",
    label: "Saiu para Rota",
  },
  em_rota: {
    bg: "bg-primary/10 dark:bg-primary/15",
    text: "text-primary dark:text-primary",
    label: "Em Rota",
  },
  entregue: {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
    text: "text-emerald-600 dark:text-emerald-400",
    label: "Entregue",
  },
  problema: {
    bg: "bg-red-500/10 dark:bg-red-500/15",
    text: "text-red-600 dark:text-red-400",
    label: "Com Problema",
  },
};

export function PortalStatusBadge({
  status,
  label,
  showIcon = false,
  iconProps,
}: PortalStatusBadgeProps) {
  const resolvedStatus = status && statusConfig[status] ? status : "pendente";
  const config = statusConfig[resolvedStatus];
  const displayLabel = label || config.label;
  const IconComponent = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${config.bg} ${config.text} border-transparent`}
    >
      {showIcon && IconComponent && (
        <IconComponent className="w-3.5 h-3.5" {...iconProps} />
      )}
      {displayLabel}
    </span>
  );
}