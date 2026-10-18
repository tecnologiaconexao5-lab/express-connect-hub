import { supabase } from "@/lib/supabase";
import { centralIaService } from "@/services/centralIaService";

// ==================== ENUMS / TYPES ====================
export type PrioridadeMissao = "baixa" | "media" | "alta" | "critica";
export type StatusMissao = "ativa" | "pausada" | "concluida" | "cancelada" | "rascunho";
export type StatusMeta = "ativa" | "pausada" | "atingida" | "nao_atingida" | "cancelada";
export type PeriodicidadeMeta = "diaria" | "semanal" | "quinzenal" | "mensal" | "bimestral" | "trimestral" | "semestral" | "anual";
export type DiaSemana = "domingo" | "segunda" | "terca" | "quarta" | "quinta" | "sexta" | "sabado";
export type TipoAtividadeAgenda = "prospeccao" | "followup" | "email" | "cobranca" | "analise" | "relatorio" | "reuniao" | "treinamento" | "comunicacao" | "outro";

export interface IaMissao {
  id: string;
  robo_id: string;
  nome_missao: string;
  descricao: string | null;
  objetivo_estrategico: string | null;
  prioridade: PrioridadeMissao;
  status: StatusMissao;
  inicio_vigencia: string | null;
  fim_vigencia: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
  robo_nome?: string;
  robo_setor?: string;
}

export interface IaMeta {
  id: string;
  missao_id: string;
  robo_id: string;
  nome_meta: string;
  descricao: string | null;
  tipo: string | null;
  valor_meta: number;
  valor_atual: number;
  unidade: string;
  periodicidade: PeriodicidadeMeta;
  peso: number;
  status: StatusMeta;
  data_referencia_inicio: string | null;
  data_referencia_fim: string | null;
  created_at: string;
  updated_at: string;
  missao_nome?: string;
}

export interface IaIndicador {
  id: string;
  meta_id: string;
  robo_id: string;
  valor_planejado: number;
  valor_realizado: number;
  percentual_atingido: number;
  tendencia: string;
  periodo_referencia: string | null;
  data_apuracao: string;
  observacoes: string | null;
  created_at: string;
  meta_nome?: string;
}

export interface IaAgendaTrabalho {
  id: string;
  robo_id: string;
  dia_semana: DiaSemana;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface IaAgendaAtividade {
  id: string;
  agenda_id: string;
  robo_id: string;
  horario_inicio: string;
  horario_fim: string;
  tipo_atividade: TipoAtividadeAgenda;
  descricao: string;
  prioridade: PrioridadeMissao;
  frequencia: string;
  repeticoes: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface IaLimiteOperacional {
  id: string;
  robo_id: string;
  acao_tipo: string;
  limite_quantidade: number;
  periodo: string;
  horario_permitido_inicio: string;
  horario_permitido_fim: string;
  limite_financeiro: number | null;
  alerta_quando_atingir: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface DesempenhoRobo {
  robo_id: string;
  robo_nome: string;
  missoes_ativas: number;
  missoes_concluidas: number;
  metas_ativas: number;
  metas_atingidas: number;
  desempenho_geral: number;
  tendencia_geral: string;
}

function nowISO(): string {
  return new Date().toISOString();
}

// ==================== MISSÕES ====================
async function listarMissoes(filtros?: { robo_id?: string; status?: StatusMissao }): Promise<IaMissao[]> {
  let query = supabase
    .from("ia_missoes")
    .select("*, automacoes_robos!inner(nome, setor)")
    .order("created_at", { ascending: false });

  if (filtros?.robo_id) query = query.eq("robo_id", filtros.robo_id);
  if (filtros?.status) query = query.eq("status", filtros.status);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((m: Record<string, unknown>) => ({
    ...m,
    robo_nome: (m.automacoes_robos as Record<string, unknown>)?.nome as string || "",
    robo_setor: (m.automacoes_robos as Record<string, unknown>)?.setor as string || "",
  })) as IaMissao[];
}

async function obterMissao(id: string): Promise<IaMissao | null> {
  const { data, error } = await supabase
    .from("ia_missoes")
    .select("*, automacoes_robos!inner(nome, setor)")
    .eq("id", id)
    .single();

  if (error) return null;
  return {
    ...data,
    robo_nome: (data.automacoes_robos as Record<string, unknown>)?.nome as string || "",
    robo_setor: (data.automacoes_robos as Record<string, unknown>)?.setor as string || "",
  } as IaMissao;
}

async function criarMissao(dados: {
  robo_id: string;
  nome_missao: string;
  descricao?: string;
  objetivo_estrategico?: string;
  prioridade?: PrioridadeMissao;
  status?: StatusMissao;
  inicio_vigencia?: string;
  fim_vigencia?: string;
  criado_por?: string;
}): Promise<IaMissao> {
  const { data, error } = await supabase
    .from("ia_missoes")
    .insert({
      robo_id: dados.robo_id,
      nome_missao: dados.nome_missao,
      descricao: dados.descricao || null,
      objetivo_estrategico: dados.objetivo_estrategico || null,
      prioridade: dados.prioridade || "media",
      status: dados.status || "rascunho",
      inicio_vigencia: dados.inicio_vigencia || null,
      fim_vigencia: dados.fim_vigencia || null,
      criado_por: dados.criado_por || null,
    })
    .select()
    .single();

  if (error) throw error;

  await centralIaService.registrarLog({
    tipo: "info",
    origem: "gestaoFuncionariosService",
    acao: "criar_missao",
    detalhes: `Missão criada: ${dados.nome_missao} para robô ${dados.robo_id}`,
    robo_id: dados.robo_id,
  });

  return data as IaMissao;
}

async function atualizarMissao(id: string, dados: Partial<{
  nome_missao: string;
  descricao: string;
  objetivo_estrategico: string;
  prioridade: PrioridadeMissao;
  status: StatusMissao;
  inicio_vigencia: string;
  fim_vigencia: string;
}>): Promise<IaMissao> {
  const { data, error } = await supabase
    .from("ia_missoes")
    .update({ ...dados, updated_at: nowISO() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  await centralIaService.registrarLog({
    tipo: "info",
    origem: "gestaoFuncionariosService",
    acao: "atualizar_missao",
    detalhes: `Missão ${id} atualizada: status=${dados.status || "sem alteração"}`,
    robo_id: data.robo_id,
  });

  return data as IaMissao;
}

async function deletarMissao(id: string): Promise<void> {
  const { error } = await supabase.from("ia_missoes").delete().eq("id", id);
  if (error) throw error;
}

// ==================== METAS ====================
async function listarMetas(filtros?: { missao_id?: string; robo_id?: string; status?: StatusMeta }): Promise<IaMeta[]> {
  let query = supabase
    .from("ia_metas")
    .select("*, ia_missoes!inner(nome_missao)")
    .order("created_at", { ascending: false });

  if (filtros?.missao_id) query = query.eq("missao_id", filtros.missao_id);
  if (filtros?.robo_id) query = query.eq("robo_id", filtros.robo_id);
  if (filtros?.status) query = query.eq("status", filtros.status);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((m: Record<string, unknown>) => ({
    ...m,
    missao_nome: (m.ia_missoes as Record<string, unknown>)?.nome_missao as string || "",
  })) as IaMeta[];
}

async function criarMeta(dados: {
  missao_id: string;
  robo_id: string;
  nome_meta: string;
  descricao?: string;
  tipo?: string;
  valor_meta: number;
  unidade?: string;
  periodicidade?: PeriodicidadeMeta;
  peso?: number;
  data_referencia_inicio?: string;
  data_referencia_fim?: string;
}): Promise<IaMeta> {
  const { data, error } = await supabase
    .from("ia_metas")
    .insert({
      missao_id: dados.missao_id,
      robo_id: dados.robo_id,
      nome_meta: dados.nome_meta,
      descricao: dados.descricao || null,
      tipo: dados.tipo || null,
      valor_meta: dados.valor_meta,
      valor_atual: 0,
      unidade: dados.unidade || "unidades",
      periodicidade: dados.periodicidade || "mensal",
      peso: dados.peso || 1.0,
      status: "ativa",
      data_referencia_inicio: dados.data_referencia_inicio || null,
      data_referencia_fim: dados.data_referencia_fim || null,
    })
    .select()
    .single();

  if (error) throw error;

  await centralIaService.registrarLog({
    tipo: "info",
    origem: "gestaoFuncionariosService",
    acao: "criar_meta",
    detalhes: `Meta criada: ${dados.nome_meta} (${dados.valor_meta} ${dados.unidade || "unidades"})`,
    robo_id: dados.robo_id,
  });

  return data as IaMeta;
}

async function atualizarMeta(id: string, dados: Partial<{
  nome_meta: string;
  descricao: string;
  tipo: string;
  valor_meta: number;
  valor_atual: number;
  unidade: string;
  periodicidade: PeriodicidadeMeta;
  peso: number;
  status: StatusMeta;
  data_referencia_inicio: string;
  data_referencia_fim: string;
}>): Promise<IaMeta> {
  const { data, error } = await supabase
    .from("ia_metas")
    .update({ ...dados, updated_at: nowISO() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data as IaMeta;
}

async function atualizarValorMeta(id: string, valor: number): Promise<IaMeta> {
  const { data: metaAtual, error: errBusca } = await supabase
    .from("ia_metas")
    .select("*")
    .eq("id", id)
    .single();

  if (errBusca) throw errBusca;

  const novoValor = valor;
  const meta = metaAtual as IaMeta;
  let novoStatus: StatusMeta = meta.status;

  if (novoValor >= meta.valor_meta && meta.valor_meta > 0) {
    novoStatus = "atingida";
  }

  const { data, error } = await supabase
    .from("ia_metas")
    .update({
      valor_atual: novoValor,
      status: novoStatus,
      updated_at: nowISO(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  await registrarIndicador({
    meta_id: id,
    robo_id: meta.robo_id,
    valor_planejado: meta.valor_meta,
    valor_realizado: novoValor,
    percentual_atingido: meta.valor_meta > 0 ? Math.round((novoValor / meta.valor_meta) * 100 * 100) / 100 : 0,
    tendencia: novoValor >= meta.valor_meta ? "crescente" : novoValor > 0 ? "estavel" : "decrescente",
    periodo_referencia: meta.periodicidade,
    data_apuracao: new Date().toISOString().split("T")[0],
  });

  return data as IaMeta;
}

async function deletarMeta(id: string): Promise<void> {
  const { error } = await supabase.from("ia_metas").delete().eq("id", id);
  if (error) throw error;
}

// ==================== INDICADORES (KPIs) ====================
async function listarIndicadores(filtros?: { meta_id?: string; robo_id?: string }): Promise<IaIndicador[]> {
  let query = supabase
    .from("ia_indicadores")
    .select("*, ia_metas!inner(nome_meta)")
    .order("data_apuracao", { ascending: false });

  if (filtros?.meta_id) query = query.eq("meta_id", filtros.meta_id);
  if (filtros?.robo_id) query = query.eq("robo_id", filtros.robo_id);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((m: Record<string, unknown>) => ({
    ...m,
    meta_nome: (m.ia_metas as Record<string, unknown>)?.nome_meta as string || "",
  })) as IaIndicador[];
}

async function registrarIndicador(dados: {
  meta_id: string;
  robo_id: string;
  valor_planejado: number;
  valor_realizado: number;
  percentual_atingido: number;
  tendencia?: string;
  periodo_referencia?: string;
  data_apuracao: string;
  observacoes?: string;
}): Promise<IaIndicador> {
  const { data, error } = await supabase
    .from("ia_indicadores")
    .insert({
      meta_id: dados.meta_id,
      robo_id: dados.robo_id,
      valor_planejado: dados.valor_planejado,
      valor_realizado: dados.valor_realizado,
      percentual_atingido: dados.percentual_atingido,
      tendencia: dados.tendencia || "estavel",
      periodo_referencia: dados.periodo_referencia || null,
      data_apuracao: dados.data_apuracao,
      observacoes: dados.observacoes || null,
    })
    .select()
    .single();

  if (error) throw error;

  await supabase.from("ia_historico_indicadores").insert({
    meta_id: dados.meta_id,
    robo_id: dados.robo_id,
    valor_planejado: dados.valor_planejado,
    valor_realizado: dados.valor_realizado,
    percentual_atingido: dados.percentual_atingido,
    tendencia: dados.tendencia || "estavel",
    periodo_referencia: dados.periodo_referencia || null,
    data_apuracao: dados.data_apuracao,
  });

  return data as IaIndicador;
}

async function listarHistoricoIndicadores(filtros?: { meta_id?: string; robo_id?: string; limite?: number }): Promise<IaIndicador[]> {
  let query = supabase
    .from("ia_historico_indicadores")
    .select("*")
    .order("data_apuracao", { ascending: false });

  if (filtros?.meta_id) query = query.eq("meta_id", filtros.meta_id);
  if (filtros?.robo_id) query = query.eq("robo_id", filtros.robo_id);
  if (filtros?.limite) query = query.limit(filtros.limite);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as IaIndicador[];
}

// ==================== AGENDA DE TRABALHO ====================
async function listarAgenda(robo_id: string): Promise<(IaAgendaTrabalho & { atividades: IaAgendaAtividade[] })[]> {
  const { data: dias, error: errDias } = await supabase
    .from("ia_agenda_trabalho")
    .select("*")
    .eq("robo_id", robo_id)
    .order("dia_semana");

  if (errDias) throw errDias;

  const diasComAtividades = await Promise.all(
    (dias || []).map(async (dia: IaAgendaTrabalho) => {
      const { data: atividades } = await supabase
        .from("ia_agenda_atividades")
        .select("*")
        .eq("agenda_id", dia.id)
        .eq("ativo", true)
        .order("horario_inicio");

      return { ...dia, atividades: (atividades || []) as IaAgendaAtividade[] };
    })
  );

  return diasComAtividades;
}

async function criarAgenda(dados: {
  robo_id: string;
  dia_semana: DiaSemana;
  ativo?: boolean;
}): Promise<IaAgendaTrabalho> {
  const { data, error } = await supabase
    .from("ia_agenda_trabalho")
    .insert({
      robo_id: dados.robo_id,
      dia_semana: dados.dia_semana,
      ativo: dados.ativo ?? true,
    })
    .select()
    .single();

  if (error) throw error;
  return data as IaAgendaTrabalho;
}

async function atualizarAgenda(id: string, dados: Partial<{ ativo: boolean }>): Promise<IaAgendaTrabalho> {
  const { data, error } = await supabase
    .from("ia_agenda_trabalho")
    .update({ ...dados, updated_at: nowISO() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as IaAgendaTrabalho;
}

async function deletarAgenda(id: string): Promise<void> {
  const { error } = await supabase.from("ia_agenda_trabalho").delete().eq("id", id);
  if (error) throw error;
}

// ==================== ATIVIDADES DA AGENDA ====================
async function criarAtividade(dados: {
  agenda_id: string;
  robo_id: string;
  horario_inicio: string;
  horario_fim: string;
  tipo_atividade?: TipoAtividadeAgenda;
  descricao: string;
  prioridade?: PrioridadeMissao;
  frequencia?: string;
  repeticoes?: number;
}): Promise<IaAgendaAtividade> {
  const { data, error } = await supabase
    .from("ia_agenda_atividades")
    .insert({
      agenda_id: dados.agenda_id,
      robo_id: dados.robo_id,
      horario_inicio: dados.horario_inicio,
      horario_fim: dados.horario_fim,
      tipo_atividade: dados.tipo_atividade || "outro",
      descricao: dados.descricao,
      prioridade: dados.prioridade || "media",
      frequencia: dados.frequencia || "diario",
      repeticoes: dados.repeticoes || 1,
    })
    .select()
    .single();

  if (error) throw error;
  return data as IaAgendaAtividade;
}

async function atualizarAtividade(id: string, dados: Partial<{
  horario_inicio: string;
  horario_fim: string;
  tipo_atividade: TipoAtividadeAgenda;
  descricao: string;
  prioridade: PrioridadeMissao;
  frequencia: string;
  repeticoes: number;
  ativo: boolean;
}>): Promise<IaAgendaAtividade> {
  const { data, error } = await supabase
    .from("ia_agenda_atividades")
    .update({ ...dados, updated_at: nowISO() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as IaAgendaAtividade;
}

async function deletarAtividade(id: string): Promise<void> {
  const { error } = await supabase.from("ia_agenda_atividades").delete().eq("id", id);
  if (error) throw error;
}

// ==================== LIMITES OPERACIONAIS ====================
async function listarLimites(robo_id?: string): Promise<IaLimiteOperacional[]> {
  let query = supabase
    .from("ia_limites_operacionais")
    .select("*")
    .order("acao_tipo");

  if (robo_id) query = query.eq("robo_id", robo_id);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as IaLimiteOperacional[];
}

async function criarLimite(dados: {
  robo_id: string;
  acao_tipo: string;
  limite_quantidade: number;
  periodo?: string;
  horario_permitido_inicio?: string;
  horario_permitido_fim?: string;
  limite_financeiro?: number;
  alerta_quando_atingir?: number;
}): Promise<IaLimiteOperacional> {
  const { data, error } = await supabase
    .from("ia_limites_operacionais")
    .insert({
      robo_id: dados.robo_id,
      acao_tipo: dados.acao_tipo,
      limite_quantidade: dados.limite_quantidade,
      periodo: dados.periodo || "diario",
      horario_permitido_inicio: dados.horario_permitido_inicio || "00:00:00",
      horario_permitido_fim: dados.horario_permitido_fim || "23:59:59",
      limite_financeiro: dados.limite_financeiro || null,
      alerta_quando_atingir: dados.alerta_quando_atingir ?? 80,
    })
    .select()
    .single();

  if (error) throw error;

  await centralIaService.registrarLog({
    tipo: "info",
    origem: "gestaoFuncionariosService",
    acao: "criar_limite",
    detalhes: `Limite criado: ${dados.acao_tipo} = ${dados.limite_quantidade}/${dados.periodo || "diario"}`,
    robo_id: dados.robo_id,
  });

  return data as IaLimiteOperacional;
}

async function atualizarLimite(id: string, dados: Partial<{
  limite_quantidade: number;
  periodo: string;
  horario_permitido_inicio: string;
  horario_permitido_fim: string;
  limite_financeiro: number;
  alerta_quando_atingir: number;
  ativo: boolean;
}>): Promise<IaLimiteOperacional> {
  const { data, error } = await supabase
    .from("ia_limites_operacionais")
    .update({ ...dados, updated_at: nowISO() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as IaLimiteOperacional;
}

async function deletarLimite(id: string): Promise<void> {
  const { error } = await supabase.from("ia_limites_operacionais").delete().eq("id", id);
  if (error) throw error;
}

// ==================== VALIDAÇÕES ====================
async function validarHorarioPermitido(robo_id: string): Promise<{ permitido: boolean; mensagem: string }> {
  const agora = new Date();
  const diaSemana: DiaSemana[] = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
  const hoje = diaSemana[agora.getDay()];

  const { data: agenda } = await supabase
    .from("ia_agenda_trabalho")
    .select("*, ia_agenda_atividades(*)")
    .eq("robo_id", robo_id)
    .eq("dia_semana", hoje)
    .eq("ativo", true)
    .single();

  if (!agenda) {
    return { permitido: false, mensagem: `Robô não possui agenda para ${hoje}` };
  }

  const atividades = (agenda as Record<string, unknown>).ia_agenda_atividades as IaAgendaAtividade[] || [];
  if (atividades.length === 0) {
    return { permitido: false, mensagem: `Nenhuma atividade agendada para ${hoje}` };
  }

  const horaAtual = agora.getHours() * 60 + agora.getMinutes();

  const atividadeAtiva = atividades.find((a: IaAgendaAtividade) => {
    if (!a.ativo) return false;
    const [hInicio, mInicio] = a.horario_inicio.split(":").map(Number);
    const [hFim, mFim] = a.horario_fim.split(":").map(Number);
    const inicioMin = hInicio * 60 + mInicio;
    const fimMin = hFim * 60 + mFim;
    return horaAtual >= inicioMin && horaAtual <= fimMin;
  });

  if (!atividadeAtiva) {
    return { permitido: false, mensagem: `Fora do horário de trabalho para ${hoje}` };
  }

  return { permitido: true, mensagem: `Dentro do horário: ${atividadeAtiva.descricao}` };
}

async function validarLimitesDiarios(robo_id: string, acao_tipo: string): Promise<{ permitido: boolean; mensagem: string; usado: number; limite: number }> {
  const { data: limites } = await supabase
    .from("ia_limites_operacionais")
    .select("*")
    .eq("robo_id", robo_id)
    .eq("acao_tipo", acao_tipo)
    .eq("ativo", true);

  if (!limites || limites.length === 0) {
    return { permitido: true, mensagem: "Sem limites configurados", usado: 0, limite: Infinity };
  }

  for (const limite of limites as IaLimiteOperacional[]) {
    const hoje = new Date().toISOString().split("T")[0];

    const { count, error } = await supabase
      .from("automacoes_logs")
      .select("*", { count: "exact", head: true })
      .eq("robo_id", robo_id)
      .eq("acao", acao_tipo)
      .gte("created_at", `${hoje}T00:00:00`)
      .lte("created_at", `${hoje}T23:59:59`);

    if (error) throw error;

    const usado = count || 0;
    if (usado >= limite.limite_quantidade) {
      return {
        permitido: false,
        mensagem: `Limite diário atingido para ${acao_tipo}: ${usado}/${limite.limite_quantidade}`,
        usado,
        limite: limite.limite_quantidade,
      };
    }

    if (limite.limite_financeiro) {
      return {
        permitido: true,
        mensagem: `Dentro do limite financeiro de R$ ${limite.limite_financeiro}`,
        usado,
        limite: limite.limite_quantidade,
      };
    }
  }

  return { permitido: true, mensagem: "Dentro dos limites", usado: 0, limite: Infinity };
}

// ==================== CÁLCULO DE DESEMPENHO ====================
async function calcularDesempenhoRobo(robo_id: string): Promise<DesempenhoRobo> {
  const { data: robo } = await supabase
    .from("automacoes_robos")
    .select("nome")
    .eq("id", robo_id)
    .single();

  const nomeRobo = (robo as { nome: string } | null)?.nome || "Desconhecido";

  const { data: missoes } = await supabase
    .from("ia_missoes")
    .select("status")
    .eq("robo_id", robo_id);

  const missoesList = (missoes || []) as { status: string }[];
  const missoesAtivas = missoesList.filter((m) => m.status === "ativa").length;
  const missoesConcluidas = missoesList.filter((m) => m.status === "concluida").length;

  const { data: metas } = await supabase
    .from("ia_metas")
    .select("status, valor_meta, valor_atual, peso")
    .eq("robo_id", robo_id);

  const metasList = (metas || []) as IaMeta[];
  const metasAtivas = metasList.filter((m) => m.status === "ativa").length;
  const metasAtingidas = metasList.filter((m) => m.status === "atingida").length;

  let desempenhoGeral = 0;
  let tendenciaGeral = "estavel";

  if (metasList.length > 0) {
    const totalPeso = metasList.reduce((acc, m) => acc + (m.status === "atingida" ? Number(m.peso) : 0), 0);
    const somaPesos = metasList.reduce((acc, m) => acc + Number(m.peso), 0);
    desempenhoGeral = somaPesos > 0 ? Math.round((totalPeso / somaPesos) * 100 * 100) / 100 : 0;

    const ultimoIndicador = await supabase
      .from("ia_indicadores")
      .select("tendencia")
      .eq("robo_id", robo_id)
      .order("data_apuracao", { ascending: false })
      .limit(1);

    if (ultimoIndicador.data && ultimoIndicador.data.length > 0) {
      tendenciaGeral = (ultimoIndicador.data[0] as IaIndicador).tendencia;
    }
  }

  return {
    robo_id,
    robo_nome: nomeRobo,
    missoes_ativas: missoesAtivas,
    missoes_concluidas: missoesConcluidas,
    metas_ativas: metasAtivas,
    metas_atingidas: metasAtingidas,
    desempenho_geral: desempenhoGeral,
    tendencia_geral: tendenciaGeral,
  };
}

async function listarDesempenhoGeral(): Promise<DesempenhoRobo[]> {
  const { data: robos } = await supabase
    .from("automacoes_robos")
    .select("id, nome")
    .eq("ativo", true);

  if (!robos) return [];

  const resultados = await Promise.all(
    (robos as { id: string; nome: string }[]).map((r) => calcularDesempenhoRobo(r.id))
  );

  return resultados.sort((a, b) => b.desempenho_geral - a.desempenho_geral);
}

// ==================== ALERTAS ====================
async function gerarAlertasDesempenho(): Promise<{
  robo_id: string;
  robo_nome: string;
  desempenho: number;
  alerta: string;
  recomendacao: string;
}[]> {
  const desempenho = await listarDesempenhoGeral();
  const alertas: {
    robo_id: string;
    robo_nome: string;
    desempenho: number;
    alerta: string;
    recomendacao: string;
  }[] = [];

  for (const d of desempenho) {
    if (d.desempenho_geral < 50 && d.metas_ativas > 0) {
      alertas.push({
        robo_id: d.robo_id,
        robo_nome: d.robo_nome,
        desempenho: d.desempenho_geral,
        alerta: `${d.robo_nome} atingiu apenas ${d.desempenho_geral}% das metas.`,
        recomendacao: "Revisar metas, reduzir expectativas ou aumentar recursos disponíveis.",
      });
    } else if (d.desempenho_geral < 80 && d.desempenho_geral >= 50) {
      alertas.push({
        robo_id: d.robo_id,
        robo_nome: d.robo_nome,
        desempenho: d.desempenho_geral,
        alerta: `${d.robo_nome} está com ${d.desempenho_geral}% de aproveitamento.`,
        recomendacao: "Acompanhar de perto e ajustar prioridades se necessário.",
      });
    }
  }

  return alertas;
}

export const gestaoFuncionariosService = {
  listarMissoes,
  obterMissao,
  criarMissao,
  atualizarMissao,
  deletarMissao,
  listarMetas,
  criarMeta,
  atualizarMeta,
  atualizarValorMeta,
  deletarMeta,
  listarIndicadores,
  registrarIndicador,
  listarHistoricoIndicadores,
  listarAgenda,
  criarAgenda,
  atualizarAgenda,
  deletarAgenda,
  criarAtividade,
  atualizarAtividade,
  deletarAtividade,
  listarLimites,
  criarLimite,
  atualizarLimite,
  deletarLimite,
  validarHorarioPermitido,
  validarLimitesDiarios,
  calcularDesempenhoRobo,
  listarDesempenhoGeral,
  gerarAlertasDesempenho,
};
