import type { DistanceResult } from "@/services/maps/types";

export type OSStatus = 
  | "rascunho" | "pendente" | "agendada" | "em_andamento" | "em_rota" 
  | "coletado" | "entregue" | "finalizada" | "cancelada" | "ocorrencia";

export const STATUS_OPERACIONAL: Record<OSStatus, { label: string; twClass: string }> = {
  "rascunho": { label: "Rascunho", twClass: "bg-gray-200 text-gray-800" },
  "pendente": { label: "Pendente", twClass: "bg-yellow-100 text-yellow-800" },
  "agendada": { label: "Agendada", twClass: "bg-blue-100 text-blue-800" },
  "em_andamento": { label: "Em Andamento", twClass: "bg-blue-500 text-white" },
  "em_rota": { label: "Em Rota", twClass: "bg-indigo-600 text-white" },
  "coletado": { label: "Coletado", twClass: "bg-purple-600 text-white" },
  "entregue": { label: "Entregue", twClass: "bg-green-500 text-white" },
  "finalizada": { label: "Finalizada", twClass: "bg-green-800 text-white" },
  "cancelada": { label: "Cancelada", twClass: "bg-red-600 text-white" },
  "ocorrencia": { label: "Ocorrência", twClass: "bg-orange-500 text-white" },
};

export const STATUS_CORES: Record<OSStatus, { label: string; twClass: string }> = STATUS_OPERACIONAL;

export type TipoOperacao = 
  | "Coleta"
  | "Entrega"
  | "Coleta e Entrega"
  | "Transferência"
  | "Retirada"
  | "Distribuição"
  | "Reentrega"
  | "Devolução"
  | "Apoio Operacional"
  | "Dedicado"
  | "Emergencial"
  | "Agendado";

export interface OSEndereco {
  id?: string;
  os_id?: string;
  sequencia: number;
  tipo: "coleta" | "entrega" | "apoio" | "devolucao" | "retorno";
  nomeLocal: string;
  setor?: string;
  responsavel?: string;
  telefone?: string;
  email?: string;
  ramal?: string;
  enviarWhatsApp?: boolean;
  observacaoPonto?: string;
  endereco: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  latitude?: number;
  longitude?: number;
  enderecoFormatado?: string;
  mapboxPlaceId?: string;
  referencia: string;
  instrucoes: string;
  contato: string;
  janelaInicio: string;
  janelaFim: string;
  tempoSla?: string;
  restricoes?: string;
  agendamento: boolean;
  statusPonto: "pendente" | "a caminho" | "chegou" | "concluido" | "falhou";
  observacoes: string;
  assinaturaBase64?: string;
  recebedor?: string;
}

export interface OSHistorico {
  id?: string;
  os_id?: string;
  data: string; // ISO
  acao: string;
  status_novo: OSStatus;
  usuario: string;
}

export interface OSCarga {
  tipo?: "Seca" | "Refrigerada" | "Congelada" | "Mista";
  descricao?: string;
  volumes?: number;
  peso?: number;
  cubagem?: number;
  pallets?: number;
  valorDeclarado?: number;
  qtdNotas?: number;
  refrigerada?: boolean;
  ajudante?: boolean;
  fragil?: boolean;
  empilhavel?: boolean;
  risco?: boolean;
  perigosa?: boolean;
  controlada?: boolean;
  conferencia?: boolean;
  equipamento?: string;
  condicao?: string;
  comprimento?: number;
  largura?: number;
  altura?: number;
  pesoPorVolume?: number;
  temperaturaMinima?: number;
  temperaturaMaxima?: number;
  observacoesCarga?: string;
  cubagemCalculada?: number;
  cubagemManual?: boolean;
}

export interface OSVeiculoSugestao {
  tipo: string;
  label: string;
  motivo: string;
  kgNecessario: number;
  m3Necessario: number;
  dimensoesMinimas: string;
}

export interface OSComprovante {
  recebedorNome?: string;
  recebedorDocumento?: string;
  recebedorFuncao?: string;
  dataEntrega?: string;
  horaEntrega?: string;
  observacaoEntrega?: string;
  fotosEntrega?: string[];
  fotoColetaUrl?: string;
  fotoCanhotoUrl?: string;
  assinaturaDigital?: string;
}

export interface ComposicaoFinanceira {
  id?: string;
  osId?: string;
  valorCliente: number;
  valorPrestador: number;
  impostos: number;
  seguro: number;
  pedagio: number;
  outros: number;
  margemBruta: number;
  margemLiquida: number;
  percentualMargemBruta: number;
  percentualMargemLiquida: number;
  custosOperacionais: number;
  valorManual?: boolean;
}

export interface OrdemServico {
  id?: string;
  numero: string;
  data: string;
  cliente: string;
  clienteId?: string;
  unidade: string;
  centroCusto: string;
  orcamentoOrigem: string;
  prestador: string;
  veiculoAlocado: string;
  tipoOperacao: string;
  modalidade: string;
  prioridade: string;
  status: OSStatus;
  responsavel: string;
  refCliente: string;
  pedidoInterno: string;
  slaOperacao: string;
  observacoesGerais: string;
  comprovanteObrigatorio: boolean;
  cteObrigatorio: boolean;
  xmlObrigatorio: boolean;
  operacaoDedicada: boolean;

  carga: OSCarga;

  // Agendamento
  agendado?: boolean;
  dataAgendada?: string;
  observacaoAgendamento?: string;

  // Veiculo
  veiculoPlaca?: string;
  veiculoTipo: string;
  veiculoSubcategoria: string;
  veiculoCarroceria: string;
  veiculoTermica: string;
  isReserva: boolean;
  retornoObrigatorio: boolean;
  veiculoSugerido?: string;

  // Prog
  dataProgramada: string;
  janelaOperacional: string;
  previsaoInicio: string;
  previsaoTermino: string;
  tipoEscala: string;
  instrucoesOperacionaisOS: string;
  observacaoTorre: string;

  // Fin
  tabelaAplicada: string;
  faixaAplicada?: string;
  valorCliente: number;
  custoPrestador: number;
  pedagio: number;
  ajudante: number;
  adicionais: number;
  descontos: number;
  reembolsoPrevisto: number;
  contaContabil: string;
  centroCustoFin: string;
  statusFaturamento: "a vista" | "a faturar" | "contrato" | "cortesia" | "cancelado" | "faturada" | "paga";
  statusPagamento: "a pagar" | "pago";
  lucroEstimado?: number;
  margemLucro?: number;

  // TAREFA 5 - Margem
  margem?: number;
  percentualMargem?: number;

  // TAREFA 3 - Mapa/Rota
  distanciaKm?: number;
  tempoEstimado?: string;
  mapboxOrigem?: string;
  mapboxDestino?: string;
  pontosJson?: any[];
  rotaCalculada?: boolean;

  // TAREFA 4 - Financeiro
  financeiroGerado?: boolean;
  reciboGerado?: boolean;
  financeiroReceberId?: string;
  financeiroPagarId?: string;

  // NOVA COMPOSIÇÃO FINANCEIRA
  composicaoFinanceira?: ComposicaoFinanceira;

  // TAREFA 8 - App Motorista
  motoristaStatus?: string;
  aceiteMotorista?: boolean;
  dataAceiteMotorista?: string;
  dataChegadaColeta?: string;
  dataColeta?: string;
  dataChegadaEntrega?: string;
  dataEntrega?: string;
  comprovanteUrl?: string;
  assinaturaUrl?: string;
  fotoEntregaUrl?: string;
  localizacaoEntregaJson?: any;
  recebedorNome?: string;
  recebedorDocumento?: string;
  recebedorFuncao?: string;
  comprovante?: OSComprovante;

  // TAREFA 9 - Painel Cliente
  visivelCliente?: boolean;
  statusCliente?: string;
  linkRastreamento?: string;
  previsaoEntrega?: string;
  mensagemCliente?: string;

  emailDestinatario?: string;
  whatsappDestinatario?: string;
  notificarDestinatario?: boolean;
  eventosTracker?: string;
  distanciaRota?: DistanceResult;

  enderecos: OSEndereco[];
  historico: OSHistorico[];
}
