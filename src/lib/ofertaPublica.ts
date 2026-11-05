export type TipoOferta =
  | "motoboy"
  | "motorista_veiculo_proprio"
  | "disponibilidade_veiculo";

export type CategoriaAtuacao =
  | "motoboy"
  | "motorista_agregado"
  | "motorista"
  | "frotista";

export type CompartimentoMoto = "bau" | "mochila" | "bag" | "sem";
export type BuscaContrato = "fixo" | "esporadico" | "ambos";

export type Modalidade = "esporadica" | "urgente" | "fixa" | "recorrente";

export interface OfertaPublicaDraft {
  tipoOferta: TipoOferta | "";
  categoriaAtuacao: CategoriaAtuacao | "";
  nome: string;
  telefone: string;
  email: string;
  cidade: string;
  uf: string;
  regioes: string[];
  outrasRegioes: string;
  dias: number[];
  horarioInicio: string;
  horarioFim: string;
  modalidades: Modalidade[];
  modalidadesExtras: string[];
  tipoMoto: string;
  marcaMoto: string;
  cilindrada: string;
  possuiBau: boolean;
  compartimento: CompartimentoMoto | "";
  buscaContrato: BuscaContrato | "";
  capacidadeBauLitros: string;
  veiculoCategoria: string;
  veiculoTipo: string;
  carroceria: string;
  veiculoModelo: string;
  veiculoPlaca: string;
  veiculoAno: string;
  caracteristicas: string[];
  marcaRastreador: string;
  capacidadeKg: string;
  capacidadeM3: string;
  comprimentoM: string;
  larguraM: string;
  alturaM: string;
  valorDiaria: string;
  valorKm: string;
  valorSaida: string;
  valorMensal: string;
  valorSemanal: string;
  valorNegociavel: boolean;
  condicoesComerciais: string;
  restricoes: string;
  perfilCarregamento: string;
  faturamentoMensal: string;
  atitudeImprevisto: string;
  valorizaParceria: string;
  tipoOperacaoLogistica: string;
  manutencaoVeiculo: string;
  focoCargaFragil: string;
  posturaDivergencia: string;
  facilidadeTecnologia: string;
  disponibilidadeAltaDemanda: string;
  consumoMedioKmL: string;
  abastecimentoOperacao: string;
  comprometimentoRotaFixa: string;
  mediaParadasDia: string;
  observacoes: string;
  consentimento: boolean;
}

export const TIPOS_OFERTA: Array<{ value: TipoOferta; label: string; descricao: string }> = [
  {
    value: "motoboy",
    label: "Motoboy",
    descricao: "Tenho moto e disponibilidade para entregas.",
  },
  {
    value: "motorista_veiculo_proprio",
    label: "Motorista com veículo próprio",
    descricao: "Tenho veículo e disponibilidade para operar.",
  },
  {
    value: "disponibilidade_veiculo",
    label: "Disponibilidade de veículo",
    descricao: "Tenho veículo disponível para a operação.",
  },
];

export const CATEGORIAS_ATUACAO: Array<{
  value: CategoriaAtuacao;
  label: string;
  descricao: string;
  tipoOferta: Exclude<TipoOferta, "">;
}> = [
  {
    value: "motoboy",
    label: "Motoboy",
    descricao: "Tenho moto e disponibilidade para entregas.",
    tipoOferta: "motoboy",
  },
  {
    value: "motorista_agregado",
    label: "Motorista Agregado",
    descricao: "Tenho carro/furgão/caminhão próprio.",
    tipoOferta: "motorista_veiculo_proprio",
  },
  {
    value: "motorista",
    label: "Motorista",
    descricao: "Não tenho veículo, busco oportunidade para conduzir.",
    tipoOferta: "motorista_veiculo_proprio",
  },
  {
    value: "frotista",
    label: "Frotista / Dono de Veículo",
    descricao: "Tenho veículos disponíveis para a operação.",
    tipoOferta: "disponibilidade_veiculo",
  },
];

export const MODALIDADES: Array<{ value: Modalidade; label: string }> = [
  { value: "esporadica", label: "Esporádica" },
  { value: "urgente", label: "Urgente" },
  { value: "fixa", label: "Fixa" },
  { value: "recorrente", label: "Recorrente" },
];

export const MODALIDADES_EXTRAS = ["Agregado", "Cobertura"] as const;

export const COMPARTIMENTOS_MOTO: Array<{
  value: CompartimentoMoto;
  label: string;
}> = [
  { value: "bau", label: "Baú" },
  { value: "mochila", label: "Mochila" },
  { value: "bag", label: "Bag" },
  { value: "sem", label: "Sem compartimento" },
];

export const BUSCA_CONTRATO_OPCOES: Array<{
  value: BuscaContrato;
  label: string;
}> = [
  { value: "fixo", label: "Contrato fixo" },
  { value: "esporadico", label: "Entregas esporádicas" },
  { value: "ambos", label: "Ambos" },
];

export const ATITUDE_IMPREVISTO_OPCOES = [
  "Aviso imediatamente a base/suporte",
  "Tento resolver sozinho antes de avisar",
  "Sigo a rota e informo apenas no final",
] as const;

export const VALORIZA_PARCERIA_OPCOES = [
  "Roteiros fixos e previsíveis",
  "Volume alto de entregas",
  "Suporte rápido e eficiente",
  "Flexibilidade de horários",
] as const;

export const OPERACAO_OPCOES = [
  "E-commerce / Entregas pulverizadas",
  "Distribuição porta a porta B2B/B2C",
  "Transferência CD para CD / Carga fechada",
  "Viagens longas / Interestadual",
] as const;

export const MANUTENCAO_OPCOES = [
  "Preventiva rigorosa",
  "Faço revisões periódicas",
  "Apenas quando algo quebra",
] as const;

export const CARGA_FRAGIL_OPCOES = [
  "Amarração e segurança total",
  "Chegar o mais rápido possível",
] as const;

export const DIVERGENCIA_ENTREGA_OPCOES = [
  "Contato a base na hora",
  "Tento convencer o cliente",
  "Devolvo a mercadoria e vou embora",
] as const;

export const TECNOLOGIA_OPCOES = [
  "Tenho muita facilidade",
  "Consigo usar o básico",
  "Tenho alguma dificuldade",
] as const;

export const ALTA_DEMANDA_OPCOES = [
  "Gosto de fazer horas extras",
  "Prefiro manter o meu horário fixo",
] as const;

export const ABASTECIMENTO_OPCOES = [
  "Tenho capital próprio",
  "Preciso de adiantamento",
  "Prefiro usar cartão frota da empresa",
] as const;

export const COMPROMETIMENTO_OPCOES = [
  "Cumpro a rota fixa assumida primeiro",
  "Tento fazer as duas correndo o risco de atrasar",
  "Cancelo a fixa e vou para a que paga mais",
] as const;

export const MEDIA_PARADAS_OPCOES = [
  "1 a 10 paradas",
  "11 a 20 paradas",
  "21 a 50 paradas",
  "51 a 100 paradas",
  "Mais de 100 paradas",
] as const;

export const DIAS_SEMANA = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

export const REGIOES = [
  "Grande SP",
  "ABC Paulista",
  "Interior SP",
  "Litoral SP",
  "Rio de Janeiro",
  "Belo Horizonte",
  "Paraná",
  "Santa Catarina",
  "Rio Grande do Sul",
  "Centro-Oeste",
  "Nordeste",
  "Norte",
];

export const REGIOES_POR_UF: Record<string, string[]> = {
  SP: ["Grande SP", "ABC Paulista", "Interior SP", "Litoral SP"],
  RJ: ["Rio de Janeiro", "Baixada Fluminense", "Região dos Lagos", "Sul Fluminense", "Interior RJ"],
  MG: ["Belo Horizonte", "Triângulo Mineiro", "Sul de Minas", "Zona da Mata", "Interior MG"],
  PR: ["Curitiba", "Londrina", "Maringá", "Oeste do Paraná", "Interior PR"],
  SC: ["Florianópolis", "Joinville", "Blumenau", "Oeste de SC", "Interior SC"],
  RS: ["Porto Alegre", "Caxias do Sul", "Pelotas", "Interior RS"],
  BA: ["Salvador", "Feira de Santana", "Interior BA"],
  GO: ["Goiânia", "Entorno do DF", "Interior GO"],
  DF: ["Distrito Federal"],
  PE: ["Recife", "Região Metropolitana do Recife", "Interior PE"],
  CE: ["Fortaleza", "Região Metropolitana de Fortaleza", "Interior CE"],
  ES: ["Vitória", "Região Metropolitana de Vitória", "Interior ES"],
  AM: ["Manaus", "Interior AM"],
  PA: ["Belém", "Região Metropolitana de Belém", "Interior PA"],
};

export function regioesParaUf(uf: string): string[] {
  return REGIOES_POR_UF[String(uf || "").toUpperCase()] ?? REGIOES;
}

const CIDADE_UF_SUGESTOES: Record<string, string> = {
  "sao paulo": "SP",
  "são paulo": "SP",
  campinas: "SP",
  guarulhos: "SP",
  osasco: "SP",
  "santo andre": "SP",
  "santo andré": "SP",
  "sao bernardo do campo": "SP",
  "são bernardo do campo": "SP",
  "rio de janeiro": "RJ",
  niteroi: "RJ",
  "niterói": "RJ",
  "belo horizonte": "MG",
  contagem: "MG",
  "uberlandia": "MG",
  "uberlândia": "MG",
  curitiba: "PR",
  londrina: "PR",
  "florianopolis": "SC",
  "florianópolis": "SC",
  joinville: "SC",
  "porto alegre": "RS",
  "caxias do sul": "RS",
  salvador: "BA",
  recife: "PE",
  fortaleza: "CE",
  brasilia: "DF",
  "brasília": "DF",
  "goiania": "GO",
  "goiânia": "GO",
  manaus: "AM",
  belem: "PA",
  "belém": "PA",
  vitoria: "ES",
  "vitória": "ES",
};

export function sugerirUfPorCidade(cidade: string): string {
  const chave = String(cidade || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  return CIDADE_UF_SUGESTOES[chave] ?? "";
}

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
];

export const TIPOS_VEICULO = [
  "Moto",
  "Veículo de Passeio",
  "Fiorino",
  "Kangoo",
  "Kombi",
  "Van",
  "HR",
  "VUC",
  "3/4",
  "Toco",
  "Truck",
  "Bitruck",
  "Carreta",
  "Bitrem",
  "Outro",
];

export const TIPOS_MOTO = ["Street", "Trail", "Custom", "Scooter", "Outra"];

export const CARROCERIAS = [
  "Baú fechado",
  "Sider",
  "Graneleiro",
  "Grade baixa",
  "Prancha",
  "Tanque",
  "Refrigerado",
  "Porta-container",
  "Outra",
];

export const CARACTERISTICAS = [
  "Baú",
  "Refrigerado",
  "Congelado",
  "Rastreador",
  "Seguro",
  "Ajudante disponível",
  "Empilhadeira não inclusa",
  "Acesso a doca",
];

export const LGPD_TERMO_VERSAO = "2026-11-v1";

export const DISCLAIMER_OFERTA =
  "Oferta comercial de disponibilidade. Não é cadastro no APP, aprovação ou contratação. Este é o primeiro passo para fazer parte da nossa rede.";

export const HORARIO_PADRAO = { inicio: "08:00", fim: "18:00" } as const;

export const MENSAGEM_OFERTA_REGISTRADA =
  "Oferta registrada com sucesso. A equipe da Conexão Express poderá entrar em contato para conhecer melhor sua disponibilidade e as condições de atendimento. O envio desta oferta não representa aprovação, contratação ou liberação de acesso ao APP.";

export const MENSAGEM_ENVIO_PENDENTE =
  "Oferta preenchida. O envio ainda depende da integração segura prevista na ADM-APP-02B.2 (Edge Function/RPC). Nenhum dado foi enviado ou gravado.";

export const MENSAGEM_SEPARACAO =
  "Se você tem mais de um veículo com capacidades, regiões ou condições comerciais diferentes, envie uma oferta separada para cada um.";

export function criarOfertaVazia(): OfertaPublicaDraft {
  return {
    tipoOferta: "",
    categoriaAtuacao: "",
    nome: "",
    telefone: "",
    email: "",
    cidade: "",
    uf: "",
    regioes: [],
    outrasRegioes: "",
    dias: [],
    horarioInicio: "",
    horarioFim: "",
    modalidades: [],
    modalidadesExtras: [],
    tipoMoto: "",
    marcaMoto: "",
    cilindrada: "",
    possuiBau: false,
    compartimento: "",
    buscaContrato: "",
    capacidadeBauLitros: "",
    veiculoCategoria: "",
    veiculoTipo: "",
    carroceria: "",
    veiculoModelo: "",
    veiculoPlaca: "",
    veiculoAno: "",
    caracteristicas: [],
    marcaRastreador: "",
    capacidadeKg: "",
    capacidadeM3: "",
    comprimentoM: "",
    larguraM: "",
    alturaM: "",
    valorDiaria: "",
    valorKm: "",
    valorSaida: "",
    valorMensal: "",
    valorSemanal: "",
    valorNegociavel: false,
    condicoesComerciais: "",
    restricoes: "",
    perfilCarregamento: "",
    faturamentoMensal: "",
    atitudeImprevisto: "",
    valorizaParceria: "",
    tipoOperacaoLogistica: "",
    manutencaoVeiculo: "",
    focoCargaFragil: "",
    posturaDivergencia: "",
    facilidadeTecnologia: "",
    disponibilidadeAltaDemanda: "",
    consumoMedioKmL: "",
    abastecimentoOperacao: "",
    comprometimentoRotaFixa: "",
    mediaParadasDia: "",
    observacoes: "",
    consentimento: false,
  };
}

export function normalizarDigitos(valor: string): string {
  return String(valor || "").replace(/\D/g, "");
}

export function validarTelefone(valor: string): boolean {
  const digitos = normalizarDigitos(valor);
  if (digitos.length !== 10 && digitos.length !== 11) return false;
  const ddd = Number(digitos.slice(0, 2));
  return ddd >= 11 && ddd <= 99;
}

export function validarEmail(valor: string): boolean {
  if (!valor.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim());
}

function numeroPreenchido(valor: string): boolean {
  return String(valor || "").trim() !== "";
}

function valorNumericoInvalido(valor: string): boolean {
  if (!numeroPreenchido(valor)) return false;
  const n = Number(valor);
  return !Number.isFinite(n) || n < 0;
}

function textoRegioes(draft: OfertaPublicaDraft): string[] {
  const outras = draft.outrasRegioes
    .split(/[,;]+/)
    .map((r) => r.trim())
    .filter(Boolean);
  return [...draft.regioes, ...outras];
}

export function validarEtapaOferta(
  etapa: number,
  draft: OfertaPublicaDraft,
): string[] {
  const erros: string[] = [];

  if (etapa === 0) {
    if (!draft.tipoOferta) erros.push("Escolha a categoria de atuação (tipo de oferta).");
    if (draft.nome.trim().length < 3) erros.push("Informe seu nome completo.");
    if (!validarTelefone(draft.telefone)) {
      erros.push("Informe um telefone/WhatsApp válido com DDD.");
    }
    if (!validarEmail(draft.email)) erros.push("Informe um e-mail válido ou deixe em branco.");
  }

  if (etapa === 1) {
    if (draft.cidade.trim().length < 2) erros.push("Informe a cidade.");
    if (!draft.uf) erros.push("Informe a UF.");
    if (textoRegioes(draft).length === 0) {
      erros.push("Selecione ou informe ao menos uma região atendida.");
    }
    if (draft.dias.length === 0) erros.push("Selecione ao menos um dia disponível.");
    const temInicio = Boolean(draft.horarioInicio);
    const temFim = Boolean(draft.horarioFim);
    if (temInicio !== temFim) {
      erros.push("Informe os dois horários ou deixe o horário em branco.");
    } else if (temInicio && draft.horarioFim <= draft.horarioInicio) {
      erros.push("O horário final deve ser maior que o inicial.");
    }
  }

  if (etapa === 2) {
    if (draft.modalidades.length === 0 && draft.modalidadesExtras.length === 0) {
      erros.push("Selecione ao menos uma modalidade de atendimento.");
    }
    if (draft.tipoOferta === "motoboy") {
      if (!draft.veiculoCategoria) erros.push("Informe a categoria do veículo.");
    } else if (draft.categoriaAtuacao !== "motorista") {
      if (!draft.veiculoCategoria) erros.push("Informe a categoria do veículo.");
      if (!draft.veiculoTipo) erros.push("Informe o tipo de veículo.");
      if (!draft.carroceria) erros.push("Informe a carroceria do veículo.");
      if (!draft.veiculoAno.trim()) {
        erros.push("Informe o ano do veículo.");
      } else {
        const ano = Number(draft.veiculoAno);
        if (!Number.isInteger(ano) || ano < 1980 || ano > 2100) {
          erros.push("Informe um ano válido (1980 a 2100).");
        }
      }
    }
  }

  if (etapa === 3) {
    for (const [rotulo, valor] of [
      ["capacidade em kg", draft.capacidadeKg],
      ["capacidade em m³", draft.capacidadeM3],
      ["comprimento", draft.comprimentoM],
      ["largura", draft.larguraM],
      ["altura", draft.alturaM],
      ["diária", draft.valorDiaria],
      ["valor por km", draft.valorKm],
      ["valor de saída", draft.valorSaida],
      ["mensalidade", draft.valorMensal],
      ["valor semanal", draft.valorSemanal],
      ["capacidade do baú", draft.capacidadeBauLitros],
      ["cilindrada", draft.cilindrada],
    ] as const) {
      if (valorNumericoInvalido(valor)) {
        erros.push(`O campo ${rotulo} deve ser um número maior ou igual a zero.`);
      }
    }

    if (!draft.valorNegociavel) {
      const temValor =
        numeroPreenchido(draft.valorDiaria) ||
        numeroPreenchido(draft.valorKm) ||
        numeroPreenchido(draft.valorSaida) ||
        numeroPreenchido(draft.valorMensal) ||
        numeroPreenchido(draft.valorSemanal);
      if (!temValor && !draft.condicoesComerciais.trim()) {
        erros.push(
          "Informe ao menos um valor ou marque “Valor a negociar” e descreva a condição.",
        );
      }
    }
  }

  if (etapa === 4) {
    if (!draft.consentimento) {
      erros.push("É necessário autorizar o uso dos dados para analisar a oferta.");
    }
  }

  return erros;
}

export function validarOferta(draft: OfertaPublicaDraft): string[] {
  return [0, 1, 2, 3, 4].flatMap((etapa) => validarEtapaOferta(etapa, draft));
}

export function montarPayloadOferta(draft: OfertaPublicaDraft): Record<string, unknown> {
  const ehMotoboy = draft.tipoOferta === "motoboy";
  const semVeiculo = draft.categoriaAtuacao === "motorista";
  const numero = (valor: string): number | null =>
    numeroPreenchido(valor) ? Number(valor) : null;

  const modalidadesBase = new Set<Modalidade>(draft.modalidades);
  if (draft.buscaContrato === "fixo" || draft.buscaContrato === "ambos") {
    modalidadesBase.add("fixa");
  }
  if (draft.buscaContrato === "esporadico" || draft.buscaContrato === "ambos") {
    modalidadesBase.add("esporadica");
  }
  if (modalidadesBase.size === 0 && draft.modalidadesExtras.length > 0) {
    modalidadesBase.add("esporadica");
  }

  const caracteristicas = Array.from(
    new Set(
      [
        ...draft.caracteristicas,
        draft.categoriaAtuacao ? `categoria_atuacao:${draft.categoriaAtuacao}` : "",
        ...draft.modalidadesExtras.map((modalidade) => `modalidade_adicional:${modalidade}`),
        draft.compartimento ? `compartimento:${draft.compartimento}` : "",
        draft.buscaContrato ? `busca_contrato:${draft.buscaContrato}` : "",
        ehMotoboy && draft.marcaMoto.trim() ? `marca_moto:${draft.marcaMoto.trim()}` : "",
        ehMotoboy && draft.cilindrada.trim() ? `cilindrada:${draft.cilindrada.trim()}` : "",
        draft.caracteristicas.includes("Rastreador") && draft.marcaRastreador.trim()
          ? `marca_rastreador:${draft.marcaRastreador.trim()}`
          : "",
      ].filter(Boolean),
    ),
  );

  const perfilObservacoes = [
    draft.perfilCarregamento.trim()
      ? `Local principal de carregamento: ${draft.perfilCarregamento.trim()}`
      : "",
    draft.faturamentoMensal.trim()
      ? `Média de faturamento mensal atual: ${draft.faturamentoMensal.trim()}`
      : "",
    draft.valorSemanal.trim() ? `Valor semanal: R$ ${draft.valorSemanal.trim()}` : "",
    draft.atitudeImprevisto.trim()
      ? `Imprevisto/atraso na rota: ${draft.atitudeImprevisto.trim()}`
      : "",
    draft.valorizaParceria.trim()
      ? `O que mais valoriza na parceria: ${draft.valorizaParceria.trim()}`
      : "",
    draft.tipoOperacaoLogistica.trim()
      ? `Operacao: ${draft.tipoOperacaoLogistica.trim()}`
      : "",
    draft.manutencaoVeiculo.trim()
      ? `Manutencao: ${draft.manutencaoVeiculo.trim()}`
      : "",
    draft.focoCargaFragil.trim() ? `Carga: ${draft.focoCargaFragil.trim()}` : "",
    draft.posturaDivergencia.trim()
      ? `Comunicacao: ${draft.posturaDivergencia.trim()}`
      : "",
    draft.facilidadeTecnologia.trim()
      ? `Tecnologia: ${draft.facilidadeTecnologia.trim()}`
      : "",
    draft.disponibilidadeAltaDemanda.trim()
      ? `Disponibilidade: ${draft.disponibilidadeAltaDemanda.trim()}`
      : "",
    draft.consumoMedioKmL.trim() ? `Consumo: ${draft.consumoMedioKmL.trim()}` : "",
    draft.abastecimentoOperacao.trim()
      ? `Abastecimento: ${draft.abastecimentoOperacao.trim()}`
      : "",
    draft.comprometimentoRotaFixa.trim()
      ? `Comprometimento: ${draft.comprometimentoRotaFixa.trim()}`
      : "",
    draft.mediaParadasDia.trim()
      ? `Media de paradas: ${draft.mediaParadasDia.trim()}`
      : "",
  ].filter(Boolean);
  const observacoes = [draft.observacoes.trim(), ...perfilObservacoes]
    .filter(Boolean)
    .join(" | ") || null;
  const condicoesComerciais =
    draft.condicoesComerciais.trim() ||
    (draft.valorSemanal.trim() ? `Valor semanal: R$ ${draft.valorSemanal.trim()}` : "");

  return {
    tipo_oferta: draft.tipoOferta,
    nome: draft.nome.trim(),
    telefone: normalizarDigitos(draft.telefone),
    email: draft.email.trim() || null,
    cidade: draft.cidade.trim(),
    uf: draft.uf,
    regioes: textoRegioes(draft),
    dias_disponiveis: draft.dias,
    horario_inicio: draft.horarioInicio || HORARIO_PADRAO.inicio,
    horario_fim: draft.horarioFim || HORARIO_PADRAO.fim,
    modalidades: Array.from(modalidadesBase),
    veiculo_tipo: ehMotoboy ? "moto" : semVeiculo ? "Outro" : draft.veiculoTipo,
    veiculo_categoria: semVeiculo ? "terceiro" : draft.veiculoCategoria || null,
    carroceria: ehMotoboy ? null : semVeiculo ? "Outra" : draft.carroceria,
    veiculo_modelo: semVeiculo ? null : draft.veiculoModelo.trim() || null,
    veiculo_placa: semVeiculo ? null : draft.veiculoPlaca.trim().toUpperCase() || null,
    veiculo_ano: semVeiculo ? null : numero(draft.veiculoAno),
    tipo_moto: ehMotoboy ? draft.tipoMoto || "Outra" : null,
    possui_bau: ehMotoboy
      ? draft.compartimento
        ? draft.compartimento === "bau"
        : draft.possuiBau
      : null,
    capacidade_bau_litros: ehMotoboy ? numero(draft.capacidadeBauLitros) : null,
    caracteristicas,
    capacidade_kg: semVeiculo ? null : numero(draft.capacidadeKg),
    capacidade_m3: semVeiculo ? null : numero(draft.capacidadeM3),
    dimensoes: {
      comprimento_m: numero(draft.comprimentoM),
      largura_m: numero(draft.larguraM),
      altura_m: numero(draft.alturaM),
    },
    valor_diaria: numero(draft.valorDiaria),
    valor_km: numero(draft.valorKm),
    valor_saida: numero(draft.valorSaida),
    valor_mensal: numero(draft.valorMensal),
    valor_negociavel: draft.valorNegociavel,
    condicoes_comerciais: condicoesComerciais || null,
    restricoes: draft.restricoes.trim() || null,
    observacoes,
    lgpd_consent: draft.consentimento,
    lgpd_termo_versao: LGPD_TERMO_VERSAO,
  };
}

export const CAMINHO_PUBLICO_OFERTAS = "/cadastro-prestador";

export function mensagemConviteOfertas(link: string): string {
  return `Olá! A Conexão Express está recebendo ofertas de motoboys, motoristas e veículos. Se tiver interesse, preencha o formulário: ${link}`;
}

export function obterLinkPublicoOfertas(): string {
  const envUrl = (import.meta.env.VITE_PUBLIC_OFFER_URL as string | undefined)?.trim();
  if (envUrl) return envUrl;
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${CAMINHO_PUBLICO_OFERTAS}`;
  }
  return "https://conexoexpress.app/cadastro-prestador";
}
