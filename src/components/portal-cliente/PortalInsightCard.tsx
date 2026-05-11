import { LucideIcon, TrendingDown, TrendingUp, Clock, AlertTriangle, BarChart3, Bell, Lightbulb, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type InsightType = "economia" | "atraso" | "sla" | "volume" | "alerta";
type Priority = "alta" | "media" | "baixa";

interface PortalInsightCardProps {
  type: InsightType;
  title: string;
  description: string;
  priority?: Priority;
  metric?: string;
  suggestion?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const typeConfig: Record<InsightType, { icon: LucideIcon; color: string; bgColor: string; borderColor: string }> = {
  economia: {
    icon: TrendingDown,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-100",
  },
  atraso: {
    icon: Clock,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-100",
  },
  sla: {
    icon: BarChart3,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-100",
  },
  volume: {
    icon: TrendingUp,
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-100",
  },
  alerta: {
    icon: AlertTriangle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-100",
  },
};

const priorityBorder: Record<Priority, string> = {
  alta: "border-l-red-500",
  media: "border-l-amber-500",
  baixa: "border-l-emerald-500",
};

export function PortalInsightCard({
  type,
  title,
  description,
  priority = "media",
  metric,
  suggestion,
  actionLabel,
  onAction,
}: PortalInsightCardProps) {
  const config = typeConfig[type];

  return (
    <Card className={`bg-white border-slate-200 border-l-4 rounded-2xl ${priorityBorder[priority]} hover:border-primary/30 shadow-sm hover:shadow-md transition-all duration-300 group`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl ${config.bgColor} border ${config.borderColor} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
            <config.icon className={`w-6 h-6 ${config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-slate-900 truncate">{title}</h4>
              {metric && (
                <span className="text-xl font-black text-orange-600">{metric}</span>
              )}
            </div>
            <p className="text-xs text-slate-600 font-medium mt-1.5 line-clamp-2 leading-relaxed">{description}</p>
            {suggestion && (
              <div className="flex items-center gap-1.5 mt-4 py-1.5 px-2.5 bg-orange-50 rounded-lg border border-orange-100 w-fit shadow-sm">
                <Lightbulb className="w-3.5 h-3.5 text-orange-600" />
                <p className="text-[10px] font-black text-orange-700 uppercase tracking-widest">{suggestion}</p>
              </div>
            )}
            {actionLabel && onAction && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 text-xs font-bold text-primary hover:text-primary/80 hover:bg-transparent p-0 h-auto group-hover:translate-x-1 transition-transform"
                onClick={onAction}
              >
                {actionLabel} <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}