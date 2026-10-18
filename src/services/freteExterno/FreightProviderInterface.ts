export interface FreightCotacaoParams {
  cepOrigem: string;
  cepDestino: string;
  volumes: any[];
  valorNota: number;
}

export interface FreightProviderInterface {
  calcularCotacao(params: FreightCotacaoParams): Promise<any>;
}
