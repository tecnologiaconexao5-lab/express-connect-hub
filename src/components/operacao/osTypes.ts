export type OSStatus = 
  | "rascunho" | "aguardando aprovacao" | "aguardando programacao" | "em programacao"
  | "programada" | "aguardando parceiro" | "aguardando veiculo" | "aguardando coleta"
  | "em coleta" | "carregando" | "saiu para rota" | "em operacao" | "em entrega"
  | "com ocorrencia" | "aguardando baixa" | "finalizada" | "faturada" | "cancelada"
  | "sem reserva" | "sem confirmacao" | "pendencia documental" | "pendencia financeira"
  | "reentrega" | "devolucao" | "retorno a base";

export const STATUS_CORES: Record<OSStatus, { label: string; twClass: string }> = {
  "rascunho": { label: "Rascunho", twClass: "bg-gray-200 text-gray-800" },
  "aguardando aprovacao": { label: "Aguard. Aprovação", twClass: "bg-yellow-100 text-yellow-800" },
  "aguardando programacao": { label: "Aguard. Programação", twClass: "bg-yellow-300 text-yellow-900" },
  "em programacao": { label: "Em Programação", twClass: "bg-blue-100 text-blue-800" },
  "programada": { label: "Programada", twClass: "bg-blue-300 text-blue-900" },
  "aguardando parceiro": { label: "Aguard. Parceiro", twClass: "bg-orange-100 text-orange-800" },
  "aguardando veiculo": { label: "Aguard. Veículo", twClass: "bg-orange-400 text-white" },
  "aguardando coleta": { label: "Aguard. Coleta", twClass: "bg-purple-100 text-purple-800" },
  "em coleta": { label: "Em Coleta", twClass: "bg-purple-500 text-white" },
  "carregando": { label: "Carregando", twClass: "bg-indigo-300 text-indigo-900" },
  "saiu para rota": { label: "Saiu p/ Rota", twClass: "bg-blue-800 text-white" },
  "em operacao": { label: "Em Operação", twClass: "bg-green-100 text-green-800" },
  "em entrega": { label: "Em Entrega", twClass: "bg-green-500 text-white" },
  "com ocorrencia": { label: "Com Ocorrência", twClass: "bg-red-500 text-white" },
  "aguardando baixa": { label: "Aguard. Baixa", twClass: "bg-yellow-600 text-white" },
  "finalizada": { label: "Finalizada", twClass: "bg-green-800 text-white" },
  "faturada": { label: "Faturada", twClass: "bg-emerald-400 text-emerald-900" },
  "cancelada": { label: "Cancelada", twClass: "bg-gray-800 text-white" },
  "sem reserva": { label: "Sem Reserva", twClass: "bg-pink-300 text-pink-900" },
  "sem confirmacao": { label: "Sem Confirmação", twClass: "bg-orange-200 text-orange-900" },
  "pendencia documental": { label: "Pend. Documental", twClass: "bg-orange-600 text-white" },
  "pendencia financeira": { label: "Pend. Financeira", twClass: "bg-red-800 text-white" },
  "reentrega": { label: "Reentrega", twClass: "bg-sky-200 text-sky-900" },
  "devolucao": { label: "Devolução", twClass: "bg-slate-400 text-white" },
  "retorno a base": { label: "Retorno à Base", twClass: "bg-amber-800 text-white" },
};

export interface OSEndereco {
  id?: string;
  os_id?: string;
  sequencia: number;
  tipo: "coleta" | "entrega" | "apoio" | "devolucao" | "retorno";
  nomeLocal: string;
  endereco: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  referencia: string;
  instrucoes: string;
  contato: string;
  telefone: string;
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

export interface OrdemServico {
  id?: string;
  numero: string;
  data: string;
  cliente: string;
  unidade: string;
  centroCusto: string;
  orcamentoOrigem: string;
  prestador: string; // nome ou id
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
  
  // Carga
  cargaTipo: string;
  cargaDescricao: string;
  volumes: number;
  peso: number;
  cubagem: number;
  pallets: number;
  valorDeclarado: number;
  qtdNotas: number;
  cargaRefrigerada: boolean;
  cargaAjudante: boolean;
  cargaFragil: boolean;
  cargaEmpilhavel: boolean;
  cargaRisco: boolean;
  conferenciaObrigatoria: boolean;
  equipamentoObrigatorio: string;
  condicaoTransporte: string;

  // Veiculo
  veiculoTipo: string;
  veiculoSubcategoria: string;
  veiculoCarroceria: string;
  veiculoTermica: string;
  isReserva: boolean;
  retornoObrigatorio: boolean;

  // Prog
  dataProgramada: string;
  janelaOperacional: string;
  previsaoInicio: string;
  previsaoTermino: string;
  tipoEscala: string;
  instrucoesOperacionais: string;
  observacaoTorre: string;

  // Fin
  tabelaAplicada: string;
  valorCliente: number;
  custoPrestador: number;
  pedagio: number;
  ajudante: number;
  adicionais: number;
  descontos: number;
  reembolsoPrevisto: number;
  contaContabil: string;
  centroCustoFin: string;
  statusFaturamento: "a faturar" | "faturada" | "paga";
  statusPagamento: "a pagar" | "pago";

  emailDestinatario?: string;
  whatsappDestinatario?: string;
  notificarDestinatario?: boolean;
  eventosTracker?: string;

  enderecos: OSEndereco[];
  historico: OSHistorico[];
}
