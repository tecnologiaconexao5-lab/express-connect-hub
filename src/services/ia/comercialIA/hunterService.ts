import { supabase } from "@/lib/supabase";
import { centralIaService } from "@/services/centralIaService";
import { antiDuplicidadeService } from "./antiDuplicidadeService";
import { scoringService } from "./scoringService";
import { comercialFollowUpService } from "./followUpService";
import { aprendizadoService } from "./aprendizadoService";
import { pipelineService } from "./pipelineService";
import { providerRegistry } from "./providers/ProviderRegistry";
import type { HunterConfig, HunterExecucao, HunterResultado, ProspectDados, EstrategiaHunter, IaConfigHunter } from "./types";
import { ESTRATEGIA_PADRAO, IA_CONFIG_PADRAO } from "./types";

export const hunterService = {
  async obterConfig(roboId: string): Promise<HunterConfig | null> {
    const { data } = await supabase
      .from("comercial_hunter_config")
      .select("*")
      .eq("robo_id", roboId)
      .single();
    const config = data as HunterConfig | null;
    if (config) {
      if (!config.estrategia || Object.keys(config.estrategia).length === 0) {
        config.estrategia = { ...ESTRATEGIA_PADRAO };
      }
      if (!config.ia_config || Object.keys(config.ia_config).length === 0) {
        config.ia_config = { ...IA_CONFIG_PADRAO };
      }
    }
    return config;
  },

  async salvarConfig(config: Partial<HunterConfig> & { robo_id: string }): Promise<HunterConfig | null> {
    const existing = await this.obterConfig(config.robo_id);
    let result;
    if (existing) {
      const { data } = await supabase
        .from("comercial_hunter_config")
        .update(config)
        .eq("robo_id", config.robo_id)
        .select()
        .single();
      result = data;
    } else {
      const { data } = await supabase
        .from("comercial_hunter_config")
        .insert([config])
        .select()
        .single();
      result = data;
    }
    if (result) {
      await centralIaService.registrarLog({
        tipo: "info", modulo: "Comercial IA", acao: "config",
        descricao: `Configuracao do Hunter atualizada para modo ${config.modo || "assistido"}`,
      });
    }
    return result as HunterConfig | null;
  },

  async iniciarExecucao(roboId: string): Promise<HunterExecucao | null> {
    const { data, error } = await supabase
      .from("comercial_hunter_execucoes")
      .insert([{ robo_id: roboId, status: "executando", inicio: new Date().toISOString() }])
      .select()
      .single();
    if (error) { console.error("[Hunter] Erro ao iniciar execucao:", error); return null; }
    return data as HunterExecucao;
  },

  async finalizarExecucao(execucaoId: string, dados: {
    status: string; empresas_encontradas: number; leads_criados: number;
    leads_descartados: number; duplicatas_evitadas: number;
    tokens_entrada: number; tokens_saida: number; erro?: string;
  }): Promise<void> {
    await supabase
      .from("comercial_hunter_execucoes")
      .update({
        status: dados.status, fim: new Date().toISOString(),
        empresas_encontradas: dados.empresas_encontradas, leads_criados: dados.leads_criados,
        leads_descartados: dados.leads_descartados, duplicatas_evitadas: dados.duplicatas_evitadas,
        tokens_entrada: dados.tokens_entrada, tokens_saida: dados.tokens_saida,
        custo_estimado: (dados.tokens_entrada + dados.tokens_saida) * 0.000002,
        erro: dados.erro,
      })
      .eq("id", execucaoId);
  },

  async executarCiclo(roboId: string): Promise<{
    executado: boolean; leads_criados: number; resumo: string;
  }> {
    const config = await this.obterConfig(roboId);
    if (!config || !config.ativo) {
      return { executado: false, leads_criados: 0, resumo: "Hunter inativo ou nao configurado" };
    }
    if (config.modo === "manual") {
      return { executado: false, leads_criados: 0, resumo: "Modo manual — execucao bloqueada" };
    }
    if (!this.dentroHorarioPermitido(config)) {
      return { executado: false, leads_criados: 0, resumo: "Fora do horario permitido" };
    }

    const estrategia: EstrategiaHunter = config.estrategia || ESTRATEGIA_PADRAO;
    const iaConfig: IaConfigHunter = config.ia_config || IA_CONFIG_PADRAO;

    const execucao = await this.iniciarExecucao(roboId);
    if (!execucao) {
      return { executado: false, leads_criados: 0, resumo: "Falha ao iniciar execucao" };
    }

    let leadsCriados = 0, leadsDescartados = 0, duplicatasEvitadas = 0, confiancaBaixa = 0;
    let tokensEntrada = 0, tokensSaida = 0;

    try {
      const pipelineRes = await pipelineService.executar(config, estrategia, iaConfig);
      const prospects = pipelineRes.prospects_reais;

      for (const aviso of pipelineRes.avisos) {
        await centralIaService.registrarLog({
          tipo: "info", modulo: "Comercial IA", acao: "provider", descricao: aviso,
        });
      }

      for (const prospect of prospects) {
        const origemValida = pipelineService.validarOrigem(prospect);
        if (!origemValida.valida) {
          confiancaBaixa++;
          await this.salvarResultado(execucao.id, roboId, {
            empresa: prospect.empresa, cidade: prospect.cidade, estado: prospect.estado,
            segmento: prospect.segmento, status: "confianca_baixa",
            urgencia: "baixa", temperatura: "frio", probabilidade: 0, score_ia: 0,
            resumo_ia: origemValida.motivo || "Origem nao identificavel",
            motivo_descarte: origemValida.motivo || "Sem origem confiavel",
            site: prospect.site, telefone: prospect.telefone, whatsapp: prospect.whatsapp,
            email: prospect.email, endereco: prospect.endereco, cnpj: prospect.cnpj,
            necessidade_provavel: "", volume_estimado: "",
            provider_origem: prospect.provider_origem,
            fonte_url: prospect.fonte_url, fonte_nome: prospect.fonte_nome,
            data_coleta: prospect.data_coleta, termo_busca: prospect.termo_busca,
            confianca_origem: prospect.confianca_origem,
            observacao_origem: prospect.observacao_origem,
          });
          continue;
        }

        if (pipelineRes.total_simulados > 0 && prospect.confianca_origem === "simulada") {
          confiancaBaixa++;
          continue;
        }

        const enriquecido = await pipelineService.enriquecerProspect(prospect, estrategia, iaConfig);
        tokensEntrada += 200;

        const segmentosAlvo = estrategia.segmentos_alvo || [];
        const score = scoringService.calcularScore({
          segmento_prioritario: segmentosAlvo.includes(enriquecido.segmento || ""),
          volume_estimado: enriquecido.volume_estimado,
          necessidade_logistica: enriquecido.necessidade_provavel || "",
        }, estrategia);

        const duplicidade = await antiDuplicidadeService.verificarDuplicidade({
          empresa: enriquecido.empresa, cnpj: enriquecido.cnpj,
          email: enriquecido.email, telefone: enriquecido.telefone, site: enriquecido.site,
        }, estrategia);

        if (duplicidade.duplicado) {
          duplicatasEvitadas++;
          await this.salvarResultado(execucao.id, roboId, {
            ...enriquecido, urgencia: score.urgencia, temperatura: score.temperatura,
            probabilidade: score.probabilidade, score_ia: score.score,
            status: "duplicado", resumo_ia: duplicidade.detalhes || `Duplicado: ${duplicidade.tipo}`,
            provider_origem: prospect.provider_origem, fonte_url: prospect.fonte_url,
            fonte_nome: prospect.fonte_nome, data_coleta: prospect.data_coleta,
            termo_busca: prospect.termo_busca, confianca_origem: prospect.confianca_origem,
          });
          continue;
        }

        if (this.ehConcorrente(enriquecido.empresa, enriquecido.segmento, estrategia)) {
          leadsDescartados++;
          await this.salvarResultado(execucao.id, roboId, {
            ...enriquecido, urgencia: score.urgencia, temperatura: score.temperatura,
            probabilidade: score.probabilidade, score_ia: score.score,
            status: "descartado", resumo_ia: "Empresa concorrente — descartada automaticamente",
            motivo_descarte: "Concorrente",
            provider_origem: prospect.provider_origem,
          });
          continue;
        }

        if (this.ehSegmentoProibido(enriquecido.segmento, estrategia)) {
          leadsDescartados++;
          await this.salvarResultado(execucao.id, roboId, {
            ...enriquecido, urgencia: score.urgencia, temperatura: score.temperatura,
            probabilidade: score.probabilidade, score_ia: score.score,
            status: "descartado", resumo_ia: `Segmento proibido: ${enriquecido.segmento}`,
            motivo_descarte: "Segmento proibido",
            provider_origem: prospect.provider_origem,
          });
          continue;
        }

        const scoreMinimo = estrategia?.descarte?.score_minimo_auto ?? config.score_minimo ?? 40;
        if (score.score < scoreMinimo) {
          leadsDescartados++;
          await this.salvarResultado(execucao.id, roboId, {
            ...enriquecido, urgencia: score.urgencia, temperatura: score.temperatura,
            probabilidade: score.probabilidade, score_ia: score.score,
            status: "descartado", resumo_ia: `Score ${score.score} abaixo do minimo (${scoreMinimo})`,
            motivo_descarte: "Score baixo",
            provider_origem: prospect.provider_origem,
          });
          continue;
        }

        const validado = await this.validarComSupervisor(enriquecido, score.score, roboId, estrategia, iaConfig);
        tokensEntrada += 300;
        tokensSaida += 400;

        if (!validado.aprovado) {
          leadsDescartados++;
          await this.salvarResultado(execucao.id, roboId, {
            ...enriquecido, urgencia: score.urgencia, temperatura: score.temperatura,
            probabilidade: score.probabilidade, score_ia: score.score,
            status: "descartado", resumo_ia: validado.justificativa || "Reprovado pelo Supervisor IA",
            motivo_descarte: validado.justificativa || "Supervisor IA reprovou",
            provider_origem: prospect.provider_origem,
          });
          continue;
        }

        const limiteLeads = config.max_leads_por_dia || estrategia?.limites?.leads_por_dia || 10;
        if (leadsCriados >= limiteLeads) {
          await this.salvarResultado(execucao.id, roboId, {
            ...enriquecido, urgencia: score.urgencia, temperatura: score.temperatura,
            probabilidade: score.probabilidade, score_ia: score.score,
            status: "encontrado", resumo_ia: "Limite diario de leads atingido",
            provider_origem: prospect.provider_origem,
          });
          continue;
        }

        const leadCriado = await this.criarLead(enriquecido, score, config, estrategia);
        if (leadCriado) {
          leadsCriados++;
          await this.salvarResultado(execucao.id, roboId, {
            ...enriquecido, urgencia: score.urgencia, temperatura: score.temperatura,
            probabilidade: score.probabilidade, score_ia: score.score,
            status: "lead_criado", resumo_ia: validado.justificativa || `Lead criado com score ${score.score}`,
            provider_origem: prospect.provider_origem, fonte_url: prospect.fonte_url,
            fonte_nome: prospect.fonte_nome, data_coleta: prospect.data_coleta,
            termo_busca: prospect.termo_busca, confianca_origem: prospect.confianca_origem,
          }, leadCriado.id);

          await this.gerarAbordagemELead(enriquecido, leadCriado.id, config, estrategia, iaConfig);
          tokensEntrada += 500;
          tokensSaida += 1000;

          if (score.score >= (estrategia?.lead_quente?.score_minimo || 80)) {
            await this.enviarAlertaLeadQuente(enriquecido, score.score, leadCriado.id);
          }
        }
      }

      const totalProspects = prospects.length + pipelineRes.total_simulados + confiancaBaixa;
      const resumo = `Hunter: ${prospects.length} prospects reais, ${leadsCriados} leads, ${leadsDescartados} descartados, ${duplicatasEvitadas} duplicatas, ${confiancaBaixa} sem origem`;
      await this.finalizarExecucao(execucao.id, {
        status: "concluido", empresas_encontradas: totalProspects,
        leads_criados: leadsCriados, leads_descartados: leadsDescartados,
        duplicatas_evitadas: duplicatasEvitadas,
        tokens_entrada: tokensEntrada, tokens_saida: tokensSaida,
      });

      await centralIaService.registrarLog({
        tipo: "info", modulo: "Comercial IA", acao: "ciclo", descricao: resumo,
      });

      return { executado: true, leads_criados: leadsCriados, resumo };
    } catch (err: any) {
      await this.finalizarExecucao(execucao.id, {
        status: "erro", empresas_encontradas: 0, leads_criados: leadsCriados,
        leads_descartados: leadsDescartados, duplicatas_evitadas: duplicatasEvitadas,
        tokens_entrada: tokensEntrada, tokens_saida: tokensSaida, erro: err.message,
      });
      return { executado: false, leads_criados: leadsCriados, resumo: `Erro: ${err.message}` };
    }
  },

  async validarComSupervisor(
    prospect: ProspectDados, score: number, roboId: string,
    estrategia?: EstrategiaHunter, iaConfig?: IaConfigHunter
  ): Promise<{ aprovado: boolean; justificativa?: string }> {
    if (this.ehConcorrente(prospect.empresa, prospect.segmento, estrategia)) {
      return { aprovado: false, justificativa: "Empresa concorrente ou do setor de logistica" };
    }

    const segmentosProibidos = estrategia?.segmentos_proibidos || [];
    if (segmentosProibidos.some(s => (prospect.segmento || "").toLowerCase().includes(s.toLowerCase()))) {
      return { aprovado: false, justificativa: `Segmento proibido: ${prospect.segmento}` };
    }

    const provider = iaConfig?.provider || "groq";
    const model = iaConfig?.model || "llama-3.1-8b-instant";
    const temperature = iaConfig?.temperature_validacao ?? 0.3;
    const maxTokens = iaConfig?.max_tokens_validacao ?? 500;

    const prompt = `Voce e o Supervisor IA. Analise este prospect:

Empresa: ${prospect.empresa}
Cidade: ${prospect.cidade} / ${prospect.estado}
Segmento: ${prospect.segmento}
Necessidade: ${prospect.necessidade_provavel || "Nao especificada"}
Volume estimado: ${prospect.volume_estimado || "Nao especificado"}
Score: ${score}/100

Criterios de validacao:
1. Empresa TEM necessidade logistica real? (distribuicao, transporte, frete)
2. Perfil e compativel com transportadora?
3. NAO e concorrente?
4. Nao e segmento proibido?
5. Faz sentido comercial?

Retorne APENAS UM JSON:
{
  "aprovado": true/false,
  "justificativa": "Justificativa curta da decisao"
}`;

    const resultado = await proxyIaClient.executar({
      provider, model, prompt, temperature, max_tokens: maxTokens,
    });

    if (resultado.sucesso) {
      try {
        const jsonMatch = resultado.resposta.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
      } catch { /* fallback */ }
    }

    return { aprovado: score >= 50, justificativa: "Aprovado por score minimo" };
  },

  ehConcorrente(empresa?: string, segmento?: string, estrategia?: EstrategiaHunter): boolean {
    const concorrentes = estrategia?.concorrentes || [];
    if (concorrentes.length === 0) return false;
    const texto = `${empresa || ""} ${segmento || ""}`.toLowerCase();
    return concorrentes.some(c => texto.includes(c));
  },

  ehSegmentoProibido(segmento?: string, estrategia?: EstrategiaHunter): boolean {
    const proibidos = estrategia?.segmentos_proibidos || [];
    if (proibidos.length === 0) return false;
    const texto = (segmento || "").toLowerCase();
    return proibidos.some(s => s.toLowerCase() === texto);
  },

  dentroHorarioPermitido(config: HunterConfig): boolean {
    const agora = new Date();
    const diaSemana = agora.getDay();
    if (!config.dias_semana.includes(diaSemana)) return false;
    const horaAtual = agora.getHours() * 60 + agora.getMinutes();
    const [hInicio, mInicio] = (config.horario_inicio || "08:00").split(":").map(Number);
    const [hFim, mFim] = (config.horario_fim || "18:00").split(":").map(Number);
    const inicioMin = hInicio * 60 + mInicio;
    const fimMin = hFim * 60 + mFim;
    return horaAtual >= inicioMin && horaAtual <= fimMin;
  },

  async salvarResultado(
    execucaoId: string, roboId: string,
    dados: Partial<ProspectDados> & {
      urgencia: string; temperatura: string; probabilidade: number; score_ia: number;
      status: string; resumo_ia?: string; motivo_descarte?: string;
      provider_origem?: string; fonte_url?: string; fonte_nome?: string;
      data_coleta?: string; termo_busca?: string;
      confianca_origem?: string; observacao_origem?: string;
    },
    leadId?: string
  ): Promise<HunterResultado | null> {
    const { data, error } = await supabase
      .from("comercial_hunter_resultados")
      .insert([{
        execucao_id: execucaoId, robo_id: roboId,
        empresa: dados.empresa || "", cidade: dados.cidade, estado: dados.estado,
        segmento: dados.segmento, site: dados.site, telefone: dados.telefone,
        whatsapp: dados.whatsapp, email: dados.email,
        responsavel_nome: dados.responsavel_nome, responsavel_cargo: dados.responsavel_cargo,
        linkedin: dados.linkedin, instagram: dados.instagram, facebook: dados.facebook,
        endereco: dados.endereco, cnpj: dados.cnpj,
        necessidade_provavel: dados.necessidade_provavel, volume_estimado: dados.volume_estimado,
        urgencia: dados.urgencia, temperatura: dados.temperatura,
        probabilidade: dados.probabilidade, score_ia: dados.score_ia,
        status: dados.status, lead_id: leadId, motivo_descarte: dados.motivo_descarte,
        resumo_ia: dados.resumo_ia,
        dados_enriquecidos: {
          provider_origem: dados.provider_origem,
          fonte_url: dados.fonte_url,
          fonte_nome: dados.fonte_nome,
          data_coleta: dados.data_coleta,
          termo_busca: dados.termo_busca,
          confianca_origem: dados.confianca_origem,
          observacao_origem: dados.observacao_origem,
        },
      }])
      .select()
      .single();
    if (error) { console.error("[Hunter] Erro ao salvar resultado:", error); return null; }
    return data as HunterResultado;
  },

  async criarLead(
    prospect: ProspectDados,
    score: { score: number; probabilidade: number; temperatura: string; urgencia: string },
    config: HunterConfig, estrategia: EstrategiaHunter
  ): Promise<{ id: string } | null> {
    // Anti-invencao: nao criar lead sem origem identificavel
    if (!prospect.fonte || prospect.fonte.trim() === "" || prospect.fonte === "IA" || prospect.fonte === "Simulado") {
      await centralIaService.registrarLog({
        tipo: "alerta", modulo: "Comercial IA", acao: "lead_bloqueado",
        descricao: `Lead nao criado: ${prospect.empresa} — origem nao identificavel (fonte: "${prospect.fonte}")`,
      });
      return null;
    }

    const empresaNome = estrategia?.abordagem?.empresa_nome || "Conexao Express Transportes";
    const origemDescricao = prospect.provider_origem
      ? `provedor ${prospect.provider_origem} - ${prospect.fonte}`
      : prospect.fonte;

    const { data, error } = await supabase
      .from("crm_leads")
      .insert([{
        empresa: prospect.empresa,
        nome_contato: prospect.responsavel_nome || "",
        telefone: prospect.telefone || "",
        whatsapp: prospect.whatsapp || prospect.telefone || "",
        email: prospect.email || "",
        segmento: prospect.segmento || "",
        regiao: `${prospect.cidade || ""} / ${prospect.estado || ""}`,
        origem: "outbound",
        responsavel: empresaNome,
        tipo_servico: "Carga Fracionada",
        estagio: "lead_novo",
        urgencia: score.urgencia,
        temperatura: score.temperatura,
        valor_estimado_mensal: this.calcularValorEstimado(prospect.volume_estimado),
        probabilidade_fechamento: score.probabilidade,
        observacoes: `[Origem: ${origemDescricao}] ${prospect.resumo_ia || ""}`.trim(),
        timeline: [{
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
          data: new Date().toISOString(),
          tipo: "criacao",
          descricao: `Lead criado pelo Hunter IA via ${origemDescricao}`,
          responsavel: empresaNome,
          canal: "sistema",
        }],
        lembretes: [],
        dias_na_etapa: 0,
      }])
      .select("id")
      .single();

    if (error) { console.error("[Hunter] Erro ao criar lead:", error); return null; }

    await centralIaService.registrarLog({
      tipo: "success", modulo: "Comercial IA", acao: "lead_criado",
      descricao: `Novo lead: ${prospect.empresa} (origem: ${origemDescricao}, score: ${score.score})`,
    });
    return data;
  },

  async gerarAbordagemELead(
    prospect: ProspectDados, leadId: string, config: HunterConfig,
    estrategia: EstrategiaHunter, iaConfig: IaConfigHunter
  ): Promise<void> {
    const canais = estrategia?.canais;
    const canaisConfig = {
      gerar_whatsapp: canais?.whatsapp ?? config.gerar_whatsapp,
      gerar_email: canais?.email ?? config.gerar_email,
      gerar_script_ligacao: canais?.ligacao ?? config.gerar_script_ligacao,
    };

    const abordagem = await comercialFollowUpService.gerarAbordagem({
      empresa: prospect.empresa, responsavel_nome: prospect.responsavel_nome,
      segmento: prospect.segmento || "", cidade: prospect.cidade || "",
      estado: prospect.estado || "", necessidade_provavel: prospect.necessidade_provavel,
    }, canaisConfig, estrategia, iaConfig);

    if (abordagem.whatsapp && config.modo !== "manual" && (canais?.whatsapp ?? config.gerar_whatsapp)) {
      await supabase.from("crm_followups").insert([{
        lead_id: leadId, canal: "whatsapp", tipo: "abordagem_inicial",
        assunto: "Abordagem Inicial",
        mensagem: abordagem.whatsapp,
        status: config.modo === "automatico" ? "pendente" : "rascunho",
      }]);
    }

    if (abordagem.email && config.modo !== "manual" && (canais?.email ?? config.gerar_email)) {
      await supabase.from("crm_followups").insert([{
        lead_id: leadId, canal: "email", tipo: "abordagem_inicial",
        assunto: estrategia?.abordagem?.assunto_email_padrao || "Apresentacao Conexao Express",
        mensagem: abordagem.email,
        status: config.modo === "automatico" ? "pendente" : "rascunho",
      }]);
    }
  },

  async enviarAlertaLeadQuente(prospect: ProspectDados, score: number, leadId: string): Promise<void> {
    const mensagem = `Lead Quente!
Empresa: ${prospect.empresa}
Cidade: ${prospect.cidade} / ${prospect.estado}
Contato: ${prospect.responsavel_nome || "Nao informado"}
Segmento: ${prospect.segmento}
Score: ${score}/100
Necessidade: ${prospect.necessidade_provavel || "Nao especificada"}
Lead ID: ${leadId}`;

    await supabase.from("ia_logs").insert([{
      tipo: "alerta", modulo: "Comercial IA", acao: "lead_quente",
      descricao: mensagem, prioridade: "alta",
    }]);

    await centralIaService.registrarLog({
      tipo: "alerta", modulo: "Comercial IA", acao: "lead_quente", descricao: mensagem,
    });
  },

  calcularValorEstimado(volumeEstimado?: string): number {
    if (!volumeEstimado) return 5000;
    const vol = volumeEstimado.toLowerCase();
    if (vol.includes("alto")) return 25000 + Math.round(Math.random() * 25000);
    if (vol.includes("médio") || vol.includes("medio")) return 10000 + Math.round(Math.random() * 10000);
    return 3000 + Math.round(Math.random() * 5000);
  },

  async obterUltimaExecucao(roboId: string): Promise<HunterExecucao | null> {
    const { data } = await supabase
      .from("comercial_hunter_execucoes")
      .select("*")
      .eq("robo_id", roboId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    return data as HunterExecucao | null;
  },

  async obterDashboard(roboId: string): Promise<{
    total_encontradas: number; total_leads: number; total_descartados: number;
    total_duplicatas: number; total_confianca_baixa: number; leads_quentes: number;
    execucoes: number; ultima_execucao: string | null;
    por_provider: Record<string, { leads: number; descartados: number; duplicatas: number }>;
  }> {
    const [resultados, execucoes, ultima] = await Promise.all([
      supabase.from("comercial_hunter_resultados").select("status, score_ia, dados_enriquecidos", { count: "exact" }).eq("robo_id", roboId),
      supabase.from("comercial_hunter_execucoes").select("id, created_at", { count: "exact" }).eq("robo_id", roboId),
      this.obterUltimaExecucao(roboId),
    ]);
    const todos = resultados.data || [];
    const porProvider: Record<string, { leads: number; descartados: number; duplicatas: number }> = {};

    for (const r of todos) {
      const enr = (r.dados_enriquecidos || {}) as Record<string, any>;
      const pOrigem = typeof enr === "object" && enr.provider_origem ? String(enr.provider_origem) : "desconhecido";
      if (!porProvider[pOrigem]) porProvider[pOrigem] = { leads: 0, descartados: 0, duplicatas: 0 };
      if (r.status === "lead_criado") porProvider[pOrigem].leads++;
      else if (r.status === "descartado") porProvider[pOrigem].descartados++;
      else if (r.status === "duplicado") porProvider[pOrigem].duplicatas++;
    }

    return {
      total_encontradas: todos.length,
      total_leads: todos.filter(r => r.status === "lead_criado").length,
      total_descartados: todos.filter(r => r.status === "descartado").length,
      total_duplicatas: todos.filter(r => r.status === "duplicado").length,
      total_confianca_baixa: todos.filter(r => r.status === "confianca_baixa").length,
      leads_quentes: todos.filter(r => r.score_ia >= 80).length,
      execucoes: execucoes.count || 0,
      ultima_execucao: ultima?.created_at || null,
      por_provider: porProvider,
    };
  },
};
