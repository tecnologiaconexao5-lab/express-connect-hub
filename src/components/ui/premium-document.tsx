import React from "react";
import { Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface DocStep {
  value: string;
  label: string;
  icon?: LucideIcon;
  done?: boolean;
  pending?: boolean;
}

/**
 * Navegação por etapas premium (uso dentro de <Tabs>) — Wizard Corporativo.
 * Renderiza o TabsList com número da etapa, ícone, check de etapa concluída,
 * dot âmbar para pendência detectada e linha de progresso conectando as etapas.
 * 100% visual — não altera a navegação (Radix Tabs).
 *
 * `value` (opcional) é a etapa ativa atual — usado apenas para desenhar o
 * progresso. Se não for informado, mantém o comportamento anterior.
 */
export function DocStepNavigation({ steps, className, value }: { steps: DocStep[]; className?: string; value?: string }) {
  const activeIdx = value ? steps.findIndex((s) => s.value === value) : -1;

  return (
    <div className={cn("w-full", className)}>
      <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto border-0 bg-transparent p-0 scrollbar-thin">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isActive = value !== undefined ? step.value === value : undefined;
          const isDone = step.done;
          const connectorDone = isDone || (activeIdx >= 0 && i < activeIdx);

          return (
            <React.Fragment key={step.value}>
              <TabsTrigger
                value={step.value}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all",
                  "data-[state=active]:bg-white data-[state=active]:text-primary",
                  "data-[state=active]:shadow-md data-[state=active]:ring-2 data-[state=active]:ring-primary/50",
                  "hover:bg-white/80 hover:text-primary",
                  isDone && value === undefined && "data-[state=inactive]:bg-emerald-50/70",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-2 transition-all",
                    isActive
                      ? "bg-primary text-white ring-primary/40"
                      : isDone
                        ? "bg-emerald-500 text-white ring-emerald-200"
                        : "border border-slate-200 bg-white text-slate-600 ring-slate-200",
                  )}
                >
                  {isDone ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                {Icon && <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-slate-400")} />}
                <span>{step.label}</span>
                {step.pending && !isDone && (
                  <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-400" title="Pendência detectada" />
                )}
              </TabsTrigger>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "h-[3px] min-w-[14px] flex-1 self-center rounded-full transition-colors",
                    connectorDone ? "bg-gradient-to-r from-emerald-400 to-emerald-300" : "bg-slate-200",
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </TabsList>
    </div>
  );
}

/**
 * Card de seção de formulário premium: ícone + título + descrição + conteúdo.
 * Apenas composição visual — não altera campos nem comportamento.
 */
export function FormSectionCard({
  icon: Icon,
  title,
  description,
  children,
  className,
  contentClassName,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn("rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]", className)}>
      <CardHeader className="overflow-hidden rounded-t-xl border-b border-slate-200/70 bg-slate-50 px-5 pb-2.5 pt-4">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <CardTitle className="text-base font-bold text-slate-800">{title}</CardTitle>
            {description && (
              <CardDescription className="mt-0.5 text-xs text-muted-foreground">{description}</CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn("p-5", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
