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
  status?: "saudavel" | "atencao" | "critico" | "em_andamento" | "concluido";
  loading?: boolean;
  iconColor?: string;
  className?: string;
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
  className = "",
}: PortalKpiCardProps) {
  if (loading) {
    return (
      <Card className={`rounded-2xl border border-slate-200 bg-white/50 backdrop-blur-sm ${className}`}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <Skeleton className="h-3 w-24 rounded-full" />
              <Skeleton className="h-10 w-32 rounded-lg" />
              <Skeleton className="h-3 w-40 rounded-full" />
            </div>
            <Skeleton className="w-14 h-14 rounded-2xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const trendColor =
    trend === undefined
      ? "text-slate-400"
      : trend > 0
        ? "text-emerald-600 dark:text-emerald-400"
        : trend < 0
          ? "text-rose-600 dark:text-rose-400"
          : "text-slate-400";

  const statusIndicator = {
    saudavel: "bg-emerald-500",
    atencao: "bg-amber-500",
    critico: "bg-rose-500",
    em_andamento: "bg-orange-500",
    concluido: "bg-emerald-500",
  }[status || ""];

  return (
    <Card className={`rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-xl hover:border-orange-200 transition-all duration-500 group overflow-hidden relative ${className}`}>
      {/* Decoração de Fundo */}
      <div className="absolute top-0 right-0 w-32 h-32 -mr-12 -mt-12 rounded-full bg-orange-500/[0.03] blur-3xl group-hover:bg-orange-500/[0.08] transition-all duration-700" />
      <div className="absolute bottom-0 left-0 w-24 h-24 -ml-8 -mb-8 rounded-full bg-blue-500/[0.02] blur-2xl group-hover:bg-blue-500/[0.05] transition-all duration-700" />
      
      <CardContent className="p-6 relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              {statusIndicator && (
                <span className={`relative flex h-2 w-2`}>
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusIndicator} opacity-40`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${statusIndicator}`}></span>
                </span>
              )}
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] truncate">
                {title}
              </p>
            </div>

            <div className="flex items-baseline gap-2 flex-wrap">
              <h3 className="text-3xl font-extrabold tracking-tight text-slate-900 group-hover:text-orange-600 transition-colors">
                {value}
              </h3>
              
              {trend !== undefined && (
                <div className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 border border-slate-100 ${trendColor}`}>
                  {trend > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : trend < 0 ? (
                    <TrendingDown className="w-3 h-3" />
                  ) : (
                    <Minus className="w-3 h-3" />
                  )}
                  <span>{Math.abs(trend)}%</span>
                  {trendLabel && <span className="ml-1 text-slate-400 font-medium">{trendLabel}</span>}
                </div>
              )}
            </div>

            {subtitle && (
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex-shrink-0 ml-4">
            <div className={`w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shadow-inner group-hover:bg-orange-50 group-hover:border-orange-100 group-hover:rotate-6 group-hover:scale-110 transition-all duration-500`}>
              <Icon className={`w-7 h-7 ${iconColor || 'text-slate-600 group-hover:text-orange-600'}`} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}