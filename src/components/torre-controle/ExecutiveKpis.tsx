/**
 * Grade Executiva de KPIs — TMS-030 Fase 1
 *
 * Dashboard executivo compacto com 12 indicadores reais derivados
 * de fontes já existentes (OS, alocações, tracking) — sem novas queries.
 *
 * MISSÃO A23 — FASE B:
 * Suporte opcional a `onClick` por card. Quando fornecido, o card vira um
 * botão acessível (foco por teclado, Enter/Space). Quando NÃO fornecido, o
 * card permanece exatamente como antes (não clicável, sem falso botão).
 */

import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type KpiTone =
  | "indigo"
  | "emerald"
  | "sky"
  | "orange"
  | "amber"
  | "rose"
  | "red"
  | "purple"
  | "blue"
  | "slate";

export interface KpiItem {
  key: string;
  label: string;
  value: number | string;
  sub?: string;
  icon: LucideIcon;
  tone: KpiTone;
  /** MISSÃO A23-B: ação opcional ao clicar no card. Sem onClick = card não clicável. */
  onClick?: () => void;
}

const TONE_CLASSES: Record<KpiTone, { icon: string; bg: string; bar: string }> = {
  indigo: { icon: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-100 dark:bg-indigo-500/15", bar: "bg-indigo-500" },
  emerald: { icon: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-500/15", bar: "bg-emerald-500" },
  sky: { icon: "text-sky-600 dark:text-sky-400", bg: "bg-sky-100 dark:bg-sky-500/15", bar: "bg-sky-500" },
  orange: { icon: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-500/15", bar: "bg-orange-500" },
  amber: { icon: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-500/15", bar: "bg-amber-500" },
  rose: { icon: "text-rose-600 dark:text-rose-400", bg: "bg-rose-100 dark:bg-rose-500/15", bar: "bg-rose-500" },
  red: { icon: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-500/15", bar: "bg-red-500" },
  purple: { icon: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-500/15", bar: "bg-purple-500" },
  blue: { icon: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-500/15", bar: "bg-blue-500" },
  slate: { icon: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-500/15", bar: "bg-slate-400" },
};

function KpiContent({ item, tone }: { item: KpiItem; tone: { icon: string; bg: string; bar: string } }) {
  return (
    <>
      <span className={`absolute top-0 left-0 right-0 h-0.5 ${tone.bar}`} />
      <CardContent className="p-3.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
            {item.label}
          </p>
          <p className="text-2xl font-black leading-tight tabular-nums mt-0.5">{item.value}</p>
          {item.sub && <p className="text-[10px] text-muted-foreground truncate">{item.sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${tone.bg} flex items-center justify-center shrink-0`}>
          <item.icon className={`w-5 h-5 ${tone.icon}`} />
        </div>
      </CardContent>
    </>
  );
}

function KpiCard({ item }: { item: KpiItem }) {
  const tone = TONE_CLASSES[item.tone];

  if (item.onClick) {
    return (
      <button
        type="button"
        onClick={item.onClick}
        aria-label={`${item.label}: ${item.value}${item.sub ? ` — ${item.sub}` : ""}`}
        className={cn(
          "overflow-hidden relative w-full text-left cursor-pointer rounded-xl border bg-card text-foreground shadow-sm transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "hover:shadow-md hover:border-primary/40"
        )}
      >
        <KpiContent item={item} tone={tone} />
      </button>
    );
  }

  return (
    <Card className="overflow-hidden relative">
      <KpiContent item={item} tone={tone} />
    </Card>
  );
}

export function ExecutiveKpis({ items }: { items: KpiItem[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
      {items.map((item) => (
        <KpiCard key={item.key} item={item} />
      ))}
    </div>
  );
}
