export type FiscalStatus = 'pendente' | 'autorizado' | 'rejeitado' | 'cancelado' | 'erro' | 'processando';

export interface FiscalDocumentBase {
  id: string;
  filial_id?: string | null;
  cliente_id?: string | null;
  ordem_servico_id?: string | null;
  numero?: string | null;
  chave_acesso?: string | null;
  status: FiscalStatus;
  valor?: number | null;
  data_emissao?: string | null;
  xml_url?: string | null;
  pdf_url?: string | null;
  protocolo?: string | null;
  motivo_rejeicao?: string | null;
  metadata?: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
}

export interface FiscalNfse extends FiscalDocumentBase {
  // NFSe specific fields can be added here
}

export interface FiscalCte extends FiscalDocumentBase {
  // CTe specific fields can be added here
}

export interface FiscalMdfe extends FiscalDocumentBase {
  // MDFe specific fields can be added here
}

export interface FiscalEvent {
  id: string;
  documento_tipo: 'NFSE' | 'CTE' | 'MDFE';
  documento_id: string;
  tipo_evento: string;
  descricao?: string | null;
  protocolo?: string | null;
  metadata?: Record<string, any> | null;
  created_at?: string;
}

export interface FiscalLog {
  id: string;
  entidade_tipo?: string | null;
  entidade_id?: string | null;
  acao: string;
  request?: Record<string, any> | null;
  response?: Record<string, any> | null;
  status_code?: number | null;
  created_at?: string;
}
