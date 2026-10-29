export type OrcamentoStatus = "rascunho" | "enviado" | "em_analise" | "aprovado" | "reprovado" | "expirado" | "convertido" | "convertido_em_os" | "cancelado";

export const STATUS_CONFIG: Record<OrcamentoStatus, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-gray-400 text-white" },
  enviado: { label: "Enviado", color: "bg-blue-500 text-white" },
  em_analise: { label: "Em Análise", color: "bg-yellow-500 text-white" },
  aprovado: { label: "Aprovado", color: "bg-green-600 text-white" },
  reprovado: { label: "Reprovado", color: "bg-red-500 text-white" },
  expirado: { label: "Expirado", color: "bg-orange-400 text-white" },
  convertido: { label: "Convertido em OS", color: "bg-emerald-600 text-white" },
  convertido_em_os: { label: "Convertido em OS", color: "bg-purple-600 text-white" },
  cancelado: { label: "Cancelado", color: "bg-gray-600 text-white" },
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

export interface DimensaoCarga {
  quantidade: number;
  comprimentoCm: number;
  larguraCm: number;
  alturaCm: number;
}

export interface CargaOrcamento {
  tipo?: string;
  descricao: string;
  volumes: number;
  peso: number;
  cubagem: number;
  pallets: number;
  valorDeclarado: number;
  refrigerado: boolean;
  ajudante: boolean;
  fragil: boolean;
  empilhavel: boolean;
  risco: boolean;
  perigosa: boolean;
  controlada: boolean;
  observacoes: string;
  // TMS-COM-CARGA-01/02 — dimensões por grupo de volume (cm) + derivados calculados.
  dimensoes?: DimensaoCarga[];
  pesoCubado?: number;
  fatorCubagem?: number | null;
  pesoConsiderado?: number;
  pesoCubadoDisponivel?: boolean;
  fatorCubagemContexto?: string;
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
  // TMS-COM-PRECO-01 — snapshot da regra de preço aplicada (histórico imutável).
  pricing?: PricingSnapshot;
}

export interface PricingSnapshot {
  tabelaId?: string;
  tabelaNome?: string;
  fonte?: string;
  veiculoTarifado?: string;
  distanciaKm?: number;
  franquiaKm?: number;
  valorBase?: number;
  kmExcedente?: number;
  valorCalculado?: number;
  overrideManual?: boolean;
  contexto?: string;
  calculadoEm?: string;
}

export interface DistanciaRota {
  distancia_km: number;
  duracao_min: number;
  distancia_texto: string;
  duracao_texto: string;
  maps_provider: "mapbox";
}

export interface FreteSugerido {
  valor_base: number;
  valor_por_km: number;
  sugestao: number;
  distancia_km: number;
}

export interface Orcamento {
  id: string;
  numero: string;
  cliente: string;
  /** UUID do cliente em `clientes` (obrigatório para gerar OS — `ordens_servico.cliente` é uuid). */
  clienteId?: string;
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
  /** Cliente originado pela Cota��o Express (sem cadastro completo). */
  clienteCotacao?: boolean;
  enderecos: EnderecoOrcamento[];
  carga: CargaOrcamento;
  veiculo: {
    tipo: string;
    subcategoria: string;
    carroceria: string;
    // TMS-COM-CARGA-01 — recomendação persistida (explicável) e seleção humana.
    recomendado?: string;
    recomendacaoDisponivel?: boolean;
    recomendacaoMotivos?: string[];
  };
  valores: ValoresOrcamento;
  distancia_rota?: DistanciaRota;
  frete_sugerido?: FreteSugerido;
  motivoReprovacao?: string;
  historico: { data: string; acao: string; usuario: string }[];
  // Vínculo com OS gerada
  osVinculadaId?: string;
  osVinculadaNumero?: string;
}
