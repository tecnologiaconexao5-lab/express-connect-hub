import { LucideIcon, Package, Clock, AlertCircle, TrendingUp, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type EmptyStateType = "padrao" | "sem-dados" | "sem-resultado" | "sem-ocorrencias" | "sem-faturamento";

interface PortalEmptyStateProps {
  type?: EmptyStateType;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: LucideIcon;
}

const typeConfig: Record<EmptyStateType, { icon: LucideIcon; color: string }> = {
  "padrao": {
    icon: Package,
    color: "text-slate-500",
  },
  "sem-dados": {
    icon: Clock,
    color: "text-slate-500",
  },
  "sem-resultado": {
    icon: FileText,
    color: "text-slate-500",
  },
  "sem-ocorrencias": {
    icon: AlertCircle,
    color: "text-emerald-500",
  },
  "sem-faturamento": {
    icon: TrendingUp,
    color: "text-slate-500",
  },
};

export function PortalEmptyState({
  type = "padrao",
  title,
  description,
  actionLabel,
  onAction,
  icon: customIcon,
}: PortalEmptyStateProps) {
  const config = customIcon
    ? { icon: customIcon, color: "text-slate-500" }
    : typeConfig[type];

  return (
    <Card className="bg-white border-[#E5E7EB] border-dashed rounded-2xl">
      <CardContent className="p-8 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#F8FAFC] flex items-center justify-center mb-4">
          <config.icon className={`w-8 h-8 ${config.color}`} />
        </div>
        <h3 className="text-base font-medium text-[#111827] mb-2">{title}</h3>
        <p className="text-sm text-[#64748B] max-w-sm mb-4">{description}</p>
        {actionLabel && onAction && (
          <Button
            className="bg-[#F97316] hover:bg-[#EA580C] text-white border-0 rounded-xl"
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}