export type TipoOferta =
  | "motoboy"
  | "motorista_veiculo_proprio"
  | "disponibilidade_veiculo";

export type Modalidade = "esporadica" | "urgente" | "fixa" | "recorrente";

export interface OfertaPublicaDraft {
  tipoOferta: TipoOferta | "";
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
  tipoMoto: string;
  possuiBau: boolean;
  capacidadeBauLitros: string;
  veiculoCategoria: string;
  veiculoTipo: string;
  carroceria: string;
  veiculoModelo: string;
  veiculoPlaca: string;
  veiculoAno: string;
  caracteristicas: string[];
  capacidadeKg: string;
  capacidadeM3: string;
  comprimentoM: string;
  larguraM: string;
  alturaM: string;
  valorDiaria: string;
  valorKm: string;
  valorSaida: string;
  valorMensal: string;
  valorNegociavel: boolean;
  condicoesComerciais: string;
  restricoes: string;
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

export const MODALIDADES: Array<{ value: Modalidade; label: string }> = [
  { value: "esporadica", label: "Esporádica" },
  { value: "urgente", label: "Urgente" },
  { value: "fixa", label: "Fixa" },
  { value: "recorrente", label: "Recorrente" },
];

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

export const MENSAGEM_OFERTA_REGISTRADA =
  "Oferta registrada com sucesso. A equipe da Conexão Express poderá entrar em contato para conhecer melhor sua disponibilidade e as condições de atendimento. O envio desta oferta não representa aprovação, contratação ou liberação de acesso ao APP.";

export const MENSAGEM_ENVIO_PENDENTE =
  "Oferta preenchida. O envio ainda depende da integração segura prevista na ADM-APP-02B.2 (Edge Function/RPC). Nenhum dado foi enviado ou gravado.";

export const MENSAGEM_SEPARACAO =
  "Se você tem mais de um veículo com capacidades, regiões ou condições comerciais diferentes, envie uma oferta separada para cada um.";

export function criarOfertaVazia(): OfertaPublicaDraft {
  return {
    tipoOferta: "",
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
    tipoMoto: "",
    possuiBau: false,
    capacidadeBauLitros: "",
    veiculoCategoria: "",
    veiculoTipo: "",
    carroceria: "",
    veiculoModelo: "",
    veiculoPlaca: "",
    veiculoAno: "",
    caracteristicas: [],
    capacidadeKg: "",
    capacidadeM3: "",
    comprimentoM: "",
    larguraM: "",
    alturaM: "",
    valorDiaria: "",
    valorKm: "",
    valorSaida: "",
    valorMensal: "",
    valorNegociavel: false,
    condicoesComerciais: "",
    restricoes: "",
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
    if (!draft.tipoOferta) erros.push("Escolha o tipo de oferta.");
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
    if (!draft.horarioInicio || !draft.horarioFim) {
      erros.push("Informe o horário de início e fim.");
    } else if (draft.horarioFim <= draft.horarioInicio) {
      erros.push("O horário final deve ser maior que o inicial.");
    }
  }

  if (etapa === 2) {
    if (draft.modalidades.length === 0) {
      erros.push("Selecione ao menos uma modalidade de atendimento.");
    }
    if (draft.tipoOferta === "motoboy") {
      if (!draft.tipoMoto) erros.push("Informe o tipo de moto.");
    } else {
      if (!draft.veiculoCategoria) erros.push("Informe a categoria do veículo.");
      if (!draft.veiculoTipo) erros.push("Informe o tipo de veículo.");
      if (!draft.carroceria) erros.push("Informe a carroceria do veículo.");
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
      ["capacidade do baú", draft.capacidadeBauLitros],
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
        numeroPreenchido(draft.valorMensal);
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
  const numero = (valor: string): number | null =>
    numeroPreenchido(valor) ? Number(valor) : null;

  return {
    tipo_oferta: draft.tipoOferta,
    nome: draft.nome.trim(),
    telefone: normalizarDigitos(draft.telefone),
    email: draft.email.trim() || null,
    cidade: draft.cidade.trim(),
    uf: draft.uf,
    regioes: textoRegioes(draft),
    dias_disponiveis: draft.dias,
    horario_inicio: draft.horarioInicio,
    horario_fim: draft.horarioFim,
    modalidades: draft.modalidades,
    veiculo_tipo: ehMotoboy ? "moto" : draft.veiculoTipo,
    veiculo_categoria: draft.veiculoCategoria || null,
    carroceria: ehMotoboy ? null : draft.carroceria,
    veiculo_modelo: draft.veiculoModelo.trim() || null,
    veiculo_placa: draft.veiculoPlaca.trim().toUpperCase() || null,
    veiculo_ano: numero(draft.veiculoAno),
    tipo_moto: ehMotoboy ? draft.tipoMoto || null : null,
    possui_bau: ehMotoboy ? draft.possuiBau : null,
    capacidade_bau_litros: numero(draft.capacidadeBauLitros),
    caracteristicas: draft.caracteristicas,
    capacidade_kg: numero(draft.capacidadeKg),
    capacidade_m3: numero(draft.capacidadeM3),
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
    condicoes_comerciais: draft.condicoesComerciais.trim() || null,
    restricoes: draft.restricoes.trim() || null,
    observacoes: draft.observacoes.trim() || null,
    lgpd_consent: draft.consentimento,
    lgpd_termo_versao: LGPD_TERMO_VERSAO,
  };
}

export const CAMINHO_PUBLICO_OFERTAS = "/cadastro-prestador";

export function obterLinkPublicoOfertas(): string {
  const envUrl = (import.meta.env.VITE_PUBLIC_OFFER_URL as string | undefined)?.trim();
  if (envUrl) return envUrl;
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${CAMINHO_PUBLICO_OFERTAS}`;
  }
  return "https://conexoexpress.app/cadastro-prestador";
}
