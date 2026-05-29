export type StatusGlobal =
  | "rascunho"
  | "pendente"
  | "alocado"
  | "carregando"
  | "em_rota"
  | "entregue"
  | "finalizado"
  | "faturado"
  | "pago_prestador"
  | "cancelado";

export const STATUS_GLOBAL_ORDER: StatusGlobal[] = [
  "rascunho",
  "pendente",
  "alocado",
  "carregando",
  "em_rota",
  "entregue",
  "finalizado",
  "faturado",
  "pago_prestador",
  "cancelado",
];

export interface StatusGlobalInfo {
  label: string;
  cor: "slate" | "amber" | "blue" | "orange" | "indigo" | "green" | "emerald" | "violet" | "purple";
  etapa: number;
  descricao: string;
}

export const STATUS_GLOBAL_INFO: Record<StatusGlobal, StatusGlobalInfo> = {
  rascunho:      { label: "Rascunho",      cor: "slate",   etapa: 0, descricao: "OS criada, aguardando preenchimento" },
  pendente:      { label: "Pendente",       cor: "amber",   etapa: 1, descricao: "Aguardando alocação de prestador" },
  alocado:       { label: "Alocado",        cor: "blue",    etapa: 2, descricao: "Prestador alocado na escala" },
  carregando:    { label: "Carregando",     cor: "orange",  etapa: 3, descricao: "Em carregamento / coleta" },
  em_rota:       { label: "Em Rota",        cor: "indigo",  etapa: 4, descricao: "Saiu para entrega" },
  entregue:      { label: "Entregue",       cor: "green",   etapa: 5, descricao: "Mercadoria entregue" },
  finalizado:    { label: "Finalizado",     cor: "emerald", etapa: 6, descricao: "Operação concluída" },
  faturado:      { label: "Faturado",       cor: "violet",  etapa: 7, descricao: "Cliente faturado" },
  pago_prestador:{ label: "Pago Prest.",    cor: "purple",  etapa: 8, descricao: "Prestador pago" },
  cancelado:     { label: "Cancelada",       cor: "slate",   etapa: 9, descricao: "OS cancelada" },
};

export function obterInfoGlobal(status: string | null | undefined): StatusGlobalInfo {
  if (status && STATUS_GLOBAL_INFO[status as StatusGlobal]) {
    return STATUS_GLOBAL_INFO[status as StatusGlobal];
  }
  return STATUS_GLOBAL_INFO.pendente;
}

export function obterClasseBadgeGlobal(status: string | null | undefined, variante: "preenchido" | "contorno" | "suave" = "preenchido"): string {
  const info = obterInfoGlobal(status);
  const cores: Record<string, { preenchido: string; contorno: string; suave: string }> = {
    slate:   { preenchido: "bg-slate-600 text-white",           contorno: "border-slate-400 text-slate-700",          suave: "bg-slate-100 text-slate-700 border-slate-200" },
    amber:   { preenchido: "bg-amber-500 text-white",           contorno: "border-amber-400 text-amber-700",          suave: "bg-amber-50 text-amber-700 border-amber-200" },
    blue:    { preenchido: "bg-blue-600 text-white",            contorno: "border-blue-400 text-blue-700",            suave: "bg-blue-50 text-blue-700 border-blue-200" },
    orange:  { preenchido: "bg-orange-500 text-white",          contorno: "border-orange-400 text-orange-700",        suave: "bg-orange-50 text-orange-700 border-orange-200" },
    indigo:  { preenchido: "bg-indigo-600 text-white",          contorno: "border-indigo-400 text-indigo-700",        suave: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    green:   { preenchido: "bg-green-600 text-white",           contorno: "border-green-400 text-green-700",          suave: "bg-green-50 text-green-700 border-green-200" },
    emerald: { preenchido: "bg-emerald-600 text-white",         contorno: "border-emerald-400 text-emerald-700",      suave: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    violet:  { preenchido: "bg-violet-600 text-white",          contorno: "border-violet-400 text-violet-700",        suave: "bg-violet-50 text-violet-700 border-violet-200" },
    purple:  { preenchido: "bg-purple-600 text-white",          contorno: "border-purple-400 text-purple-700",        suave: "bg-purple-50 text-purple-700 border-purple-200" },
  };
  return cores[info.cor]?.[variante] || cores.slate[variante];
}

export function obterClasseDotGlobal(status: string | null | undefined): string {
  const info = obterInfoGlobal(status);
  const dotCores: Record<string, string> = {
    slate:   "bg-slate-500",
    amber:   "bg-amber-500",
    blue:    "bg-blue-500",
    orange:  "bg-orange-500",
    indigo:  "bg-indigo-500",
    green:   "bg-green-500",
    emerald: "bg-emerald-500",
    violet:  "bg-violet-500",
    purple:  "bg-purple-500",
  };
  return dotCores[info.cor] || dotCores.slate;
}

export function isStatusConcluido(status: string | null | undefined): boolean {
  const global = mapearParaGlobal(status);
  if (!global) return false;
  const ordem = STATUS_GLOBAL_ORDER.indexOf(global);
  return ordem >= STATUS_GLOBAL_ORDER.indexOf("finalizado");
}

export function isStatusCancelado(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase().trim();
  return s === "cancelada" || s === "cancelado" || s === "recusada";
}

export function isStatusAtivo(status: string | null | undefined): boolean {
  if (!status) return true;
  return !isStatusCancelado(status) && !isStatusConcluido(status);
}

export function obterEtapaGlobal(status: string | null | undefined): number {
  const global = mapearParaGlobal(status);
  if (!global) return 0;
  return STATUS_GLOBAL_INFO[global].etapa;
}

export function obterLabelGlobal(status: string | null | undefined): string {
  const info = obterInfoGlobal(mapearParaGlobal(status));
  return info.label;
}

const MAPA_OS_PARA_GLOBAL: Record<string, StatusGlobal> = {
  rascunho:     "rascunho",
  pendente:     "pendente",
  agendada:     "alocado",
  em_andamento: "carregando",
  em_rota:      "em_rota",
  coletado:     "carregando",
  entregue:     "entregue",
  finalizada:   "finalizado",
  encerrada:    "finalizado",
  cancelada:    "cancelado",
  ocorrencia:   "em_rota",
  faturada:     "faturado",
  paga:         "pago_prestador",
};

const MAPA_ESCALA_PARA_GLOBAL: Record<string, StatusGlobal> = {
  planejada:         "alocado",
  aguardando_aceite: "pendente",
  aceita:            "alocado",
  recusada:          "pendente",
  em_rota:           "em_rota",
  concluida:         "finalizado",
  cancelada:         "cancelado",
  ocorrencia:        "em_rota",
};

const MAPA_FINANCEIRO_PARA_GLOBAL: Record<string, StatusGlobal> = {
  "a faturar": "finalizado",
  faturada:    "faturado",
  paga:        "pago_prestador",
  aberto:      "finalizado",
  a_vencer:    "finalizado",
  vencido:     "finalizado",
  quitado:     "pago_prestador",
};

const MAPA_PAGAMENTO_PARA_GLOBAL: Record<string, StatusGlobal> = {
  pendente:  "finalizado",
  agendado:  "finalizado",
  em_lote:   "finalizado",
  pago:      "pago_prestador",
  cancelado: "pendente",
  aprovado:  "finalizado",
};

export function mapearParaGlobal(
  status: string | null | undefined,
  origem?: "os" | "escala" | "financeiro" | "pagamento"
): StatusGlobal | null {
  if (!status) return null;
  const s = status.toLowerCase().trim();

  if (origem === "os" || (!origem && MAPA_OS_PARA_GLOBAL[s])) {
    return MAPA_OS_PARA_GLOBAL[s] || null;
  }
  if (origem === "escala" || (!origem && MAPA_ESCALA_PARA_GLOBAL[s])) {
    return MAPA_ESCALA_PARA_GLOBAL[s] || null;
  }
  if (origem === "financeiro" || (!origem && MAPA_FINANCEIRO_PARA_GLOBAL[s])) {
    return MAPA_FINANCEIRO_PARA_GLOBAL[s] || null;
  }
  if (origem === "pagamento" || (!origem && MAPA_PAGAMENTO_PARA_GLOBAL[s])) {
    return MAPA_PAGAMENTO_PARA_GLOBAL[s] || null;
  }

  if (MAPA_OS_PARA_GLOBAL[s]) return MAPA_OS_PARA_GLOBAL[s];
  if (MAPA_ESCALA_PARA_GLOBAL[s]) return MAPA_ESCALA_PARA_GLOBAL[s];
  if (MAPA_FINANCEIRO_PARA_GLOBAL[s]) return MAPA_FINANCEIRO_PARA_GLOBAL[s];
  if (MAPA_PAGAMENTO_PARA_GLOBAL[s]) return MAPA_PAGAMENTO_PARA_GLOBAL[s];

  return STATUS_GLOBAL_INFO[rascunho as StatusGlobal] ? "rascunho" : null;
}

export function mapearGlobalParaOS(statusGlobal: StatusGlobal): string {
  const mapa: Record<StatusGlobal, string> = {
    rascunho:       "rascunho",
    pendente:       "pendente",
    alocado:        "agendada",
    carregando:     "em_andamento",
    em_rota:        "em_rota",
    entregue:       "entregue",
    finalizado:     "finalizada",
    faturado:       "faturada",
    pago_prestador: "paga",
    cancelado:      "cancelada",
  };
  return mapa[statusGlobal] || "rascunho";
}

export function mapearGlobalParaEscala(statusGlobal: StatusGlobal): string {
  const mapa: Record<StatusGlobal, string> = {
    rascunho:       "planejada",
    pendente:       "aguardando_aceite",
    alocado:        "aceita",
    carregando:     "aceita",
    em_rota:        "em_rota",
    entregue:       "em_rota",
    finalizado:     "concluida",
    faturado:       "concluida",
    pago_prestador: "concluida",
    cancelado:      "cancelada",
  };
  return mapa[statusGlobal] || "planejada";
}

export const STATUS_FILTRO_OPCOES = STATUS_GLOBAL_ORDER.map((s) => ({
  value: s,
  label: STATUS_GLOBAL_INFO[s].label,
  cor: STATUS_GLOBAL_INFO[s].cor,
}));

export type StatusFiltro = StatusGlobal | "todos";
