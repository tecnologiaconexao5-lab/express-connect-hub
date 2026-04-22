// src/types/automacao.ts
export type EventoTipo =
  | "orcamento_criado"
  | "os_criada"
  | "os_aceita"
  | "os_iniciada"
  | "os_saida_coleta"
  | "os_saida_entrega"
  | "os_chegada_destino"
  | "os_tentativa_entrega"
  | "os_reentrega"
  | "os_finalizada"
  | "os_baixa_evidencia"
  | "os_cancelada";

export type CanalEnvio = "whatsapp" | "email" | "sms" | "push";

export interface AutomacaoEvento {
  tipo: EventoTipo;
  timestamp: string;
  os_id: string;
  os_numero: string;
  cliente: string;
  prestador?: string;
  veiculo?: string;
  destinatario?: {
    nome?: string;
    whatsapp?: string;
    email?: string;
  };
  remetente?: {
    nome?: string;
    whatsapp?: string;
    email?: string;
  };
  status?: string;
  observacao?: string;
  url_rastreio?: string;
  metadados?: Record<string, any>;
}

export interface AutomacaoTemplate {
  id: string;
  evento: EventoTipo;
  canal: CanalEnvio;
  ativo: boolean;
  template: string;
  variaveis: string[];
  created_at: string;
  updated_at: string;
}

export interface AutomacaoLog {
  id: string;
  os_id: string;
  os_numero: string;
  evento: EventoTipo;
  template_id: string;
  canal: CanalEnvio;
  destinatario: string;
  corpo: string;
  status: "pendente" | "enviado" | "falha" | "lido";
  n8n_execution_id?: string;
  resposta_ia?: string;
  error?: string;
  created_at: string;
}

export interface AutomacaoConfig {
  n8n_webhook_url: string;
  n8n_api_key: string;
  groq_api_key: string;
  whatsapp_enabled: boolean;
  whatsapp_api_url: string;
  email_enabled: boolean;
  groq_enabled: boolean;
  modo: "production" | "simulation";
  eventos_ativos: EventoTipo[];
}

export interface DispatchResult {
  success: boolean;
  id?: string;
  skipped?: boolean;
  error?: string;
}

export interface GroqRequest {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  max_tokens?: number;
}

export interface GroqResponse {
  id: string;
  choices: Array<{ message: { role: string; content: string }; finish_reason: string }>;
  usage?: { total_tokens: number };
}

export interface N8nWebhookPayload {
  evento: AutomacaoEvento;
  template?: AutomacaoTemplate;
  timestamp: string;
  origem: "express-connect-hub";
  version: string;
}