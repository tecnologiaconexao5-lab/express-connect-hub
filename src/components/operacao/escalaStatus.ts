import { obterInfoGlobal, obterClasseBadgeGlobal as obterBadgeGlobal, type StatusGlobal } from "./statusGlobal";

// Mapeamento dos status do Supabase (banco) para formato usado na UI
const STATUS_BANCO_PARA_UI: Record<string, string> = {
  planejada: 'confirmado',
  aguardando_aceite: 'aguardando',
  aceita: 'confirmado',
  recusada: 'cancelado',
  em_rota: 'operacao',
  concluida: 'confirmado',
  cancelada: 'cancelado',
  ocorrencia: 'operacao',
};

// Mapeamento reverso: formato UI para Supabase
const STATUS_UI_PARA_BANCO: Record<string, string> = {
  confirmado: 'planejada',
  aguardando: 'aguardando_aceite',
  operacao: 'em_rota',
  cancelado: 'cancelada',
};

// Conjunto de variantes de "cancelado" para detecção segura
const VARIANTES_CANCELADO = new Set(['cancelado', 'cancelada', 'recusada']);

// Conjunto de variantes de "ativo/em rota" para detecção segura
const VARIANTES_ATIVO = new Set(['confirmado', 'planejada', 'operacao', 'em_rota', 'aceita', 'aguardando', 'aguardando_aceite', 'concluida', 'ocorrencia']);

/**
 * Normaliza qualquer formato de status para o formato usado na UI.
 * Seguro para usar com dados do Supabase, localStorage (qualquer versão) e entrada do usuário.
 * É idempotente: se o status já está em formato UI, retorna o mesmo valor.
 */
export function normalizarStatusParaUI(status: string | null | undefined): string {
  if (!status) return 'aguardando';
  const lower = String(status).toLowerCase().trim();
  if (STATUS_BANCO_PARA_UI[lower]) return STATUS_BANCO_PARA_UI[lower];
  return lower;
}

/**
 * Converte um status do formato UI para o formato do Supabase.
 * Usado antes de enviar dados para o banco.
 * Se o status já está em formato Supabase, retorna o mesmo valor.
 */
export function normalizarStatusParaBanco(status: string | null | undefined): string {
  if (!status) return 'planejada';
  const lower = String(status).toLowerCase().trim();
  if (STATUS_UI_PARA_BANCO[lower]) return STATUS_UI_PARA_BANCO[lower];
  return lower;
}

/**
 * Verifica se o status representa uma alocação cancelada/recusada.
 * Detecta qualquer variante: 'cancelado', 'cancelada', 'recusada'.
 */
export function isStatusCancelado(status: string | null | undefined): boolean {
  if (!status) return false;
  return VARIANTES_CANCELADO.has(String(status).toLowerCase().trim());
}

/**
 * Verifica se o status representa uma alocação ativa (não cancelada).
 */
export function isStatusAtivo(status: string | null | undefined): boolean {
  if (!status) return true;
  const lower = String(status).toLowerCase().trim();
  return VARIANTES_ATIVO.has(lower) || !isStatusCancelado(lower);
}

/**
 * Retorna o label de exibição para um status.
 * Aceita tanto formato UI quanto banco.
 */
export function obterLabelStatus(status: string | null | undefined): string {
  const ui = normalizarStatusParaUI(status);
  const LABELS: Record<string, string> = {
    confirmado: 'Confirmado',
    cancelado: 'Cancelado',
    operacao: 'Em Rota',
    aguardando: 'Aguardando',
  };
  return LABELS[ui] ?? ui;
}

/**
 * Retorna a classe CSS para um status (formato Tailwind).
 * Aceita tanto formato UI quanto banco.
 */
export function obterClasseBadgeStatus(status: string | null | undefined): string {
  const ui = normalizarStatusParaUI(status);
  if (ui === 'cancelado') return 'bg-red-100 text-red-700 border-red-200';
  if (ui === 'confirmado') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (ui === 'operacao') return 'bg-orange-500 text-white border-orange-600';
  return 'bg-amber-100 text-amber-700 border-amber-200';
}

export function obterClasseBadgeConfirmacao(status: string | null | undefined): string {
  const ui = normalizarStatusParaUI(status);
  if (ui === 'cancelado') return 'bg-red-500 text-white';
  if (ui === 'operacao') return 'bg-orange-500 text-white';
  if (ui === 'aguardando') return 'bg-amber-500 text-white';
  return 'bg-emerald-500 text-white';
}

const MAPA_ESCALA_PARA_GLOBAL: Record<string, StatusGlobal> = {
  planejada: "alocado",
  aguardando_aceite: "pendente",
  aceita: "alocado",
  recusada: "pendente",
  em_rota: "em_rota",
  concluida: "finalizado",
  cancelada: "pendente",
  ocorrencia: "em_rota",
};

export function obterStatusGlobalEscala(status: string | null | undefined): StatusGlobal {
  if (!status) return "pendente";
  const s = status.toLowerCase().trim();
  return MAPA_ESCALA_PARA_GLOBAL[s] || "pendente";
}

export function obterLabelGlobalEscala(status: string | null | undefined): string {
  return obterInfoGlobal(obterStatusGlobalEscala(status)).label;
}

export function obterClasseBadgeGlobalEscala(status: string | null | undefined): string {
  return obterBadgeGlobal(obterStatusGlobalEscala(status), "suave");
}
