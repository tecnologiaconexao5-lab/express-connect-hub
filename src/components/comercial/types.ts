export type OrcamentoStatus = "rascunho" | "enviado" | "em_analise" | "aprovado" | "reprovado" | "expirado" | "convertido" | "convertido_em_os";

export const STATUS_CONFIG: Record<OrcamentoStatus, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-gray-400 text-white" },
  enviado: { label: "Enviado", color: "bg-blue-500 text-white" },
  em_analise: { label: "Em Análise", color: "bg-yellow-500 text-white" },
  aprovado: { label: "Aprovado", color: "bg-green-500 text-white" },
  reprovado: { label: "Reprovado", color: "bg-red-500 text-white" },
  expirado: { label: "Expirado", color: "bg-orange-400 text-white" },
  convertido: { label: "Convertido em OS", color: "bg-emerald-600 text-white" },
  convertido_em_os: { label: "Convertido em OS", color: "bg-purple-600 text-white" },
};

export interface EnderecoOrcamento {
  tipo: "coleta" | "entrega" | "retorno";
  sequencia: number;
  endereco: string;
  cidade: string;
  uf: string;
  cep: string;
  contato: string;
  telefone: string;
  instrucoes: string;
  janelaInicio: string;
  janelaFim: string;
}

export interface CargaOrcamento {
  descricao: string;
  volumes: number;
  peso: number;
  cubagem: number;
  pallets: number;
  valorDeclarado: number;
  refrigerado: boolean;
  ajudante: boolean;
  observacoes: string;
}

export interface ValoresOrcamento {
  tabelaVinculada: string;
  valorBase: number;
  adicionais: number;
  pedagio: number;
  kmExcedente: number;
  ajudante: number;
  devolucao: number;
  reentrega: number;
  descontos: number;
  valorFinal: number;
  custoEstimado: number;
  margemEstimada: number;
  lucroEstimado: number;
}

export interface Orcamento {
  id: string;
  numero: string;
  cliente: string;
  clienteCnpj: string;
  unidade: string;
  centroCusto: string;
  responsavel: string;
  dataEmissao: string;
  validade: string;
  tipoOperacao: string;
  modalidade: "contrato" | "esporadico";
  prioridade: "normal" | "urgente" | "programada";
  pedidoInterno: string;
  observacoesGerais: string;
  status: OrcamentoStatus;
  enderecos: EnderecoOrcamento[];
  carga: CargaOrcamento;
  veiculo: {
    tipo: string;
    subcategoria: string;
    carroceria: string;
  };
  valores: ValoresOrcamento;
  motivoReprovacao?: string;
  historico: { data: string; acao: string; usuario: string }[];
}
