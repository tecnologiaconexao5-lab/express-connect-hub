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
}

export type TipoVeiculo = 
  | 'Moto' 
  | 'Fiorino' 
  | 'Van_VUC' 
  | 'Caminhao_34' 
  | 'Caminhao_Toco' 
  | 'Caminhao_Truck' 
  | 'Carreta';

export interface CapacidadePadraoVeiculo {
  tipo: TipoVeiculo;
  capacidadePesoKg: number;
  capacidadeCubagemM3: number;
  observacao?: string;
}

export const CAPACIDADES_PADRAO_VEICULOS: CapacidadePadraoVeiculo[] = [
  { tipo: 'Moto', capacidadePesoKg: 20, capacidadeCubagemM3: 0.09, observacao: 'baú 90 litros' },
  { tipo: 'Fiorino', capacidadePesoKg: 500, capacidadeCubagemM3: 2.5 },
  { tipo: 'Van_VUC', capacidadePesoKg: 1200, capacidadeCubagemM3: 6 },
  { tipo: 'Caminhao_34', capacidadePesoKg: 3000, capacidadeCubagemM3: 15 },
  { tipo: 'Caminhao_Toco', capacidadePesoKg: 6000, capacidadeCubagemM3: 30 },
  { tipo: 'Caminhao_Truck', capacidadePesoKg: 12000, capacidadeCubagemM3: 55 },
  { tipo: 'Carreta', capacidadePesoKg: 25000, capacidadeCubagemM3: 90 },
];

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