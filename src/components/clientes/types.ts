export interface Cliente {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  ie?: string;
  segmento?: string;
  porte?: string;
  status: string;
  contatoPrincipal?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  site?: string;
  cidade?: string;
  uf?: string;
  logo?: string;
  numOsMes?: number;
  responsavelOperacional?: string;
  responsavelFinanceiro?: string;
  responsavelComercial?: string;
  observacoes?: string;
  origemComercial?: string;
  exigeAgendamento: boolean;
  exigeSla: boolean;
  exigePortal: boolean;
  aceitaApi: boolean;
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
  contatoLocal?: string;
  telefoneLocal?: string;
  instrucoes?: string;
  janelaPadrao?: string;
  restricoes?: string;
  agendamento: boolean;
}

export interface TabelaCliente {
  id?: string;
  nome: string;
  vigenciaFim?: string;
  tipoCobranca?: string;
}

export interface ContratoCliente {
  id?: string;
  numero: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  reajuste?: string;
}

export interface ContratoCliente {
  id?: string;
  numero: string;
  vigencia_inicio: string;
  vigencia_fim: string;
  reajuste?: string;
}
