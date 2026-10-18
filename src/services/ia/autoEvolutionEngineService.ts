import { supabase } from "@/lib/supabase";
import { centralIaService } from "@/services/centralIaService";
import { governancaService } from "@/services/ia/governancaService";

export type TipoEventoAprendizado = "execucao" | "erro" | "bloqueio" | "sucesso" | "decisao" | "performance" | "insight" | "fluxo";
export type StatusInsight = "novo" | "analisado" | "aprovado" | "rejeitado";
export type StatusSugestao = "pendente" | "aprovado" | "rejeitado" | "aplicado";
export type TipoSugestao = "fluxo" | "regra" | "kpi" | "prompt" | "ferramenta";
export type TipoVersao = "fluxo" | "regra" | "prompt" | "kpi";

export interface IaAprendizadoEvento {
  id: string;
  robo_id: string | null;
  entidade_tipo: string | null;
  entidade_id: string | null;
  tipo_evento: TipoEventoAprendizado;
  origem: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface IaInsightAutomatico {
  id: string;
  contexto: string | null;
  insight_texto: string;
  impacto_estimado: string | null;
  prioridade: string;
  status: StatusInsight;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface IaSugestaoMelhoria {
  id: string;
  tipo: TipoSugestao;
  descricao: string;
  origem_insight_id: string | null;
  impacto_estimado: string | null;
  status: StatusSugestao;
  governanca_aprovacao_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface IaVersaoSistema {
  id: string;
  tipo: TipoVersao;
  entidade_id: string | null;
  versao: number;
  snapshot: Record<string, unknown>;
  ativo: boolean;
  sugerido_por: string | null;
  aprovado_por: string | null;
  created_at: string;
}

function nowISO(): string {
  return new Date().toISOString();
}

function uuid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const autoEvolutionEngineService = {

  // ==================== FASE 2: REGISTRAR EVENTO ====================

  async registrarEvento(params: {
    robo_id?: string;
    entidade_tipo?: string;
    entidade_id?: string;
    tipo_evento: TipoEventoAprendizado;
    origem: string;
    payload: Record<string, unknown>;
  }): Promise<IaAprendizadoEvento | null> {
    const { data } = await supabase.from("ia_aprendizado_eventos").insert({
      robo_id: params.robo_id || null,
      entidade_tipo: params.entidade_tipo || null,
      entidade_id: params.entidade_id || null,
      tipo_evento: params.tipo_evento,
      origem: params.origem,
      payload: params.payload,
    }).select().single();
    return data as IaAprendizadoEvento | null;
  },

  // ==================== FASE 3: GERAR INSIGHT ====================

  async gerarInsight(params: {
    entidade_id: string;
    contexto?: string;
  }): Promise<IaInsightAutomatico | null> {
    const { entidade_id, contexto } = params;

    // Busca eventos recentes da entidade
    const { data: eventos } = await supabase
      .from("ia_aprendizado_eventos")
      .select("*")
      .eq("entidade_id", entidade_id)
      .order("created_at", { ascending: false })
      .limit(50);
    const evts = (eventos || []) as IaAprendizadoEvento[];

    if (evts.length === 0) {
      return null;
    }

    // Análise de padrões
    const totalEventos = evts.length;
    const erros = evts.filter(e => e.tipo_evento === "erro" || e.tipo_evento === "bloqueio").length;
    const sucessos = evts.filter(e => e.tipo_evento === "sucesso").length;
    const taxaErro = totalEventos > 0 ? Math.round((erros / totalEventos) * 100) : 0;
    const taxaSucesso = totalEventos > 0 ? Math.round((sucessos / totalEventos) * 100) : 0;

    // Busca dados de performance
    const { data: fluxos } = await supabase
      .from("ia_fluxos_execucao_log")
      .select("status, duracao_ms, fluxo_codigo")
      .eq("fluxo_execucao_id", entidade_id)
      .limit(20);

    const { data: score } = await supabase
      .from("ia_score_robo")
      .select("score_geral, performance_score, risco_score")
      .eq("robo_id", entidade_id)
      .maybeSingle();

    // Gera insight baseado nos padrões
    const linhas: string[] = [];
    linhas.push(`Análise de ${totalEventos} eventos.`);

    if (taxaErro > 50) {
      linhas.push(`Taxa de erro elevada: ${taxaErro}% — necessita revisão.`);
    }
    if (taxaSucesso > 80) {
      linhas.push(`Taxa de sucesso alta: ${taxaSucesso}% — desempenho estável.`);
    }

    if (score) {
      linhas.push(`Score geral: ${score.score_geral}/100. Performance: ${score.performance_score}/100. Risco: ${score.risco_score}/100.`);
      if (score.score_geral < 40) {
        linhas.push("⚠️ Performance crítica — recomenda-se intervenção.");
      } else if (score.score_geral >= 80) {
        linhas.push("✅ Performance excelente — pode operar com maior autonomia.");
      }
    }

    if (fluxos && fluxos.length > 0) {
      const lentos = (fluxos as { status: string; duracao_ms: number; fluxo_codigo: string }[])
        .filter(f => f.duracao_ms > 5000);
      if (lentos.length > 0) {
        linhas.push(`Fluxos lentos detectados: ${lentos.length} execuções acima de 5s.`);
      }
    }

    // Calcula prioridade
    let prioridade = "baixa";
    if (taxaErro > 70 || (score && score.score_geral < 30)) prioridade = "critica";
    else if (taxaErro > 40 || (score && score.score_geral < 50)) prioridade = "alta";
    else if (taxaErro > 20 || (score && score.score_geral < 70)) prioridade = "media";

    const insightTexto = linhas.join(" ");
    const impacto = score && score.score_geral < 50 ? "Potencial de melhoria de 20-40 pontos no score" : "Estabilidade operacional";

    const { data } = await supabase.from("ia_insights_automaticos").insert({
      contexto: contexto || `Entidade ${entidade_id}`,
      insight_texto: insightTexto,
      impacto_estimado: impacto,
      prioridade,
      status: "novo",
      metadata: { total_eventos: totalEventos, taxa_erro: taxaErro, taxa_sucesso: taxaSucesso, score },
    }).select().single();

    if (data) {
      void centralIaService.registrarLog({
        acao: "auto_evolution_insight_gerado",
        entrada: { entidade_id, total_eventos: totalEventos },
        saida: { insight_id: data.id, prioridade, texto: insightTexto.slice(0, 100) },
        status: prioridade === "critica" ? "erro" : prioridade === "alta" ? "aviso" : "info",
      });
    }

    return data as IaInsightAutomatico | null;
  },

  // ==================== FASE 3: ANALISAR PADRÕES GLOBAIS ====================

  async analisarPadroes(): Promise<{
    insights_gerados: number;
    detalhes: { entidade_id: string; insight_id: string; prioridade: string }[];
  }> {
    const detalhes: { entidade_id: string; insight_id: string; prioridade: string }[] = [];

    // 1. Detecta robôs com baixa performance
    const { data: scoresBaixos } = await supabase
      .from("ia_score_robo")
      .select("robo_id, score_geral")
      .lt("score_geral", 50)
      .order("score_geral");

    if (scoresBaixos) {
      for (const s of scoresBaixos as { robo_id: string; score_geral: number }[]) {
        const insight = await this.gerarInsight({
          entidade_id: s.robo_id,
          contexto: `Robô com score baixo (${s.score_geral}/100)`,
        });
        if (insight) {
          detalhes.push({ entidade_id: s.robo_id, insight_id: insight.id, prioridade: insight.prioridade });
        }
      }
    }

    // 2. Detecta fluxos com alta taxa de falha
    const { data: fluxosFalhos } = await supabase
      .from("ia_fluxos_execucao_log")
      .select("fluxo_codigo, status, count", { count: "exact" })
      .in("status", ["falhou", "bloqueado"])
      .limit(100);

    if (fluxosFalhos && Array.isArray(fluxosFalhos) && fluxosFalhos.length > 0) {
      const agrupados: Record<string, number> = {};
      for (const f of fluxosFalhos as Record<string, unknown>[]) {
        const codigo = f.fluxo_codigo as string;
        agrupados[codigo] = (agrupados[codigo] || 0) + 1;
      }
      for (const [codigo, total] of Object.entries(agrupados)) {
        if (total >= 3) {
          const insight = await this.registrarEvento({
            tipo_evento: "insight",
            origem: "F40",
            payload: {
              tipo: "fluxo_lento",
              fluxo_codigo: codigo,
              total_falhas: total,
              sugestao: `Fluxo ${codigo} com ${total} falhas — revisar etapas críticas`,
            },
          });
          if (insight) {
            detalhes.push({ entidade_id: codigo, insight_id: insight.id, prioridade: "alta" });
          }
        }
      }
    }

    // 3. Detecta bloqueios frequentes de governança
    const { data: bloqueiosGov } = await supabase
      .from("ia_governanca_log")
      .select("robo_id, decisao")
      .eq("decisao", "bloqueado")
      .order("created_at", { ascending: false })
      .limit(100);

    if (bloqueiosGov) {
      const agrupados: Record<string, number> = {};
      for (const b of bloqueiosGov as { robo_id: string; decisao: string }[]) {
        agrupados[b.robo_id] = (agrupados[b.robo_id] || 0) + 1;
      }
      for (const [roboId, total] of Object.entries(agrupados)) {
        if (total >= 5) {
          void this.registrarEvento({
            robo_id: roboId,
            tipo_evento: "bloqueio",
            origem: "F40",
            payload: {
              tipo: "bloqueios_frequentes",
              total_bloqueios: total,
              sugestao: `Robô ${roboId} com ${total} bloqueios — revisar permissões`,
            },
          });
        }
      }
    }

    void centralIaService.registrarLog({
      acao: "auto_evolution_padroes_analisados",
      entrada: {},
      saida: { insights_gerados: detalhes.length, fontes: ["score_baixo", "fluxo_falho", "bloqueio_gov"] },
      status: detalhes.length > 0 ? "aviso" : "info",
    });

    return { insights_gerados: detalhes.length, detalhes };
  },

  // ==================== FASE 4: GERAR SUGESTÃO ====================

  async gerarSugestao(insightId: string): Promise<IaSugestaoMelhoria | null> {
    const { data: insight } = await supabase
      .from("ia_insights_automaticos")
      .select("*")
      .eq("id", insightId)
      .maybeSingle();
    if (!insight) return null;

    const ins = insight as IaInsightAutomatico;

    // Determina tipo de sugestão baseado no conteúdo do insight
    let tipo: TipoSugestao = "fluxo";
    const texto = (ins.insight_texto || "").toLowerCase();
    if (texto.includes("kpi") || texto.includes("score") || texto.includes("desempenho")) tipo = "kpi";
    else if (texto.includes("regra") || texto.includes("permiss") || texto.includes("autoriz")) tipo = "regra";
    else if (texto.includes("prompt") || texto.includes("cognitivo") || texto.includes("llm")) tipo = "prompt";
    else if (texto.includes("ferramenta") || texto.includes("conector")) tipo = "ferramenta";

    const { data } = await supabase.from("ia_sugestoes_melhoria").insert({
      tipo,
      descricao: ins.insight_texto,
      origem_insight_id: insightId,
      impacto_estimado: ins.impacto_estimado || "Melhoria operacional",
      status: "pendente",
      metadata: { insight_prioridade: ins.prioridade, insight_status: ins.status },
    }).select().single();

    if (data) {
      // Marca insight como analisado
      await supabase.from("ia_insights_automaticos").update({
        status: "analisado",
      }).eq("id", insightId);

      void centralIaService.registrarLog({
        acao: "auto_evolution_sugestao_gerada",
        entrada: { insight_id: insightId },
        saida: { sugestao_id: data.id, tipo },
        status: "info",
      });
    }

    return data as IaSugestaoMelhoria | null;
  },

  // ==================== FASE 4: PROPOR MUDANÇA ====================

  async proporMudanca(params: {
    tipo: TipoSugestao;
    descricao: string;
    insight_id?: string;
    impacto_estimado?: string;
  }): Promise<IaSugestaoMelhoria | null> {
    const { data } = await supabase.from("ia_sugestoes_melhoria").insert({
      tipo: params.tipo,
      descricao: params.descricao,
      origem_insight_id: params.insight_id || null,
      impacto_estimado: params.impacto_estimado || "Não estimado",
      status: "pendente",
      metadata: { origem: "proposta_direta" },
    }).select().single();

    if (data) {
      void centralIaService.registrarLog({
        acao: "auto_evolution_mudanca_proposta",
        entrada: { tipo: params.tipo, descricao: params.descricao.slice(0, 80) },
        saida: { sugestao_id: data.id },
        status: "info",
      });
    }

    return data as IaSugestaoMelhoria | null;
  },

  // ==================== FASE 5: SIMULAR IMPACTO ====================

  async simularImpacto(sugestaoId: string): Promise<{
    impacto: string;
    score_atual: number | null;
    score_estimado: number | null;
    melhoria_percentual: number | null;
  } | null> {
    const { data: sugestao } = await supabase
      .from("ia_sugestoes_melhoria")
      .select("*")
      .eq("id", sugestaoId)
      .maybeSingle();
    if (!sugestao) return null;

    const sug = sugestao as IaSugestaoMelhoria;

    // Busca scores atuais dos robôs
    const { data: scores } = await supabase
      .from("ia_score_robo")
      .select("robo_id, score_geral")
      .limit(10);

    const scoresArray = (scores || []) as { robo_id: string; score_geral: number }[];
    const scoreMedioAtual = scoresArray.length > 0
      ? Math.round(scoresArray.reduce((acc, s) => acc + s.score_geral, 0) / scoresArray.length)
      : null;

    // Estima melhoria baseada no tipo de sugestão
    let melhoriaPercentual = 0;
    switch (sug.tipo) {
      case "fluxo": melhoriaPercentual = 15; break;
      case "regra": melhoriaPercentual = 10; break;
      case "kpi": melhoriaPercentual = 20; break;
      case "prompt": melhoriaPercentual = 25; break;
      case "ferramenta": melhoriaPercentual = 12; break;
      default: melhoriaPercentual = 10;
    }

    const scoreEstimado = scoreMedioAtual !== null
      ? Math.min(100, scoreMedioAtual + Math.round(scoreMedioAtual * (melhoriaPercentual / 100)))
      : null;

    const impacto = scoreMedioAtual !== null && scoreEstimado !== null
      ? `Score médio estimado: ${scoreMedioAtual} → ${scoreEstimado} (${scoreEstimado - scoreMedioAtual} pts)`
      : "Impacto não quantificável no momento";

    // Atualiza metadata da sugestão com a simulação
    await supabase.from("ia_sugestoes_melhoria").update({
      impacto_estimado: impacto,
      metadata: { ...(sug.metadata || {}), simulacao: { score_atual: scoreMedioAtual, score_estimado: scoreEstimado, melhoria_percentual: melhoriaPercentual } },
    }).eq("id", sugestaoId);

    return {
      impacto,
      score_atual: scoreMedioAtual,
      score_estimado: scoreEstimado,
      melhoria_percentual: melhoriaPercentual,
    };
  },

  // ==================== FASE 5: ENVIAR PARA GOVERNANÇA F35 ====================

  async enviarParaGovernancaF35(sugestaoId: string, roboId?: string): Promise<{
    sucesso: boolean;
    aprovacao_id?: string;
    erro?: string;
  }> {
    const { data: sugestao } = await supabase
      .from("ia_sugestoes_melhoria")
      .select("*")
      .eq("id", sugestaoId)
      .maybeSingle();
    if (!sugestao) return { sucesso: false, erro: "Sugestão não encontrada" };

    const sug = sugestao as IaSugestaoMelhoria;
    if (sug.status !== "pendente") {
      return { sucesso: false, erro: `Sugestão já está ${sug.status}` };
    }

    // Cria aprovação na governança F35
    const aprovacao = await governancaService.criarAprovacao({
      roboId: roboId || "00000000-0000-0000-0000-000000000000",
      acaoTipo: `auto_evolution_${sug.tipo}`,
      descricao: `[Auto-Evolução] ${sug.tipo}: ${sug.descricao.slice(0, 200)}`,
      contexto: { sugestao_id: sugestaoId, tipo: sug.tipo, origem_insight: sug.origem_insight_id, impacto_estimado: sug.impacto_estimado },
      justificativa: `Sugestão automática do sistema de auto-evolução F40 para melhoria de ${sug.tipo}. ${sug.impacto_estimado || ""}`,
      risco: "medio",
    });

    if (!aprovacao) {
      return { sucesso: false, erro: "Falha ao criar aprovação na governança" };
    }

    // Vincula aprovação à sugestão
    await supabase.from("ia_sugestoes_melhoria").update({
      governanca_aprovacao_id: aprovacao.id,
      metadata: { ...(sug.metadata || {}), enviado_para_governanca: nowISO() },
    }).eq("id", sugestaoId);

    void centralIaService.registrarLog({
      acao: "auto_evolution_enviado_governanca",
      entrada: { sugestao_id: sugestaoId, tipo: sug.tipo },
      saida: { aprovacao_id: aprovacao.id, status: "pendente" },
      status: "info",
    });

    return { sucesso: true, aprovacao_id: aprovacao.id };
  },

  // ==================== FASE 5: APLICAR VERSÃO APROVADA ====================

  async aplicarVersaoAprovada(params: {
    tipo: TipoVersao;
    entidade_id: string;
    snapshot: Record<string, unknown>;
    sugerido_por?: string;
    aprovado_por?: string;
  }): Promise<IaVersaoSistema | null> {
    const { tipo, entidade_id, snapshot, sugerido_por, aprovado_por } = params;

    // Busca última versão para incrementar
    const { data: ultima } = await supabase
      .from("ia_versoes_sistema")
      .select("versao")
      .eq("tipo", tipo)
      .eq("entidade_id", entidade_id)
      .order("versao", { ascending: false })
      .limit(1)
      .maybeSingle();

    const novaVersao = ultima ? (ultima as { versao: number }).versao + 1 : 1;

    // Desativa versão anterior
    await supabase.from("ia_versoes_sistema").update({ ativo: false })
      .eq("tipo", tipo).eq("entidade_id", entidade_id).eq("ativo", true);

    // Cria nova versão
    const { data } = await supabase.from("ia_versoes_sistema").insert({
      tipo,
      entidade_id,
      versao: novaVersao,
      snapshot,
      ativo: true,
      sugerido_por: sugerido_por || null,
      aprovado_por: aprovado_por || null,
    }).select().single();

    if (data) {
      void centralIaService.registrarLog({
        acao: "auto_evolution_versao_aplicada",
        entrada: { tipo, entidade_id },
        saida: { versao_id: data.id, versao: novaVersao, snapshot_keys: Object.keys(snapshot) },
        status: "sucesso",
      });
    }

    return data as IaVersaoSistema | null;
  },

  // ==================== CONSULTAS ====================

  async listarEventos(params?: {
    robo_id?: string;
    tipo_evento?: TipoEventoAprendizado;
    origem?: string;
    limite?: number;
  }): Promise<IaAprendizadoEvento[]> {
    let query = supabase.from("ia_aprendizado_eventos").select("*").order("created_at", { ascending: false });
    if (params?.robo_id) query = query.eq("robo_id", params.robo_id);
    if (params?.tipo_evento) query = query.eq("tipo_evento", params.tipo_evento);
    if (params?.origem) query = query.eq("origem", params.origem);
    if (params?.limite) query = query.limit(params.limite);
    const { data } = await query;
    return (data || []) as IaAprendizadoEvento[];
  },

  async listarInsights(params?: {
    status?: StatusInsight;
    prioridade?: string;
    limite?: number;
  }): Promise<IaInsightAutomatico[]> {
    let query = supabase.from("ia_insights_automaticos").select("*").order("created_at", { ascending: false });
    if (params?.status) query = query.eq("status", params.status);
    if (params?.prioridade) query = query.eq("prioridade", params.prioridade);
    if (params?.limite) query = query.limit(params.limite);
    const { data } = await query;
    return (data || []) as IaInsightAutomatico[];
  },

  async listarSugestoes(params?: {
    status?: StatusSugestao;
    tipo?: TipoSugestao;
    limite?: number;
  }): Promise<IaSugestaoMelhoria[]> {
    let query = supabase.from("ia_sugestoes_melhoria").select("*").order("created_at", { ascending: false });
    if (params?.status) query = query.eq("status", params.status);
    if (params?.tipo) query = query.eq("tipo", params.tipo);
    if (params?.limite) query = query.limit(params.limite);
    const { data } = await query;
    return (data || []) as IaSugestaoMelhoria[];
  },

  async listarVersoes(params?: {
    tipo?: TipoVersao;
    entidade_id?: string;
    ativo?: boolean;
    limite?: number;
  }): Promise<IaVersaoSistema[]> {
    let query = supabase.from("ia_versoes_sistema").select("*").order("created_at", { ascending: false });
    if (params?.tipo) query = query.eq("tipo", params.tipo);
    if (params?.entidade_id) query = query.eq("entidade_id", params.entidade_id);
    if (params?.ativo !== undefined) query = query.eq("ativo", params.ativo);
    if (params?.limite) query = query.limit(params.limite);
    const { data } = await query;
    return (data || []) as IaVersaoSistema[];
  },

  async obterEstatisticas(): Promise<{
    total_eventos: number;
    total_insights: number;
    insights_por_prioridade: Record<string, number>;
    total_sugestoes: number;
    sugestoes_por_status: Record<string, number>;
    total_versoes: number;
    versoes_ativas: number;
  }> {
    const [eventos, insights, sugestoes, versoes] = await Promise.all([
      supabase.from("ia_aprendizado_eventos").select("id", { count: "exact", head: true }),
      supabase.from("ia_insights_automaticos").select("prioridade, status"),
      supabase.from("ia_sugestoes_melhoria").select("status"),
      supabase.from("ia_versoes_sistema").select("ativo"),
    ]);

    const insightsList = (insights.data || []) as { prioridade: string; status: string }[];
    const insightsPorPrioridade: Record<string, number> = {};
    for (const i of insightsList) {
      insightsPorPrioridade[i.prioridade] = (insightsPorPrioridade[i.prioridade] || 0) + 1;
    }

    const sugestoesList = (sugestoes.data || []) as { status: string }[];
    const sugestoesPorStatus: Record<string, number> = {};
    for (const s of sugestoesList) {
      sugestoesPorStatus[s.status] = (sugestoesPorStatus[s.status] || 0) + 1;
    }

    const versoesList = (versoes.data || []) as { ativo: boolean }[];

    return {
      total_eventos: eventos.count || 0,
      total_insights: insightsList.length,
      insights_por_prioridade: insightsPorPrioridade,
      total_sugestoes: sugestoesList.length,
      sugestoes_por_status: sugestoesPorStatus,
      total_versoes: versoesList.length,
      versoes_ativas: versoesList.filter(v => v.ativo).length,
    };
  },
};

export default autoEvolutionEngineService;
