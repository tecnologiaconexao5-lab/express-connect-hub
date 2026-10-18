import { supabase } from "@/lib/supabase";
import { memoriaService } from "@/services/ia/memoriaService";

export type StatusDiretor = "active" | "paused";
export type ModoDiretor = "auto" | "semi_auto" | "manual";
export type TipoDecisao = "priorizacao" | "risco" | "falha" | "overload" | "oportunidade";
export type ImpactoDecisao = "low" | "medium" | "high" | "critical";
export type AcaoDecisao = "pause" | "resume" | "repriorizar" | "redistribuir" | "escalar";
export type StatusDecisao = "pending" | "executed" | "rejected";

export interface DiretorVirtual {
  id: string;
  status: StatusDiretor;
  modo_operacao: ModoDiretor;
  created_at: string;
  updated_at: string;
}

export interface DecisaoDiretor {
  id: string;
  origem: string;
  robo_id: string | null;
  tipo: TipoDecisao;
  descricao: string;
  impacto: ImpactoDecisao;
  acao: AcaoDecisao;
  detalhes: Record<string, unknown>;
  status: StatusDecisao;
  executado: boolean;
  executado_em: string | null;
  created_at: string;
}

export interface MetricaRobo {
  id: string;
  robo_id: string;
  rotinas_ativas: number;
  rotinas_atrasadas: number;
  falhas_24h: number;
  execucoes_24h: number;
  carga_percentual: number;
  risco_score: number;
  updated_at: string;
  robo_nome?: string;
  robo_setor?: string;
}

type DecisaoInput = {
  origem: string;
  robo_id?: string | null;
  tipo: TipoDecisao;
  descricao: string;
  impacto: ImpactoDecisao;
  acao: AcaoDecisao;
  detalhes?: Record<string, unknown>;
};

function nowISO(): string {
  return new Date().toISOString();
}

export type TipoAlertaMissao = "meta_nao_atingida" | "desempenho_baixo" | "prazo_proximo" | "prazo_expirado" | "produtividade_baixa";

export interface AlertaDesempenho {
  robo_id: string;
  robo_nome: string;
  tipo: TipoAlertaMissao;
  descricao: string;
  detalhes: Record<string, unknown>;
  impacto: ImpactoDecisao;
  acao_sugerida: string;
}

export const diretorVirtualService = {
  async obterConfig(): Promise<DiretorVirtual | null> {
    const { data, error } = await supabase.from("diretor_virtual_ia").select("*").limit(1).maybeSingle();
    if (error) throw error;
    return data as DiretorVirtual | null;
  },

  async atualizarConfig(updates: Partial<DiretorVirtual>): Promise<DiretorVirtual | null> {
    const config = await this.obterConfig();
    if (!config) {
      const { data } = await supabase.from("diretor_virtual_ia").insert({
        status: "active", modo_operacao: "semi_auto",
      }).select().single();
      return data as DiretorVirtual;
    }
    const { data, error } = await supabase.from("diretor_virtual_ia").update(updates).eq("id", config.id).select().single();
    if (error) throw error;
    return data as DiretorVirtual;
  },

  async coletarMetricasSistema(): Promise<MetricaRobo[]> {
    const { data: robos, error: robosError } = await supabase.from("automacoes_robos").select("id, nome, setor");
    if (robosError || !robos) return [];

    const metricas: MetricaRobo[] = [];
    const agora = nowISO();
    const vinteEQuatroHorasAtras = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    for (const robo of robos) {
      const [rotinasData, execsData24h] = await Promise.all([
        supabase.from("rotinas_ia").select("id, status, proxima_execucao").eq("robo_id", robo.id),
        supabase.from("rotinas_execucoes_ia").select("id, status").eq("robo_id", robo.id).gte("started_at", vinteEQuatroHorasAtras),
      ]);

      const rotinas = (rotinasData.data || []) as { id: string; status: string; proxima_execucao: string | null }[];
      const execs24h = (execsData24h.data || []) as { id: string; status: string }[];

      const rotinasAtivas = rotinas.filter((r) => r.status !== "paused" && r.status !== "error").length;
      const rotinasAtrasadas = rotinas.filter((r) => r.proxima_execucao && r.proxima_execucao < agora).length;
      const falhas24h = execs24h.filter((e) => e.status === "error").length;
      const execucoes24h = execs24h.length;
      const carga = rotinas.length > 0 ? Math.round((rotinasAtivas / Math.max(rotinas.length, 1)) * 100) : 0;
      const risco = Math.min(100, (rotinasAtrasadas * 20) + (falhas24h * 10) + (carga > 80 ? 20 : 0));

      metricas.push({
        id: "",
        robo_id: robo.id,
        robo_nome: robo.nome,
        robo_setor: robo.setor,
        rotinas_ativas: rotinasAtivas,
        rotinas_atrasadas: rotinasAtrasadas,
        falhas_24h: falhas24h,
        execucoes_24h: execucoes24h,
        carga_percentual: Math.min(100, carga),
        risco_score: Math.min(100, risco),
        updated_at: agora,
      });
    }
    return metricas;
  },

  async analisarCargaPorRobo(): Promise<MetricaRobo[]> {
    return this.coletarMetricasSistema();
  },

  async detectarSobrecarga(metricas: MetricaRobo[]): Promise<DecisaoInput[]> {
    const decisoes: DecisaoInput[] = [];
    for (const m of metricas) {
      if (m.carga_percentual > 80) {
        decisoes.push({
          origem: "system",
          robo_id: m.robo_id,
          tipo: "overload",
          descricao: `Robô ${m.robo_nome || m.robo_id} com carga de ${m.carga_percentual}% — acima do limite de 80%`,
          impacto: m.carga_percentual > 90 ? "critical" : "high",
          acao: "pause",
          detalhes: { carga: m.carga_percentual, rotinas_ativas: m.rotinas_ativas, rotinas_atrasadas: m.rotinas_atrasadas },
        });
      }
    }
    return decisoes;
  },

  async detectarFalhasCriticas(metricas: MetricaRobo[]): Promise<DecisaoInput[]> {
    const decisoes: DecisaoInput[] = [];
    for (const m of metricas) {
      if (m.falhas_24h >= 5) {
        decisoes.push({
          origem: "system",
          robo_id: m.robo_id,
          tipo: "falha",
          descricao: `Robô ${m.robo_nome || m.robo_id} com ${m.falhas_24h} falhas nas últimas 24h`,
          impacto: m.falhas_24h >= 10 ? "critical" : "high",
          acao: "escalar",
          detalhes: { falhas: m.falhas_24h, execucoes: m.execucoes_24h, taxa_erro: m.execucoes_24h > 0 ? `${Math.round((m.falhas_24h / m.execucoes_24h) * 100)}%` : "N/A" },
        });
      } else if (m.falhas_24h >= 3) {
        decisoes.push({
          origem: "system",
          robo_id: m.robo_id,
          tipo: "falha",
          descricao: `Robô ${m.robo_nome || m.robo_id} com ${m.falhas_24h} falhas — necessita revisão`,
          impacto: "medium",
          acao: "repriorizar",
          detalhes: { falhas: m.falhas_24h },
        });
      }
    }
    return decisoes;
  },

  async detectarOportunidadesOperacionais(metricas: MetricaRobo[]): Promise<DecisaoInput[]> {
    const decisoes: DecisaoInput[] = [];
    for (const m of metricas) {
      if (m.rotinas_atrasadas > 0 && m.carga_percentual < 50) {
        decisoes.push({
          origem: "system",
          robo_id: m.robo_id,
          tipo: "oportunidade",
          descricao: `Robô ${m.robo_nome || m.robo_id} com ${m.rotinas_atrasadas} rotinas atrasadas e carga baixa (${m.carga_percentual}%)`,
          impacto: "medium",
          acao: "repriorizar",
          detalhes: { atrasadas: m.rotinas_atrasadas, carga: m.carga_percentual },
        });
      }
      if (m.risco_score < 20 && m.execucoes_24h > 0) {
        decisoes.push({
          origem: "system",
          robo_id: m.robo_id,
          tipo: "oportunidade",
          descricao: `Robô ${m.robo_nome || m.robo_id} operando estável (risco ${m.risco_score}) — pode receber mais carga`,
          impacto: "low",
          acao: "resume",
          detalhes: { risco: m.risco_score, execucoes: m.execucoes_24h },
        });
      }
    }
    return decisoes;
  },

  async gerarDecisoes(): Promise<DecisaoDiretor[]> {
    const config = await this.obterConfig();
    if (!config || config.status === "paused") return [];

    const metricas = await this.coletarMetricasSistema();

    for (const m of metricas) {
      if (m.risco_score > 50 || m.falhas_24h >= 3) {
        try {
          const { data: entities } = await supabase
            .from("memoria_entidades")
            .select("entidade_tipo, entidade_id, nome")
            .eq("robo_id", m.robo_id)
            .limit(3);
          if (entities && entities.length > 0) {
            const ctxs = await Promise.all(entities.slice(0, 1).map((e) =>
              memoriaService.montarContextoCompleto({
                roboId: m.robo_id,
                entidadeTipo: e.entidade_tipo as "cliente" | "lead" | "motorista" | "prestador" | "fornecedor" | "colaborador" | "robo" | "projeto" | "contrato" | "outro",
                entidadeId: e.entidade_id,
              }).catch(() => null)
            ));
            const ctxValido = ctxs.find(Boolean);
            if (ctxValido) {
              m.robo_nome = `${m.robo_nome || ""} | Memória: ${ctxValido.entidade?.nome || ""}`;
            }
          }
        } catch { /* continua sem memoria */ }
      }
    }

    const decisoesInput: DecisaoInput[] = [
      ...(await this.detectarSobrecarga(metricas)),
      ...(await this.detectarFalhasCriticas(metricas)),
      ...(await this.detectarOportunidadesOperacionais(metricas)),
    ];

    const registradas: DecisaoDiretor[] = [];
    for (const d of decisoesInput) {
      const decidir = await this.aplicarDecisao(d, config.modo_operacao);
      if (decidir) registradas.push(decidir);
    }

    for (const m of metricas) {
      await this.salvarMetrica(m);
    }

    return registradas;
  },

  async aplicarDecisao(
    decisao: DecisaoInput,
    modo: ModoDiretor = "semi_auto",
  ): Promise<DecisaoDiretor | null> {
    const deveExecutar = modo === "auto" || (modo === "semi_auto" && (decisao.impacto === "low" || decisao.impacto === "medium"));

    const { data, error } = await supabase.from("diretor_virtual_decisoes_ia").insert({
      origem: decisao.origem,
      robo_id: decisao.robo_id || null,
      tipo: decisao.tipo,
      descricao: decisao.descricao,
      impacto: decisao.impacto,
      acao: decisao.acao,
      detalhes: decisao.detalhes || {},
      status: deveExecutar ? "executed" : "pending",
      executado: deveExecutar,
      executado_em: deveExecutar ? nowISO() : null,
    }).select().single();

    if (error || !data) return null;

    const dec = data as DecisaoDiretor;

    if (deveExecutar) {
      try {
        await this.executarAcao(decisao.acao, decisao.robo_id, decisao.detalhes || {});
      } catch {
        await supabase.from("diretor_virtual_decisoes_ia").update({
          status: "rejected",
          detalhes: { ...(decisao.detalhes || {}), erro: "Falha ao executar ação" },
        }).eq("id", dec.id);
      }
    }

    return dec;
  },

  async executarAcao(acao: AcaoDecisao, roboId: string | null | undefined, detalhes: Record<string, unknown>): Promise<void> {
    if (!roboId) return;

    switch (acao) {
      case "pause": {
        await supabase.from("rotinas_ia").update({
          status: "paused",
          ativo: false,
        }).eq("robo_id", roboId).in("status", ["pending", "success", "error"]);
        break;
      }
      case "resume": {
        const agora = nowISO();
        await supabase.from("rotinas_ia").update({
          status: "pending",
          ativo: true,
          proxima_execucao: agora,
        }).eq("robo_id", roboId).eq("status", "paused");
        break;
      }
      case "repriorizar": {
        const agora = nowISO();
        await supabase.from("rotinas_ia").update({
          proxima_execucao: agora,
        }).eq("robo_id", roboId).in("status", ["pending", "success", "error"]);
        break;
      }
      case "redistribuir": {
        const { data: rotinas } = await supabase
          .from("rotinas_ia").select("id, interval_seconds")
          .eq("robo_id", roboId).eq("ativo", true);
        if (rotinas && rotinas.length > 0) {
          for (const r of rotinas) {
            const novoIntervalo = Math.max(30, (r.interval_seconds || 60) + 30);
            await supabase.from("rotinas_ia").update({ interval_seconds: novoIntervalo }).eq("id", r.id);
          }
        }
        break;
      }
      case "escalar": {
        await supabase.from("automacoes_tarefas").insert({
          robo_id: roboId,
          setor: "TI / Governança",
          tipo_tarefa: "escalar_falha_diretor_virtual",
          titulo: `[Diretor Virtual] Falhas detectadas no robô`,
          descricao: detalhes.descricao || `Múltiplas falhas registradas — revisão necessária`,
          prioridade: "alta",
          status: "pendente",
          payload: detalhes,
        });
        break;
      }
    }
  },

  async registrarDecisao(decisao: DecisaoInput): Promise<DecisaoDiretor | null> {
    const { data, error } = await supabase.from("diretor_virtual_decisoes_ia").insert({
      origem: decisao.origem,
      robo_id: decisao.robo_id || null,
      tipo: decisao.tipo,
      descricao: decisao.descricao,
      impacto: decisao.impacto,
      acao: decisao.acao,
      detalhes: decisao.detalhes || {},
      status: "pending",
      executado: false,
    }).select().single();
    if (error) return null;
    return data as DecisaoDiretor;
  },

  async recalcularPrioridadesGlobais(): Promise<{ ajustados: number }> {
    const agora = nowISO();
    const { data: rotinas, error } = await supabase
      .from("rotinas_ia")
      .select("id, status, proxima_execucao, robo_id")
      .eq("ativo", true)
      .in("status", ["pending", "success", "error"]);

    if (error || !rotinas) return { ajustados: 0 };

    let ajustados = 0;
    for (const r of rotinas) {
      if (!r.proxima_execucao || r.proxima_execucao < agora) {
        await supabase.from("rotinas_ia").update({
          proxima_execucao: new Date(Date.now() + 5000).toISOString(),
        }).eq("id", r.id);
        ajustados++;
      }
    }
    return { ajustados };
  },

  async listarDecisoes(limite = 50): Promise<DecisaoDiretor[]> {
    const { data, error } = await supabase
      .from("diretor_virtual_decisoes_ia")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limite);
    if (error) throw error;
    return (data || []) as DecisaoDiretor[];
  },

  async listarMetricas(): Promise<MetricaRobo[]> {
    const { data, error } = await supabase
      .from("diretor_virtual_metricas_ia")
      .select("*")
      .order("risco_score", { ascending: false });
    if (error) throw error;
    return (data || []) as MetricaRobo[];
  },

  async salvarMetrica(m: MetricaRobo): Promise<void> {
    await supabase.from("diretor_virtual_metricas_ia").upsert({
      robo_id: m.robo_id,
      rotinas_ativas: m.rotinas_ativas,
      rotinas_atrasadas: m.rotinas_atrasadas,
      falhas_24h: m.falhas_24h,
      execucoes_24h: m.execucoes_24h,
      carga_percentual: m.carga_percentual,
      risco_score: m.risco_score,
      updated_at: nowISO(),
    }, { onConflict: "robo_id" });
  },

  async aprovarDecisao(id: string): Promise<void> {
    const { data } = await supabase.from("diretor_virtual_decisoes_ia").select("*").eq("id", id).single();
    if (!data) return;
    const d = data as DecisaoDiretor;
    await this.executarAcao(d.acao, d.robo_id, d.detalhes);
    await supabase.from("diretor_virtual_decisoes_ia").update({
      status: "executed",
      executado: true,
      executado_em: nowISO(),
    }).eq("id", id);
  },

  async rejeitarDecisao(id: string): Promise<void> {
    await supabase.from("diretor_virtual_decisoes_ia").update({
      status: "rejected",
    }).eq("id", id);
  },

  // ========== MONITORAMENTO DE METAS E DESEMPENHO (F31) ==========

  async detectarMetasNaoAtingidas(): Promise<AlertaDesempenho[]> {
    const alertas: AlertaDesempenho[] = [];
    const { data: metas } = await supabase
      .from("ia_metas")
      .select("id, robo_id, nome_meta, valor_meta, valor_atual, periodicidade, status, data_referencia_fim, automacoes_robos!inner(nome)")
      .eq("status", "ativa");

    if (!metas) return alertas;

    for (const meta of metas as Record<string, unknown>[]) {
      const metaData = meta as {
        id: string; robo_id: string; nome_meta: string;
        valor_meta: number; valor_atual: number;
        data_referencia_fim: string | null;
        automacoes_robos: { nome: string };
      };
      const roboNome = metaData.automacoes_robos?.nome || "Desconhecido";
      const perc = metaData.valor_meta > 0
        ? Math.round((metaData.valor_atual / metaData.valor_meta) * 100)
        : 0;

      if (metaData.data_referencia_fim && new Date(metaData.data_referencia_fim) < new Date()) {
        alertas.push({
          robo_id: metaData.robo_id,
          robo_nome: roboNome,
          tipo: "prazo_expirado",
          descricao: `Meta "${metaData.nome_meta}" de ${roboNome} expirou com ${perc}% de conclusão`,
          detalhes: { meta_id: metaData.id, perc, planejado: metaData.valor_meta, realizado: metaData.valor_atual },
          impacto: perc < 50 ? "high" : "medium",
          acao_sugerida: "Revisar meta e redefinir prazo ou realocar recursos",
        });
      } else if (perc < 50) {
        alertas.push({
          robo_id: metaData.robo_id,
          robo_nome: roboNome,
          tipo: "desempenho_baixo",
          descricao: `${roboNome} atingiu apenas ${perc}% da meta "${metaData.nome_meta}"`,
          detalhes: { meta_id: metaData.id, perc, planejado: metaData.valor_meta, realizado: metaData.valor_atual },
          impacto: perc < 30 ? "high" : "medium",
          acao_sugerida: "Aumentar prospecção ou reduzir expectativa da meta",
        });
      }
    }
    return alertas;
  },

  async detectarPrazoProximo(): Promise<AlertaDesempenho[]> {
    const alertas: AlertaDesempenho[] = [];
    const { data: metas } = await supabase
      .from("ia_metas")
      .select("id, robo_id, nome_meta, valor_meta, valor_atual, data_referencia_fim, automacoes_robos!inner(nome)")
      .eq("status", "ativa")
      .not("data_referencia_fim", "is", null);

    if (!metas) return alertas;

    const agora = new Date();
    const em7Dias = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);

    for (const meta of metas as Record<string, unknown>[]) {
      const metaData = meta as {
        id: string; robo_id: string; nome_meta: string;
        valor_meta: number; valor_atual: number;
        data_referencia_fim: string;
        automacoes_robos: { nome: string };
      };
      const fim = new Date(metaData.data_referencia_fim);
      if (fim > agora && fim <= em7Dias) {
        const perc = metaData.valor_meta > 0
          ? Math.round((metaData.valor_atual / metaData.valor_meta) * 100)
          : 0;
        alertas.push({
          robo_id: metaData.robo_id,
          robo_nome: metaData.automacoes_robos?.nome || "Desconhecido",
          tipo: "prazo_proximo",
          descricao: `Meta "${metaData.nome_meta}" vence em ${Math.ceil((fim.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24))} dias (${perc}% concluída)`,
          detalhes: { meta_id: metaData.id, dias_restantes: Math.ceil((fim.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24)), perc },
          impacto: perc < 50 ? "high" : "low",
          acao_sugerida: "Acelerar execução ou solicitar prorrogação",
        });
      }
    }
    return alertas;
  },

  async analisarDesempenhoGlobal(): Promise<{
    alertas: AlertaDesempenho[];
    resumo: { robo_id: string; robo_nome: string; desempenho: number; tendencia: string }[];
  }> {
    const alertas = [
      ...await this.detectarMetasNaoAtingidas(),
      ...await this.detectarPrazoProximo(),
    ];

    const { data: robos } = await supabase
      .from("automacoes_robos")
      .select("id, nome")
      .eq("ativo", true);

    const resumo: { robo_id: string; robo_nome: string; desempenho: number; tendencia: string }[] = [];

    if (robos) {
      for (const robo of robos as { id: string; nome: string }[]) {
        const { data: metas } = await supabase
          .from("ia_metas")
          .select("status, peso")
          .eq("robo_id", robo.id);

        if (metas && metas.length > 0) {
          const totalPeso = metas.reduce((acc, m) => acc + Number(m.peso), 0);
          const pesoAtingido = metas
            .filter((m) => m.status === "atingida")
            .reduce((acc, m) => acc + Number(m.peso), 0);
          const desempenho = totalPeso > 0 ? Math.round((pesoAtingido / totalPeso) * 100) : 0;

          const { data: ultimoInd } = await supabase
            .from("ia_indicadores")
            .select("tendencia")
            .eq("robo_id", robo.id)
            .order("data_apuracao", { ascending: false })
            .limit(1);

          resumo.push({
            robo_id: robo.id,
            robo_nome: robo.nome,
            desempenho,
            tendencia: (ultimoInd && ultimoInd.length > 0) ? ultimoInd[0].tendencia : "estavel",
          });
        }
      }
    }

    return { alertas, resumo: resumo.sort((a, b) => a.desempenho - b.desempenho) };
  },

  async gerarDecisoesPorDesempenho(): Promise<DecisaoDiretor[]> {
    const config = await this.obterConfig();
    if (!config || config.status === "paused") return [];

    const { alertas } = await this.analisarDesempenhoGlobal();
    const decisoesInput: DecisaoInput[] = [];

    for (const alerta of alertas) {
      if (alerta.tipo === "desempenho_baixo" || alerta.tipo === "prazo_expirado") {
        decisoesInput.push({
          origem: "gestao_desempenho",
          robo_id: alerta.robo_id,
          tipo: "falha",
          descricao: alerta.descricao,
          impacto: alerta.impacto,
          acao: "repriorizar",
          detalhes: { ...alerta.detalhes, alerta_tipo: alerta.tipo, acao_sugerida: alerta.acao_sugerida },
        });
      }
    }

    const registradas: DecisaoDiretor[] = [];
    for (const d of decisoesInput) {
      const decidir = await this.aplicarDecisao(d, config.modo_operacao);
      if (decidir) registradas.push(decidir);
    }

    return registradas;
  },
};

export default diretorVirtualService;
