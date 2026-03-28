export type StatusTabela = "ativa" | "inativa" | "rascunho" | "vencida";

export interface RegraFaixa {
  id: string;
  pesoIni: number;
  pesoFim: number;
  kmIni: number;
  kmFim: number;
  cubagemIni: number;
  cubagemFim: number;
  regioesDestino: string[];
  cepIni: string;
  cepFim: string;
  cidadeUF: string;
  prazoEstimado: number;
  valorBase: number;
  adicionalValor: number;
  restricaoVeiculo: string;
  prioridade: number;
  obs: string;
}

export interface AdicionaisTaxas {
  pedagio: { ativo: boolean; tipo: "%"|"R$"; valor: number };
  ajudante: { ativo: boolean; valor: number };
  espera: { ativo: boolean; minutosFree: number; valorHora: number };
  descarga: { ativo: boolean; valor: number };
  taxaAdmin: { ativo: boolean; valorPorcent: number };
  devolucao: { ativo: boolean; valor: number };
  reentrega: { ativo: boolean; tipo: "%"|"R$"; valor: number };
  pernoite: { ativo: boolean; valor: number };
  taxaRisco: { ativo: boolean; valorPorcent: number };
  acessoDificil: { ativo: boolean; valor: number };
  segundaTentativa: { ativo: boolean; tipo: "%"|"R$"; valor: number };
  estacionamento: { ativo: boolean; valor: number };
  agendamento: { ativo: boolean; valor: number };
  escolta: { ativo: boolean; valor: number };
  estadia: { ativo: boolean; valor: number };
  diariaExtra: { ativo: boolean; valor: number };
}

export interface TabelaValores {
  id: string;
  nome: string;
  cliente: string; // ID ou nome_fantasia do cliente (vazio = geral)
  unidade: string;
  tipoOperacao: string;
  segmentoCliente: string;
  dataInicio: string;
  dataFim: string;
  status: StatusTabela;
  versao: number;
  tipoTabela: "principal" | "complementar";
  observacoes: string;

  // Regras Base
  cobrancaPrincipais: string[]; // ["km", "diaria", etc]
  tipoVeiculo: string;
  subcategoriaVeiculo: string;
  classificacaoTermica: string;
  valorBase: number;
  minimoFaturavel: number;
  custoPrestador: number;
  markupPercent: number;
  margemMinimaPercent: number;
  custoMinimoPrestador: number;
  franquiaKm: number;
  valorKmExcedente: number;
  arredondamento: string; // "normal", "cima", "baixo"
  cobrancaRetorno: { cobrado: boolean; percentual: number };
  
  faixas: RegraFaixa[];
  adicionais: AdicionaisTaxas;
  
  // Financeiro
  contaContabil: string;
  centroCustoPadrao: string;
}

export const emptyTabelaValores = (): TabelaValores => ({
  id: String(Date.now()),
  nome: "",
  cliente: "",
  unidade: "",
  tipoOperacao: "",
  segmentoCliente: "",
  dataInicio: new Date().toISOString().split("T")[0],
  dataFim: "",
  status: "rascunho",
  versao: 1,
  tipoTabela: "principal",
  observacoes: "",

  cobrancaPrincipais: [],
  tipoVeiculo: "",
  subcategoriaVeiculo: "",
  classificacaoTermica: "seco",
  valorBase: 0,
  minimoFaturavel: 0,
  custoPrestador: 0,
  markupPercent: 0,
  margemMinimaPercent: 20,
  custoMinimoPrestador: 0,
  franquiaKm: 0,
  valorKmExcedente: 0,
  arredondamento: "normal",
  cobrancaRetorno: { cobrado: false, percentual: 0 },

  faixas: [],
  adicionais: {
    pedagio: { ativo: false, tipo: "R$", valor: 0 },
    ajudante: { ativo: false, valor: 0 },
    espera: { ativo: false, minutosFree: 60, valorHora: 0 },
    descarga: { ativo: false, valor: 0 },
    taxaAdmin: { ativo: false, valorPorcent: 0 },
    devolucao: { ativo: false, valor: 0 },
    reentrega: { ativo: false, tipo: "%", valor: 0 },
    pernoite: { ativo: false, valor: 0 },
    taxaRisco: { ativo: false, valorPorcent: 0 },
    acessoDificil: { ativo: false, valor: 0 },
    segundaTentativa: { ativo: false, tipo: "%", valor: 0 },
    estacionamento: { ativo: false, valor: 0 },
    agendamento: { ativo: false, valor: 0 },
    escolta: { ativo: false, valor: 0 },
    estadia: { ativo: false, valor: 0 },
    diariaExtra: { ativo: false, valor: 0 }
  },
  
  contaContabil: "",
  centroCustoPadrao: ""
});
