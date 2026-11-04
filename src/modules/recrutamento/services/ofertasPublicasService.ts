import { supabase } from "@/lib/supabase";

export type OfertaStatus =
  | "nova"
  | "em_analise"
  | "em_contato"
  | "convertida"
  | "descartada"
  | "arquivada"
  | "duplicada";

export type OfertaTipo =
  | "motoboy"
  | "motorista_veiculo_proprio"
  | "disponibilidade_veiculo";

export type OfertaCanalContato = "whatsapp" | "telefone" | "email";

export interface DisponibilidadeInterna {
  dias: number[];
  horarioInicio: string;
  horarioFim: string;
  modalidades: string[];
  atualizadoEm?: string;
  atualizadoPor?: string;
}

export interface OfertaPublica {
  id: string;
  protocolo: string;
  tenantId: string;
  tipoOferta: OfertaTipo;
  status: OfertaStatus;
  revisaoHumana: boolean;
  nome: string;
  cpfCnpj: string;
  telefone: string;
  email: string;
  cidade: string;
  uf: string;
  regioes: string[];
  diasDisponiveis: number[];
  horarioInicio: string;
  horarioFim: string;
  modalidades: string[];
  tipoMoto: string;
  possuiBau: boolean | null;
  capacidadeBauLitros: number | null;
  veiculoCategoria: string;
  veiculoTipo: string;
  carroceria: string;
  veiculoModelo: string;
  veiculoPlaca: string;
  veiculoAno: number | null;
  caracteristicas: string[];
  capacidadeKg: number | null;
  capacidadeM3: number | null;
  dimensoes: Record<string, number | null>;
  valorDiaria: number | null;
  valorKm: number | null;
  valorSaida: number | null;
  valorMensal: number | null;
  valorNegociavel: boolean;
  condicoesComerciais: string;
  restricoes: string;
  observacoes: string;
  origem: string;
  createdAt: string;
  updatedAt: string;
  disponibilidadeInterna: DisponibilidadeInterna;
}

export interface OfertaEvento {
  id: string;
  ofertaId: string;
  tenantId: string;
  tipo: string;
  descricao: string;
  dados: Record<string, unknown>;
  ator: string;
  createdAt: string;
}

export interface OfertaFiltro {
  busca: string;
  status: OfertaStatus | "todas";
  tipoOferta: OfertaTipo | "todos";
  uf: string;
  cidade: string;
  regiao: string;
  modalidade: string;
  dia: string;
  disponibilidade: "todas" | "com_interna" | "sem_interna";
  veiculoTipo: string;
  capacidadeMinKg: string;
  valorMin: string;
  valorMax: string;
}

export interface OfertaIndicadores {
  total: number;
  novas: number;
  emAnalise: number;
  emContato: number;
  convertidas: number;
  descartadas: number;
  arquivadas: number;
  revisaoHumana: number;
}

export const FILTRO_OFERTAS_VAZIO: OfertaFiltro = {
  busca: "",
  status: "todas",
  tipoOferta: "todos",
  uf: "",
  cidade: "",
  regiao: "",
  modalidade: "",
  dia: "",
  disponibilidade: "todas",
  veiculoTipo: "",
  capacidadeMinKg: "",
  valorMin: "",
  valorMax: "",
};

export const STATUS_OFERTA_LABELS: Record<OfertaStatus, string> = {
  nova: "Nova",
  em_analise: "Em análise",
  em_contato: "Em contato",
  convertida: "Convertida",
  descartada: "Descartada",
  arquivada: "Arquivada",
  duplicada: "Duplicada",
};

export const TIPO_OFERTA_LABELS: Record<OfertaTipo, string> = {
  motoboy: "Motoboy",
  motorista_veiculo_proprio: "Motorista com veículo próprio",
  disponibilidade_veiculo: "Disponibilidade de veículo",
};

export const TRANSICOES_STATUS: Record<OfertaStatus, OfertaStatus[]> = {
  nova: ["em_analise", "em_contato", "descartada", "arquivada"],
  em_analise: ["em_contato", "descartada", "arquivada"],
  em_contato: ["descartada", "arquivada"],
  convertida: ["arquivada"],
  descartada: [],
  arquivada: [],
  duplicada: ["arquivada"],
};

export function transicoesPermitidas(status: OfertaStatus): OfertaStatus[] {
  return TRANSICOES_STATUS[status] ?? [];
}

export function podeConverter(oferta: OfertaPublica): boolean {
  return (
    (oferta.status === "em_analise" || oferta.status === "em_contato") &&
    !oferta.revisaoHumana
  );
}

export function contatosDisponiveis(oferta: OfertaPublica): {
  whatsapp: boolean;
  telefone: boolean;
  email: boolean;
} {
  const telefone = oferta.telefone.replace(/\D/g, "");
  return {
    whatsapp: telefone.length >= 10,
    telefone: telefone.length >= 10,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(oferta.email),
  };
}

export function normalizarBusca(valor: string): string {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function texto(valor: unknown): string {
  return String(valor ?? "").trim();
}

function textoOuVazio(valor: unknown): string {
  return texto(valor);
}

function numero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function inteiro(valor: unknown): number | null {
  const n = numero(valor);
  return n !== null && Number.isInteger(n) ? n : null;
}

function booleano(valor: unknown): boolean {
  return valor === true;
}

function listaTexto(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor.map((item) => texto(item)).filter(Boolean);
}

function listaDias(valor: unknown): number[] {
  if (!Array.isArray(valor)) return [];
  const dias = valor
    .map((item) => inteiro(item))
    .filter((item): item is number => item !== null && item >= 0 && item <= 6);
  return Array.from(new Set(dias)).sort((a, b) => a - b);
}

function objeto(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};
  return valor as Record<string, unknown>;
}

function dimensoes(valor: unknown): Record<string, number | null> {
  const raw = objeto(valor);
  return {
    comprimento_m: numero(raw.comprimento_m),
    largura_m: numero(raw.largura_m),
    altura_m: numero(raw.altura_m),
  };
}

function disponibilidadeInterna(valor: unknown): DisponibilidadeInterna {
  const raw = objeto(valor);
  return {
    dias: listaDias(raw.dias),
    horarioInicio: texto(raw.horario_inicio),
    horarioFim: texto(raw.horario_fim),
    modalidades: listaTexto(raw.modalidades),
    atualizadoEm: textoOuVazio(raw.atualizado_em) || undefined,
    atualizadoPor: textoOuVazio(raw.atualizado_por) || undefined,
  };
}

export function fromOfertaRow(row: Record<string, unknown>): OfertaPublica {
  return {
    id: texto(row.id),
    protocolo: texto(row.protocolo),
    tenantId: texto(row.tenant_id),
    tipoOferta: texto(row.tipo_oferta) as OfertaTipo,
    status: (texto(row.status) || "nova") as OfertaStatus,
    revisaoHumana: booleano(row.revisao_humana),
    nome: texto(row.nome),
    cpfCnpj: texto(row.cpf_cnpj),
    telefone: texto(row.telefone),
    email: texto(row.email),
    cidade: texto(row.cidade),
    uf: texto(row.uf),
    regioes: listaTexto(row.regioes),
    diasDisponiveis: listaDias(row.dias_disponiveis),
    horarioInicio: texto(row.horario_inicio),
    horarioFim: texto(row.horario_fim),
    modalidades: listaTexto(row.modalidades),
    tipoMoto: texto(row.tipo_moto),
    possuiBau: row.possui_bau === null || row.possui_bau === undefined ? null : booleano(row.possui_bau),
    capacidadeBauLitros: numero(row.capacidade_bau_litros),
    veiculoCategoria: texto(row.veiculo_categoria),
    veiculoTipo: texto(row.veiculo_tipo),
    carroceria: texto(row.carroceria),
    veiculoModelo: texto(row.veiculo_modelo),
    veiculoPlaca: texto(row.veiculo_placa),
    veiculoAno: inteiro(row.veiculo_ano),
    caracteristicas: listaTexto(row.caracteristicas),
    capacidadeKg: numero(row.capacidade_kg),
    capacidadeM3: numero(row.capacidade_m3),
    dimensoes: dimensoes(row.dimensoes),
    valorDiaria: numero(row.valor_diaria),
    valorKm: numero(row.valor_km),
    valorSaida: numero(row.valor_saida),
    valorMensal: numero(row.valor_mensal),
    valorNegociavel: booleano(row.valor_negociavel),
    condicoesComerciais: texto(row.condicoes_comerciais),
    restricoes: texto(row.restricoes),
    observacoes: texto(row.observacoes),
    origem: texto(row.origem),
    createdAt: texto(row.created_at),
    updatedAt: texto(row.updated_at),
    disponibilidadeInterna: disponibilidadeInterna(row.disponibilidade_interna),
  };
}

export function fromEventoRow(row: Record<string, unknown>): OfertaEvento {
  return {
    id: texto(row.id),
    ofertaId: texto(row.oferta_id),
    tenantId: texto(row.tenant_id),
    tipo: texto(row.tipo),
    descricao: texto(row.descricao),
    dados: objeto(row.dados),
    ator: texto(row.ator),
    createdAt: texto(row.created_at),
  };
}

export function filtrarOfertas(ofertas: OfertaPublica[], filtros: OfertaFiltro): OfertaPublica[] {
  const busca = normalizarBusca(filtros.busca);
  const cidade = normalizarBusca(filtros.cidade);
  const regiao = normalizarBusca(filtros.regiao);
  const veiculo = normalizarBusca(filtros.veiculoTipo);
  const capacidadeMin = numero(filtros.capacidadeMinKg);
  const valorMin = numero(filtros.valorMin);
  const valorMax = numero(filtros.valorMax);
  const diaFiltro = filtros.dia === "" ? null : Number(filtros.dia);

  return ofertas.filter((oferta) => {
    if (busca) {
      const alvo = normalizarBusca(
        [
          oferta.nome,
          oferta.protocolo,
          oferta.email,
          oferta.telefone,
          oferta.telefone.replace(/\D/g, ""),
          oferta.cpfCnpj,
          oferta.cpfCnpj.replace(/\D/g, ""),
          oferta.cidade,
          oferta.uf,
        ].join(" "),
      );
      if (!alvo.includes(busca)) return false;
    }
    if (filtros.status !== "todas" && oferta.status !== filtros.status) return false;
    if (filtros.tipoOferta !== "todos" && oferta.tipoOferta !== filtros.tipoOferta) return false;
    if (filtros.uf && oferta.uf.toUpperCase() !== filtros.uf.toUpperCase()) return false;
    if (cidade && !normalizarBusca(oferta.cidade).includes(cidade)) return false;
    if (regiao && !oferta.regioes.some((r) => normalizarBusca(r).includes(regiao))) return false;
    if (filtros.modalidade && !oferta.modalidades.includes(filtros.modalidade)) return false;
    if (diaFiltro !== null && !oferta.diasDisponiveis.includes(diaFiltro)) return false;
    if (filtros.disponibilidade === "com_interna" && oferta.disponibilidadeInterna.dias.length === 0) {
      return false;
    }
    if (filtros.disponibilidade === "sem_interna" && oferta.disponibilidadeInterna.dias.length > 0) {
      return false;
    }
    if (
      veiculo &&
      !normalizarBusca([oferta.veiculoTipo, oferta.veiculoModelo, oferta.carroceria].join(" ")).includes(veiculo)
    ) {
      return false;
    }
    if (capacidadeMin !== null) {
      const capacidades = [oferta.capacidadeKg, oferta.capacidadeBauLitros].filter(
        (valor): valor is number => valor !== null,
      );
      if (capacidades.length === 0 || !capacidades.some((valor) => valor >= capacidadeMin)) return false;
    }
    if (valorMin !== null || valorMax !== null) {
      const valores = [oferta.valorDiaria, oferta.valorKm, oferta.valorSaida, oferta.valorMensal].filter(
        (valor): valor is number => valor !== null,
      );
      if (valores.length === 0) return false;
      if (valorMin !== null && !valores.some((valor) => valor >= valorMin)) return false;
      if (valorMax !== null && !valores.some((valor) => valor <= valorMax)) return false;
    }
    return true;
  });
}

export function calcularIndicadores(ofertas: OfertaPublica[]): OfertaIndicadores {
  return {
    total: ofertas.length,
    novas: ofertas.filter((o) => o.status === "nova").length,
    emAnalise: ofertas.filter((o) => o.status === "em_analise").length,
    emContato: ofertas.filter((o) => o.status === "em_contato").length,
    convertidas: ofertas.filter((o) => o.status === "convertida").length,
    descartadas: ofertas.filter((o) => o.status === "descartada").length,
    arquivadas: ofertas.filter((o) => o.status === "arquivada").length,
    revisaoHumana: ofertas.filter((o) => o.revisaoHumana).length,
  };
}

export type ResultadoLista =
  | { ok: true; ofertas: OfertaPublica[] }
  | { ok: false; erro: string; backendIndisponivel: boolean };

export type ResultadoEventos =
  | { ok: true; eventos: OfertaEvento[] }
  | { ok: false; erro: string; backendIndisponivel: boolean };

export type ResultadoAcao =
  | { ok: true; dados: Record<string, unknown> }
  | { ok: false; erro: string; codigo?: string; backendIndisponivel: boolean };

export interface EntradaDisponibilidade {
  dias: number[];
  horarioInicio: string;
  horarioFim: string;
  modalidades: string[];
}

function backendIndisponivel(erro: string, codigo?: string): boolean {
  const mensagem = normalizarBusca(erro);
  return (
    codigo === "42P01" ||
    codigo === "PGRST205" ||
    codigo === "PGRST204" ||
    mensagem.includes("does not exist") ||
    mensagem.includes("could not find the table") ||
    mensagem.includes("schema cache")
  );
}

function mensagemErro(error: { message?: string; code?: string; details?: string } | null): string {
  if (!error) return "Não foi possível concluir a operação.";
  return error.message || error.details || "Não foi possível concluir a operação.";
}

function falha(error: { message?: string; code?: string; details?: string } | null): ResultadoAcao {
  const erro = mensagemErro(error);
  return {
    ok: false,
    erro,
    codigo: error?.code,
    backendIndisponivel: backendIndisponivel(erro, error?.code),
  };
}

function falhaLista(
  error: { message?: string; code?: string; details?: string } | null,
): ResultadoLista {
  const erro = mensagemErro(error);
  return {
    ok: false,
    erro,
    backendIndisponivel: backendIndisponivel(erro, error?.code),
  };
}

export const ofertasPublicasService = {
  async listarOfertas(filtros: OfertaFiltro = FILTRO_OFERTAS_VAZIO): Promise<ResultadoLista> {
    try {
      const { data, error } = await supabase
        .from("recrutamento_ofertas")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) return falhaLista(error);
      const ofertas = (data ?? []).map((row) => fromOfertaRow(row as Record<string, unknown>));
      return { ok: true, ofertas: filtrarOfertas(ofertas, filtros) };
    } catch (error) {
      return falhaLista(error as { message?: string; code?: string; details?: string });
    }
  },

  async buscarOferta(id: string): Promise<OfertaPublica | null> {
    if (!id) return null;
    const { data, error } = await supabase
      .from("recrutamento_ofertas")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return fromOfertaRow(data as Record<string, unknown>);
  },

  async listarEventos(ofertaId: string): Promise<ResultadoEventos> {
    try {
      const { data, error } = await supabase
        .from("recrutamento_oferta_eventos")
        .select("*")
        .eq("oferta_id", ofertaId)
        .order("created_at", { ascending: true });
      if (error) {
        const erro = mensagemErro(error);
        return { ok: false, erro, backendIndisponivel: backendIndisponivel(erro, error.code) };
      }
      return {
        ok: true,
        eventos: (data ?? []).map((row) => fromEventoRow(row as Record<string, unknown>)),
      };
    } catch (error) {
      const err = error as { message?: string; code?: string; details?: string };
      const erro = mensagemErro(err);
      return { ok: false, erro, backendIndisponivel: backendIndisponivel(erro, err.code) };
    }
  },

  async atualizarStatus(id: string, status: OfertaStatus, motivo?: string): Promise<ResultadoAcao> {
    const { data, error } = await supabase.rpc("f_atualizar_status_oferta", {
      p_oferta_id: id,
      p_novo_status: status,
      p_motivo: motivo ?? null,
    });
    if (error) return falha(error);
    return { ok: true, dados: objeto(data) };
  },

  async registrarObservacao(id: string, textoObservacao: string): Promise<ResultadoAcao> {
    const { data, error } = await supabase.rpc("f_registrar_observacao_oferta", {
      p_oferta_id: id,
      p_texto: textoObservacao,
    });
    if (error) return falha(error);
    return { ok: true, dados: objeto(data) };
  },

  async atualizarDisponibilidade(
    id: string,
    entrada: EntradaDisponibilidade,
  ): Promise<ResultadoAcao> {
    const { data, error } = await supabase.rpc("f_atualizar_disponibilidade_oferta", {
      p_oferta_id: id,
      p_dias: entrada.dias,
      p_horario_inicio: entrada.horarioInicio || null,
      p_horario_fim: entrada.horarioFim || null,
      p_modalidades: entrada.modalidades,
    });
    if (error) return falha(error);
    return { ok: true, dados: objeto(data) };
  },

  async registrarContato(
    id: string,
    canal: OfertaCanalContato,
    observacao?: string,
  ): Promise<ResultadoAcao> {
    const { data, error } = await supabase.rpc("f_registrar_contato_oferta", {
      p_oferta_id: id,
      p_canal: canal,
      p_observacao: observacao ?? null,
    });
    if (error) return falha(error);
    return { ok: true, dados: objeto(data) };
  },

  async resolverRevisao(id: string, observacao?: string): Promise<ResultadoAcao> {
    const { data, error } = await supabase.rpc("f_resolver_revisao_oferta", {
      p_oferta_id: id,
      p_observacao: observacao ?? null,
    });
    if (error) return falha(error);
    return { ok: true, dados: objeto(data) };
  },

  async converterEmCandidato(id: string): Promise<ResultadoAcao> {
    const { data, error } = await supabase.rpc("f_converter_oferta_em_candidato", {
      p_oferta_id: id,
    });
    if (error) return falha(error);
    return { ok: true, dados: objeto(data) };
  },
};

const MENSAGENS_ERRO_OFERTA: Record<string, string> = {
  candidato_duplicado_existente:
    "Já existe um candidato com este telefone/e-mail vinculado a outra oferta. Revise manualmente antes de converter.",
  revisao_humana_pendente:
    "Resolva a revisão humana de conflito antes de converter esta oferta.",
  status_invalido_para_conversao:
    "A oferta precisa estar em análise ou em contato para ser convertida.",
  conversao_inconsistente:
    "A oferta está marcada como convertida, mas o candidato vinculado não foi encontrado. Revise manualmente.",
  contato_indisponivel: "Este canal de contato não possui dados na oferta.",
  transicao_status_invalida: "Esta transição de status não é permitida.",
  status_inalterado: "A oferta já está neste status.",
  oferta_nao_encontrada: "Oferta não encontrada neste tenant.",
};

export function mensagemErroOferta(codigo: string | undefined, mensagem: string): string {
  if (codigo === "42501") return "Sem permissão para alterar esta oferta.";
  if (codigo === "42901") return "Muitas solicitações. Aguarde um minuto e tente novamente.";
  if (MENSAGENS_ERRO_OFERTA[mensagem]) return MENSAGENS_ERRO_OFERTA[mensagem];
  return mensagem || "Não foi possível concluir a operação.";
}
