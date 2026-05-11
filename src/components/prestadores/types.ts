export type TipoParceiro = "autonomo" | "agregado" | "fixo" | "esporadico" | "terceiro" | "clt";
export type StatusPrestador = "ativo" | "analise" | "inativo" | "bloqueado";
export type StatusDocumento = "valido" | "vencendo" | "vencido" | "pendente" | "aprovado" | "reprovado" | "em_analise";
export type TipoVeiculo = "moto" | "utilitario_leve" | "fiorino" | "kangoo" | "hr" | "van" | "vuc" | "3_4" | "toco" | "truck" | "carreta" | "carreta_ls" | "bitrem" | "rodotrem" | "cavalo_mecanico" | "bau_urbano" | "dedicado" | "refrigerado_leve" | "outro";
export type SubcategoriaVeiculo = "urbano" | "leve" | "medio" | "pesado" | "dedicado" | "refrigerado" | "distribuicao" | "transferencia" | "outro";
export type TipoCarroceria = "bau" | "bau_refrigerado" | "bau_isotermico" | "sider" | "grade_baixa" | "graneleira" | "prancha" | "plataforma" | "carroceria_aberta" | "cegonha" | "tanque" | "container" | "furgao" | "refrigerada" | "lonada" | "outro";
export type ClassificacaoTermica = "seco" | "refrigerado" | "congelado" | "misto" | "isotermico";
export type StatusVeiculo = "ativo" | "inativo" | "manutencao" | "bloqueado";

export interface ContatoEmergencia {
  nome: string;
  telefone: string;
  relacao: string;
}

export interface DocumentoPrestador {
  id?: string;
  tipo: string;
  url?: string;
  dataEnvio?: string;
  dataVencimento?: string;
  status: StatusDocumento;
  observacaoInterna?: string;
  analisadoPor?: string;
  analisadoEm?: string;
  caminhoStorage?: string;
  nomeArquivo?: string;
}

export interface VeiculoPrestador {
  id: string;
  tipoVeiculo: TipoVeiculo;
  subcategoria: SubcategoriaVeiculo;
  tipoCarroceria: TipoCarroceria;
  classificacaoTermica: ClassificacaoTermica;
  placa: string;
  renavam: string;
  antt?: string;
  marca: string;
  modelo: string;
  ano: number;
  cor: string;
  capacidadeKg: number;
  capacidadeM3: number;
  comprimento?: number;
  largura?: number;
  altura?: number;
  qtdPallets?: number;
  proprietario: string;
  cpfCnpjProprietario?: string;
  rastreador?: string;
  seguradora?: string;
  possuiSeguro?: boolean;
  validadeDocumental?: string;
  status: StatusVeiculo;
  tipoCarga?: "seco" | "refrigerado" | "congelado" | "misto";
  tempMin?: number;
  tempMax?: number;
  restricoesRegiao?: string;
  observacoesOperacionais?: string;
  principal?: boolean;
}

export interface OcorrenciaPrestador {
  id?: string;
  prestadorId: string;
  data: string;
  tipo: "assalto" | "atraso" | "mercadoria_nao_retornada" | "divida" | "sinistro" | "reclamacao" | "elogio" | "advertencia" | "outro";
  descricao: string;
  gravidade: "baixa" | "media" | "alta" | "critica";
  registradoPor: string;
  status: "aberto" | "acompanhamento" | "resolvido";
  observacoesInternas?: string;
  criadoEm?: string;
}

export interface HistoricoAlteracao {
  campo: string;
  antes: string;
  depois: string;
  usuario: string;
  data: string;
}

export interface PermissoesPrestador {
  podeVerOS?: boolean;
  podeAceitarServico?: boolean;
  podeVerValores?: boolean;
  podeVerHistorico?: boolean;
  podeEnviarDocumentos?: boolean;
  podeAtualizarCadastro?: boolean;
  podeReceberNotificacoes?: boolean;
}

export interface Prestador {
  id: string;
  foto?: string;
  nomeCompleto: string;
  nomeFantasia?: string;
  cpfCnpj: string;
  rgIe?: string;
  dataNascimento?: string;
  telefone: string;
  whatsapp?: string;
  email: string;
  tipoParceiro: TipoParceiro;
  status: StatusPrestador;
  endereco: {
    cep: string;
    rua: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    estado: string;
  };
  regiaoPrincipal: string;
  regioesSecundarias?: string[];
  origemCadastro?: string;
  indicacao?: string;
  disponibilidade?: string;
  turnosPreferenciais?: string;
  restricoesOperacionais?: string;
  aceitaRefrigerada: boolean;
  aceitaUrbana: boolean;
  aceitaDedicada: boolean;
  aceitaEsporadica: boolean;
  contatosEmergencia: ContatoEmergencia[];
  documentos: DocumentoPrestador[];
  veiculos: VeiculoPrestador[];
  ocorrencias?: OcorrenciaPrestador[];
  
  // Permissões (Aplicativo do Prestador)
  permissoes?: PermissoesPrestador;

  // Financeiro
  banco?: string;
  agencia?: string;
  conta?: string;
  digito?: string;
  tipoConta?: string;
  favorecido?: string;
  cpfCnpjFavorecido?: string;
  chavePix?: string;
  tipoChavePix?: string;
  valorDiaria?: number;
  valorKm?: number;
  valorSaida?: number;
  fixoMensal?: number;
  valorAjudante?: number;
  valorEspera?: number;
  valorReentrega?: number;
  valorDevolucao?: number;
  periodicidadePagamento?: string;
  prazoPagamento?: string;
  formaPreferencialPagamento?: string;
  contaContabil?: string;
  centroCusto?: string;
  retencoes?: string;
  conferenciManual: boolean;
  franquiaKm?: number;
  observacoesFinanceiras?: string;
  // Qualidade
  scoreInterno: number;
  avaliacaoOperacional?: string;
  qtdOperacoes: number;
  indiceAceite: number;
  indiceComparecimento: number;
  indiceEntregaNoPrazo: number;
  historicoOcorrencias?: { data: string; descricao: string }[];
  historicoBloqueios?: { data: string; motivo: string; tipo: string }[];
  dataCadastro: string;
  dataAprovacao?: string;
  historicoAlteracoes: HistoricoAlteracao[];
  ultimaAtualizacao: string;
  ultimoUsuario: string;
  observacoesTorre?: string;
  torreControle?: {
    ocorrenciasGraves: number;
    sinistro: number;
    extravio: number;
    desobediencia: number;
    atrasos: number;
    elogios: number;
    observacoes: string;
  };
}

export const TIPO_PARCEIRO_LABEL: Record<TipoParceiro, string> = {
  autonomo: "Parceiro Autônomo",
  agregado: "Parceiro Agregado",
  fixo: "Parceiro Fixo",
  esporadico: "Parceiro Esporádico",
  terceiro: "Parceiro Terceiro",
  clt: "CLT",
};

export const TIPO_PARCEIRO_COR: Record<TipoParceiro, string> = {
  autonomo: "bg-blue-500 text-white",
  agregado: "bg-purple-500 text-white",
  fixo: "bg-green-500 text-white",
  esporadico: "bg-orange-500 text-white",
  terceiro: "bg-gray-500 text-white",
  clt: "bg-teal-500 text-white",
};

export const STATUS_LABEL: Record<StatusPrestador, string> = {
  ativo: "Ativo",
  analise: "Em análise",
  inativo: "Inativo",
  bloqueado: "Bloqueado",
};

export const STATUS_COR: Record<StatusPrestador, string> = {
  ativo: "bg-green-500 text-white",
  analise: "bg-yellow-500 text-black",
  inativo: "bg-gray-400 text-white",
  bloqueado: "bg-red-500 text-white",
};

export const TIPO_VEICULO_LABEL: Record<TipoVeiculo, string> = {
  moto: "Moto", utilitario_leve: "Utilitário Leve", fiorino: "Fiorino", kangoo: "Kangoo",
  hr: "HR", van: "Van", vuc: "VUC", "3_4": "3/4", toco: "Toco", truck: "Truck",
  carreta: "Carreta", carreta_ls: "Carreta LS", bitrem: "Bitrem", rodotrem: "Rodotrem",
  cavalo_mecanico: "Cavalo Mecânico", bau_urbano: "Baú Urbano", dedicado: "Veículo Dedicado",
  refrigerado_leve: "Refrigerado Leve", outro: "Outro",
};

