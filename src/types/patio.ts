// ============================================================
// EXPRESS CONNECT HUB / TMS — MISSAO 53
// Tipos e interfaces do modulo Controle de Patio
// ============================================================

export type PatioStatus =
  | "previsto" | "chegou_ao_patio" | "aguardando_checkin" | "checkin_realizado"
  | "aguardando_liberacao" | "aguardando_fila" | "chamado_para_doca"
  | "em_doca" | "carregamento_iniciado" | "carregamento_pausado"
  | "carregamento_concluido" | "aguardando_documentacao" | "liberado_para_saida"
  | "saiu_do_patio" | "cancelado" | "no_show";

export type PatioDocaStatus = "disponivel" | "ocupada" | "bloqueada" | "manutencao" | "reservada";

export type PatioCriterioFila =
  | "ordem_chegada" | "horario_agendado" | "prioridade" | "sla"
  | "regiao" | "tipo_veiculo" | "tipo_carga" | "cliente_vip"
  | "rodizio_prestador" | "rodizio_regiao" | "doca_disponivel" | "urgencia";

export type PatioTipoRodizio = "prestador" | "regiao" | "tipo_veiculo" | "cliente" | "contrato" | "manual";

export type PatioAlertaTipo = "sla_excedido" | "doca_ocupada" | "carregamento_parado" | "documentacao_pendente" | "no_show" | "operacao_critica" | "fila_longa";

export interface PatioUnidade {
  id: string;
  tenant_id?: string;
  nome: string;
  endereco?: string;
  capacidade_total: number;
  capacidade_atual: number;
  status: string;
  config?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface PatioDoca {
  id: string;
  tenant_id?: string;
  unidade_id: string;
  nome: string;
  status: PatioDocaStatus;
  tipo_permitido: string[];
  capacidade_kg?: number;
  restricoes?: string[];
  veiculo_atual_id?: string;
  previsao_liberacao?: string;
  observacoes?: string;
  posicao: number;
  config?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface PatioCheckin {
  id: string;
  tenant_id?: string;
  unidade_id?: string;
  ordem_servico_id?: string;
  numero_os?: string;
  cliente_id?: string;
  cliente_nome?: string;
  prestador_id?: string;
  prestador_nome?: string;
  motorista_nome?: string;
  veiculo_id?: string;
  veiculo_placa: string;
  veiculo_tipo?: string;
  tipo_carga?: string;
  origem?: string;
  destino?: string;
  horario_previsto?: string;
  horario_chegada?: string;
  horario_saida?: string;
  documento?: string;
  observacao?: string;
  status: PatioStatus;
  posicao_fila: number;
  prioridade: number;
  doca_id?: string;
  doca_nome?: string;
  chamado_para_doca_em?: string;
  carregamento_inicio?: string;
  carregamento_fim?: string;
  carregamento_pausa_motivo?: string;
  carregamento_pausa_inicio?: string;
  tempo_aguardando_min: number;
  tempo_carregando_min: number;
  tempo_total_min: number;
  sla_espera_min: number;
  risco_atraso: boolean;
  liberado_por?: string;
  checkin_origem: string;
  fotos?: string[];
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export interface PatioFila {
  id: string;
  tenant_id?: string;
  checkin_id: string;
  unidade_id?: string;
  posicao: number;
  posicao_anterior?: number;
  criterio_ordenacao: PatioCriterioFila;
  criterio_detalhe?: string;
  doca_sugerida_id?: string;
  sla_espera_min: number;
  risco_atraso: boolean;
  entrou_na_fila_em: string;
  chamado_em?: string;
  chamado_por?: string;
  status: "aguardando" | "chamado" | "em_atendimento" | "concluido" | "cancelado";
  created_at?: string;
  updated_at?: string;
}

export interface PatioEvento {
  id: string;
  tenant_id?: string;
  checkin_id: string;
  tipo_evento: string;
  status_anterior?: PatioStatus;
  status_novo: PatioStatus;
  descricao?: string;
  responsavel_nome?: string;
  responsavel_id?: string;
  origem: string;
  localizacao?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface PatioRegraFila {
  id: string;
  tenant_id?: string;
  unidade_id: string;
  criterio: PatioCriterioFila;
  ativo: boolean;
  ordem: number;
  config?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface PatioRodizio {
  id: string;
  tenant_id?: string;
  unidade_id: string;
  tipo: PatioTipoRodizio;
  entidade_id?: string;
  entidade_nome: string;
  ultimo_chamado_em?: string;
  proximo_na_fila: number;
  justificativa?: string;
  config?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface PatioAlerta {
  id: string;
  tenant_id?: string;
  checkin_id?: string;
  tipo: PatioAlertaTipo;
  mensagem: string;
  resolvido: boolean;
  resolvido_em?: string;
  criado_em: string;
}

// ============================================================
// Mapeamento de status para labels corporativos
// ============================================================
export const PATIO_STATUS_LABELS: Record<PatioStatus, { label: string; cor: string; icone: string; desc: string }> = {
  previsto:                    { label: "Previsto",                  cor: "bg-slate-100 text-slate-700 border-slate-200",   icone: "Clock",            desc: "Veiculo previsto para chegada" },
  chegou_ao_patio:             { label: "Chegou ao Patio",           cor: "bg-blue-100 text-blue-700 border-blue-200",       icone: "MapPin",           desc: "Veiculo chegou a unidade" },
  aguardando_checkin:          { label: "Aguardando Check-in",       cor: "bg-amber-100 text-amber-700 border-amber-200",     icone: "ClipboardList",    desc: "Aguardando registro de check-in" },
  checkin_realizado:           { label: "Check-in Realizado",        cor: "bg-emerald-100 text-emerald-700 border-emerald-200", icone: "CheckCircle",    desc: "Check-in registrado com sucesso" },
  aguardando_liberacao:        { label: "Aguardando Liberacao",      cor: "bg-amber-100 text-amber-700 border-amber-200",     icone: "Clock",            desc: "Aguardando liberacao operacional" },
  aguardando_fila:             { label: "Aguardando na Fila",        cor: "bg-indigo-100 text-indigo-700 border-indigo-200",   icone: "List",             desc: "Na fila de carregamento" },
  chamado_para_doca:           { label: "Chamado para Doca",         cor: "bg-orange-100 text-orange-700 border-orange-200",   icone: "Bell",             desc: "Chamado para doca de carregamento" },
  em_doca:                     { label: "Em Doca",                   cor: "bg-orange-100 text-orange-700 border-orange-200",   icone: "Truck",            desc: "Veiculo posicionado na doca" },
  carregamento_iniciado:       { label: "Carregamento Iniciado",     cor: "bg-orange-100 text-orange-700 border-orange-200",   icone: "Package",          desc: "Carregamento em andamento" },
  carregamento_pausado:        { label: "Carregamento Pausado",      cor: "bg-red-100 text-red-700 border-red-200",            icone: "Pause",            desc: "Carregamento interrompido" },
  carregamento_concluido:      { label: "Carregamento Concluido",    cor: "bg-emerald-100 text-emerald-700 border-emerald-200", icone: "PackageCheck",   desc: "Carregamento finalizado" },
  aguardando_documentacao:     { label: "Aguardando Documentacao",   cor: "bg-purple-100 text-purple-700 border-purple-200",   icone: "FileText",         desc: "Conferencia documental pendente" },
  liberado_para_saida:         { label: "Liberado para Saida",       cor: "bg-emerald-100 text-emerald-700 border-emerald-200", icone: "LogOut",          desc: "Veiculo autorizado a sair" },
  saiu_do_patio:               { label: "Saiu do Patio",             cor: "bg-slate-100 text-slate-700 border-slate-200",      icone: "ArrowRight",       desc: "Veiculo saiu da unidade" },
  cancelado:                   { label: "Cancelado",                 cor: "bg-red-100 text-red-700 border-red-200",            icone: "X",                desc: "Operacao cancelada" },
  no_show:                     { label: "No-Show",                   cor: "bg-red-100 text-red-700 border-red-200",            icone: "AlertTriangle",    desc: "Veiculo nao compareceu" },
};

export const PATIO_DOCA_LABELS: Record<PatioDocaStatus, { label: string; cor: string }> = {
  disponivel:   { label: "Disponivel", cor: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  ocupada:      { label: "Ocupada",    cor: "bg-orange-100 text-orange-700 border-orange-200" },
  bloqueada:    { label: "Bloqueada",  cor: "bg-red-100 text-red-700 border-red-200" },
  manutencao:   { label: "Manutencao", cor: "bg-amber-100 text-amber-700 border-amber-200" },
  reservada:    { label: "Reservada",  cor: "bg-blue-100 text-blue-700 border-blue-200" },
};

export const PATIO_CRITERIO_LABELS: Record<PatioCriterioFila, string> = {
  ordem_chegada:      "Ordem de Chegada",
  horario_agendado:   "Horario Agendado",
  prioridade:         "Prioridade Operacional",
  sla:                "SLA Mais Critico",
  regiao:             "Regiao de Destino",
  tipo_veiculo:       "Tipo de Veiculo",
  tipo_carga:         "Tipo de Carga",
  cliente_vip:        "Cliente Prioritario",
  rodizio_prestador:  "Rodizio de Prestadores",
  rodizio_regiao:     "Rodizio de Regioes",
  doca_disponivel:    "Doca Disponivel",
  urgencia:           "Operacao Urgente",
};

// ============================================================
// Colunas do Kanban
// ============================================================
export const PATIO_KANBAN_COLUNAS = [
  { id: "previsto" as PatioStatus,                titulo: "Previsto",             cor: "border-l-slate-400" },
  { id: "chegou_ao_patio" as PatioStatus,         titulo: "Chegou",              cor: "border-l-blue-500" },
  { id: "aguardando_fila" as PatioStatus,         titulo: "Fila",                cor: "border-l-indigo-500" },
  { id: "chamado_para_doca" as PatioStatus,       titulo: "Chamado",            cor: "border-l-orange-500" },
  { id: "em_doca" as PatioStatus,                 titulo: "Em Doca",             cor: "border-l-amber-500" },
  { id: "carregamento_iniciado" as PatioStatus,   titulo: "Carregando",          cor: "border-l-orange-600" },
  { id: "aguardando_documentacao" as PatioStatus, titulo: "Documentacao",        cor: "border-l-purple-500" },
  { id: "liberado_para_saida" as PatioStatus,     titulo: "Liberado",           cor: "border-l-emerald-500" },
  { id: "saiu_do_patio" as PatioStatus,           titulo: "Saiu",               cor: "border-l-slate-500" },
];
