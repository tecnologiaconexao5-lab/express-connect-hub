export interface PricingEndereco {
  cidade: string;
  uf: string;
  cep?: string;
}

export interface PricingAdicionaisManuais {
  pedagio_cobrado_cliente?: number;
  reentrega_cliente?: number;
  agendamento_cliente?: number;
  ajuste_cliente_valor?: number;
  km_excedente_prestador_valor?: number;
}

export interface PricingOverbooking {
  ativo: boolean;
  tipo?: 'percentual' | 'fixo';
  valor_base?: number;
  percentual_cliente?: number;
  percentual_prestador?: number;
  valor_cliente?: number;
  valor_prestador?: number;
}

export interface PricingReversa {
  ativo: boolean;
  tipo: 'coleta_reversa' | 'devolucao' | 'troca' | 'retorno_cd';
  volumes_previstos: number;
  calculo_cliente: 'sem_cobranca' | 'valor_fixo' | 'percentual' | 'por_parada' | 'por_volume' | 'por_peso' | 'por_km' | 'negociado';
  valor_cliente?: number;
  percentual_cliente?: number;
  calculo_prestador: 'sem_pagamento' | 'valor_fixo' | 'por_parada' | 'por_volume' | 'por_peso' | 'por_km' | 'percentual' | 'negociado';
  valor_prestador?: number;
  percentual_prestador?: number;
}

export interface PricingPrestadorOperacional {
  valor_fixo?: number;
  valor_percentual?: number;
  valor_tipo?: 'fixo' | 'percentual';
  ajudantes?: number;
  valor_ajudante?: number;
  pedagio?: number;
  combustivel?: number;
  desconto?: number;
  segunda_saida?: boolean;
  valor_segunda_saida?: number;
  segunda_saida_cobrar_cliente?: boolean;
  segunda_saida_pagar_prestador?: boolean;
  terceira_saida?: boolean;
  valor_terceira_saida?: number;
  terceira_saida_cobrar_cliente?: boolean;
  terceira_saida_pagar_prestador?: boolean;
  saidas_adicionais?: number;
  valor_saida_adicional?: number;
  diarias_adicionais?: number;
  valor_diaria?: number;
  valor_reembolso_outros?: number;
}

export interface PricingInput {
  tenant_id: string;
  cliente_id: string;
  cliente_nome?: string;
  filial_id?: string;
  contrato_id?: string;
  tabela_valor_id?: string;
  prestador_id?: string;
  veiculo_id?: string;
  tipo_veiculo: string;
  tipo_operacao: 'dedicado' | 'fracionado' | 'urbano' | 'transferencia';
  distancia_km: number;
  peso?: number;
  cubagem?: number;
  quantidade_paradas: number;
  origem: PricingEndereco;
  destino: PricingEndereco;
  minutos_espera?: number;
  hora_saida?: number;
  adicionais_manuais?: PricingAdicionaisManuais;
  overbooking?: PricingOverbooking;
  reversa?: PricingReversa;
  prestador_operacional?: PricingPrestadorOperacional;
  modo: 'preview' | 'efetivar';
  usuario_id?: string;
  data_operacao?: string;
}

export interface TabelaValorAplicada {
  id: string;
  nome: string;
  fonte: 'tabelas_valores' | 'universal' | 'fallback_hardcoded' | 'nao_encontrada';
  valor_base: number;
  franquia_km: number;
  valor_km_excedente: number;
  percentual_prestador: number;
  valor_fixo_prestador?: number;
  tipo_repasse_prestador?: 'percentual' | 'fixo';
  adicionais?: Record<string, any>;
  versao?: number;
  prioridade?: number;
  data_inicio?: string | null;
  data_fim?: string | null;
}

export interface TabelaPrestadorAplicada {
  id: string | null;
  nome: string;
  fonte: 'tabela_prestador' | 'prestadores_cadastro' | 'veiculos' | 'percentual_tabela_valores' | 'manual' | 'nao_encontrada';
  valor_minimo?: number;
  km_incluso?: number;
  valor_km?: number;
  valor_diaria?: number;
  valor_saida?: number;
}

export interface PricingAdicionaisCliente {
  km_excedente: number;
  espera: number;
  pedagio_cobrado: number;
  reentrega: number;
  agendamento: number;
  segunda_saida: number;
  terceira_saida: number;
  ajuste_manual: number;
  overbooking: number;
  outros: number;
}

export interface PricingAdicionaisPrestador {
  km_excedente: number;
  espera: number;
  ajudante: number;
  pedagio: number;
  segunda_saida: number;
  terceira_saida: number;
  saidas_adicionais: number;
  diarias_adicionais: number;
  reembolso_outros: number;
  overbooking: number;
}

export interface PricingDescontosPrestador {
  combustivel: number;
  outros: number;
}

export interface PricingMargem {
  bruta: number;
  liquida: number;
  percentual_bruta: number;
  percentual_liquida: number;
  imposto_valor: number;
  seguro_valor: number;
  imposto_percentual: number;
}

export interface PricingRegraAplicada {
  tipo: string;
  descricao: string;
  impacto_cliente: number;
  impacto_prestador: number;
}

export interface PricingAlerta {
  tipo: 'info' | 'warning' | 'error';
  mensagem: string;
  campo?: string;
}

export interface PricingFontesDados {
  tabelas_valores: boolean;
  tabela_prestador: boolean;
  prestadores_cadastro: boolean;
  veiculos: boolean;
  clientes_aliquota: boolean;
  fallback_hardcoded: boolean;
}

export interface PricingOutput {
  sucesso: boolean;
  modo: 'preview' | 'efetivar';
  timestamp: string;

  cliente: {
    id: string;
    nome?: string;
    tabela_aplicada: TabelaValorAplicada;
    valor_base: number;
    valor_base_original: number;
    adicionais: PricingAdicionaisCliente;
    total_adicionais: number;
    reversa_valor: number;
    total: number;
  };

  prestador: {
    id: string | null;
    nome?: string;
    tabela_aplicada: TabelaPrestadorAplicada;
    valor_base: number;
    valor_base_original: number;
    detalhes_km: {
      franquia: number;
      excedente: number;
      valor_km: number;
      total_excedente: number;
    };
    adicionais: PricingAdicionaisPrestador;
    total_adicionais: number;
    descontos: PricingDescontosPrestador;
    total_descontos: number;
    reversa_valor: number;
    total: number;
  };

  custos_operacionais: {
    pedagio: number;
    combustivel: number;
    ajudante: number;
    outros: number;
    total: number;
  };

  margem: PricingMargem;

  regras_aplicadas: PricingRegraAplicada[];

  memoria_calculo: string[];

  alertas: PricingAlerta[];

  pode_salvar: boolean;
  motivo_bloqueio?: string;

  fontes_dados: PricingFontesDados;
}
