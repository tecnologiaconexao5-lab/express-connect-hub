import { supabase } from "@/lib/supabase";
import { centralIaService } from "@/services/centralIaService";
import { gestaoFuncionariosService } from "@/services/ia/gestaoFuncionariosService";
import { performanceEngineService } from "@/services/ia/performanceEngineService";

// ==================== TYPES ====================

export type RiscoNivel = "baixo" | "medio" | "alto" | "critico";
export type StatusAprovacaoFila = "pendente" | "aprovado" | "rejeitado" | "expirado" | "escalado";

export interface IaAutoridadeAcao {
  id: string;
  robo_id: string;
  acao_tipo: string;
  permitido: boolean;
  condicoes: Record<string, unknown>;
  valor_maximo: number | null;
  risco_maximo: RiscoNivel;
  precisa_aprovacao: boolean;
  supervisor_robo_id: string | null;
  supervisor_setor: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface IaEscalonamentoConfig {
  id: string;
  tipo_acao: string;
  nivel_risco_min: string | null;
  valor_min: number | null;
  nivel_ordem: number;
  aprovador_tipo: string;
  aprovador_robo_id: string | null;
  aprovador_setor: string | null;
  ativo: boolean;
  created_at: string;
}

export interface IaAprovacaoFila {
  id: string;
  robo_id: string;
  execucao_ferramenta_id: string | null;
  acao_tipo: string;
  acao_descricao: string | null;
  contexto: Record<string, unknown>;
  justificativa: string | null;
  risco: string;
  valor_financeiro: number;
  status: StatusAprovacaoFila;
  nivel_atual: number;
  nivel_maximo: number;
  aprovador_id: string | null;
  aprovador_tipo: string | null;
  aprovado_em: string | null;
  rejeitado_em: string | null;
  observacao: string | null;
  expiracao: string | null;
  created_at: string;
  updated_at: string;
  robo_nome?: string;
  aprovador_nome?: string;
}

export interface IaGovernancaLog {
  id: string;
  robo_id: string | null;
  acao_tipo: string | null;
  decisao: string;
  contexto: Record<string, unknown>;
  regra_aplicada: Record<string, unknown>;
  resultado: string | null;
  created_at: string;
}

export interface ResultadoAvaliacao {
  permitido: boolean;
  motivo: string;
  precisa_aprovacao: boolean;
  risco: RiscoNivel;
  nivel_escalonamento: number;
  autoridade?: IaAutoridadeAcao | null;
  aprovacao_fila_id?: string | null;
}

export interface ContextoGovernanca {
  autoridade: IaAutoridadeAcao[];
  limites_diarios: { acao_tipo: string; usado: number; limite: number }[];
  alertas: string[];
  permissoes_ferramentas: string[];
}

function nowISO(): string {
  return new Date().toISOString();
}

function calcularRisco(_valor?: number, _riscoMaximo?: string): RiscoNivel {
  if (!_valor && !_riscoMaximo) return "baixo";
  if (_valor && _valor > 50000) return "critico";
  if (_valor && _valor > 10000) return "alto";
  if (_valor && _valor > 1000) return "medio";
  if (_riscoMaximo === "critico" || _riscoMaximo === "alto") return _riscoMaximo as RiscoNivel;
  return "baixo";
}

export const governancaService = {
  // ==================== FASE 2: MATRIZ DE AUTORIDADE ====================
  async obterAutoridade(roboId: string, acaoTipo?: string): Promise<IaAutoridadeAcao[]> {
    let query = supabase.from("ia_autoridade_acoes").select("*").eq("ativo", true);
    if (roboId) query = query.eq("robo_id", roboId);
    if (acaoTipo) query = query.eq("acao_tipo", acaoTipo);
    const { data } = await query;
    return (data || []) as IaAutoridadeAcao[];
  },

  async upsertAutoridade(dados: {
    robo_id: string;
    acao_tipo: string;
    permitido?: boolean;
    condicoes?: Record<string, unknown>;
    valor_maximo?: number;
    risco_maximo?: RiscoNivel;
    precisa_aprovacao?: boolean;
    supervisor_robo_id?: string;
    supervisor_setor?: string;
  }): Promise<IaAutoridadeAcao | null> {
    const { data } = await supabase.from("ia_autoridade_acoes").upsert({
      robo_id: dados.robo_id,
      acao_tipo: dados.acao_tipo,
      permitido: dados.permitido ?? true,
      condicoes: dados.condicoes || {},
      valor_maximo: dados.valor_maximo ?? null,
      risco_maximo: dados.risco_maximo || "critico",
      precisa_aprovacao: dados.precisa_aprovacao ?? false,
      supervisor_robo_id: dados.supervisor_robo_id ?? null,
      supervisor_setor: dados.supervisor_setor ?? null,
    }, { onConflict: "robo_id, acao_tipo" }).select().single();
    if (data) {
      await this.registrarLogGovernanca({
        robo_id: dados.robo_id, acao_tipo: dados.acao_tipo,
        decisao: "autoridade_upsert",
        contexto: dados as unknown as Record<string, unknown>,
        regra_aplicada: {},
        resultado: "sucesso",
      });
    }
    return data as IaAutoridadeAcao | null;
  },

  async listarAutoridadePorSetor(setor?: string): Promise<IaAutoridadeAcao[]> {
    if (setor) {
      const { data: robos } = await supabase.from("automacoes_robos").select("id").eq("setor", setor);
      if (!robos || robos.length === 0) return [];
      const roboIds = robos.map((r) => r.id);
      const { data } = await supabase.from("ia_autoridade_acoes").select("*").in("robo_id", roboIds).eq("ativo", true);
      return (data || []) as IaAutoridadeAcao[];
    }
    const { data } = await supabase.from("ia_autoridade_acoes").select("*, automacoes_robos!inner(nome, setor)").eq("ativo", true);
    return (data || []) as IaAutoridadeAcao[];
  },

  // ==================== FASE 5: ESCALONAMENTO ====================
  async listarEscalonamento(tipoAcao?: string): Promise<IaEscalonamentoConfig[]> {
    let query = supabase.from("ia_escalonamento_config").select("*").eq("ativo", true).order("nivel_ordem");
    if (tipoAcao) query = query.eq("tipo_acao", tipoAcao);
    const { data } = await query;
    return (data || []) as IaEscalonamentoConfig[];
  },

  async upsertEscalonamento(dados: {
    tipo_acao: string;
    nivel_risco_min?: string;
    valor_min?: number;
    nivel_ordem: number;
    aprovador_tipo: string;
    aprovador_robo_id?: string;
    aprovador_setor?: string;
  }): Promise<IaEscalonamentoConfig | null> {
    const { data } = await supabase.from("ia_escalonamento_config").upsert({
      tipo_acao: dados.tipo_acao,
      nivel_risco_min: dados.nivel_risco_min ?? null,
      valor_min: dados.valor_min ?? null,
      nivel_ordem: dados.nivel_ordem,
      aprovador_tipo: dados.aprovador_tipo,
      aprovador_robo_id: dados.aprovador_robo_id ?? null,
      aprovador_setor: dados.aprovador_setor ?? null,
    }, { onConflict: "tipo_acao, nivel_ordem" }).select().single();
    return data as IaEscalonamentoConfig | null;
  },

  // ==================== FASE 3: MOTOR DE APROVAÇÕES ====================
  async avaliarAcao(params: {
    roboId: string;
    acaoTipo: string;
    valor?: number;
    contexto?: Record<string, unknown>;
  }): Promise<ResultadoAvaliacao> {
    const { roboId, acaoTipo, valor, contexto } = params;
    const risco = calcularRisco(valor);

    // F38: Ajuste dinâmico por performance do robô
    try {
      const fatores = await performanceEngineService.obterFatoresAjusteGovernanca(roboId);
      if (fatores.nivel_autonomia_sugerido === "reduzida") {
        // Performance baixa: aumenta o risco e marca para aprovação
        // (a autoridade específica ainda será verificada abaixo)
        if (contexto) {
          contexto.performance_ajuste = fatores.nivel_autonomia_sugerido;
          contexto.performance_alertas = fatores.alertas;
        }
      }
    } catch { /* performance indisponivel — segue sem ajuste */ }

    // Busca autoridade específica para esta ação
    const autoridades = await this.obterAutoridade(roboId, acaoTipo);
    const autoridade = autoridades.length > 0 ? autoridades[0] : null;

    if (autoridade) {
      // Ação explicitamente bloqueada?
      if (!autoridade.permitido) {
        await this.registrarLogGovernanca({
          robo_id: roboId, acao_tipo: acaoTipo,
          decisao: "bloqueado",
          contexto: { valor, ...contexto },
          regra_aplicada: { tipo: "autoridade", autoridade_id: autoridade.id, acao_tipo: acaoTipo, permitido: false },
          resultado: "Ação bloqueada pela matriz de autoridade",
        });
        return {
          permitido: false, motivo: `Ação "${acaoTipo}" bloqueada para este robô pela matriz de autoridade`,
          precisa_aprovacao: false, risco, nivel_escalonamento: 0,
          autoridade,
        };
      }

      // Verifica valor máximo
      if (autoridade.valor_maximo !== null && valor && valor > autoridade.valor_maximo) {
        const escalonamento = await this.listarEscalonamento(acaoTipo);
        const nivelMaisAlto = escalonamento.length > 0 ? escalonamento[escalonamento.length - 1].nivel_ordem : 3;

        await this.registrarLogGovernanca({
          robo_id: roboId, acao_tipo: acaoTipo,
          decisao: "valor_excedido",
          contexto: { valor, valor_maximo: autoridade.valor_maximo, ...contexto },
          regra_aplicada: { tipo: "autoridade", autoridade_id: autoridade.id, acao_tipo: acaoTipo, valor_maximo: autoridade.valor_maximo },
          resultado: `Valor R$ ${valor} excede limite de R$ ${autoridade.valor_maximo}`,
        });

        return {
          permitido: false,
          motivo: `Valor R$ ${valor} excede o limite de R$ ${autoridade.valor_maximo} para ${acaoTipo}`,
          precisa_aprovacao: true,
          risco: autoridade.risco_maximo as RiscoNivel || risco,
          nivel_escalonamento: nivelMaisAlto,
          autoridade,
        };
      }

      // Precisa de aprovação?
      if (autoridade.precisa_aprovacao) {
        const escalonamento = await this.listarEscalonamento(acaoTipo);
        const nivel = escalonamento.length > 0 ? escalonamento[0].nivel_ordem : 1;
        const riscoEfetivo = autoridade.risco_maximo as RiscoNivel || risco;

        await this.registrarLogGovernanca({
          robo_id: roboId, acao_tipo: acaoTipo,
          decisao: "aprovacao_necessaria",
          contexto: { valor, ...contexto },
          regra_aplicada: { tipo: "autoridade", autoridade_id: autoridade.id, acao_tipo: acaoTipo, precisa_aprovacao: true, risco: riscoEfetivo, nivel },
          resultado: `Ação exige aprovação (nível ${nivel})`,
        });

        return {
          permitido: true, motivo: `Ação "${acaoTipo}" exige aprovação`,
          precisa_aprovacao: true, risco: riscoEfetivo,
          nivel_escalonamento: nivel, autoridade,
        };
      }
    }

    // Verifica limites operacionais (F31)
    try {
      const limiteValid = await gestaoFuncionariosService.validarLimitesDiarios(roboId, acaoTipo);
      if (!limiteValid.permitido) {
        await this.registrarLogGovernanca({
          robo_id: roboId, acao_tipo: acaoTipo,
          decisao: "limite_excedido",
          contexto: { ...contexto },
          regra_aplicada: { tipo: "limite_operacional", usado: limiteValid.usado, limite: limiteValid.limite },
          resultado: limiteValid.mensagem,
        });
        return {
          permitido: false, motivo: limiteValid.mensagem,
          precisa_aprovacao: false, risco, nivel_escalonamento: 0,
          autoridade,
        };
      }
    } catch { /* sem limites configurados — permite */ }

    // Ação sem autoridade explícita configurada — exige aprovação por segurança
    const motivoDefault = autoridade
      ? `Ação "${acaoTipo}" permitida sem restrições`
      : `Ação "${acaoTipo}" não configurada na matriz de autoridade — exige aprovação`;
    const precisaAprovDefault = !autoridade;

    await this.registrarLogGovernanca({
      robo_id: roboId, acao_tipo: acaoTipo,
      decisao: precisaAprovDefault ? "aprovacao_necessaria" : "permitido",
      contexto: { valor, ...contexto },
      regra_aplicada: { tipo: "autoridade", autoridade_id: autoridade?.id || null, acao_tipo: acaoTipo },
      resultado: precisaAprovDefault
        ? "Ação sem matriz de autoridade configurada — requer aprovação"
        : "Ação permitida sem restrições",
    });

    return {
      permitido: true, motivo: motivoDefault,
      precisa_aprovacao: precisaAprovDefault, risco, nivel_escalonamento: 0,
      autoridade,
    };
  },

  // ==================== FASE 4: FILA DE APROVAÇÕES ====================
  async criarAprovacao(params: {
    roboId: string;
    acaoTipo: string;
    descricao?: string;
    contexto?: Record<string, unknown>;
    justificativa?: string;
    risco?: string;
    valorFinanceiro?: number;
    nivelAtual?: number;
    nivelMaximo?: number;
    aprovadorId?: string;
    aprovadorTipo?: string;
    expiracao?: string;
    execucaoFerramentaId?: string;
  }): Promise<IaAprovacaoFila | null> {
    const escalonamentos = await this.listarEscalonamento(params.acaoTipo);
    const nivelAtual = params.nivelAtual || (escalonamentos.length > 0 ? escalonamentos[0].nivel_ordem : 1);
    const nivelMaximo = params.nivelMaximo || (escalonamentos.length > 0 ? escalonamentos[escalonamentos.length - 1].nivel_ordem : 3);

    let aprovadorId = params.aprovadorId;
    let aprovadorTipo = params.aprovadorTipo;

    if (!aprovadorId && escalonamentos.length > 0) {
      const nivelConfig = escalonamentos.find((e) => e.nivel_ordem === nivelAtual);
      if (nivelConfig) {
        aprovadorId = nivelConfig.aprovador_robo_id || undefined;
        aprovadorTipo = nivelConfig.aprovador_tipo;
      }
    }

    const expiracao = params.expiracao || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await supabase.from("ia_aprovacoes_fila").insert({
      robo_id: params.roboId,
      acao_tipo: params.acaoTipo,
      acao_descricao: params.descricao || null,
      contexto: params.contexto || {},
      justificativa: params.justificativa || null,
      risco: params.risco || "medio",
      valor_financeiro: params.valorFinanceiro || 0,
      status: "pendente",
      nivel_atual: nivelAtual,
      nivel_maximo: nivelMaximo,
      aprovador_id: aprovadorId || null,
      aprovador_tipo: aprovadorTipo || null,
      expiracao,
      execucao_ferramenta_id: params.execucaoFerramentaId || null,
    }).select().single();

    if (data) {
      void centralIaService.registrarLog({
        robo_id: params.roboId, acao: "governanca_aprovacao_criada",
        entrada: { acao_tipo: params.acaoTipo, nivel: nivelAtual, risco: params.risco },
        saida: { aprovacao_id: data.id }, status: "info",
      });

      await this.registrarLogGovernanca({
        robo_id: params.roboId, acao_tipo: params.acaoTipo,
        decisao: "aprovacao_criada",
        contexto: { aprovacao_id: data.id, nivel: nivelAtual, ...params.contexto },
        regra_aplicada: { tipo: "fila_aprovacao", nivel_atual: nivelAtual, nivel_maximo: nivelMaximo },
        resultado: "Aprovação registrada na fila de governança",
      });
    }

    return data as IaAprovacaoFila | null;
  },

  async listarFilaAprovacoes(params?: {
    status?: StatusAprovacaoFila;
    robo_id?: string;
    aprovador_id?: string;
    limite?: number;
  }): Promise<IaAprovacaoFila[]> {
    let query = supabase
      .from("ia_aprovacoes_fila")
      .select("*, automacoes_robos!ia_aprovacoes_fila_robo_id_fkey(nome)")
      .order("created_at", { ascending: false });
    if (params?.status) query = query.eq("status", params.status);
    if (params?.robo_id) query = query.eq("robo_id", params.robo_id);
    if (params?.aprovador_id) query = query.eq("aprovador_id", params.aprovador_id);
    if (params?.limite) query = query.limit(params.limite);
    const { data } = await query;
    return ((data || []) as Record<string, unknown>[]).map((a) => ({
      ...a,
      robo_nome: (a.automacoes_robos as { nome?: string } | null)?.nome,
    })) as IaAprovacaoFila[];
  },

  async obterAprovacao(id: string): Promise<IaAprovacaoFila | null> {
    const { data } = await supabase.from("ia_aprovacoes_fila").select("*").eq("id", id).single();
    return data as IaAprovacaoFila | null;
  },

  async aprovarAprovacao(id: string, aprovadorId?: string, observacao?: string): Promise<boolean> {
    const { data: aprovacao } = await supabase
      .from("ia_aprovacoes_fila")
      .select("*")
      .eq("id", id)
      .single();
    if (!aprovacao) return false;

    const aprov = aprovacao as IaAprovacaoFila;
    const nivelAtual = aprov.nivel_atual;
    const nivelMaximo = aprov.nivel_maximo;

    if (nivelAtual < nivelMaximo) {
      // Escalona para o próximo nível
      const escalonamentos = await this.listarEscalonamento(aprov.acao_tipo);
      const proxNivel = escalonamentos.find((e) => e.nivel_ordem === nivelAtual + 1);
      if (proxNivel) {
        await supabase.from("ia_aprovacoes_fila").update({
          status: "escalado",
          nivel_atual: nivelAtual + 1,
          aprovador_id: proxNivel.aprovador_robo_id || undefined,
          aprovador_tipo: proxNivel.aprovador_tipo,
          observacao: observacao || null,
          updated_at: nowISO(),
        }).eq("id", id);

        await this.registrarLogGovernanca({
          robo_id: aprov.robo_id, acao_tipo: aprov.acao_tipo,
          decisao: "escalado",
          contexto: { aprovacao_id: id, nivel_anterior: nivelAtual, novo_nivel: nivelAtual + 1 },
          regra_aplicada: { tipo: "escalonamento", nivel: nivelAtual + 1 },
          resultado: `Aprovado no nível ${nivelAtual}, escalado para nível ${nivelAtual + 1}`,
        });

        void centralIaService.registrarLog({
          robo_id: aprov.robo_id, acao: "governanca_aprovacao_escalada",
          entrada: { aprovacao_id: id, nivel_anterior: nivelAtual },
          saida: { novo_nivel: nivelAtual + 1 }, status: "info",
        });

        return true;
      }
    }

    // Aprovado definitivamente
    await supabase.from("ia_aprovacoes_fila").update({
      status: "aprovado",
      aprovador_id: aprovadorId || aprov.aprovador_id,
      aprovado_em: nowISO(),
      observacao: observacao || null,
      updated_at: nowISO(),
    }).eq("id", id);

    // Se vinculado a uma execução de ferramenta, aprova automaticamente
    if (aprov.execucao_ferramenta_id) {
      const { default: actionEngineService } = await import("@/services/ia/actionEngineService");
      await actionEngineService.aprovarExecucao(aprov.execucao_ferramenta_id, aprovadorId || undefined);
    }

    await this.registrarLogGovernanca({
      robo_id: aprov.robo_id, acao_tipo: aprov.acao_tipo,
      decisao: "aprovado",
      contexto: { aprovacao_id: id, aprovador_id: aprovadorId },
      regra_aplicada: { tipo: "fila_aprovacao", status: "aprovado" },
      resultado: "Aprovação concedida",
    });

    void centralIaService.registrarLog({
      robo_id: aprov.robo_id, acao: "governanca_aprovacao_aprovada",
      entrada: { aprovacao_id: id },
      saida: { status: "aprovado" }, status: "sucesso",
    });

    return true;
  },

  async rejeitarAprovacao(id: string, observacao?: string): Promise<boolean> {
    const { data: aprovacao } = await supabase
      .from("ia_aprovacoes_fila")
      .select("*")
      .eq("id", id)
      .single();
    if (!aprovacao) return false;

    const aprov = aprovacao as IaAprovacaoFila;

    await supabase.from("ia_aprovacoes_fila").update({
      status: "rejeitado",
      rejeitado_em: nowISO(),
      observacao: observacao || null,
      updated_at: nowISO(),
    }).eq("id", id);

    // Se vinculado a uma execução de ferramenta, cancela
    if (aprov.execucao_ferramenta_id) {
      const { default: actionEngineService } = await import("@/services/ia/actionEngineService");
      await actionEngineService.cancelarExecucao(aprov.execucao_ferramenta_id);
    }

    await this.registrarLogGovernanca({
      robo_id: aprov.robo_id, acao_tipo: aprov.acao_tipo,
      decisao: "rejeitado",
      contexto: { aprovacao_id: id, observacao },
      regra_aplicada: { tipo: "fila_aprovacao", status: "rejeitado" },
      resultado: "Aprovação rejeitada",
    });

    void centralIaService.registrarLog({
      robo_id: aprov.robo_id, acao: "governanca_aprovacao_rejeitada",
      entrada: { aprovacao_id: id, observacao },
      saida: { status: "rejeitado" }, status: "aviso",
    });

    return true;
  },

  async expirarAprovacoesPendentes(): Promise<number> {
    const { data: expiradas } = await supabase
      .from("ia_aprovacoes_fila")
      .select("id, robo_id, acao_tipo")
      .eq("status", "pendente")
      .lt("expiracao", nowISO());

    if (!expiradas || expiradas.length === 0) return 0;

    const ids = expiradas.map((e) => e.id);
    await supabase.from("ia_aprovacoes_fila").update({
      status: "expirado",
      updated_at: nowISO(),
    }).in("id", ids);

    for (const e of expiradas) {
      await this.registrarLogGovernanca({
        robo_id: e.robo_id, acao_tipo: e.acao_tipo,
        decisao: "expirado",
        contexto: { aprovacao_id: e.id },
        regra_aplicada: { tipo: "fila_aprovacao", status: "expirado" },
        resultado: "Aprovação expirou por timeout",
      });
    }

    return expiradas.length;
  },

  async obterEstatisticasFila(): Promise<{
    pendentes: number;
    aprovadas: number;
    rejeitadas: number;
    expiradas: number;
    total: number;
  }> {
    const { data } = await supabase.from("ia_aprovacoes_fila").select("status");
    const lista = (data || []) as { status: string }[];
    return {
      total: lista.length,
      pendentes: lista.filter((a) => a.status === "pendente").length,
      aprovadas: lista.filter((a) => a.status === "aprovado").length,
      rejeitadas: lista.filter((a) => a.status === "rejeitado").length,
      expiradas: lista.filter((a) => a.status === "expirado").length,
    };
  },

  // ==================== FASE 6: CONTEXTO DE GOVERNANÇA PARA F34A ====================
  async obterContextoGovernanca(roboId: string): Promise<ContextoGovernanca> {
    const [autoridade, permissoes] = await Promise.all([
      this.obterAutoridade(roboId),
      supabase.from("ia_robo_ferramentas").select("ferramenta_id, nivel_autonomia, ia_ferramentas!inner(codigo_unico, nome)").eq("robo_id", roboId).eq("ativo", true),
    ]);

    const alertas: string[] = [];
    const limitesDiarios: { acao_tipo: string; usado: number; limite: number }[] = [];

    for (const aut of autoridade) {
      if (!aut.permitido) {
        alertas.push(`AÇÃO BLOQUEADA: ${aut.acao_tipo} — proibido para este robô`);
      }
      if (aut.precisa_aprovacao) {
        alertas.push(`APROVAÇÃO NECESSÁRIA: ${aut.acao_tipo} — requer aprovação${aut.supervisor_robo_id ? ` (supervisor: ${aut.supervisor_robo_id})` : ""}`);
      }
      if (aut.valor_maximo !== null) {
        alertas.push(`LIMITE DE VALOR: ${aut.acao_tipo} — máximo R$ ${aut.valor_maximo}`);
      }
    }

    const permFerramentas = ((permissoes.data || []) as Record<string, unknown>[]).map((p) => {
      const ferramenta = p.ia_ferramentas as { codigo_unico: string; nome: string } | undefined;
      return `${ferramenta?.codigo_unico || ""} (${p.nivel_autonomia})`;
    }).filter(Boolean);

    // F38: Adiciona alertas de performance
    try {
      const fatores = await performanceEngineService.obterFatoresAjusteGovernanca(roboId);
      for (const alerta of fatores.alertas) {
        alertas.push(`[DESEMPENHO] ${alerta}`);
      }
    } catch { /* performance indisponivel */ }

    return {
      autoridade,
      limites_diarios: limitesDiarios,
      alertas,
      permissoes_ferramentas: permFerramentas,
    };
  },

  // ==================== FASE 7: AUDITORIA ====================
  async registrarLogGovernanca(params: {
    robo_id?: string;
    acao_tipo?: string;
    decisao: string;
    contexto: Record<string, unknown>;
    regra_aplicada: Record<string, unknown>;
    resultado?: string;
  }): Promise<void> {
    await supabase.from("ia_governanca_log").insert({
      robo_id: params.robo_id || null,
      acao_tipo: params.acao_tipo || null,
      decisao: params.decisao,
      contexto: params.contexto,
      regra_aplicada: params.regra_aplicada,
      resultado: params.resultado || null,
    });
  },

  async listarLogGovernanca(params?: {
    robo_id?: string;
    acao_tipo?: string;
    decisao?: string;
    limite?: number;
  }): Promise<IaGovernancaLog[]> {
    let query = supabase.from("ia_governanca_log").select("*").order("created_at", { ascending: false });
    if (params?.robo_id) query = query.eq("robo_id", params.robo_id);
    if (params?.acao_tipo) query = query.eq("acao_tipo", params.acao_tipo);
    if (params?.decisao) query = query.eq("decisao", params.decisao);
    if (params?.limite) query = query.limit(params.limite);
    const { data } = await query;
    return (data || []) as IaGovernancaLog[];
  },
};

export default governancaService;
