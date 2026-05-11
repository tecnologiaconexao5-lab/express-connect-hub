export type CombustivelTipo = 'diesel' | 'gasolina' | 'etanol';

export interface MonitoramentoCombustivel {
  combustivel_tipo: CombustivelTipo;
  preco_base: number;
  preco_atual: number;
  variacao_percentual: number;
  data_consulta: string;
  fonte: string;
  percentual_sugerido_reajuste: number;
  aplicar_somente_no_componente_veiculo: boolean;
}

export interface SugestaoReajuste {
  tipo: CombustivelTipo;
  variacao: number;
  sugestao: number;
  mensagem: string;
}
