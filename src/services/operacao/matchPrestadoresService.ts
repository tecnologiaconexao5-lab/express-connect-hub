// ============================================================
// FASE 6 — MOTOR DE MATCH INTELIGENTE (Talent Intelligence)
// Nível 1: requisitos eliminatórios (Item 10.5)
// Nível 2: score ponderado com os pesos exatos da especificação
//   20% proximidade da retirada
//   15% região de entrega
//   15% disponibilidade/janela
//   20% reputação operacional
//   10% experiência com o tipo de operação
//   10% preferência de modalidade
//   10% compatibilidade de rota/deslocamento
// A IA apenas sugere; a alocação é sempre uma ação humana.
// ============================================================
import { supabase } from "@/lib/supabase";
import {
  calcularCategoriaPerformance,
  type CategoriaPerformance,
} from "@/lib/performancePrestador";

export interface MatchOSContext {
  tipoVeiculo?: string | null;
  pesoKg?: number | null;
  cubagemM3?: number | null;
  temperatura?: string | null;
  tipoCarga?: string | null;
  cidadeColeta?: string | null;
  ufColeta?: string | null;
  cidadeEntrega?: string | null;
  ufEntrega?: string | null;
  data?: string | null;
  janelaInicio?: string | null;
  janelaFim?: string | null;
  modalidade?: string | null;
  tipoOperacao?: string | null;
}

export interface VeiculoMatchInput {
  id?: string;
  tipo_veiculo?: string | null;
  tipo?: string | null;
  placa?: string | null;
  capacidade_kg?: number | null;
  capacidade_m3?: number | null;
  tipo_carga?: string | null;
  status?: string | null;
  principal?: boolean | null;
  modelo?: string | null;
  marca?: string | null;
  ano?: number | null;
}

export interface DocumentoMatchInput {
  tipo?: string | null;
  status?: string | null;
  data_vencimento?: string | null;
  validade?: string | null;
}

export interface PerfilTalentoMatchInput {
  modalidade_preferencial?: string[] | null;
  distancia_max_coleta_km?: number | null;
  aceita_viagens?: boolean | null;
  restricoes_operacionais?: Record<string, unknown> | null;
  status_disponibilidade?: "disponivel" | "indisponivel" | "em_operacao" | null;
}

export interface DisponibilidadeMatchInput {
  dia_semana?: number | null;
  hora_inicio?: string | null;
  hora_fim?: string | null;
  disponivel?: boolean | null;
}

export interface PrestadorMatchInput {
  id: string;
  nome: string;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  status?: string | null;
  cidade?: string | null;
  bairro?: string | null;
  uf?: string | null;
  foto?: string | null;
  dataCadastro?: string | null;
  regiaoPrincipal?: string | null;
  regioesSecundarias?: string[] | null;
  scoreInterno?: number | null;
  avaliacaoOperacional?: number | null;
  indiceAceite?: number | null;
  indiceComparecimento?: number | null;
  indiceEntregaNoPrazo?: number | null;
  qtdOperacoes?: number | null;
  ocorrencias?: number;
  aceitaRefrigerado?: boolean | null;
  veiculos: VeiculoMatchInput[];
  documentos: DocumentoMatchInput[];
  perfil?: PerfilTalentoMatchInput | null;
  disponibilidade: DisponibilidadeMatchInput[];
}

export interface ScoreDetalhesMatch {
  proximidade: number;
  regiaoEntrega: number;
  disponibilidade: number;
  reputacao: number;
  experiencia: number;
  modalidade: number;
  rota: number;
}

export interface SugestaoMatch {
  prestadorId: string;
  nome: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  regiao?: string;
  cidade?: string;
  uf?: string;
  veiculo?: {
    placa?: string;
    tipo?: string;
    capacidadeKg?: number;
    capacidadeM3?: number;
    modelo?: string;
  };
  compatibilidade: number;
  categoriaPerformance: CategoriaPerformance;
  performanceScore: number | null;
  motivos: string[];
  detalhes: ScoreDetalhesMatch;
}

export interface ResultadoMatch {
  sugestoes: SugestaoMatch[];
  eliminados: Array<{ prestadorId: string; nome: string; motivo: string }>;
}

const normalizar = (valor?: string | null): string =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const clamp = (valor: number): number => Math.max(0, Math.min(100, Math.round(valor)));

const ALIAS_VEICULO: Array<[string, string]> = [
  ["moto", "moto"],
  ["motocicleta", "moto"],
  ["passeio", "passeio"],
  ["carro", "passeio"],
  ["fiorino", "fiorino"],
  ["kangoo", "fiorino"],
  ["utilitario", "fiorino"],
  ["kombi", "kombi"],
  ["hr", "hr"],
  ["van", "van"],
  ["vuc", "vuc"],
  ["3/4", "tres_quartos"],
  ["tres quartos", "tres_quartos"],
  ["toco", "toco"],
  ["truck", "truck"],
  ["caminhao", "truck"],
  ["bitruck", "truck"],
  ["carreta", "carreta"],
  ["bitrem", "carreta"],
];

export function chaveVeiculoMatch(valor?: string | null): string {
  const v = normalizar(valor);
  if (!v) return "";
  for (const [alias, chave] of ALIAS_VEICULO) {
    if (v.includes(alias)) return chave;
  }
  return v;
}

const DOCS_OBRIGATORIOS = [
  { chave: "cnh", label: "CNH" },
  { chave: "crlv", label: "CRLV" },
  { chave: "comprovante de residencia", label: "Comprovante de Residência" },
  { chave: "foto", label: "Foto do Veículo" },
];

const STATUS_DOC_OK = new Set([
  "aprovado",
  "valido",
  "ok",
  "concluido",
  "vigente",
  "ativo",
]);

function documentoRegular(doc: DocumentoMatchInput): boolean {
  const status = normalizar(doc.status);
  // Legado sem status: não penaliza (a migração Fase 7 passa a preencher).
  if (!status) return true;
  if (!STATUS_DOC_OK.has(status)) return false;
  const validade = String(doc.data_vencimento || doc.validade || "").trim();
  if (!validade) return true;
  const data = new Date(validade);
  if (Number.isNaN(data.getTime())) return true;
  return data.getTime() >= Date.now();
}

function validarDocumentacao(documentos: DocumentoMatchInput[]): string | null {
  if (!Array.isArray(documentos) || documentos.length === 0) {
    return "Documentação obrigatória não cadastrada";
  }
  for (const obrigatorio of DOCS_OBRIGATORIOS) {
    const doc = documentos.find((d) => normalizar(d.tipo).includes(obrigatorio.chave));
    if (!doc) return `Documentação ${obrigatorio.label} ausente`;
    if (!documentoRegular(doc)) return `Documentação ${obrigatorio.label} pendente/irregular`;
  }
  return null;
}

function horarioValido(valor?: string | null): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(valor || ""));
  if (!m) return "";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function validarDisponibilidade(
  ctx: MatchOSContext,
  disponibilidade: DisponibilidadeMatchInput[],
): string | null {
  const janelas = (disponibilidade || []).filter(
    (d) => d && d.disponivel !== false && horarioValido(d.hora_inicio) && horarioValido(d.hora_fim),
  );
  if (janelas.length === 0) return null; // sem declaração = não confirmado (não elimina)

  const data = String(ctx.data || "").trim();
  const inicio = horarioValido(ctx.janelaInicio);
  const fim = horarioValido(ctx.janelaFim);

  if (data) {
    const d = new Date(`${data}T12:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    const dia = d.getDay();
    const doDia = janelas.filter((j) => Number(j.dia_semana) === dia);
    if (doDia.length === 0) return "Indisponível no dia da OS";
    if (inicio && fim) {
      const cobre = doDia.some(
        (j) => horarioValido(j.hora_inicio) < fim && horarioValido(j.hora_fim) > inicio,
      );
      if (!cobre) return "Janela de horário incompatível com a OS";
    }
    return null;
  }

  if (inicio && fim) {
    const cobre = janelas.some(
      (j) => horarioValido(j.hora_inicio) < fim && horarioValido(j.hora_fim) > inicio,
    );
    if (!cobre) return "Janela de horário incompatível com a OS";
  }
  return null;
}

function pontuarProximidade(ctx: MatchOSContext, p: PrestadorMatchInput): number {
  const cidade = normalizar(ctx.cidadeColeta);
  const uf = normalizar(ctx.ufColeta);
  const cidadeP = normalizar(p.cidade);
  const ufP = normalizar(p.uf);
  const regiao = normalizar(`${p.regiaoPrincipal || ""} ${(p.regioesSecundarias || []).join(" ")}`);

  if (cidade && cidadeP && cidade === cidadeP) return 100;
  if (cidade && regiao.includes(cidade)) return 90;
  if (uf && ufP && uf === ufP) return 60;
  if (uf && regiao.includes(uf)) return 65;
  if (regiao && /todas|brasil|nacional/.test(regiao)) return 55;
  return 20;
}

function pontuarRegiaoEntrega(ctx: MatchOSContext, p: PrestadorMatchInput): number {
  const cidade = normalizar(ctx.cidadeEntrega);
  const uf = normalizar(ctx.ufEntrega);
  const cidadeP = normalizar(p.cidade);
  const ufP = normalizar(p.uf);
  const regiao = normalizar(`${p.regiaoPrincipal || ""} ${(p.regioesSecundarias || []).join(" ")}`);

  if (!cidade && !uf) return 50;
  if (cidade && cidade === cidadeP) return 100;
  if (cidade && regiao.includes(cidade)) return 90;
  if (uf && uf === ufP) return 65;
  if (uf && regiao.includes(uf)) return 70;
  if (/todas|brasil|nacional/.test(regiao)) return 55;
  return 20;
}

function janelasQueCobrem(
  ctx: MatchOSContext,
  disponibilidade: DisponibilidadeMatchInput[],
): number {
  const janelas = (disponibilidade || []).filter(
    (d) => d && d.disponivel !== false && horarioValido(d.hora_inicio) && horarioValido(d.hora_fim),
  );
  if (janelas.length === 0) return 35;

  const data = String(ctx.data || "").trim();
  const inicio = horarioValido(ctx.janelaInicio);
  const fim = horarioValido(ctx.janelaFim);
  let candidatas = janelas;

  if (data) {
    const d = new Date(`${data}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      candidatas = janelas.filter((j) => Number(j.dia_semana) === d.getDay());
    }
  }
  if (candidatas.length === 0) return 20;
  if (!inicio || !fim) return 70;

  const cobrem = candidatas.some(
    (j) => horarioValido(j.hora_inicio) <= inicio && horarioValido(j.hora_fim) >= fim,
  );
  if (cobrem) return 100;
  const sobrepoe = candidatas.some(
    (j) => horarioValido(j.hora_inicio) < fim && horarioValido(j.hora_fim) > inicio,
  );
  return sobrepoe ? 75 : 20;
}

function pontuarReputacao(p: PrestadorMatchInput): number {
  const score = Number(p.scoreInterno || 0);
  const scorePct = score > 0 ? (score <= 5 ? score * 20 : score) : 0;
  const valores = [
    scorePct,
    Number(p.indiceAceite || 0),
    Number(p.indiceComparecimento || 0),
    Number(p.indiceEntregaNoPrazo || 0),
    Number(p.avaliacaoOperacional || 0) * (Number(p.avaliacaoOperacional || 0) <= 5 ? 20 : 1),
  ].filter((v) => Number.isFinite(v) && v > 0);
  const base = valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : 50;
  return clamp(base - Number(p.ocorrencias || 0) * 5);
}

function pontuarExperiencia(p: PrestadorMatchInput): number {
  const qtd = Math.min(100, Number(p.qtdOperacoes || 0) * 2);
  const prazo = clamp(Number(p.indiceEntregaNoPrazo || 0));
  return clamp((qtd + prazo) / 2);
}

function pontuarModalidade(ctx: MatchOSContext, p: PrestadorMatchInput): number {
  const modalidades = (p.perfil?.modalidade_preferencial || []).map((m) => normalizar(m));
  if (modalidades.length === 0) return 50;
  const alvo = normalizar(ctx.modalidade || "esporadico");
  return modalidades.includes(alvo) ? 100 : 25;
}

function pontuarRota(ctx: MatchOSContext, p: PrestadorMatchInput, proximidade: number): number {
  const distanciaMax = Number(p.perfil?.distancia_max_coleta_km || 0);
  if (distanciaMax <= 0) return proximidade >= 80 ? 75 : 50;
  if (proximidade >= 80) return 100;
  if (proximidade >= 60) return 75;
  return 40;
}

function veiculoCompativel(ctx: MatchOSContext, p: PrestadorMatchInput): VeiculoMatchInput | null {
  const ativos = (p.veiculos || []).filter(
    (v) => !["inativo", "manutencao", "bloqueado"].includes(normalizar(v.status)),
  );
  if (ativos.length === 0) return null;

  const alvo = chaveVeiculoMatch(ctx.tipoVeiculo);
  const principal = ativos.find((v) => v.principal) || ativos[0];

  if (!alvo) return principal;

  const compativel = ativos.find((v) => chaveVeiculoMatch(v.tipo_veiculo || v.tipo) === alvo);
  return compativel || null;
}

/**
 * Nível 1 + Nível 2 do motor de match.
 * Retorna a lista ranqueada e os eliminados (para auditoria/transparência).
 */
export function calcularMatchPrestadores(
  ctx: MatchOSContext,
  prestadores: PrestadorMatchInput[],
): ResultadoMatch {
  const sugestoes: SugestaoMatch[] = [];
  const eliminados: ResultadoMatch["eliminados"] = [];

  for (const p of prestadores) {
    const eliminar = (motivo: string) => {
      eliminados.push({ prestadorId: p.id, nome: p.nome, motivo });
    };

    if (["inativo", "bloqueado", "reprovado"].includes(normalizar(p.status))) {
      eliminar("Prestador inativo/bloqueado");
      continue;
    }

    const veiculo = veiculoCompativel(ctx, p);
    if (!veiculo) {
      eliminar("Veículo incompatível ou sem veículo ativo");
      continue;
    }

    const capacidadeKg = Number(veiculo.capacidade_kg || 0);
    const capacidadeM3 = Number(veiculo.capacidade_m3 || 0);
    if (Number(ctx.pesoKg || 0) > 0 && capacidadeKg > 0 && capacidadeKg < Number(ctx.pesoKg)) {
      eliminar(`Peso ${ctx.pesoKg}kg acima da capacidade (${capacidadeKg}kg)`);
      continue;
    }
    if (Number(ctx.cubagemM3 || 0) > 0 && capacidadeM3 > 0 && capacidadeM3 < Number(ctx.cubagemM3)) {
      eliminar(`Volume ${ctx.cubagemM3}m³ acima da capacidade (${capacidadeM3}m³)`);
      continue;
    }

    const temperatura = normalizar(ctx.temperatura || ctx.tipoCarga);
    const exigeFrio = /refriger|congelad|misto|isoterm/.test(temperatura);
    if (exigeFrio) {
      const veiculoFrio = /refriger|congelad|isoterm/.test(normalizar(veiculo.tipo_carga));
      const perfilFrio =
        p.aceitaRefrigerado === true ||
        p.perfil?.restricoes_operacionais?.aceita_refrigerado === true ||
        p.perfil?.restricoes_operacionais?.aceita_refrigerada === true;
      if (!veiculoFrio && !perfilFrio) {
        eliminar("Temperatura/carga refrigerada incompatível");
        continue;
      }
    }

    const docProblema = validarDocumentacao(p.documentos);
    if (docProblema) {
      eliminar(docProblema);
      continue;
    }

    const dispProblema = validarDisponibilidade(ctx, p.disponibilidade);
    if (dispProblema) {
      eliminar(dispProblema);
      continue;
    }

    const proximidade = pontuarProximidade(ctx, p);
    const regiaoEntrega = pontuarRegiaoEntrega(ctx, p);
    const disponibilidade = janelasQueCobrem(ctx, p.disponibilidade);
    const reputacao = pontuarReputacao(p);
    const experiencia = pontuarExperiencia(p);
    const modalidade = pontuarModalidade(ctx, p);
    const rota = pontuarRota(ctx, p, proximidade);

    const detalhes: ScoreDetalhesMatch = {
      proximidade,
      regiaoEntrega,
      disponibilidade,
      reputacao,
      experiencia,
      modalidade,
      rota,
    };

    const compatibilidade = clamp(
      proximidade * 0.2 +
        regiaoEntrega * 0.15 +
        disponibilidade * 0.15 +
        reputacao * 0.2 +
        experiencia * 0.1 +
        modalidade * 0.1 +
        rota * 0.1,
    );

    const performance = calcularCategoriaPerformance({
      totalEntregas: p.qtdOperacoes,
      pontualidade: p.indiceEntregaNoPrazo,
      ocorrencias: p.ocorrencias,
      isCandidato: false,
    });

    const motivos: string[] = ["Veículo adequado", "Documentação Ok"];
    if (proximidade >= 70) motivos.push("Próximo da coleta");
    if (regiaoEntrega >= 70) motivos.push("Atende a região de entrega");
    if (disponibilidade >= 70) motivos.push("Disponível na janela da OS");
    if (reputacao >= 70) motivos.push("Boa reputação operacional");
    if (experiencia >= 70) motivos.push("Experiência compatível");
    if (modalidade >= 70) motivos.push("Aceita a modalidade");
    if (rota >= 70) motivos.push("Rota/deslocamento compatível");
    if (capacidadeKg > 0) motivos.push(`Capacidade ${capacidadeKg}kg`);

    sugestoes.push({
      prestadorId: p.id,
      nome: p.nome,
      telefone: p.telefone || undefined,
      whatsapp: p.whatsapp || undefined,
      email: p.email || undefined,
      regiao: p.regiaoPrincipal || undefined,
      cidade: p.cidade || undefined,
      uf: p.uf || undefined,
      veiculo: {
        placa: veiculo.placa || undefined,
        tipo: veiculo.tipo_veiculo || veiculo.tipo || undefined,
        capacidadeKg: capacidadeKg || undefined,
        capacidadeM3: capacidadeM3 || undefined,
        modelo: veiculo.modelo || undefined,
      },
      compatibilidade,
      categoriaPerformance: performance.categoria,
      performanceScore: performance.score,
      motivos,
      detalhes,
    });
  }

  sugestoes.sort((a, b) => b.compatibilidade - a.compatibilidade);
  return { sugestoes, eliminados };
}

interface PrestadorRowMatch {
  id: string;
  nome_completo?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  status?: string | null;
  regiao_principal?: string | null;
  regioes_secundarias?: string[] | null;
  foto?: string | null;
  data_cadastro?: string | null;
  endereco?: { cidade?: string | null; bairro?: string | null; estado?: string | null; uf?: string | null } | null;
  score_interno?: number | null;
  avaliacao_operacional?: number | null;
  indice_aceite?: number | null;
  indice_comparecimento?: number | null;
  indice_entrega_prazo?: number | null;
  qtd_operacoes?: number | null;
  aceita_refrigerado?: boolean | null;
  aceita_refrigerada?: boolean | null;
}

interface VeiculoRowMatch {
  prestador_vinculado?: string | null;
  tipo_veiculo?: string | null;
  tipo?: string | null;
  placa?: string | null;
  capacidade_kg?: number | null;
  capacidade_m3?: number | null;
  tipo_carga?: string | null;
  status?: string | null;
  principal?: boolean | null;
  modelo?: string | null;
  marca?: string | null;
  ano?: number | null;
}

/**
 * Carrega a base oficial (prestadores + veículos + perfil + disponibilidade +
 * documentação + ocorrências) e devolve o shape do motor de match.
 */
export async function carregarPrestadoresBase(
  limite = 200,
  incluirEmAnalise = false,
): Promise<PrestadorMatchInput[]> {
  const statusPermitidos = incluirEmAnalise
    ? ["ativo", "aprovado", "agregado", "reserva", "em_analise", "analise"]
    : ["ativo", "aprovado", "agregado", "reserva"];
  const { data: prestadoresData, error } = await supabase
    .from("prestadores")
    .select(
      "id, nome_completo, telefone, whatsapp, email, status, regiao_principal, regioes_secundarias, endereco, foto, data_cadastro, score_interno, avaliacao_operacional, indice_aceite, indice_comparecimento, indice_entrega_prazo, qtd_operacoes, aceita_refrigerado, aceita_refrigerada",
    )
    .in("status", statusPermitidos)
    .order("score_interno", { ascending: false })
    .limit(limite);
  if (error) throw error;

  const rows = (prestadoresData as unknown as PrestadorRowMatch[]) || [];
  const ids = rows.map((p) => p.id);
  if (ids.length === 0) return [];

  const [veiculosRes, perfisRes, disponibilidadeRes, documentosRes, ocorrenciasRes] =
    await Promise.all([
      supabase
        .from("veiculos")
        .select(
          "id, prestador_vinculado, tipo_veiculo, tipo, placa, capacidade_kg, capacidade_m3, tipo_carga, status, principal, modelo, marca, ano",
        )
        .in("prestador_vinculado", ids)
        .limit(1000),
      supabase
        .from("prestador_perfil_talento")
        .select("prestador_id, modalidade_preferencial, distancia_max_coleta_km, aceita_viagens, restricoes_operacionais, status_disponibilidade")
        .in("prestador_id", ids),
      supabase
        .from("prestador_disponibilidade")
        .select("prestador_id, dia_semana, hora_inicio, hora_fim, disponivel")
        .in("prestador_id", ids),
      supabase.from("documentos_prestadores").select("*").in("prestador_id", ids),
      supabase.from("ocorrencias").select("prestador_id").in("prestador_id", ids),
    ]);

  type RowWithPrestador = Record<string, unknown> & { prestador_id?: string | null };
  const agrupar = <T extends RowWithPrestador>(
    rows: unknown,
  ): Map<string, T[]> => {
    const map = new Map<string, T[]>();
    for (const item of (rows as T[]) || []) {
      const id = String(item.prestador_id || "");
      if (!id) continue;
      const lista = map.get(id) || [];
      lista.push(item);
      map.set(id, lista);
    }
    return map;
  };

  const veiculosPor = agrupar<RowWithPrestador>(veiculosRes.data);
  const perfisPor = new Map<string, PerfilTalentoMatchInput>();
  for (const item of (perfisRes.data as unknown as RowWithPrestador[]) || []) {
    if (item.prestador_id) perfisPor.set(String(item.prestador_id), item as unknown as PerfilTalentoMatchInput);
  }
  const disponibilidadePor = agrupar<RowWithPrestador>(disponibilidadeRes.data);
  const documentosPor = agrupar<RowWithPrestador>(documentosRes.data);

  const ocorrenciasPor = new Map<string, number>();
  for (const item of (ocorrenciasRes.data as Array<{ prestador_id?: string | null }>) || []) {
    const id = String(item.prestador_id || "");
    if (id) ocorrenciasPor.set(id, (ocorrenciasPor.get(id) || 0) + 1);
  }

  return rows.map((p) => {
    const veiculos = (veiculosPor.get(p.id) as unknown as VeiculoRowMatch[]) || [];
    const endereco = p.endereco || {};
    return {
      id: p.id,
      nome: p.nome_completo || "Prestador sem nome",
      telefone: p.telefone,
      whatsapp: p.whatsapp,
      email: p.email,
      status: p.status,
      cidade: endereco.cidade || null,
      bairro: endereco.bairro || null,
      uf: endereco.estado || endereco.uf || null,
      foto: p.foto,
      dataCadastro: p.data_cadastro,
      regiaoPrincipal: p.regiao_principal,
      regioesSecundarias: Array.isArray(p.regioes_secundarias) ? p.regioes_secundarias : [],
      scoreInterno: p.score_interno,
      avaliacaoOperacional: p.avaliacao_operacional,
      indiceAceite: p.indice_aceite,
      indiceComparecimento: p.indice_comparecimento,
      indiceEntregaNoPrazo: p.indice_entrega_prazo,
      qtdOperacoes: p.qtd_operacoes,
      ocorrencias: ocorrenciasPor.get(p.id) || 0,
      aceitaRefrigerado: p.aceita_refrigerado ?? p.aceita_refrigerada,
      veiculos: veiculos.map((v) => ({
        id: String((v as Record<string, unknown>).id || ""),
        tipo_veiculo: v.tipo_veiculo,
        tipo: v.tipo,
        placa: v.placa,
        capacidade_kg: v.capacidade_kg,
        capacidade_m3: v.capacidade_m3,
        tipo_carga: v.tipo_carga,
        status: v.status,
        principal: v.principal,
        modelo: v.modelo,
        marca: v.marca,
        ano: v.ano,
      })),
      documentos: ((documentosPor.get(p.id) as unknown as DocumentoMatchInput[]) || []).map((d) => ({
        tipo: d.tipo,
        status: d.status,
        data_vencimento: d.data_vencimento,
        validade: d.validade,
      })),
      perfil: perfisPor.get(p.id) || null,
      disponibilidade: ((disponibilidadePor.get(p.id) as unknown as DisponibilidadeMatchInput[]) || []).map(
        (d) => ({
          dia_semana: d.dia_semana,
          hora_inicio: d.hora_inicio,
          hora_fim: d.hora_fim,
          disponivel: d.disponivel,
        }),
      ),
    };
  });
}

export async function buscarSugestoesPrestadores(
  ctx: MatchOSContext,
  limite = 10,
): Promise<ResultadoMatch> {
  const prestadores = await carregarPrestadoresBase();
  const resultado = calcularMatchPrestadores(ctx, prestadores);
  return {
    sugestoes: resultado.sugestoes.slice(0, limite),
    eliminados: resultado.eliminados,
  };
}
