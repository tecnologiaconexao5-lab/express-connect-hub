import { supabase } from "@/lib/supabase";
import { centralIaService, type AutomacaoRobo } from "@/services/centralIaService";
import { conectoresService } from "@/services/ia/conectoresService";
import { memoriaService } from "@/services/ia/memoriaService";
import { governancaService } from "@/services/ia/governancaService";
import { identidadeService } from "@/services/ia/identidadeService";
import { externalIntegrationEngine } from "@/services/ia/externalIntegrationEngine";

const CANAIS_VALIDOS = ["whatsapp", "email", "zoho_mail", "crm", "leads", "google_ads", "meta_ads", "api_externa", "webhook"] as const;

export type CategoriaFerramenta =
  | "COMUNICACAO" | "MARKETING" | "FINANCEIRO" | "OPERACIONAL"
  | "COMERCIAL" | "DOCUMENTOS" | "AUTOMACAO_WEB" | "INTEGRACOES" | "RECRUTAMENTO";

export type NivelAutonomiaFerramenta =
  | "CONSULTA" | "EXECUTAR_COM_APROVACAO" | "EXECUTAR_AUTONOMO";

export type StatusExecucaoFerramenta =
  | "SOLICITADA" | "AGUARDANDO_APROVACAO" | "APROVADA"
  | "EM_EXECUCAO" | "CONCLUIDA" | "FALHOU" | "CANCELADA";

export interface IaFerramenta {
  id: string;
  codigo_unico: string;
  nome: string;
  descricao: string | null;
  categoria: CategoriaFerramenta;
  ativo: boolean;
  precisa_aprovacao: boolean;
  risco_operacional: string;
  custo_estimado: string | null;
  limite_execucoes_dia: number;
  parametros: Record<string, unknown> | null;
  timeout_segundos: number | null;
  created_at: string;
  updated_at: string;
}

export interface IaRoboFerramenta {
  id: string;
  robo_id: string;
  ferramenta_id: string;
  nivel_autonomia: NivelAutonomiaFerramenta;
  limite_diario: number | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  ferramenta_nome?: string;
  ferramenta_categoria?: string;
  robo_nome?: string;
}

export interface IaExecucaoFerramenta {
  id: string;
  robo_id: string;
  ferramenta_id: string;
  tarefa_id: string | null;
  aprovacao_id: string | null;
  solicitacao: string;
  contexto: Record<string, unknown>;
  status: StatusExecucaoFerramenta;
  resultado: Record<string, unknown>;
  erro: string | null;
  inicio_execucao: string | null;
  fim_execucao: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  agente_execucao_id: string | null;
  passo_ordem: number;
  created_at: string;
  updated_at: string;
  robo_nome?: string;
  ferramenta_nome?: string;
}

function nowISO(): string {
  return new Date().toISOString();
}

function horaAtual(): string {
  return new Date().toTimeString().slice(0, 5);
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export const actionEngineService = {
  // ==================== CATÁLOGO DE FERRAMENTAS ====================
  async listarFerramentas(): Promise<IaFerramenta[]> {
    const { data } = await supabase
      .from("ia_ferramentas")
      .select("*")
      .order("categoria")
      .order("nome");
    return (data as IaFerramenta[]) || [];
  },

  async criarFerramenta(dados: {
    codigo_unico: string;
    nome: string;
    descricao?: string;
    categoria: CategoriaFerramenta;
    precisa_aprovacao?: boolean;
    risco_operacional?: string;
    custo_estimado?: string;
    limite_execucoes_dia?: number;
  }): Promise<IaFerramenta | null> {
    const { data, error } = await supabase.from("ia_ferramentas").insert({
      codigo_unico: dados.codigo_unico,
      nome: dados.nome,
      descricao: dados.descricao || null,
      categoria: dados.categoria,
      precisa_aprovacao: dados.precisa_aprovacao ?? true,
      risco_operacional: dados.risco_operacional || "baixo",
      custo_estimado: dados.custo_estimado || null,
      limite_execucoes_dia: dados.limite_execucoes_dia || 10,
    }).select().single();
    if (error) { console.error("[ActionEngine] erro criar ferramenta:", error.message); return null; }
    void centralIaService.registrarLog({
      acao: "ferramenta_criada",
      entrada: { codigo: dados.codigo_unico, nome: dados.nome },
      saida: { ferramenta_id: data.id },
      status: "sucesso",
    });
    return data as IaFerramenta;
  },

  async atualizarFerramenta(id: string, dados: Partial<IaFerramenta>): Promise<void> {
    await supabase.from("ia_ferramentas").update({ ...dados, updated_at: nowISO() }).eq("id", id);
  },

  // ==================== PERMISSÕES ROBÔ × FERRAMENTA ====================
  async listarPermissoes(filtros?: { robo_id?: string; ferramenta_id?: string }): Promise<IaRoboFerramenta[]> {
    let query = supabase
      .from("ia_robo_ferramentas")
      .select("*, ia_ferramentas!inner(nome, categoria), automacoes_robos!inner(nome)")
      .order("created_at", { ascending: false });
    if (filtros?.robo_id) query = query.eq("robo_id", filtros.robo_id);
    if (filtros?.ferramenta_id) query = query.eq("ferramenta_id", filtros.ferramenta_id);
    const { data } = await query;
    return ((data as Record<string, unknown>[]) || []).map((r) => ({
      ...r,
      ferramenta_nome: (r as { ia_ferramentas?: { nome: string } }).ia_ferramentas?.nome,
      ferramenta_categoria: (r as { ia_ferramentas?: { categoria: string } }).ia_ferramentas?.categoria,
      robo_nome: (r as { automacoes_robos?: { nome: string } }).automacoes_robos?.nome,
    })) as IaRoboFerramenta[];
  },

  async vincularFerramenta(dados: {
    robo_id: string;
    ferramenta_id: string;
    nivel_autonomia?: NivelAutonomiaFerramenta;
    limite_diario?: number;
    horario_inicio?: string;
    horario_fim?: string;
  }): Promise<IaRoboFerramenta | null> {
    const { data, error } = await supabase.from("ia_robo_ferramentas").upsert({
      robo_id: dados.robo_id,
      ferramenta_id: dados.ferramenta_id,
      nivel_autonomia: dados.nivel_autonomia || "EXECUTAR_COM_APROVACAO",
      limite_diario: dados.limite_diario || null,
      horario_inicio: dados.horario_inicio || null,
      horario_fim: dados.horario_fim || null,
      ativo: true,
    }, { onConflict: "robo_id, ferramenta_id" }).select().single();
    if (error) { console.error("[ActionEngine] erro vincular:", error.message); return null; }
    void centralIaService.registrarLog({
      robo_id: dados.robo_id,
      acao: "ferramenta_vinculada",
      entrada: { ferramenta_id: dados.ferramenta_id },
      saida: { permissao_id: data.id },
      status: "sucesso",
    });
    return data as IaRoboFerramenta;
  },

  async desvincularFerramenta(id: string): Promise<void> {
    await supabase.from("ia_robo_ferramentas").update({ ativo: false, updated_at: nowISO() }).eq("id", id);
  },

  async atualizarPermissao(id: string, dados: Partial<IaRoboFerramenta>): Promise<void> {
    await supabase.from("ia_robo_ferramentas").update({ ...dados, updated_at: nowISO() }).eq("id", id);
  },

  // ==================== VALIDAÇÕES (F3) ====================
  async validarPermissao(roboId: string, ferramentaId: string): Promise<{
    permitido: boolean;
    motivo?: string;
    permissao?: IaRoboFerramenta;
  }> {
    const { data } = await supabase
      .from("ia_robo_ferramentas")
      .select("*, ia_ferramentas!inner(*)")
      .eq("robo_id", roboId)
      .eq("ferramenta_id", ferramentaId)
      .eq("ativo", true)
      .maybeSingle();

    if (!data) return { permitido: false, motivo: "Robô não possui permissão para esta ferramenta" };
    return { permitido: true, permissao: data as unknown as IaRoboFerramenta };
  },

  async validarHorario(permissao: IaRoboFerramenta): Promise<{ valido: boolean; motivo?: string }> {
    if (!permissao.horario_inicio && !permissao.horario_fim) return { valido: true };
    const agora = horaAtual();
    if (permissao.horario_inicio && permissao.horario_fim) {
      if (agora < permissao.horario_inicio || agora > permissao.horario_fim) {
        return { valido: false, motivo: `Fora do horário permitido (${permissao.horario_inicio} - ${permissao.horario_fim})` };
      }
    }
    return { valido: true };
  },

  async validarLimitesDiarios(roboId: string, ferramentaId: string): Promise<{
    valido: boolean;
    motivo?: string;
    usadasHoje: number;
    limite: number;
  }> {
    const { data: ferramenta } = await supabase.from("ia_ferramentas").select("limite_execucoes_dia").eq("id", ferramentaId).single();
    const limite = ferramenta?.limite_execucoes_dia || 10;

    const { data: permissao } = await supabase
      .from("ia_robo_ferramentas")
      .select("limite_diario")
      .eq("robo_id", roboId)
      .eq("ferramenta_id", ferramentaId)
      .maybeSingle();

    const limiteEfetivo = (permissao?.limite_diario || limite) as number;

    const { count } = await supabase
      .from("ia_execucoes_ferramentas")
      .select("id", { count: "exact", head: true })
      .eq("robo_id", roboId)
      .eq("ferramenta_id", ferramentaId)
      .gte("created_at", `${hojeISO()}T00:00:00`)
      .lte("created_at", `${hojeISO()}T23:59:59`)
      .in("status", ["CONCLUIDA", "EM_EXECUCAO", "APROVADA"]);

    const usadasHoje = count || 0;
    if (usadasHoje >= limiteEfetivo) {
      return { valido: false, motivo: `Limite diário excedido (${usadasHoje}/${limiteEfetivo})`, usadasHoje, limite: limiteEfetivo };
    }
    return { valido: true, usadasHoje, limite: limiteEfetivo };
  },

  // ==================== SOLICITAÇÃO E EXECUÇÃO (F4) ====================
  async solicitarAcao(params: {
    robo_id: string;
    ferramenta_id: string;
    solicitacao: string;
    contexto?: Record<string, unknown>;
  }): Promise<{ sucesso: boolean; execucao?: IaExecucaoFerramenta; motivo?: string }> {
    const roboId = params.robo_id;
    const ferramentaId = params.ferramenta_id;

    const perm = await actionEngineService.validarPermissao(roboId, ferramentaId);
    if (!perm.permitido) return { sucesso: false, motivo: perm.motivo };

    const horario = await actionEngineService.validarHorario(perm.permissao!);
    if (!horario.valido) return { sucesso: false, motivo: horario.motivo };

    const limites = await actionEngineService.validarLimitesDiarios(roboId, ferramentaId);
    if (!limites.valido) return { sucesso: false, motivo: limites.motivo };

    const { data: ferramenta } = await supabase.from("ia_ferramentas").select("*").eq("id", ferramentaId).single();

    // Verifica se o robô possui conector externo vinculado em modo PRODUCAO_ASSISTIDA
    const vinculosExt = await conectoresService.listarVinculos({ robo_id: roboId });
    const temConectorAssistido = vinculosExt.some(v => v.ativo && v.modo === "PRODUCAO_ASSISTIDA");
    const precisaAprovacao = (ferramenta?.precisa_aprovacao !== false || temConectorAssistido)
      && perm.permissao?.nivel_autonomia !== "EXECUTAR_AUTONOMO";

    const ctx = params.contexto || {};
    const agenteExecucaoId = (ctx.agente_execucao_id as string) || (ctx.encadeamento as Record<string, unknown> | undefined)?.sessao_id as string || null;
    const passoOrdem = (ctx.passo_ordem as number) || 1;

    // F35: Avaliação de governança antes de executar
    const codigoAcao = ferramenta?.codigo_unico || ferramentaId;
    const valorAcao = (ctx.valor as number) || (ctx.valor_financeiro as number) || 0;
    const govAvaliacao = await governancaService.avaliarAcao({
      roboId, acaoTipo: codigoAcao, valor: valorAcao, contexto: ctx,
    });
    if (!govAvaliacao.permitido) {
      return { sucesso: false, motivo: govAvaliacao.motivo };
    }

    // F36: Validação de identidade (sessão ativa)
    const identidade = await identidadeService.obterIdentidade(roboId);
    if (identidade && (identidade.status === "bloqueada" || identidade.status === "inativa")) {
      return { sucesso: false, motivo: `Identidade ${identidade.nome_operacional} está ${identidade.status}` };
    }

    // F36: Cria sessão operacional automaticamente se não existir
    let sessaoId = (ctx.sessao_id as string) || null;
    if (identidade && !sessaoId) {
      try {
        const sessao = await identidadeService.iniciarSessao({
          roboId,
          motivo: `Execução: ${params.solicitacao.slice(0, 100)}`,
          contexto_inicial: { ferramenta_id: ferramentaId, solicitacao: params.solicitacao, contexto: params.contexto },
          criado_por: "action_engine",
        });
        if (sessao) {
          sessaoId = sessao.id;
          ctx.sessao_id = sessaoId;
        }
      } catch { /* sessao opcional */ }
    }

    const precisaGovAprovacao = govAvaliacao.precisa_aprovacao;
    const { data: execucao, error } = await supabase.from("ia_execucoes_ferramentas").insert({
      robo_id: roboId,
      ferramenta_id: ferramentaId,
      solicitacao: params.solicitacao,
      contexto: { ...ctx, governanca: { avaliacao: govAvaliacao.motivo, risco: govAvaliacao.risco, nivel: govAvaliacao.nivel_escalonamento } },
      status: (precisaAprovacao || precisaGovAprovacao) ? "SOLICITADA" : "APROVADA",
      agente_execucao_id: agenteExecucaoId || null,
      passo_ordem: passoOrdem,
    }).select().single();

    if (error) {
      console.error("[ActionEngine] erro criar execucao:", error.message);
      return { sucesso: false, motivo: "Erro ao criar execução" };
    }

    const exec = execucao as IaExecucaoFerramenta;

    const precisaAprovGeral = precisaAprovacao || precisaGovAprovacao;
    if (precisaAprovGeral) {
      const tarefa = await centralIaService.criarTarefa({
        robo_id: roboId,
        setor: "Geral",
        tipo_tarefa: "execucao_ferramenta",
        titulo: `[${ferramenta?.nome || ferramentaId}] ${params.solicitacao.slice(0, 80)}`,
        descricao: params.solicitacao,
        prioridade: "normal",
        payload: { execucao_id: exec.id, ferramenta_id: ferramentaId, solicitacao: params.solicitacao },
      });

      if (tarefa) {
        const aprovacao = await centralIaService.criarAprovacao({
          tarefa_id: tarefa.id,
          tipo_aprovacao: "outro",
          conteudo_original: { solicitacao: params.solicitacao, contexto: params.contexto },
          conteudo_sugerido: { ferramenta: ferramenta?.nome, acao: params.solicitacao },
        });

        if (aprovacao) {
          await supabase.from("ia_execucoes_ferramentas").update({
            tarefa_id: tarefa.id,
            aprovacao_id: aprovacao.id,
            status: "AGUARDANDO_APROVACAO",
            updated_at: nowISO(),
          }).eq("id", exec.id);
          exec.tarefa_id = tarefa.id;
          exec.aprovacao_id = aprovacao.id;
          exec.status = "AGUARDANDO_APROVACAO";
        }
      }

      // F35: Registra aprovação na fila de governança
      if (precisaGovAprovacao) {
        await governancaService.criarAprovacao({
          roboId, acaoTipo: codigoAcao,
          descricao: params.solicitacao,
          contexto: { ...ctx, execucao_id: exec.id, ferramenta: ferramenta?.nome },
          justificativa: `Governança exige aprovação para ${codigoAcao}. Risco: ${govAvaliacao.risco}. Nível: ${govAvaliacao.nivel_escalonamento}`,
          risco: govAvaliacao.risco,
          valorFinanceiro: valorAcao,
          nivelAtual: govAvaliacao.nivel_escalonamento,
          execucaoFerramentaId: exec.id,
        });
      }
    } else {
      exec.status = "APROVADA";
      void actionEngineService.executarAcao(exec.id);
    }

    void centralIaService.registrarLog({
      robo_id: roboId,
      acao: "acao_solicitada",
      entrada: { ferramenta_id: ferramentaId, solicitacao: params.solicitacao },
      saida: { execucao_id: exec.id, status: exec.status },
      status: "info",
    });

    return { sucesso: true, execucao: exec };
  },

  async executarAcao(execucaoId: string): Promise<boolean> {
    const { data: exec } = await supabase
      .from("ia_execucoes_ferramentas")
      .select("*, ia_ferramentas!inner(*)")
      .eq("id", execucaoId)
      .single();
    if (!exec) return false;

    await supabase.from("ia_execucoes_ferramentas").update({
      status: "EM_EXECUCAO",
      inicio_execucao: nowISO(),
      updated_at: nowISO(),
    }).eq("id", execucaoId);

    void centralIaService.registrarLog({
      robo_id: exec.robo_id,
      acao: "acao_executando",
      entrada: { execucao_id: execucaoId },
      saida: {},
      status: "info",
    });

    const ferramentaNome = (exec as unknown as { ia_ferramentas?: { nome: string } }).ia_ferramentas?.nome;

    const ctx = exec.contexto as Record<string, unknown> || {};
    let textoContextoMemoria = "";
    if (ctx.entidade_tipo && ctx.entidade_id) {
      try {
        const completo = await memoriaService.montarContextoCompleto({
          roboId: exec.robo_id,
          entidadeTipo: ctx.entidade_tipo as "cliente" | "lead" | "motorista" | "prestador" | "fornecedor" | "colaborador" | "robo" | "projeto" | "contrato" | "outro",
          entidadeId: ctx.entidade_id as string,
          consulta: exec.solicitacao,
        });
        textoContextoMemoria = completo.texto_contexto;
        void centralIaService.registrarLog({
          robo_id: exec.robo_id,
          acao: "memoria_consultada",
          entrada: { entidade_tipo: ctx.entidade_tipo, entidade_id: ctx.entidade_id, motivo: "executar_acao", ferramenta: ferramentaNome },
          saida: { contexto_length: completo.texto_contexto.length, preferencias: completo.preferencias.length, eventos: completo.eventos_recentes.length },
          status: "info",
        });
      } catch { /* memoria indisponivel — continua sem contexto */ }
    }

    // F37: Pipeline de integração externa (modo seguro) — registra intenção antes de executar
    const sessaoId = ctx.sessao_id as string | undefined;
    const canalIntencao = ctx.canal_integracao as string | undefined;
    const acaoIntencao = ctx.acao_integracao as string | undefined;
    if (canalIntencao && acaoIntencao && (CANAIS_VALIDOS as readonly string[]).includes(canalIntencao)) {
      try {
        const resultado = await externalIntegrationEngine.executarIntegracao({
          roboId: exec.robo_id,
          sessaoId,
          intencao: {
            canal: canalIntencao as "whatsapp" | "email" | "zoho_mail" | "crm" | "leads" | "google_ads" | "meta_ads" | "api_externa" | "webhook",
            acao: acaoIntencao,
            payload: (ctx.payload_integracao as Record<string, unknown>) || {},
            entidade_tipo: ctx.entidade_tipo as string | undefined,
            entidade_id: ctx.entidade_id as string | undefined,
          },
        });
        ctx.integracao_externa = { resultado, log_id: resultado.log_id, modo_seguro: true };
        if (!resultado.sucesso) {
          void centralIaService.registrarLog({
            robo_id: exec.robo_id, acao: "integracao_externa_bloqueada",
            entrada: { canal: canalIntencao, acao: acaoIntencao, motivo: resultado.motivo },
            saida: { status: resultado.status, log_id: resultado.log_id }, status: "aviso",
          });
        }
      } catch { /* integracao externa indisponivel — continua sem */ }
    }

    try {
      const vinculos = await conectoresService.listarVinculos({ robo_id: exec.robo_id });
      const vinculoAtivo = vinculos.find(v => v.ativo);

      let resultadoConector: Record<string, unknown>;

      if (vinculoAtivo) {
        const conectorExec = await conectoresService.registrarExecucao({
          robo_id: exec.robo_id,
          conector_id: vinculoAtivo.conector_id,
          ferramenta_id: exec.ferramenta_id,
          acao: `${ferramentaNome || exec.ferramenta_id}: ${exec.solicitacao}`,
          payload: { solicitacao: exec.solicitacao, contexto: exec.contexto },
          modo: vinculoAtivo.modo,
        });

        if (conectorExec) {
          const executou = await conectoresService.executarConector(conectorExec.id);
          resultadoConector = {
            ...conectorExec.resultado,
            conector_execucao_id: conectorExec.id,
            conector_status: executou ? "executado" : "falhou",
            ferramenta: ferramentaNome,
          };
        } else {
          resultadoConector = {
            status: "simulado",
            mensagem: "Ação simulada via Action Engine (sem execução real de conector)",
            ferramenta: ferramentaNome,
            solicitacao: exec.solicitacao,
            timestamp: nowISO(),
            ambiente: "simulado",
            contexto_memoria: textoContextoMemoria || undefined,
          };
        }
      } else {
        resultadoConector = {
          status: "simulado",
          mensagem: "Nenhum conector vinculado ao robô. Ação simulada em ambiente controlado.",
          ferramenta: ferramentaNome,
          solicitacao: exec.solicitacao,
          timestamp: nowISO(),
          ambiente: "simulado",
          observacao: "Vincule um conector ao robô na aba Conectores para executar em modo real.",
          contexto_memoria: textoContextoMemoria || undefined,
        };
      }

      const codigoUnico = ((exec as unknown as { ia_ferramentas?: { codigo_unico: string } }).ia_ferramentas?.codigo_unico || "");
      const resultadoReal = await executarAcaoReal(codigoUnico, exec.robo_id, exec.solicitacao, exec.contexto as Record<string, unknown> || {}, textoContextoMemoria);
      if (resultadoReal) {
        resultadoConector = { ...resultadoConector, ...resultadoReal, execucao_real: true };
      }

      await supabase.from("ia_execucoes_ferramentas").update({
        status: "CONCLUIDA",
        resultado: resultadoConector,
        fim_execucao: nowISO(),
        updated_at: nowISO(),
      }).eq("id", execucaoId);

      void centralIaService.registrarLog({
        robo_id: exec.robo_id,
        acao: "acao_concluida",
        entrada: { execucao_id: execucaoId },
        saida: resultadoConector,
        status: "sucesso",
      });

      // F36: Incrementa contagem de ações da sessão
      const execContext = exec.contexto as Record<string, unknown> || {};
      const sessaoId = execContext.sessao_id as string;
      if (sessaoId) {
        void identidadeService.incrementarAcoesSessao(sessaoId);
      }

      return true;
    } catch (err) {
      const erroMsg = err instanceof Error ? err.message : "Erro desconhecido na execução";
      await supabase.from("ia_execucoes_ferramentas").update({
        status: "FALHOU",
        erro: erroMsg,
        fim_execucao: nowISO(),
        updated_at: nowISO(),
      }).eq("id", execucaoId);

      void centralIaService.registrarLog({
        robo_id: exec.robo_id,
        acao: "acao_falhou",
        entrada: { execucao_id: execucaoId },
        saida: {},
        status: "erro",
        erro: erroMsg,
      });

      return false;
    }
  },

  async aprovarExecucao(execucaoId: string, aprovadoPor?: string): Promise<void> {
    await supabase.from("ia_execucoes_ferramentas").update({
      status: "APROVADA",
      aprovado_por: aprovadoPor || null,
      aprovado_em: nowISO(),
      updated_at: nowISO(),
    }).eq("id", execucaoId);

    void actionEngineService.executarAcao(execucaoId);
  },

  async cancelarExecucao(execucaoId: string): Promise<void> {
    await supabase.from("ia_execucoes_ferramentas").update({
      status: "CANCELADA",
      updated_at: nowISO(),
    }).eq("id", execucaoId);
  },

  async registrarErro(execucaoId: string, erro: string): Promise<void> {
    await supabase.from("ia_execucoes_ferramentas").update({
      status: "FALHOU",
      erro,
      fim_execucao: nowISO(),
      updated_at: nowISO(),
    }).eq("id", execucaoId);
  },

  // ==================== HISTÓRICO E ESTATÍSTICAS ====================
  async listarHistorico(params?: {
    robo_id?: string;
    ferramenta_id?: string;
    status?: StatusExecucaoFerramenta;
    limite?: number;
  }): Promise<IaExecucaoFerramenta[]> {
    let query = supabase
      .from("ia_execucoes_ferramentas")
      .select("*, ia_ferramentas!left(nome), automacoes_robos!left(nome)")
      .order("created_at", { ascending: false });
    if (params?.robo_id) query = query.eq("robo_id", params.robo_id);
    if (params?.ferramenta_id) query = query.eq("ferramenta_id", params.ferramenta_id);
    if (params?.status) query = query.eq("status", params.status);
    if (params?.limite) query = query.limit(params.limite);
    const { data } = await query;
    return ((data as Record<string, unknown>[]) || []).map((e) => ({
      ...e,
      robo_nome: (e as { automacoes_robos?: { nome: string } }).automacoes_robos?.nome,
      ferramenta_nome: (e as { ia_ferramentas?: { nome: string } }).ia_ferramentas?.nome,
    })) as IaExecucaoFerramenta[];
  },

  async obterEstatisticas(): Promise<{
    total_ferramentas: number;
    total_permissoes: number;
    total_execucoes: number;
    concluidas: number;
    falhas: number;
    pendentes: number;
    ferramentas_por_categoria: Record<string, number>;
  }> {
    const { data: ferramentas } = await supabase.from("ia_ferramentas").select("categoria");
    const { data: permissoes } = await supabase.from("ia_robo_ferramentas").select("id", { count: "exact", head: true });
    const { data: execs } = await supabase.from("ia_execucoes_ferramentas").select("status");

    const cats: Record<string, number> = {};
    for (const f of (ferramentas || []) as { categoria: string }[]) {
      cats[f.categoria] = (cats[f.categoria] || 0) + 1;
    }

    const execsList = (execs || []) as { status: string }[];
    return {
      total_ferramentas: (ferramentas || []).length,
      total_permissoes: (permissoes as unknown as { id: string }[] | null)?.length || 0,
      total_execucoes: execsList.length,
      concluidas: execsList.filter((e) => e.status === "CONCLUIDA").length,
      falhas: execsList.filter((e) => e.status === "FALHOU").length,
      pendentes: execsList.filter((e) => ["SOLICITADA", "AGUARDANDO_APROVACAO", "APROVADA"].includes(e.status)).length,
      ferramentas_por_categoria: cats,
    };
  },
};

async function executarAcaoReal(
  codigoUnico: string,
  roboId: string,
  solicitacao: string,
  contexto: Record<string, unknown>,
  textoContextoMemoria: string,
): Promise<Record<string, unknown> | null> {
  const log = (acao: string, entrada: Record<string, unknown>, saida: Record<string, unknown>, status: string, erro?: string) => {
    void centralIaService.registrarLog({ robo_id: roboId, acao, entrada, saida, status, erro });
  };

  try {
    // FASE 5 - MISSAO 01: Dupla barreira de governanca
    // Re-verifica autorizacao imediatamente antes da execucao real
    const govRecheck = await governancaService.avaliarAcao({
      roboId,
      acaoTipo: codigoUnico,
      valor: contexto.valor as number | undefined,
      contexto,
    });

    if (!govRecheck.permitido) {
      const resultadoBloqueio = {
        execucao_real: true,
        status: "BLOQUEADA",
        tabela: null,
        registros: 0,
        motivo: govRecheck.motivo || "Acao bloqueada pela governanca na re-verificacao",
      };
      void centralIaService.registrarLog({
        robo_id: roboId,
        acao: codigoUnico,
        entrada: { solicitacao, contexto },
        saida: resultadoBloqueio,
        status: "bloqueada_governanca",
        erro: govRecheck.motivo,
      });
      return resultadoBloqueio;
    }

    if (govRecheck.precisa_aprovacao) {
      const resultadoAprovacao = {
        execucao_real: true,
        status: "AGUARDANDO_APROVACAO",
        tabela: null,
        registros: 0,
        motivo: govRecheck.motivo || "Acao requer aprovacao na re-verificacao",
      };
      void centralIaService.registrarLog({
        robo_id: roboId,
        acao: codigoUnico,
        entrada: { solicitacao, contexto },
        saida: resultadoAprovacao,
        status: "aguardando_aprovacao",
        erro: "Re-verificacao de governanca requer aprovacao",
      });
      return resultadoAprovacao;
    }

    switch (codigoUnico) {
      // ==================== COM_CRIAR_TAREFA ====================
      case "COM_CRIAR_TAREFA": {
        const tarefa = await centralIaService.criarTarefa({
          robo_id: roboId,
          setor: (contexto.setor as string) || "Geral",
          tipo_tarefa: "automacao",
          titulo: solicitacao.slice(0, 200),
          descricao: solicitacao,
          prioridade: (contexto.prioridade as string) || "normal",
          payload: { origem: "action_engine", ferramenta: codigoUnico, contexto },
        });
        if (tarefa) {
          log("acao_real_tarefa_criada", { codigoUnico, solicitacao }, { tarefa_id: tarefa.id }, "sucesso");
          return { acao: "tarefa_criada", tarefa_id: tarefa.id, status: "executado", tabela: "automacoes_tarefas" };
        }
        return null;
      }

      // ==================== CONSULTA DE LEADS ====================
      case "COM_CONSULTAR_LEADS": {
        const filtro = (contexto.filtro as string) || "";
        const { data: leads } = await supabase.from("crm_leads").select("id, nome, status, origem, criado_em").ilike("nome", `%${filtro}%`).order("criado_em", { ascending: false }).limit(50);
        if (leads && leads.length > 0) {
          log("acao_real_leads_consultados", { codigoUnico, filtro }, { total: leads.length }, "sucesso");
          return { acao: "leads_consultados", total: leads.length, registros: leads, status: "executado", tabela: "crm_leads" };
        }
        const { data: todos } = await supabase.from("crm_leads").select("id, nome, status, origem, criado_em").order("criado_em", { ascending: false }).limit(50);
        if (todos && todos.length > 0) {
          log("acao_real_leads_consultados", { codigoUnico }, { total: todos.length }, "sucesso");
          return { acao: "leads_consultados", total: todos.length, registros: todos, status: "executado", tabela: "crm_leads" };
        }
        return null;
      }

      // ==================== REGISTRAR FOLLOW-UP ====================
      case "COM_REGISTRAR_FOLLOWUP": {
        const { data: novo } = await supabase.from("crm_followups").insert({
          lead_id: contexto.lead_id || contexto.cliente_id || null,
          descricao: (contexto.descricao as string) || solicitacao,
          tipo: (contexto.tipo as string) || "followup",
          criado_por: roboId,
          criado_em: nowISO(),
        }).select().single();
        if (novo) {
          log("acao_real_followup_registrado", { codigoUnico }, { followup_id: (novo as Record<string, unknown>).id }, "sucesso");
          return { acao: "followup_registrado", followup_id: (novo as Record<string, unknown>).id, status: "executado", tabela: "crm_followups" };
        }
        return null;
      }

      // ==================== CONSULTAR OS ====================
      case "COM_CONSULTAR_OS": {
        const { data: osList } = await supabase.from("alocacoes_escala").select("id, prestador_nome, status, data_escala, created_at").order("created_at", { ascending: false }).limit(50);
        if (osList) {
          log("acao_real_os_consultadas", { codigoUnico }, { total: osList.length }, "sucesso");
          return { acao: "os_consultadas", total: osList.length, registros: osList, status: "executado", tabela: "alocacoes_escala" };
        }
        return null;
      }

      // ==================== ATUALIZAR STATUS ====================
      case "COM_ATUALIZAR_STATUS": {
        const osId = contexto.os_id as string;
        const novoStatus = contexto.status as string;
        if (osId && novoStatus) {
          await supabase.from("alocacoes_escala").update({ status: novoStatus, updated_at: nowISO() }).eq("id", osId);
          log("acao_real_status_atualizado", { codigoUnico, osId, novoStatus }, {}, "sucesso");
          return { acao: "status_atualizado", os_id: osId, novo_status: novoStatus, status: "executado", tabela: "alocacoes_escala" };
        }
        return null;
      }

      // ==================== REGISTRAR OCORRENCIA ====================
      case "COM_REGISTRAR_OCORRENCIA": {
        const { data: oc } = await supabase.from("portal_ocorrencias").insert({
          os_id: contexto.os_id || null,
          tipo: (contexto.tipo as string) || "operacional",
          descricao: (contexto.descricao as string) || solicitacao,
          criado_por: roboId,
          created_at: nowISO(),
        }).select().single();
        if (oc) {
          log("acao_real_ocorrencia_registrada", { codigoUnico }, { ocorrencia_id: (oc as Record<string, unknown>).id }, "sucesso");
          return { acao: "ocorrencia_registrada", ocorrencia_id: (oc as Record<string, unknown>).id, status: "executado", tabela: "portal_ocorrencias" };
        }
        return null;
      }

      // ==================== CONSULTAR FINANCEIRO ====================
      case "COM_CONSULTAR_FINANCEIRO":
      case "COM_CONSULTAR_SALDO": {
        const { data: fin } = await supabase.from("financeiro_receber").select("id, descricao, valor, status, data_vencimento, cliente").order("data_vencimento", { ascending: false }).limit(50);
        if (fin) {
          const totalAberto = fin.filter((r: Record<string, unknown>) => r.status === "aberto" || r.status === "pendente").reduce((s: number, r: Record<string, unknown>) => s + (Number(r.valor) || 0), 0);
          log("acao_real_financeiro_consultado", { codigoUnico }, { total_registros: fin.length, total_aberto: totalAberto }, "sucesso");
          return { acao: "financeiro_consultado", total_registros: fin.length, total_em_aberto: totalAberto, registros: fin.slice(0, 20), status: "executado", tabela: "financeiro_receber" };
        }
        return null;
      }

      // ==================== CONSULTAR DOCUMENTOS FISCAIS ====================
      case "COM_CONSULTAR_DOCUMENTOS_FISCAIS": {
        const [ctes, nfses] = await Promise.all([
          supabase.from("fiscal_ctes").select("id, numero, chave, status, created_at").order("created_at", { ascending: false }).limit(30),
          supabase.from("fiscal_nfse").select("id, numero, status, created_at").order("created_at", { ascending: false }).limit(30),
        ]);
        log("acao_real_documentos_consultados", { codigoUnico }, { ctes: (ctes.data || []).length, nfses: (nfses.data || []).length }, "sucesso");
        return { acao: "documentos_consultados", total_ctes: (ctes.data || []).length, total_nfses: (nfses.data || []).length, ctes: ctes.data, nfses: nfses.data, status: "executado", tabela: "fiscal_ctes,fiscal_nfse" };
      }

      // ==================== CONFERIR CTE / NFSE ====================
      case "COM_CONFERIR_CTE": {
        const { data: docs } = await supabase.from("fiscal_ctes").select("id, numero, chave, status, created_at").eq("status", "pendente").order("created_at", { ascending: false }).limit(50);
        log("acao_real_cte_conferidos", { codigoUnico }, { pendentes: (docs || []).length }, "sucesso");
        return { acao: "cte_conferidos", pendentes: (docs || []).length, registros: docs, status: "executado", tabela: "fiscal_ctes" };
      }
      case "COM_CONFERIR_NFSE": {
        const { data: docs } = await supabase.from("fiscal_nfse").select("id, numero, status, created_at").eq("status", "pendente").order("created_at", { ascending: false }).limit(50);
        log("acao_real_nfse_conferidas", { codigoUnico }, { pendentes: (docs || []).length }, "sucesso");
        return { acao: "nfse_conferidas", pendentes: (docs || []).length, registros: docs, status: "executado", tabela: "fiscal_nfse" };
      }

      // ==================== CONSULTAR CANDIDATOS ====================
      case "COM_CONSULTAR_CANDIDATOS": {
        const { data: recCands } = await supabase.from("recrutamento_candidatos").select("id, nome, nome_completo, status, stage, score, telefone, email, created_at").order("created_at", { ascending: false }).limit(50);
        if (recCands && recCands.length > 0) {
          log("acao_real_candidatos_consultados", { codigoUnico }, { total: recCands.length }, "sucesso");
          return { acao: "candidatos_consultados", total: recCands.length, registros: recCands, status: "executado", tabela: "recrutamento_candidatos" };
        }
        return null;
      }

      // ==================== CONSULTAR PEDIDO ====================
      case "COM_CONSULTAR_PEDIDO": {
        const { data: pedidos } = await supabase.from("portal_pedidos").select("*").order("created_at", { ascending: false }).limit(50);
        if (pedidos) {
          log("acao_real_pedidos_consultados", { codigoUnico }, { total: pedidos.length }, "sucesso");
          return { acao: "pedidos_consultados", total: pedidos.length, registros: pedidos, status: "executado", tabela: "portal_pedidos" };
        }
        return null;
      }

      // ==================== CONSULTAR STATUS ====================
      case "COM_CONSULTAR_STATUS": {
        const osId = contexto.os_id as string;
        if (osId) {
          const { data: os } = await supabase.from("alocacoes_escala").select("id, status, prestador_nome, data_escala").eq("id", osId).maybeSingle();
          if (os) {
            log("acao_real_status_consultado", { codigoUnico, osId }, { status: (os as Record<string, unknown>).status }, "sucesso");
            return { acao: "status_consultado", os: os, status: "executado", tabela: "alocacoes_escala" };
          }
        }
        const { data: statusList } = await supabase.from("alocacoes_escala").select("status").limit(100);
        const grouped: Record<string, number> = {};
        for (const s of (statusList || []) as { status: string }[]) {
          grouped[s.status] = (grouped[s.status] || 0) + 1;
        }
        log("acao_real_status_agregado", { codigoUnico }, grouped, "sucesso");
        return { acao: "status_agregado", distribuicao: grouped, status: "executado", tabela: "alocacoes_escala" };
      }

      // ==================== CONSULTAR HISTORICO ====================
      case "COM_CONSULTAR_HISTORICO": {
        const { data: historico } = await supabase.from("crm_historico").select("*").order("criado_em", { ascending: false }).limit(50);
        if (historico && historico.length > 0) {
          log("acao_real_historico_consultado", { codigoUnico }, { total: historico.length }, "sucesso");
          return { acao: "historico_consultado", total: historico.length, registros: historico, status: "executado", tabela: "crm_historico" };
        }
        const { data: osHistorico } = await supabase.from("alocacoes_escala").select("id, prestador_nome, status, data_escala, created_at").order("created_at", { ascending: false }).limit(50);
        if (osHistorico) {
          log("acao_real_historico_consultado", { codigoUnico }, { total: osHistorico.length }, "sucesso");
          return { acao: "historico_consultado", total: osHistorico.length, registros: osHistorico, status: "executado", tabela: "alocacoes_escala" };
        }
        return null;
      }

      // ==================== CONSULTAR ESCALA ====================
      case "COM_CONSULTAR_ESCALA": {
        const { data: escalas } = await supabase.from("alocacoes_escala").select("id, prestador_nome, status, data_escala, created_at").order("data_escala", { ascending: false }).limit(50);
        log("acao_real_escala_consultada", { codigoUnico }, { total: (escalas || []).length }, "sucesso");
        return { acao: "escala_consultada", total: (escalas || []).length, registros: escalas, status: "executado", tabela: "alocacoes_escala" };
      }

      // ==================== CONSULTAR PAGAMENTOS ====================
      case "COM_CONSULTAR_PAGAMENTOS": {
        const { data: pags } = await supabase.from("pagamentos_prestadores").select("id, prestador_nome, valor, status_pagamento, data_competencia").order("data_competencia", { ascending: false }).limit(50);
        const totalPendente = (pags || []).filter((p: Record<string, unknown>) => p.status_pagamento === "pendente").reduce((s: number, p: Record<string, unknown>) => s + (Number(p.valor) || 0), 0);
        log("acao_real_pagamentos_consultados", { codigoUnico }, { total: (pags || []).length, pendente: totalPendente }, "sucesso");
        return { acao: "pagamentos_consultados", total: (pags || []).length, total_pendente: totalPendente, registros: pags, status: "executado", tabela: "pagamentos_prestadores" };
      }

      // ==================== CONSULTAR OCORRENCIAS ====================
      case "COM_CONSULTAR_OCORRENCIAS": {
        const { data: ocorrencias } = await supabase.from("portal_ocorrencias").select("*").order("created_at", { ascending: false }).limit(50);
        log("acao_real_ocorrencias_consultadas", { codigoUnico }, { total: (ocorrencias || []).length }, "sucesso");
        return { acao: "ocorrencias_consultadas", total: (ocorrencias || []).length, registros: ocorrencias, status: "executado", tabela: "portal_ocorrencias" };
      }

      // ==================== CONSULTAR ALERTAS ====================
      case "COM_CONSULTAR_ALERTAS": {
        const { data: logsRecentes } = await supabase.from("ia_logs").select("id, acao, status, criado_em, erro").eq("robo_id", roboId).order("criado_em", { ascending: false }).limit(50);
        const alertas = (logsRecentes || []).filter((l: Record<string, unknown>) => l.status === "erro" || l.status === "aviso");
        log("acao_real_alertas_consultados", { codigoUnico }, { total: alertas.length }, "sucesso");
        return { acao: "alertas_consultados", total: alertas.length, registros: alertas.slice(0, 20), status: "executado", tabela: "ia_logs" };
      }

      // ==================== GERAR RELATORIO ====================
      case "COM_GERAR_RELATORIO": {
        const tipoRel = (contexto.tipo as string) || "geral";
        const [osTotal, finTotal, pendTotal] = await Promise.all([
          supabase.from("alocacoes_escala").select("id, status"),
          supabase.from("financeiro_receber").select("id, valor, status"),
          supabase.from("pagamentos_prestadores").select("id, valor, status_pagamento"),
        ]);
        const osList = (osTotal.data || []) as { status: string }[];
        const finList = (finTotal.data || []) as { valor: number; status: string }[];
        const pagsData = (pendTotal.data || []) as { valor: number; status_pagamento: string }[];
        const faturamentoAberto = finList.filter((f: { status: string }) => f.status === "aberto" || f.status === "pendente").reduce((s: number, f: { valor: number }) => s + (Number(f.valor) || 0), 0);
        const osPorStatus: Record<string, number> = {};
        for (const o of osList) { osPorStatus[o.status] = (osPorStatus[o.status] || 0) + 1; }
        log("acao_real_relatorio_gerado", { codigoUnico, tipoRel }, { os: osList.length, financeiro: finList.length, faturamento_aberto: faturamentoAberto }, "sucesso");
        return {
          acao: "relatorio_gerado", tipo: tipoRel,
          resumo: {
            total_os: osList.length,
            os_por_status: osPorStatus,
            total_financeiro: finList.length,
            faturamento_em_aberto: faturamentoAberto,
            total_pagamentos: pagsData.length,
          },
          status: "executado", tabela: "alocacoes_escala,financeiro_receber,pagamentos_prestadores",
        };
      }

      // ==================== MONITORAR PROCESSOS ====================
      case "COM_MONITORAR_PROCESSOS": {
        const [osAtivas, finPendentes, pagPendentes] = await Promise.all([
          supabase.from("alocacoes_escala").select("id", { count: "exact", head: false }).in("status", ["agendado", "em_andamento", "alocado"]),
          supabase.from("financeiro_receber").select("id", { count: "exact", head: false }).in("status", ["aberto", "pendente"]),
          supabase.from("pagamentos_prestadores").select("id", { count: "exact", head: false }).eq("status_pagamento", "pendente"),
        ]);
        log("acao_real_processos_monitorados", { codigoUnico }, { os_ativas: (osAtivas.count || 0), financeiro_pendente: (finPendentes.count || 0), pagamentos_pendentes: (pagPendentes.count || 0) }, "sucesso");
        return {
          acao: "processos_monitorados",
          os_ativas: osAtivas.count || 0,
          financeiro_pendente: finPendentes.count || 0,
          pagamentos_pendentes: pagPendentes.count || 0,
          status: "executado",
        };
      }

      // ==================== CONSULTAR DADOS COMERCIAIS ====================
      case "COM_CONSULTAR_PROPOSTA":
      case "COM_GERAR_PROPOSTA": {
        const { data: propostas } = await supabase.from("crm_leads").select("id, nome, status, valor, criado_em").order("criado_em", { ascending: false }).limit(50);
        if (propostas) {
          log("acao_real_propostas_consultadas", { codigoUnico }, { total: propostas.length }, "sucesso");
          return { acao: "propostas_consultadas", total: propostas.length, registros: propostas, status: "executado", tabela: "crm_leads" };
        }
        return null;
      }

      // ==================== REGISTRAR PAGAMENTO ====================
      case "COM_REGISTRAR_PAGAMENTO": {
        // TMS-FIN-SEC-02-A4: DML direto REMOVIDO.
        // Nao existe RPC/contrato oficial para criar financeiro_receber ad-hoc
        // (f_emitir_fatura cria AR de fatura; f_registrar_baixa_financeira baixa
        // titulo existente). Fail-safe: NAO cria titulo, NAO ha falso sucesso.
        const clienteId = contexto.cliente_id as string;
        const valor = Number(contexto.valor) || 0;
        log("acao_real_pagamento_bloqueado", { codigoUnico, clienteId, valor },
            { motivo: "SEM_RPC_OFICIAL_FINANCEIRO_RECEBER" }, "bloqueada_governanca");
        return {
          execucao_real: true,
          status: "BLOQUEADA",
          tabela: "financeiro_receber",
          registros: 0,
          acao: "pagamento_bloqueado",
          motivo: "SEM_RPC_OFICIAL: registro de recebimento manual exige RPC/contrato seguro oficial (A4 pendente).",
        };
      }

      // ==================== GERAR ALERTA ====================
      case "COM_GERAR_ALERTA": {
        const { data: alerta } = await supabase.from("ia_logs").insert({
          robo_id: roboId,
          acao: "alerta_gerado",
          entrada: { tipo: contexto.tipo || "operacional", mensagem: contexto.mensagem || solicitacao },
          saida: {},
          status: contexto.gravidade === "critico" ? "erro" : "aviso",
        }).select().single();
        if (alerta) {
          log("acao_real_alerta_gerado", { codigoUnico, tipo: contexto.tipo, gravidade: contexto.gravidade }, { log_id: (alerta as Record<string, unknown>).id }, "sucesso");
          return { acao: "alerta_gerado", log_id: (alerta as Record<string, unknown>).id, status: "executado", tabela: "ia_logs" };
        }
        return null;
      }

      // ==================== ANALISAR DOCUMENTOS ====================
      case "COM_ANALISAR_DOCUMENTOS": {
        const { data: docs } = await supabase.from("prestadores").select("id, nome_completo, cpf_cnpj, documento_status, created_at").limit(50);
        const pendentes = (docs || []).filter((d: Record<string, unknown>) => d.documento_status === "pendente" || !d.documento_status);
        log("acao_real_documentos_analisados", { codigoUnico }, { total: (docs || []).length, pendentes: pendentes.length }, "sucesso");
        return { acao: "documentos_analisados", total: (docs || []).length, pendentes: pendentes.length, registros: pendentes.slice(0, 20), status: "executado", tabela: "prestadores" };
      }

      // ==================== REGISTRAR AVALIACAO ====================
      case "COM_REGISTRAR_AVALIACAO": {
        const candId = contexto.candidato_id as string;
        if (candId) {
          await supabase.from("recrutamento_candidatos").update({
            avaliacao_nota: Number(contexto.nota) || 0,
            avaliacao_comentario: (contexto.comentario as string) || "",
            status: "avaliado",
            updated_at: nowISO(),
          }).eq("id", candId);
          log("acao_real_avaliacao_registrada", { codigoUnico, candidato_id: candId, nota: contexto.nota }, {}, "sucesso");
          return { acao: "avaliacao_registrada", candidato_id: candId, nota: Number(contexto.nota) || 0, status: "executado", tabela: "recrutamento_candidatos" };
        }
        return null;
      }

      // ==================== CRIAR ESCALA ====================
      case "COM_CRIAR_ESCALA": {
        const prestador = contexto.prestador_id || contexto.prestador_nome;
        const dataEscala = (contexto.data as string) || nowISO().split("T")[0];
        if (prestador) {
          const { data: esc } = await supabase.from("alocacoes_escala").insert({
            prestador_id: contexto.prestador_id || null,
            prestador_nome: (contexto.prestador_nome as string) || String(prestador),
            data_escala: dataEscala,
            status: "agendado",
            criado_por: roboId,
            created_at: nowISO(),
          }).select().single();
          if (esc) {
            log("acao_real_escala_criada", { codigoUnico, prestador, data: dataEscala }, { escala_id: (esc as Record<string, unknown>).id }, "sucesso");
            return { acao: "escala_criada", escala_id: (esc as Record<string, unknown>).id, status: "executado", tabela: "alocacoes_escala" };
          }
        }
        return null;
      }

      // ==================== ENVIAR CONVITE ====================
      case "COM_ENVIAR_CONVITE": {
        const candId = contexto.candidato_id as string;
        const { data: conv } = await supabase.from("ia_logs").insert({
          robo_id: roboId,
          acao: "convite_enviado",
          entrada: {
            candidato_id: candId || null,
            mensagem: (contexto.mensagem as string) || solicitacao,
            tipo_convite: (contexto.tipo as string) || "entrevista",
          },
          saida: {},
          status: "sucesso",
        }).select().single();
        if (conv) {
          log("acao_real_convite_enviado", { codigoUnico, candidato_id: candId }, { log_id: (conv as Record<string, unknown>).id }, "sucesso");
          return { acao: "convite_enviado", log_id: (conv as Record<string, unknown>).id, status: "executado", tabela: "ia_logs" };
        }
        return null;
      }

      // ==================== VALIDAR XML ====================
      case "COM_VALIDAR_XML": {
        const [ctes, nfses] = await Promise.all([
          supabase.from("fiscal_ctes").select("id, numero, chave, status, created_at").eq("status", "pendente").limit(50),
          supabase.from("fiscal_nfse").select("id, numero, status, created_at").eq("status", "pendente").limit(50),
        ]);
        const inconistentes = [
          ...((ctes.data || []) as { id: string; numero: string; status: string }[]).filter(d => d.status === "pendente"),
          ...((nfses.data || []) as { id: string; numero: string; status: string }[]).filter(d => d.status === "pendente"),
        ];
        log("acao_real_xml_validados", { codigoUnico }, { ctes_pendentes: (ctes.data || []).length, nfses_pendentes: (nfses.data || []).length }, "sucesso");
        return {
          acao: "xml_validados", total_pendentes: inconistentes.length,
          ctes_pendentes: (ctes.data || []).length, nfses_pendentes: (nfses.data || []).length,
          registros: inconistentes.slice(0, 20),
          status: "executado", tabela: "fiscal_ctes,fiscal_nfse",
        };
      }

      default:
        return null;
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log("acao_real_erro", { codigoUnico, erro: errMsg }, {}, "erro", errMsg);
    return null;
  }
}
