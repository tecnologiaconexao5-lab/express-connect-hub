import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface PortalKpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  status?: "saudavel" | "atencao" | "critico";
  loading?: boolean;
  iconColor?: string;
}

export function PortalKpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendLabel,
  status,
  loading = false,
  iconColor,
}: PortalKpiCardProps) {
  if (loading) {
    return (
      <Card className="card-premium">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="w-12 h-12 rounded-xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const trendColor =
    trend === undefined
      ? "text-muted-foreground"
      : trend > 0
        ? "text-emerald-600 dark:text-emerald-400"
        : trend < 0
          ? "text-red-600 dark:text-red-400"
          : "text-muted-foreground";

  const statusIndicator =
    status === "saudavel"
      ? "bg-emerald-500 dark:bg-emerald-500"
      : status === "atencao"
        ? "bg-amber-500"
        : status === "critico"
          ? "bg-red-500"
          : null;

  return (
    <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden relative">
      <div className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full bg-orange-500/5 blur-3xl group-hover:bg-orange-500/10 transition-colors" />
      <CardContent className="p-6">
        <div className="flex items-start justify-between relative z-10">
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              {statusIndicator && (
                <span
                  className={`w-2 h-2 rounded-full ${statusIndicator} ${
                    status === "atencao" || status === "critico" ? "animate-pulse" : ""
                  }`}
                />
              )}
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-extrabold tracking-tight text-foreground">{value}</p>
              {trend !== undefined && (
                <div className={`flex items-center gap-0.5 text-xs font-bold ${trendColor}`}>
                  {trend > 0 ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : trend < 0 ? (
                    <TrendingDown className="w-3.5 h-3.5" />
                  ) : (
                    <Minus className="w-3.5 h-3.5" />
                  )}
                  <span>{Math.abs(trend)}%</span>
                </div>
              )}
            </div>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground font-medium">{subtitle}</p>
            )}
          </div>
          <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center shadow-sm group-hover:bg-orange-100 transition-all duration-300 group-hover:scale-110">
            <Icon className="w-7 h-7 text-orange-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}