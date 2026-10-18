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

export interface ConfiguracaoFiscal {
  id: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  ie: string | null;
  inscricao_municipal?: string | null;
  rntrc: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  codigo_ibge?: string | null;
  telefone: string | null;
  email: string | null;
  ambiente_fiscal: string | null;
  crt?: string | null;
  regime_tributario?: string | null;
  cnae_principal?: string | null;
  ativo: boolean | null;
  apelido: string | null;
  padrao: boolean | null;
  limite_plano: number | null;
  focus_empresa_id: string | null;
  focus_token_configurado: boolean | null;
  focus_status?: string | null;
  certificado_configurado: boolean | null;
  certificado_nome?: string | null;
  certificado_validade?: string | null;
  certificado_status?: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface FiscalValidationIssue {
  campo: string;
  mensagem: string;
  severidade: 'erro' | 'aviso';
}

export interface FocusCteEndereco {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  pais?: string | null;
}

export interface FocusCteEmitente {
  nome?: string | null;
  cnpj?: string | null;
  ie?: string | null;
  rntrc?: string | null;
  endereco?: FocusCteEndereco | null;
}

export interface FocusCteTomador {
  nome?: string | null;
  cnpj?: string | null;
  ie?: string | null;
  indicador_ie?: string | null;
  endereco?: FocusCteEndereco | null;
}

export interface FocusCteCarga {
  tipo?: string | null;
  descricao?: string | null;
  peso_kg?: number | null;
  volumes?: number | null;
  valor_declarado?: number | null;
  cfop?: string | null;
  natureza_operacao?: string | null;
  quantidade_notas?: number | null;
}

export interface FocusCteVeiculo {
  placa?: string | null;
  tipo?: string | null;
  renavam?: string | null;
  tara_kg?: number | null;
  capacidade_kg?: number | null;
  capacidade_m3?: number | null;
  marca?: string | null;
  modelo?: string | null;
  uf_licenciamento?: string | null;
  tipo_rodado?: string | null;
  tipo_carroceria?: string | null;
}

export interface FocusCteMotorista {
  nome?: string | null;
  cpf?: string | null;
  telefone?: string | null;
}

export interface FocusCteDocumentoVinculado {
  tipo?: string | null;
  chave_acesso?: string | null;
  numero?: string | null;
  serie?: string | null;
  valor?: number | null;
  data_emissao?: string | null;
}

export interface FocusCteValores {
  valor_total?: number | null;
  valor_frete?: number | null;
  valor_pedagio?: number | null;
  valor_seguro?: number | null;
  valor_desconto?: number | null;
  valor_outros?: number | null;
}

export interface FocusCteFiscal {
  cfop?: string | null;
  natureza_operacao?: string | null;
  icms_aliquota?: number | null;
  icms_base_calculo?: number | null;
  icms_valor?: number | null;
  regime_tributario?: string | null;
}

export interface EnderecoRealEntrega {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string | null;
  codigo_ibge?: string | null;
}

export interface FocusCtePayloadDraft {
  emitente: FocusCteEmitente;
  tomador: FocusCteTomador;
  remetente: FocusCteEndereco | null;
  destinatario: FocusCteEndereco | null;
  origem: FocusCteEndereco | null;
  destino: FocusCteEndereco | null;
  carga: FocusCteCarga;
  veiculo: FocusCteVeiculo;
  motorista: FocusCteMotorista;
  documentos_vinculados: FocusCteDocumentoVinculado[];
  valores: FocusCteValores;
  fiscal: FocusCteFiscal;
  modal: string;
  tipo_servico: number;
  observacao?: string | null;
}

export interface CteMetadata {
  payload_focus: FocusCtePayloadDraft | null;
  validacoes_pendentes: FiscalValidationIssue[];
  pronto_para_emissao: boolean;
  origem: string;
  os_numero?: string | null;
  veiculo_tipo?: string | null;
  distancia?: number | null;
  emitente_id?: string | null;
  endereco_real_entrega_usado?: EnderecoRealEntrega | null;
  observacao_cte?: string | null;
  fonte_endereco_entrega?: "manual" | "xml" | "romaneio" | null;
  pendente_conferencia_endereco?: boolean;
}

export interface FiscalDocumentoVinculado {
  id: string;
  tipo_documento: string;
  chave_acesso?: string | null;
  numero?: string | null;
  serie?: string | null;
  emitente_cnpj?: string | null;
  emitente_nome?: string | null;
  destinatario_cnpj?: string | null;
  destinatario_nome?: string | null;
  valor_total?: number | null;
  peso_bruto?: number | null;
  volumes?: number | null;
  produto_predominante?: string | null;
  municipio_origem?: string | null;
  uf_origem?: string | null;
  municipio_destino?: string | null;
  uf_destino?: string | null;
  xml_original?: string | null;
  ordem_servico_id?: string | null;
  status: string;
  metadata?: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
}

export interface NfeXmlParsed {
  chave_acesso: string | null;
  numero: string | null;
  serie: string | null;
  emitente_cnpj: string | null;
  emitente_nome: string | null;
  destinatario_cnpj: string | null;
  destinatario_nome: string | null;
  valor_total: number | null;
  peso_bruto: number | null;
  volumes: number | null;
  produto_predominante: string | null;
  municipio_origem: string | null;
  uf_origem: string | null;
  municipio_destino: string | null;
  uf_destino: string | null;
  endereco_fiscal_xml?: EnderecoRealEntrega | null;
  infCpl?: string | null;
  endereco_infCpl?: EnderecoRealEntrega | null;
}
