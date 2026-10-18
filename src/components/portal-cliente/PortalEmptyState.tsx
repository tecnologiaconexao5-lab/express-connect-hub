import { memo } from "react";
import { LucideIcon, Package, Clock, AlertCircle, TrendingUp, FileText, Boxes, ClipboardList } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type EmptyStateType = "padrao" | "sem-dados" | "sem-resultado" | "sem-ocorrencias" | "sem-faturamento" | "sem-pedidos" | "sem-comprovantes";

interface PortalEmptyStateProps {
  type?: EmptyStateType;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: LucideIcon;
  subtitle?: string;
}

const typeConfig: Record<EmptyStateType, { icon: LucideIcon; color: string; bgGradient: string }> = {
  "padrao": {
    icon: Boxes,
    color: "text-[#F97316]",
    bgGradient: "from-orange-50 to-amber-50 border-orange-100",
  },
  "sem-dados": {
    icon: Clock,
    color: "text-slate-600",
    bgGradient: "from-slate-50 to-slate-100 border-slate-200",
  },
  "sem-resultado": {
    icon: FileText,
    color: "text-slate-500",
    bgGradient: "from-slate-50 to-slate-100 border-slate-200",
  },
  "sem-ocorrencias": {
    icon: CheckCircleIcon,
    color: "text-emerald-600",
    bgGradient: "from-emerald-50 to-green-50 border-emerald-200",
  },
  "sem-faturamento": {
    icon: TrendingUp,
    color: "text-slate-500",
    bgGradient: "from-slate-50 to-slate-100 border-slate-200",
  },
  "sem-pedidos": {
    icon: ClipboardList,
    color: "text-[#F97316]",
    bgGradient: "from-orange-50 to-amber-50 border-orange-100",
  },
  "sem-comprovantes": {
    icon: FileText,
    color: "text-slate-500",
    bgGradient: "from-slate-50 to-slate-100 border-slate-200",
  },
};

function CheckCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export const PortalEmptyState = memo(function PortalEmptyState({
  type = "padrao",
  title,
  description,
  actionLabel,
  onAction,
  icon: customIcon,
  subtitle,
}: PortalEmptyStateProps) {
  const config = typeConfig[type] || typeConfig.padrao;
  const Icon = customIcon || config.icon;

  return (
    <Card className={`bg-gradient-to-b ${config.bgGradient} border-dashed rounded-3xl overflow-hidden relative group`}>
      <div className="absolute top-0 right-0 w-48 h-48 -mr-16 -mt-16 rounded-full bg-white/40 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-32 h-32 -ml-8 -mb-8 rounded-full bg-white/30 blur-2xl" />
      <CardContent className="p-10 flex flex-col items-center text-center relative z-10">
        <div className={`w-20 h-20 rounded-3xl bg-white shadow-lg shadow-slate-200/50 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-xl transition-all duration-500`}>
          <Icon className={`w-10 h-10 ${config.color}`} />
        </div>
        <h3 className="text-lg font-extrabold text-[#111827] mb-2 tracking-tight">{title}</h3>
        <p className="text-sm text-[#475569] max-w-md mb-1 leading-relaxed">{description}</p>
        {subtitle && (
          <p className="text-xs text-[#64748B] max-w-md mb-5">{subtitle}</p>
        )}
        {actionLabel && onAction && (
          <Button
            className="bg-[#F97316] hover:bg-[#EA580C] text-white shadow-lg shadow-orange-500/20 rounded-full px-8 h-11 font-bold text-sm transition-all hover:scale-105 active:scale-95"
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        )}
        {!actionLabel && (
          <div className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/80 border border-slate-200/60 shadow-sm">
            <Clock className="w-3.5 h-3.5 text-[#F97316]" />
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Central de Atendimento 24h</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
