export interface Cliente {
  id: string;
  razao_social: string;
  nome_fantasia?: string;
  cnpj: string;
  ie?: string;
  segmento?: string;
  porte?: string;
  status: string;
  contato_principal?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  site?: string;
  cidade?: string;
  uf?: string;
  logo?: string;
  num_os_mes?: number;
  responsavel_operacional?: string;
  responsavel_financeiro?: string;
  responsavel_comercial?: string;
  observacoes?: string;
  origem_comercial?: string;
  exige_agendamento: boolean;
  exige_sla: boolean;
  exige_portal: boolean;
  aceita_api: boolean;
  enderecos?: EnderecoCliente[];
  tabelas?: TabelaCliente[];
  contratos?: ContratoCliente[];
}

export interface EnderecoCliente {
  id?: string;
  tipo: string;
  nome: string;
  cep: string;
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  referencia?: string;
  contato_local?: string;
  telefone_local?: string;
  instrucoes?: string;
  janela_padrao?: string;
  restricoes?: string;
  agendamento: boolean;
}

export interface TabelaCliente {
  id?: string;
  nome: string;
  vigencia_fim?: string;
  tipo_cobranca?: string;
}

export interface ContratoCliente {
  id?: string;
  numero: string;
  vigencia_inicio: string;
  vigencia_fim: string;
  reajuste?: string;
}
