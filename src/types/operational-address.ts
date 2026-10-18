export interface OperationalAddress {
  /** Identificação */
  id?: string;
  tipo_ponto?: "origem" | "destino" | "coleta" | "entrega" | "parada" | "coleta_reversa" | "devolucao" | "retorno" | "apoio";
  nome_local?: string;
  sequencia?: number;
  rota_id?: string;
  parada_id?: string;

  /** Endereço estruturado */
  endereco?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  uf?: string;
  endereco_formatado?: string;
  referencia?: string;

  /** Dados do contrato atual (compatibilidade) */
  mapbox_place_id?: string;

  /** Coordenadas */
  latitude?: number;
  longitude?: number;

  /** Contato */
  contato_nome?: string;
  contato_telefone?: string;
  responsavel?: string;
  recebedor_previsto?: string;

  /** Janela operacional */
  data_prevista?: string;
  janela_inicio?: string;
  janela_fim?: string;
  horario_limite?: string;
  prioridade?: "baixa" | "normal" | "alta" | "critica";

  /** Orientações operacionais */
  instrucoes?: string;
  observacoes?: string;
  observacao_ponto?: string;
  procedimento_entrada?: string;
  procedimento_saida?: string;
  portaria?: string;
  doca?: string;
  estacionamento?: string;
  documento_necessario?: string;
  codigo_acesso?: string;
  exigencia_epi?: boolean;
  exige_ajudante?: boolean;
  restricao_veiculo?: string;
  restricao_altura?: string;
  outras_restricoes?: string;
  restricoes?: string;

  /** Status do ponto */
  status_ponto?: "pendente" | "a_caminho" | "chegou" | "concluido" | "falhou";
  agendamento?: boolean;

  /** Dados de entrega (parada) */
  destinatario?: string;
  volumes?: number;
  peso?: number;
  cubagem?: number;
  nota_fiscal?: string;
  pedido?: string;
  tipo_carga?: string;
}

export function formatAddressDisplay(addr: OperationalAddress | null | undefined): string {
  if (!addr) return "";
  const partes = [addr.endereco || addr.logradouro, addr.numero, addr.bairro, addr.cidade, addr.estado || addr.uf].filter(Boolean);
  return partes.length > 0 ? partes.join(", ") : "";
}

export function parseJsonToOperationalAddress(json: any): OperationalAddress | null {
  if (!json || typeof json !== "object") return null;
  return {
    id: json.id,
    tipo_ponto: json.tipo_ponto || json.tipo,
    nome_local: json.nome_local || json.nomeLocal,
    sequencia: json.sequencia,
    rota_id: json.rota_id || json.rotaId,
    parada_id: json.parada_id || json.paradaId,
    endereco: json.endereco,
    cep: json.cep,
    logradouro: json.logradouro,
    numero: json.numero,
    complemento: json.complemento,
    bairro: json.bairro,
    cidade: json.cidade,
    estado: json.estado || json.uf,
    uf: json.uf || json.estado,
    endereco_formatado: json.endereco_formatado || json.enderecoFormatado,
    referencia: json.referencia,
    mapbox_place_id: json.mapbox_place_id || json.mapboxPlaceId,
    latitude: json.latitude ? Number(json.latitude) : undefined,
    longitude: json.longitude ? Number(json.longitude) : undefined,
    contato_nome: json.contato_nome || json.contatoNome || json.contato || json.responsavel,
    contato_telefone: json.contato_telefone || json.contatoTelefone || json.telefone,
    responsavel: json.responsavel,
    recebedor_previsto: json.recebedor_previsto || json.recebedor,
    data_prevista: json.data_prevista || json.dataPrevista,
    janela_inicio: json.janela_inicio || json.janelaInicio,
    janela_fim: json.janela_fim || json.janelaFim,
    horario_limite: json.horario_limite || json.horarioLimite,
    prioridade: json.prioridade,
    instrucoes: json.instrucoes,
    observacoes: json.observacoes,
    observacao_ponto: json.observacao_ponto || json.observacaoPonto,
    procedimento_entrada: json.procedimento_entrada || json.procedimentoEntrada,
    procedimento_saida: json.procedimento_saida || json.procedimentoSaida,
    portaria: json.portaria,
    doca: json.doca,
    estacionamento: json.estacionamento,
    documento_necessario: json.documento_necessario || json.documentoNecessario,
    codigo_acesso: json.codigo_acesso || json.codigoAcesso,
    exigencia_epi: json.exigencia_epi ?? json.exigenciaEpi,
    exige_ajudante: json.exige_ajudante ?? json.exigeAjudante,
    restricao_veiculo: json.restricao_veiculo || json.restricaoVeiculo,
    restricao_altura: json.restricao_altura || json.restricaoAltura,
    outras_restricoes: json.outras_restricoes || json.outrasRestricoes,
    restricoes: json.restricoes,
    status_ponto: json.status_ponto || json.statusPonto,
    agendamento: json.agendamento,
    destinatario: json.destinatario,
    volumes: json.volumes,
    peso: json.peso,
    cubagem: json.cubagem,
    nota_fiscal: json.nota_fiscal || json.notaFiscal,
    pedido: json.pedido,
    tipo_carga: json.tipo_carga || json.tipoCarga,
  };
}
