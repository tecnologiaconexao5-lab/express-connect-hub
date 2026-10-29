import type { DistanceResult } from "@/services/maps/types";
import { obterClasseBadgeGlobal, obterLabelGlobal, type StatusGlobal } from "./statusGlobal";

export type OSStatus = 
  | "rascunho" | "em_analise" | "pendente" | "agendada" | "em_andamento" | "em_rota" 
  | "coletado" | "entregue" | "finalizada" | "cancelada" | "ocorrencia";

export interface StatusInfo {
  label: string;
  twClass: string;
}

export const STATUS_OPERACIONAL: Record<OSStatus, StatusInfo> = {
  "rascunho": { label: "Rascunho", twClass: "bg-slate-600 text-white" },
  "em_analise": { label: "Em análise", twClass: "bg-orange-400 text-white" },
  "pendente": { label: "Pendente", twClass: "bg-amber-500 text-white" },
  "agendada": { label: "Alocado", twClass: "bg-blue-600 text-white" },
  "em_andamento": { label: "Carregando", twClass: "bg-orange-500 text-white" },
  "em_rota": { label: "Em Rota", twClass: "bg-indigo-600 text-white" },
  "coletado": { label: "Carregando", twClass: "bg-orange-500 text-white" },
  "entregue": { label: "Entregue", twClass: "bg-green-600 text-white" },
  "finalizada": { label: "Finalizado", twClass: "bg-emerald-600 text-white" },
  "cancelada": { label: "Cancelada", twClass: "bg-slate-400 text-white" },
  "ocorrencia": { label: "Ocorrência", twClass: "bg-orange-500 text-white" },
};

export const STATUS_CORES: Record<OSStatus, StatusInfo> = STATUS_OPERACIONAL;

export function obterStatusInfoOS(statusOS: string): StatusInfo {
  return STATUS_OPERACIONAL[statusOS as OSStatus] || { label: statusOS, twClass: "bg-slate-400 text-white" };
}

export function obterStatusGlobalOS(statusOS: string): StatusGlobal {
  const mapa: Record<string, StatusGlobal> = {
    rascunho: "rascunho",
    em_analise: "em_analise",
    pendente: "pendente",
    agendada: "alocado",
    em_andamento: "carregando",
    em_rota: "em_rota",
    coletado: "carregando",
    entregue: "entregue",
    finalizada: "finalizado",
    cancelada: "cancelado",
    ocorrencia: "em_rota",
    faturada: "faturado",
    paga: "pago_prestador",
  };
  return mapa[statusOS] || "pendente";
}

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
  tipo: "coleta" | "entrega" | "apoio" | "devolucao" | "retorno" | "origem" | "destino" | "parada" | "coleta_reversa";
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

  /** MISSÃO 132-A — Campos operacionais de endereço */
  portaria?: string;
  doca?: string;
  procedimentoEntrada?: string;
  procedimentoSaida?: string;
  estacionamento?: string;
  documentoNecessario?: string;
  codigoAcesso?: string;
  exigenciaEpi?: boolean;
  exigeAjudante?: boolean;
  restricaoVeiculo?: string;
  restricaoAltura?: string;
  outrasRestricoes?: string;
  horarioLimite?: string;
  dataPrevista?: string;
  recebedorPrevisto?: string;
  contatoNome?: string;
  contatoTelefone?: string;
}

export function parseOSEnderecoToOperational(e: OSEndereco): OperationalAddress {
  return {
    id: e.id,
    tipo_ponto: e.tipo as OperationalAddress["tipo_ponto"],
    nome_local: e.nomeLocal,
    sequencia: e.sequencia,
    endereco: e.endereco,
    cep: e.cep,
    logradouro: e.logradouro,
    numero: e.numero,
    complemento: e.complemento,
    bairro: e.bairro,
    cidade: e.cidade,
    estado: e.estado,
    uf: e.estado,
    endereco_formatado: e.enderecoFormatado,
    referencia: e.referencia,
    mapbox_place_id: e.mapboxPlaceId,
    latitude: e.latitude,
    longitude: e.longitude,
    contato_nome: e.contatoNome || e.contato,
    contato_telefone: e.contatoTelefone || e.telefone,
    responsavel: e.responsavel,
    recebedor_previsto: e.recebedorPrevisto || e.recebedor,
    data_prevista: e.dataPrevista,
    janela_inicio: e.janelaInicio,
    janela_fim: e.janelaFim,
    horario_limite: e.horarioLimite,
    prioridade: undefined,
    instrucoes: e.instrucoes,
    observacoes: e.observacoes,
    observacao_ponto: e.observacaoPonto,
    procedimento_entrada: e.procedimentoEntrada,
    procedimento_saida: e.procedimentoSaida,
    portaria: e.portaria,
    doca: e.doca,
    estacionamento: e.estacionamento,
    documento_necessario: e.documentoNecessario,
    codigo_acesso: e.codigoAcesso,
    exigencia_epi: e.exigenciaEpi,
    exige_ajudante: e.exigeAjudante,
    restricao_veiculo: e.restricaoVeiculo,
    restricao_altura: e.restricaoAltura,
    outras_restricoes: e.outrasRestricoes,
    restricoes: e.restricoes,
    status_ponto: e.statusPonto,
    agendamento: e.agendamento,
  };
}

import type { OperationalAddress } from "@/types/operational-address";

export interface OSHistorico {
  id?: string;
  os_id?: string;
  data: string; // ISO
  acao: string;
  status_novo: OSStatus;
  usuario: string;
}

export interface PortadorExterno {
  /** Quando true, a OS está atribuída a um portador fora da base cadastrada */
  ativo: boolean;
  nome: string;
  cpf: string;
  placaMoto: string;
  grupoOrigem: string;
  /** FIX-USABILIDADE — dados financeiros do prestador avulso */
  telefoneWhatsapp?: string;
  pixTipo?: string;
  pixChave?: string;
  /** ETAPA-3 — dados bancários/PIX completos (persistidos no jsonb carga.portadorExterno). */
  pixFavorecido?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
}

export interface OSCarga {
  tipo?: "Seca" | "Refrigerada" | "Congelada" | "Mista" | "Fragil" | "Documento";
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
  /** ETAPA-2: Portador Externo/Avulso (parceiro fora da base cadastrada) */
  portadorExterno?: PortadorExterno;
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
  romaneio?: string;
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
  tipoRota?: "rapida" | "curta" | "operacional";
  distanciaAlternativas?: {
    rapida?: { distanciaKm: number; duracaoMin: number; distanciaTexto: string; duracaoTexto: string } | null;
    curta?: { distanciaKm: number; duracaoMin: number; distanciaTexto: string; duracaoTexto: string } | null;
    operacional?: { distanciaKm: number; duracaoMin: number; distanciaTexto: string; duracaoTexto: string } | null;
  };

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

  // Auto-fill tracking
  valorClienteEditado?: boolean;
  custoPrestadorEditado?: boolean;
  tabelaValoresPadraoId?: string;
  tipoCobrancaCliente?: string;
  vencimentoPadraoCliente?: number;
  cfopPadraoCliente?: string;
  tomadorCliente?: string;
  // P3 - Ajuste manual de veiculo/tabela/valor
  veiculoTipoOriginal?: string;
  tabelaOriginal?: string;
  valorClienteOriginal?: number;
  custoPrestadorOriginal?: number;
  motivoAjusteManual?: string;
  usuarioAjusteManual?: string;
  dataAjusteManual?: string;
}
