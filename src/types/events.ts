export type EventType =
  | "os.ordem_servico.criada"
  | "os.ordem_servico.finalizada"
  | "os.ordem_servico.cancelada"
  | "os.ordem_servico.status_changed"
  | "os.ordem_servico.rede_enviada"
  | "os.ordem_servico.rede_cancelada"
  | "escala.alocacao.criada"
  | "escala.alocacao.aceita"
  | "escala.alocacao.recusada"
  | "escala.alocacao.concluida"
  | "escala.alocacao.cancelada"
  | "escala.alocacao.motorista_trocado"
  | "escala.alocacao.veiculo_trocado"
  | "entrega.comprovante.pod_enviado"
  | "entrega.comprovante.foto_anexada"
  | "financeiro.receber.criado"
  | "financeiro.receber.pago"
  | "financeiro.pagar.criado"
  | "financeiro.pagar.pago"
  | "rede.oportunidade.publicada"
  | "rede.oportunidade.aceita"
  | "rede.oportunidade.expirada"
  | "portal.pedido.criado"
  | "portal.ocorrencia.aberta"
  | "portal.avaliacao.enviada"
  | "fiscal.cte.emitido"
  | "fiscal.nfse.emitida"
  | "auth.usuario.login"
  | "auth.usuario.logout"
  | "ia.robo.executou"
  | "comunicacao.mensagem.enviada"
  | "recrutamento.candidato.criado"
  | "recrutamento.score.limiar_cruzado"
  | "recrutamento.documento.vencimento_proximo"
  | string;

export type EventVisibility = "public" | "internal" | "admin";

export type EventSource = "trigger" | "service" | "api" | "portal" | "app_motorista" | "ia";

export interface EventoOficial {
  id: string;
  tenant_id: string;
  event_type: EventType;
  entity_type: string;
  entity_id: string;
  entity_number: string | null;
  status: string;
  source: EventSource;
  created_by: string | null;
  visibility: EventVisibility;
  payload: Record<string, any>;
  metadata: Record<string, any> | null;
  created_at: string;
  processed_at: string | null;
  version: string;
  retry_count: number;
}

export interface PublicarEventoParams {
  event_type: EventType;
  entity_type: string;
  entity_id: string;
  entity_number?: string;
  status?: string;
  source?: EventSource;
  created_by?: string;
  visibility?: EventVisibility;
  payload?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface BuscarEventosParams {
  event_types?: EventType[];
  entity_type?: string;
  entity_id?: string;
  tenant_id?: string;
  status?: string;
  source?: EventSource;
  visibility?: EventVisibility;
  dataInicio?: string;
  dataFim?: string;
  limit?: number;
  offset?: number;
}

export interface EventosResultado {
  sucesso: boolean;
  dados?: EventoOficial[];
  total?: number;
  erro?: string;
}

export interface EventoUnicoResultado {
  sucesso: boolean;
  dado?: EventoOficial;
  erro?: string;
}

export interface EventBusRetryResultado {
  sucesso: boolean;
  evento?: EventoOficial;
  erro?: string;
}
