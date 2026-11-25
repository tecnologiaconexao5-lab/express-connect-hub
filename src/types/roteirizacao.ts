export interface PedidoRoteirizacao {
  id: string;
  numeroPedido: string;
  cliente: string;
  destinatario: string;
  telefone: string;
  cep: string;
  enderecoCompleto: string;
  bairro: string;
  cidade: string;
  estado: string;
  latitude?: number;
  longitude?: number;
  pesoKg: number;
  quantidadeVolumes: number;
  comprimentoCm: number;
  larguraCm: number;
  alturaCm: number;
  cubagemM3: number;
  tipoCarga: 'seco' | 'refrigerado';
  secoOuRefrigerado: 'seco' | 'refrigerado';
  temperaturaMinima?: number;
  janelaInicio?: string;
  janelaFim?: string;
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  observacoes?: string;
  status: 'pendente' | 'alocado' | 'em_rota' | 'entregue' | 'falha';
}

export interface VeiculoRoteirizacao {
  id: string;
  tipoVeiculo: TipoVeiculo;
  placa: string;
  motorista: string;
  prestadorId?: string;
  cepBasePrestador?: string;
  regiaoBase?: string;
  capacidadePesoKg: number;
  capacidadeCubagemM3: number;
  tipoOperacao: 'seco' | 'refrigerado';
  temperaturaMinima?: number;
  disponivel: boolean;
  contratoOuAvulso: 'contrato' | 'avulso';
  /** Online no App do motorista (prestadores.metadata.disponivel_app). */
  onlineApp?: boolean;
}

export type TipoVeiculo = 
  | 'Moto' 
  | 'Fiorino' 
  | 'HR_Bongo'
  | 'Van_VUC' 
  | 'Caminhao_34' 
  | 'Caminhao_Toco' 
  | 'Caminhao_Truck' 
  | 'Carreta';

export interface CapacidadePadraoVeiculo {
  tipo: TipoVeiculo;
  capacidadePesoKg: number;
  capacidadeCubagemM3: number;
  /** Maximo recomendado de paradas por turno (evita rota impossivel). */
  maxParadas?: number;
  observacao?: string;
}

export const CAPACIDADES_PADRAO_VEICULOS: CapacidadePadraoVeiculo[] = [
  { tipo: 'Moto', capacidadePesoKg: 20, capacidadeCubagemM3: 0.09, maxParadas: 12, observacao: 'baú 90 litros' },
  { tipo: 'Fiorino', capacidadePesoKg: 500, capacidadeCubagemM3: 2.5, maxParadas: 20 },
  { tipo: 'HR_Bongo', capacidadePesoKg: 1500, capacidadeCubagemM3: 9.0, maxParadas: 25, observacao: 'Hyundai HR / Bongo' },
  { tipo: 'Van_VUC', capacidadePesoKg: 1200, capacidadeCubagemM3: 6, maxParadas: 30 },
  { tipo: 'Caminhao_34', capacidadePesoKg: 3000, capacidadeCubagemM3: 15, maxParadas: 35 },
  { tipo: 'Caminhao_Toco', capacidadePesoKg: 6000, capacidadeCubagemM3: 30, maxParadas: 40 },
  { tipo: 'Caminhao_Truck', capacidadePesoKg: 12000, capacidadeCubagemM3: 55, maxParadas: 45 },
  { tipo: 'Carreta', capacidadePesoKg: 25000, capacidadeCubagemM3: 90, maxParadas: 50 },
];

/** Cenario de frota (tipo + quantidade) para um recorte de pedidos. */
export interface SugestaoFrotaCenario {
  tipo: TipoVeiculo;
  tipoNome: string;
  quantidade: number;
  capacidadePesoKg: number;
  capacidadeCubagemM3: number;
  maxParadas: number;
  /** Texto pronto, ex.: "1 Fiorino (500 kg)". */
  resumo: string;
}

/** Comparativo de frota para uma regiao/cluster (e para o consolidado). */
export interface SugestaoComparativaRegiao {
  regiao: string;
  paradas: number;
  pesoKg: number;
  cubagemM3: number;
  recomendado: SugestaoFrotaCenario | null;
  cenarios: SugestaoFrotaCenario[];
}

export interface RotaGerada {
  id: string;
  veiculoId: string;
  veiculo: VeiculoRoteirizacao;
  pedidos: PedidoRoteirizacao[];
  distanciaTotalKm: number;
  tempoTotalMinutos: number;
  pesoUsadoKg: number;
  cubagemUsadaM3: number;
  percentualOcupacao: number;
  alertas: string[];
  ordemEntrega: string[];
  origemCalculo: OrigemCalculoDistancia;
  distanciaCalculada: boolean;
}

export interface ResultadoRoteirizacao {
  id: string;
  dataCriacao: Date;
  pedidosOriginais: PedidoRoteirizacao[];
  rotasGeradas: RotaGerada[];
  totais: {
    totalPedidos: number;
    pesoTotalKg: number;
    cubagemTotalM3: number;
    regoesIdentificadas: string[];
    veiculosNecessarios: number;
    veiculosUtilizados: number;
    pedidosNaoAlocados: number;
  };
  alertas: AlertaRoteirizacao[];
}

export interface AlertaRoteirizacao {
  tipo: 'erro' | 'aviso' | 'sugestao';
  codigo: string;
  mensagem: string;
  pedidoIds?: string[];
  veiculoIds?: string[];
}

export interface FaixaCep {
  inicio: string;
  fim: string;
  regiao: string;
}

export interface GrupoPedidos {
  id: string;
  nome: string;
  tipo: 'faixa_cep' | 'cidade' | 'bairro' | 'regiao';
  pedidos: PedidoRoteirizacao[];
  pesoTotalKg: number;
  cubagemTotalM3: number;
}

export interface DadosImportacaoPlanilha {
  numero_pedido: string;
  cliente: string;
  destinatario: string;
  telefone: string;
  cep: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  peso_kg: string;
  quantidade_volumes: string;
  comprimento_cm: string;
  largura_cm: string;
  altura_cm: string;
  tipo_carga: string;
  seco_ou_refrigerado: string;
  temperatura_minima: string;
  janela_inicio: string;
  janela_fim: string;
  prioridade: string;
  observacoes: string;
}

export const CABECALHO_PLANILHA = [
  'numero_pedido',
  'cliente',
  'destinatario',
  'telefone',
  'cep',
  'endereco',
  'bairro',
  'cidade',
  'estado',
  'peso_kg',
  'quantidade_volumes',
  'comprimento_cm',
  'largura_cm',
  'altura_cm',
  'tipo_carga',
  'seco_ou_refrigerado',
  'temperatura_minima',
  'janela_inicio',
  'janela_fim',
  'prioridade',
  'observacoes',
];

export type ModoRoteirizacao = 'sugestao' | 'disponiveis';

export type OrigemCalculoDistancia = 'mapbox' | 'estimativa_local';

export interface ResultadoCalculoDistancia {
  distanciaTotalKm: number;
  tempoTotalMinutos: number;
  origemCalculo: OrigemCalculoDistancia;
  alertas: string[];
}

export interface ParadaSequencia {
  id: string;
  numeroPedido: string;
  cep: string;
  enderecoCompleto: string;
  bairro: string;
  cidade: string;
  latitude?: number;
  longitude?: number;
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  secoOuRefrigerado: 'seco' | 'refrigerado';
  janelaInicio?: string;
  janelaFim?: string;
  distanciaProximaParadaKm?: number;
  tempoProximaParadaMin?: number;
}