import { supabase } from "@/lib/supabase";
import { centralIaService } from "@/services/centralIaService";
import { memoriaService, type TipoEntidade } from "@/services/ia/memoriaService";
import { agenteService, type SelecaoFerramenta } from "@/services/ia/agenteService";
import { aiProviderManager } from "@/services/ia/aiProviderManager";
import { governancaService } from "@/services/ia/governancaService";
import { identidadeService } from "@/services/ia/identidadeService";
import { externalIntegrationEngine } from "@/services/ia/externalIntegrationEngine";
import { performanceEngineService } from "@/services/ia/performanceEngineService";
import { aiSupervisor } from "@/services/ia/aiSupervisor";
import type { IaFerramenta, IaRoboFerramenta } from "@/services/ia/actionEngineService";

// ==================== TYPES ====================

export interface PlanoEtapa {
  ordem: number;
  ferramenta_codigo: string;
  ferramenta_nome: string;
  motivo: string;
  parametros: Record<string, unknown>;
  risco: "baixo" | "medio" | "alto" | "critico";
  precisa_aprovacao: boolean;
}

export interface PlanoAcao {
  analise_contexto: string;
  objetivo_interpretado: string;
  raciocinio: string;
  etapas: PlanoEtapa[];
  justificativa_geral: string;
  alertas: string[];
}

export interface ResultadoPlanejamento {
  sucesso: boolean;
  plano?: PlanoAcao;
  erro?: string;
  origem: "llm" | "fallback" | "erro";
  prompt_utilizado?: string;
  resposta_llm?: string;
  fallback_selecao?: SelecaoFerramenta | null;
}

// ==================== SERVIÇO ====================

export const cognitivoPlannerService = {
  // ==================== FASE 3: MONTAR PROMPT DINÂMICO ====================
  async montarPromptDinamico(params: {
    roboId: string;
    objetivo: string;
    entidadeTipo?: TipoEntidade;
    entidadeId?: string;
  }): Promise<{
    prompt: string;
    fontes: { tipo: string; count: number }[];
    alertas: string[];
  }> {
    const { roboId, objetivo, entidadeTipo, entidadeId } = params;
    const fontes: { tipo: string; count: number }[] = [];
    const alertas: string[] = [];
    const partes: string[] = [];

    // 1. Robô — identidade, modo, autonomia
    const promptRobo = await centralIaService.montarPromptOperacionalRobo(roboId);
    if (promptRobo.robo) {
      partes.push(promptRobo.promptFinal);
      fontes.push({ tipo: "identidade_robo", count: 1 });
    } else {
      alertas.push("Robô não encontrado");
    }
    alertas.push(...promptRobo.alertasSeguranca);

    // 2. Metas ativas (F31)
    try {
      const metas = await supabase
        .from("ia_metas")
        .select("nome_meta, valor_meta, valor_atual, status, peso, periodicidade, data_referencia_fim")
        .eq("robo_id", roboId)
        .in("status", ["ativa", "atingida"])
        .order("peso", { ascending: false });
      const metasList = (metas.data || []) as {
        nome_meta: string; valor_meta: number; valor_atual: number;
        status: string; peso: number; periodicidade: string; data_referencia_fim: string | null;
      }[];
      if (metasList.length > 0) {
        partes.push("=== METAS ATIVAS DO ROBÔ ===");
        for (const m of metasList) {
          const perc = m.valor_meta > 0 ? Math.round((m.valor_atual / m.valor_meta) * 100) : 0;
          partes.push(`- ${m.nome_meta}: ${m.valor_atual}/${m.valor_meta} (${perc}%) [${m.status}] Peso: ${m.peso}`);
          if (m.data_referencia_fim) partes.push(`  Vencimento: ${m.data_referencia_fim}`);
        }
        fontes.push({ tipo: "metas", count: metasList.length });
      }
    } catch { /* continua sem metas */ }

    // 3. Memória da entidade (F33)
    if (entidadeTipo && entidadeId) {
      try {
        const contextoMemoria = await memoriaService.montarContextoCompleto({
          roboId, entidadeTipo, entidadeId, consulta: objetivo,
        });
        if (contextoMemoria.texto_contexto) {
          partes.push("=== MEMÓRIA DA ENTIDADE ===");
          partes.push(contextoMemoria.texto_contexto);
          fontes.push({ tipo: "memoria_entidade", count: 1 });
        }
      } catch { /* continua sem memoria */ }
    }

    // 4. Catálogo de ferramentas disponíveis com permissões (F34)
    try {
      const [ferramentas, permissoes] = await Promise.all([
        supabase.from("ia_ferramentas").select("*").eq("ativo", true).order("categoria"),
        supabase.from("ia_robo_ferramentas").select("*").eq("robo_id", roboId).eq("ativo", true),
      ]);

      const fTools = (ferramentas.data || []) as IaFerramenta[];
      const fPerms = (permissoes.data || []) as IaRoboFerramenta[];
      const permMap = new Map(fPerms.map((p) => [p.ferramenta_id, p]));

      if (fTools.length > 0) {
        partes.push("=== FERRAMENTAS DISPONÍVEIS ===");
        partes.push(`Formato: [código] Nome — Descrição | Categoria | Risco | Autonomia`);
        for (const ft of fTools) {
          const perm = permMap.get(ft.id);
          if (!perm) continue;
          const autonomia = perm.nivel_autonomia === "EXECUTAR_AUTONOMO" ? "autônoma"
            : perm.nivel_autonomia === "EXECUTAR_COM_APROVACAO" ? "com aprovação" : "consulta";
          partes.push(`  [${ft.codigo_unico}] ${ft.nome} — ${ft.descricao || "sem descrição"} | ${ft.categoria} | risco ${ft.risco_operacional} | ${autonomia}`);
          if (ft.parametros) {
            const paramNames = Object.keys(ft.parametros);
            if (paramNames.length > 0) {
              partes.push(`    Parâmetros: ${paramNames.join(", ")}`);
            }
          }
        }
        fontes.push({ tipo: "ferramentas", count: fTools.length });
      }
    } catch { /* continua sem ferramentas */ }

    // 5. Governança — autoridade, limites, alertas (F35)
    try {
      const contextoGov = await governancaService.obterContextoGovernanca(roboId);
      if (contextoGov.alertas.length > 0) {
        partes.push("=== GOVERNANÇA CORPORATIVA ===");
        partes.push("RESTRIÇÕES ATIVAS PARA ESTE ROBÔ:");
        for (const alerta of contextoGov.alertas) {
          partes.push(`  ⚠️ ${alerta}`);
          alertas.push(alerta);
        }
        fontes.push({ tipo: "governanca_restricoes", count: contextoGov.alertas.length });
        partes.push("");
      }
      if (contextoGov.autoridade.length > 0) {
        partes.push("MATRIZ DE AUTORIDADE:");
        for (const aut of contextoGov.autoridade) {
          partes.push(`  ${aut.permitido ? "✅" : "🚫"} ${aut.acao_tipo}${aut.valor_maximo ? ` (máx: R$ ${aut.valor_maximo})` : ""}${aut.precisa_aprovacao ? " [aprovação necessária]" : ""}`);
        }
        partes.push("");
      }
    } catch { /* continua sem governanca */ }

    // 6. Identidade digital (F36)
    try {
      const contextoIdentidade = await identidadeService.montarContextoIdentidade(roboId);
      if (contextoIdentidade) {
        partes.push(contextoIdentidade);
        fontes.push({ tipo: "identidade_digital", count: 1 });
      }
    } catch { /* continua sem identidade */ }

    // 7. Performance, KPIs e score do robô (F38)
    try {
      const contextoPerformance = await performanceEngineService.montarContextoPerformance(roboId);
      if (contextoPerformance) {
        partes.push(contextoPerformance);
        fontes.push({ tipo: "performance", count: 1 });
      }
    } catch { /* continua sem performance */ }

    // 8. Integrações externas — canais disponíveis no modo seguro (F37)
    try {
      const contextoCanais = externalIntegrationEngine.montarContextoIntegracoes();
      if (contextoCanais) {
        partes.push(contextoCanais);
        fontes.push({ tipo: "integracoes_externas", count: 1 });
      }
    } catch { /* continua sem integracoes */ }

    // 9. Objetivo atual
    partes.push("=== OBJETIVO ATUAL ===");
    partes.push(objetivo);

    // 10. Instrução para o LLM — formato de saída estruturado
    partes.push("");
    partes.push("=== INSTRUÇÕES PARA ANÁLISE ===");
    partes.push("Com base no IDENTIDADE DIGITAL, METAS, PERFORMANCE, MEMÓRIA, FERRAMENTAS, GOVERNANÇA, INTEGRAÇÕES EXTERNAS e OBJETIVO acima:");
    partes.push("1. Analise o contexto completo e interprete o objetivo.");
    partes.push("2. Identifique quais ferramentas do catálogo são adequadas.");
    partes.push("3. Defina a ordem de execução (múltiplas etapas se necessário).");
    partes.push("4. Para cada etapa, informe o código da ferramenta, motivo, parâmetros, risco e se precisa aprovação.");
    partes.push("5. Retorne APENAS UM JSON VÁLIDO (sem markdown, sem texto extra) no formato:");
    partes.push(`{
  "analise_contexto": "resumo do contexto analisado",
  "objetivo_interpretado": "o que o robô entendeu que precisa fazer",
  "raciocinio": "passo a passo do raciocínio, considerando memória, metas e regras",
  "etapas": [
    {
      "ordem": 1,
      "ferramenta_codigo": "CODIGO_UNICO",
      "ferramenta_nome": "Nome da Ferramenta",
      "motivo": "por que esta ferramenta foi escolhida",
      "parametros": {},
      "risco": "baixo|medio|alto|critico",
      "precisa_aprovacao": false
    }
  ],
  "justificativa_geral": "resumo da estratégia",
  "alertas": ["alerta1", "alerta2"]
}`);
    partes.push("");
    partes.push("REGRAS OBRIGATÓRIAS:");
    partes.push("- Use APENAS ferramentas listadas acima.");
    partes.push("- Se o objetivo não puder ser atendido com as ferramentas disponíveis, reporte nos alertas.");
    partes.push("- Considere as metas ativas do robô ao planejar.");
    partes.push("- Considere a memória da entidade para personalizar a ação.");
    partes.push("- Considere as regras de segurança e proibições da instrução ativa.");
    partes.push("- Se o robô não tiver permissão EXECUTAR_AUTONOMO, marque precisa_aprovacao como true.");
    partes.push("- RESPEITE AS RESTRIÇÕES DE GOVERNANÇA: ações bloqueadas não podem ser sugeridas.");
    partes.push("- Ações com valor acima do limite máximo devem ser marcadas para aprovação.");
    partes.push("- Ações que exigem aprovação pela matriz de autoridade devem ter precisa_aprovacao = true.");
    partes.push("- Considere sua IDENTIDADE DIGITAL (perfil, configuração, timezone) ao planejar.");
    partes.push("- Ações fora do perfil da identidade devem ser marcadas para aprovação.");
    partes.push("- Considere a PERFORMANCE DO ROBÔ: performance baixa → estratégia conservadora; performance alta → mais autonomia.");
    partes.push("- Retorna APENAS o JSON, sem explicações adicionais.");

    return {
      prompt: partes.join("\n"),
      fontes,
      alertas,
    };
  },

  // ==================== FASE 2 + 4: PLANEJAR AÇÃO VIA LLM ====================
  async planejar(params: {
    roboId: string;
    objetivo: string;
    entidadeTipo?: TipoEntidade;
    entidadeId?: string;
  }): Promise<ResultadoPlanejamento> {
    const { roboId, objetivo } = params;

    // Monta o prompt dinâmico
    const promptMontado = await this.montarPromptDinamico(params);

    // Registra prompt no log
    void centralIaService.registrarLog({
      robo_id: roboId,
      acao: "cognitivo_prompt_montado",
      entrada: {
        objetivo,
        fontes: promptMontado.fontes,
        alertas: promptMontado.alertas,
        prompt_size: promptMontado.prompt.length,
      },
      saida: {},
      status: promptMontado.alertas.length > 0 ? "aviso" : "info",
    });

    // Classificar complexidade via Supervisor (Missão 31)
    const complexidade = aiSupervisor.classificar("planejamento_cognitivo", objetivo);
    void centralIaService.registrarLog({
      robo_id: roboId,
      acao: "cognitivo_classificado",
      entrada: { objetivo, complexidade },
      saida: {},
      status: "info",
    });

    // Tenta chamar o LLM
    try {
      const respostaLLM = await aiProviderManager.gerarRespostaComFallback(
        promptMontado.prompt,
        "planejamento_cognitivo",
        roboId,
      );

      // Extrai o JSON da resposta
      const jsonMatch = respostaLLM.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // Fallback se não conseguir extrair JSON
        return await this.fallbackDeterministico(roboId, objetivo, params, promptMontado.prompt, respostaLLM);
      }

      const plano = JSON.parse(jsonMatch[0]) as PlanoAcao;

      // Valida o plano
      if (!plano.etapas || !Array.isArray(plano.etapas) || plano.etapas.length === 0) {
        return await this.fallbackDeterministico(roboId, objetivo, params, promptMontado.prompt, respostaLLM);
      }

      // Valida cada etapa
      for (const etapa of plano.etapas) {
        if (!etapa.ferramenta_codigo || !etapa.ferramenta_nome) {
          return await this.fallbackDeterministico(roboId, objetivo, params, promptMontado.prompt, respostaLLM);
        }
      }

      // Auditoria do plano gerado
      void centralIaService.registrarLog({
        robo_id: roboId,
        acao: "cognitivo_plano_gerado",
        entrada: { objetivo, prompt: promptMontado.prompt },
        saida: {
          etapas: plano.etapas.length,
          analise: plano.analise_contexto,
          raciocinio: plano.raciocinio,
          alertas: plano.alertas,
        },
        status: "sucesso",
      });

      void aiProviderManager.registrarLogIA_v2(
        "multi", "llm", "cognitivo_planejar",
        promptMontado.prompt, respostaLLM,
        respostaLLM.length, true, "", { plano_etapas: plano.etapas.length },
      );

      return {
        sucesso: true,
        plano,
        origem: "llm",
        prompt_utilizado: promptMontado.prompt,
        resposta_llm: respostaLLM,
      };
    } catch (err) {
      const erroMsg = err instanceof Error ? err.message : "Erro no LLM";
      console.warn("[CognitivoPlanner] LLM falhou, acionando fallback:", erroMsg);

      void centralIaService.registrarLog({
        robo_id: roboId,
        acao: "cognitivo_llm_falhou",
        entrada: { objetivo, erro: erroMsg },
        saida: {},
        status: "erro",
        erro: erroMsg,
      });

      return await this.fallbackDeterministico(roboId, objetivo, params, promptMontado.prompt, undefined);
    }
  },

  // ==================== FASE 5: FALLBACK DETERMINÍSTICO ====================
  async fallbackDeterministico(
    roboId: string,
    objetivo: string,
    params: { entidadeTipo?: TipoEntidade; entidadeId?: string },
    promptUtilizado?: string,
    respostaLLM?: string,
  ): Promise<ResultadoPlanejamento> {
    try {
      const selecao = await agenteService.selecionarFerramenta({
        roboId,
        objetivo,
        contexto: params.entidadeTipo && params.entidadeId
          ? { entidade_tipo: params.entidadeTipo, entidade_id: params.entidadeId }
          : undefined,
      });

      if (!selecao) {
        void centralIaService.registrarLog({
          robo_id: roboId,
          acao: "cognitivo_fallback_sem_resultado",
          entrada: { objetivo },
          saida: {}, status: "aviso",
        });

        return {
          sucesso: false,
          erro: "Nenhuma ferramenta adequada encontrada via fallback determinístico",
          origem: "fallback",
          prompt_utilizado: promptUtilizado,
          resposta_llm: respostaLLM,
        };
      }

      // Converte seleção determinística em plano
      const plano: PlanoAcao = {
        analise_contexto: "Fallback determinístico — LLM indisponível",
        objetivo_interpretado: objetivo,
        raciocinio: `Seleção por keyword scoring. Ferramenta: ${selecao.ferramenta.nome}. Score: ${selecao.score}. Motivo: ${selecao.motivo}`,
        etapas: [{
          ordem: 1,
          ferramenta_codigo: selecao.ferramenta.codigo_unico,
          ferramenta_nome: selecao.ferramenta.nome,
          motivo: selecao.motivo,
          parametros: {},
          risco: (selecao.ferramenta.risco_operacional as "baixo" | "medio" | "alto" | "critico") || "medio",
          precisa_aprovacao: selecao.ferramenta.precisa_aprovacao && selecao.permissao.nivel_autonomia !== "EXECUTAR_AUTONOMO",
        }],
        justificativa_geral: `Fallback automático. Score: ${selecao.score}. Motivo: ${selecao.motivo}`,
        alertas: ["LLM indisponível — usando fallback determinístico F34"],
      };

      void centralIaService.registrarLog({
        robo_id: roboId,
        acao: "cognitivo_fallback_ativado",
        entrada: { objetivo, score: selecao.score },
        saida: { ferramenta: selecao.ferramenta.nome, score: selecao.score },
        status: "aviso",
      });

      return {
        sucesso: true,
        plano,
        origem: "fallback",
        prompt_utilizado: promptUtilizado,
        resposta_llm: respostaLLM,
        fallback_selecao: selecao,
      };
    } catch (err) {
      const erroMsg = err instanceof Error ? err.message : "Erro no fallback";
      return {
        sucesso: false,
        erro: erroMsg,
        origem: "erro",
      };
    }
  },
};

export default cognitivoPlannerService;
