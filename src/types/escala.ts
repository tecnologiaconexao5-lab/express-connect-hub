/**
 * Tipos TypeScript para o módulo de Escala Operacional
 * Compatível com a tabela alocacoes_escala do Supabase
 */

// Status possíveis de uma alocação
export type EscalaStatus = 
  | 'planejada' 
  | 'aguardando_aceite' 
  | 'aceita' 
  | 'recusada' 
  | 'em_rota' 
  | 'concluida' 
  | 'cancelada' 
  | 'ocorrencia';

// Status de pagamento
export type StatusPagamento = 
  | 'pendente' 
  | 'aprovado' 
  | 'pago' 
  | 'cancelado';

// Tipo de turno
export type TurnoEscala = 
  | 'diurno' 
  | 'noturno' 
  | 'madrugada' 
  | 'integral';

// Tipo de valor (fixo ou percentual)
export type TipoValor = 
  | 'fixo' 
  | 'percentual';

/**
 * Interface completa de uma Alocação de Escala
 * Mapeia todos os campos da tabela alocacoes_escala
 */
export interface AlocacaoEscala {
  id: string;
  
  // Relacionamentos
  empresa_id?: string | null;
  cliente_id?: string | null;
  prestador_id?: string | null;
  ordem_servico_id?: string | null;
  ordem_carregamento_id?: string | null;
  
  // Dados operacionais
  data_escala: string; // ISO date
  turno?: TurnoEscala;
  tipo_veiculo: string;
  placa?: string | null;
  regiao?: string | null;
  rota?: string | null;
  origem?: string | null;
  destino?: string | null;
  
  // Status e controle
  status: EscalaStatus;
  status_pagamento?: StatusPagamento;
  
  // Métricas operacionais
  quantidade_entregas?: number;
  quantidade_coletas?: number;
  quantidade_paradas?: number;
  km_previstos?: number;
  km_realizados?: number;
  
  // Financeiro básico
  valor_frete?: number;
  valor_repasse?: number;
  valor_pedagio?: number;
  valor_combustivel?: number;
  valor_ajudante?: number;
  valor_adicional?: number;
  valor_desconto?: number;
  valor_total?: number; // Campo calculado automaticamente
  
  // Controles detalhados de valores (compatível com EscalaLista.tsx)
  valor_tipo?: TipoValor;
  valor_percentual?: number;
  valor_fixo?: number;
  combustivel_valor?: number;
  km_rodados?: number;
  valor_km?: number;
  pedagio_franquia?: number;
  pedagio_excedente?: number;
  pedagio_cobrar_excedente?: boolean;
  diarias_adicionais?: number;
  valor_diaria?: number;
  segunda_saida?: boolean;
  valor_segunda_saida?: number;
  terceira_saida?: boolean;
  valor_terceira_saida?: number;
  saidas_adicionais?: number;
  valor_saida_adicional?: number;
  ajudantes?: number;
  valor_ajudante_unit?: number;
  reembolsos_outros?: string;
  valor_reembolso_outros?: number;
  
  // Tempos e horários
  horario_saida?: string | null; // time format
  horario_retorno_previsto?: string | null; // time format
  horario_inicio_real?: string | null; // ISO timestamp
  horario_fim_real?: string | null; // ISO timestamp
  tempo_total_minutos?: number | null;
  
  // App Prestador
  aceite_prestador?: boolean;
  data_aceite?: string | null; // ISO timestamp
  motivo_recusa?: string | null;
  finalizada?: boolean;
  data_finalizacao?: string | null; // ISO timestamp
  comprovante_url?: string | null;
  assinatura_url?: string | null;
  fotos_entrega?: string[] | null;
  
  // Ocorrências e observações
  ocorrencias_count?: number;
  ocorrencias_descricao?: string | null;
  observacoes?: string | null;
  instrucoes_operacionais?: string | null;
  observacoes_internas?: string | null;
  
  // Informações de tabela de preços
  tabela_valores_id?: string | null;
  tem_regra_especial?: boolean;
  
  // Metadados e flexibilidade
  metadata?: Record<string, any>;
  tags?: string[] | null;
  
  // Auditoria
  created_at?: string; // ISO timestamp
  updated_at?: string; // ISO timestamp
  created_by?: string | null;
  updated_by?: string | null;
}

/**
 * Interface para criar uma nova alocação
 * Campos obrigatórios mínimos
 */
export interface NovaAlocacaoEscala {
  // Obrigatórios
  data_escala: string; // ISO date
  tipo_veiculo: string;
  prestador_id?: string;
  
  // Opcionais comuns
  cliente_id?: string;
  ordem_servico_id?: string;
  turno?: TurnoEscala;
  placa?: string;
  regiao?: string;
  rota?: string;
  origem?: string;
  destino?: string;
  status?: EscalaStatus;
  
  // Valores financeiros
  valor_frete?: number;
  valor_repasse?: number;
  valor_tipo?: TipoValor;
  valor_fixo?: number;
  valor_percentual?: number;
  
  // Detalhes operacionais
  quantidade_entregas?: number;
  km_previstos?: number;
  horario_saida?: string;
  horario_retorno_previsto?: string;
  
  // Observações
  observacoes?: string;
  instrucoes_operacionais?: string;
  
  // Metadados
  metadata?: Record<string, any>;
  tags?: string[];
  
  // Auditoria
  created_by?: string;
}

/**
 * Interface para atualização parcial de alocação
 */
export interface AtualizarAlocacaoEscala {
  // Qualquer campo pode ser atualizado
  status?: EscalaStatus;
  status_pagamento?: StatusPagamento;
  placa?: string;
  regiao?: string;
  rota?: string;
  origem?: string;
  destino?: string;
  
  // Métricas
  quantidade_entregas?: number;
  quantidade_coletas?: number;
  km_realizados?: number;
  
  // Financeiro
  valor_frete?: number;
  valor_repasse?: number;
  valor_pedagio?: number;
  valor_combustivel?: number;
  valor_ajudante?: number;
  valor_desconto?: number;
  
  // Tempos
  horario_inicio_real?: string;
  horario_fim_real?: string;
  tempo_total_minutos?: number;
  
  // App Prestador
  aceite_prestador?: boolean;
  data_aceite?: string;
  motivo_recusa?: string;
  finalizada?: boolean;
  data_finalizacao?: string;
  comprovante_url?: string;
  assinatura_url?: string;
  fotos_entrega?: string[];
  
  // Ocorrências
  ocorrencias_count?: number;
  ocorrencias_descricao?: string;
  
  // Observações
  observacoes?: string;
  instrucoes_operacionais?: string;
  observacoes_internas?: string;
  
  // Metadados
  metadata?: Record<string, any>;
  tags?: string[];
  
  // Auditoria
  updated_by?: string;
}

/**
 * Interface de histórico de alocação
 */
export interface HistoricoAlocacaoEscala {
  id: string;
  alocacao_id: string;
  evento: string;
  status_anterior?: string | null;
  status_novo?: string | null;
  descricao?: string | null;
  payload?: Record<string, any>;
  created_at: string; // ISO timestamp
  created_by?: string | null;
  ip_origem?: string | null;
  user_agent?: string | null;
}

/**
 * Interface para novo registro de histórico
 */
export interface NovoHistoricoAlocacao {
  alocacao_id: string;
  evento: string;
  status_anterior?: string;
  status_novo?: string;
  descricao?: string;
  payload?: Record<string, any>;
  created_by?: string;
}

/**
 * Filtros para listagem de alocações
 */
export interface FiltrosEscala {
  // Filtros de data
  data_inicio?: string; // ISO date
  data_fim?: string; // ISO date
  data_escala?: string; // ISO date específica
  
  // Filtros de relacionamento
  cliente_id?: string;
  prestador_id?: string;
  ordem_servico_id?: string;
  empresa_id?: string;
  
  // Filtros de status
  status?: EscalaStatus | EscalaStatus[];
  status_pagamento?: StatusPagamento | StatusPagamento[];
  
  // Filtros operacionais
  tipo_veiculo?: string;
  regiao?: string;
  turno?: TurnoEscala;
  placa?: string;
  
  // Filtros de aceite e finalização
  aceite_prestador?: boolean;
  finalizada?: boolean;
  
  // Busca por texto
  busca?: string; // Busca em observacoes, rota, origem, destino
  
  // Tags
  tags?: string[];
  
  // Ordenação
  ordenar_por?: 'data_escala' | 'created_at' | 'updated_at' | 'status' | 'prestador_id';
  ordem?: 'asc' | 'desc';
  
  // Paginação
  limite?: number;
  offset?: number;
  pagina?: number;
}

/**
 * Resultado da listagem com metadados de paginação
 */
export interface ResultadoListagemEscala {
  alocacoes: AlocacaoEscala[];
  total: number;
  pagina?: number;
  limite?: number;
  total_paginas?: number;
}

/**
 * Dados de finalização de alocação
 */
export interface DadosFinalizacaoEscala {
  km_realizados?: number;
  tempo_total_minutos?: number;
  horario_fim_real?: string;
  comprovante_url?: string;
  assinatura_url?: string;
  fotos_entrega?: string[];
  observacoes?: string;
  ocorrencias_descricao?: string;
  metadata?: Record<string, any>;
}

/**
 * Mapeamento de labels para status
 */
export const STATUS_LABELS: Record<EscalaStatus, string> = {
  planejada: 'Planejada',
  aguardando_aceite: 'Aguardando Aceite',
  aceita: 'Aceita',
  recusada: 'Recusada',
  em_rota: 'Em Rota',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  ocorrencia: 'Com Ocorrência',
};

/**
 * Mapeamento de cores para status (Tailwind CSS)
 */
export const STATUS_CORES: Record<EscalaStatus, { bg: string; text: string; border: string }> = {
  planejada: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
  aguardando_aceite: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  aceita: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  recusada: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
  em_rota: { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-600' },
  concluida: { bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-600' },
  cancelada: { bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200' },
  ocorrencia: { bg: 'bg-yellow-500', text: 'text-white', border: 'border-yellow-600' },
};

/**
 * Tipos de eventos de histórico
 */
export type EventoHistorico = 
  | 'criacao'
  | 'mudanca_status'
  | 'aceite_prestador'
  | 'recusa_prestador'
  | 'inicio_rota'
  | 'finalizacao'
  | 'cancelamento'
  | 'ocorrencia'
  | 'alteracao_financeiro'
  | 'alteracao_dados'
  | 'observacao_adicionada';
