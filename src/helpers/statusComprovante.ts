export type StatusComprovante = "pendente" | "enviado";

export interface ComprovanteStatusInfo {
  status: StatusComprovante;
  label: string;
  variant: "outline" | "secondary" | "default" | "destructive";
  className: string;
  cor: string;
  icone: string;
}

const STATUS_MAP: Record<StatusComprovante, ComprovanteStatusInfo> = {
  pendente: {
    status: "pendente",
    label: "Sem Comprovante",
    variant: "outline",
    className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300",
    cor: "text-red-600",
    icone: "FileX",
  },
  enviado: {
    status: "enviado",
    label: "Comprovante Enviado",
    variant: "secondary",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300",
    cor: "text-emerald-600",
    icone: "FileCheck",
  },
};

export function getStatusComprovanteInfo(status?: StatusComprovante): ComprovanteStatusInfo {
  return STATUS_MAP[status || "pendente"] || STATUS_MAP.pendente;
}

export function detectarStatusComprovante(aloc: Record<string, unknown>): StatusComprovante {
  const comprovanteUrl = aloc.comprovante_url;
  const fotos = aloc.fotos_entrega;
  const assinaturaUrl = aloc.assinatura_url;

  if (comprovanteUrl && typeof comprovanteUrl === "string" && comprovanteUrl.trim().length > 0) {
    return "enviado";
  }
  if (assinaturaUrl && typeof assinaturaUrl === "string" && assinaturaUrl.trim().length > 0) {
    return "enviado";
  }
  if (Array.isArray(fotos) && fotos.length > 0) {
    return "enviado";
  }
  return "pendente";
}

export const FILTRO_COMPROVANTE_OPCOES = [
  { value: "todos", label: "Todos" },
  { value: "pendente", label: "Sem Comprovante" },
  { value: "enviado", label: "Com Comprovante" },
] as const;
