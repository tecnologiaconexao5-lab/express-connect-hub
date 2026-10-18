import { supabase } from "@/lib/supabase";
import { centralIaService } from "@/services/centralIaService";
import { gestaoFuncionariosService } from "@/services/ia/gestaoFuncionariosService";

// ==================== TYPES ====================

export type StatusExecucaoMissao = "pendente" | "em_andamento" | "concluida" | "falhou" | "cancelada";
export type PeriodicidadeKPI = "diario" | "semanal" | "quinzenal" | "mensal" | "trimestral" | "semestral" | "anual";
export type TipoAuditoria = "meta" | "kpi" | "score" | "missao_execucao";

export interface IaMissaoExecucao {
  id: string;
  robo_id: string;
  missao_id: string | null;
  titulo: string;
  descricao: string | null;
  status: StatusExecucaoMissao;
  progresso: number;
  resultado: Record<string, unknown>;
  impacto_estimado: string | null;
  planejamento_id: string | null;
  total_acoes: number;
  acoes_concluidas: number;
  inicio: string | null;
  fim: string | null;
  created_at: string;
  updated_at: string;
}

export interface IaKpiRobo {
  id: string;
  robo_id: string;
  nome_kpi: string;
  descricao: string | null;
  formula: string;
  valor_atual: number;
  valor_meta: number;
  unidade: string;
  periodicidade: PeriodicidadeKPI;
  fonte_dados: string | null;
  ultima_atualizacao: string | null;
  ativo: boolean;
}

export interface IaScoreRobo {
  id: string;
  robo_id: string;
  performance_score: number;
  eficiencia_score: number;
  confiabilidade_score: number;
  risco_score: number;
  score_geral: number;
  atualizado_em: string;
}

export interface IaAuditoriaPerformance {
  id: string;
  robo_id: string;
  missao_execucao_id: string | null;
  tipo: TipoAuditoria;
  acao: string;
  descricao: string | null;
  valor_anterior: Record<string, unknown>;
  valor_novo: Record<string, unknown>;
  resultado: string | null;
  impacto: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

function nowISO(): string {
  return new Date().toISOString();
}

// ==================== AUDITORIA (FASE 9) ====================

async function registrarAuditoria(params: {
  robo_id: string;
  missao_execucao_id?: string;
  tipo: TipoAuditoria;
  acao: string;
  descricao?: string;
  valor_anterior?: Record<string, unknown>;
  valor_novo?: Record<string, unknown>;
  resultado?: string;
  impacto?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await supabase.from("ia_auditoria_performance").insert({
    robo_id: params.robo_id,
    missao_execucao_id: params.missao_execucao_id || null,
    tipo: params.tipo,
    acao: params.acao,
    descricao: params.descricao || null,
    valor_anterior: params.valor_anterior || {},
    valor_novo: params.valor_novo || {},
    resultado: params.resultado || null,
    impacto: params.impacto || null,
    metadata: params.metadata || {},
  });
}

// ==================== MISSÕES EXECUÇÃO (FASE 3) ====================

async function criarMissaoExecucao(dados: {
  robo_id: string;
  missao_id?: string;
  titulo: string;
  descricao?: string;
  impacto_estimado?: string;
  total_acoes?: number;
  planejamento_id?: string;
}): Promise<IaMissaoExecucao | null> {
  const { data } = await supabase.from("ia_missoes_execucao").insert({
    robo_id: dados.robo_id,
    missao_id: dados.missao_id || null,
    titulo: dados.titulo,
    descricao: dados.descricao || null,
    status: "pendente",
    progresso: 0,
    impacto_estimado: dados.impacto_estimado || null,
    total_acoes: dados.total_acoes || 0,
    acoes_concluidas: 0,
    planejamento_id: dados.planejamento_id || null,
  }).select().single();

  if (data) {
    void registrarAuditoria({
      robo_id: dados.robo_id, tipo: "missao_execucao", acao: "criada",
      descricao: `Missão criada: ${dados.titulo}`,
      valor_novo: { titulo: dados.titulo, total_acoes: dados.total_acoes },
      resultado: "pendente",
    });
  }
  return data as IaMissaoExecucao | null;
}

async function iniciarMissaoExecucao(id: string): Promise<IaMissaoExecucao | null> {
  const { data: antes } = await supabase.from("ia_missoes_execucao").select("status, progresso").eq("id", id).single();
  const { data } = await supabase.from("ia_missoes_execucao").update({
    status: "em_andamento", inicio: nowISO(), updated_at: nowISO(),
  }).eq("id", id).select().single();

  if (data) {
    void registrarAuditoria({
      robo_id: data.robo_id, missao_execucao_id: id,
      tipo: "missao_execucao", acao: "iniciada",
      valor_anterior: antes || {}, valor_novo: { status: "em_andamento" },
      resultado: "em_andamento",
    });
  }
  return data as IaMissaoExecucao | null;
}

async function atualizarProgressoMissao(id: string, params: {
  progresso: number;
  acoes_concluidas?: number;
  resultado?: Record<string, unknown>;
}): Promise<IaMissaoExecucao | null> {
  const { data: antes } = await supabase.from("ia_missoes_execucao").select("progresso, status, acoes_concluidas").eq("id", id).single();
  const novoProgresso = Math.min(100, Math.max(0, params.progresso));
  const novoStatus: StatusExecucaoMissao = novoProgresso >= 100 ? "concluida" : "em_andamento";

  const { data } = await supabase.from("ia_missoes_execucao").update({
    progresso: novoProgresso,
    status: novoStatus,
    acoes_concluidas: params.acoes_concluidas || (antes ? (antes as Record<string, unknown>).acoes_concluidas as number : 0),
    resultado: params.resultado || {},
    fim: novoStatus === "concluida" ? nowISO() : null,
    updated_at: nowISO(),
  }).eq("id", id).select().single();

  if (data) {
    void registrarAuditoria({
      robo_id: data.robo_id, missao_execucao_id: id,
      tipo: "missao_execucao", acao: "progresso_atualizado",
      valor_anterior: antes || {}, valor_novo: { progresso: novoProgresso, status: novoStatus },
      resultado: novoStatus,
    });

    // Se concluiu, recalcula score
    if (novoStatus === "concluida") {
      void performanceEngineService.recalcularScore(data.robo_id);
    }
  }
  return data as IaMissaoExecucao | null;
}

async function finalizarMissaoExecucao(id: string, params: {
  status: "concluida" | "falhou" | "cancelada";
  resultado?: Record<string, unknown>;
}): Promise<IaMissaoExecucao | null> {
  const { data: antes } = await supabase.from("ia_missoes_execucao").select("status, progresso").eq("id", id).single();
  const { data } = await supabase.from("ia_missoes_execucao").update({
    status: params.status,
    progresso: params.status === "concluida" ? 100 : 0,
    resultado: params.resultado || {},
    fim: nowISO(),
    updated_at: nowISO(),
  }).eq("id", id).select().single();

  if (data) {
    void registrarAuditoria({
      robo_id: data.robo_id, missao_execucao_id: id,
      tipo: "missao_execucao", acao: "finalizada",
      valor_anterior: antes || {}, valor_novo: { status: params.status },
      resultado: params.status,
    });
    void performanceEngineService.recalcularScore(data.robo_id);
  }
  return data as IaMissaoExecucao | null;
}

async function listarMissoesExecucao(filtros?: {
  robo_id?: string; status?: StatusExecucaoMissao; limite?: number;
}): Promise<IaMissaoExecucao[]> {
  let query = supabase.from("ia_missoes_execucao").select("*").order("created_at", { ascending: false });
  if (filtros?.robo_id) query = query.eq("robo_id", filtros.robo_id);
  if (filtros?.status) query = query.eq("status", filtros.status);
  if (filtros?.limite) query = query.limit(filtros.limite);
  const { data } = await query;
  return (data || []) as IaMissaoExecucao[];
}

// ==================== KPIs (FASE 4) ====================

async function criarKpi(dados: {
  robo_id: string;
  nome_kpi: string;
  descricao?: string;
  formula: string;
  valor_meta?: number;
  unidade?: string;
  periodicidade?: PeriodicidadeKPI;
  fonte_dados?: string;
}): Promise<IaKpiRobo | null> {
  const { data } = await supabase.from("ia_kpis_robo").insert({
    robo_id: dados.robo_id, nome_kpi: dados.nome_kpi,
    descricao: dados.descricao || null, formula: dados.formula,
    valor_meta: dados.valor_meta || 100,
    unidade: dados.unidade || "pontos",
    periodicidade: dados.periodicidade || "mensal",
    fonte_dados: dados.fonte_dados || null,
  }).select().single();

  if (data) {
    void registrarAuditoria({
      robo_id: dados.robo_id, tipo: "kpi", acao: "criado",
      descricao: `KPI ${dados.nome_kpi} criado (fórmula: ${dados.formula})`,
      valor_novo: { nome_kpi: dados.nome_kpi, formula: dados.formula },
      resultado: "ativo",
    });
  }
  return data as IaKpiRobo | null;
}

async function atualizarKpi(id: string, params: {
  valor_atual?: number;
  valor_meta?: number;
}): Promise<IaKpiRobo | null> {
  const { data: antes } = await supabase.from("ia_kpis_robo").select("valor_atual, valor_meta").eq("id", id).single();
  const updates: Record<string, unknown> = { ultima_atualizacao: nowISO(), updated_at: nowISO() };
  if (params.valor_atual !== undefined) updates.valor_atual = params.valor_atual;
  if (params.valor_meta !== undefined) updates.valor_meta = params.valor_meta;

  const { data } = await supabase.from("ia_kpis_robo").update(updates).eq("id", id).select().single();
  if (data) {
    void registrarAuditoria({
      robo_id: data.robo_id, tipo: "kpi", acao: "atualizado",
      descricao: `KPI ${data.nome_kpi}: ${antes?.valor_atual} → ${params.valor_atual}`,
      valor_anterior: antes || {}, valor_novo: params,
      resultado: params.valor_atual !== undefined && params.valor_meta !== undefined
        ? `${Math.round((params.valor_atual / params.valor_meta) * 100)}%` : "atualizado",
    });
  }
  return data as IaKpiRobo | null;
}

async function listarKpis(roboId?: string): Promise<IaKpiRobo[]> {
  let query = supabase.from("ia_kpis_robo").select("*").order("nome_kpi");
  if (roboId) query = query.eq("robo_id", roboId);
  const { data } = await query;
  return (data || []) as IaKpiRobo[];
}

// ==================== SCORE (FASE 6) ====================

async function obterScore(roboId: string): Promise<IaScoreRobo | null> {
  const { data } = await supabase.from("ia_score_robo").select("*").eq("robo_id", roboId).maybeSingle();
  return data as IaScoreRobo | null;
}

async function recalcularScore(roboId: string): Promise<IaScoreRobo | null> {
  const desempenho = await gestaoFuncionariosService.calcularDesempenhoRobo(roboId);

  // Performance: baseado em metas atingidas
  const performanceScore = desempenho.metas_atingidas > 0 || desempenho.metas_ativas > 0
    ? Math.round((desempenho.metas_atingidas / Math.max(1, desempenho.metas_atingidas + desempenho.metas_ativas)) * 100)
    : desempenho.desempenho_geral;

  // Eficiência: taxa de conclusão de missões
  const totalMissoes = desempenho.missoes_ativas + desempenho.missoes_concluidas;
  const eficienciaScore = totalMissoes > 0
    ? Math.round((desempenho.missoes_concluidas / totalMissoes) * 100)
    : 50;

  // Confiabilidade: inversamente proporcional a ações bloqueadas pela governança
  const { data: govLogs } = await supabase
    .from("ia_governanca_log")
    .select("decisao")
    .eq("robo_id", roboId)
    .order("created_at", { ascending: false })
    .limit(50);
  const logs = (govLogs || []) as { decisao: string }[];
  const bloqueios = logs.filter(l => l.decisao === "bloqueado").length;
  const confiabilidadeScore = logs.length > 0
    ? Math.round((1 - (bloqueios / logs.length)) * 100)
    : 80;

  // Risco: baseado na tendência
  const riscoBase = desempenho.tendencia_geral === "negativa" ? 60
    : desempenho.tendencia_geral === "positiva" ? 20
    : desempenho.tendencia_geral === "estavel" ? 30
    : 50;
  const riscoScore = Math.min(100, riscoBase + (bloqueios * 5));

  // Score geral: média ponderada (performance 40%, eficiência 25%, confiabilidade 25%, risco 10%)
  const scoreGeral = Math.round(
    (performanceScore * 0.4) + (eficienciaScore * 0.25) + (confiabilidadeScore * 0.25) + ((100 - riscoScore) * 0.1)
  );

  const scoreAtual = await obterScore(roboId);
  const valorAnterior = scoreAtual ? {
    performance_score: scoreAtual.performance_score,
    eficiencia_score: scoreAtual.eficiencia_score,
    confiabilidade_score: scoreAtual.confiabilidade_score,
    risco_score: scoreAtual.risco_score,
    score_geral: scoreAtual.score_geral,
  } : {};

  const { data } = await supabase.from("ia_score_robo").upsert({
    robo_id: roboId,
    performance_score: performanceScore,
    eficiencia_score: eficienciaScore,
    confiabilidade_score: confiabilidadeScore,
    risco_score: riscoScore,
    score_geral: scoreGeral,
    atualizado_em: nowISO(),
  }, { onConflict: "robo_id" }).select().single();

  if (data) {
    void registrarAuditoria({
      robo_id: roboId, tipo: "score", acao: "recalculado",
      descricao: `Score geral: ${scoreGeral} (performance=${performanceScore}, eficiência=${eficienciaScore}, confiabilidade=${confiabilidadeScore}, risco=${riscoScore})`,
      valor_anterior: valorAnterior,
      valor_novo: {
        performance_score: performanceScore, eficiencia_score: eficienciaScore,
        confiabilidade_score: confiabilidadeScore, risco_score: riscoScore,
        score_geral: scoreGeral,
      },
      resultado: `score_${scoreGeral >= 80 ? "excelente" : scoreGeral >= 60 ? "bom" : scoreGeral >= 40 ? "regular" : "critico"}`,
      metadata: {
        metas_atingidas: desempenho.metas_atingidas,
        metas_ativas: desempenho.metas_ativas,
        missoes_concluidas: desempenho.missoes_concluidas,
        missoes_ativas: desempenho.missoes_ativas,
        bloqueios_gov: bloqueios,
        tendencia: desempenho.tendencia_geral,
      },
    });

    void centralIaService.registrarLog({
      robo_id: roboId, acao: "score_recalculado",
      entrada: {},
      saida: { score_geral: scoreGeral, performance_score: performanceScore, eficiencia_score: eficienciaScore },
      status: "info",
    });
  }

  return data as IaScoreRobo | null;
}

async function listarScores(): Promise<(IaScoreRobo & { robo_nome?: string })[]> {
  const { data } = await supabase
    .from("ia_score_robo")
    .select("*, automacoes_robos!inner(nome)")
    .order("score_geral", { ascending: false });
  return (data || []).map((r: Record<string, unknown>) => {
    const robo = r.automacoes_robos as Record<string, unknown> || {};
    return { ...r as IaScoreRobo, robo_nome: robo.nome as string };
  });
}

// ==================== CONTEXTO PARA F34A (FASE 7) ====================

async function montarContextoPerformance(roboId: string): Promise<string> {
  const score = await obterScore(roboId);
  const kpis = await listarKpis(roboId);
  const missoes = await listarMissoesExecucao({ robo_id: roboId, status: "em_andamento" });
  const desempenho = await gestaoFuncionariosService.calcularDesempenhoRobo(roboId);

  const linhas: string[] = [];
  linhas.push("=== DESEMPENHO DO FUNCIONÁRIO DIGITAL ===");

  if (score) {
    linhas.push(`Score geral: ${score.score_geral}/100`);
    linhas.push(`  Performance (metas): ${score.performance_score}/100`);
    linhas.push(`  Eficiência (missões): ${score.eficiencia_score}/100`);
    linhas.push(`  Confiabilidade: ${score.confiabilidade_score}/100`);
    const nivelRisco = score.risco_score >= 70 ? "ALTO" : score.risco_score >= 40 ? "MÉDIO" : "BAIXO";
    linhas.push(`  Risco: ${score.risco_score}/100 (${nivelRisco})`);
    linhas.push(`  Score geral: ${score.score_geral >= 80 ? "EXCELENTE" : score.score_geral >= 60 ? "BOM" : score.score_geral >= 40 ? "REGULAR" : "CRÍTICO"}`);
    linhas.push("");
  }

  if (desempenho) {
    linhas.push(`Metas: ${desempenho.metas_atingidas} atingidas / ${desempenho.metas_ativas} ativas`);
    linhas.push(`Missões: ${desempenho.missoes_concluidas} concluídas / ${desempenho.missoes_ativas} ativas`);
    linhas.push(`Tendência: ${desempenho.tendencia_geral}`);
    linhas.push("");
  }

  if (kpis.length > 0) {
    linhas.push("KPIs atuais:");
    for (const kpi of kpis) {
      const perc = kpi.valor_meta > 0 ? Math.round((kpi.valor_atual / kpi.valor_meta) * 100) : 0;
      linhas.push(`  - ${kpi.nome_kpi}: ${kpi.valor_atual}/${kpi.valor_meta} (${perc}%) ${kpi.unidade}`);
    }
    linhas.push("");
  }

  if (missoes.length > 0) {
    linhas.push("Missões em andamento:");
    for (const m of missoes) {
      linhas.push(`  - ${m.titulo}: ${m.progresso}% (${m.acoes_concluidas}/${m.total_acoes} ações)`);
    }
    linhas.push("");
  }

  if (score) {
    if (score.score_geral < 40) {
      linhas.push("⚠️  PERFORMANCE CRÍTICA — Recomenda-se estratégia conservadora e ações de baixo risco.");
    } else if (score.score_geral < 60) {
      linhas.push("⚠️  PERFORMANCE REGULAR — Recomenda-se cautela e revisão de metas.");
    } else if (score.score_geral >= 80) {
      linhas.push("✅  PERFORMANCE EXCELENTE — Robô pode operar com maior autonomia.");
    }
  }

  return linhas.join("\n");
}

// ==================== CONTEXTO PARA F35 (FASE 8) ====================

async function obterFatoresAjusteGovernanca(roboId: string): Promise<{
  fator_confianca: number;
  nivel_autonomia_sugerido: "reduzida" | "normal" | "elevada";
  alertas: string[];
}> {
  const score = await obterScore(roboId);
  const alertas: string[] = [];

  if (!score) return { fator_confianca: 1.0, nivel_autonomia_sugerido: "normal", alertas: [] };

  // Fator de confiança: 0.0 a 2.0 baseado no score geral e risco
  const fatorBase = score.score_geral / 50;
  const fatorRisco = 1.0 - (score.risco_score / 100);
  const fator = Math.max(0.2, Math.min(2.0, (fatorBase * 0.7 + fatorRisco * 0.3)));

  let nivel: "reduzida" | "normal" | "elevada" = "normal";
  if (score.score_geral < 40 || score.risco_score > 70) {
    nivel = "reduzida";
    alertas.push(`Desempenho crítico (score=${score.score_geral}, risco=${score.risco_score}) — autonomia reduzida`);
  } else if (score.score_geral >= 80 && score.risco_score < 30) {
    nivel = "elevada";
    alertas.push(`Desempenho excelente (score=${score.score_geral}) — autonomia elevada permitida`);
  }

  return { fator_confianca: Math.round(fator * 100) / 100, nivel_autonomia_sugerido: nivel, alertas };
}

// ==================== EXPORTS ====================

export const performanceEngineService = {
  criarMissaoExecucao,
  iniciarMissaoExecucao,
  atualizarProgressoMissao,
  finalizarMissaoExecucao,
  listarMissoesExecucao,
  criarKpi,
  atualizarKpi,
  listarKpis,
  obterScore,
  recalcularScore,
  listarScores,
  montarContextoPerformance,
  obterFatoresAjusteGovernanca,
};
