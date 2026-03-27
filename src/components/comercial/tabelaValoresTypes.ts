export interface TabelaValores {
  id: string;
  nome: string;
  cliente: string;
  unidade: string;
  centroCusto: string;
  tipoOperacao: string;
  segmento: string;
  vigenciaInicial: string;
  vigenciaFinal: string;
  status: "ativa" | "inativa" | "vencida" | "rascunho";
  versao: string;
  principalOuComplementar: "principal" | "complementar";
  observacoes: string;
  
  // Regras Base
  tipoCobrancaPrincipal: string;
  tipoVeiculo: string;
  subcategoria: string;
  carroceria: string;
  classificacaoTermica: string;
  valorBase: number;
  valorMinimoFaturavel: number;
  valorCusto: number;
  markupPercent: number;
  margemMinimaDesejada: number;
  custoMinimoParceiro: number;
  arredondamento: boolean;
  cobrancaRetorno: boolean;
  cobrancaEspera: boolean;
  cobrancaAjudante: boolean;

  // Faixas e Criterios
  faixas: TabelaFaixa[];

  // Adicionais
  adicionais: string[]; // JSON array

  // Financeiro e Controle
  contaContabil: string;
  custoEstimadoTotal: number;
  margemEstimadaTotal: number;
  historicoVersoes: any[]; // JSON
}

export interface TabelaFaixa {
  id?: string;
  tabela_id?: string;
  tipo_criterio: string; // "peso", "km", "cubagem", "regiao", "cep", "cidade_uf"
  inicio: number | string;
  fim: number | string;
  excedente: number;
  minimo: number;
  limite_nota_peso: number;
  perc_nota_peso: number;
  valor_adicional: number;
  prazo_estimado: string;
  restricao_veiculo: string;
  observacao: string;
}
