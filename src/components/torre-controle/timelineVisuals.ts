/**
 * Visuals Compartilhados da Timeline — TMS-030 Fase 1
 *
 * Centraliza labels, ícones e cores da timeline operacional para que
 * a Torre de Controle e o painel lateral (DetalhesOperacaoSheet)
 * consumam a MESMA fonte de verdade visual.
 *
 * Fonte de verdade:
 *   - TMS-027 §7 (Contrato de Timeline)
 */

import {
  Play,
  Truck,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Bell,
  FileX,
  MapPin,
  Package,
  Camera,
  PenTool,
  FileText,
  Navigation,
  Activity,
  type LucideIcon,
} from "lucide-react";
import type { TipoEventoTimeline } from "./types";

export const TIMELINE_LABELS: Record<TipoEventoTimeline, string> = {
  os_criada: "OS Criada",
  os_em_rota: "Em Rota",
  os_atrasada: "Atrasada",
  os_concluida: "Concluída",
  ocorrencia_aberta: "Ocorrência",
  alerta_humano: "Alerta",
  comprovante_pendente: "Pendência",
  alocacao_concluida: "Alocação",
  app_aceite: "Aceite",
  app_chegada: "Chegada",
  app_coleta: "Coleta",
  app_deslocamento: "Deslocamento",
  app_entrega: "Entrega",
  app_finalizacao: "Finalização",
  app_evidencia: "Evidência",
  app_assinatura: "Assinatura",
  app_documento: "Documento",
  app_gps: "GPS",
  app_generico: "Evento App",
};

export const TIMELINE_ICONS: Record<TipoEventoTimeline, LucideIcon> = {
  os_criada: Play,
  os_em_rota: Truck,
  os_atrasada: AlertTriangle,
  os_concluida: CheckCircle,
  ocorrencia_aberta: AlertCircle,
  alerta_humano: Bell,
  comprovante_pendente: FileX,
  alocacao_concluida: CheckCircle,
  app_aceite: CheckCircle,
  app_chegada: MapPin,
  app_coleta: Package,
  app_deslocamento: Truck,
  app_entrega: MapPin,
  app_finalizacao: CheckCircle,
  app_evidencia: Camera,
  app_assinatura: PenTool,
  app_documento: FileText,
  app_gps: Navigation,
  app_generico: Activity,
};

export const TIMELINE_COLORS: Record<
  TipoEventoTimeline,
  { bg: string; icon: string; label: string; dot: string }
> = {
  os_criada: { bg: "bg-blue-50/60 dark:bg-blue-950/20", icon: "text-blue-500", label: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500" },
  os_em_rota: { bg: "bg-indigo-50/60 dark:bg-indigo-950/20", icon: "text-indigo-500", label: "text-indigo-700 dark:text-indigo-400", dot: "bg-indigo-500" },
  os_atrasada: { bg: "bg-rose-50/60 dark:bg-rose-950/20", icon: "text-rose-500", label: "text-rose-700 dark:text-rose-400", dot: "bg-rose-500" },
  os_concluida: { bg: "bg-emerald-50/60 dark:bg-emerald-950/20", icon: "text-emerald-500", label: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  ocorrencia_aberta: { bg: "bg-amber-50/60 dark:bg-amber-950/20", icon: "text-amber-500", label: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  alerta_humano: { bg: "bg-yellow-50/60 dark:bg-yellow-950/20", icon: "text-yellow-500", label: "text-yellow-700 dark:text-yellow-400", dot: "bg-yellow-500" },
  comprovante_pendente: { bg: "bg-purple-50/60 dark:bg-purple-950/20", icon: "text-purple-500", label: "text-purple-700 dark:text-purple-400", dot: "bg-purple-500" },
  alocacao_concluida: { bg: "bg-teal-50/60 dark:bg-teal-950/20", icon: "text-teal-500", label: "text-teal-700 dark:text-teal-400", dot: "bg-teal-500" },
  app_aceite: { bg: "bg-green-50/60 dark:bg-green-950/20", icon: "text-green-500", label: "text-green-700 dark:text-green-400", dot: "bg-green-500" },
  app_chegada: { bg: "bg-cyan-50/60 dark:bg-cyan-950/20", icon: "text-cyan-500", label: "text-cyan-700 dark:text-cyan-400", dot: "bg-cyan-500" },
  app_coleta: { bg: "bg-sky-50/60 dark:bg-sky-950/20", icon: "text-sky-500", label: "text-sky-700 dark:text-sky-400", dot: "bg-sky-500" },
  app_deslocamento: { bg: "bg-indigo-50/60 dark:bg-indigo-950/20", icon: "text-indigo-500", label: "text-indigo-700 dark:text-indigo-400", dot: "bg-indigo-500" },
  app_entrega: { bg: "bg-orange-50/60 dark:bg-orange-950/20", icon: "text-orange-500", label: "text-orange-700 dark:text-orange-400", dot: "bg-orange-500" },
  app_finalizacao: { bg: "bg-emerald-50/60 dark:bg-emerald-950/20", icon: "text-emerald-500", label: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  app_evidencia: { bg: "bg-violet-50/60 dark:bg-violet-950/20", icon: "text-violet-500", label: "text-violet-700 dark:text-violet-400", dot: "bg-violet-500" },
  app_assinatura: { bg: "bg-fuchsia-50/60 dark:bg-fuchsia-950/20", icon: "text-fuchsia-500", label: "text-fuchsia-700 dark:text-fuchsia-400", dot: "bg-fuchsia-500" },
  app_documento: { bg: "bg-slate-50/60 dark:bg-slate-950/20", icon: "text-slate-500", label: "text-slate-700 dark:text-slate-400", dot: "bg-slate-500" },
  app_gps: { bg: "bg-lime-50/60 dark:bg-lime-950/20", icon: "text-lime-500", label: "text-lime-700 dark:text-lime-400", dot: "bg-lime-500" },
  app_generico: { bg: "bg-gray-50/60 dark:bg-gray-950/20", icon: "text-gray-500", label: "text-gray-700 dark:text-gray-400", dot: "bg-gray-500" },
};

/** Severidade — badge visual reutilizado pela timeline */
export const SEVERIDADE_BADGE: Record<"baixa" | "media" | "alta" | "critica", string> = {
  baixa: "text-slate-600 bg-slate-100 dark:bg-slate-900/40 dark:text-slate-400",
  media: "text-amber-600 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400",
  alta: "text-orange-600 bg-orange-100 dark:bg-orange-900/40 dark:text-orange-400",
  critica: "text-rose-600 bg-rose-100 dark:bg-rose-900/40 dark:text-rose-400",
};
