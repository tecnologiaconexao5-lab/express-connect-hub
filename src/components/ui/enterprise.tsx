import React from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Save,
  FileText,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  X,
  type LucideIcon,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ============================================================
 * Design System Enterprise — TMS Conexão Express (UX-001)
 * Componentes 100% visuais. Não alteram dados nem comportamento.
 * ============================================================ */

export type Tone =
  | "slate"
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "orange"
  | "indigo"
  | "purple"
  | "emerald"
  | "violet";

const TONE_CLASSES: Record<Tone, { chip: string; dot: string; text: string; bg: string; border: string }> = {
  slate:   { chip: "bg-slate-50 text-slate-700 border-slate-200",          dot: "bg-slate-500", text: "text-slate-600",   bg: "bg-slate-50/70",    border: "border-slate-200" },
  blue:    { chip: "bg-blue-50 text-blue-700 border-blue-200",            dot: "bg-blue-500", text: "text-blue-700",     bg: "bg-blue-50/60",     border: "border-blue-200" },
  green:   { chip: "bg-green-50 text-green-700 border-green-200",         dot: "bg-green-500", text: "text-green-700",   bg: "bg-green-50/60",    border: "border-green-200" },
  amber:   { chip: "bg-amber-50 text-amber-700 border-amber-200",         dot: "bg-amber-500", text: "text-amber-700",   bg: "bg-amber-50/60",    border: "border-amber-200" },
  red:     { chip: "bg-red-50 text-red-700 border-red-200",               dot: "bg-red-500", text: "text-red-600",      bg: "bg-red-50/60",      border: "border-red-200" },
  orange:  { chip: "bg-orange-50 text-orange-700 border-orange-200",      dot: "bg-orange-500", text: "text-orange-700", bg: "bg-orange-50/60",   border: "border-orange-200" },
  indigo:  { chip: "bg-indigo-50 text-indigo-700 border-indigo-200",      dot: "bg-indigo-500", text: "text-indigo-700", bg: "bg-indigo-50/60",   border: "border-indigo-200" },
  purple:  { chip: "bg-purple-50 text-purple-700 border-purple-200",      dot: "bg-purple-500", text: "text-purple-700", bg: "bg-purple-50/60",   border: "border-purple-200" },
  emerald: { chip: "bg-emerald-50 text-emerald-700 border-emerald-200",   dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50/60", border: "border-emerald-200" },
  violet:  { chip: "bg-violet-50 text-violet-700 border-violet-200",      dot: "bg-violet-500", text: "text-violet-700",  bg: "bg-violet-50/60",   border: "border-violet-200" },
};

/* ---------- Field: wrapper de campo de formulário ---------- */
export const Field = ({ label, children, className = "", required }: { label: React.ReactNode; children: React.ReactNode; className?: string; required?: boolean }) => (
  <div className={className}>
    <Label className="text-xs font-medium text-muted-foreground mb-1 flex items-center justify-between pr-1">
      {label}
      {required && <span className="text-red-500 ml-0.5 font-bold">*</span>}
    </Label>
    {children}
  </div>
);

/* ---------- MetaItem: linha de metadado (rótulo + valor) ---------- */
export function MetaItem({ icon: Icon, label, value, tone = "slate", sub }: {
  icon?: LucideIcon;
  label: string;
  value: React.ReactNode;
  tone?: Tone;
  sub?: string;
}) {
  const t = TONE_CLASSES[tone];
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border bg-white px-3 py-2 shadow-sm", t.border)}>
      {Icon && (
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", t.bg, t.text)}>
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="truncate text-sm font-bold text-slate-800">{value}</p>
        {sub && <p className="truncate text-[10px] text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

/* ---------- MetaChip: pill de status/metadado compacto ---------- */
export function MetaChip({ icon: Icon, label, value, tone = "slate", className }: {
  icon?: LucideIcon;
  label?: string;
  value: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const t = TONE_CLASSES[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold", t.chip, className)}>
      {Icon && <Icon className={cn("h-3.5 w-3.5 shrink-0", t.dot)} />}
      {label && <span className="text-[9px] font-semibold uppercase tracking-wider opacity-70">{label}</span>}
      <span className="truncate">{value}</span>
    </span>
  );
}

/* ---------- StatCard: KPI/indicador do header premium ---------- */
export function StatCard({ icon: Icon, label, value, tone = "slate", sub, className }: {
  icon?: LucideIcon;
  label: string;
  value: React.ReactNode;
  tone?: Tone;
  sub?: React.ReactNode;
  className?: string;
}) {
  const t = TONE_CLASSES[tone];
  return (
    <div className={cn("rounded-xl border bg-white p-3 shadow-sm", t.border, className)}>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className={cn("h-3 w-3 shrink-0", t.dot)} />}
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      </div>
      <p className={cn("mt-1 text-lg font-black leading-tight", t.text)}>{value}</p>
      {sub && <div className="mt-0.5 text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

/* ---------- HeaderPremium: cabeçalho de formulário ---------- */
export function HeaderPremium({ icon: Icon, eyebrow, title, subtitle, right, children, className, dense = false }: {
  icon?: LucideIcon;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /** Modo compacto — usado como cabeçalho interno do workspace (UX-001.2). */
  dense?: boolean;
}) {
  return (
    <div className={cn(
      "overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 shadow-sm",
      dense && "rounded-none border-0 bg-white shadow-none",
      className,
    )}>
      <div className={cn(dense ? "px-4 pt-3 sm:px-5" : "px-5 pt-5 sm:px-6")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <div className={cn("hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:flex", dense && "h-9 w-9 rounded-xl")}>
                <Icon className={cn("h-6 w-6", dense && "h-5 w-5")} />
              </div>
            )}
            <div className="min-w-0">
              {eyebrow && <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{eyebrow}</div>}
              <h2 className={cn("truncate text-xl font-black leading-tight text-slate-900 sm:text-2xl", dense && "text-lg sm:text-xl")}>{title}</h2>
              {subtitle && <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>}
            </div>
          </div>
          {right && <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div>}
        </div>
      </div>
      {children && <div className={cn(dense ? "px-4 pb-4 pt-2 sm:px-5" : "px-5 pb-5 pt-4 sm:px-6")}>{children}</div>}
    </div>
  );
}

/* ---------- PanelSection: seção do painel lateral (dashboard) ---------- */
export type PanelAccent = "primary" | "emerald" | "amber" | "blue" | "violet" | "slate" | "orange";

const PANEL_ACCENTS: Record<PanelAccent, { icon: string; bar: string; bg: string }> = {
  primary: { icon: "text-primary",        bar: "bg-primary",    bg: "bg-white" },
  emerald: { icon: "text-emerald-600",    bar: "bg-emerald-500", bg: "bg-emerald-50/40" },
  amber:   { icon: "text-amber-600",      bar: "bg-amber-500",  bg: "bg-amber-50/40" },
  blue:    { icon: "text-blue-600",       bar: "bg-blue-500",   bg: "bg-blue-50/40" },
  violet:  { icon: "text-violet-600",     bar: "bg-violet-500", bg: "bg-violet-50/40" },
  slate:   { icon: "text-slate-600",      bar: "bg-slate-400",  bg: "bg-slate-50/60" },
  orange:  { icon: "text-orange-600",     bar: "bg-orange-500", bg: "bg-orange-50/40" },
};

export function PanelSection({ icon: Icon, title, accent = "primary", right, children, className }: {
  icon?: LucideIcon;
  title: React.ReactNode;
  accent?: PanelAccent;
  right?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const a = PANEL_ACCENTS[accent];
  return (
    <section className={cn("border-b border-slate-100 last:border-0", className)}>
      <div className="flex items-center gap-2 px-4 pb-1 pt-3">
        <span className={cn("h-4 w-1 shrink-0 rounded-full", a.bar)} />
        {Icon && <Icon className={cn("h-4 w-4 shrink-0", a.icon)} />}
        <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">{title}</h3>
        {right && <div className="ml-auto">{right}</div>}
      </div>
      <div className={cn("px-4 py-3", a.bg)}>{children}</div>
    </section>
  );
}

/* ---------- PanelRow: linha de resumo (rótulo + valor) ---------- */
export function PanelRow({ label, value, sub, valueClass }: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <div className="min-w-0 text-right">
        <span className={cn("block truncate text-xs font-bold text-slate-800", valueClass)}>{value}</span>
        {sub && <span className="block truncate text-[10px] text-slate-400">{sub}</span>}
      </div>
    </div>
  );
}

/* ---------- ChecklistItem: item do painel inteligente ---------- */
export function ChecklistItem({ ok, label, detail, warnOnly }: {
  ok: boolean;
  label: React.ReactNode;
  detail?: React.ReactNode;
  warnOnly?: boolean;
}) {
  const isOk = warnOnly ? false : ok;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-2.5 py-1.5",
        isOk ? "bg-emerald-50/70 border-emerald-200" : "bg-amber-50/70 border-amber-200",
      )}
    >
      {isOk ? (
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
      ) : (
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
      )}
      <div className="min-w-0">
        <p className={cn("text-[11px] font-semibold", isOk ? "text-emerald-800" : "text-amber-800")}>{label}</p>
        {detail && <p className="truncate text-[10px] text-slate-500">{detail}</p>}
      </div>
    </div>
  );
}

/* ---------- FormFooterBar: barra inferior fixa ---------- */
export function FormFooterBar({
  onCancelar,
  cancelarLabel = "Cancelar",
  onSalvarRascunho,
  rascunhoLabel = "Salvar rascunho",
  canRascunho = true,
  onSalvar,
  salvarLabel = "Salvar",
  isSaving = false,
  disabled = false,
  onAvancar,
  canAvancar = true,
  avancarLabel = "Avançar",
  readOnly = false,
  className,
}: {
  onCancelar: () => void;
  cancelarLabel?: string;
  onSalvarRascunho?: () => void;
  rascunhoLabel?: string;
  canRascunho?: boolean;
  onSalvar?: () => void;
  salvarLabel?: string;
  isSaving?: boolean;
  disabled?: boolean;
  onAvancar?: () => void;
  canAvancar?: boolean;
  avancarLabel?: string;
  readOnly?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "z-50 flex shrink-0 items-center justify-between gap-4 border-t bg-white/95 px-6 py-3 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] backdrop-blur",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={onCancelar} disabled={isSaving}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {cancelarLabel}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        {!readOnly && onSalvarRascunho && (
          <Button variant="outline" onClick={onSalvarRascunho} disabled={!canRascunho || disabled || isSaving}>
            <FileText className="mr-2 h-4 w-4" /> {rascunhoLabel}
          </Button>
        )}
        {!readOnly && onSalvar && (
          <Button onClick={onSalvar} disabled={disabled || isSaving} className="min-w-[150px] bg-primary hover:bg-primary/90 text-primary-foreground">
            <Save className="mr-2 h-4 w-4" /> {isSaving ? "Salvando..." : salvarLabel}
          </Button>
        )}
        {onAvancar && (
          <Button variant="secondary" onClick={onAvancar} disabled={!canAvancar || isSaving} className="min-w-[120px]">
            {avancarLabel} <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/* ============================================================
 * Workspace Enterprise (UX-001.2) — padrão visual do formulário
 * da Escala ("Gerenciar Alocação de Recurso").
 * Componentes 100% de composição visual. Não alteram dados.
 * ============================================================ */

/* ---------- EnterpriseFormWorkspace: contêiner único ---------- */
export function EnterpriseFormWorkspace({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ---------- EnterpriseWorkspaceHeader: faixa do cabeçalho interno ---------- */
export function EnterpriseWorkspaceHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex-none border-b border-slate-200/90 bg-white", className)}>{children}</div>
  );
}

/* ---------- EnterpriseFormBody: corpo 2 colunas + painel auxiliar ---------- */
export function EnterpriseFormBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50/80 lg:flex-row", className)}>
      {children}
    </div>
  );
}

/* ---------- EnterpriseContextSidebar: painel lateral esquerdo (contexto) ---------- */
export function EnterpriseContextSidebar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-b border-slate-200 bg-white p-4 scrollbar-thin lg:w-60 lg:border-b-0 lg:border-r lg:p-4 xl:w-64 2xl:w-72",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ---------- EnterpriseMainContent: área principal (scroll único) ---------- */
export function EnterpriseMainContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto p-4 scrollbar-thin lg:p-5", className)}>
      {children}
    </div>
  );
}

/* ---------- EnterpriseStepStrip: faixa clara do wizard horizontal ---------- */
export function EnterpriseStepStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex-none rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-[0_1px_3px_rgba(15,23,42,0.05)]", className)}>
      {children}
    </div>
  );
}

/* ---------- EnterpriseAuxiliaryPanel: painel complementar direito (resumo/checklist) ---------- */
export function EnterpriseAuxiliaryPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <aside className={cn("hidden w-72 shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white scrollbar-thin xl:flex", className)}>
      {children}
    </aside>
  );
}

/* ---------- EnterpriseWorkspaceFooter: rodapé interno do workspace ---------- */
export function EnterpriseWorkspaceFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex-none border-t border-slate-200/90 bg-white", className)}>{children}</div>
  );
}

/* ============================================================
 * Modal Premium (UX-002) — formulário destacado sobre a página.
 * Overlay escuro + painel centralizado (~96% largura / ~93% altura),
 * cantos arredondados, sombra corporativa, fundo interno cinza-claro.
 * 100% visual — apenas composição. Não altera dados nem comportamento.
 * ============================================================ */

/* ---------- PremiumDocumentDialog: overlay + painel centralizado ----------
 * Renderizado via portal em document.body, no MESMO z-index dos portais
 * shadcn internos (Select, DropdownMenu, Dialog — z-50). Assim o overlay
 * cobre o shell da aplicação (sidebar z-50) e, por ser irmão posterior no
 * body, permite que os dropdowns/diálogos internos (também z-50, abertos
 * depois) pintem por cima do formulário — mesmo comportamento do shadcn
 * Dialog usado no "Gerenciar Alocação de Recurso". 100% visual.
 * ============================================================ */
export function PremiumDocumentDialog({ children, className }: { children: React.ReactNode; className?: string }) {
  const node = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-[2px] sm:p-4">
      <div
        className={cn(
          "flex h-[93vh] w-[96vw] max-w-[1800px] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-100/95 shadow-[0_30px_80px_rgba(2,6,23,0.55)]",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
  return typeof document !== "undefined" ? createPortal(node, document.body) : node;
}

/* ---------- PremiumDialogHeader: cabeçalho fixo do formulário ---------- */
export function PremiumDialogHeader({ children, onClose, className }: {
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-none items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5 shadow-sm sm:px-5", className)}>
      {children}
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        title="Fechar"
        className="ml-auto h-9 w-9 shrink-0 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      >
        <X className="h-5 w-5" />
      </Button>
    </div>
  );
}
