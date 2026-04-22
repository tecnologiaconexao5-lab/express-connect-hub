// ============================================================
// MAPEADORES CENTRALIZADOS FRONTEND ↔ SUPABASE
// ============================================================
// REGRA: Frontend usa camelCase, Banco usa snake_case
// NUNCA enviar form bruto diretamente para insert/update
// ============================================================

// ---------------- UTILITÁRIOS ----------------
const safeString = (value: unknown, defaultValue = ""): string => {
  if (value === undefined || value === null) return defaultValue;
  return String(value);
};

const safeNumber = (value: unknown, defaultValue = 0): number => {
  if (value === undefined || value === null) return defaultValue;
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
};

const safeBoolean = (value: unknown): boolean => {
  if (value === undefined || value === null) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true" || value === "1";
  return Boolean(value);
};

const safeArray = <T>(value: unknown): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [];
};

const safeJsonParse = <T>(value: unknown, fallback: T): T => {
  if (!value) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback as T;
};

// ---------------- PRESTADORES ----------------

export interface PrestadorForm {
  id?: string;
  foto?: string;
  nomeCompleto?: string;
  nomeFantasia?: string;
  cpfCnpj?: string;
  rgIe?: string;
  dataNascimento?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  tipoParceiro?: string;
  status?: string;
  endereco?: {
    cep?: string;
    rua?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
  };
  regiaoPrincipal?: string;
  regioesSecundarias?: string[];
  origemCadastro?: string;
  indicacao?: string;
  disponibilidade?: string;
  turnosPreferenciais?: string;
  restricoesOperacionais?: string;
  aceitaRefrigerada?: boolean;
  aceitaUrbana?: boolean;
  aceitaDedicada?: boolean;
  aceitaEsporadica?: boolean;
  banco?: string;
  agencia?: string;
  conta?: string;
  digito?: string;
  tipoConta?: string;
  favorece?: string;
  cpfCnpjFavorecido?: string;
  chavePix?: string;
  tipoChavePix?: string;
  valorDiaria?: number;
  valorKm?: number;
  valorSaida?: number;
  fixoMensal?: number;
  valorAjudante?: number;
  valorEspera?: number;
  valorReentrega?: number;
  valorDevolucao?: number;
  periodicidadePagamento?: string;
  prazoPagamento?: string;
  formaPreferencialPagamento?: string;
  contaContabil?: string;
  centroCusto?: string;
  retencoes?: string;
  conferenciManual?: boolean;
  observacoesFinanceiras?: string;
  scoreInterno?: number;
  avaliacaoOperacional?: string;
  qtdOperacoes?: number;
  indiceAceite?: number;
  indiceComparecimento?: number;
  indiceEntregaNoPrazo?: number;
  dataCadastro?: string;
  dataAprovacao?: string;
  ultimaAtualizacao?: string;
  ultimoUsuario?: string;
  observacoesTorre?: string;
}

export interface PrestadorRow {
  id: string;
  foto?: string;
  nome_completo?: string;
  nome_fantasia?: string;
  cpf_cnpj?: string;
  rg_ie?: string;
  data_nascimento?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  tipo_parceiro?: string;
  status?: string;
  endereco_cep?: string;
  endereco_rua?: string;
  endereco_numero?: string;
  endereco_complemento?: string;
  endereco_bairro?: string;
  endereco_cidade?: string;
  endereco_estado?: string;
  regiao_principal?: string;
  regioes_secundarias?: string;
  origem_cadastro?: string;
  indicacao?: string;
  disponibilidade?: string;
  turnos_preferenciais?: string;
  restricoes_operacionais?: string;
  aceita_refrigerada?: boolean;
  aceita_urbana?: boolean;
  aceita_dedicada?: boolean;
  aceita_esporadica?: boolean;
  banco?: string;
  agencia?: string;
  conta?: string;
  digito?: string;
  tipo_conta?: string;
  favorecido?: string;
  cpf_cnpj_favorecido?: string;
  chave_pix?: string;
  tipo_chave_pix?: string;
  valor_diaria?: number;
  valor_km?: number;
  valor_saida?: number;
  fixo_mensal?: number;
  valor_ajudante?: number;
  valor_espera?: number;
  valor_reentrega?: number;
  valor_devolucao?: number;
  periodicidade_pagamento?: string;
  prazo_pagamento?: string;
  forma_preferencial_pagamento?: string;
  conta_contabil?: string;
  centro_custo?: string;
  retencoes?: string;
  conferencia_manual?: boolean;
  observacoes_financeiras?: string;
  score_interno?: number;
  avaliacao_operacional?: string;
  qtd_operacoes?: number;
  indice_aceite?: number;
  indice_comparecimento?: number;
  indice_entrega_prazo?: number;
  data_cadastro?: string;
  data_aprovacao?: string;
  ultima_atualizacao?: string;
  ultimo_usuario?: string;
  observacoes_torre?: string;
  created_at?: string;
  updated_at?: string;
}

export const toPrestadorInsert = (form: Partial<PrestadorForm>): Record<string, unknown> => {
  const d: Record<string, unknown> = {};
  const has = (v: unknown) => v !== undefined && v !== null && v !== "";

  if (has(form.foto)) d.foto = String(form.foto);
  if (has(form.nomeCompleto)) d.nome_completo = String(form.nomeCompleto);
  if (has(form.cpfCnpj)) d.cpf_cnpj = String(form.cpfCnpj);
  if (has(form.telefone)) d.telefone = String(form.telefone);
  if (has(form.whatsapp)) d.whatsapp = String(form.whatsapp);
  if (has(form.email)) d.email = String(form.email);
  if (has(form.tipoParceiro)) d.tipo_parceiro = String(form.tipoParceiro);
  if (has(form.status)) d.status = String(form.status);
  if (has(form.regiaoPrincipal)) d.regiao_principal = String(form.regiaoPrincipal);
  if (has(form.dataNascimento)) d.data_nascimento = String(form.dataNascimento);
  if (has(form.rgIe)) d.rg = String(form.rgIe);

  if (has(form.scoreInterno)) d.score_interno = Number(form.scoreInterno);
  d.status_operacional = "analise";
  if (has(form.indiceAceite)) d.indice_aceite = Number(form.indiceAceite);
  if (has(form.indiceComparecimento)) d.indice_comparecimento = Number(form.indiceComparecimento);
  if (has(form.indiceEntregaNoPrazo)) d.indice_entrega_prazo = Number(form.indiceEntregaNoPrazo);
  if (has(form.qtdOperacoes)) d.qtd_operacoes = Number(form.qtdOperacoes);

  if (has(form.aceitaDedicada)) d.aceita_dedicada = form.aceitaDedicada;
  if (has(form.aceitaUrbana)) d.aceita_urbana = form.aceitaUrbana;
  if (has(form.conferenciManual)) d.conferencia_manual = form.conferenciManual;

  d.data_cadastro = new Date().toISOString();
  d.ultima_atualizacao = new Date().toISOString();
  d.updated_at = new Date().toISOString();

  return d;
};

export const toPrestadorUpdate = (form: Partial<PrestadorForm>): Record<string, unknown> => {
  const d: Record<string, unknown> = {};
  const has = (v: unknown) => v !== undefined && v !== null && v !== "";

  if (has(form.foto)) d.foto = String(form.foto);
  if (has(form.nomeCompleto)) d.nome_completo = String(form.nomeCompleto);
  if (has(form.cpfCnpj)) d.cpf_cnpj = String(form.cpfCnpj);
  if (has(form.telefone)) d.telefone = String(form.telefone);
  if (has(form.whatsapp)) d.whatsapp = String(form.whatsapp);
  if (has(form.email)) d.email = String(form.email);
  if (has(form.tipoParceiro)) d.tipo_parceiro = String(form.tipoParceiro);
  if (has(form.status)) d.status = String(form.status);
  if (has(form.regiaoPrincipal)) d.regiao_principal = String(form.regiaoPrincipal);
  if (has(form.dataNascimento)) d.data_nascimento = String(form.dataNascimento);
  if (has(form.rgIe)) d.rg = String(form.rgIe);

  if (has(form.scoreInterno)) d.score_interno = Number(form.scoreInterno);
  if (has(form.indiceAceite)) d.indice_aceite = Number(form.indiceAceite);
  if (has(form.indiceComparecimento)) d.indice_comparecimento = Number(form.indiceComparecimento);
  if (has(form.indiceEntregaNoPrazo)) d.indice_entrega_prazo = Number(form.indiceEntregaNoPrazo);
  if (has(form.qtdOperacoes)) d.qtd_operacoes = Number(form.qtdOperacoes);

  if (has(form.aceitaDedicada)) d.aceita_dedicada = form.aceitaDedicada;
  if (has(form.aceitaUrbana)) d.aceita_urbana = form.aceitaUrbana;
  if (has(form.conferenciManual)) d.conferencia_manual = form.conferenciManual;

  d.ultima_atualizacao = new Date().toISOString();
  d.updated_at = new Date().toISOString();

  return d;
};

export const fromPrestadorRow = (item: PrestadorRow): PrestadorForm => ({
  id: item.id,
  foto: item.foto,
  nomeCompleto: item.nome_completo || item.nomeCompleto || "",
  nomeFantasia: item.nome_fantasia || item.nomeFantasia || item.nome_completo || "",
  cpfCnpj: item.cpf_cnpj || item.cpfCnpj || "",
  rgIe: item.rg_ie || item.rgIe,
  dataNascimento: item.data_nascimento || item.dataNascimento,
  telefone: item.telefone || "",
  whatsapp: item.whatsapp,
  email: item.email || "",
  tipoParceiro: item.tipo_parceiro || item.tipoParceiro || "autonomo",
  status: item.status || item.status || "analise",
  endereco: {
    cep: item.endereco_cep || "",
    rua: item.endereco_rua || "",
    numero: item.endereco_numero || "",
    complemento: item.endereco_complemento,
    bairro: item.endereco_bairro || "",
    cidade: item.endereco_cidade || "",
    estado: item.endereco_estado || "",
  },
  regiaoPrincipal: item.regiao_principal || item.regiaoPrincipal || "",
  regioesSecundarias: safeJsonParse(item.regioes_secundarias || item.regioesSecundarias, []),
  origemCadastro: item.origem_cadastro || item.origemCadastro,
  indicacao: item.indicacao,
  disponibilidade: item.disponibilidade,
  turnosPreferenciais: item.turnos_preferenciais || item.turnosPreferenciais,
  restricoesOperacionais: item.restricoes_operacionais || item.restricoesOperacionais,
  aceitaRefrigerada: item.aceita_refrigerada ?? item.aceitaRefrigerada ?? false,
  aceitaUrbana: item.aceita_urbana ?? item.aceitaUrbana ?? false,
  aceitaDedicada: item.aceita_dedicada ?? item.aceitaDedicada ?? false,
  aceptaEsporadica: item.aceita_esporadica ?? item.aceitaEsporadica ?? false,
  banco: item.banco,
  agencia: item.agencia,
  conta: item.conta,
  digito: item.digito,
  tipoConta: item.tipo_conta || item.tipoConta,
  favorece: item.favorecido,
  cpfCnpjFavorecido: item.cpf_cnpj_favorecido || item.cpfCnpjFavorecido,
  chavePix: item.chave_pix || item.chavePix,
  tipoChavePix: item.tipo_chave_pix || item.tipoChavePix,
  valorDiaria: item.valor_diaria ?? item.valorDiaria,
  valorKm: item.valor_km ?? item.valorKm,
  valorSaida: item.valor_saida ?? item.valorSaida,
  fixoMensal: item.fixo_mensal ?? item.fixoMensal,
  valorAjudante: item.valor_ajudante ?? item.valorAjudante,
  valorEspera: item.valor_espera ?? item.valorEspera,
  valorReentrega: item.valor_reentrega ?? item.valorReentrega,
  valorDevolucao: item.valor_devolucao ?? item.valorDevolucao,
  periodicidadePagamento: item.periodicidade_pagamento || item.periodicidadePagamento,
  prazoPagamento: item.prazo_pagamento || item.prazoPagamento,
  formaPreferencialPagamento: item.forma_preferencial_pagamento || item.formaPreferencialPagamento,
  contaContabil: item.conta_contabil || item.contaContabil,
  centroCusto: item.centro_custo || item.centroCusto,
  retencoes: item.retencoes,
  conferenciManual: item.conferencia_manual ?? item.conferenciManual ?? false,
  observacoesFinanceiras: item.observacoes_financeiras || item.observacoesFinanceiras,
  scoreInterno: Number(item.score_interno ?? item.scoreInterno ?? 0),
  avaliacaoOperacional: item.avaliacao_operacional || item.avaliacaoOperacional,
  qtdOperacoes: item.qtd_operacoes ?? item.qtdOperacoes ?? 0,
  indiceAceite: Number(item.indice_aceite ?? item.indiceAceite ?? 0),
  indiceComparecimento: Number(item.indice_comparecimento ?? item.indiceComparecimento ?? 0),
  indiceEntregaNoPrazo: Number(item.indice_entrega_prazo ?? item.indiceEntregaNoPrazo ?? 0),
  dataCadastro: item.data_cadastro || item.dataCadastro,
  dataAprovacao: item.data_aprovacao || item.dataAprovacao,
  ultimaAtualizacao: item.ultima_atualizacao || item.ultimaAtualizacao,
  ultimoUsuario: item.ultimo_usuario || item.ultimoUsuario,
  observacoesTorre: item.observacoes_torre || item.observacoesTorre,
});

// ---------------- CLIENTES ----------------

export interface ClienteForm {
  id?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  cnpj?: string;
  ie?: string;
  segmento?: string;
  porte?: string;
  status?: string;
  contatoPrincipal?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  site?: string;
  cidade?: string;
  uf?: string;
  logo?: string;
  numOsMes?: number;
  responsavelOperacional?: string;
  responsavelFinanceiro?: string;
  responsavelComercial?: string;
  observacoes?: string;
  origemComercial?: string;
  exigeAgendamento?: boolean;
  exigeSla?: boolean;
  exigePortal?: boolean;
  aceitaApi?: boolean;
}

export interface ClienteRow {
  id?: string;
  razao_social?: string;
  nome_fantasia?: string;
  cnpj?: string;
  ie?: string;
  segmento?: string;
  porte?: string;
  status?: string;
  contato_principal?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  site?: string;
  cidade?: string;
  uf?: string;
  logo?: string;
  num_os_mes?: number;
  responsavel_operacional?: string;
  responsavel_financeiro?: string;
  responsavel_comercial?: string;
  observacoes?: string;
  origem_comercial?: string;
  exige_agendamento?: boolean;
  exige_sla?: boolean;
  exige_portal?: boolean;
  aceita_api?: boolean;
  created_at?: string;
  updated_at?: string;
}

export const toClienteInsert = (form: Partial<ClienteForm>): Record<string, unknown> => {
  const d: Record<string, unknown> = {};
  const has = (v: unknown) => v !== undefined && v !== null;

  if (has(form.razaoSocial)) d.razao_social = form.razaoSocial;
  if (has(form.nomeFantasia)) d.nome_fantasia = form.nomeFantasia;
  else if (has(form.razaoSocial)) d.nome_fantasia = form.razaoSocial;
  if (has(form.cnpj)) d.cnpj = form.cnpj;
  if (has(form.ie)) d.ie = form.ie;
  if (has(form.segmento)) d.segmento = form.segmento;
  if (has(form.porte)) d.porte = form.porte;
  if (has(form.status)) d.status = form.status;
  if (has(form.contatoPrincipal)) d.contato_principal = form.contatoPrincipal;
  if (has(form.telefone)) d.telefone = form.telefone;
  if (has(form.whatsapp)) d.whatsapp = form.whatsapp;
  if (has(form.email)) d.email = form.email;
  if (has(form.site)) d.site = form.site;
  if (has(form.cidade)) d.cidade = form.cidade;
  if (has(form.uf)) d.uf = form.uf;
  if (has(form.logo)) d.logo = form.logo;
  if (has(form.numOsMes)) d.num_os_mes = form.numOsMes;
  if (has(form.responsavelOperacional)) d.responsavel_operacional = form.responsavelOperacional;
  if (has(form.responsavelFinanceiro)) d.responsavel_financeiro = form.responsavelFinanceiro;
  if (has(form.responsavelComercial)) d.responsavel_comercial = form.responsavelComercial;
  if (has(form.observacoes)) d.observacoes = form.observacoes;
  if (has(form.origemComercial)) d.origem_comercial = form.origemComercial;
  if (has(form.exigeAgendamento)) d.exige_agendamento = form.exigeAgendamento;
  if (has(form.exigeSla)) d.exige_sla = form.exigeSla;
  if (has(form.exigePortal)) d.exige_portal = form.exigePortal;
  if (has(form.aceitaApi)) d.aceita_api = form.aceitaApi;

  d.created_at = new Date().toISOString();
  d.updated_at = new Date().toISOString();
  if (!form.status) d.status = "ativo";

  return d;
};

export const toClienteUpdate = (form: Partial<ClienteForm>): Record<string, unknown> => {
  const payload = toClienteInsert(form);
  delete payload.created_at;
  delete payload.status;
  payload.updated_at = new Date().toISOString();
  return payload;
};

export const fromClienteRow = (item: ClienteRow): ClienteForm => ({
  id: item.id,
  razaoSocial: item.razao_social || item.razaoSocial || "",
  nomeFantasia: item.nome_fantasia || item.nomeFantasia || "",
  cnpj: item.cnpj || "",
  ie: item.ie,
  segmento: item.segmento,
  porte: item.porte,
  status: item.status || item.status || "ativo",
  contatoPrincipal: item.contato_principal || item.contatoPrincipal,
  telefone: item.telefone || "",
  whatsapp: item.whatsapp,
  email: item.email,
  site: item.site,
  cidade: item.cidade,
  uf: item.uf,
  logo: item.logo,
  numOsMes: item.num_os_mes ?? item.numOsMes,
  responsavelOperacional: item.responsavel_operacional || item.responsavelOperacional,
  responsavelFinanceiro: item.responsavel_financeiro || item.responsavelFinanceiro,
  responsavelComercial: item.responsavel_comercial || item.responsavelComercial,
  observacoes: item.observacoes,
  origemComercial: item.origem_comercial || item.origemComercial,
  exigeAgendamento: item.exige_agendamento ?? item.exigeAgendamento ?? false,
  exigeSla: item.exige_sla ?? item.exigeSla ?? false,
  exigePortal: item.exige_portal ?? item.exigePortal ?? false,
  aceitaApi: item.aceita_api ?? item.aceitaApi ?? false,
});

// ---------------- VEÍCULOS ----------------

export interface VeiculoForm {
  id?: string;
  placa?: string;
  tipoVeiculo?: string;
  subcategoria?: string;
  marca?: string;
  modelo?: string;
  anoFabricacao?: number;
  anoModelo?: number;
  cor?: string;
  renavam?: string;
  chassi?: string;
  capacidadeKg?: number;
  capacidadeM3?: number;
  comprimento?: number;
  largura?: number;
  altura?: number;
  qtdPallets?: number;
  tipoCarroceria?: string;
  classificacaoTermica?: string;
  rastreador?: string;
  seguroApolice?: string;
  validadeDocumental?: string;
  prestadorVinculado?: string;
  unidade?: string;
  custoKm?: number;
  custoDiaria?: number;
  status?: string;
  observacoes?: string;
  fotos?: string[];
}

export interface VeiculoRow {
  id?: string;
  placa?: string;
  tipo_veiculo?: string;
  subcategoria?: string;
  marca?: string;
  modelo?: string;
  ano_fabricacao?: number;
  ano_modelo?: number;
  cor?: string;
  renavam?: string;
  chassi?: string;
  capacidade_kg?: number;
  capacidade_m3?: number;
  comprimento?: number;
  largura?: number;
  altura?: number;
  qtd_pallets?: number;
  tipo_carroceria?: string;
  classificacao_termica?: string;
  rastreador?: string;
  seguro_apolice?: string;
  validade_documental?: string;
  prestador_vinculado?: string;
  unidade?: string;
  custo_km?: number;
  custo_diaria?: number;
  status?: string;
  observacoes?: string;
  fotos?: string[];
  created_at?: string;
  updated_at?: string;
}

export const toVeiculoInsert = (form: Partial<VeiculoForm>): Record<string, unknown> => {
  const d: Record<string, unknown> = {};
  const has = (v: unknown) => v !== undefined && v !== null;

  if (has(form.placa)) d.placa = form.placa?.toUpperCase();
  if (has(form.tipoVeiculo)) d.tipo_veiculo = form.tipoVeiculo;
  if (has(form.subcategoria)) d.subcategoria = form.subcategoria;
  if (has(form.marca)) d.marca = form.marca;
  if (has(form.modelo)) d.modelo = form.modelo;
  if (has(form.anoFabricacao)) d.ano_fabricacao = form.anoFabricacao;
  if (has(form.anoModelo)) d.ano_modelo = form.anoModelo;
  if (has(form.cor)) d.cor = form.cor;
  if (has(form.renavam)) d.renavam = form.renavam;
  if (has(form.chassi)) d.chassi = form.chassi;
  if (has(form.capacidadeKg)) d.capacidade_kg = form.capacidadeKg;
  if (has(form.capacidadeM3)) d.capacidade_m3 = form.capacidadeM3;
  if (has(form.comprimento)) d.comprimento = form.comprimento;
  if (has(form.largura)) d.largura = form.largura;
  if (has(form.altura)) d.altura = form.altura;
  if (has(form.qtdPallets)) d.qtd_pallets = form.qtdPallets;
  if (has(form.tipoCarroceria)) d.tipo_carroceria = form.tipoCarroceria;
  if (has(form.classificacaoTermica)) d.classificacao_termica = form.classificacaoTermica;
  if (has(form.rastreador)) d.rastreador = form.rastreador;
  if (has(form.seguroApolice)) d.seguro_apolice = form.seguroApolice;
  if (has(form.validadeDocumental)) d.validade_documental = form.validadeDocumental;
  if (has(form.prestadorVinculado)) d.prestador_vinculado = form.prestadorVinculado;
  if (has(form.unidade)) d.unidade = form.unidade;
  if (has(form.custoKm)) d.custo_km = form.custoKm;
  if (has(form.custoDiaria)) d.custo_diaria = form.custoDiaria;
  if (has(form.status)) d.status = form.status;
  if (has(form.observacoes)) d.observacoes = form.observacoes;
  if (form.fotos) d.fotos = JSON.stringify(form.fotos);

  d.created_at = new Date().toISOString();
  d.updated_at = new Date().toISOString();

  return d;
};

export const toVeiculoUpdate = (form: Partial<VeiculoForm>): Record<string, unknown> => {
  const payload = toVeiculoInsert(form);
  delete payload.created_at;
  delete payload.id;
  payload.updated_at = new Date().toISOString();
  return payload;
};

export const fromVeiculoRow = (item: VeiculoRow): VeiculoForm => ({
  id: item.id,
  placa: item.placa || "",
  tipoVeiculo: item.tipo_veiculo || item.tipoVeiculo || "",
  subcategoria: item.subcategoria || item.subcategoria,
  marca: item.marca,
  modelo: item.modelo,
  anoFabricacao: item.ano_fabricacao ?? item.anoFabricacao,
  anoModelo: item.ano_modelo ?? item.anoModelo,
  cor: item.cor,
  renavam: item.renavam,
  chassi: item.chassi,
  capacidadeKg: item.capacidade_kg ?? item.capacidadeKg,
  capacidadeM3: item.capacidade_m3 ?? item.capacidadeM3,
  comprimento: item.comprimento,
  largura: item.largura,
  altura: item.altura,
  qtdPallets: item.qtd_pallets ?? item.qtdPallets,
  tipoCarroceria: item.tipo_carroceria || item.tipoCarroceria,
  classificacaoTermica: item.classificacao_termica || item.classificacaoTermica,
  rastreador: item.rastreador,
  seguroApolice: item.seguro_apolice || item.seguroApolice,
  validadeDocumental: item.validade_documental || item.validadeDocumental,
  prestadorVinculado: item.prestador_vinculado || item.prestadorVinculado,
  unidade: item.unidade,
  custoKm: item.custo_km ?? item.custoKm,
  custoDiaria: item.custo_diaria ?? item.custoDiaria,
  status: item.status || "ativo",
  observacoes: item.observacoes,
  fotos: safeJsonParse(item.fotos || item.fotos, []),
});

// ---------------- ORDENS DE SERVIÇO ----------------

export interface OSForm {
  id?: string;
  numero?: string;
  data?: string;
  cliente?: string;
  unidade?: string;
  centroCusto?: string;
  orcamentoOrigem?: string;
  prestador?: string;
  veiculoAlocado?: string;
  tipoOperacao?: string;
  modalidade?: string;
  prioridade?: string;
  status?: string;
  responsavel?: string;
  refCliente?: string;
  pedidoInterno?: string;
  slaOperacao?: string;
  observacoesGerais?: string;
  comprovanteObrigatorio?: boolean;
  cteObrigatorio?: boolean;
  xmlObrigatorio?: boolean;
  operacaoDedicada?: boolean;
  cargaTipo?: string;
  cargaDescricao?: string;
  volumes?: number;
  peso?: number;
  cubagem?: number;
  pallets?: number;
  valorDeclarado?: number;
  qtdNotas?: number;
  cargaRefrigerada?: boolean;
  cargaAjudante?: boolean;
  cargaFragil?: boolean;
  cargaEmpilhavel?: boolean;
  cargaRisco?: boolean;
  conferenciasObrigatoria?: boolean;
  equipamentoObrigatorio?: string;
  condicaoTransporte?: string;
  veiculoTipo?: string;
  veiculoSubcategoria?: string;
  veiculoCarroceria?: string;
  veiculoTermica?: string;
  isReserva?: boolean;
  retornoObrigatorio?: boolean;
  dataProgramada?: string;
  janelaOperacional?: string;
  previsaoInicio?: string;
  previsaoTermino?: string;
  tipoEscala?: string;
  instrucoesOperacionais?: string;
  observacaoTorre?: string;
  tabelaAplicada?: string;
  valorCliente?: number;
  custoPrestador?: number;
  pedagio?: number;
  ajudante?: number;
  adicionais?: number;
  descontos?: number;
  reembolsoPrevisto?: number;
  contaContabil?: string;
  centroCustoFin?: string;
  statusFaturamento?: string;
  statusPagamento?: string;
  emailDestinatario?: string;
  whatsappDestinatario?: string;
  notificarDestinatario?: boolean;
  eventosTracker?: string;
}

export interface OSRow {
  id?: string;
  numero?: string;
  data?: string;
  cliente?: string;
  unidade?: string;
  centro_custo?: string;
  orcamento_origem?: string;
  prestador?: string;
  veiculo_alocado?: string;
  tipo_operacao?: string;
  modalidade?: string;
  prioridade?: string;
  status?: string;
  responsavel?: string;
  ref_cliente?: string;
  pedido_interno?: string;
  sla_operacao?: string;
  observacoes_gerais?: string;
  comprovante_obrigatorio?: boolean;
  cte_obrigatorio?: boolean;
  xml_obrigatorio?: boolean;
  operacao_dedicada?: boolean;
  carga_tipo?: string;
  carga_descricao?: string;
  volumes?: number;
  peso?: number;
  cubagem?: number;
  pallets?: number;
  valor_declarado?: number;
  qtd_notas?: number;
  carga_refrigerada?: boolean;
  carga_ajudante?: boolean;
  carga_fragil?: boolean;
  carga_empilhavel?: boolean;
  carga_risco?: boolean;
  conferencia_obrigatoria?: boolean;
  equipamento_obrigatorio?: string;
  condicao_transporte?: string;
  veiculo_tipo?: string;
  veiculo_subcategoria?: string;
  veiculo_carroceria?: string;
  veiculo_termica?: string;
  is_reserva?: boolean;
  retorno_obrigatorio?: boolean;
  data_programada?: string;
  janela_operacional?: string;
  previsao_inicio?: string;
  previsao_termino?: string;
  tipo_escala?: string;
  instrucoes_operacionais?: string;
  observacao_torre?: string;
  tabela_aplicada?: string;
  valor_cliente?: number;
  custo_prestador?: number;
  pedagio?: number;
  ajudante?: number;
  adicionais?: number;
  descontos?: number;
  reembolso_previsto?: number;
  conta_contabil?: string;
  centro_custo_fin?: string;
  status_faturamento?: string;
  status_pagamento?: string;
  email_destinatario?: string;
  whatsapp_destinatario?: string;
  notificar_destinatario?: boolean;
  eventos_tracker?: string;
  created_at?: string;
  updated_at?: string;
}

export const toOSInsert = (form: Partial<OSForm>): Record<string, unknown> => {
  const d: Record<string, unknown> = {};
  const has = (v: unknown) => v !== undefined && v !== null;

  if (has(form.numero)) d.numero = form.numero;
  if (has(form.data)) d.data = form.data;
  if (has(form.cliente)) d.cliente = form.cliente;
  if (has(form.unidade)) d.unidade = form.unidade;
  if (has(form.centroCusto)) d.centro_custo = form.centroCusto;
  if (has(form.orcamentoOrigem)) d.orcamento_origem = form.orcamentoOrigem;
  if (has(form.prestador)) d.prestador = form.prestador;
  if (has(form.veiculoAlocado)) d.veiculo_alocado = form.veiculoAlocado;
  if (has(form.tipoOperacao)) d.tipo_operacao = form.tipoOperacao;
  if (has(form.modalidade)) d.modalidade = form.modalidade;
  if (has(form.prioridade)) d.prioridade = form.prioridade;
  if (has(form.status)) d.status = form.status;
  if (has(form.responsavel)) d.responsavel = form.responsavel;
  if (has(form.refCliente)) d.ref_cliente = form.refCliente;
  if (has(form.pedidoInterno)) d.pedido_interno = form.pedidoInterno;
  if (has(form.slaOperacao)) d.sla_operacao = form.slaOperacao;
  if (has(form.observacoesGerais)) d.observacoes_gerais = form.observacoesGerais;
  if (has(form.comprovanteObrigatorio)) d.comprovante_obrigatorio = form.comprovanteObrigatorio;
  if (has(form.cteObrigatorio)) d.cte_obrigatorio = form.cteObrigatorio;
  if (has(form.xmlObrigatorio)) d.xml_obrigatorio = form.xmlObrigatorio;
  if (has(form.operacaoDedicada)) d.operacao_dedicada = form.operacaoDedicada;

  if (has(form.cargaTipo)) d.carga_tipo = form.cargaTipo;
  // Novo: Priorizar objeto carga JSONB
  if ((form as any).carga) {
    const c = (form as any).carga;
    d.carga = {
      tipo: c.tipo || "",
      descricao: c.descricao || "",
      volumes: c.volumes || 0,
      peso: c.peso || 0,
      cubagem: c.cubagem || 0,
      pallets: c.pallets || 0,
      valorDeclarado: c.valorDeclarado || 0,
      qtdNotas: c.qtdNotas || 0,
      refrigerada: c.refrigerada || false,
      ajudante: c.ajudante || false,
      fragil: c.fragil || false,
      empilhavel: c.empilhavel !== false,
      risco: c.risco || false,
      perigosa: c.perigosa || false,
      controlada: c.controlada || false,
      conferencia: c.conferencia || false,
      equipamento: c.equipamento || "",
      condicao: c.condicao || ""
    };
  }

  if (has(form.veiculoTipo)) d.veiculo_tipo = form.veiculoTipo;
  if (has(form.veiculoSubcategoria)) d.veiculo_subcategoria = form.veiculoSubcategoria;
  if (has(form.veiculoCarroceria)) d.veiculo_carroceria = form.veiculoCarroceria;
  if (has(form.veiculoTermica)) d.veiculo_termica = form.veiculoTermica;
  if (has(form.isReserva)) d.is_reserva = form.isReserva;
  if (has(form.retornoObrigatorio)) d.retorno_obrigatorio = form.retornoObrigatorio;

  if (has(form.dataProgramada)) d.data_programada = form.dataProgramada;
  if (has(form.janelaOperacional)) d.janela_operacional = form.janelaOperacional;
  if (has(form.previsaoInicio)) d.previsao_inicio = form.previsaoInicio;
  if (has(form.previsaoTermino)) d.previsao_termino = form.previsaoTermino;
  if (has(form.tipoEscala)) d.tipo_escala = form.tipoEscala;
  if (has(form.instrucoesOperacionais)) d.instrucoes_operacionais = form.instrucoesOperacionais;
  if (has(form.observacaoTorre)) d.observacao_torre = form.observacaoTorre;

  if (has(form.tabelaAplicada)) d.tabela_aplicada = form.tabelaAplicada;
  if (has(form.valorCliente)) d.valor_cliente = form.valorCliente;
  if (has(form.custoPrestador)) d.custo_prestador = form.custoPrestador;
  if (has(form.pedagio)) d.pedagio = form.pedagio;
  if (has(form.ajudante)) d.ajudante = form.ajudante;
  if (has(form.adicionais)) d.adicionais = form.adicionais;
  if (has(form.descontos)) d.descontos = form.descontos;
  if (has(form.reembolsoPrevisto)) d.reembolso_previsto = form.reembolsoPrevisto;
  if (has(form.contaContabil)) d.conta_contabil = form.contaContabil;
  if (has(form.centroCustoFin)) d.centro_custo_fin = form.centroCustoFin;
  if (has(form.statusFaturamento)) d.status_faturamento = form.statusFaturamento;
  if (has(form.statusPagamento)) d.status_pagamento = form.statusPagamento;

  if (has(form.emailDestinatario)) d.email_destinatario = form.emailDestinatario;
  if (has(form.whatsappDestinatario)) d.whatsapp_destinatario = form.whatsappDestinatario;
  if (has(form.notificarDestinatario)) d.notificar_destinatario = form.notificarDestinatario;
  if (has(form.eventosTracker)) d.eventos_tracker = form.eventosTracker;

  // Campos não mapeados no OSForm mas presentes no OrdemServico
  if ((form as any).enderecos) (d as any).enderecos = (form as any).enderecos;
  if ((form as any).historico) (d as any).historico = (form as any).historico;

  d.created_at = new Date().toISOString();
  d.updated_at = new Date().toISOString();

  return d;
};

export const toOSUpdate = (form: Partial<OSForm>): Record<string, unknown> => {
  const payload = toOSInsert(form);
  delete payload.created_at;
  delete payload.id;
  delete payload.status;
  payload.updated_at = new Date().toISOString();
  return payload;
};

export const fromOSRow = (item: OSRow): OSForm => ({
  id: item.id,
  numero: item.numero || "",
  data: item.data || "",
  cliente: item.cliente || "",
  unidade: item.unidade || "",
  centroCusto: item.centro_custo || item.centroCusto || "",
  orcamentoOrigem: item.orcamento_origem || item.orcamentoOrigem,
  prestador: item.prestador || "",
  veiculoAlocado: item.veiculo_alocado || item.veiculoAlocado,
  tipoOperacao: item.tipo_operacao || item.tipoOperacao,
  modalidade: item.modalidade || "",
  prioridade: item.prioridade || "normal",
  status: item.status || "rascunho",
  responsavel: item.responsavel || "",
  refCliente: item.ref_cliente || item.refCliente,
  pedidoInterno: item.pedido_interno || item.pedidoInterno,
  slaOperacao: item.sla_operacao || item.slaOperacao,
  observacoesGerais: item.observacoes_gerais || item.observacoesGerais,
  comprovanteObrigatorio: item.comprovante_obrigatorio ?? item.comprovanteObrigatorio ?? false,
  cteObrigatorio: item.cte_obrigatorio ?? item.cteObrigatorio ?? false,
  xmlObrigatorio: item.xml_obrigatorio ?? item.xmlObrigatorio ?? false,
  operacaoDedicada: item.operacao_dedicada ?? item.operacaoDedicada ?? false,
  // Priorizar objeto carga JSONB, com fallback para campos antigos
  carga: (item as any).carga || {
    tipo: item.carga_tipo || item.cargaTipo || "",
    descricao: item.carga_descricao || item.cargaDescricao || "",
    volumes: item.volumes ?? item.volumes ?? 0,
    peso: item.peso ?? item.peso ?? 0,
    cubagem: item.cubagem ?? item.cubagem ?? 0,
    pallets: item.pallets ?? item.pallets ?? 0,
    valorDeclarado: item.valor_declarado ?? item.valorDeclarado ?? 0,
    qtdNotas: item.qtd_notas ?? item.qtdNotas ?? 0,
    refrigerada: item.carga_refrigerada ?? item.cargaRefrigerada ?? false,
    ayudante: item.carga_ajudante ?? item.cargaAjudante ?? false,
    fragil: item.carga_fragil ?? item.cargaFragil ?? false,
    empilhavel: item.carga_empilhavel ?? item.cargaEmpilhavel ?? true,
    risco: item.carga_risco ?? item.cargaRisco ?? false,
    conferencia: item.conferencia_obrigatoria ?? item.conferenciasObrigatoria ?? false,
    equipamento: item.equipamento_obrigatorio || item.equipamentoObrigatorio || "",
    condicao: item.condicao_transporte || item.condicaoTransporte || ""
  },
  veiculoTipo: item.veiculo_tipo || item.veiculoTipo,
  veiculoSubcategoria: item.veiculo_subcategoria || item.veiculoSubcategoria,
  veiculoCarroceria: item.veiculo_carroceria || item.veiculoCarroceria,
  veiculoTermica: item.veiculo_termica || item.veiculoTermica,
  isReserva: item.is_reserva ?? item.isReserva ?? false,
  retornoObrigatorio: item.retorno_obrigatorio ?? item.retornoObrigatorio ?? false,
  dataProgramada: item.data_programada || item.dataProgramada,
  janelaOperacional: item.janela_operacional || item.janelaOperacional,
  previsaoInicio: item.previsao_inicio || item.previsaoInicio,
  previsaoTermino: item.previsao_termino || item.previsaoTermino,
  tipoEscala: item.tipo_escala || item.tipoEscala,
  instrucoesOperacionais: item.instrucoes_operacionais || item.instrucoesOperacionais,
  observacaoTorre: item.observacao_torre || item.observacaoTorre,
  tabelaAplicada: item.tabela_aplicada || item.tabelaAplicada,
  valorCliente: item.valor_cliente ?? item.valorCliente ?? 0,
  custoPrestador: item.custo_prestador ?? item.custoPrestador ?? 0,
  pedagio: item.pedagio ?? item.pedagio ?? 0,
  ajudante: item.ajudante ?? item.ajudante ?? 0,
  adicionais: item.adicionais ?? item.adicionais ?? 0,
  descontos: item.descontos ?? item.descontos ?? 0,
  reembolsoPrevisto: item.reembolso_previsto ?? item.reembolsoPrevisto ?? 0,
  contaContabil: item.conta_contabil || item.contaContabil,
  centroCustoFin: item.centro_custo_fin || item.centroCustoFin,
  statusFaturamento: item.status_faturamento || item.statusFaturamento,
  statusPagamento: item.status_pagamento || item.statusPagamento,
  emailDestinatario: item.email_destinatario || item.emailDestinatario,
  whatsappDestinatario: item.whatsapp_destinatario || item.whatsappDestinatario,
  notificarDestinatario: item.notificar_destinatario ?? item.notificarDestinatario ?? false,
  eventosTracker: item.eventos_tracker || item.eventosTracker,
});

// ---------------- ORÇAMENTOS/PROPOSTAS ----------------

export interface OrcamentoForm {
  id?: string;
  numero?: string;
  cliente?: string;
  clienteCnpj?: string;
  unidade?: string;
  centroCusto?: string;
  responsavel?: string;
  dataEmissao?: string;
  validade?: string;
  tipoOperacao?: string;
  modalidade?: string;
  prioridade?: string;
  pedidoInterno?: string;
  observacoesGerais?: string;
  status?: string;
  cargaDescricao?: string;
  cargaVolumes?: number;
  cargaPeso?: number;
  cargaCubagem?: number;
  cargaPallets?: number;
  cargaValorDeclarado?: number;
  cargaRefrigerado?: boolean;
  cargaAjudante?: boolean;
  cargaObservacoes?: string;
  veiculoTipo?: string;
  veiculoSubcategoria?: string;
  veiculoCarroceria?: string;
  valorBase?: number;
  pedagio?: number;
  adicionais?: number;
  descontos?: number;
  valorFinal?: number;
  custoEstimado?: number;
  historico?: { data: string; acao: string; usuario: string }[];
}

export interface OrcamentoRow {
  id?: string;
  numero?: string;
  cliente?: string;
  cliente_cnpj?: string;
  unidade?: string;
  centro_custo?: string;
  responsavel?: string;
  data_emissao?: string;
  validade?: string;
  tipo_operacao?: string;
  modalidade?: string;
  prioridade?: string;
  pedido_interno?: string;
  observacoes_gerais?: string;
  status?: string;
  carga_descricao?: string;
  carga_volumes?: number;
  carga_peso?: number;
  carga_cubagem?: number;
  carga_pallets?: number;
  carga_valor_declarado?: number;
  carga_refrigerado?: boolean;
  carga_ajudante?: boolean;
  carga_observacoes?: string;
  veiculo_tipo?: string;
  veiculo_subcategoria?: string;
  veiculo_carroceria?: string;
  valor_base?: number;
  pedagio?: number;
  adicionais?: number;
  descontos?: number;
  valor_final?: number;
  custo_estimado?: number;
  historico?: { data: string; acao: string; usuario: string }[];
  created_at?: string;
  updated_at?: string;
}

export const toOrcamentoInsert = (form: Partial<OrcamentoForm>): Record<string, unknown> => {
  const d: Record<string, unknown> = {};
  const has = (v: unknown) => v !== undefined && v !== null;

  if (has(form.numero)) d.numero = form.numero;
  if (has(form.cliente)) d.cliente = form.cliente;
  if (has(form.clienteCnpj)) d.cliente_cnpj = form.clienteCnpj;
  if (has(form.unidade)) d.unidade = form.unidade;
  if (has(form.centroCusto)) d.centro_custo = form.centroCusto;
  if (has(form.responsavel)) d.responsavel = form.responsavel;
  if (has(form.dataEmissao)) d.data_emissao = form.dataEmissao;
  if (has(form.validade)) d.validade = form.validade;
  if (has(form.tipoOperacao)) d.tipo_operacao = form.tipoOperacao;
  if (has(form.modalidade)) d.modalidade = form.modalidade;
  if (has(form.prioridade)) d.prioridade = form.prioridade;
  if (has(form.pedidoInterno)) d.pedido_interno = form.pedidoInterno;
  if (has(form.observacoesGerais)) d.observacoes_gerais = form.observacoesGerais;
  if (has(form.status)) d.status = form.status;

  if (has(form.cargaDescricao)) d.carga_descricao = form.cargaDescricao;
  if (has(form.cargaVolumes)) d.carga_volumes = form.cargaVolumes;
  if (has(form.cargaPeso)) d.carga_peso = form.cargaPeso;
  if (has(form.cargaCubagem)) d.carga_cubagem = form.cargaCubagem;
  if (has(form.cargaPallets)) d.carga_pallets = form.cargaPallets;
  if (has(form.cargaValorDeclarado)) d.carga_valor_declarado = form.cargaValorDeclarado;
  if (has(form.cargaRefrigerado)) d.carga_refrigerado = form.cargaRefrigerado;
  if (has(form.cargaAjudante)) d.carga_ajudante = form.cargaAjudante;
  if (has(form.cargaObservacoes)) d.carga_observacoes = form.cargaObservacoes;

  if (has(form.veiculoTipo)) d.veiculo_tipo = form.veiculoTipo;
  if (has(form.veiculoSubcategoria)) d.veiculo_subcategoria = form.veiculoSubcategoria;
  if (has(form.veiculoCarroceria)) d.veiculo_carroceria = form.veiculoCarroceria;

  if (has(form.valorBase)) d.valor_base = form.valorBase;
  if (has(form.pedagio)) d.pedagio = form.pedagio;
  if (has(form.adicionais)) d.adicionais = form.adicionais;
  if (has(form.descontos)) d.descontos = form.descontos;
  if (has(form.valorFinal)) d.valor_final = form.valorFinal;
  if (has(form.custoEstimado)) d.custo_estimado = form.custoEstimado;

  if (form.historico) d.historico = form.historico;

  // Campos não mapeados no OrcamentoForm mas presentes no Orcamento
  // enderecos, carga, veiculo, valores, distancia_rota, frete_sugerido, motivoReprovacao
  if ((form as any).enderecos) (d as any).enderecos = (form as any).enderecos;
  if ((form as any).carga) (d as any).carga = (form as any).carga;
  if ((form as any).veiculo) (d as any).veiculo = (form as any).veiculo;
  if ((form as any).valores) (d as any).valores = (form as any).valores;
  if ((form as any).distancia_rota) (d as any).distancia_rota = (form as any).distancia_rota;
  if ((form as any).frete_sugerido) (d as any).frete_sugerido = (form as any).frete_sugerido;
  if ((form as any).motivoReprovacao) (d as any).motivo_reprovacao = (form as any).motivoReprovacao;

  d.created_at = new Date().toISOString();
  d.updated_at = new Date().toISOString();

  return d;
};

export const toOrcamentoUpdate = (form: Partial<OrcamentoForm>): Record<string, unknown> => {
  const payload = toOrcamentoInsert(form);
  delete payload.created_at;
  delete payload.id;
  payload.updated_at = new Date().toISOString();
  return payload;
};

export const fromOrcamentoRow = (item: OrcamentoRow): OrcamentoForm => ({
  id: item.id,
  numero: item.numero || "",
  cliente: item.cliente || "",
  clienteCnpj: item.cliente_cnpj || item.clienteCnpj || "",
  unidade: item.unidade || "",
  centroCusto: item.centro_custo || item.centroCusto || "",
  responsavel: item.responsavel || "",
  dataEmissao: item.data_emissao || item.dataEmissao,
  validade: item.validade || "",
  tipoOperacao: item.tipo_operacao || item.tipoOperacao,
  modalidade: item.modalidade || "contrato",
  prioridade: item.prioridade || "normal",
  pedidoInterno: item.pedido_interno || item.pedidoInterno,
  observacoesGerais: item.observacoes_gerais || item.observacoesGerais,
  status: item.status || "rascunho",
  cargaDescricao: item.carga_descricao || item.cargaDescricao,
  cargaVolumes: item.carga_volumes ?? item.cargaVolumes ?? 0,
  cargaPeso: item.carga_peso ?? item.cargaPeso ?? 0,
  cargaCubagem: item.carga_cubagem ?? item.cargaCubagem ?? 0,
  cargaPallets: item.carga_pallets ?? item.cargaPallets ?? 0,
  cargaValorDeclarado: item.carga_valor_declarado ?? item.cargaValorDeclarado ?? 0,
  cargaRefrigerado: item.carga_refrigerado ?? item.cargaRefrigerado ?? false,
  cargaAjudante: item.carga_ajudante ?? item.cargaAjudante ?? false,
  cargaObservacoes: item.carga_observacoes || item.cargaObservacoes,
  veiculoTipo: item.veiculo_tipo || item.veiculoTipo,
  veiculoSubcategoria: item.veiculo_subcategoria || item.veiculoSubcategoria,
  veiculoCarroceria: item.veiculo_carroceria || item.veiculoCarroceria,
  valorBase: item.valor_base ?? item.valorBase ?? 0,
  pedagio: item.pedagio ?? item.pedagio ?? 0,
  adicionais: item.adicionais ?? item.adicionais ?? 0,
  descontos: item.descontos ?? item.descontos ?? 0,
  valorFinal: item.valor_final ?? item.valorFinal ?? 0,
  custoEstimado: item.custo_estimado ?? item.custoEstimado ?? 0,
  historico: item.historico || [],
  distancia_rota: (item as any).distancia_rota || undefined,
  frete_sugerido: (item as any).frete_sugerido || undefined,
});

// ---------------- FINANCEIRO (RECEBER) ----------------

export interface ReceberForm {
  id?: string;
  descricao?: string;
  valor?: number;
  clienteId?: string;
  clienteNome?: string;
  clienteDocumento?: string;
  documento?: string;
  serie?: string;
  osVinculadas?: string;
  os_id?: string;
  contratoVinculado?: string;
  propostaVinculada?: string;
  valorBruto?: number;
  desconto?: number;
  juros?: number;
  multa?: number;
  valorLiquido?: number;
  dataEmissao?: string;
  dataVencimento?: string;
  dataPagamento?: string;
  dataRecebimento?: string;
  status?: string;
  formaRecebimento?: string;
  contaFinanceiraId?: string;
  recorrente?: boolean;
  quantidadeParcelas?: number;
  observacoes?: string;
}

export interface ReceberRow {
  id?: string;
  descricao?: string;
  valor?: number;
  cliente_id?: string;
  cliente_nome?: string;
  cliente_documento?: string;
  documento?: string;
  serie?: string;
  os_vinculadas?: string;
  os_id?: string;
  contrato_vinculado?: string;
  proposta_vinculada?: string;
  valor_bruto?: number;
  desconto?: number;
  juros?: number;
  multa?: number;
  valor_liquido?: number;
  data_emissao?: string;
  data_vencimento?: string;
  data_pagamento?: string;
  data_recebimento?: string;
  status?: string;
  forma_recebimento?: string;
  conta_financeira_id?: string;
  recorrente?: boolean;
  quantidade_parcelas?: number;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

export const toReceberInsert = (form: Partial<ReceberForm>): Record<string, unknown> => {
  const d: Record<string, unknown> = {};
  const has = (v: unknown) => v !== undefined && v !== null;

  if (has(form.descricao)) d.descricao = form.descricao;
  if (has(form.valor)) d.valor = form.valor;
  if (has(form.clienteId)) d.cliente_id = form.clienteId;
  if (has(form.clienteNome)) d.cliente_nome = form.clienteNome;
  if (has(form.clienteDocumento)) d.cliente_documento = form.clienteDocumento;
  if (has(form.documento)) d.documento = form.documento;
  if (has(form.serie)) d.serie = form.serie;
  if (has(form.osVinculadas)) d.os_vinculadas = form.osVinculadas;
  if (has(form.os_id)) d.os_id = form.os_id;
  if (has(form.contratoVinculado)) d.contrato_vinculado = form.contratoVinculado;
  if (has(form.propostaVinculada)) d.proposta_vinculada = form.propostaVinculada;
  if (has(form.valorBruto)) d.valor_bruto = form.valorBruto;
  if (has(form.desconto)) d.desconto = form.desconto;
  if (has(form.juros)) d.juros = form.juros;
  if (has(form.multa)) d.multa = form.multa;
  if (has(form.valorLiquido)) d.valor_liquido = form.valorLiquido;
  if (has(form.dataEmissao)) d.data_emissao = form.dataEmissao;
  if (has(form.dataVencimento)) d.data_vencimento = form.dataVencimento;
  if (has(form.dataPagamento)) d.data_pagamento = form.dataPagamento;
  if (has(form.dataRecebimento)) d.data_recebimento = form.dataRecebimento;
  if (has(form.status)) d.status = form.status;
  if (has(form.formaRecebimento)) d.forma_recebimento = form.formaRecebimento;
  if (has(form.contaFinanceiraId)) d.conta_financeira_id = form.contaFinanceiraId;
  if (has(form.recorrente)) d.recorrente = form.recorrente;
  if (has(form.quantidadeParcelas)) d.quantidade_parcelas = form.quantidadeParcelas;
  if (has(form.observacoes)) d.observacoes = form.observacoes;

  d.created_at = new Date().toISOString();
  d.updated_at = new Date().toISOString();

  return d;
};

export const toReceberUpdate = (form: Partial<ReceberForm>): Record<string, unknown> => {
  const payload = toReceberInsert(form);
  delete payload.created_at;
  delete payload.cliente_id;
  payload.updated_at = new Date().toISOString();
  return payload;
};

export const fromReceberRow = (item: ReceberRow): ReceberForm => ({
  id: item.id,
  descricao: item.descricao,
  valor: item.valor ?? 0,
  clienteId: item.cliente_id || item.clienteId,
  clienteNome: item.cliente_nome || item.clienteNome || "",
  clienteDocumento: item.cliente_documento || item.clienteDocumento,
  documento: item.documento || "",
  serie: item.serie,
  osVinculadas: item.os_vinculadas || item.osVinculadas,
  os_id: (item as any).os_id,
  contratoVinculado: item.contrato_vinculado || item.contratoVinculado,
  propostaVinculada: item.proposta_vinculada || item.propostaVinculada,
  valorBruto: item.valor_bruto ?? item.valorBruto ?? 0,
  desconto: item.desconto ?? item.desconto ?? 0,
  juros: item.juros ?? item.juros ?? 0,
  multa: item.multa ?? item.multa ?? 0,
  valorLiquido: item.valor_liquido ?? item.valorLiquido ?? 0,
  dataEmissao: item.data_emissao || item.dataEmissao,
  dataVencimento: item.data_vencimento || item.dataVencimento,
  dataPagamento: item.data_pagamento || item.dataPagamento,
  dataRecebimento: item.data_recebimento || item.dataRecebimento,
  status: item.status || "pendente",
  formaRecebimento: item.forma_recebimento || item.formaRecebimento,
  contaFinanceiraId: item.conta_financeira_id || item.contaFinanceiraId,
  recorrente: item.recorrente ?? item.recorrente ?? false,
  quantidadeParcelas: item.quantidade_parcelas ?? item.quantidadeParcelas,
  observacoes: item.observacoes,
});

// ---------------- FINANCEIRO (PAGAR) ----------------

export interface PagarForm {
  id?: string;
  descricao?: string;
  valor?: number;
  fornecedorId?: string;
  fornecedorNome?: string;
  fornecedorDocumento?: string;
  documento?: string;
  tipoDocumento?: string;
  categoriaId?: string;
  planoContaId?: string;
  centroResultadoId?: string;
  unidadeId?: string;
  valorOriginal?: number;
  juros?: number;
  multa?: number;
  desconto?: number;
  valorFinal?: number;
  dataEmissao?: string;
  dataVencimento?: string;
  dataPagamento?: string;
  contaPagadoraId?: string;
  formaPagamento?: string;
  numeroBoleto?: string;
  codigoBarras?: string;
  status?: string;
  despesaFixa?: boolean;
  recorrente?: boolean;
  quantidadeParcelas?: number;
  contratoVinculado?: string;
  osVinculada?: string;
  os_id?: string;
  prestador?: string;
  observacoes?: string;
}

export interface PagarRow {
  id?: string;
  descricao?: string;
  valor?: number;
  fornecedor_id?: string;
  fornecedor_nome?: string;
  fornecedor_documento?: string;
  documento?: string;
  tipo_documento?: string;
  categoria_id?: string;
  plano_conta_id?: string;
  centro_resultado_id?: string;
  unidade_id?: string;
  valor_original?: number;
  juros?: number;
  multa?: number;
  desconto?: number;
  valor_final?: number;
  data_emissao?: string;
  data_vencimento?: string;
  data_pagamento?: string;
  conta_pagadora_id?: string;
  forma_pagamento?: string;
  numero_boleto?: string;
  codigo_barras?: string;
  status?: string;
  despesa_fixa?: boolean;
  recorrente?: boolean;
  quantidade_parcelas?: number;
  contrato_vinculado?: string;
  os_vinculada?: string;
  os_id?: string;
  prestador?: string;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

export const toPagarInsert = (form: Partial<PagarForm>): Record<string, unknown> => {
  const d: Record<string, unknown> = {};
  const has = (v: unknown) => v !== undefined && v !== null;

  if (has(form.descricao)) d.descricao = form.descricao;
  if (has(form.valor)) d.valor = form.valor;
  if (has(form.fornecedorId)) d.fornecedor_id = form.fornecedorId;
  if (has(form.fornecedorNome)) d.fornecedor_nome = form.fornecedorNome;
  if (has(form.fornecedorDocumento)) d.fornecedor_documento = form.fornecedorDocumento;
  if (has(form.documento)) d.documento = form.documento;
  if (has(form.tipoDocumento)) d.tipo_documento = form.tipoDocumento;
  if (has(form.categoriaId)) d.categoria_id = form.categoriaId;
  if (has(form.planoContaId)) d.plano_conta_id = form.planoContaId;
  if (has(form.centroResultadoId)) d.centro_resultado_id = form.centroResultadoId;
  if (has(form.unidadeId)) d.unidade_id = form.unidadeId;
  if (has(form.valorOriginal)) d.valor_original = form.valorOriginal;
  if (has(form.juros)) d.juros = form.juros;
  if (has(form.multa)) d.multa = form.multa;
  if (has(form.desconto)) d.desconto = form.desconto;
  if (has(form.valorFinal)) d.valor_final = form.valorFinal;
  if (has(form.dataEmissao)) d.data_emissao = form.dataEmissao;
  if (has(form.dataVencimento)) d.data_vencimento = form.dataVencimento;
  if (has(form.dataPagamento)) d.data_pagamento = form.dataPagamento;
  if (has(form.contaPagadoraId)) d.conta_pagadora_id = form.contaPagadoraId;
  if (has(form.formaPagamento)) d.forma_pagamento = form.formaPagamento;
  if (has(form.numeroBoleto)) d.numero_boleto = form.numeroBoleto;
  if (has(form.codigoBarras)) d.codigo_barras = form.codigoBarras;
  if (has(form.status)) d.status = form.status;
  if (has(form.despesaFixa)) d.despesa_fixa = form.despesaFixa;
  if (has(form.recorrente)) d.recorrente = form.recorrente;
  if (has(form.quantidadeParcelas)) d.quantidade_parcelas = form.quantidadeParcelas;
  if (has(form.contratoVinculado)) d.contrato_vinculado = form.contratoVinculado;
  if (has(form.osVinculada)) d.os_vinculada = form.osVinculada;
  if (has(form.os_id)) d.os_id = form.os_id;
  if (has(form.prestador)) d.prestador = form.prestador;
  if (has(form.observacoes)) d.observacoes = form.observacoes;

  d.created_at = new Date().toISOString();
  d.updated_at = new Date().toISOString();

  return d;
};

export const toPagarUpdate = (form: Partial<PagarForm>): Record<string, unknown> => {
  const payload = toPagarInsert(form);
  delete payload.created_at;
  delete payload.fornecedor_id;
  payload.updated_at = new Date().toISOString();
  return payload;
};

export const fromPagarRow = (item: PagarRow): PagarForm => ({
  id: item.id,
  fornecedorId: item.fornecedor_id || item.fornecedorId,
  fornecedorNome: item.fornecedor_nome || item.fornecedorNome || "",
  fornecedorDocumento: item.fornecedor_documento || item.fornecedorDocumento,
  documento: item.documento || "",
  tipoDocumento: item.tipo_documento || item.tipoDocumento,
  categoriaId: item.categoria_id || item.categoriaId,
  planoContaId: item.plano_conta_id || item.planoContaId,
  centroResultadoId: item.centro_resultado_id || item.centroResultadoId,
  unidadeId: item.unidade_id || item.unidadeId,
  valorOriginal: item.valor_original ?? item.valorOriginal ?? 0,
  juros: item.juros ?? item.juros ?? 0,
  multa: item.multa ?? item.multa ?? 0,
  desconto: item.desconto ?? item.desconto ?? 0,
  valorFinal: item.valor_final ?? item.valorFinal ?? 0,
  dataEmissao: item.data_emissao || item.dataEmissao,
  dataVencimento: item.data_vencimento || item.dataVencimento,
  dataPagamento: item.data_pagamento || item.dataPagamento,
  contaPagadoraId: item.conta_pagadora_id || item.contaPagadoraId,
  formaPagamento: item.forma_pagamento || item.formaPagamento,
  numeroBoleto: item.numero_boleto || item.numeroBoleto,
  codigoBarras: item.codigo_barras || item.codigoBarras,
  status: item.status || "pendente",
  despesaFixa: item.despesa_fixa ?? item.despesaFixa ?? false,
  recorrente: item.recorrente ?? item.recorrente ?? false,
  quantidadeParcelas: item.quantidade_parcelas ?? item.quantidadeParcelas,
  contratoVinculado: item.contrato_vinculado || item.contratoVinculado,
  osVinculada: item.os_vinculada || item.osVinculada,
  observacoes: item.observacoes,
});

// ---------------- CONTRATOS ----------------

export interface ContratoForm {
  id?: string;
  modeloId?: string;
  modeloNome?: string;
  prestadorNome?: string;
  clienteNome?: string;
  data?: string;
  status?: string;
  usuario?: string;
}

export interface ContratoRow {
  id?: string;
  modelo_id?: string;
  modelo_nome?: string;
  prestador_nome?: string;
  cliente_nome?: string;
  data?: string;
  status?: string;
  usuario?: string;
  created_at?: string;
  updated_at?: string;
}

export const toContratoInsert = (form: Partial<ContratoForm>): Record<string, unknown> => {
  const d: Record<string, unknown> = {};
  const has = (v: unknown) => v !== undefined && v !== null;

  if (has(form.modeloId)) d.modelo_id = form.modeloId;
  if (has(form.modeloNome)) d.modelo_nome = form.modeloNome;
  if (has(form.prestadorNome)) d.prestador_nome = form.prestadorNome;
  if (has(form.clienteNome)) d.cliente_nome = form.clienteNome;
  if (has(form.data)) d.data = form.data;
  if (has(form.status)) d.status = form.status;
  if (has(form.usuario)) d.usuario = form.usuario;

  d.created_at = new Date().toISOString();
  d.updated_at = new Date().toISOString();

  return d;
};

export const toContratoUpdate = (form: Partial<ContratoForm>): Record<string, unknown> => {
  const payload = toContratoInsert(form);
  delete payload.created_at;
  payload.updated_at = new Date().toISOString();
  return payload;
};

export const fromContratoRow = (item: ContratoRow): ContratoForm => ({
  id: item.id,
  modeloId: item.modelo_id || item.modeloId,
  modeloNome: item.modelo_nome || item.modeloNome,
  prestadorNome: item.prestador_nome || item.prestadorNome,
  clienteNome: item.cliente_nome || item.clienteNome,
  data: item.data || "",
  status: item.status || "Aguardando",
  usuario: item.usuario || "",
});