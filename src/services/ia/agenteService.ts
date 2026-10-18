import { supabase } from "@/lib/supabase";
import { centralIaService } from "@/services/centralIaService";
import { actionEngineService } from "@/services/ia/actionEngineService";
import { memoriaService, type TipoEntidade } from "@/services/ia/memoriaService";
import { cognitivoPlannerService } from "@/services/ia/cognitivoPlannerService";
import type { IaFerramenta, IaExecucaoFerramenta, IaRoboFerramenta } from "@/services/ia/actionEngineService";

export type EstadoAgente = "ativa" | "concluida" | "falhou" | "escalada" | "cancelada";

export type AvaliacaoResultado = {
  tipo: "concluir" | "repetir" | "escalar" | "proxima_ferramenta";
  motivo: string;
  ferramentaSugerida?: string;
  sugestao?: string;
};

export interface IaAgenteExecucao {
  id: string;
  robo_id: string;
  objetivo: string;
  contexto_inicial: Record<string, unknown>;
  estado: EstadoAgente;
  passo_atual: number;
  total_passos: number;
  resultado_final: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SelecaoFerramenta {
  ferramenta: IaFerramenta;
  permissao: IaRoboFerramenta;
  score: number;
  motivo: string;
}

function nowISO(): string {
  return new Date().toISOString();
}

export const agenteService = {
  // ==================== CATÁLOGO APRIMORADO (FASE 2) ====================
  async listarCatalogo(params?: { robo_id?: string; categoria?: string }): Promise<IaFerramenta[]> {
    let query = supabase.from("ia_ferramentas").select("*").eq("ativo", true).order("categoria").order("nome");
    if (params?.categoria) query = query.eq("categoria", params.categoria);
    const { data } = await query;
    return (data as IaFerramenta[]) || [];
  },

  async obterFerramentaCompleta(id: string): Promise<{
    ferramenta: IaFerramenta | null;
    permissoes: IaRoboFerramenta[];
  }> {
    const [ferramenta, permissoes] = await Promise.all([
      supabase.from("ia_ferramentas").select("*").eq("id", id).maybeSingle(),
      supabase.from("ia_robo_ferramentas").select("*").eq("ferramenta_id", id).eq("ativo", true),
    ]);
    return {
      ferramenta: ferramenta.data as IaFerramenta | null,
      permissoes: (permissoes.data || []) as IaRoboFerramenta[],
    };
  },

  // ==================== MOTOR DE SELEÇÃO (FASE 3) ====================
  async selecionarFerramenta(params: {
    roboId: string;
    objetivo: string;
    contexto?: Record<string, unknown>;
  }): Promise<SelecaoFerramenta | null> {
    const { roboId, objetivo, contexto } = params;
    const termoBusca = objetivo.toLowerCase();

    let contextoMemoria = "";
    const ctx = contexto || {};
    if (ctx.entidade_tipo && ctx.entidade_id) {
      try {
        const completo = await memoriaService.montarContextoCompleto({
          roboId, entidadeTipo: ctx.entidade_tipo as TipoEntidade,
          entidadeId: ctx.entidade_id as string, consulta: objetivo,
        });
        contextoMemoria = completo.texto_contexto;
      } catch { /* continua sem memoria */ }
    }

    const [ferramentas, permissoes] = await Promise.all([
      supabase.from("ia_ferramentas").select("*").eq("ativo", true),
      supabase.from("ia_robo_ferramentas").select("*").eq("robo_id", roboId).eq("ativo", true),
    ]);

    const fTools = (ferramentas.data || []) as IaFerramenta[];
    const fPerms = (permissoes.data || []) as IaRoboFerramenta[];
    const permMap = new Map(fPerms.map((p) => [p.ferramenta_id, p]));

    const pontuadas: SelecaoFerramenta[] = [];

    for (const ft of fTools) {
      const perm = permMap.get(ft.id);
      if (!perm) continue;

      let score = 0;
      const motivos: string[] = [];
      const busca = `${ft.nome} ${ft.descricao || ""} ${ft.categoria}`.toLowerCase();

      if (busca.includes(termoBusca)) { score += 50; motivos.push("termo exato"); }
      const termos = termoBusca.split(/\s+/).filter((t) => t.length > 3);
      const matchesTermo = termos.filter((t) => busca.includes(t)).length;
      if (termos.length > 0) { score += (matchesTermo / termos.length) * 30; motivos.push(`${matchesTermo}/${termos.length} termos`); }

      if (ft.categoria === "COMUNICACAO" && (termoBusca.includes("email") || termoBusca.includes("whatsapp") || termoBusca.includes("mensagem") || termoBusca.includes("convite"))) { score += 20; }
      if (ft.categoria === "FINANCEIRO" && (termoBusca.includes("cobrar") || termoBusca.includes("boleto") || termoBusca.includes("saldo") || termoBusca.includes("financeiro") || termoBusca.includes("pagamento") || termoBusca.includes("inadimplencia"))) { score += 20; }
      if (ft.categoria === "DOCUMENTOS" && (termoBusca.includes("contrato") || termoBusca.includes("proposta") || termoBusca.includes("nf") || termoBusca.includes("cte") || termoBusca.includes("xml") || termoBusca.includes("documento") || termoBusca.includes("relatorio") || termoBusca.includes("fiscal"))) { score += 20; }
      if (ft.categoria === "OPERACIONAL" && (termoBusca.includes("agendar") || termoBusca.includes("coleta") || termoBusca.includes("frete") || termoBusca.includes("prestador") || termoBusca.includes("escala") || termoBusca.includes("ocorrencia") || termoBusca.includes("alerta") || termoBusca.includes("processo") || termoBusca.includes("tarefa") || termoBusca.includes("status") || termoBusca.includes("os "))) { score += 20; }
      if (ft.categoria === "RECRUTAMENTO" && (termoBusca.includes("vaga") || termoBusca.includes("candidato") || termoBusca.includes("avaliacao") || termoBusca.includes("convite") || termoBusca.includes("recrutamento"))) { score += 20; }
      if (ft.categoria === "INTEGRACOES" && (termoBusca.includes("cnpj") || termoBusca.includes("cpf") || termoBusca.includes("consulta"))) { score += 20; }
      if (ft.categoria === "COMERCIAL" && (termoBusca.includes("proposta") || termoBusca.includes("orcamento") || termoBusca.includes("venda") || termoBusca.includes("lead") || termoBusca.includes("follow") || termoBusca.includes("pedido") || termoBusca.includes("historico") || termoBusca.includes("cliente"))) { score += 20; }

      if (ft.precisa_aprovacao === false || perm.nivel_autonomia === "EXECUTAR_AUTONOMO") {
        score += 15; motivos.push("execucao autonoma");
      }
      if (ft.risco_operacional === "baixo") { score += 10; motivos.push("risco baixo"); }
      else if (ft.risco_operacional === "critico") { score -= 10; motivos.push("risco critico"); }

      if (score > 0) {
        pontuadas.push({
          ferramenta: ft, permissao: perm, score,
          motivo: motivos.join(", "),
        });
      }
    }

    if (pontuadas.length === 0) {
      void centralIaService.registrarLog({
        robo_id: roboId, acao: "agente_selecao_sem_resultado",
        entrada: { objetivo, contexto }, saida: {}, status: "aviso",
      });
      return null;
    }

    pontuadas.sort((a, b) => b.score - a.score);
    const escolhida = pontuadas[0];

    void centralIaService.registrarLog({
      robo_id: roboId, acao: "agente_ferramenta_selecionada",
      entrada: { objetivo, contexto },
      saida: { ferramenta_id: escolhida.ferramenta.id, ferramenta_nome: escolhida.ferramenta.nome, score: escolhida.score, motivo: escolhida.motivo, alternativas: pontuadas.slice(0, 3).map((p) => ({ nome: p.ferramenta.nome, score: p.score })) },
      status: "sucesso",
    });

    return escolhida;
  },

  // ==================== AVALIAÇÃO DE RESULTADO (FASE 5) ====================
  async avaliarResultado(execucaoId: string): Promise<AvaliacaoResultado> {
    const { data: exec } = await supabase
      .from("ia_execucoes_ferramentas")
      .select("*, ia_ferramentas!inner(nome, categoria)")
      .eq("id", execucaoId)
      .single();

    if (!exec) return { tipo: "escalar", motivo: "Execucao nao encontrada" };

    const res = (exec.resultado || {}) as Record<string, unknown>;
    const status = exec.status as string;
    const erro = exec.erro as string | null;
    const ferramentaNome = (exec as unknown as Record<string, unknown>).ia_ferramentas as { nome: string } | undefined;
    const nome = ferramentaNome?.nome || exec.ferramenta_id;
    const ctx = (exec.contexto || {}) as Record<string, unknown>;
    const chainCtx = (ctx.encadeamento || {}) as Record<"proximo_passo" | "proximo_objetivo", string> | null;

    if (status === "CONCLUIDA") {
      const sucesso = res.status === "sucesso" || res.status === "executado" || !res.erro;
      if (sucesso) {
        if (chainCtx?.proximo_passo === "continuar" && chainCtx.proximo_objetivo) {
          await supabase.from("ia_execucoes_ferramentas").update({
            avaliacao: { tipo: "proxima_ferramenta", motivo: "Sucesso — continuando cadeia" },
          }).eq("id", execucaoId);
          return { tipo: "proxima_ferramenta", motivo: `${nome} concluida com sucesso`, ferramentaSugerida: chainCtx.proximo_objetivo };
        }
        await supabase.from("ia_execucoes_ferramentas").update({
          avaliacao: { tipo: "concluir", motivo: "Execucao concluida com sucesso" },
        }).eq("id", execucaoId);
        return { tipo: "concluir", motivo: `${nome} concluida com sucesso` };
      }
      await supabase.from("ia_execucoes_ferramentas").update({
        avaliacao: { tipo: "repetir", motivo: "Resultado indica falha, tentar novamente" },
      }).eq("id", execucaoId);
      return { tipo: "repetir", motivo: `${nome} retornou resultado inesperado`, sugestao: "Verificar parametros e tentar novamente" };
    }

    if (status === "FALHOU") {
      await supabase.from("ia_execucoes_ferramentas").update({
        avaliacao: { tipo: "escalar", motivo: erro || "Falha na execucao" },
      }).eq("id", execucaoId);
      return { tipo: "escalar", motivo: `${nome} falhou: ${erro || "erro desconhecido"}`,
        sugestao: "Revisar configuracao do conector ou permissao" };
    }

    return { tipo: "escalar", motivo: `Status inesperado: ${status}` };
  },

  // ==================== EXECUÇÃO ENCADEADA (FASE 4) ====================
  async criarSessao(params: {
    roboId: string;
    objetivo: string;
    contexto?: Record<string, unknown>;
    totalPassos?: number;
  }): Promise<IaAgenteExecucao | null> {
    const { data } = await supabase.from("ia_agentes_execucao").insert({
      robo_id: params.roboId, objetivo: params.objetivo,
      contexto_inicial: params.contexto || {}, estado: "ativa",
      passo_atual: 1, total_passos: params.totalPassos || 1,
    }).select().single();
    if (!data) return null;

    void centralIaService.registrarLog({
      robo_id: params.roboId, acao: "agente_sessao_criada",
      entrada: { objetivo: params.objetivo, contexto: params.contexto },
      saida: { sessao_id: data.id }, status: "sucesso",
    });
    return data as IaAgenteExecucao;
  },

  async encadearAcao(params: {
    roboId: string;
    objetivo: string;
    contexto?: Record<string, unknown>;
    maxSteps?: number;
  }): Promise<{
    sucesso: boolean;
    sessao?: IaAgenteExecucao;
    execucoes: IaExecucaoFerramenta[];
    status: string;
    resumo: string;
  }> {
    const maxSteps = params.maxSteps || 5;
    const execucoes: IaExecucaoFerramenta[] = [];

    const sessao = await this.criarSessao({
      roboId: params.roboId, objetivo: params.objetivo,
      contexto: params.contexto, totalPassos: maxSteps,
    });
    if (!sessao) return { sucesso: false, execucoes: [], status: "falhou", resumo: "Erro ao criar sessao" };

    let objetivoAtual = params.objetivo;
    let contextoAtual = { ...(params.contexto || {}), encadeamento: { sessao_id: sessao.id } };

    for (let passo = 1; passo <= maxSteps; passo++) {
      const selecao = await this.selecionarFerramenta({
        roboId: params.roboId, objetivo: objetivoAtual, contexto: contextoAtual,
      });
      if (!selecao) {
        await supabase.from("ia_agentes_execucao").update({
          estado: "escalada", resultado_final: { motivo: "Nenhuma ferramenta encontrada", passo },
        }).eq("id", sessao.id);
        return { sucesso: true, sessao, execucoes, status: "escalada", resumo: `Nenhuma ferramenta adequada para: ${objetivoAtual}` };
      }

      const proxObj = contextoAtual.encadeamento ? (contextoAtual.encadeamento as Record<string, unknown>).proximo_objetivo : undefined;
      const resultado = await actionEngineService.solicitarAcao({
        robo_id: params.roboId,
        ferramenta_id: selecao.ferramenta.id,
        solicitacao: objetivoAtual,
        contexto: { ...contextoAtual, passo_ordem: passo, ferramenta_selecionada: selecao.ferramenta.nome, motivo_selecao: selecao.motivo },
      });
      if (!resultado.sucesso || !resultado.execucao) {
        await supabase.from("ia_agentes_execucao").update({
          estado: "falhou", resultado_final: { erro: resultado.motivo, passo },
        }).eq("id", sessao.id);
        void centralIaService.registrarLog({
          robo_id: params.roboId, acao: "agente_encadeamento_falhou",
          entrada: { sessao_id: sessao.id, passo, objetivo: objetivoAtual },
          saida: {}, status: "erro",
        });
        return { sucesso: true, sessao, execucoes, status: "falhou", resumo: `Passo ${passo} falhou: ${resultado.motivo}` };
      }

      if (resultado.execucao.status === "APROVADA") {
        await actionEngineService.executarAcao(resultado.execucao.id);
      }

      const aval = await this.avaliarResultado(resultado.execucao.id);
      execucoes.push(resultado.execucao);

      if (aval.tipo === "concluir" || passo >= maxSteps) {
        await supabase.from("ia_agentes_execucao").update({
          estado: "concluida", passo_atual: passo,
          resultado_final: { execucoes: execucoes.length, resumo: aval.motivo },
        }).eq("id", sessao.id);
        return { sucesso: true, sessao, execucoes, status: "concluido", resumo: `Concluido em ${passo} passos: ${aval.motivo}` };
      }

      if (aval.tipo === "escalar") {
        await supabase.from("ia_agentes_execucao").update({
          estado: "escalada", passo_atual: passo,
          resultado_final: { execucoes: execucoes.length, motivo: aval.motivo },
        }).eq("id", sessao.id);
        return { sucesso: true, sessao, execucoes, status: "escalada", resumo: `Escalado no passo ${passo}: ${aval.motivo}` };
      }

      if (aval.tipo === "proxima_ferramenta") {
        objetivoAtual = aval.ferramentaSugerida || objetivoAtual;
        contextoAtual = { ...contextoAtual, passo_anterior: resultado.execucao.id };
        await supabase.from("ia_agentes_execucao").update({
          passo_atual: passo,
        }).eq("id", sessao.id);
        continue;
      }

      if (aval.tipo === "repetir") {
        void centralIaService.registrarLog({
          robo_id: params.roboId, acao: "agente_encadeamento_repetindo",
          entrada: { sessao_id: sessao.id, passo, ferramenta: selecao.ferramenta.nome },
          saida: {}, status: "aviso",
        });
      }
    }

    await supabase.from("ia_agentes_execucao").update({
      estado: "concluida", resultado_final: { execucoes: execucoes.length, resumo: "Limite de passos atingido" },
    }).eq("id", sessao.id);
    return { sucesso: true, sessao, execucoes, status: "concluido", resumo: `Limite de ${maxSteps} passos atingido com ${execucoes.length} execucoes` };
  },

  // ==================== F34A: EXECUÇÃO COGNITIVA VIA LLM ====================
  async encadearAcaoCognitiva(params: {
    roboId: string;
    objetivo: string;
    contexto?: Record<string, unknown>;
    maxSteps?: number;
  }): Promise<{
    sucesso: boolean;
    sessao?: IaAgenteExecucao;
    execucoes: IaExecucaoFerramenta[];
    status: string;
    resumo: string;
    origem_planejamento?: "llm" | "fallback";
  }> {
    const maxSteps = params.maxSteps || 5;
    const execucoes: IaExecucaoFerramenta[] = [];
    const ctx = params.contexto || {};

    const sessao = await this.criarSessao({
      roboId: params.roboId, objetivo: params.objetivo,
      contexto: ctx, totalPassos: maxSteps,
    });
    if (!sessao) return { sucesso: false, execucoes: [], status: "falhou", resumo: "Erro ao criar sessao" };

    // Planeja com o motor cognitivo
    const planejamento = await cognitivoPlannerService.planejar({
      roboId: params.roboId,
      objetivo: params.objetivo,
      entidadeTipo: ctx.entidade_tipo as TipoEntidade | undefined,
      entidadeId: ctx.entidade_id as string | undefined,
    });

    if (!planejamento.sucesso || !planejamento.plano) {
      await supabase.from("ia_agentes_execucao").update({
        estado: "falhou",
        resultado_final: { motivo: planejamento.erro || "Falha no planejamento cognitivo" },
      }).eq("id", sessao.id);
      return { sucesso: false, execucoes, status: "falhou", resumo: planejamento.erro || "Falha no planejamento" };
    }

    const plano = planejamento.plano;
    const etapas = plano.etapas.slice(0, maxSteps);

    for (let i = 0; i < etapas.length; i++) {
      const etapa = etapas[i];

      // Buscar o ID da ferramenta pelo codigo_unico
      const { data: ferramenta } = await supabase
        .from("ia_ferramentas")
        .select("id")
        .eq("codigo_unico", etapa.ferramenta_codigo)
        .maybeSingle();

      if (!ferramenta) {
        void centralIaService.registrarLog({
          robo_id: params.roboId, acao: "cognitivo_etapa_ferramenta_nao_encontrada",
          entrada: { codigo: etapa.ferramenta_codigo, etapa: i + 1 },
          saida: {}, status: "erro",
        });
        continue;
      }

      const resultado = await actionEngineService.solicitarAcao({
        robo_id: params.roboId,
        ferramenta_id: ferramenta.id,
        solicitacao: etapa.motivo || params.objetivo,
        contexto: {
          ...ctx,
          passo_ordem: i + 1,
          agente_execucao_id: sessao.id,
          planejamento_cognitivo: {
            analise: plano.analise_contexto,
            raciocinio: plano.raciocinio,
            etapa_motivo: etapa.motivo,
            risco: etapa.risco,
          },
        },
      });

      if (!resultado.sucesso || !resultado.execucao) {
        await supabase.from("ia_agentes_execucao").update({
          estado: "falhou",
          resultado_final: { erro: resultado.motivo, etapa: i + 1 },
        }).eq("id", sessao.id);
        return {
          sucesso: true, sessao, execucoes,
          status: "falhou",
          resumo: `Etapa ${i + 1} (${etapa.ferramenta_nome}) falhou: ${resultado.motivo}`,
          origem_planejamento: planejamento.origem === "llm" ? "llm" : "fallback",
        };
      }

      if (resultado.execucao.status === "APROVADA") {
        await actionEngineService.executarAcao(resultado.execucao.id);
      }

      execucoes.push(resultado.execucao);
    }

    const estadoFinal = execucoes.length > 0 ? "concluida" : "falhou";
    await supabase.from("ia_agentes_execucao").update({
      estado: estadoFinal,
      passo_atual: execucoes.length,
      resultado_final: {
        execucoes: execucoes.length,
        total_planejado: etapas.length,
        analise: plano.analise_contexto,
        raciocinio: plano.raciocinio,
        origem: planejamento.origem,
      },
    }).eq("id", sessao.id);

    return {
      sucesso: true,
      sessao,
      execucoes,
      status: estadoFinal,
      resumo: `${execucoes.length}/${etapas.length} etapas executadas. ${plano.justificativa_geral}`,
      origem_planejamento: planejamento.origem === "llm" ? "llm" : "fallback",
    };
  },

  // ==================== GESTÃO DE SESSÕES ====================
  async listarSessoes(params?: { robo_id?: string; estado?: EstadoAgente; limite?: number }): Promise<IaAgenteExecucao[]> {
    let query = supabase.from("ia_agentes_execucao").select("*").order("created_at", { ascending: false });
    if (params?.robo_id) query = query.eq("robo_id", params.robo_id);
    if (params?.estado) query = query.eq("estado", params.estado);
    if (params?.limite) query = query.limit(params.limite);
    const { data } = await query;
    return (data || []) as IaAgenteExecucao[];
  },

  async obterSessaoCompleta(id: string): Promise<{
    sessao: IaAgenteExecucao | null;
    execucoes: IaExecucaoFerramenta[];
  }> {
    const [sessao, execucoes] = await Promise.all([
      supabase.from("ia_agentes_execucao").select("*").eq("id", id).maybeSingle(),
      supabase.from("ia_execucoes_ferramentas").select("*, ia_ferramentas!left(nome)").eq("agente_execucao_id", id).order("passo_ordem", { ascending: true }),
    ]);
    return {
      sessao: sessao.data as IaAgenteExecucao | null,
      execucoes: (execucoes.data || []) as IaExecucaoFerramenta[],
    };
  },

  async cancelarSessao(id: string, motivo?: string): Promise<void> {
    await supabase.from("ia_agentes_execucao").update({
      estado: "cancelada", resultado_final: { motivo: motivo || "Cancelado pelo gestor" },
    }).eq("id", id);
  },
};

export default agenteService;
